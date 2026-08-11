// Tauri-kommandoer for app-metadata: versjonsnummer og migrasjonsinfo.
//
// Port av src/ipc-handlers.js sine get-version/get-migration-info
// IPC-handlere (linje 62-63). Ingen `DbState`/SQL involvert her.
//
// - `get-version` -> Electron sin `app.getVersion()` leser versjonen fra
//   package.json. Tauri-ekvivalenten er `AppHandle::package_info().version`.
// - `get-migration-info` -> Electron sin `getMigrationInfo()` returnerer
//   `lastMigrationInfo`, satt under `initDb()` til enten `null` (ingen
//   migrasjon nødvendig) eller `{ fromVersion, toVersion, backupPath }`.
//   Dette speiler `MigrationInfoState` satt opp i src-tauri/src/db.rs
//   (Task 1.3): `None` -> `null` i JS, `Some(info)` -> det populerte
//   objektet (nå serialisert med camelCase-feltnavn, se db.rs).

use tauri::{AppHandle, State};

use crate::db::{MigrationInfo, MigrationInfoState};

/// Ren, testbar kjerne-logikk: leser gjeldende migrasjonsinfo fra state.
/// `None` betyr enten fersk installasjon (intet tidligere schema) eller
/// databasen var allerede oppdatert - i begge tilfeller ble ingen backup
/// tatt, og JS-siden ville sett `null`.
pub fn get_migration_info_impl(state: &MigrationInfoState) -> Option<MigrationInfo> {
  state.0.lock().map(|guard| guard.clone()).unwrap_or(None)
}

#[tauri::command]
pub fn get_version(app_handle: AppHandle) -> String {
  app_handle.package_info().version.to_string()
}

#[tauri::command]
pub fn get_migration_info(state: State<MigrationInfoState>) -> Option<MigrationInfo> {
  get_migration_info_impl(&state)
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::path::PathBuf;
  use std::sync::Mutex;

  #[test]
  fn get_migration_info_returns_none_when_no_migration_happened() {
    let state = MigrationInfoState(Mutex::new(None));
    let info = get_migration_info_impl(&state);
    assert!(info.is_none());
  }

  #[test]
  fn get_migration_info_returns_populated_info_when_migration_happened() {
    let migration_info = MigrationInfo {
      from_version: 7,
      to_version: 11,
      backup_path: PathBuf::from("C:\\data\\klassekart_database.v7-backup-123.db"),
    };
    let state = MigrationInfoState(Mutex::new(Some(migration_info)));

    let info = get_migration_info_impl(&state);
    let info = info.expect("expected Some(MigrationInfo)");
    assert_eq!(info.from_version, 7);
    assert_eq!(info.to_version, 11);
    assert_eq!(
      info.backup_path,
      PathBuf::from("C:\\data\\klassekart_database.v7-backup-123.db")
    );
  }

  #[test]
  fn migration_info_serializes_with_camel_case_field_names() {
    let migration_info = MigrationInfo {
      from_version: 7,
      to_version: 11,
      backup_path: PathBuf::from("C:\\data\\backup.db"),
    };

    let json = serde_json::to_value(&migration_info).unwrap();
    assert_eq!(json["fromVersion"], 7);
    assert_eq!(json["toVersion"], 11);
    assert_eq!(json["backupPath"], "C:\\data\\backup.db");
  }
}
