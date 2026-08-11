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
pub fn open_connection(path: &Path) -> Connection {
  if let Some(parent) = path.parent() {
    std::fs::create_dir_all(parent).ok();
  }
  Connection::open(path).expect("kunne ikke åpne databasefil")
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

    let conn = open_connection(&nested_path);
    assert!(nested_path.exists());

    // Sanity check the connection is actually usable.
    conn
      .execute_batch("CREATE TABLE t (id INTEGER PRIMARY KEY);")
      .unwrap();
  }
}
