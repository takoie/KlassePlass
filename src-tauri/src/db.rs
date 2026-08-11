// Database connection setup and DB-location resolution.
//
// Ports src/db.js's getDbPath()/initDb() connection-opening behavior to Rust.
// Migration logic (schema versioning, backup-before-migrate) is out of scope
// here — see Task 1.2/1.3. This module only resolves *where* the sqlite file
// lives and opens a rusqlite::Connection to it.

use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// Shared app state wrapping the single rusqlite connection.
pub struct DbState(pub Mutex<Connection>);

/// Shared app state tracking the CURRENT on-disk path of the live database
/// connection held in `DbState`. Kept as separate managed state (rather than
/// bolted onto `DbState`) so the ~30 existing commands that only need the
/// `Connection` don't have to change shape.
///
/// Needed by the `backup-db`/`restore-db`/`move-db` commands (Task 4.1):
/// `backup-db` copies FROM this path, `restore-db` overwrites the file AT
/// this path (path itself doesn't change), and `move-db` copies the file to
/// a new location and then updates this state to point at it.
pub struct CurrentDbPathState(pub Mutex<PathBuf>);

/// Info about a backup made during startup because the on-disk schema was
/// older than `schema::CURRENT_VERSION`. Recorded so a later task (the
/// `get-migration-info` IPC command, Fase 2) can surface it to the frontend.
///
/// `Serialize` with `rename_all = "camelCase"` so the JSON shape sent to the
/// frontend matches what the JS side expects (`fromVersion`, `toVersion`,
/// `backupPath`) - mirroring the shape `getMigrationInfo()` produced in
/// src/db.js.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationInfo {
  pub from_version: i32,
  pub to_version: i32,
  pub backup_path: PathBuf,
}

/// Shared app state wrapping the most recent startup migration/backup info,
/// if any. `None` means either a fresh install (no prior schema) or the
/// database was already up to date - in both cases no backup was made.
pub struct MigrationInfoState(pub Mutex<Option<MigrationInfo>>);

/// Reads the highest applied schema version from an already-open connection.
///
/// Mirrors src/db.js's `getSchemaVersion(db)`: `SELECT MAX(version) FROM
/// schema_version`. Returns 0 if the query errors (e.g. the table doesn't
/// exist yet - a fresh database) or the result is NULL (table exists but is
/// empty), matching the JS `version || 0` fallback.
pub fn get_schema_version(conn: &Connection) -> i32 {
  conn
    .query_row(
      "SELECT MAX(version) as v FROM schema_version",
      [],
      |row| row.get::<_, Option<i32>>(0),
    )
    .ok()
    .flatten()
    .unwrap_or(0)
}

/// Backs up the on-disk database file before migrations run, but only if
/// there is something meaningful to protect.
///
/// Mirrors src/db.js's backup-before-migrate logic in `initDb()`:
/// a backup is made if and only if `from_version > 0 && from_version <
/// target_version`. `from_version == 0` means either the db file didn't
/// exist yet (fresh install) or it has no readable `schema_version` rows
/// (very old/corrupt) - in neither case is there anything worth preserving,
/// so no backup is attempted (this is the exact case the plan's original
/// pseudocode got wrong).
///
/// Backup filename: `db_path` with a trailing `.db` (case-insensitive)
/// stripped, then `.v{from_version}-backup-{unix_millis}.db` appended. E.g.
/// `klassekart_database.db` with `from_version = 7` becomes
/// `klassekart_database.v7-backup-1234567890123.db`.
///
/// Returns `Ok(Some(backup_path))` if a backup was made, `Ok(None)` if not
/// needed, `Err` if the file copy failed.
///
/// Must be called BEFORE any migration statements run against `db_path`'s
/// connection, since migrations mutate the file on disk.
pub fn backup_before_migrate_if_needed(
  db_path: &Path,
  from_version: i32,
  target_version: i32,
) -> std::io::Result<Option<PathBuf>> {
  if !(from_version > 0 && from_version < target_version) {
    return Ok(None);
  }

  let path_str = db_path.to_string_lossy();
  let stripped = if path_str.to_lowercase().ends_with(".db") {
    &path_str[..path_str.len() - 3]
  } else {
    &path_str[..]
  };

  let millis = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_millis())
    .unwrap_or(0);

  let backup_path = PathBuf::from(format!("{stripped}.v{from_version}-backup-{millis}.db"));

  std::fs::copy(db_path, &backup_path)?;

  Ok(Some(backup_path))
}

/// Resolves the sqlite database file path, mirroring src/db.js's getDbPath():
///
/// 1. Look for `db-location.json` in `user_data_dir`.
/// 2. If it exists and parses, and its `dbPath` field points to a file that
///    exists on disk, use that path.
/// 3. Otherwise (no config file, malformed JSON, missing `dbPath`, or the
///    configured path doesn't exist) fall back to the default location:
///    `user_data_dir/klassekart_database.db`.
pub fn resolve_db_path(user_data_dir: &Path) -> PathBuf {
  let location_file = user_data_dir.join("db-location.json");

  if let Ok(contents) = std::fs::read_to_string(&location_file) {
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&contents) {
      if let Some(custom_path) = json.get("dbPath").and_then(|v| v.as_str()) {
        let custom_path_buf = PathBuf::from(custom_path);
        if custom_path_buf.exists() {
          return custom_path_buf;
        }
      }
    }
  }

  user_data_dir.join("klassekart_database.db")
}

/// Opens (creating parent directories if needed) a rusqlite connection at `path`.
///
/// Returns an error instead of panicking so callers (e.g. lib.rs's `.setup()`)
/// can propagate recoverable failures (disk full, permission denied, etc.)
/// with `?` instead of crashing the app.
pub fn open_connection(path: &Path) -> rusqlite::Result<Connection> {
  if let Some(parent) = path.parent() {
    // Errors here are intentionally swallowed: if directory creation fails,
    // the subsequent Connection::open call below will fail too and surface
    // a proper error to the caller.
    std::fs::create_dir_all(parent).ok();
  }
  Connection::open(path)
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::fs;
  use tempfile::tempdir;

  #[test]
  fn no_location_file_returns_default_path() {
    let dir = tempdir().unwrap();
    let resolved = resolve_db_path(dir.path());
    assert_eq!(resolved, dir.path().join("klassekart_database.db"));
  }

  #[test]
  fn location_file_with_existing_custom_path_is_used() {
    let dir = tempdir().unwrap();

    // Create the custom target file so the exists()-check passes.
    let custom_dir = tempdir().unwrap();
    let custom_db = custom_dir.path().join("moved_db.db");
    fs::write(&custom_db, b"fake sqlite content").unwrap();

    let location_json = serde_json::json!({ "dbPath": custom_db.to_string_lossy() });
    fs::write(
      dir.path().join("db-location.json"),
      serde_json::to_string(&location_json).unwrap(),
    )
    .unwrap();

    let resolved = resolve_db_path(dir.path());
    assert_eq!(resolved, custom_db);
  }

  #[test]
  fn location_file_with_nonexistent_custom_path_falls_back_to_default() {
    let dir = tempdir().unwrap();

    // Points at a path that does not exist on disk.
    let missing_path = dir.path().join("does-not-exist").join("ghost.db");
    let location_json = serde_json::json!({ "dbPath": missing_path.to_string_lossy() });
    fs::write(
      dir.path().join("db-location.json"),
      serde_json::to_string(&location_json).unwrap(),
    )
    .unwrap();

    let resolved = resolve_db_path(dir.path());
    assert_eq!(resolved, dir.path().join("klassekart_database.db"));
  }

  #[test]
  fn malformed_location_file_falls_back_to_default_without_panicking() {
    let dir = tempdir().unwrap();
    fs::write(dir.path().join("db-location.json"), "{ not valid json").unwrap();

    let resolved = resolve_db_path(dir.path());
    assert_eq!(resolved, dir.path().join("klassekart_database.db"));
  }

  #[test]
  fn location_file_missing_dbpath_field_falls_back_to_default() {
    let dir = tempdir().unwrap();
    let location_json = serde_json::json!({ "somethingElse": "value" });
    fs::write(
      dir.path().join("db-location.json"),
      serde_json::to_string(&location_json).unwrap(),
    )
    .unwrap();

    let resolved = resolve_db_path(dir.path());
    assert_eq!(resolved, dir.path().join("klassekart_database.db"));
  }

  #[test]
  fn open_connection_creates_parent_dirs_and_opens() {
    let dir = tempdir().unwrap();
    let nested_path = dir.path().join("nested").join("sub").join("test.db");

    let conn = open_connection(&nested_path).unwrap();
    assert!(nested_path.exists());

    // Sanity check the connection is actually usable.
    conn
      .execute_batch("CREATE TABLE t (id INTEGER PRIMARY KEY);")
      .unwrap();
  }

  #[test]
  fn open_connection_returns_err_instead_of_panicking_on_failure() {
    // Passing a path whose parent cannot be a directory (a file, not a dir)
    // makes create_dir_all fail silently and Connection::open fail loudly,
    // which should surface as an Err rather than a panic.
    let dir = tempdir().unwrap();
    let blocking_file = dir.path().join("not_a_dir");
    fs::write(&blocking_file, b"i am a file, not a directory").unwrap();

    let bad_path = blocking_file.join("nested").join("test.db");
    let result = open_connection(&bad_path);
    assert!(result.is_err());
  }

  #[test]
  fn get_schema_version_returns_zero_when_table_missing() {
    let conn = Connection::open_in_memory().unwrap();
    assert_eq!(get_schema_version(&conn), 0);
  }

  #[test]
  fn get_schema_version_returns_max_of_rows() {
    let conn = Connection::open_in_memory().unwrap();
    conn
      .execute_batch(
        "CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
         INSERT INTO schema_version (version) VALUES (3), (7), (11);",
      )
      .unwrap();
    assert_eq!(get_schema_version(&conn), 11);
  }

  #[test]
  fn get_schema_version_returns_zero_when_table_empty() {
    let conn = Connection::open_in_memory().unwrap();
    conn
      .execute_batch("CREATE TABLE schema_version (version INTEGER PRIMARY KEY);")
      .unwrap();
    assert_eq!(get_schema_version(&conn), 0);
  }

  #[test]
  fn no_backup_when_from_version_is_zero() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("klassekart_database.db");
    fs::write(&db_path, b"fake sqlite content").unwrap();

    let result = backup_before_migrate_if_needed(&db_path, 0, 11).unwrap();
    assert_eq!(result, None);

    // No stray backup files should have been created.
    let entries: Vec<_> = fs::read_dir(dir.path()).unwrap().collect();
    assert_eq!(entries.len(), 1);
  }

  #[test]
  fn no_backup_when_already_up_to_date() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("klassekart_database.db");
    fs::write(&db_path, b"fake sqlite content").unwrap();

    let result = backup_before_migrate_if_needed(&db_path, 11, 11).unwrap();
    assert_eq!(result, None);

    let result = backup_before_migrate_if_needed(&db_path, 12, 11).unwrap();
    assert_eq!(result, None);
  }

  #[test]
  fn backup_made_when_from_version_between_zero_and_target() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("klassekart_database.db");
    let contents = b"fake sqlite content for backup test";
    fs::write(&db_path, contents).unwrap();

    let result = backup_before_migrate_if_needed(&db_path, 7, 11).unwrap();
    let backup_path = result.expect("expected a backup to be made");

    assert!(backup_path.exists());
    let name = backup_path.file_name().unwrap().to_string_lossy();
    assert!(name.contains(".v7-backup-"));
    assert!(name.ends_with(".db"));

    let backup_contents = fs::read(&backup_path).unwrap();
    assert_eq!(backup_contents, contents);
  }

  #[test]
  fn backup_strips_db_extension_case_insensitively() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("klassekart_database.DB");
    fs::write(&db_path, b"content").unwrap();

    let result = backup_before_migrate_if_needed(&db_path, 3, 11).unwrap();
    let backup_path = result.expect("expected a backup to be made");
    let name = backup_path.file_name().unwrap().to_string_lossy();

    // Original ".DB" should be stripped, not left as "klassekart_database.DB.v3-..."
    assert!(!name.contains(".DB.v3"));
    assert!(name.contains(".v3-backup-"));
    assert!(name.ends_with(".db"));
  }
}
