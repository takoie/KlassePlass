pub mod pdf_export;

// Spike-command for Task 0.2: verifiserer at printpdf kan generere en lesbar PDF,
// kalt fra frontend via Tauri sin invoke-bro. Midlertidig - forenkles/utvides i Fase 6.
#[tauri::command]
fn spike_pdf(path: String) -> Result<(), String> {
  pdf_export::spike_generate_test_pdf(&path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![spike_pdf])
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
