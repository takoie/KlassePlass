// CRUD Tauri-kommandoer for innstillinger (settings.json).
//
// Port av src/db.js sine loadSettings()/saveSettings() og
// src/ipc-handlers.js sine get-settings/save-settings IPC-handlere.
//
// ANNERLEDES enn de andre command-modulene: innstillinger ligger i en
// fri-form JSON-fil på disk (`<user_data_dir>/settings.json`), IKKE i
// SQLite-databasen. Det er derfor ingen `DbState`/`Connection` involvert her
// - kun `tauri::AppHandle` for å slå opp `app_data_dir()`, samme katalog som
// `db::resolve_db_path` bruker som base.
//
// VIKTIG (fri-form JSON, ikke et strengt struct): JS-originalens
// settings-objekt er IKKE begrenset til de 5 dokumenterte default-feltene
// (theme, colorTheme, canvasBg, defaultFlipDisplay, onboardingCompleted).
// Andre deler av kodebasen (f.eks. print-export-handleren) legger til flere
// felter over tid (som `lastPrintExportDir`). Et strengt Rust-struct med kun
// de 5 feltene ville derfor STILLE TIE mistet disse ekstra feltene ved neste
// lagring - reelt datatap for brukerens innstillinger. Vi bruker derfor
// `serde_json::Value` (en `Value::Object` i praksis) gjennomgående.
//
// VIKTIG (merge, ikke overskriving): `save-settings`-IPC-handleren i JS gjør
// `{ ...s, ...d }` - laster gjeldende innstillinger og gjør en SHALLOM merge
// av den innkommende delvise oppdateringen oppå. `save_settings` under
// speiler dette nøyaktig: en kalling med kun `{ "theme": "light" }` endrer
// BARE det feltet, alt annet (inkludert ukjente/ekstra felter) bevares.

use serde_json::{Map, Value};
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri::Manager;

/// De 5 dokumenterte default-verdiene, brukt når settings.json enten ikke
/// finnes eller ikke lar seg parse som gyldig JSON. Speiler JS sin
/// `loadSettings()`-fallback nøyaktig.
fn default_settings() -> Value {
  serde_json::json!({
    "theme": "dark",
    "colorTheme": "night",
    "canvasBg": "solid",
    "defaultFlipDisplay": false,
    "onboardingCompleted": false
  })
}

/// Resolves stien til settings.json: `<user_data_dir>/settings.json`.
/// Speiler JS sin `getSettingsPath()`.
///
/// `pub(crate)` (ikke privat): `print_export.rs` (Task 6.3) trenger å lese
/// OG oppdatere `lastPrintExportDir` i settings via samme sti/helpers som
/// `get_settings`/`save_settings` bruker, i stedet for å duplisere
/// stien-oppbyggingen selv.
pub(crate) fn settings_path(user_data_dir: &Path) -> PathBuf {
  user_data_dir.join("settings.json")
}

/// Leser innstillinger fra `path`.
///
/// - Filen finnes ikke -> default-objektet.
/// - Filen finnes men er ugyldig JSON -> default-objektet (svelger feilen,
///   panikker aldri - speiler JS sin try/catch-fallback).
/// - Filen finnes og er gyldig JSON -> returneres SOM DEN ER, uansett form
///   (inkludert felter utover de 5 default-feltene).
pub fn load_settings(path: &Path) -> Value {
  match std::fs::read_to_string(path) {
    Ok(contents) => serde_json::from_str(&contents).unwrap_or_else(|_| default_settings()),
    Err(_) => default_settings(),
  }
}

/// Lagrer `settings` pretty-printed (2-space indent, som JS sin
/// `JSON.stringify(settings, null, 2)`) til `path`. Returnerer `true`/`false`
/// for suksess/feil - svelger feilen fremfor å propagere den, speiler JS sin
/// `saveSettings()` som fanger og returnerer `false` ved skrivefeil.
pub fn write_settings(path: &Path, settings: &Value) -> bool {
  let Ok(pretty) = serde_json::to_string_pretty(settings) else {
    return false;
  };
  std::fs::write(path, pretty).is_ok()
}

/// Laster gjeldende innstillinger fra `path`, gjør en SHALLOW merge av
/// `update` oppå (kun objekt-felter fra `update` overskriver samme felt i de
/// eksisterende innstillingene - alt annet bevares), og lagrer resultatet.
/// Speiler JS sin `{ ...s, ...d }`-semantikk i `save-settings`-IPC-handleren
/// nøyaktig.
///
/// Returnerer det mergede resultatet (nyttig for testing) sammen med
/// suksess-flagget fra skrivingen.
pub fn merge_and_save_settings(path: &Path, update: &Value) -> (Value, bool) {
  let mut current = match load_settings(path) {
    Value::Object(map) => map,
    _ => Map::new(),
  };

  if let Value::Object(update_map) = update {
    for (key, value) in update_map {
      current.insert(key.clone(), value.clone());
    }
  }

  let merged = Value::Object(current);
  let ok = write_settings(path, &merged);
  (merged, ok)
}

// ---- Tauri-kommando-wrappere: resolver settings-filens sti via AppHandle ----

#[tauri::command]
pub fn get_settings(app_handle: AppHandle) -> Result<Value, String> {
  let user_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
  Ok(load_settings(&settings_path(&user_data_dir)))
}

#[tauri::command]
pub fn save_settings(app_handle: AppHandle, update: Value) -> Result<bool, String> {
  let user_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
  let (_, ok) = merge_and_save_settings(&settings_path(&user_data_dir), &update);
  Ok(ok)
}

#[cfg(test)]
mod tests {
  use super::*;
  use tempfile::tempdir;

  #[test]
  fn load_settings_when_file_missing_returns_defaults() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("settings.json");

    let settings = load_settings(&path);
    assert_eq!(settings, default_settings());
  }

  #[test]
  fn load_settings_with_valid_json_returns_as_is_including_extra_fields() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("settings.json");
    std::fs::write(
      &path,
      r#"{"theme":"light","lastPrintExportDir":"C:\\foo"}"#,
    )
    .unwrap();

    let settings = load_settings(&path);
    assert_eq!(settings["theme"], "light");
    assert_eq!(settings["lastPrintExportDir"], "C:\\foo");
    // Should NOT have silently merged in defaults for missing fields -
    // it's returned exactly as parsed.
    assert!(settings.get("colorTheme").is_none());
  }

  #[test]
  fn load_settings_with_invalid_json_falls_back_to_defaults_without_panicking() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("settings.json");
    std::fs::write(&path, "{ not valid json").unwrap();

    let settings = load_settings(&path);
    assert_eq!(settings, default_settings());
  }

  #[test]
  fn merge_and_save_settings_only_changes_updated_field_and_preserves_rest() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("settings.json");

    let initial = serde_json::json!({
      "theme": "dark",
      "colorTheme": "night",
      "canvasBg": "solid",
      "defaultFlipDisplay": false,
      "onboardingCompleted": true,
      "lastPrintExportDir": "C:\\existing"
    });
    write_settings(&path, &initial);

    let update = serde_json::json!({ "theme": "light" });
    let (merged, ok) = merge_and_save_settings(&path, &update);
    assert!(ok);

    assert_eq!(merged["theme"], "light");
    assert_eq!(merged["colorTheme"], "night");
    assert_eq!(merged["canvasBg"], "solid");
    assert_eq!(merged["defaultFlipDisplay"], false);
    assert_eq!(merged["onboardingCompleted"], true);
    assert_eq!(merged["lastPrintExportDir"], "C:\\existing");

    // Verify it was actually persisted to disk, not just returned in-memory.
    let reloaded = load_settings(&path);
    assert_eq!(reloaded, merged);
  }

  #[test]
  fn merge_and_save_settings_on_missing_file_merges_onto_defaults() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("settings.json");

    let update = serde_json::json!({ "onboardingCompleted": true });
    let (merged, ok) = merge_and_save_settings(&path, &update);
    assert!(ok);

    assert_eq!(merged["onboardingCompleted"], true);
    assert_eq!(merged["theme"], "dark");
    assert_eq!(merged["colorTheme"], "night");
  }

  #[test]
  fn write_settings_produces_valid_round_trippable_json() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("settings.json");

    let settings = serde_json::json!({ "theme": "light", "nested": { "a": 1 } });
    let ok = write_settings(&path, &settings);
    assert!(ok);

    let raw = std::fs::read_to_string(&path).unwrap();
    // Pretty-printed JSON contains newlines and indentation.
    assert!(raw.contains('\n'));

    let reparsed: Value = serde_json::from_str(&raw).unwrap();
    assert_eq!(reparsed, settings);
  }
}
