use anyhow::{anyhow, Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use image::{
  codecs::png::PngEncoder, imageops, ColorType, DynamicImage, GenericImageView, ImageEncoder,
  Rgba, RgbaImage,
};
use serde::{Deserialize, Serialize};
use std::{
  collections::HashSet,
  fs,
  path::{Path, PathBuf},
  time::{SystemTime, UNIX_EPOCH},
};
use walkdir::WalkDir;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BootstrapState {
  app_name: String,
  app_version: String,
  platform: String,
  capabilities: Vec<&'static str>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportedImage {
  id: String,
  path: String,
  name: String,
  width: u32,
  height: u32,
  format: String,
  file_size: u64,
  thumbnail_data_url: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportSummary {
  items: Vec<ImportedImage>,
  warnings: Vec<String>,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Region {
  x: f32,
  y: f32,
  width: f32,
  height: f32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PreviewRequest {
  path: String,
  region: Region,
  cleanup_method: String,
  blur_sigma: f32,
  fill_color: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BatchRequest {
  paths: Vec<String>,
  region: Region,
  cleanup_method: String,
  blur_sigma: f32,
  fill_color: String,
  output_dir: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PreviewResult {
  source_data_url: String,
  processed_data_url: String,
  output_width: u32,
  output_height: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BatchEntry {
  source_path: String,
  output_path: String,
  success: bool,
  error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BatchResult {
  output_dir: String,
  success_count: usize,
  failed_count: usize,
  entries: Vec<BatchEntry>,
}

#[tauri::command]
fn bootstrap_state(app: tauri::AppHandle) -> BootstrapState {
  let package_info = app.package_info();
  BootstrapState {
    app_name: package_info.name.clone(),
    app_version: package_info.version.to_string(),
    platform: std::env::consts::OS.to_string(),
    capabilities: vec![
      "local-file-import",
      "fixed-region-preview",
      "batch-export",
      "template-preset-local",
    ],
  }
}

fn supported_image(path: &Path) -> bool {
  path
    .extension()
    .and_then(|ext| ext.to_str())
    .map(|ext| {
      matches!(
        ext.to_ascii_lowercase().as_str(),
        "png" | "jpg" | "jpeg" | "webp"
      )
    })
    .unwrap_or(false)
}

fn collect_image_paths(paths: Vec<String>) -> (Vec<PathBuf>, Vec<String>) {
  let mut warnings = Vec::new();
  let mut seen = HashSet::new();
  let mut collected = Vec::new();

  for raw in paths {
    let path = PathBuf::from(raw);

    if path.is_dir() {
      for entry in WalkDir::new(&path)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
      {
        let candidate = entry.path().to_path_buf();
        if !supported_image(&candidate) {
          continue;
        }

        if seen.insert(candidate.clone()) {
          collected.push(candidate);
        }
      }
      continue;
    }

    if !path.exists() {
      warnings.push(format!("路径不存在，已跳过: {}", path.display()));
      continue;
    }

    if !supported_image(&path) {
      warnings.push(format!("格式不受支持，已跳过: {}", path.display()));
      continue;
    }

    if seen.insert(path.clone()) {
      collected.push(path);
    }
  }

  (collected, warnings)
}

fn encode_png_data_url(image: &DynamicImage) -> Result<String> {
  let rgba = image.to_rgba8();
  let (width, height) = rgba.dimensions();
  let mut bytes = Vec::new();
  let encoder = PngEncoder::new(&mut bytes);

  encoder.write_image(&rgba, width, height, ColorType::Rgba8.into())?;

  Ok(format!("data:image/png;base64,{}", BASE64.encode(bytes)))
}

fn load_image(path: &Path) -> Result<DynamicImage> {
  image::open(path).with_context(|| format!("无法读取图片: {}", path.display()))
}

fn parse_hex_color(value: &str) -> Result<Rgba<u8>> {
  let hex = value.trim().trim_start_matches('#');
  if hex.len() != 6 {
    return Err(anyhow!("填充颜色必须为 6 位十六进制"));
  }

  let r = u8::from_str_radix(&hex[0..2], 16)?;
  let g = u8::from_str_radix(&hex[2..4], 16)?;
  let b = u8::from_str_radix(&hex[4..6], 16)?;

  Ok(Rgba([r, g, b, 255]))
}

fn region_to_pixels(region: Region, width: u32, height: u32) -> (u32, u32, u32, u32) {
  let x = (region.x.clamp(0.0, 0.98) * width as f32).round() as u32;
  let y = (region.y.clamp(0.0, 0.98) * height as f32).round() as u32;
  let max_w = width.saturating_sub(x).max(1);
  let max_h = height.saturating_sub(y).max(1);
  let w = ((region.width.clamp(0.01, 1.0) * width as f32).round() as u32)
    .max(1)
    .min(max_w);
  let h = ((region.height.clamp(0.01, 1.0) * height as f32).round() as u32)
    .max(1)
    .min(max_h);

  (x, y, w, h)
}

fn draw_region_overlay(image: &DynamicImage, region: Region) -> DynamicImage {
  let mut canvas = image.to_rgba8();
  let (width, height) = canvas.dimensions();
  let (x, y, w, h) = region_to_pixels(region, width, height);
  let border = Rgba([0, 72, 141, 255]);

  for px in x..x.saturating_add(w) {
    if y < height {
      canvas.put_pixel(px, y, border);
    }
    let bottom = y.saturating_add(h).saturating_sub(1);
    if bottom < height {
      canvas.put_pixel(px, bottom, border);
    }
  }

  for py in y..y.saturating_add(h) {
    if x < width {
      canvas.put_pixel(x, py, border);
    }
    let right = x.saturating_add(w).saturating_sub(1);
    if right < width {
      canvas.put_pixel(right, py, border);
    }
  }

  DynamicImage::ImageRgba8(canvas)
}

fn crop_image(image: &DynamicImage, region: Region) -> DynamicImage {
  let (width, height) = image.dimensions();
  let (_, y, _, h) = region_to_pixels(region, width, height);

  let top = image.crop_imm(0, 0, width, y).to_rgba8();
  let bottom_y = y.saturating_add(h);
  let bottom_height = height.saturating_sub(bottom_y);
  let bottom = if bottom_height > 0 {
    image.crop_imm(0, bottom_y, width, bottom_height).to_rgba8()
  } else {
    RgbaImage::new(width, 0)
  };

  let mut combined = RgbaImage::new(width, top.height() + bottom.height());
  imageops::replace(&mut combined, &top, 0, 0);
  imageops::replace(&mut combined, &bottom, 0, top.height() as i64);
  DynamicImage::ImageRgba8(combined)
}

fn apply_cleanup(
  image: &DynamicImage,
  region: Region,
  cleanup_method: &str,
  blur_sigma: f32,
  fill_color: &str,
) -> Result<DynamicImage> {
  let (width, height) = image.dimensions();
  let (x, y, w, h) = region_to_pixels(region, width, height);

  match cleanup_method {
    "crop" => Ok(crop_image(image, region)),
    "fill" => {
      let mut canvas = image.to_rgba8();
      let color = parse_hex_color(fill_color)?;

      for py in y..y.saturating_add(h) {
        for px in x..x.saturating_add(w) {
          canvas.put_pixel(px, py, color);
        }
      }

      Ok(DynamicImage::ImageRgba8(canvas))
    }
    _ => {
      let mut canvas = image.to_rgba8();
      let patch = image.crop_imm(x, y, w, h).blur(blur_sigma.max(1.0)).to_rgba8();
      imageops::replace(&mut canvas, &patch, x as i64, y as i64);
      Ok(DynamicImage::ImageRgba8(canvas))
    }
  }
}

fn output_directory(requested: Option<String>, first_path: &str) -> Result<PathBuf> {
  if let Some(path) = requested {
    let output = PathBuf::from(path);
    fs::create_dir_all(&output)?;
    return Ok(output);
  }

  let first = PathBuf::from(first_path);
  let base = first
    .parent()
    .map(Path::to_path_buf)
    .unwrap_or_else(|| PathBuf::from("."));
  let stamp = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .context("系统时间异常")?
    .as_secs();
  let output = base.join(format!("batch-image-studio-output-{}", stamp));
  fs::create_dir_all(&output)?;
  Ok(output)
}

#[tauri::command]
fn import_paths(paths: Vec<String>) -> Result<ImportSummary, String> {
  let (collected, mut warnings) = collect_image_paths(paths);
  let mut items = Vec::new();

  for path in collected {
    match load_image(&path) {
      Ok(image) => {
        let metadata = fs::metadata(&path).map_err(|err| err.to_string())?;
        let thumbnail = image.thumbnail(280, 280);
        let thumbnail_data_url =
          encode_png_data_url(&thumbnail).map_err(|err| err.to_string())?;
        let extension = path
          .extension()
          .and_then(|ext| ext.to_str())
          .unwrap_or("unknown")
          .to_ascii_lowercase();

        items.push(ImportedImage {
          id: path.to_string_lossy().to_string(),
          path: path.to_string_lossy().to_string(),
          name: path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("unnamed")
            .to_string(),
          width: image.width(),
          height: image.height(),
          format: extension,
          file_size: metadata.len(),
          thumbnail_data_url,
        });
      }
      Err(err) => warnings.push(err.to_string()),
    }
  }

  Ok(ImportSummary { items, warnings })
}

#[tauri::command]
fn preview_cleanup(request: PreviewRequest) -> Result<PreviewResult, String> {
  let image = load_image(Path::new(&request.path)).map_err(|err| err.to_string())?;
  let source = draw_region_overlay(&image, request.region);
  let processed = apply_cleanup(
    &image,
    request.region,
    &request.cleanup_method,
    request.blur_sigma,
    &request.fill_color,
  )
  .map_err(|err| err.to_string())?;

  Ok(PreviewResult {
    source_data_url: encode_png_data_url(&source).map_err(|err| err.to_string())?,
    processed_data_url: encode_png_data_url(&processed).map_err(|err| err.to_string())?,
    output_width: processed.width(),
    output_height: processed.height(),
  })
}

#[tauri::command]
fn run_batch_cleanup(request: BatchRequest) -> Result<BatchResult, String> {
  if request.paths.is_empty() {
    return Err("没有可处理的图片".to_string());
  }

  let output_dir =
    output_directory(request.output_dir.clone(), &request.paths[0]).map_err(|err| err.to_string())?;
  let mut entries = Vec::new();
  let mut success_count = 0usize;
  let mut failed_count = 0usize;

  for source_path in request.paths {
    let path = PathBuf::from(&source_path);
    let file_name = path
      .file_name()
      .and_then(|name| name.to_str())
      .unwrap_or("output.png")
      .to_string();
    let output_path = output_dir.join(file_name);

    let result = (|| -> Result<()> {
      let image = load_image(&path)?;
      let processed = apply_cleanup(
        &image,
        request.region,
        &request.cleanup_method,
        request.blur_sigma,
        &request.fill_color,
      )?;
      processed.save(&output_path)?;
      Ok(())
    })();

    match result {
      Ok(()) => {
        success_count += 1;
        entries.push(BatchEntry {
          source_path: source_path.clone(),
          output_path: output_path.to_string_lossy().to_string(),
          success: true,
          error: None,
        });
      }
      Err(err) => {
        failed_count += 1;
        entries.push(BatchEntry {
          source_path: source_path.clone(),
          output_path: output_path.to_string_lossy().to_string(),
          success: false,
          error: Some(err.to_string()),
        });
      }
    }
  }

  Ok(BatchResult {
    output_dir: output_dir.to_string_lossy().to_string(),
    success_count,
    failed_count,
    entries,
  })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      bootstrap_state,
      import_paths,
      preview_cleanup,
      run_batch_cleanup
    ])
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
