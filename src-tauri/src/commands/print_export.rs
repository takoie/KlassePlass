// Task 6.3: wires the Task 6.2 Rust-native PDF renderer (`pdf_export::
// render_seating_chart_pdf`) up to a real Tauri command + the frontend's
// "Eksporter til PDF" button.
//
// Ports Electron's `print:export-pdf` IPC handler
// (src/ipc-handlers.js:231-254) to Tauri, following the same
// dialog-driven-command pattern already established in `db_maintenance.rs`
// (Task 4.1): `tauri-plugin-dialog`'s save dialog in place of Electron's
// `dialog.showSaveDialog`, cancel -> `{success:false, canceled:true}`,
// failure -> `{success:false, error}`, and `lastPrintExportDir` in
// settings.json tracked/reused exactly like the JS handler did (default
// save directory comes from it when set, else falls back to the OS
// "Documents" folder; it is only ever UPDATED after a successful export,
// to the directory the user actually chose - never touched on cancel/error).
//
// SCOPE: seatingChart only, matching `pdf_export.rs`'s module doc. There is
// no Rust payload builder for `station`/`groupWork` content types yet, so
// this command only ever renders a `PrintPayload` (Task 6.1's seating-chart
// shape) - it has no notion of "content type" at all. The frontend
// (`PrintPreviewModal.jsx` / `tauriApi.js`) is responsible for only ever
// invoking this command for `contentType === 'seatingChart'`; station/
// groupWork continue to use `window.print()` exclusively, unaffected by
// this module.

use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

use crate::commands::settings::{load_settings, merge_and_save_settings, settings_path};
use crate::pdf_export::{render_seating_chart_pdf, PrintPayload};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfExportResult {
  pub success: bool,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub canceled: Option<bool>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub file_path: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub error: Option<String>,
}

// ---------------------------------------------------------------------
// Pure/testable helpers
// ---------------------------------------------------------------------

/// Resolves the directory the save dialog should default to: the tracked
/// `lastPrintExportDir` from settings when present and non-empty, else
/// `documents_dir` (the OS "Documents" folder). Mirrors JS's
/// `settings.lastPrintExportDir || app.getPath('documents')`.
///
/// Kept as a pure function taking already-loaded `settings`/`documents_dir`
/// values (rather than an `AppHandle`) so the fallback logic is unit
/// testable without spinning up a real Tauri app - the AppHandle-based
/// lookups (`document_dir()`, `load_settings()`) happen once in the command
/// wrapper below.
pub fn resolve_default_dir(settings: &serde_json::Value, documents_dir: &Path) -> PathBuf {
  settings
    .get("lastPrintExportDir")
    .and_then(|v| v.as_str())
    .filter(|s| !s.is_empty())
    .map(PathBuf::from)
    .unwrap_or_else(|| documents_dir.to_path_buf())
}

/// Core "chosen path -> render -> outcome" logic once the user has picked a
/// destination via the save dialog. Split out from the `#[tauri::command]`
/// below so the render-failure/success branching (which does NOT touch the
/// dialog) is directly unit-testable. Does not touch settings itself -
/// callers are responsible for updating `lastPrintExportDir` only when this
/// returns `Ok`, per the "update only on success" contract.
pub fn export_to_chosen_path(payload: &PrintPayload, dest: &Path) -> Result<(), String> {
  let dest_str = dest.to_string_lossy();
  render_seating_chart_pdf(payload, &dest_str)
}

// ---------------------------------------------------------------------
// Tauri command (dialog-driven, not directly unit-testable)
// ---------------------------------------------------------------------

/// Port of `ipcMain.handle('print:export-pdf', ...)`, seatingChart-only
/// (see module doc). `payload` is the JSON produced by
/// `buildSeatingChartPrintPayload` (Task 6.1) on the JS side; `suggested_name`
/// is the default filename offered in the save dialog (e.g.
/// `Klassekart_1ST5.pdf`, built by `buildPrintFilename` in
/// `PrintPreviewModal.jsx`, same as the Electron version's `suggestedName`).
#[tauri::command]
pub async fn export_seating_chart_pdf(
  app: AppHandle,
  payload: PrintPayload,
  suggested_name: String,
) -> Result<PdfExportResult, String> {
  let user_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  let settings_file = settings_path(&user_data_dir);
  let current_settings = load_settings(&settings_file);

  let documents_dir = app.path().document_dir().map_err(|e| e.to_string())?;
  let default_dir = resolve_default_dir(&current_settings, &documents_dir);

  let chosen = app
    .dialog()
    .file()
    .set_title("Eksporter til PDF")
    .set_directory(&default_dir)
    .set_file_name(&suggested_name)
    .add_filter("PDF", &["pdf"])
    .blocking_save_file();

  let Some(file_path) = chosen else {
    return Ok(PdfExportResult {
      success: false,
      canceled: Some(true),
      file_path: None,
      error: None,
    });
  };

  let dest = file_path.into_path().map_err(|e| e.to_string())?;

  if let Err(err) = export_to_chosen_path(&payload, &dest) {
    return Ok(PdfExportResult {
      success: false,
      canceled: None,
      file_path: None,
      error: Some(err),
    });
  }

  // Only update lastPrintExportDir on a SUCCESSFUL export, to the directory
  // the user actually chose - never on cancel (returned above) or render
  // failure (returned above too). Merge-save (not overwrite) so unrelated
  // settings fields survive, matching `save-settings`'s `{ ...s, ...d }`
  // semantics that the Electron handler relied on via `saveSettings`.
  if let Some(parent) = dest.parent() {
    let update = serde_json::json!({ "lastPrintExportDir": parent.to_string_lossy() });
    merge_and_save_settings(&settings_file, &update);
  }

  Ok(PdfExportResult {
    success: true,
    canceled: None,
    file_path: Some(dest.to_string_lossy().to_string()),
    error: None,
  })
}

#[tauri::command]
pub fn open_file_native(path: String) -> Result<(), String> {
  #[cfg(target_os = "windows")]
  {
    std::process::Command::new("cmd")
      .args(["/c", "start", "", &path])
      .spawn()
      .map_err(|e| e.to_string())?;
    Ok(())
  }
  #[cfg(not(target_os = "windows"))]
  {
    let _ = path;
    Ok(())
  }
}

#[tauri::command]
pub fn show_in_folder_native(path: String) -> Result<(), String> {
  #[cfg(target_os = "windows")]
  {
    std::process::Command::new("explorer")
      .args(["/select,", &path])
      .spawn()
      .map_err(|e| e.to_string())?;
    Ok(())
  }
  #[cfg(not(target_os = "windows"))]
  {
    let _ = path;
    Ok(())
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use tempfile::tempdir;

  #[test]
  fn resolve_default_dir_uses_last_print_export_dir_when_set() {
    let settings = serde_json::json!({ "lastPrintExportDir": "D:\\Klassekart-eksport" });
    let documents_dir = PathBuf::from("C:\\Users\\test\\Documents");
    let resolved = resolve_default_dir(&settings, &documents_dir);
    assert_eq!(resolved, PathBuf::from("D:\\Klassekart-eksport"));
  }

  #[test]
  fn resolve_default_dir_falls_back_to_documents_when_unset() {
    let settings = serde_json::json!({ "theme": "dark" });
    let documents_dir = PathBuf::from("C:\\Users\\test\\Documents");
    let resolved = resolve_default_dir(&settings, &documents_dir);
    assert_eq!(resolved, documents_dir);
  }

  #[test]
  fn resolve_default_dir_falls_back_to_documents_when_empty_string() {
    // Mirrors JS's `settings.lastPrintExportDir || app.getPath('documents')`:
    // an empty string is falsy in JS, so it must fall back too, not resolve
    // to an empty path.
    let settings = serde_json::json!({ "lastPrintExportDir": "" });
    let documents_dir = PathBuf::from("C:\\Users\\test\\Documents");
    let resolved = resolve_default_dir(&settings, &documents_dir);
    assert_eq!(resolved, documents_dir);
  }

  #[test]
  fn resolve_default_dir_falls_back_when_field_is_not_a_string() {
    // Defensive: a corrupted/unexpected settings.json shape shouldn't panic.
    let settings = serde_json::json!({ "lastPrintExportDir": 42 });
    let documents_dir = PathBuf::from("C:\\Users\\test\\Documents");
    let resolved = resolve_default_dir(&settings, &documents_dir);
    assert_eq!(resolved, documents_dir);
  }

  const SAMPLE_PAYLOAD_JSON: &str = r##"
  {
    "board": { "x": 400, "y": 280 },
    "desks": [
      {
        "x": 400, "y": 360, "capacity": 1, "borderColorHex": "#475569",
        "seats": [{ "studentName": "Ola Nordmann", "seatNumber": 1 }],
        "zoneChips": []
      }
    ],
    "chartName": "1ST5",
    "periodText": "1ST5"
  }
  "##;

  #[test]
  fn export_to_chosen_path_writes_a_real_pdf() {
    let payload: PrintPayload = serde_json::from_str(SAMPLE_PAYLOAD_JSON).unwrap();
    let dir = tempdir().unwrap();
    let dest = dir.path().join("klassekart.pdf");

    export_to_chosen_path(&payload, &dest).expect("export should succeed");

    let meta = std::fs::metadata(&dest).expect("output file should exist");
    assert!(meta.len() > 0, "output PDF should be nonempty");
  }

  #[test]
  fn export_to_chosen_path_reports_error_on_unwritable_destination() {
    let payload: PrintPayload = serde_json::from_str(SAMPLE_PAYLOAD_JSON).unwrap();
    // A path whose parent directory doesn't exist - render_seating_chart_pdf's
    // File::create must fail, and that failure must propagate as Err rather
    // than panicking.
    let dest = PathBuf::from("this_dir_does_not_exist_at_all")
      .join("subdir")
      .join("klassekart.pdf");

    let result = export_to_chosen_path(&payload, &dest);
    assert!(result.is_err());
  }
}
