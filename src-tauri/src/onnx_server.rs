use anyhow::{anyhow, Context, Result};
use serde_json::json;
use std::{
  io::{BufRead, BufReader, Write},
  path::{Path, PathBuf},
  process::{Child, ChildStdin, ChildStdout, Command, Stdio},
  sync::Mutex,
};
use tauri::{AppHandle, Manager};

/// ONNX 服务器管理器 - 保持 Python 进程运行，避免重复加载模型
pub struct OnnxServer {
  _process: Child,  // 保持进程生命周期
  stdin: ChildStdin,
  stdout: BufReader<ChildStdout>,
  _model_path: String,  // 保存模型路径用于日志
}

// 实现线程安全，以便在 Tauri 状态中使用
unsafe impl Send for OnnxServer {}

impl OnnxServer {
  /// 创建新的 ONNX 服务器实例
  pub fn new(app: &AppHandle, model_path: String) -> Result<Self> {
    log::info!("启动 ONNX Python 服务器，模型: {}", model_path);

    // 获取服务器脚本路径
    let script_path = if cfg!(debug_assertions) {
      std::env::current_exe()?
        .ancestors()
        .find(|a| a.join("src-tauri").join("scripts").exists())
        .map(|p| p.join("src-tauri").join("scripts").join("lama_server.py"))
        .unwrap_or_else(|| PathBuf::from("src-tauri/scripts/lama_server.py"))
    } else {
      app.path()
        .resource_dir()?
        .join("scripts")
        .join("lama_server.py")
    };

    if !script_path.exists() {
      return Err(anyhow!("服务器脚本不存在: {:?}", script_path));
    }

    log::info!("服务器脚本路径: {:?}", script_path);

    // 启动 Python 进程，保持 stdin/stdout 管道打开
    let mut process = Command::new("python3")
      .arg(&script_path)
      .arg("--model")
      .arg(&model_path)
      .stdin(Stdio::piped())
      .stdout(Stdio::piped())
      .stderr(Stdio::piped())
      .spawn()
      .context("无法启动 Python 服务器")?;

    let stdin = process.stdin.take().ok_or_else(|| anyhow!("无法获取 stdin"))?;
    let stdout = process.stdout.take().ok_or_else(|| anyhow!("无法获取 stdout"))?;
    let stderr = process.stderr.take().ok_or_else(|| anyhow!("无法获取 stderr"))?;

    // 读取 stderr 直到看到"服务已启动"消息
    let stderr_reader = BufReader::new(stderr);
    for line in stderr_reader.lines() {
      if let Ok(line) = line {
        log::info!("[Python Server] {}", line);
        if line.contains("服务已启动") {
          break;
        }
      }
    }

    log::info!("ONNX 服务器启动成功");

    Ok(OnnxServer {
      _process: process,
      stdin,
      stdout: BufReader::new(stdout),
      _model_path: model_path,
    })
  }

  /// 发送 inpaint 请求到服务器
  pub fn inpaint(
    &mut self,
    image_path: &Path,
    mask_path: &Path,
    output_path: &Path,
    size: (u32, u32),
  ) -> Result<()> {
    let request = json!({
      "cmd": "inpaint",
      "image": image_path.to_string_lossy(),
      "mask": mask_path.to_string_lossy(),
      "output": output_path.to_string_lossy(),
      "size": [size.0, size.1]
    });

    writeln!(self.stdin, "{}", request).context("发送请求失败")?;
    self.stdin.flush().context("刷新请求失败")?;

    // 读取响应
    let mut response_line = String::new();
    self.stdout
      .read_line(&mut response_line)
      .context("读取响应失败")?;

    let response: serde_json::Value =
      serde_json::from_str(&response_line).context("解析响应失败")?;

    if response.get("success").and_then(|v| v.as_bool()) != Some(true) {
      let error = response
        .get("error")
        .and_then(|v| v.as_str())
        .unwrap_or("未知错误");
      return Err(anyhow!("ONNX 推理失败: {}", error));
    }

    Ok(())
  }
}

impl Drop for OnnxServer {
  fn drop(&mut self) {
    // 发送退出命令
    let _ = writeln!(self.stdin, "{{\"cmd\": \"quit\"}}");
    let _ = self.stdin.flush();
    // 进程会在 Drop 时自动终止
  }
}

/// 模型加载状态
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ModelLoadStatus {
  NotLoaded,
  Loading,
  Loaded,
  Failed,
}

/// 全局服务器实例（使用 Mutex 保证线程安全）
pub struct OnnxServerManager {
  server: Mutex<Option<OnnxServer>>,
  status: Mutex<ModelLoadStatus>,
}

impl OnnxServerManager {
  pub fn new() -> Self {
    Self {
      server: Mutex::new(None),
      status: Mutex::new(ModelLoadStatus::NotLoaded),
    }
  }

  /// 获取当前模型加载状态
  pub fn status(&self) -> ModelLoadStatus {
    *self.status.lock().unwrap()
  }

  /// 设置模型加载状态
  fn set_status(&self, status: ModelLoadStatus) {
    *self.status.lock().unwrap() = status;
  }

  /// 预加载模型（不阻塞获取服务器实例）
  pub fn preload(&self, app: &AppHandle, model_path: &str) -> Result<bool> {
    let mut status_guard = self.status.lock().unwrap();
    if *status_guard == ModelLoadStatus::Loaded {
      return Ok(true); // 已加载
    }

    // 标记为加载中
    *status_guard = ModelLoadStatus::Loading;
    drop(status_guard);

    match OnnxServer::new(app, model_path.to_string()) {
      Ok(server) => {
        *self.server.lock().unwrap() = Some(server);
        self.set_status(ModelLoadStatus::Loaded);
        log::info!("模型预加载完成");
        Ok(true)
      }
      Err(e) => {
        self.set_status(ModelLoadStatus::Failed);
        log::error!("模型预加载失败: {}", e);
        Err(e)
      }
    }
  }

  /// 获取或创建服务器实例
  pub fn get_or_create(&self, app: &AppHandle, model_path: &str) -> Result<std::sync::MutexGuard<'_, Option<OnnxServer>>> {
    let mut server = self.server.lock().map_err(|_| anyhow!("获取锁失败"))?;

    if server.is_none() {
      log::info!("首次启动 ONNX 服务器...");
      self.set_status(ModelLoadStatus::Loading);
      match OnnxServer::new(app, model_path.to_string()) {
        Ok(s) => {
          *server = Some(s);
          self.set_status(ModelLoadStatus::Loaded);
        }
        Err(e) => {
          self.set_status(ModelLoadStatus::Failed);
          return Err(e);
        }
      }
    }

    Ok(server)
  }

  /// 检查服务器是否已就绪
  #[allow(dead_code)]
  pub fn is_ready(&self) -> bool {
    self.status() == ModelLoadStatus::Loaded
  }
}

impl Default for OnnxServerManager {
  fn default() -> Self {
    Self::new()
  }
}
