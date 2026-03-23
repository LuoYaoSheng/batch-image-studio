use anyhow::{anyhow, Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use image::{
  codecs::{jpeg::JpegEncoder, png::PngEncoder},
  imageops::{self, FilterType},
  ColorType, DynamicImage, GenericImageView, ImageEncoder, Rgba, RgbaImage,
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
  base_width: u32,
  base_height: u32,
  size_handling_mode: String,
  cleanup_method: String,
  blur_sigma: f32,
  fill_color: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BatchRequest {
  paths: Vec<String>,
  region: Region,
  base_width: u32,
  base_height: u32,
  size_handling_mode: String,
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
  processed_count: usize,
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

fn encode_jpeg_data_url(image: &DynamicImage, quality: u8) -> Result<String> {
  let rgb = image.to_rgb8();
  let (width, height) = rgb.dimensions();
  let mut bytes = Vec::new();
  let mut encoder = JpegEncoder::new_with_quality(&mut bytes, quality);
  encoder.encode(&rgb, width, height, ColorType::Rgb8.into())?;
  Ok(format!("data:image/jpeg;base64,{}", BASE64.encode(bytes)))
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

fn region_to_pixels_relative(region: Region, width: u32, height: u32) -> (u32, u32, u32, u32) {
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

fn region_to_pixels(
  region: Region,
  width: u32,
  height: u32,
  base_width: u32,
  base_height: u32,
  size_handling_mode: &str,
) -> (u32, u32, u32, u32) {
  match size_handling_mode {
    "absolute" => {
      let (base_x, base_y, base_w, base_h) =
        region_to_pixels_relative(region, base_width.max(1), base_height.max(1));
      let x = base_x.min(width.saturating_sub(1));
      let y = base_y.min(height.saturating_sub(1));
      let w = base_w.max(1).min(width.saturating_sub(x).max(1));
      let h = base_h.max(1).min(height.saturating_sub(y).max(1));
      (x, y, w, h)
    }
    "bottomRight" => {
      let (base_x, base_y, base_w, base_h) =
        region_to_pixels_relative(region, base_width.max(1), base_height.max(1));
      let right_margin = base_width.saturating_sub(base_x.saturating_add(base_w));
      let bottom_margin = base_height.saturating_sub(base_y.saturating_add(base_h));
      let w = base_w.max(1).min(width.max(1));
      let h = base_h.max(1).min(height.max(1));
      let x = width.saturating_sub(right_margin.saturating_add(w));
      let y = height.saturating_sub(bottom_margin.saturating_add(h));
      (x, y, w.min(width.saturating_sub(x).max(1)), h.min(height.saturating_sub(y).max(1)))
    }
    _ => region_to_pixels_relative(region, width, height),
  }
}

fn preview_image(image: &DynamicImage, max_dimension: u32) -> DynamicImage {
  let (width, height) = image.dimensions();
  if width <= max_dimension && height <= max_dimension {
    return image.clone();
  }

  image.resize(max_dimension, max_dimension, FilterType::Triangle)
}

fn draw_region_overlay(image: &DynamicImage, region: Region) -> DynamicImage {
  let mut canvas = image.to_rgba8();
  let (width, height) = canvas.dimensions();
  let (x, y, w, h) = region_to_pixels_relative(region, width, height);
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

fn average_border_color(image: &RgbaImage, x: u32, y: u32, w: u32, h: u32) -> Rgba<u8> {
  let (img_w, img_h) = image.dimensions();
  let mut sum = [0u64; 4];
  let mut count = 0u64;

  let x0 = x.saturating_sub(1);
  let y0 = y.saturating_sub(1);
  let x1 = (x.saturating_add(w)).min(img_w.saturating_sub(1));
  let y1 = (y.saturating_add(h)).min(img_h.saturating_sub(1));

  for px in x..x.saturating_add(w).min(img_w) {
    if y0 < img_h {
      let p = image.get_pixel(px, y0).0;
      for i in 0..4 {
        sum[i] += p[i] as u64;
      }
      count += 1;
    }
    if y1 < img_h {
      let p = image.get_pixel(px, y1).0;
      for i in 0..4 {
        sum[i] += p[i] as u64;
      }
      count += 1;
    }
  }

  for py in y..y.saturating_add(h).min(img_h) {
    if x0 < img_w {
      let p = image.get_pixel(x0, py).0;
      for i in 0..4 {
        sum[i] += p[i] as u64;
      }
      count += 1;
    }
    if x1 < img_w {
      let p = image.get_pixel(x1, py).0;
      for i in 0..4 {
        sum[i] += p[i] as u64;
      }
      count += 1;
    }
  }

  if count == 0 {
    return Rgba([247, 249, 252, 255]);
  }

  Rgba([
    (sum[0] / count) as u8,
    (sum[1] / count) as u8,
    (sum[2] / count) as u8,
    (sum[3] / count) as u8,
  ])
}

fn sample_rgba(image: &RgbaImage, x: u32, y: u32) -> [f32; 4] {
  let p = image.get_pixel(
    x.min(image.width().saturating_sub(1)),
    y.min(image.height().saturating_sub(1)),
  );
  [p[0] as f32, p[1] as f32, p[2] as f32, p[3] as f32]
}

fn lerp_rgba(a: [f32; 4], b: [f32; 4], t: f32) -> [f32; 4] {
  [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ]
}

fn synthesize_inpaint_patch(image: &DynamicImage, x: u32, y: u32, w: u32, h: u32) -> RgbaImage {
  let source = image.to_rgba8();
  let mut patch = RgbaImage::new(w, h);
  let img_w = source.width();
  let img_h = source.height();

  let left_x = x.saturating_sub(1);
  let right_x = (x + w).min(img_w.saturating_sub(1));
  let top_y = y.saturating_sub(1);
  let bottom_y = (y + h).min(img_h.saturating_sub(1));

  for py in 0..h {
    let v = if h <= 1 { 0.0 } else { py as f32 / (h - 1) as f32 };
    let sample_y = (y + py).min(img_h.saturating_sub(1));

    for px in 0..w {
      let u = if w <= 1 { 0.0 } else { px as f32 / (w - 1) as f32 };
      let sample_x = (x + px).min(img_w.saturating_sub(1));
      let left_px = sample_rgba(&source, left_x, sample_y);
      let right_px = sample_rgba(&source, right_x, sample_y);
      let top_px = sample_rgba(&source, sample_x, top_y);
      let bottom_px = sample_rgba(&source, sample_x, bottom_y);

      let horizontal = lerp_rgba(left_px, right_px, u);
      let vertical = lerp_rgba(top_px, bottom_px, v);
      let mixed = lerp_rgba(horizontal, vertical, 0.5);
      patch.put_pixel(
        px,
        py,
        Rgba([
          mixed[0].round() as u8,
          mixed[1].round() as u8,
          mixed[2].round() as u8,
          255,
        ]),
      );
    }
  }

  patch
}

fn build_context_patch(image: &DynamicImage, x: u32, y: u32, w: u32, h: u32) -> DynamicImage {
  let (img_w, img_h) = image.dimensions();
  let mut candidates: Vec<(u32, DynamicImage)> = Vec::new();

  if y >= h {
    candidates.push((w * h, image.crop_imm(x, y - h, w, h)));
  }
  if y.saturating_add(h * 2) <= img_h {
    candidates.push((w * h, image.crop_imm(x, y + h, w, h)));
  }
  if x >= w {
    candidates.push((w * h, image.crop_imm(x - w, y, w, h)));
  }
  if x.saturating_add(w * 2) <= img_w {
    candidates.push((w * h, image.crop_imm(x + w, y, w, h)));
  }

  if let Some((_, patch)) = candidates.into_iter().max_by_key(|(area, _)| *area) {
    return patch.resize_exact(w, h, FilterType::Triangle);
  }

  let avg = average_border_color(&image.to_rgba8(), x, y, w, h);
  let mut fill = RgbaImage::new(w, h);
  for py in 0..h {
    for px in 0..w {
      fill.put_pixel(px, py, avg);
    }
  }
  DynamicImage::ImageRgba8(fill)
}

fn blend_patch(
  base: &mut RgbaImage,
  patch: &RgbaImage,
  x: u32,
  y: u32,
  feather: u32,
) {
  let (patch_w, patch_h) = patch.dimensions();
  let feather = feather.max(1) as f32;

  for py in 0..patch_h {
    for px in 0..patch_w {
      let dst_x = x + px;
      let dst_y = y + py;
      let original = base.get_pixel(dst_x, dst_y).0;
      let patch_px = patch.get_pixel(px, py).0;

      let dx = px.min(patch_w.saturating_sub(1) - px) as f32;
      let dy = py.min(patch_h.saturating_sub(1) - py) as f32;
      let edge_distance = dx.min(dy);
      let alpha = (edge_distance / feather).clamp(0.0, 1.0);
      let eased = alpha * alpha * (3.0 - 2.0 * alpha);

      let blended = [
        (original[0] as f32 * (1.0 - eased) + patch_px[0] as f32 * eased).round() as u8,
        (original[1] as f32 * (1.0 - eased) + patch_px[1] as f32 * eased).round() as u8,
        (original[2] as f32 * (1.0 - eased) + patch_px[2] as f32 * eased).round() as u8,
        255,
      ];
      base.put_pixel(dst_x, dst_y, Rgba(blended));
    }
  }
}

fn apply_cleanup(
  image: &DynamicImage,
  region: Region,
  base_width: u32,
  base_height: u32,
  size_handling_mode: &str,
  cleanup_method: &str,
  blur_sigma: f32,
  fill_color: &str,
) -> Result<DynamicImage> {
  let (width, height) = image.dimensions();
  let (x, y, w, h) = region_to_pixels(
    region,
    width,
    height,
    base_width,
    base_height,
    size_handling_mode,
  );

  match cleanup_method {
    "crop" => {
      let top = image.crop_imm(0, 0, width, y).to_rgba8();
      let bottom_y = y.saturating_add(h);
      let bottom_height = height.saturating_sub(bottom_y);
      let bottom = if bottom_height > 0 {
        image.crop_imm(0, bottom_y, width, bottom_height).to_rgba8()
      } else {
        RgbaImage::new(width, 0)
      };

      let mut canvas = RgbaImage::new(width, top.height() + bottom.height());
      imageops::replace(&mut canvas, &top, 0, 0);
      imageops::replace(&mut canvas, &bottom, 0, top.height() as i64);
      Ok(DynamicImage::ImageRgba8(canvas))
    }
    "fill" => {
      let mut canvas = image.to_rgba8();
      let color = parse_hex_color(fill_color)
        .unwrap_or_else(|_| average_border_color(&canvas, x, y, w, h));
      let feather = ((w.min(h) as f32) * 0.2).round() as u32;
      let mut patch = RgbaImage::new(w, h);

      for py in 0..h {
        for px in 0..w {
          patch.put_pixel(px, py, color);
        }
      }

      blend_patch(&mut canvas, &patch, x, y, feather);
      Ok(DynamicImage::ImageRgba8(canvas))
    }
    _ => {
      let mut canvas = image.to_rgba8();
      let feather = ((w.min(h) as f32) * 0.18).round() as u32;
      let synthetic = synthesize_inpaint_patch(image, x, y, w, h);
      let context = build_context_patch(image, x, y, w, h)
        .blur((blur_sigma * 0.35).max(1.0))
        .to_rgba8();
      let mut patch = RgbaImage::new(w, h);
      for py in 0..h {
        for px in 0..w {
          let a = synthetic.get_pixel(px, py).0;
          let b = context.get_pixel(px, py).0;
          patch.put_pixel(
            px,
            py,
            Rgba([
              ((a[0] as u16 + b[0] as u16) / 2) as u8,
              ((a[1] as u16 + b[1] as u16) / 2) as u8,
              ((a[2] as u16 + b[2] as u16) / 2) as u8,
              255,
            ]),
          );
        }
      }
      blend_patch(&mut canvas, &patch, x, y, feather);
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

fn build_unique_output_path(output_dir: &Path, source_path: &Path) -> PathBuf {
  let stem = source_path
    .file_stem()
    .and_then(|name| name.to_str())
    .unwrap_or("output");
  let ext = source_path
    .extension()
    .and_then(|name| name.to_str())
    .unwrap_or("png");
  let parent_hint = source_path
    .parent()
    .and_then(|path| path.file_name())
    .and_then(|name| name.to_str())
    .unwrap_or("root")
    .replace(' ', "_");

  let mut candidate = output_dir.join(format!("{stem}.{ext}"));
  if !candidate.exists() {
    return candidate;
  }

  candidate = output_dir.join(format!("{stem}__{parent_hint}.{ext}"));
  if !candidate.exists() {
    return candidate;
  }

  let mut index = 2usize;
  loop {
    let next = output_dir.join(format!("{stem}__{parent_hint}_{index}.{ext}"));
    if !next.exists() {
      return next;
    }
    index += 1;
  }
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
    request.base_width,
    request.base_height,
    &request.size_handling_mode,
    &request.cleanup_method,
    request.blur_sigma,
    &request.fill_color,
  )
  .map_err(|err| err.to_string())?;

  let source_preview = preview_image(&source, 1400);
  let processed_preview = preview_image(&processed, 1400);

  Ok(PreviewResult {
    source_data_url: encode_jpeg_data_url(&source_preview, 82).map_err(|err| err.to_string())?,
    processed_data_url: encode_jpeg_data_url(&processed_preview, 82)
      .map_err(|err| err.to_string())?,
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
    let output_path = build_unique_output_path(&output_dir, &path);

    let result = (|| -> Result<()> {
      let image = load_image(&path)?;
      let processed = apply_cleanup(
        &image,
        request.region,
        request.base_width,
        request.base_height,
        &request.size_handling_mode,
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
    processed_count: entries.len(),
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
