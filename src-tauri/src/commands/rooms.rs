// CRUD Tauri-kommandoer for `rooms`.
//
// Port av src/ipc-handlers.js sine get-rooms/get-room/save-room/delete-room
// IPC-handlere (linje 92-103). Følger mønsteret etablert i classes.rs
// (Task 2.1): tynn #[tauri::command]-wrapper som delegerer til en ren,
// testbar `*_impl(&Connection, ...)`-funksjon.
//
// VIKTIG: `save-room` i JS-originalen setter KUN `name` og `layout_data`.
// Den rører ALDRI `design_mode`/`room_height` (disse kolonnene finnes i
// schema, men settes tydeligvis et annet sted i appen / ikke gjennom denne
// handleren) - vi oppfinner ikke atferd for dem her, kun det JS faktisk gjør.
//
// VIKTIG: `delete-room` sletter IKKE tilhørende seatings (ikke en
// kaskaderende sletting slik delete-class er). Den nuller i stedet ut
// `seatings.room_id` for alle rader som pekte på rommet, og sletter deretter
// selve rom-raden. Seatings overlever altså, bare med room_id = NULL.

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use super::save_result::SaveResult;
use crate::db::DbState;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RoomRecord {
  pub id: Option<i64>,
  pub name: String,
  pub layout_data: Value,
}

/// Speiler JS sin `typeof layoutData === 'string' ? layoutData : JSON.stringify(layoutData)`.
/// Se classes.rs::encode_students for den fulle begrunnelsen for dette skillet.
fn encode_layout_data(layout_data: &Value) -> String {
  match layout_data {
    Value::String(s) => s.clone(),
    other => serde_json::to_string(other).expect("serialisering av serde_json::Value kan ikke feile"),
  }
}

/// Leser `layout_data`-TEXT-kolonnen tilbake til en `serde_json::Value`.
/// Se classes.rs::decode_students for den fulle begrunnelsen.
fn decode_layout_data(raw: Option<String>) -> Value {
  match raw {
    None => Value::Null,
    Some(s) => serde_json::from_str(&s).unwrap_or(Value::Null),
  }
}

fn row_to_room(row: &rusqlite::Row) -> rusqlite::Result<RoomRecord> {
  Ok(RoomRecord {
    id: row.get(0)?,
    name: row.get(1)?,
    layout_data: decode_layout_data(row.get(2)?),
  })
}

pub fn get_rooms_impl(conn: &Connection) -> rusqlite::Result<Vec<RoomRecord>> {
  let mut stmt = conn.prepare("SELECT id, name, layout_data FROM rooms ORDER BY name ASC")?;
  let rows = stmt.query_map([], row_to_room)?;
  rows.collect()
}

pub fn get_room_impl(conn: &Connection, id: i64) -> rusqlite::Result<Option<RoomRecord>> {
  conn
    .query_row(
      "SELECT id, name, layout_data FROM rooms WHERE id = ?1",
      [id],
      row_to_room,
    )
    .optional()
}

/// Insert (id == None) eller update (id == Some) av et rom. Setter KUN
/// `name`/`layout_data` - rører ikke `design_mode`/`room_height`, speiler
/// JS-originalens save-room nøyaktig. Returnerer radens id.
pub fn save_room_impl(conn: &Connection, record: &RoomRecord) -> rusqlite::Result<i64> {
  let layout_json = encode_layout_data(&record.layout_data);

  match record.id {
    Some(id) => {
      conn.execute(
        "UPDATE rooms SET name = ?1, layout_data = ?2 WHERE id = ?3",
        rusqlite::params![record.name, layout_json, id],
      )?;
      Ok(id)
    }
    None => {
      conn.execute(
        "INSERT INTO rooms (name, layout_data) VALUES (?1, ?2)",
        rusqlite::params![record.name, layout_json],
      )?;
      Ok(conn.last_insert_rowid())
    }
  }
}

/// Nuller ut `seatings.room_id` for alle rader som peker på rommet, deretter
/// slettes selve rom-raden. IKKE en kaskaderende sletting av seatings -
/// speiler delete-room i JS nøyaktig.
pub fn delete_room_impl(conn: &Connection, id: i64) -> rusqlite::Result<()> {
  conn.execute("UPDATE seatings SET room_id = NULL WHERE room_id = ?1", [id])?;
  conn.execute("DELETE FROM rooms WHERE id = ?1", [id])?;
  Ok(())
}

// ---- Tauri-kommando-wrappere: låser DbState-Mutex-en og delegerer til *_impl ----

#[tauri::command]
pub fn get_rooms(state: State<DbState>) -> Result<Vec<RoomRecord>, String> {
  let conn = state.0.lock().map_err(|e| e.to_string())?;
  get_rooms_impl(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_room(state: State<DbState>, id: i64) -> Result<Option<RoomRecord>, String> {
  let conn = state.0.lock().map_err(|e| e.to_string())?;
  get_room_impl(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_room(state: State<DbState>, record: RoomRecord) -> Result<SaveResult, String> {
  let conn = state.0.lock().map_err(|e| e.to_string())?;
  save_room_impl(&conn, &record)
    .map(SaveResult::new)
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_room(state: State<DbState>, id: i64) -> Result<(), String> {
  let conn = state.0.lock().map_err(|e| e.to_string())?;
  delete_room_impl(&conn, id).map_err(|e| e.to_string())
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

  #[test]
  fn get_rooms_on_empty_db_returns_empty_vec() {
    let conn = setup();
    let rooms = get_rooms_impl(&conn).unwrap();
    assert!(rooms.is_empty());
  }

  #[test]
  fn get_rooms_returns_rows_ordered_by_name_asc() {
    let conn = setup();
    conn
      .execute_batch(
        "INSERT INTO rooms (name, layout_data) VALUES ('Charlie', '[]');
         INSERT INTO rooms (name, layout_data) VALUES ('Alice', '[]');
         INSERT INTO rooms (name, layout_data) VALUES ('Bob', '[]');",
      )
      .unwrap();

    let rooms = get_rooms_impl(&conn).unwrap();
    let names: Vec<&str> = rooms.iter().map(|r| r.name.as_str()).collect();
    assert_eq!(names, vec!["Alice", "Bob", "Charlie"]);
  }

  #[test]
  fn save_room_with_no_id_inserts_and_returns_new_id() {
    let conn = setup();
    let record = RoomRecord {
      id: None,
      name: "New Room".to_string(),
      layout_data: serde_json::json!([]),
    };
    let id = save_room_impl(&conn, &record).unwrap();
    assert!(id > 0);

    let fetched = get_room_impl(&conn, id).unwrap().unwrap();
    assert_eq!(fetched.name, "New Room");
  }

  #[test]
  fn save_room_with_existing_id_updates_in_place_without_duplicate() {
    let conn = setup();
    let record = RoomRecord {
      id: None,
      name: "Original".to_string(),
      layout_data: serde_json::json!([]),
    };
    let id = save_room_impl(&conn, &record).unwrap();

    let updated = RoomRecord {
      id: Some(id),
      name: "Updated".to_string(),
      layout_data: serde_json::json!({"desks": []}),
    };
    let returned_id = save_room_impl(&conn, &updated).unwrap();
    assert_eq!(returned_id, id);

    let all = get_rooms_impl(&conn).unwrap();
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].name, "Updated");
  }

  #[test]
  fn save_room_with_object_layout_data_stores_valid_json_not_double_encoded() {
    let conn = setup();
    let record = RoomRecord {
      id: None,
      name: "Room".to_string(),
      layout_data: serde_json::json!({"desks": [1, 2]}),
    };
    let id = save_room_impl(&conn, &record).unwrap();

    let raw: String = conn
      .query_row("SELECT layout_data FROM rooms WHERE id = ?1", [id], |r| {
        r.get(0)
      })
      .unwrap();
    assert_eq!(raw, r#"{"desks":[1,2]}"#);

    let fetched = get_room_impl(&conn, id).unwrap().unwrap();
    assert_eq!(fetched.layout_data, serde_json::json!({"desks": [1, 2]}));
  }

  #[test]
  fn save_room_with_already_stringified_layout_data_is_not_double_encoded() {
    let conn = setup();
    let record = RoomRecord {
      id: None,
      name: "Room".to_string(),
      layout_data: Value::String(r#"{"desks":[1,2]}"#.to_string()),
    };
    let id = save_room_impl(&conn, &record).unwrap();

    let raw: String = conn
      .query_row("SELECT layout_data FROM rooms WHERE id = ?1", [id], |r| {
        r.get(0)
      })
      .unwrap();

    assert_eq!(raw, r#"{"desks":[1,2]}"#);

    let fetched = get_room_impl(&conn, id).unwrap().unwrap();
    assert_eq!(fetched.layout_data, serde_json::json!({"desks": [1, 2]}));
  }

  #[test]
  fn get_room_existing_and_nonexistent() {
    let conn = setup();
    let record = RoomRecord {
      id: None,
      name: "Solo".to_string(),
      layout_data: serde_json::json!([]),
    };
    let id = save_room_impl(&conn, &record).unwrap();

    let found = get_room_impl(&conn, id).unwrap();
    assert!(found.is_some());
    assert_eq!(found.unwrap().name, "Solo");

    let missing = get_room_impl(&conn, id + 9999).unwrap();
    assert!(missing.is_none());
  }

  #[test]
  fn save_room_command_return_shape_serializes_as_last_id_and_changes() {
    let conn = setup();
    let record = RoomRecord {
      id: None,
      name: "Wrapped".to_string(),
      layout_data: serde_json::json!([]),
    };
    let id = save_room_impl(&conn, &record).unwrap();
    let wrapped = SaveResult::new(id);

    let json = serde_json::to_value(wrapped).unwrap();
    assert_eq!(json, serde_json::json!({"lastID": id, "changes": 1}));
  }

  #[test]
  fn delete_room_nulls_out_referencing_seatings_room_id_then_deletes_room() {
    let conn = setup();
    let room = RoomRecord {
      id: None,
      name: "Room A".to_string(),
      layout_data: serde_json::json!([]),
    };
    let room_id = save_room_impl(&conn, &room).unwrap();

    conn
      .execute(
        "INSERT INTO seatings (name, room_id) VALUES ('S', ?1)",
        [room_id],
      )
      .unwrap();
    let seating_id = conn.last_insert_rowid();

    delete_room_impl(&conn, room_id).unwrap();

    // Rommet er borte.
    let room_count: i64 = conn
      .query_row("SELECT COUNT(*) FROM rooms WHERE id = ?1", [room_id], |r| {
        r.get(0)
      })
      .unwrap();
    assert_eq!(room_count, 0);

    // Seatingen overlever, men med room_id = NULL.
    let seating_room_id: Option<i64> = conn
      .query_row(
        "SELECT room_id FROM seatings WHERE id = ?1",
        [seating_id],
        |r| r.get(0),
      )
      .unwrap();
    assert_eq!(seating_room_id, None);
  }
}
