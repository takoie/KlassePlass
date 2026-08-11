// CRUD Tauri-kommandoer for `seatings`.
//
// Port av src/ipc-handlers.js sine get-seatings/get-seating/save-seating/
// delete-seating IPC-handlere (linje 105-126). Følger mønsteret etablert i
// classes.rs (Task 2.1).
//
// VIKTIG SÆRTREKK 1 (get-seatings): `class_id`-parameteren er valgfri. Hvis
// gitt filtreres det på `s.class_id = ?`; hvis utelatt returneres ALLE
// seatings. Begge grener LEFT JOIN-er inn `class_name` (fra classes) og
// `room_name` (fra rooms), og sorterer på `created_at DESC`.
//
// VIKTIG SÆRTREKK 2 (save-seating - BEVART QUIRK, IKKE en bug vi fikser):
// UPDATE-grenen (id er Some) setter KUN `name`, `placements`, `comment`.
// Den rører ALDRI `class_id`/`room_id` - kun INSERT-grenen (id er None)
// setter disse. Dette betyr at man IKKE kan flytte en eksisterende seating
// til en annen klasse/rom via save-seating i JS-originalen. Vi porterer
// denne atferden bokstavelig, uten å "fikse" den.
//
// delete-seating sletter tilhørende seating_history (via chart_id) FØR
// seatingen selv slettes - en delmengde av delete-class sin kaskade, men
// begrenset til denne ene seatingen (ingen participation_logs-sletting her,
// det gjøres kun av delete-class).

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use crate::db::DbState;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SeatingRecord {
  pub id: Option<i64>,
  pub name: Option<String>,
  pub class_id: Option<i64>,
  pub room_id: Option<i64>,
  pub placements: Value,
  pub comment: Option<String>,
}

/// Rad returnert av `get_seatings` - inkluderer LEFT JOIN-ede visningsnavn
/// som ikke finnes i `seatings`-tabellen selv.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SeatingListItem {
  pub id: i64,
  pub name: Option<String>,
  pub class_id: Option<i64>,
  pub room_id: Option<i64>,
  pub placements: Value,
  pub comment: Option<String>,
  pub created_at: Option<String>,
  pub class_name: Option<String>,
  pub room_name: Option<String>,
}

/// Speiler JS sin `typeof placements === 'string' ? placements : JSON.stringify(placements)`.
/// Se classes.rs::encode_students for den fulle begrunnelsen for dette skillet.
fn encode_placements(placements: &Value) -> String {
  match placements {
    Value::String(s) => s.clone(),
    other => serde_json::to_string(other).expect("serialisering av serde_json::Value kan ikke feile"),
  }
}

/// Leser `placements`-TEXT-kolonnen tilbake til en `serde_json::Value`.
/// Se classes.rs::decode_students for den fulle begrunnelsen.
fn decode_placements(raw: Option<String>) -> Value {
  match raw {
    None => Value::Null,
    Some(s) => serde_json::from_str(&s).unwrap_or(Value::Null),
  }
}

fn row_to_seating(row: &rusqlite::Row) -> rusqlite::Result<SeatingRecord> {
  Ok(SeatingRecord {
    id: row.get(0)?,
    name: row.get(1)?,
    class_id: row.get(2)?,
    room_id: row.get(3)?,
    placements: decode_placements(row.get(4)?),
    comment: row.get(5)?,
  })
}

fn row_to_seating_list_item(row: &rusqlite::Row) -> rusqlite::Result<SeatingListItem> {
  Ok(SeatingListItem {
    id: row.get(0)?,
    name: row.get(1)?,
    class_id: row.get(2)?,
    room_id: row.get(3)?,
    placements: decode_placements(row.get(4)?),
    comment: row.get(5)?,
    created_at: row.get(6)?,
    class_name: row.get(7)?,
    room_name: row.get(8)?,
  })
}

const SEATING_LIST_SELECT: &str = "SELECT s.id, s.name, s.class_id, s.room_id, s.placements, s.comment, \
   s.created_at, c.name as class_name, r.name as room_name \
   FROM seatings s \
   LEFT JOIN classes c ON s.class_id = c.id \
   LEFT JOIN rooms r ON s.room_id = r.id";

/// `class_id: None` -> alle seatings (fortsatt med JOIN-ene), `Some(id)` ->
/// filtrert på den klassen. Begge grener sorterer på `created_at DESC`.
pub fn get_seatings_impl(
  conn: &Connection,
  class_id: Option<i64>,
) -> rusqlite::Result<Vec<SeatingListItem>> {
  match class_id {
    Some(cid) => {
      let sql = format!("{SEATING_LIST_SELECT} WHERE s.class_id = ?1 ORDER BY s.created_at DESC");
      let mut stmt = conn.prepare(&sql)?;
      let rows = stmt.query_map([cid], row_to_seating_list_item)?;
      rows.collect()
    }
    None => {
      let sql = format!("{SEATING_LIST_SELECT} ORDER BY s.created_at DESC");
      let mut stmt = conn.prepare(&sql)?;
      let rows = stmt.query_map([], row_to_seating_list_item)?;
      rows.collect()
    }
  }
}

pub fn get_seating_impl(conn: &Connection, id: i64) -> rusqlite::Result<Option<SeatingRecord>> {
  conn
    .query_row(
      "SELECT id, name, class_id, room_id, placements, comment FROM seatings WHERE id = ?1",
      [id],
      row_to_seating,
    )
    .optional()
}

/// Insert (id == None) eller update (id == Some) av en seating.
///
/// BEVART QUIRK: UPDATE-grenen setter KUN name/placements/comment - den
/// rører IKKE class_id/room_id, selv om `record` inneholder verdier for
/// disse feltene. Dette speiler JS-originalen bokstavelig (se modul-doc).
/// Kun INSERT-grenen setter class_id/room_id.
pub fn save_seating_impl(conn: &Connection, record: &SeatingRecord) -> rusqlite::Result<i64> {
  let placements_json = encode_placements(&record.placements);
  let comment = record.comment.clone().unwrap_or_default();

  match record.id {
    Some(id) => {
      conn.execute(
        "UPDATE seatings SET name = ?1, placements = ?2, comment = ?3 WHERE id = ?4",
        rusqlite::params![record.name, placements_json, comment, id],
      )?;
      Ok(id)
    }
    None => {
      conn.execute(
        "INSERT INTO seatings (name, class_id, room_id, placements, comment) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![record.name, record.class_id, record.room_id, placements_json, comment],
      )?;
      Ok(conn.last_insert_rowid())
    }
  }
}

/// Sletter tilhørende `seating_history` (via `chart_id`) FØR seatingen selv
/// slettes. Ingen andre kaskader her (kun en delmengde av delete-class).
pub fn delete_seating_impl(conn: &Connection, id: i64) -> rusqlite::Result<()> {
  conn.execute("DELETE FROM seating_history WHERE chart_id = ?1", [id])?;
  conn.execute("DELETE FROM seatings WHERE id = ?1", [id])?;
  Ok(())
}

// ---- Tauri-kommando-wrappere: låser DbState-Mutex-en og delegerer til *_impl ----

#[tauri::command]
pub fn get_seatings(
  state: State<DbState>,
  class_id: Option<i64>,
) -> Result<Vec<SeatingListItem>, String> {
  let conn = state.0.lock().map_err(|e| e.to_string())?;
  get_seatings_impl(&conn, class_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_seating(state: State<DbState>, id: i64) -> Result<Option<SeatingRecord>, String> {
  let conn = state.0.lock().map_err(|e| e.to_string())?;
  get_seating_impl(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_seating(state: State<DbState>, record: SeatingRecord) -> Result<i64, String> {
  let conn = state.0.lock().map_err(|e| e.to_string())?;
  save_seating_impl(&conn, &record).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_seating(state: State<DbState>, id: i64) -> Result<(), String> {
  let conn = state.0.lock().map_err(|e| e.to_string())?;
  delete_seating_impl(&conn, id).map_err(|e| e.to_string())
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

  fn insert_room(conn: &Connection, name: &str) -> i64 {
    conn
      .execute("INSERT INTO rooms (name, layout_data) VALUES (?1, '[]')", [name])
      .unwrap();
    conn.last_insert_rowid()
  }

  fn insert_seating_with_timestamp(
    conn: &Connection,
    name: &str,
    class_id: i64,
    room_id: i64,
    created_at: &str,
  ) -> i64 {
    conn
      .execute(
        "INSERT INTO seatings (name, class_id, room_id, placements, comment, created_at) \
         VALUES (?1, ?2, ?3, '[]', '', ?4)",
        rusqlite::params![name, class_id, room_id, created_at],
      )
      .unwrap();
    conn.last_insert_rowid()
  }

  #[test]
  fn get_seatings_on_empty_db_returns_empty_vec() {
    let conn = setup();
    let seatings = get_seatings_impl(&conn, None).unwrap();
    assert!(seatings.is_empty());
  }

  #[test]
  fn get_seatings_without_class_id_returns_all_with_joined_names_ordered_by_created_at_desc() {
    let conn = setup();
    let class_a = insert_class(&conn, "Class A");
    let class_b = insert_class(&conn, "Class B");
    let room = insert_room(&conn, "Room 1");

    // Insert deliberately out of chronological order re: insertion sequence,
    // with explicit timestamps to make DESC ordering deterministic (SQLite
    // DATETIME default has only second-level granularity).
    let id_oldest = insert_seating_with_timestamp(&conn, "Oldest", class_a, room, "2024-01-01 10:00:00");
    let id_newest = insert_seating_with_timestamp(&conn, "Newest", class_b, room, "2024-01-03 10:00:00");
    let id_middle = insert_seating_with_timestamp(&conn, "Middle", class_a, room, "2024-01-02 10:00:00");

    let all = get_seatings_impl(&conn, None).unwrap();
    assert_eq!(all.len(), 3);
    let ids: Vec<i64> = all.iter().map(|s| s.id).collect();
    assert_eq!(ids, vec![id_newest, id_middle, id_oldest]);

    let newest = &all[0];
    assert_eq!(newest.class_name.as_deref(), Some("Class B"));
    assert_eq!(newest.room_name.as_deref(), Some("Room 1"));
  }

  #[test]
  fn get_seatings_with_class_id_filters_to_that_class_only() {
    let conn = setup();
    let class_a = insert_class(&conn, "Class A");
    let class_b = insert_class(&conn, "Class B");
    let room = insert_room(&conn, "Room 1");

    insert_seating_with_timestamp(&conn, "A1", class_a, room, "2024-01-01 10:00:00");
    insert_seating_with_timestamp(&conn, "A2", class_a, room, "2024-01-02 10:00:00");
    insert_seating_with_timestamp(&conn, "B1", class_b, room, "2024-01-03 10:00:00");

    let filtered = get_seatings_impl(&conn, Some(class_a)).unwrap();
    assert_eq!(filtered.len(), 2);
    assert!(filtered.iter().all(|s| s.class_id == Some(class_a)));

    // Still ordered by created_at DESC within the filtered set.
    assert_eq!(filtered[0].name.as_deref(), Some("A2"));
    assert_eq!(filtered[1].name.as_deref(), Some("A1"));
  }

  #[test]
  fn save_seating_with_no_id_inserts_class_id_and_room_id() {
    let conn = setup();
    let class_id = insert_class(&conn, "Class A");
    let room_id = insert_room(&conn, "Room 1");

    let record = SeatingRecord {
      id: None,
      name: Some("New Seating".to_string()),
      class_id: Some(class_id),
      room_id: Some(room_id),
      placements: serde_json::json!([]),
      comment: Some("hello".to_string()),
    };
    let id = save_seating_impl(&conn, &record).unwrap();

    let fetched = get_seating_impl(&conn, id).unwrap().unwrap();
    assert_eq!(fetched.class_id, Some(class_id));
    assert_eq!(fetched.room_id, Some(room_id));
    assert_eq!(fetched.comment, Some("hello".to_string()));
  }

  #[test]
  fn save_seating_update_does_not_touch_class_id_or_room_id() {
    let conn = setup();
    let class_1 = insert_class(&conn, "Class 1");
    let class_2 = insert_class(&conn, "Class 2");
    let room_1 = insert_room(&conn, "Room 1");
    let room_2 = insert_room(&conn, "Room 2");

    let record = SeatingRecord {
      id: None,
      name: Some("Original".to_string()),
      class_id: Some(class_1),
      room_id: Some(room_1),
      placements: serde_json::json!([]),
      comment: Some("orig comment".to_string()),
    };
    let id = save_seating_impl(&conn, &record).unwrap();

    // Attempt to "move" the seating to a different class/room via update -
    // this is the preserved quirk: it must NOT take effect.
    let update_attempt = SeatingRecord {
      id: Some(id),
      name: Some("Renamed".to_string()),
      class_id: Some(class_2),
      room_id: Some(room_2),
      placements: serde_json::json!(["p1"]),
      comment: Some("new comment".to_string()),
    };
    save_seating_impl(&conn, &update_attempt).unwrap();

    let fetched = get_seating_impl(&conn, id).unwrap().unwrap();
    // name/placements/comment DID change:
    assert_eq!(fetched.name, Some("Renamed".to_string()));
    assert_eq!(fetched.placements, serde_json::json!(["p1"]));
    assert_eq!(fetched.comment, Some("new comment".to_string()));
    // class_id/room_id did NOT change - still pointing at the originals:
    assert_eq!(fetched.class_id, Some(class_1));
    assert_eq!(fetched.room_id, Some(room_1));
  }

  #[test]
  fn save_seating_with_array_placements_stores_valid_json_not_double_encoded() {
    let conn = setup();
    let record = SeatingRecord {
      id: None,
      name: Some("Seating".to_string()),
      class_id: None,
      room_id: None,
      placements: serde_json::json!([{"deskId": 1, "studentId": "s1"}]),
      comment: None,
    };
    let id = save_seating_impl(&conn, &record).unwrap();

    let raw: String = conn
      .query_row("SELECT placements FROM seatings WHERE id = ?1", [id], |r| {
        r.get(0)
      })
      .unwrap();
    assert_eq!(raw, r#"[{"deskId":1,"studentId":"s1"}]"#);

    let fetched = get_seating_impl(&conn, id).unwrap().unwrap();
    assert_eq!(
      fetched.placements,
      serde_json::json!([{"deskId": 1, "studentId": "s1"}])
    );
  }

  #[test]
  fn save_seating_with_already_stringified_placements_is_not_double_encoded() {
    let conn = setup();
    let record = SeatingRecord {
      id: None,
      name: Some("Seating".to_string()),
      class_id: None,
      room_id: None,
      placements: Value::String(r#"[{"deskId":1}]"#.to_string()),
      comment: None,
    };
    let id = save_seating_impl(&conn, &record).unwrap();

    let raw: String = conn
      .query_row("SELECT placements FROM seatings WHERE id = ?1", [id], |r| {
        r.get(0)
      })
      .unwrap();
    assert_eq!(raw, r#"[{"deskId":1}]"#);
  }

  #[test]
  fn get_seating_existing_and_nonexistent() {
    let conn = setup();
    let record = SeatingRecord {
      id: None,
      name: Some("Solo".to_string()),
      class_id: None,
      room_id: None,
      placements: serde_json::json!([]),
      comment: None,
    };
    let id = save_seating_impl(&conn, &record).unwrap();

    let found = get_seating_impl(&conn, id).unwrap();
    assert!(found.is_some());
    assert_eq!(found.unwrap().name, Some("Solo".to_string()));

    let missing = get_seating_impl(&conn, id + 9999).unwrap();
    assert!(missing.is_none());
  }

  #[test]
  fn delete_seating_removes_related_seating_history_and_the_seating_itself() {
    let conn = setup();
    let class_id = insert_class(&conn, "Class A");

    let record = SeatingRecord {
      id: None,
      name: Some("S".to_string()),
      class_id: Some(class_id),
      room_id: None,
      placements: serde_json::json!([]),
      comment: None,
    };
    let seating_id = save_seating_impl(&conn, &record).unwrap();

    conn
      .execute(
        "INSERT INTO seating_history (class_id, chart_id, pairs) VALUES (?1, ?2, '[]')",
        rusqlite::params![class_id, seating_id],
      )
      .unwrap();

    delete_seating_impl(&conn, seating_id).unwrap();

    let seating_count: i64 = conn
      .query_row(
        "SELECT COUNT(*) FROM seatings WHERE id = ?1",
        [seating_id],
        |r| r.get(0),
      )
      .unwrap();
    assert_eq!(seating_count, 0);

    let history_count: i64 = conn
      .query_row(
        "SELECT COUNT(*) FROM seating_history WHERE chart_id = ?1",
        [seating_id],
        |r| r.get(0),
      )
      .unwrap();
    assert_eq!(history_count, 0);
  }
}
