// Eksport/import av klasse, rom og klassekart til/fra én JSON-fil.
//
// Følger samme dialog-drevet-command-mønster som print_export.rs og
// db_maintenance.rs: en tynn #[tauri::command] som håndterer
// AppHandle/dialog-biten, og rene/testbare hjelpefunksjoner for
// serialisering som ikke krever en ekte Tauri-app å teste.
//
// VIKTIG: denne modulen setter ALDRI noe inn i databasen selv - den kan bare
// lese/skrive JSON-filer på disk. Selve opprettelsen av klasse/rom/klassekart
// ved import gjøres av frontend via de eksisterende save_class/save_room/
// save_seating-kommandoene (+ constraints::import_constraints), i sekvens,
// slik at insert-reglene (f.eks. "kun INSERT-grenen setter class_id") kun
// finnes ett sted i kodebasen.

use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

use super::constraints::NewConstraint;
use super::settings::{load_settings, merge_and_save_settings, settings_path};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ClassExport {
  pub name: String,
  /// Rå students-TEXT-kolonneverdi, akkurat som ClassReadRecord::students.
  pub students: Option<String>,
  #[serde(default)]
  pub constraints: Vec<NewConstraint>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct RoomExport {
  pub name: String,
  /// Rå layout_data-TEXT-kolonneverdi, akkurat som RoomReadRecord::layout_data.
  pub layout_data: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct SeatingExport {
  pub name: String,
  pub comment: Option<String>,
  /// Rå placements-TEXT-kolonneverdi, akkurat som SeatingReadRecord::placements.
  pub placements: Option<String>,
}

/// `#[serde(default)]` på hvert felt: en fil som bare inneholder `class` skal
/// ikke feile deserialisering fordi `room`/`seating` mangler.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
pub struct ExportBundle {
  pub version: u32,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub class: Option<ClassExport>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub room: Option<RoomExport>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub seating: Option<SeatingExport>,
}

pub const BUNDLE_VERSION: u32 = 1;

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
  pub success: bool,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub canceled: Option<bool>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub file_path: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub error: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImportBundleResult {
  pub bundle: ExportBundle,
  pub file_path: String,
}

// ---------------------------------------------------------------------
// Pure/testable helpers
// ---------------------------------------------------------------------

/// Speiler print_export.rs::resolve_default_dir, men med en egen
/// settings-nøkkel siden dette er en annen "sist brukt katalog" enn
/// PDF-eksport.
pub fn resolve_default_dir(settings: &serde_json::Value, documents_dir: &Path) -> std::path::PathBuf {
  settings
    .get("lastExportImportDir")
    .and_then(|v| v.as_str())
    .filter(|s| !s.is_empty())
    .map(std::path::PathBuf::from)
    .unwrap_or_else(|| documents_dir.to_path_buf())
}

/// Serialiserer bundlen og skriver den til `dest`. Splittet ut fra
/// command-wrapperen slik at selve fil-skrivingen er unit-testbar uten en
/// ekte AppHandle/dialog.
pub fn write_bundle_to_path(bundle: &ExportBundle, dest: &Path) -> Result<(), String> {
  let json = serde_json::to_string_pretty(bundle).map_err(|e| e.to_string())?;
  std::fs::write(dest, json).map_err(|e| e.to_string())
}

/// Leser og parser bundlen fra `src`. Splittet ut for samme grunn som over.
/// `#[serde(default)]` på ExportBundles felt betyr at en fil med kun én
/// seksjon parser fint - kun fullstendig ugyldig JSON/feil struktur feiler.
pub fn read_bundle_from_path(src: &Path) -> Result<ExportBundle, String> {
  let text = std::fs::read_to_string(src).map_err(|e| e.to_string())?;
  serde_json::from_str(&text).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------
// Tauri-kommandoer (dialog-drevet, ikke direkte unit-testbare)
// ---------------------------------------------------------------------

#[tauri::command]
pub async fn export_bundle(
  app: AppHandle,
  bundle: ExportBundle,
  suggested_name: String,
) -> Result<ExportResult, String> {
  let user_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  let settings_file = settings_path(&user_data_dir);
  let current_settings = load_settings(&settings_file);

  let documents_dir = app.path().document_dir().map_err(|e| e.to_string())?;
  let default_dir = resolve_default_dir(&current_settings, &documents_dir);

  let chosen = app
    .dialog()
    .file()
    .set_title("Eksporter")
    .set_directory(&default_dir)
    .set_file_name(&suggested_name)
    .add_filter("Klasseplass", &["klasseplass", "json"])
    .blocking_save_file();

  let Some(file_path) = chosen else {
    return Ok(ExportResult { success: false, canceled: Some(true), file_path: None, error: None });
  };

  let dest = file_path.into_path().map_err(|e| e.to_string())?;

  if let Err(err) = write_bundle_to_path(&bundle, &dest) {
    return Ok(ExportResult { success: false, canceled: None, file_path: None, error: Some(err) });
  }

  if let Some(parent) = dest.parent() {
    let update = serde_json::json!({ "lastExportImportDir": parent.to_string_lossy() });
    merge_and_save_settings(&settings_file, &update);
  }

  Ok(ExportResult {
    success: true,
    canceled: None,
    file_path: Some(dest.to_string_lossy().to_string()),
    error: None,
  })
}

#[tauri::command]
pub async fn import_bundle_pick_file(app: AppHandle) -> Result<Option<ImportBundleResult>, String> {
  let user_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  let settings_file = settings_path(&user_data_dir);
  let current_settings = load_settings(&settings_file);

  let documents_dir = app.path().document_dir().map_err(|e| e.to_string())?;
  let default_dir = resolve_default_dir(&current_settings, &documents_dir);

  let chosen = app
    .dialog()
    .file()
    .set_title("Importer")
    .set_directory(&default_dir)
    .add_filter("Klasseplass", &["klasseplass", "json"])
    .blocking_pick_file();

  let Some(file_path) = chosen else { return Ok(None) };
  let src = file_path.into_path().map_err(|e| e.to_string())?;
  let bundle = read_bundle_from_path(&src)?;

  if let Some(parent) = src.parent() {
    let update = serde_json::json!({ "lastExportImportDir": parent.to_string_lossy() });
    merge_and_save_settings(&settings_file, &update);
  }

  Ok(Some(ImportBundleResult { bundle, file_path: src.to_string_lossy().to_string() }))
}

#[cfg(test)]
mod tests {
  use super::*;
  use tempfile::tempdir;

  #[test]
  fn resolve_default_dir_uses_last_export_import_dir_when_set() {
    let settings = serde_json::json!({ "lastExportImportDir": "D:\\Eksporter" });
    let documents_dir = std::path::PathBuf::from("C:\\Users\\test\\Documents");
    assert_eq!(resolve_default_dir(&settings, &documents_dir), std::path::PathBuf::from("D:\\Eksporter"));
  }

  #[test]
  fn resolve_default_dir_falls_back_to_documents_when_unset() {
    let settings = serde_json::json!({});
    let documents_dir = std::path::PathBuf::from("C:\\Users\\test\\Documents");
    assert_eq!(resolve_default_dir(&settings, &documents_dir), documents_dir);
  }

  #[test]
  fn write_then_read_bundle_roundtrips() {
    let dir = tempdir().unwrap();
    let dest = dir.path().join("test.klasseplass");
    let bundle = ExportBundle {
      version: BUNDLE_VERSION,
      class: Some(ClassExport { name: "8A".into(), students: Some("[]".into()), constraints: vec![] }),
      room: None,
      seating: None,
    };

    write_bundle_to_path(&bundle, &dest).unwrap();
    let read_back = read_bundle_from_path(&dest).unwrap();
    assert_eq!(read_back, bundle);
  }

  #[test]
  fn read_bundle_with_only_class_section_does_not_require_others() {
    let dir = tempdir().unwrap();
    let dest = dir.path().join("class_only.json");
    std::fs::write(&dest, r#"{"version":1,"class":{"name":"8A","students":"[]","constraints":[]}}"#).unwrap();

    let bundle = read_bundle_from_path(&dest).unwrap();
    assert!(bundle.class.is_some());
    assert!(bundle.room.is_none());
    assert!(bundle.seating.is_none());
  }

  #[test]
  fn read_bundle_rejects_invalid_json() {
    let dir = tempdir().unwrap();
    let dest = dir.path().join("broken.json");
    std::fs::write(&dest, "not json at all").unwrap();
    assert!(read_bundle_from_path(&dest).is_err());
  }
}
