// Database maintenance: backup-db / restore-db / move-db.
//
// Ports src/ipc-handlers.js:185-228's `backup-db`/`restore-db`/`move-db`
// IPC handlers to Rust/Tauri commands using `tauri-plugin-dialog` in place
// of Electron's `dialog.showSaveDialog`/`showOpenDialog`.
//
// ## The Rust-specific problem the JS version never had to deal with
//
// Electron's sql.js keeps the whole database in memory and only touches the
// on-disk file explicitly (via an explicit save step), so there is no live
// OS file handle held open on the `.db` file between saves - overwriting or
// deleting it from under the app is safe.
//
// `rusqlite::Connection` is the opposite: it holds a REAL, LIVE open file
// handle on the `.db` file for as long as the connection exists. Overwriting
// that file (`restore-db`) or deleting it (`move-db`) while `DbState`'s
// connection is still open risks a Windows sharing-violation failure, or -
// even if the OS allows it - leaves the live connection's cache/prepared
// statements pointing at stale content.
//
// The fix used throughout this module is "close-copy-reopen": take the
// `DbState` mutex, swap the live connection out for a closed one (releasing
// the OS handle), do the file operation, then open a fresh connection at the
// (possibly new) path and put it back in the mutex. The mutex stays locked
// for the whole sequence so no other command can observe the intermediate
// state. This also means `restore-db` does NOT require an app restart to
// take effect (unlike the Electron version, which relied on sql.js already
// having the new bytes reloaded on next boot) - though `move-db` still
// reports `requiresRestart: true` to match the JS contract, since the
// frontend already has restart-prompt UI wired to that flag.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use rusqlite::Connection;
use serde::Serialize;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

use crate::db::{self, CurrentDbPathState, DbState};

/// Maximum size (bytes) accepted for a `restore-db` source file. Mirrors
/// JS's `100 * 1024 * 1024` check.
pub const MAX_RESTORE_SIZE_BYTES: u64 = 100 * 1024 * 1024;

// ---------------------------------------------------------------------
// Pure/testable helpers
// ---------------------------------------------------------------------

/// Converts days-since-1970-01-01 (UTC) to a (year, month, day) civil date.
/// Howard Hinnant's well-known `civil_from_days` algorithm (public domain) -
/// avoids pulling in a chrono/time dependency for one date computation.
fn civil_from_days(z: i64) -> (i64, u32, u32) {
  let z = z + 719_468;
  let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
  let doe = (z - era * 146_097) as u64; // [0, 146096]
  let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365; // [0, 399]
  let y = yoe as i64 + era * 400;
  let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
  let mp = (5 * doy + 2) / 153; // [0, 11]
  let d = (doy - (153 * mp + 2) / 5 + 1) as u32; // [1, 31]
  let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32; // [1, 12]
  let y = if m <= 2 { y + 1 } else { y };
  (y, m, d)
}

/// Formats `now` as a `YYYY-MM-DD` UTC calendar date, matching JS's
/// `new Date().toISOString().split('T')[0]` (also UTC-based).
pub fn today_date_string(now: SystemTime) -> String {
  let days = now
    .duration_since(SystemTime::UNIX_EPOCH)
    .map(|d| (d.as_secs() / 86_400) as i64)
    .unwrap_or(0);
  let (y, m, d) = civil_from_days(days);
  format!("{y:04}-{m:02}-{d:02}")
}

/// Default filename offered in the `backup-db` save dialog, e.g.
/// `klassekart_backup_2026-08-11.db`.
pub fn backup_default_filename(now: SystemTime) -> String {
  format!("klassekart_backup_{}.db", today_date_string(now))
}

/// Mirrors JS's `if (stats.size > 100 * 1024 * 1024) return { ...error }`.
pub fn check_restore_size(size_bytes: u64) -> Result<(), String> {
  if size_bytes > MAX_RESTORE_SIZE_BYTES {
    Err("Filen er for stor (maks 100MB)".to_string())
  } else {
    Ok(())
  }
}

/// Mirrors JS's `path.join(dir, 'klassekart_database.db')`.
pub fn move_destination_path(target_dir: &Path) -> PathBuf {
  target_dir.join("klassekart_database.db")
}

/// Mirrors JS's `if (fs.existsSync(newPath)) return { ...error }`.
pub fn check_move_destination_available(new_path: &Path) -> Result<(), String> {
  if new_path.exists() {
    Err("Database finnes allerede der".to_string())
  } else {
    Ok(())
  }
}

/// `.bak` sibling of `current_db_path`, e.g. `klassekart_database.db.bak`.
/// Mirrors JS's `getDbPathFn() + '.bak'`.
pub fn backup_file_path(current_db_path: &Path) -> PathBuf {
  let mut s = current_db_path.as_os_str().to_os_string();
  s.push(".bak");
  PathBuf::from(s)
}

/// Writes `db-location.json` in the exact shape `db::resolve_db_path` reads
/// back: `{"dbPath": "<path>"}`.
pub fn write_db_location_config(user_data_dir: &Path, db_path: &Path) -> std::io::Result<()> {
  let cfg_path = user_data_dir.join("db-location.json");
  let json = serde_json::json!({ "dbPath": db_path.to_string_lossy() });
  let contents =
    serde_json::to_string(&json).map_err(|e| std::io::Error::other(e.to_string()))?;
  fs::write(cfg_path, contents)
}

/// Closes the connection currently sitting behind `*guard`, releasing its
/// OS file handle, by swapping it out for a throwaway in-memory connection.
/// The caller keeps `guard` locked for the duration of the file operation
/// that follows, so no other command can observe (or query) the in-memory
/// placeholder.
fn close_current_connection(guard: &mut Connection) -> Result<(), String> {
  let placeholder =
    Connection::open_in_memory().map_err(|e| format!("Kunne ikke åpne midlertidig tilkobling: {e}"))?;
  let old = std::mem::replace(guard, placeholder);
  old
    .close()
    .map_err(|(_conn, e)| format!("Kunne ikke lukke databasetilkoblingen: {e}"))
}

/// Core `restore-db` logic once a validated source file has been chosen:
/// back up the live db to `{current_path}.bak` (overwriting any previous
/// `.bak`, matching `fs.copyFileSync`'s overwrite-by-default behavior), then
/// safely close-copy-reopen so the live connection ends up reading the
/// restored content at the SAME path (`current_path` never changes for a
/// restore - only its file contents do).
pub fn restore_db_impl(
  db_state: &DbState,
  current_path: &Path,
  source_path: &Path,
) -> Result<(), String> {
  let backup_path = backup_file_path(current_path);
  fs::copy(current_path, &backup_path).map_err(|e| e.to_string())?;

  let mut guard = db_state
    .0
    .lock()
    .map_err(|_| "Databaselåsen er korrupt".to_string())?;
  close_current_connection(&mut guard)?;

  fs::copy(source_path, current_path).map_err(|e| e.to_string())?;

  let new_conn = db::open_connection(current_path).map_err(|e| e.to_string())?;
  *guard = new_conn;

  Ok(())
}

/// Core `move-db` logic once a validated, not-yet-occupied `new_path` is
/// known: copy the live db file there, close-and-delete the OLD file (the
/// close is required - Windows generally refuses to delete a file with a
/// live open handle), then reopen the live connection at `new_path`.
pub fn move_db_impl(db_state: &DbState, current_path: &Path, new_path: &Path) -> Result<(), String> {
  fs::copy(current_path, new_path).map_err(|e| e.to_string())?;

  let mut guard = db_state
    .0
    .lock()
    .map_err(|_| "Databaselåsen er korrupt".to_string())?;
  close_current_connection(&mut guard)?;

  fs::remove_file(current_path).map_err(|e| e.to_string())?;

  let new_conn = db::open_connection(new_path).map_err(|e| e.to_string())?;
  *guard = new_conn;

  Ok(())
}

// ---------------------------------------------------------------------
// Tauri commands (dialog-driven, not directly unit-testable)
// ---------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupDbResult {
  pub success: bool,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub canceled: Option<bool>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub file_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreDbResult {
  pub success: bool,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub canceled: Option<bool>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveDbResult {
  pub success: bool,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub canceled: Option<bool>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub error: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub new_path: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub requires_restart: Option<bool>,
}

/// Port of `ipcMain.handle('backup-db', ...)`. Read-only w.r.t. the live
/// connection (only copies FROM the current path), so no close/reopen
/// dance is needed here.
#[tauri::command]
pub async fn backup_db(
  app: AppHandle,
  db_path_state: State<'_, CurrentDbPathState>,
) -> Result<BackupDbResult, String> {
  let default_name = backup_default_filename(SystemTime::now());

  let chosen = app
    .dialog()
    .file()
    .set_title("Lagre sikkerhetskopi")
    .set_file_name(&default_name)
    .add_filter("Database", &["db"])
    .blocking_save_file();

  let Some(file_path) = chosen else {
    return Ok(BackupDbResult {
      success: false,
      canceled: Some(true),
      file_path: None,
    });
  };

  let dest = file_path.into_path().map_err(|e| e.to_string())?;

  let current_path = db_path_state
    .0
    .lock()
    .map_err(|_| "Databaselåsen er korrupt".to_string())?
    .clone();

  fs::copy(&current_path, &dest).map_err(|e| e.to_string())?;

  Ok(BackupDbResult {
    success: true,
    canceled: None,
    file_path: Some(dest.to_string_lossy().to_string()),
  })
}

/// Port of `ipcMain.handle('restore-db', ...)`.
#[tauri::command]
pub async fn restore_db(
  app: AppHandle,
  db_state: State<'_, DbState>,
  db_path_state: State<'_, CurrentDbPathState>,
) -> Result<RestoreDbResult, String> {
  let chosen = app
    .dialog()
    .file()
    .set_title("Gjenopprett database")
    .add_filter("Database", &["db"])
    .blocking_pick_file();

  let Some(file_path) = chosen else {
    return Ok(RestoreDbResult {
      success: false,
      canceled: Some(true),
      error: None,
    });
  };

  let source_path = file_path.into_path().map_err(|e| e.to_string())?;

  let metadata = fs::metadata(&source_path).map_err(|e| e.to_string())?;
  if let Err(msg) = check_restore_size(metadata.len()) {
    return Ok(RestoreDbResult {
      success: false,
      canceled: None,
      error: Some(msg),
    });
  }

  let current_path = db_path_state
    .0
    .lock()
    .map_err(|_| "Databaselåsen er korrupt".to_string())?
    .clone();

  restore_db_impl(&db_state, &current_path, &source_path)?;

  Ok(RestoreDbResult {
    success: true,
    canceled: None,
    error: None,
  })
}

/// Port of `ipcMain.handle('move-db', ...)`.
#[tauri::command]
pub async fn move_db(
  app: AppHandle,
  db_state: State<'_, DbState>,
  db_path_state: State<'_, CurrentDbPathState>,
) -> Result<MoveDbResult, String> {
  let chosen = app
    .dialog()
    .file()
    .set_title("Velg ny plassering")
    .set_can_create_directories(true)
    .blocking_pick_folder();

  let Some(dir_path) = chosen else {
    return Ok(MoveDbResult {
      success: false,
      canceled: Some(true),
      error: None,
      new_path: None,
      requires_restart: None,
    });
  };

  let target_dir = dir_path.into_path().map_err(|e| e.to_string())?;
  let new_path = move_destination_path(&target_dir);

  if let Err(msg) = check_move_destination_available(&new_path) {
    return Ok(MoveDbResult {
      success: false,
      canceled: None,
      error: Some(msg),
      new_path: None,
      requires_restart: None,
    });
  }

  let current_path = db_path_state
    .0
    .lock()
    .map_err(|_| "Databaselåsen er korrupt".to_string())?
    .clone();

  move_db_impl(&db_state, &current_path, &new_path)?;

  // Update the tracked current-path state IMMEDIATELY after the connection
  // swap succeeds, before attempting the (separately fallible)
  // db-location.json write. This keeps CurrentDbPathState consistent with
  // what DbState's live connection actually points at even if the config
  // write below fails - otherwise a later backup-db/restore-db call would
  // read a stale `current_path` (the just-deleted old file) from
  // CurrentDbPathState while the live connection is already at `new_path`.
  // Losing the persisted config on a write failure only affects where the
  // NEXT app launch looks for the db - it doesn't corrupt the running app.
  *db_path_state
    .0
    .lock()
    .map_err(|_| "Databaselåsen er korrupt".to_string())? = new_path.clone();

  let user_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  write_db_location_config(&user_data_dir, &new_path).map_err(|e| e.to_string())?;

  Ok(MoveDbResult {
    success: true,
    canceled: None,
    error: None,
    new_path: Some(new_path.to_string_lossy().to_string()),
    requires_restart: Some(true),
  })
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::fs;
  use std::sync::Mutex;
  use std::time::{Duration, UNIX_EPOCH};
  use tempfile::tempdir;

  // --- 1. Backup filename date formatting -----------------------------

  #[test]
  fn today_date_string_formats_unix_epoch() {
    assert_eq!(today_date_string(UNIX_EPOCH), "1970-01-01");
  }

  #[test]
  fn today_date_string_formats_known_millennium_date() {
    // 10957 days after 1970-01-01 UTC is the well-known constant for
    // 2000-01-01 UTC (30 years incl. 7 leap days: 1972/76/80/84/88/92/96).
    let t = UNIX_EPOCH + Duration::from_secs(10_957 * 86_400);
    assert_eq!(today_date_string(t), "2000-01-01");
  }

  #[test]
  fn backup_default_filename_embeds_the_date() {
    let t = UNIX_EPOCH + Duration::from_secs(10_957 * 86_400);
    assert_eq!(
      backup_default_filename(t),
      "klassekart_backup_2000-01-01.db"
    );
  }

  // --- 2. Restore: over-100MB rejection --------------------------------

  #[test]
  fn check_restore_size_accepts_up_to_limit() {
    assert!(check_restore_size(MAX_RESTORE_SIZE_BYTES).is_ok());
    assert!(check_restore_size(0).is_ok());
  }

  #[test]
  fn check_restore_size_rejects_over_limit() {
    let result = check_restore_size(MAX_RESTORE_SIZE_BYTES + 1);
    assert_eq!(result, Err("Filen er for stor (maks 100MB)".to_string()));
  }

  // --- 3. Move: destination-already-exists rejection -------------------

  #[test]
  fn move_destination_path_joins_fixed_filename() {
    let dir = tempdir().unwrap();
    let dest = move_destination_path(dir.path());
    assert_eq!(dest, dir.path().join("klassekart_database.db"));
  }

  #[test]
  fn check_move_destination_available_ok_when_absent() {
    let dir = tempdir().unwrap();
    let dest = dir.path().join("klassekart_database.db");
    assert!(check_move_destination_available(&dest).is_ok());
  }

  #[test]
  fn check_move_destination_available_rejects_when_present() {
    let dir = tempdir().unwrap();
    let dest = dir.path().join("klassekart_database.db");
    fs::write(&dest, b"already here").unwrap();

    let result = check_move_destination_available(&dest);
    assert_eq!(result, Err("Database finnes allerede der".to_string()));
  }

  // --- 4. Close-reopen connection-swap logic ----------------------------

  #[test]
  fn restore_db_impl_swaps_live_connection_to_new_content() {
    let dir = tempdir().unwrap();
    let current_path = dir.path().join("klassekart_database.db");

    // Seed the "live" database with one value.
    {
      let conn = Connection::open(&current_path).unwrap();
      conn
        .execute_batch("CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('old');")
        .unwrap();
    }
    let live_conn = Connection::open(&current_path).unwrap();
    let db_state = DbState(Mutex::new(live_conn));

    // A "source" db elsewhere with different content, to be restored in.
    let source_path = dir.path().join("chosen_backup.db");
    {
      let conn = Connection::open(&source_path).unwrap();
      conn
        .execute_batch("CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('restored');")
        .unwrap();
    }

    restore_db_impl(&db_state, &current_path, &source_path).unwrap();

    // A .bak of the pre-restore content must exist.
    let backup_path = backup_file_path(&current_path);
    assert!(backup_path.exists());
    {
      let backup_conn = Connection::open(&backup_path).unwrap();
      let v: String = backup_conn
        .query_row("SELECT v FROM t", [], |r| r.get(0))
        .unwrap();
      assert_eq!(v, "old");
    }

    // The SAME live connection object (still behind the same Mutex) must
    // now read the RESTORED content, proving the swap - not just the file
    // on disk - took effect.
    let guard = db_state.0.lock().unwrap();
    let v: String = guard.query_row("SELECT v FROM t", [], |r| r.get(0)).unwrap();
    assert_eq!(v, "restored");
  }

  #[test]
  fn move_db_impl_swaps_connection_and_removes_old_file() {
    let dir = tempdir().unwrap();
    let current_path = dir.path().join("klassekart_database.db");
    let new_dir = tempdir().unwrap();
    let new_path = new_dir.path().join("klassekart_database.db");

    {
      let conn = Connection::open(&current_path).unwrap();
      conn
        .execute_batch("CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('moved');")
        .unwrap();
    }
    let live_conn = Connection::open(&current_path).unwrap();
    let db_state = DbState(Mutex::new(live_conn));

    move_db_impl(&db_state, &current_path, &new_path).unwrap();

    // Old file must be gone (proves the close-before-delete worked - on
    // Windows, deleting a file with a live open handle fails outright).
    assert!(!current_path.exists());
    assert!(new_path.exists());

    // The live connection must now be reading from the NEW path.
    let guard = db_state.0.lock().unwrap();
    let v: String = guard.query_row("SELECT v FROM t", [], |r| r.get(0)).unwrap();
    assert_eq!(v, "moved");
  }

  // --- 5. db-location.json write format ---------------------------------

  #[test]
  fn write_db_location_config_matches_resolve_db_path_reader_shape() {
    let user_data_dir = tempdir().unwrap();
    let new_db_path = PathBuf::from("D:\\OneDrive\\klassekart_database.db");

    write_db_location_config(user_data_dir.path(), &new_db_path).unwrap();

    let cfg_path = user_data_dir.path().join("db-location.json");
    let contents = fs::read_to_string(&cfg_path).unwrap();
    let json: serde_json::Value = serde_json::from_str(&contents).unwrap();
    assert_eq!(json["dbPath"], "D:\\OneDrive\\klassekart_database.db");

    // Round-trip through the actual reader used at startup: since the
    // configured path doesn't exist on disk here, resolve_db_path() is
    // expected to fall back to the default - but that fallback ALSO proves
    // the file parsed successfully (a parse failure and a "doesn't exist"
    // fallback are indistinguishable from resolve_db_path's return value
    // alone, so this test additionally re-parses the JSON directly above).
    let resolved = db::resolve_db_path(user_data_dir.path());
    assert_eq!(resolved, user_data_dir.path().join("klassekart_database.db"));

    // Now prove the "custom path is honored" branch too, by writing a
    // db-location.json that points at a file that DOES exist.
    let real_target_dir = tempdir().unwrap();
    let real_target = real_target_dir.path().join("klassekart_database.db");
    fs::write(&real_target, b"fake sqlite content").unwrap();
    write_db_location_config(user_data_dir.path(), &real_target).unwrap();

    let resolved = db::resolve_db_path(user_data_dir.path());
    assert_eq!(resolved, real_target);
  }
}
