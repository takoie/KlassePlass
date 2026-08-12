// Les-kommando for `student_constraints`.
//
// Port av src/ipc-handlers.js sin get-constraints IPC-handler (linje 129):
//   ipcMain.handle('get-constraints', async (_, cid) =>
//     dbAll('SELECT * FROM student_constraints WHERE class_id=?', [cid]));
//
// Enkel, read-only kommando - ingen JSON-blob-kolonner, ingen kaskader.
// Følger samme wrapper/impl-mønster som classes.rs (Task 2.1).

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::DbState;

/// INGEN `#[serde(rename_all = "camelCase")]` her - se rooms.rs::RoomReadRecord
/// for full begrunnelse (samme bug-klasse, samme fiks): frontend leser
/// `class_id`/`student_a`/`student_b` (snake_case) rått fra respons-objektet.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ConstraintRecord {
  pub id: i64,
  pub class_id: i64,
  pub student_a: String,
  pub student_b: String,
  #[serde(rename = "type")]
  pub constraint_type: String,
}

fn row_to_constraint(row: &rusqlite::Row) -> rusqlite::Result<ConstraintRecord> {
  Ok(ConstraintRecord {
    id: row.get(0)?,
    class_id: row.get(1)?,
    student_a: row.get(2)?,
    student_b: row.get(3)?,
    constraint_type: row.get(4)?,
  })
}

pub fn get_constraints_impl(conn: &Connection, class_id: i64) -> rusqlite::Result<Vec<ConstraintRecord>> {
  let mut stmt = conn.prepare(
    "SELECT id, class_id, student_a, student_b, type FROM student_constraints WHERE class_id = ?1",
  )?;
  let rows = stmt.query_map([class_id], row_to_constraint)?;
  rows.collect()
}

#[tauri::command]
pub fn get_constraints(state: State<DbState>, class_id: i64) -> Result<Vec<ConstraintRecord>, String> {
  let conn = state.0.lock().map_err(|e| e.to_string())?;
  get_constraints_impl(&conn, class_id).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::schema;

  fn setup() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    schema::run_migrations(&conn).unwrap();
    conn
  }

  fn insert_class(conn: &Connection, name: &str) -> i64 {
    conn
      .execute("INSERT INTO classes (name, students) VALUES (?1, '[]')", [name])
      .unwrap();
    conn.last_insert_rowid()
  }

  #[test]
  fn get_constraints_for_class_with_none_returns_empty_vec() {
    let conn = setup();
    let class_id = insert_class(&conn, "Class A");
    let constraints = get_constraints_impl(&conn, class_id).unwrap();
    assert!(constraints.is_empty());
  }

  #[test]
  fn get_constraints_returns_matching_rows_for_the_class() {
    let conn = setup();
    let class_id = insert_class(&conn, "Class A");

    conn
      .execute(
        "INSERT INTO student_constraints (class_id, student_a, student_b, type) VALUES (?1, 'a', 'b', 'avoid')",
        [class_id],
      )
      .unwrap();
    conn
      .execute(
        "INSERT INTO student_constraints (class_id, student_a, student_b, type) VALUES (?1, 'c', 'd', 'together')",
        [class_id],
      )
      .unwrap();

    let constraints = get_constraints_impl(&conn, class_id).unwrap();
    assert_eq!(constraints.len(), 2);
    assert!(constraints.iter().all(|c| c.class_id == class_id));
    let types: Vec<&str> = constraints.iter().map(|c| c.constraint_type.as_str()).collect();
    assert_eq!(types, vec!["avoid", "together"]);
  }

  #[test]
  fn get_constraints_does_not_return_rows_from_other_classes() {
    let conn = setup();
    let class_a = insert_class(&conn, "Class A");
    let class_b = insert_class(&conn, "Class B");

    conn
      .execute(
        "INSERT INTO student_constraints (class_id, student_a, student_b, type) VALUES (?1, 'a', 'b', 'avoid')",
        [class_a],
      )
      .unwrap();
    conn
      .execute(
        "INSERT INTO student_constraints (class_id, student_a, student_b, type) VALUES (?1, 'x', 'y', 'together')",
        [class_b],
      )
      .unwrap();

    let constraints_a = get_constraints_impl(&conn, class_a).unwrap();
    assert_eq!(constraints_a.len(), 1);
    assert_eq!(constraints_a[0].student_a, "a");

    let constraints_b = get_constraints_impl(&conn, class_b).unwrap();
    assert_eq!(constraints_b.len(), 1);
    assert_eq!(constraints_b[0].student_a, "x");
  }
}
