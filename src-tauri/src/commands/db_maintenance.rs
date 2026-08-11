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
///
/// If closing fails (in practice this is essentially unreachable through
/// rusqlite's safe API - `Connection::close` only fails when unfinalized
/// prepared statements are still alive, and the borrow checker prevents
/// dropping/moving a `Connection` while a `Statement` still borrows it), the
/// ORIGINAL connection is put back into `*guard` before returning the error,
/// so a close failure never leaves `DbState` stuck on the in-memory
/// placeholder.
fn close_current_connection(guard: &mut Connection) -> Result<(), String> {
  let placeholder =
    Connection::open_in_memory().map_err(|e| format!("Kunne ikke åpne midlertidig tilkobling: {e}"))?;
  let old = std::mem::replace(guard, placeholder);
  match old.close() {
    Ok(()) => Ok(()),
    Err((old_conn, e)) => {
      *guard = old_conn;
      Err(format!("Kunne ikke lukke databasetilkoblingen: {e}"))
    }
  }
}

/// Marker prefix used on error messages when a restore/move operation fails
/// AND the automatic recovery attempt also failed to leave `DbState` in a
/// working state. The frontend/caller should treat this distinctly from an
/// ordinary "the operation didn't go through, nothing changed" error - it
/// means the live connection may currently be an empty in-memory placeholder
/// and the app needs a restart to recover. Deliberately distinct wording so
/// it can't be mistaken for a normal, fully-recoverable failure.
const UNRECOVERABLE_PREFIX: &str = "KRITISK (krever omstart av appen)";

/// Core `restore-db` logic once a validated source file has been chosen:
/// back up the live db to `{current_path}.bak` (overwriting any previous
/// `.bak`, matching `fs.copyFileSync`'s overwrite-by-default behavior), then
/// safely close-copy-reopen so the live connection ends up reading the
/// restored content at the SAME path (`current_path` never changes for a
/// restore - only its file contents do).
///
/// ## Failure recovery
///
/// Once the live connection has been closed, `current_path` briefly has no
/// open handle on it, and if the subsequent overwrite-copy or reopen then
/// fails, we can no longer just propagate the error and bail: `current_path`
/// might now hold partially-written/corrupt bytes (a failed `fs::copy` is
/// not atomic) and `DbState` would otherwise be left on the in-memory
/// placeholder for the rest of the session. Since the `.bak` was made
/// *before* the close, both failure points below attempt to restore
/// `current_path` from that `.bak` and reopen it, so `DbState` ends up back
/// on a working connection to the ORIGINAL (pre-restore-attempt) data rather
/// than stuck on an empty placeholder. Only if that recovery copy/reopen
/// *also* fails (e.g. disk genuinely broken) do we give up and return an
/// [`UNRECOVERABLE_PREFIX`]-tagged error.
pub fn restore_db_impl(
  db_state: &DbState,
  current_path: &Path,
  source_path: &Path,
) -> Result<(), String> {
  let backup_path = backup_file_path(current_path);

  // Lock DbState for the *entire* sequence, starting with the pre-restore
  // `.bak` copy - not just from the close onward - for the same reason
  // `backup_db` now holds the lock across its copy: without it, a
  // concurrent write landing mid-copy could produce a torn/inconsistent
  // `.bak` file (SQLite writes pages to the main file during a commit in
  // rollback-journal mode).
  let mut guard = db_state
    .0
    .lock()
    .map_err(|_| "Databaselåsen er korrupt".to_string())?;

  fs::copy(current_path, &backup_path).map_err(|e| e.to_string())?;

  close_current_connection(&mut guard)?;

  if let Err(copy_err) = fs::copy(source_path, current_path) {
    return Err(recover_from_backup_or_report(
      &mut guard,
      &backup_path,
      current_path,
      format!("Kunne ikke skrive gjenopprettet database: {copy_err}"),
    ));
  }

  match db::open_connection(current_path) {
    Ok(new_conn) => {
      *guard = new_conn;
      Ok(())
    }
    Err(open_err) => Err(recover_from_backup_or_report(
      &mut guard,
      &backup_path,
      current_path,
      format!("Den gjenopprettede databasefilen kunne ikke åpnes: {open_err}"),
    )),
  }
}

/// Shared recovery step for `restore_db_impl`: after the live connection has
/// been closed and either the overwrite-copy or the reopen of the new
/// content failed, try to restore `current_path` from `backup_path` (the
/// pre-restore `.bak`) and reopen a connection there, putting it back into
/// `*guard` so the app keeps working with its ORIGINAL data. Returns an
/// error describing what happened either way - prefixed with
/// [`UNRECOVERABLE_PREFIX`] only if the recovery itself also failed (meaning
/// `*guard` is left on the in-memory placeholder and a restart is needed).
fn recover_from_backup_or_report(
  guard: &mut Connection,
  backup_path: &Path,
  current_path: &Path,
  primary_error: String,
) -> String {
  if let Err(restore_copy_err) = fs::copy(backup_path, current_path) {
    return format!(
      "{UNRECOVERABLE_PREFIX}: {primary_error}. Gjenoppretting fra sikkerhetskopi feilet også: {restore_copy_err}"
    );
  }
  match db::open_connection(current_path) {
    Ok(recovered_conn) => {
      *guard = recovered_conn;
      format!("{primary_error} Forrige database er gjenopprettet fra sikkerhetskopi, ingen data gikk tapt.")
    }
    Err(reopen_err) => {
      format!(
        "{UNRECOVERABLE_PREFIX}: {primary_error}. Sikkerhetskopien ble kopiert tilbake, men kunne ikke åpnes: {reopen_err}"
      )
    }
  }
}

/// Outcome of a successful `move_db_impl` call. `DbState` is always left in
/// a working state (pointing at `new_path`) whenever this is returned - the
/// only thing that can go wrong at this point is failing to clean up the
/// now-superseded old file, which is reported via `cleanup_warning` rather
/// than as an `Err`, since it does NOT mean the move failed: the live app is
/// fully functional at its new location either way. Callers MUST still
/// treat this as a success (update `CurrentDbPathState`/`db-location.json`,
/// report `success: true`) even when `cleanup_warning` is `Some`.
pub struct MoveDbOutcome {
  pub cleanup_warning: Option<String>,
}

/// Core `move-db` logic once a validated, not-yet-occupied `new_path` is
/// known.
///
/// Ordering is deliberately: copy to `new_path` -> open AND VERIFY a fresh
/// connection at `new_path` -> only THEN close the old connection and delete
/// `current_path`. This is what closes the critical data-loss gap a naive
/// "copy, close old, delete old, open new" ordering has: if opening the new
/// connection fails (permissions, AV lock, disk hiccup on the freshly-copied
/// file, ...), we find out BEFORE the old file is touched at all, so the old
/// file - and the live connection to it - are simply left exactly as they
/// were and the error propagates with zero side effects. The old file is
/// only ever removed once we already hold a working, verified connection to
/// its replacement - and even if THAT removal then fails (stale lock, AV,
/// ...), the already-verified `new_conn` is installed anyway, since at that
/// point the move has functionally succeeded and DbState must not be left
/// stuck on the placeholder just because disk cleanup of the old file
/// didn't go through.
pub fn move_db_impl(
  db_state: &DbState,
  current_path: &Path,
  new_path: &Path,
) -> Result<MoveDbOutcome, String> {
  fs::copy(current_path, new_path).map_err(|e| e.to_string())?;

  // Open and verify the new connection BEFORE touching DbState/the old file
  // at all. If this fails, current_path/DbState are completely untouched.
  let new_conn = db::open_connection(new_path).map_err(|e| e.to_string())?;

  let mut guard = db_state
    .0
    .lock()
    .map_err(|_| "Databaselåsen er korrupt".to_string())?;
  close_current_connection(&mut guard)?;

  // We already have a verified, working `new_conn` at this point - install
  // it regardless of whether deleting the old file below succeeds, so a
  // stale/locked old file never leaves DbState stuck on the placeholder.
  // Only a close_current_connection failure above (which restores the
  // ORIGINAL connection, per its own doc comment) still exits early.
  *guard = new_conn;
  match fs::remove_file(current_path) {
    Ok(()) => Ok(MoveDbOutcome {
      cleanup_warning: None,
    }),
    Err(remove_err) => Ok(MoveDbOutcome {
      cleanup_warning: Some(format!(
        "Databasen er flyttet og fungerer på nytt sted, men den gamle filen ({}) kunne ikke slettes automatisk og må fjernes manuelt: {remove_err}",
        current_path.display()
      )),
    }),
  }
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
  /// Non-fatal note - present only when the move itself succeeded (the app
  /// is fully functional at `new_path`) but the old file couldn't be
  /// cleaned up automatically. Not part of the original Electron contract;
  /// an additive field the JS side is free to ignore.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub warning: Option<String>,
}

/// Port of `ipcMain.handle('backup-db', ...)`. Read-only w.r.t. the live
/// connection (only copies FROM the current path), so no close/reopen dance
/// is needed - but the `DbState` mutex IS still held for the duration of the
/// `fs::copy` below (without touching the `Connection` itself), purely to
/// block any concurrent command from writing to the live db file while the
/// copy is in flight. Without this, a write landing mid-copy (SQLite writes
/// pages to the main file during a commit in rollback-journal mode) could
/// produce a torn/inconsistent backup file.
#[tauri::command]
pub async fn backup_db(
  app: AppHandle,
  db_state: State<'_, DbState>,
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

  // Hold the DbState lock across the copy so no concurrent command can
  // write to the live db file mid-copy (see doc comment above).
  let _db_guard = db_state
    .0
    .lock()
    .map_err(|_| "Databaselåsen er korrupt".to_string())?;
  fs::copy(&current_path, &dest).map_err(|e| e.to_string())?;
  drop(_db_guard);

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
      warning: None,
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
      warning: None,
    });
  }

  let current_path = db_path_state
    .0
    .lock()
    .map_err(|_| "Databaselåsen er korrupt".to_string())?
    .clone();

  let outcome = move_db_impl(&db_state, &current_path, &new_path)?;

  // Update the tracked current-path state IMMEDIATELY after the connection
  // swap succeeds, before attempting the (separately fallible)
  // db-location.json write. This keeps CurrentDbPathState consistent with
  // what DbState's live connection actually points at even if the config
  // write below fails - otherwise a later backup-db/restore-db call would
  // read a stale `current_path` (the just-deleted old file) from
  // CurrentDbPathState while the live connection is already at `new_path`.
  // Losing the persisted config on a write failure only affects where the
  // NEXT app launch looks for the db - it doesn't corrupt the running app.
  //
  // Note: `move_db_impl` returning `Ok` here (even with a `cleanup_warning`)
  // is the ONLY signal we act on - per its contract, `Ok` always means the
  // live connection is already installed and working at `new_path`.
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
    warning: outcome.cleanup_warning,
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

  // --- 6. Failure-recovery: DbState must never end up silently stuck on
  // --- the in-memory placeholder after a failure mid-sequence -----------
  //
  // Note on what these tests do NOT cover: forcing `db::open_connection`
  // itself to fail on an otherwise-valid, freshly-copied file is not
  // reliably possible through rusqlite's safe API - `Connection::open` is
  // lazy (verified empirically: it succeeds even on garbage-byte content or
  // a read-only file; only a subsequent read/write fails with
  // `NotADatabase`). Any path-based fault that would break `Connection::open`
  // (missing/blocked parent dir, permissions) breaks the preceding
  // `fs::copy` to the exact same path first, since both target the same
  // location - so the achievable, deterministic failure points are the
  // `fs::copy` steps. Both `restore_db_impl` and `move_db_impl` are
  // structured so a copy failure and an open failure hit the exact same
  // recovery/ordering logic, so exercising the copy failure exercises the
  // same code paths the reviewer's concern is about.

  #[test]
  fn move_db_impl_failed_copy_leaves_db_state_and_old_file_completely_untouched() {
    let dir = tempdir().unwrap();
    let current_path = dir.path().join("klassekart_database.db");

    {
      let conn = Connection::open(&current_path).unwrap();
      conn
        .execute_batch("CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('original');")
        .unwrap();
    }
    let live_conn = Connection::open(&current_path).unwrap();
    let db_state = DbState(Mutex::new(live_conn));

    // A new_path whose parent directory does not exist: fs::copy fails
    // immediately, before DbState or the old file are touched at all.
    let new_path = dir
      .path()
      .join("this_subdir_does_not_exist")
      .join("klassekart_database.db");

    let result = move_db_impl(&db_state, &current_path, &new_path);
    assert!(result.is_err());

    // Old file must be completely untouched.
    assert!(current_path.exists());
    // Nothing was ever created at the destination.
    assert!(!new_path.exists());

    // DbState must still hold a WORKING connection to the ORIGINAL data -
    // not the in-memory placeholder, not corrupted.
    let guard = db_state.0.lock().unwrap();
    let v: String = guard
      .query_row("SELECT v FROM t", [], |r| r.get(0))
      .expect("DbState must still be a working connection, not a stuck in-memory placeholder");
    assert_eq!(v, "original");
  }

  #[test]
  fn move_db_impl_cleanup_failure_still_installs_the_new_connection() {
    // Exercises the "copy+open succeeded, but deleting the old file failed"
    // branch: DbState must still end up on the NEW, working connection
    // (the move functionally succeeded) rather than being left on the
    // placeholder just because disk cleanup of the superseded file failed.
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

    // Hold a second live Connection open on current_path so fs::remove_file
    // hits a real sharing violation - this is the exact scenario the
    // review flagged (Windows refuses to delete a file with an open
    // handle). Empirically confirmed via manual run: this reliably
    // produces `os error 32` ("The process cannot access the file because
    // it is being used by another process.") on Windows, this project's
    // only target platform (see package.json's `build.win` config - no
    // mac/linux targets are shipped). Kept as an `if` below rather than a
    // hard assertion purely so the test doesn't become flaky if ever run
    // on a non-Windows dev machine, where deleting an open file is allowed.
    let _blocker = Connection::open(&current_path).ok();

    let result = move_db_impl(&db_state, &current_path, &new_path);
    let outcome = result.expect("move_db_impl must return Ok - a cleanup failure is non-fatal");

    // Whether or not cleanup_warning is Some (platform-dependent), DbState
    // must always be reading from the NEW path's data now.
    let guard = db_state.0.lock().unwrap();
    let v: String = guard
      .query_row("SELECT v FROM t", [], |r| r.get(0))
      .expect("DbState must hold the new, working connection");
    assert_eq!(v, "moved");

    if outcome.cleanup_warning.is_some() {
      // If cleanup really did fail on this platform, the old file is still
      // there (orphaned, not lost) rather than the app being broken.
      assert!(current_path.exists());
    }
  }

  #[test]
  fn restore_db_impl_recovers_original_data_when_overwrite_copy_fails() {
    let dir = tempdir().unwrap();
    let current_path = dir.path().join("klassekart_database.db");

    {
      let conn = Connection::open(&current_path).unwrap();
      conn
        .execute_batch("CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('original');")
        .unwrap();
    }
    let live_conn = Connection::open(&current_path).unwrap();
    let db_state = DbState(Mutex::new(live_conn));

    // A source path that doesn't exist: the internal fs::copy(source,
    // current_path) fails AFTER the live connection has already been
    // closed and the pre-restore .bak already made - exactly the failure
    // window the fix targets.
    let missing_source = dir.path().join("does_not_exist.db");

    let result = restore_db_impl(&db_state, &current_path, &missing_source);
    let err = result.expect_err("restore must fail: source file doesn't exist");

    // Must NOT be tagged unrecoverable - the .bak-based recovery must have
    // succeeded.
    assert!(
      !err.contains(UNRECOVERABLE_PREFIX),
      "expected a recoverable error, got: {err}"
    );

    // DbState must be back on a WORKING connection reading the ORIGINAL
    // (pre-restore-attempt) data - not the in-memory placeholder.
    let guard = db_state.0.lock().unwrap();
    let v: String = guard
      .query_row("SELECT v FROM t", [], |r| r.get(0))
      .expect("DbState must be recovered to a working connection, not a stuck placeholder");
    assert_eq!(v, "original");
    drop(guard);

    // The file on disk must also have been restored, not left corrupt.
    let reopened = Connection::open(&current_path).unwrap();
    let v: String = reopened
      .query_row("SELECT v FROM t", [], |r| r.get(0))
      .unwrap();
    assert_eq!(v, "original");
  }

  #[test]
  fn close_current_connection_restores_original_on_success_path_sanity_check() {
    // Not a failure-injection test (see module note above on why forcing an
    // actual Connection::close() failure isn't reachable through the safe
    // API) - this just pins down the happy-path contract close_current_connection
    // relies on: after a successful close, the guard holds a placeholder
    // that must be overwritten by the caller before the mutex is released.
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("klassekart_database.db");
    let conn = Connection::open(&db_path).unwrap();
    let mut guard = conn;

    close_current_connection(&mut guard).unwrap();

    // The placeholder is a valid, working in-memory connection (not left
    // in some half-initialized state) - callers rely on this to always be
    // safely overwritable.
    guard.execute_batch("CREATE TABLE t(x);").unwrap();
  }
}
