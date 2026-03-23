use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BootstrapState {
  app_name: String,
  app_version: String,
  platform: String,
  capabilities: Vec<&'static str>,
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
      "fixed-region-workflow",
      "batch-job-shell",
    ],
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![bootstrap_state])
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
