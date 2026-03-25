mod model_runtime;
mod onnx_server;

use anyhow::{anyhow, Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use image::{
  codecs::{jpeg::JpegEncoder, png::PngEncoder},
  imageops::{self, FilterType},
  ColorType, DynamicImage, GenericImageView, GrayImage, ImageEncoder, Luma, Rgba, RgbaImage,
};
use inpaint::prelude::ImageInpaint;
use serde::{Deserialize, Serialize};
use std::{
  collections::HashSet,
  fs,
  path::{Path, PathBuf},
  time::{SystemTime, UNIX_EPOCH},
};
use tauri::Manager;
use texture_synthesis as ts;
// tract_onnx 不再使用，改用 Python onnxruntime
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
  mask_data_url: String,
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
fn runtime_status(app: tauri::AppHandle) -> Result<model_runtime::RuntimeStatus, String> {
  model_runtime::resolve_runtime_status(&app).map_err(|err| err.to_string())
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

fn encode_png_bytes(image: &DynamicImage) -> Result<Vec<u8>> {
  let rgba = image.to_rgba8();
  let (width, height) = rgba.dimensions();
  let mut bytes = Vec::new();
  let encoder = PngEncoder::new(&mut bytes);
  encoder.write_image(&rgba, width, height, ColorType::Rgba8.into())?;
  Ok(bytes)
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

fn build_context_patch(image: &DynamicImage, x: u32, y: u32, w: u32, h: u32) -> DynamicImage {
  let (img_w, img_h) = image.dimensions();
  let right_gap = img_w.saturating_sub(x.saturating_add(w));
  let bottom_gap = img_h.saturating_sub(y.saturating_add(h));
  let near_right = right_gap <= w / 2;
  let near_bottom = bottom_gap <= h / 2;

  let left_patch = if x >= w {
    Some(image.crop_imm(x - w, y, w, h).to_rgba8())
  } else {
    None
  };
  let top_patch = if y >= h {
    Some(image.crop_imm(x, y - h, w, h).to_rgba8())
  } else {
    None
  };

  if near_right || near_bottom {
    match (left_patch, top_patch) {
      (Some(left), Some(top)) => {
        let mut merged = RgbaImage::new(w, h);
        for py in 0..h {
          let v = if h <= 1 { 0.0 } else { py as f32 / (h - 1) as f32 };
          for px in 0..w {
            let u = if w <= 1 { 0.0 } else { px as f32 / (w - 1) as f32 };
            let left_px = left.get_pixel(px, py).0;
            let top_px = top.get_pixel(px, py).0;
            let left_weight = if near_right { 0.74 - u * 0.22 } else { 0.52 - u * 0.08 };
            let top_weight = if near_bottom { 0.66 - v * 0.18 } else { 0.48 - v * 0.08 };
            let total = (left_weight + top_weight).max(0.01);

            merged.put_pixel(
              px,
              py,
              Rgba([
                ((left_px[0] as f32 * left_weight + top_px[0] as f32 * top_weight) / total)
                  .round() as u8,
                ((left_px[1] as f32 * left_weight + top_px[1] as f32 * top_weight) / total)
                  .round() as u8,
                ((left_px[2] as f32 * left_weight + top_px[2] as f32 * top_weight) / total)
                  .round() as u8,
                255,
              ]),
            );
          }
        }
        return DynamicImage::ImageRgba8(merged);
      }
      (Some(left), None) => return DynamicImage::ImageRgba8(left),
      (None, Some(top)) => return DynamicImage::ImageRgba8(top),
      (None, None) => {}
    }
  }

  if y.saturating_add(h * 2) <= img_h {
    return image.crop_imm(x, y + h, w, h).resize_exact(w, h, FilterType::Triangle);
  }
  if x.saturating_add(w * 2) <= img_w {
    return image.crop_imm(x + w, y, w, h).resize_exact(w, h, FilterType::Triangle);
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

fn build_corner_reflect_patch(image: &DynamicImage, x: u32, y: u32, w: u32, h: u32) -> RgbaImage {
  let source = image.to_rgba8();
  let mut patch = RgbaImage::new(w, h);
  let max_x = source.width().saturating_sub(1);
  let max_y = source.height().saturating_sub(1);
  let left_edge = x.saturating_sub(1).min(max_x);
  let top_edge = y.saturating_sub(1).min(max_y);

  for py in 0..h {
    let reflect_y = top_edge.saturating_sub(py);
    let vertical_weight = 0.58 - (py as f32 / h.max(1) as f32) * 0.16;

    for px in 0..w {
      let reflect_x = left_edge.saturating_sub(px);
      let horizontal_weight = 0.72 - (px as f32 / w.max(1) as f32) * 0.18;
      let total = (horizontal_weight + vertical_weight).max(0.01);

      let left_px = source.get_pixel(reflect_x, (y + py).min(max_y)).0;
      let top_px = source.get_pixel((x + px).min(max_x), reflect_y).0;

      patch.put_pixel(
        px,
        py,
        Rgba([
          ((left_px[0] as f32 * horizontal_weight + top_px[0] as f32 * vertical_weight) / total)
            .round() as u8,
          ((left_px[1] as f32 * horizontal_weight + top_px[1] as f32 * vertical_weight) / total)
            .round() as u8,
          ((left_px[2] as f32 * horizontal_weight + top_px[2] as f32 * vertical_weight) / total)
            .round() as u8,
          255,
        ]),
      );
    }
  }

  patch
}

fn color_diff(a: [u8; 4], b: [u8; 4]) -> f32 {
  let dr = a[0] as f32 - b[0] as f32;
  let dg = a[1] as f32 - b[1] as f32;
  let db = a[2] as f32 - b[2] as f32;
  (dr * dr + dg * dg + db * db).sqrt()
}

fn luminance(px: [u8; 4]) -> f32 {
  0.299 * px[0] as f32 + 0.587 * px[1] as f32 + 0.114 * px[2] as f32
}

fn saturation(px: [u8; 4]) -> f32 {
  let max = px[0].max(px[1]).max(px[2]) as f32;
  let min = px[0].min(px[1]).min(px[2]) as f32;
  max - min
}

fn local_luma_contrast(image: &RgbaImage, x: u32, y: u32) -> f32 {
  let (width, height) = image.dimensions();
  let center = luminance(image.get_pixel(x, y).0);
  let start_x = x.saturating_sub(1);
  let start_y = y.saturating_sub(1);
  let end_x = (x + 1).min(width.saturating_sub(1));
  let end_y = (y + 1).min(height.saturating_sub(1));
  let mut strongest = 0.0f32;

  for yy in start_y..=end_y {
    for xx in start_x..=end_x {
      if xx == x && yy == y {
        continue;
      }
      let neighbor = luminance(image.get_pixel(xx, yy).0);
      strongest = strongest.max((center - neighbor).abs());
    }
  }

  strongest
}

fn merge_mask(base: &mut GrayImage, extra: &GrayImage) {
  let (width, height) = base.dimensions();
  for y in 0..height {
    for x in 0..width {
      if extra.get_pixel(x, y)[0] > 0 {
        base.put_pixel(x, y, Luma([255]));
      }
    }
  }
}

fn count_mask_pixels(mask: &GrayImage, x: u32, y: u32, w: u32, h: u32) -> u32 {
  let (width, height) = mask.dimensions();
  let mut total = 0u32;

  for py in y..y.saturating_add(h).min(height) {
    for px in x..x.saturating_add(w).min(width) {
      if mask.get_pixel(px, py)[0] > 0 {
        total += 1;
      }
    }
  }

  total
}

fn mask_stats(source: &RgbaImage, estimate: &RgbaImage, mask: &GrayImage) -> (u32, f32, f32) {
  let (width, height) = mask.dimensions();
  let mut count = 0u32;
  let mut edge_sum = 0.0f32;
  let mut diff_sum = 0.0f32;

  for y in 0..height {
    for x in 0..width {
      if mask.get_pixel(x, y)[0] == 0 {
        continue;
      }
      count += 1;
      edge_sum += local_luma_contrast(source, x, y);
      diff_sum += color_diff(source.get_pixel(x, y).0, estimate.get_pixel(x, y).0);
    }
  }

  if count == 0 {
    return (0, 0.0, 0.0);
  }

  (count, edge_sum / count as f32, diff_sum / count as f32)
}

fn apply_estimate_patch(
  original_patch: &RgbaImage,
  estimate_patch: &RgbaImage,
  repair_mask: &GrayImage,
  text_core_mask: &GrayImage,
) -> RgbaImage {
  let (width, height) = original_patch.dimensions();
  let mut patch = original_patch.clone();
  let repair_edge_mask = dilate_mask(repair_mask, 3, 2);
  let text_edge_mask = dilate_mask(text_core_mask, 4, 2);

  for y in 0..height {
    for x in 0..width {
      let repair_value = repair_mask.get_pixel(x, y)[0];
      let repair_edge_value = repair_edge_mask.get_pixel(x, y)[0];
      let text_edge_value = text_edge_mask.get_pixel(x, y)[0];
      if repair_edge_value == 0 && text_edge_value == 0 {
        continue;
      }

      let alpha = if repair_value > 0 {
        1.0
      } else if text_edge_value > 0 {
        0.9
      } else {
        0.6
      };
      let original = patch.get_pixel(x, y).0;
      let estimated = estimate_patch.get_pixel(x, y).0;
      patch.put_pixel(
        x,
        y,
        Rgba([
          (original[0] as f32 * (1.0 - alpha) + estimated[0] as f32 * alpha).round() as u8,
          (original[1] as f32 * (1.0 - alpha) + estimated[1] as f32 * alpha).round() as u8,
          (original[2] as f32 * (1.0 - alpha) + estimated[2] as f32 * alpha).round() as u8,
          255,
        ]),
      );
    }
  }

  patch
}

fn fill_mask_rect(mask: &mut GrayImage, x: u32, y: u32, w: u32, h: u32) {
  let (width, height) = mask.dimensions();
  for py in y..y.saturating_add(h).min(height) {
    for px in x..x.saturating_add(w).min(width) {
      mask.put_pixel(px, py, Luma([255]));
    }
  }
}

fn build_doubao_text_mask(
  source: &RgbaImage,
  estimate: &RgbaImage,
  core_x: u32,
  core_y: u32,
  core_w: u32,
  core_h: u32,
  overlay_like: bool,
) -> GrayImage {
  let (width, height) = source.dimensions();
  let mut text_mask = GrayImage::new(width, height);
  let band_x = core_x.saturating_add((core_w as f32 * 0.42).round() as u32);
  let band_y = core_y.saturating_add((core_h as f32 * 0.46).round() as u32);
  let band_w = ((core_w as f32 * 0.58).round() as u32).max(1);
  let band_h = ((core_h as f32 * 0.54).round() as u32).max(1);
  let mut cumulative_diff = 0.0f32;
  let mut cumulative_edge = 0.0f32;
  let mut sample_count = 0u32;

  for py in band_y..band_y.saturating_add(band_h).min(height) {
    for px in band_x..band_x.saturating_add(band_w).min(width) {
      let src = source.get_pixel(px, py).0;
      let est = estimate.get_pixel(px, py).0;
      let diff = color_diff(src, est);
      let lum = luminance(src);
      let lum_delta = lum - luminance(est);
      let sat = saturation(src);
      let edge = local_luma_contrast(source, px, py);
      cumulative_diff += diff;
      cumulative_edge += edge;
      sample_count += 1;

      let bright_stroke = lum >= if overlay_like { 132.0 } else { 145.0 }
        && sat <= 170.0
        && edge >= if overlay_like { 8.0 } else { 12.0 }
        && (diff >= if overlay_like { 5.0 } else { 8.0 } || lum_delta >= 4.0);
      let dark_stroke = lum <= if overlay_like { 148.0 } else { 128.0 }
        && sat <= 126.0
        && edge >= if overlay_like { 8.0 } else { 12.0 }
        && (diff >= if overlay_like { 5.0 } else { 8.0 } || lum_delta <= -4.0);
      let neutral_stroke = sat <= 112.0
        && edge >= if overlay_like { 10.0 } else { 14.0 }
        && diff >= if overlay_like { 6.0 } else { 9.0 };

      if bright_stroke || dark_stroke || neutral_stroke {
        text_mask.put_pixel(px, py, Luma([255]));
      }
    }
  }

  let hits = count_mask_pixels(&text_mask, band_x, band_y, band_w, band_h);
  let mut final_mask = dilate_mask(&text_mask, 5, 2);
  let avg_diff = if sample_count == 0 {
    0.0
  } else {
    cumulative_diff / sample_count as f32
  };
  let avg_edge = if sample_count == 0 {
    0.0
  } else {
    cumulative_edge / sample_count as f32
  };
  let likely_flat_background = avg_edge <= 9.0 && avg_diff <= if overlay_like { 9.0 } else { 13.0 };

  if hits < (band_w.saturating_mul(band_h) / 42).max(14) {
    for py in band_y..band_y.saturating_add(band_h).min(height) {
      for px in band_x..band_x.saturating_add(band_w).min(width) {
        let src = source.get_pixel(px, py).0;
        let est = estimate.get_pixel(px, py).0;
        let sat = saturation(src);
        let edge = local_luma_contrast(source, px, py);
        let diff = color_diff(src, est);
        let lum_delta = (luminance(src) - luminance(est)).abs();

        if sat <= 154.0 && edge >= 8.0 && (diff >= 5.0 || lum_delta >= 4.0) {
          final_mask.put_pixel(px, py, Luma([255]));
        }
      }
    }

    final_mask = dilate_mask(&final_mask, 7, 3);
  }

  let recovered_hits = count_mask_pixels(&final_mask, band_x, band_y, band_w, band_h);
  if recovered_hits < (band_w.saturating_mul(band_h) / 18).max(24) && likely_flat_background {
    let fallback_x = core_x.saturating_add((core_w as f32 * 0.34).round() as u32);
    let fallback_y = core_y.saturating_add((core_h as f32 * 0.34).round() as u32);
    let fallback_w = ((core_w as f32 * 0.64).round() as u32).max(1);
    let fallback_h = ((core_h as f32 * 0.64).round() as u32).max(1);
    fill_mask_rect(&mut final_mask, fallback_x, fallback_y, fallback_w, fallback_h);
    final_mask = dilate_mask(&final_mask, 3, 2);
  }

  final_mask
}

fn dilate_mask(mask: &GrayImage, radius_x: u32, radius_y: u32) -> GrayImage {
  if radius_x == 0 && radius_y == 0 {
    return mask.clone();
  }

  let (width, height) = mask.dimensions();
  let mut output = GrayImage::new(width, height);

  for y in 0..height {
    for x in 0..width {
      let start_x = x.saturating_sub(radius_x);
      let start_y = y.saturating_sub(radius_y);
      let end_x = (x + radius_x).min(width.saturating_sub(1));
      let end_y = (y + radius_y).min(height.saturating_sub(1));
      let mut active = false;

      'scan: for yy in start_y..=end_y {
        for xx in start_x..=end_x {
          if mask.get_pixel(xx, yy)[0] > 0 {
            active = true;
            break 'scan;
          }
        }
      }

      if active {
        output.put_pixel(x, y, Luma([255]));
      }
    }
  }

  output
}

fn erode_mask(mask: &GrayImage, radius_x: u32, radius_y: u32) -> GrayImage {
  if radius_x == 0 && radius_y == 0 {
    return mask.clone();
  }

  let (width, height) = mask.dimensions();
  let mut output = GrayImage::new(width, height);

  for y in 0..height {
    for x in 0..width {
      if mask.get_pixel(x, y)[0] == 0 {
        continue;
      }

      let start_x = x.saturating_sub(radius_x);
      let start_y = y.saturating_sub(radius_y);
      let end_x = (x + radius_x).min(width.saturating_sub(1));
      let end_y = (y + radius_y).min(height.saturating_sub(1));
      let mut keep = true;

      'scan: for yy in start_y..=end_y {
        for xx in start_x..=end_x {
          if mask.get_pixel(xx, yy)[0] == 0 {
            keep = false;
            break 'scan;
          }
        }
      }

      if keep {
        output.put_pixel(x, y, Luma([255]));
      }
    }
  }

  output
}

fn build_watermark_mask(
  source: &RgbaImage,
  estimate: &RgbaImage,
  core_x: u32,
  core_y: u32,
  core_w: u32,
  core_h: u32,
  repair_strength: f32,
) -> GrayImage {
  let (width, height) = source.dimensions();
  let mut mask = GrayImage::new(width, height);
  let mut high_diff_count = 0u32;
  let core_area = core_w.saturating_mul(core_h).max(1);
  let expand_x = (core_w / 6).max(6);
  let expand_y = (core_h / 4).max(8);
  let focus_start_x = core_x.saturating_add((core_w as f32 * 0.16).round() as u32);
  let focus_start_y = core_y.saturating_add((core_h as f32 * 0.14).round() as u32);
  let text_focus_x = core_x.saturating_add((core_w as f32 * 0.24).round() as u32);
  let text_focus_y = core_y.saturating_add((core_h as f32 * 0.22).round() as u32);

  for py in core_y..core_y.saturating_add(core_h).min(height) {
    for px in core_x..core_x.saturating_add(core_w).min(width) {
      let src = source.get_pixel(px, py).0;
      let est = estimate.get_pixel(px, py).0;
      if color_diff(src, est) > 34.0 {
        high_diff_count += 1;
      }
    }
  }

  let overlay_like = high_diff_count as f32 / core_area as f32 > 0.18;
  let base_diff = if overlay_like { 16.0 } else { 28.0 };
  let bright_diff = if overlay_like { 10.0 } else { 18.0 };
  let text_stroke_mask =
    build_doubao_text_mask(source, estimate, core_x, core_y, core_w, core_h, overlay_like);

  for py in 0..height {
    for px in 0..width {
      let in_core = px >= core_x
        && px < core_x.saturating_add(core_w)
        && py >= core_y
        && py < core_y.saturating_add(core_h);
      let near_core = px >= core_x.saturating_sub(expand_x)
        && px < core_x.saturating_add(core_w).saturating_add(expand_x).min(width)
        && py >= core_y.saturating_sub(expand_y)
        && py < core_y.saturating_add(core_h).saturating_add(expand_y).min(height);

      if !in_core && !near_core {
        continue;
      }

      let src = source.get_pixel(px, py).0;
      let est = estimate.get_pixel(px, py).0;
      let diff = color_diff(src, est);
      let lum = luminance(src);
      let est_lum = luminance(est);
      let lum_delta = lum - est_lum;
      let sat = saturation(src);
      let focus_zone = px >= focus_start_x && py >= focus_start_y;
      let text_focus_zone = px >= text_focus_x && py >= text_focus_y;
      let likely_text = lum_delta >= if overlay_like { 12.0 } else { 22.0 } && sat <= 110.0;
      let likely_shadow = lum_delta <= if overlay_like { -10.0 } else { -18.0 } && sat <= 72.0;
      let likely_overlay_block = diff >= if overlay_like { 18.0 } else { 30.0 } && sat <= 92.0;
      let likely_bright_text =
        text_focus_zone && lum >= 148.0 && sat <= 150.0 && diff >= if overlay_like { 9.0 } else { 14.0 };
      let likely_dark_text =
        text_focus_zone && lum_delta <= if overlay_like { -8.0 } else { -14.0 } && diff >= 10.0 && sat <= 96.0;

      let is_watermark = (in_core && focus_zone && (likely_text || likely_shadow || likely_overlay_block))
        || (in_core && (likely_bright_text || likely_dark_text))
        || (in_core && focus_zone && lum >= 176.0 && sat <= 92.0 && diff >= bright_diff)
        || (near_core && focus_zone && diff >= base_diff + 18.0 && sat <= 76.0);

      if is_watermark {
        mask.put_pixel(px, py, Luma([255]));
      }
    }
  }

  let base_radius_x = if overlay_like {
    (core_w / 10).max(5)
  } else {
    (core_w / 14).max(3)
  };
  let base_radius_y = if overlay_like {
    (core_h / 12).max(3)
  } else {
    (core_h / 18).max(2)
  };
  let strength_boost = ((repair_strength - 8.0) / 4.0).round().max(0.0) as u32;
  let dilated = dilate_mask(
    &mask,
    base_radius_x.saturating_add(strength_boost),
    base_radius_y.saturating_add((strength_boost / 2).max(1)),
  );

  let mut final_mask = dilated;
  merge_mask(&mut final_mask, &text_stroke_mask);
  let mut filled = 0u32;
  for py in core_y..core_y.saturating_add(core_h).min(height) {
    for px in core_x..core_x.saturating_add(core_w).min(width) {
      if final_mask.get_pixel(px, py)[0] > 0 {
        filled += 1;
      }
    }
  }

  if filled < core_area / 20 {
    let fallback_x = core_x.saturating_add((core_w as f32 * 0.24).round() as u32);
    let fallback_y = core_y.saturating_add((core_h as f32 * 0.34).round() as u32);
    let fallback_w = ((core_w as f32 * 0.74).round() as u32).max(1);
    let fallback_h = ((core_h as f32 * 0.58).round() as u32).max(1);

    for py in fallback_y..fallback_y.saturating_add(fallback_h).min(height) {
      for px in fallback_x..fallback_x.saturating_add(fallback_w).min(width) {
        final_mask.put_pixel(px, py, Luma([255]));
      }
    }

    final_mask = dilate_mask(&final_mask, 2, 1);
  }

  final_mask
}

fn build_text_core_mask(
  source: &RgbaImage,
  estimate: &RgbaImage,
  mask: &GrayImage,
  core_x: u32,
  core_y: u32,
  core_w: u32,
  core_h: u32,
) -> GrayImage {
  let (width, height) = source.dimensions();
  let mut core = GrayImage::new(width, height);
  let text_focus_x = core_x.saturating_add((core_w as f32 * 0.4).round() as u32);
  let text_focus_y = core_y.saturating_add((core_h as f32 * 0.42).round() as u32);
  let mut hits = 0u32;

  for y in 0..height {
    for x in 0..width {
      if mask.get_pixel(x, y)[0] == 0 {
        continue;
      }

      let src = source.get_pixel(x, y).0;
      let est = estimate.get_pixel(x, y).0;
      let diff = color_diff(src, est);
      let lum_delta = luminance(src) - luminance(est);
      let sat = saturation(src);
      let edge = local_luma_contrast(source, x, y);
      let text_focus_zone = x >= text_focus_x && y >= text_focus_y;

      let text_like =
        (lum_delta >= 14.0 && sat <= 125.0 && diff >= 10.0)
          || (lum_delta <= -12.0 && sat <= 88.0 && diff >= 10.0)
          || (text_focus_zone
            && luminance(src) >= 136.0
            && sat <= 170.0
            && edge >= 9.0
            && diff >= 6.0)
          || (text_focus_zone
            && sat <= 126.0
            && edge >= 10.0
            && (diff >= 6.0 || lum_delta.abs() >= 5.0))
          || (diff >= 24.0 && sat <= 98.0);

      if text_like {
        core.put_pixel(x, y, Luma([255]));
        hits += 1;
      }
    }
  }

  let mut final_core = dilate_mask(&core, 2, 1);
  if hits < (width.saturating_mul(height) / 48).max(12) {
    let fallback_x = core_x.saturating_add((core_w as f32 * 0.38).round() as u32);
    let fallback_y = core_y.saturating_add((core_h as f32 * 0.42).round() as u32);
    let fallback_w = ((core_w as f32 * 0.6).round() as u32).max(1);
    let fallback_h = ((core_h as f32 * 0.46).round() as u32).max(1);
    for y in fallback_y..fallback_y.saturating_add(fallback_h).min(height) {
      for x in fallback_x..fallback_x.saturating_add(fallback_w).min(width) {
        if mask.get_pixel(x, y)[0] > 0 {
          final_core.put_pixel(x, y, Luma([255]));
        }
      }
    }
  }

  final_core
}

fn apply_patch_from_mask(
  canvas: &mut RgbaImage,
  processed_patch: &RgbaImage,
  mask: &GrayImage,
  text_core_mask: &GrayImage,
  outer_x: u32,
  outer_y: u32,
) {
  let edge_mask = dilate_mask(mask, 3, 2);
  let text_edge_mask = dilate_mask(text_core_mask, 4, 2);
  let (width, height) = processed_patch.dimensions();

  for py in 0..height {
    for px in 0..width {
      let mask_value = mask.get_pixel(px, py)[0];
      let edge_value = edge_mask.get_pixel(px, py)[0];
      let text_edge_value = text_edge_mask.get_pixel(px, py)[0];

      if edge_value == 0 && text_edge_value == 0 {
        continue;
      }

      let dst_x = outer_x + px;
      let dst_y = outer_y + py;
      let original = canvas.get_pixel(dst_x, dst_y).0;
      let repaired = processed_patch.get_pixel(px, py).0;
      let alpha = if mask_value > 0 {
        1.0
      } else if text_edge_value > 0 {
        0.82
      } else {
        0.52
      };

      canvas.put_pixel(
        dst_x,
        dst_y,
        Rgba([
          (original[0] as f32 * (1.0 - alpha) + repaired[0] as f32 * alpha).round() as u8,
          (original[1] as f32 * (1.0 - alpha) + repaired[1] as f32 * alpha).round() as u8,
          (original[2] as f32 * (1.0 - alpha) + repaired[2] as f32 * alpha).round() as u8,
          255,
        ]),
      );
    }
  }
}

fn build_texture_synthesis_candidate(
  original_patch: &RgbaImage,
  mask: &GrayImage,
) -> Option<RgbaImage> {
  let (width, height) = original_patch.dimensions();
  let masked_pixels = mask.pixels().filter(|pixel| pixel[0] > 0).count() as u32;
  let total_pixels = width.saturating_mul(height).max(1);
  let mask_ratio = masked_pixels as f32 / total_pixels as f32;

  if masked_pixels == 0 || mask_ratio > 0.32 {
    return None;
  }

  let mask_rgba = DynamicImage::ImageLuma8(mask.clone()).to_rgba8();
  let original_bytes = encode_png_bytes(&DynamicImage::ImageRgba8(original_patch.clone())).ok()?;
  let mask_bytes = encode_png_bytes(&DynamicImage::ImageRgba8(mask_rgba.clone())).ok()?;
  let session = ts::Session::builder()
    .nearest_neighbors(16)
    .random_sample_locations(20)
    .cauchy_dispersion(0.8)
    .backtrack_stages(4)
    .backtrack_percent(0.5)
    .seed(7)
    .inpaint_example(
      ts::ImageSource::Memory(mask_bytes.as_slice()),
      ts::Example::builder(ts::ImageSource::Memory(original_bytes.as_slice()))
        .set_sample_method(ts::SampleMethod::Image(ts::ImageSource::Memory(mask_bytes.as_slice()))),
      ts::Dims::new(width, height),
    )
    .build()
    .ok()?;

  let generated = session.run(None).into_image().to_rgba8();
  RgbaImage::from_raw(width, height, generated.into_raw())
}

fn apply_telea_inpaint(
  image: &DynamicImage,
  outer_x: u32,
  outer_y: u32,
  outer_w: u32,
  outer_h: u32,
  core_x: u32,
  core_y: u32,
  core_w: u32,
  core_h: u32,
  repair_strength: f32,
) -> Result<DynamicImage> {
  let mut canvas = image.to_rgba8();
  let original_patch = image.crop_imm(outer_x, outer_y, outer_w, outer_h).to_rgba8();
  let reflected_patch = build_corner_reflect_patch(image, outer_x, outer_y, outer_w, outer_h);
  let context_patch = build_context_patch(image, outer_x, outer_y, outer_w, outer_h).to_rgba8();
  let mut estimate_patch = RgbaImage::new(outer_w, outer_h);

  for py in 0..outer_h {
    for px in 0..outer_w {
      let a = reflected_patch.get_pixel(px, py).0;
      let b = context_patch.get_pixel(px, py).0;
      estimate_patch.put_pixel(
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

  let mask = build_watermark_mask(
    &original_patch,
    &estimate_patch,
    core_x,
    core_y,
    core_w,
    core_h,
    repair_strength,
  );
  let text_core_mask = build_text_core_mask(
    &original_patch,
    &estimate_patch,
    &mask,
    core_x,
    core_y,
    core_w,
    core_h,
  );
  let text_expand = 1u32.saturating_add(((repair_strength - 8.0) / 6.0).round().max(0.0) as u32);
  let expanded_text_core_mask = dilate_mask(&text_core_mask, text_expand + 1, text_expand);
  let mut repair_mask = mask.clone();
  merge_mask(&mut repair_mask, &expanded_text_core_mask);
  let (text_pixels, avg_text_edge, avg_text_diff) =
    mask_stats(&original_patch, &estimate_patch, &text_core_mask);
  let flat_background_override = text_pixels > 0 && avg_text_edge <= 10.5 && avg_text_diff <= 26.0;
  let base_radius = ((core_w.min(core_h) / 14).max(3)).min(9);
  let radius_boost = ((repair_strength - 8.0) / 4.0).round().clamp(0.0, 4.0) as u32;
  let radius = base_radius
    .saturating_add(radius_boost)
    .saturating_add(text_expand.min(2))
    .min(13) as i32;
  let patch = if flat_background_override {
    apply_estimate_patch(
      &original_patch,
      &estimate_patch,
      &repair_mask,
      &expanded_text_core_mask,
    )
  } else {
    let mut patch = original_patch.clone();
    patch
      .telea_inpaint(&repair_mask, radius)
      .map_err(|err| anyhow!("Telea 修复失败: {err}"))?;

    if let Some(candidate) = build_texture_synthesis_candidate(&original_patch, &repair_mask) {
      let (width, height) = patch.dimensions();
      let edge_mask = dilate_mask(&repair_mask, 4, 2);
      let body_mask = erode_mask(&repair_mask, 2, 1);
      for y in 0..height {
        for x in 0..width {
          if edge_mask.get_pixel(x, y)[0] == 0 {
            continue;
          }
          let alpha = if text_core_mask.get_pixel(x, y)[0] > 0 {
            1.0
          } else if body_mask.get_pixel(x, y)[0] > 0 {
            0.58
          } else if repair_mask.get_pixel(x, y)[0] > 0 {
            0.28
          } else {
            0.1
          };
          let telea_px = patch.get_pixel(x, y).0;
          let candidate_px = candidate.get_pixel(x, y).0;
          patch.put_pixel(
            x,
            y,
            Rgba([
              (telea_px[0] as f32 * (1.0 - alpha) + candidate_px[0] as f32 * alpha).round() as u8,
              (telea_px[1] as f32 * (1.0 - alpha) + candidate_px[1] as f32 * alpha).round() as u8,
              (telea_px[2] as f32 * (1.0 - alpha) + candidate_px[2] as f32 * alpha).round() as u8,
              255,
            ]),
          );
        }
      }
    }
    patch
  };

  apply_patch_from_mask(&mut canvas, &patch, &repair_mask, &text_core_mask, outer_x, outer_y);
  Ok(DynamicImage::ImageRgba8(canvas))
}

fn build_repair_mask_for_region(
  image: &DynamicImage,
  x: u32,
  y: u32,
  w: u32,
  h: u32,
  repair_strength: f32,
) -> GrayImage {
  let (img_w, img_h) = image.dimensions();
  let pad_left = ((w as f32) * 0.36).round() as u32;
  let pad_top = ((h as f32) * 0.72).round() as u32;
  let pad_right = ((w as f32) * 0.08).round() as u32;
  let pad_bottom = ((h as f32) * 0.12).round() as u32;
  let (outer_x, outer_y, outer_w, outer_h, core_x, core_y) = padded_region(
    x, y, w, h, img_w, img_h, pad_left, pad_top, pad_right, pad_bottom,
  );

  let original_patch = image.crop_imm(outer_x, outer_y, outer_w, outer_h).to_rgba8();
  let reflected_patch = build_corner_reflect_patch(image, outer_x, outer_y, outer_w, outer_h);
  let context_patch = build_context_patch(image, outer_x, outer_y, outer_w, outer_h).to_rgba8();
  let mut estimate_patch = RgbaImage::new(outer_w, outer_h);

  for py in 0..outer_h {
    for px in 0..outer_w {
      let a = reflected_patch.get_pixel(px, py).0;
      let b = context_patch.get_pixel(px, py).0;
      estimate_patch.put_pixel(
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

  let local_mask = build_watermark_mask(
    &original_patch,
    &estimate_patch,
    core_x,
    core_y,
    w,
    h,
    repair_strength,
  );

  let mut full_mask = GrayImage::new(img_w, img_h);
  for py in 0..outer_h {
    for px in 0..outer_w {
      if local_mask.get_pixel(px, py)[0] > 0 {
        full_mask.put_pixel(outer_x + px, outer_y + py, Luma([255]));
      }
    }
  }

  full_mask
}

fn draw_mask_overlay(image: &DynamicImage, mask: &GrayImage) -> DynamicImage {
  let mut canvas = image.to_rgba8();
  let edge_mask = dilate_mask(mask, 2, 2);
  let (width, height) = canvas.dimensions();

  for y in 0..height {
    for x in 0..width {
      let mask_value = mask.get_pixel(x, y)[0];
      let edge_value = edge_mask.get_pixel(x, y)[0];
      if edge_value == 0 {
        continue;
      }

      let base = canvas.get_pixel(x, y).0;
      let overlay = if mask_value > 0 {
        [235u8, 64u8, 52u8]
      } else {
        [255u8, 180u8, 72u8]
      };
      let alpha = if mask_value > 0 { 0.62 } else { 0.28 };

      canvas.put_pixel(
        x,
        y,
        Rgba([
          (base[0] as f32 * (1.0 - alpha) + overlay[0] as f32 * alpha).round() as u8,
          (base[1] as f32 * (1.0 - alpha) + overlay[1] as f32 * alpha).round() as u8,
          (base[2] as f32 * (1.0 - alpha) + overlay[2] as f32 * alpha).round() as u8,
          255,
        ]),
      );
    }
  }

  DynamicImage::ImageRgba8(canvas)
}

fn padded_region(
  x: u32,
  y: u32,
  w: u32,
  h: u32,
  img_w: u32,
  img_h: u32,
  pad_left: u32,
  pad_top: u32,
  pad_right: u32,
  pad_bottom: u32,
) -> (u32, u32, u32, u32, u32, u32) {
  let outer_x = x.saturating_sub(pad_left);
  let outer_y = y.saturating_sub(pad_top);
  let outer_right = x.saturating_add(w).saturating_add(pad_right).min(img_w);
  let outer_bottom = y.saturating_add(h).saturating_add(pad_bottom).min(img_h);
  let outer_w = outer_right.saturating_sub(outer_x).max(1);
  let outer_h = outer_bottom.saturating_sub(outer_y).max(1);
  let core_x = x.saturating_sub(outer_x);
  let core_y = y.saturating_sub(outer_y);

  (outer_x, outer_y, outer_w, outer_h, core_x, core_y)
}

fn blend_patch_with_core(
  base: &mut RgbaImage,
  patch: &RgbaImage,
  x: u32,
  y: u32,
  core_x: u32,
  core_y: u32,
  core_w: u32,
  core_h: u32,
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

      let inside_core = px >= core_x
        && px < core_x.saturating_add(core_w)
        && py >= core_y
        && py < core_y.saturating_add(core_h);

      let alpha = if inside_core {
        1.0
      } else {
        let dx = if px < core_x {
          core_x - px
        } else if px >= core_x.saturating_add(core_w) {
          px - core_x.saturating_add(core_w).saturating_sub(1)
        } else {
          0
        };
        let dy = if py < core_y {
          core_y - py
        } else if py >= core_y.saturating_add(core_h) {
          py - core_y.saturating_add(core_h).saturating_sub(1)
        } else {
          0
        };
        let distance = dx.max(dy) as f32;
        let raw = (1.0 - distance / feather).clamp(0.0, 1.0);
        raw * raw * (3.0 - 2.0 * raw)
      };

      if alpha <= 0.0 {
        continue;
      }

      let blended = [
        (original[0] as f32 * (1.0 - alpha) + patch_px[0] as f32 * alpha).round() as u8,
        (original[1] as f32 * (1.0 - alpha) + patch_px[1] as f32 * alpha).round() as u8,
        (original[2] as f32 * (1.0 - alpha) + patch_px[2] as f32 * alpha).round() as u8,
        255,
      ];
      base.put_pixel(dst_x, dst_y, Rgba(blended));
    }
  }
}

fn apply_cleanup(
  app: Option<&tauri::AppHandle>,
  engine: model_runtime::CleanupEngineKind,
  image: &DynamicImage,
  region: Region,
  base_width: u32,
  base_height: u32,
  size_handling_mode: &str,
  cleanup_method: &str,
  blur_sigma: f32,
  fill_color: &str,
  fast_mode: bool,  // 快速模式：跳过ONNX，仅用于预览
) -> Result<DynamicImage> {
  log::info!("apply_cleanup: engine={:?}, cleanup_method={}, fast_mode={}", engine, cleanup_method, fast_mode);
  // 只在非快速模式下使用 ONNX 模型
  if engine == model_runtime::CleanupEngineKind::EmbeddedOnnx && cleanup_method == "blur" && !fast_mode {
    log::info!("使用 ONNX 模型进行修复");
    if let Some(app) = app {
      if let Ok(processed) = apply_embedded_model_cleanup(
        app,
        image,
        region,
        base_width,
        base_height,
        size_handling_mode,
        blur_sigma,
      ) {
        return Ok(processed);
      }
    }
  }

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
      let pad_left = ((w as f32) * 0.28).round() as u32;
      let pad_top = ((h as f32) * 0.55).round() as u32;
      let pad_right = ((w as f32) * 0.06).round() as u32;
      let pad_bottom = ((h as f32) * 0.08).round() as u32;
      let (outer_x, outer_y, outer_w, outer_h, core_x, core_y) =
        padded_region(
          x, y, w, h, width, height, pad_left, pad_top, pad_right, pad_bottom,
        );
      let feather = ((outer_w.min(outer_h) as f32) * 0.12).round() as u32;
      let mut patch = RgbaImage::new(outer_w, outer_h);

      for py in 0..outer_h {
        for px in 0..outer_w {
          patch.put_pixel(px, py, color);
        }
      }

      blend_patch_with_core(
        &mut canvas, &patch, outer_x, outer_y, core_x, core_y, w, h, feather,
      );
      Ok(DynamicImage::ImageRgba8(canvas))
    }
    _ => {
      let pad_left = ((w as f32) * 0.36).round() as u32;
      let pad_top = ((h as f32) * 0.72).round() as u32;
      let pad_right = ((w as f32) * 0.08).round() as u32;
      let pad_bottom = ((h as f32) * 0.12).round() as u32;
      let (outer_x, outer_y, outer_w, outer_h, core_x, core_y) =
        padded_region(
          x, y, w, h, width, height, pad_left, pad_top, pad_right, pad_bottom,
        );
      apply_telea_inpaint(
        image,
        outer_x,
        outer_y,
        outer_w,
        outer_h,
        core_x,
        core_y,
        w,
        h,
        blur_sigma,
      )
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

fn apply_embedded_model_cleanup(
  app: &tauri::AppHandle,
  image: &DynamicImage,
  region: Region,
  base_width: u32,
  base_height: u32,
  size_handling_mode: &str,
  _repair_strength: f32,  // ONNX 模型不使用此参数
) -> Result<DynamicImage> {
  log::info!("apply_embedded_model_cleanup: 开始加载内置模型");
  let bundled_model = model_runtime::resolve_bundled_model(app)?
    .ok_or_else(|| anyhow!("未找到内置模型文件"))?;
  log::info!("模型加载成功: {} ({} MB)", bundled_model.model_path, bundled_model.bytes / 1024 / 1024);
  let input_w = bundled_model.input_width.max(1);
  let input_h = bundled_model.input_height.max(1);
  let (img_w, img_h) = image.dimensions();
  let (x, y, w, h) = region_to_pixels(
    region,
    img_w,
    img_h,
    base_width,
    base_height,
    size_handling_mode,
  );

  // 为 ONNX 模型创建简单的矩形 mask
  // 扩展修复区域以确保边缘自然融合
  let expand = ((w.min(h) as f32) * 0.15).round() as u32;
  let mask_x = x.saturating_sub(expand);
  let mask_y = y.saturating_sub(expand);
  let mask_w = (w + 2 * expand).min(img_w - mask_x);
  let mask_h = (h + 2 * expand).min(img_h - mask_y);

  log::info!("创建 ONNX mask: x={}, y={}, w={}, h={}, 原始: x={}, y={}, w={}, h={}",
    mask_x, mask_y, mask_w, mask_h, x, y, w, h);

  let mut repair_mask = GrayImage::new(img_w, img_h);
  for py in mask_y..mask_y + mask_h {
    for px in mask_x..mask_x + mask_w {
      repair_mask.put_pixel(px, py, Luma([255]));
    }
  }

  run_onnx_inpainting(app, image, &repair_mask, &bundled_model.model_path, input_w, input_h)
}

fn run_onnx_inpainting(
  app: &tauri::AppHandle,
  image: &DynamicImage,
  mask: &GrayImage,
  model_path: &str,
  input_w: u32,
  input_h: u32,
) -> Result<DynamicImage> {
  log::info!("run_onnx_inpainting: 使用 Python ONNX Server");

  // 创建临时目录
  let temp_dir = std::env::temp_dir().join("lama_inpaint");
  fs::create_dir_all(&temp_dir)
    .with_context(|| "无法创建临时目录")?;

  // 生成唯一的文件名
  let timestamp = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)?
    .as_micros();
  let image_path = temp_dir.join(format!("input_{}.png", timestamp));
  let mask_path = temp_dir.join(format!("mask_{}.png", timestamp));
  let output_path = temp_dir.join(format!("output_{}.png", timestamp));

  // 保存图像
  image.save(&image_path)
    .with_context(|| "无法保存输入图像")?;
  DynamicImage::ImageLuma8(mask.clone()).save(&mask_path)
    .with_context(|| "无法保存 mask")?;

  log::info!("临时文件已保存");

  // 获取 ONNX 服务器状态
  let server_manager = app.state::<onnx_server::OnnxServerManager>();

  // 获取或创建服务器实例
  let mut server_guard = server_manager.get_or_create(model_path)?;
  let server = server_guard.as_mut().ok_or_else(|| anyhow!("服务器不可用"))?;

  // 使用长驻留服务器处理请求
  log::info!("发送请求到 ONNX 服务器");
  server.inpaint(&image_path, &mask_path, &output_path, (input_w, input_h))?;
  log::info!("ONNX 服务器处理完成");

  // 读取输出图像
  let result = image::open(&output_path)
    .with_context(|| "无法读取输出图像")?;

  // 清理临时文件
  let _ = fs::remove_file(&image_path);
  let _ = fs::remove_file(&mask_path);
  let _ = fs::remove_file(&output_path);

  log::info!("图像修复完成");
  Ok(result)
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
fn preview_cleanup(app: tauri::AppHandle, request: PreviewRequest) -> Result<PreviewResult, String> {
  let engine = model_runtime::resolve_cleanup_engine(&app).map_err(|err| err.to_string())?;
  let image = load_image(Path::new(&request.path)).map_err(|err| err.to_string())?;
  let source = draw_region_overlay(&image, request.region);
  let (x, y, w, h) = region_to_pixels(
    request.region,
    image.width(),
    image.height(),
    request.base_width,
    request.base_height,
    &request.size_handling_mode,
  );
  let processed = apply_cleanup(
    Some(&app),
    engine,
    &image,
    request.region,
    request.base_width,
    request.base_height,
    &request.size_handling_mode,
    &request.cleanup_method,
    request.blur_sigma,
    &request.fill_color,
    false,  // 预览也需要使用ONNX显示实际效果
  )
  .map_err(|err| err.to_string())?;
  let mask_image = if request.cleanup_method == "blur" {
    let mask = build_repair_mask_for_region(&image, x, y, w, h, request.blur_sigma);
    draw_mask_overlay(&image, &mask)
  } else {
    draw_region_overlay(&image, request.region)
  };

  // 减小预览尺寸以提高编码速度 (从1400降到600)
  let source_preview = preview_image(&source, 600);
  let processed_preview = preview_image(&processed, 600);
  let mask_preview = preview_image(&mask_image, 600);

  Ok(PreviewResult {
    source_data_url: encode_jpeg_data_url(&source_preview, 82).map_err(|err| err.to_string())?,
    processed_data_url: encode_jpeg_data_url(&processed_preview, 82)
      .map_err(|err| err.to_string())?,
    mask_data_url: encode_jpeg_data_url(&mask_preview, 82).map_err(|err| err.to_string())?,
    output_width: processed.width(),
    output_height: processed.height(),
  })
}

#[tauri::command]
fn run_batch_cleanup(app: tauri::AppHandle, request: BatchRequest) -> Result<BatchResult, String> {
  if request.paths.is_empty() {
    return Err("没有可处理的图片".to_string());
  }

  let engine = model_runtime::resolve_cleanup_engine(&app).map_err(|err| err.to_string())?;
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
        Some(&app),
        engine,
        &image,
        request.region,
        request.base_width,
        request.base_height,
        &request.size_handling_mode,
        &request.cleanup_method,
        request.blur_sigma,
        &request.fill_color,
        false,  // fast_mode: 批量处理时使用ONNX高质量模式
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
      runtime_status,
      import_paths,
      preview_cleanup,
      run_batch_cleanup
    ])
    .plugin(tauri_plugin_dialog::init())
    .manage(onnx_server::OnnxServerManager::new())
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
