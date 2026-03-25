use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{
  fs,
  path::{Path, PathBuf},
};
use tauri::Manager;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BundledModelInfo {
  pub profile_id: String,
  pub display_name: String,
  pub version: String,
  pub model_file: String,
  pub input_width: u32,
  pub input_height: u32,
  pub manifest_path: String,
  pub model_path: String,
  pub bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatus {
  pub engine: String,
  pub resources_dir: String,
  pub models_dir: String,
  pub ready: bool,
  pub bundled_model: Option<BundledModelInfo>,
  pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CleanupEngineKind {
  LegacyHeuristic,
  EmbeddedOnnx,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelManifest {
  pub profile_id: String,
  pub display_name: String,
  pub model_file: String,
  pub input_width: u32,
  pub input_height: u32,
}

pub fn bundled_models_dir(app: &tauri::AppHandle) -> Result<PathBuf> {
  // 开发模式下使用项目中的 resources 目录
  if cfg!(debug_assertions) {
    // 从当前可执行文件向上查找项目根目录
    let exe_path = std::env::current_exe()?;
    let project_root = exe_path
      .ancestors()
      .find(|a| a.join("resources").exists())
      .unwrap_or_else(|| exe_path.parent().unwrap_or(&exe_path));
    let dev_models_dir = project_root.join("resources").join("models");
    if dev_models_dir.exists() {
      return Ok(dev_models_dir);
    }
  }
  Ok(app.path().resource_dir()?.join("models"))
}

pub fn resolve_runtime_status(app: &tauri::AppHandle) -> Result<RuntimeStatus> {
  let resources_dir = app.path().resource_dir()?;
  let models_dir = bundled_models_dir(app)?;
  let bundled_model = discover_bundled_model(&models_dir)?;
  let ready = bundled_model.is_some();

  Ok(RuntimeStatus {
    engine: if ready {
      "embedded-onnx".to_string()
    } else {
      "legacy-heuristic".to_string()
    },
    resources_dir: resources_dir.to_string_lossy().to_string(),
    models_dir: models_dir.to_string_lossy().to_string(),
    ready,
    bundled_model,
    message: if ready {
      "Bundled model assets detected.".to_string()
    } else {
      "No bundled ONNX model found yet. App will keep using the heuristic engine.".to_string()
    },
  })
}

pub fn resolve_cleanup_engine(app: &tauri::AppHandle) -> Result<CleanupEngineKind> {
  let status = resolve_runtime_status(app)?;
  Ok(if status.ready {
    CleanupEngineKind::EmbeddedOnnx
  } else {
    CleanupEngineKind::LegacyHeuristic
  })
}

pub fn resolve_bundled_model(app: &tauri::AppHandle) -> Result<Option<BundledModelInfo>> {
  let models_dir = bundled_models_dir(app)?;
  discover_bundled_model(&models_dir)
}

fn discover_bundled_model(models_dir: &Path) -> Result<Option<BundledModelInfo>> {
  if !models_dir.exists() {
    return Ok(None);
  }

  let mut candidates = fs::read_dir(models_dir)
    .with_context(|| format!("无法读取模型目录: {}", models_dir.display()))?
    .filter_map(|entry| entry.ok())
    .filter(|entry| entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false))
    .collect::<Vec<_>>();

  candidates.sort_by_key(|entry| entry.file_name());

  for entry in candidates {
    let folder = entry.path();
    let manifest_path = folder.join("manifest.json");
    if !manifest_path.exists() {
      continue;
    }

    let manifest = read_manifest(&manifest_path)?;
    let model_path = folder.join(&manifest.model_file);

    if !model_path.exists() {
      continue;
    }

    let bytes = fs::metadata(&model_path)
      .with_context(|| format!("无法读取模型信息: {}", model_path.display()))?
      .len();
    let version = folder
      .file_name()
      .and_then(|value| value.to_str())
      .unwrap_or("unknown")
      .to_string();

    return Ok(Some(BundledModelInfo {
      profile_id: manifest.profile_id,
      display_name: manifest.display_name,
      version,
      model_file: model_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("model.onnx")
        .to_string(),
      input_width: manifest.input_width,
      input_height: manifest.input_height,
      manifest_path: manifest_path.to_string_lossy().to_string(),
      model_path: model_path.to_string_lossy().to_string(),
      bytes,
    }));
  }

  Ok(None)
}

pub fn read_manifest(path: &Path) -> Result<ModelManifest> {
  let raw =
    fs::read_to_string(path).with_context(|| format!("无法读取模型清单: {}", path.display()))?;
  serde_json::from_str(&raw).with_context(|| format!("模型清单格式无效: {}", path.display()))
}
