use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{
  fs,
  path::{Path, PathBuf},
};
use tauri::Manager;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
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

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ModelSource {
  Local,
  Bundled,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatus {
  pub engine: String,
  pub resources_dir: String,
  pub bundled_models_dir: String,
  pub local_models_dir: String,
  pub ready: bool,
  pub bundled_model: Option<ModelInfo>,
  pub local_model: Option<ModelInfo>,
  pub preferred_model: Option<ModelInfo>,
  pub preferred_model_source: Option<ModelSource>,
  pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CleanupEngineKind {
  LegacyHeuristic,
  EmbeddedOnnx,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct ModelManifest {
  pub profile_id: String,
  pub display_name: String,
  pub model_file: String,
  pub input_width: u32,
  pub input_height: u32,
  #[serde(default)]
  pub version: Option<String>,
  #[serde(default)]
  pub sha256: Option<String>,
  #[serde(default)]
  pub min_app_version: Option<String>,
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

pub fn local_models_dir(app: &tauri::AppHandle) -> Result<PathBuf> {
  Ok(app.path().app_local_data_dir()?.join("models"))
}

pub fn ensure_local_models_dir(app: &tauri::AppHandle) -> Result<PathBuf> {
  let dir = local_models_dir(app)?;
  fs::create_dir_all(&dir)
    .with_context(|| format!("无法创建本地模型目录: {}", dir.display()))?;
  Ok(dir)
}

pub fn resolve_runtime_status(app: &tauri::AppHandle) -> Result<RuntimeStatus> {
  let resources_dir = app.path().resource_dir()?;
  let bundled_dir = bundled_models_dir(app)?;
  let local_dir = local_models_dir(app)?;
  let bundled_model = discover_model(&bundled_dir)?;
  let local_model = discover_model(&local_dir)?;
  let preferred = local_model.clone().map(|model| (ModelSource::Local, model));
  let ready = preferred.is_some();

  Ok(RuntimeStatus {
    engine: if ready {
      "embedded-onnx".to_string()
    } else {
      "legacy-heuristic".to_string()
    },
    resources_dir: resources_dir.to_string_lossy().to_string(),
    bundled_models_dir: bundled_dir.to_string_lossy().to_string(),
    local_models_dir: local_dir.to_string_lossy().to_string(),
    ready,
    bundled_model,
    local_model,
    preferred_model: preferred.as_ref().map(|(_, model)| model.clone()),
    preferred_model_source: preferred.as_ref().map(|(source, _)| *source),
    message: match preferred {
      Some((ModelSource::Local, _)) => "Local model assets detected.".to_string(),
      Some((ModelSource::Bundled, _)) => "Bundled model assets detected.".to_string(),
      None => "No installed ONNX model found yet. App will keep using the heuristic engine.".to_string(),
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

pub fn resolve_bundled_model(app: &tauri::AppHandle) -> Result<Option<ModelInfo>> {
  let models_dir = bundled_models_dir(app)?;
  discover_model(&models_dir)
}

pub fn resolve_local_model(app: &tauri::AppHandle) -> Result<Option<ModelInfo>> {
  let models_dir = local_models_dir(app)?;
  discover_model(&models_dir)
}

pub fn resolve_preferred_model(app: &tauri::AppHandle) -> Result<Option<(ModelSource, ModelInfo)>> {
  if let Some(model) = resolve_local_model(app)? {
    return Ok(Some((ModelSource::Local, model)));
  }

  Ok(None)
}

fn discover_model(models_dir: &Path) -> Result<Option<ModelInfo>> {
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
    let version = manifest
      .version
      .clone()
      .or_else(|| {
        folder
          .file_name()
          .and_then(|value| value.to_str())
          .map(|value| value.to_string())
      })
      .unwrap_or_else(|| "unknown".to_string());

    return Ok(Some(ModelInfo {
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
