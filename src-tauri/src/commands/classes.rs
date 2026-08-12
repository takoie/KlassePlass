// CRUD Tauri-kommandoer for `classes`.
//
// Port av src/ipc-handlers.js sine get-classes/get-class/save-class/delete-class
// IPC-handlere. Dette er den FØRSTE command-modulen og etablerer mønsteret
// Task 2.2 kopierer for de øvrige entitetstypene (rooms, seatings, etc.):
//
//   - En #[tauri::command]-wrapper som henter State<DbState>, låser Mutex-en,
//     og delegerer til en ren, testbar `*_impl(&Connection, ...)`-funksjon.
//   - `*_impl`-funksjonene tar/returnerer rusqlite::Result og kan testes
//     direkte mot en in-memory-connection uten å måtte spinne opp Tauri.
//
// VIKTIG (students-kodingen): JS-originalens save-class gjør
//   `typeof students === 'string' ? students : JSON.stringify(students)`
// Siden Tauri/serde deserialiserer JSON-payloaden til en typed
// `serde_json::Value`, er det tilsvarende skillet: hvis verdien ALLEREDE er
// en JSON `Value::String(s)`, bruk `s` som den er (den antas å være
// ferdig-serialisert JSON som skal lagres rått i TEXT-kolonnen). For alle
// andre Value-varianter (array, object, number, bool, null), kjør
// `serde_json::to_string()` på hele verdien. Gjør vi IKKE dette skillet,
// ville en allerede-stringifisert students-verdi bli dobbelt-enkodet
// (f.eks. `"[]"` -> `"\"[]\""`), som er feil.

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use super::save_result::SaveResult;
use crate::db::DbState;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ClassRecord {
  /// `#[serde(default)]`: en IPC-payload som ikke inkluderer "id"-nøkkelen i
  /// det hele tatt (til forskjell fra å eksplisitt sende `id: null`) skal
  /// fortsatt deserialisere til `None`, ikke feile. Uten dette attributtet
  /// krever serde at nøkkelen er TIL STEDE (selv om verdien er null) - en
  /// frontend-kallsted som glemmer å inkludere "id" ved oppretting av en ny
  /// klasse fikk IPC-kallet til å feile med en uklar deserialiserings-feil
  /// som frontend viste som "Kunne ikke opprette ny klasse".
  #[serde(default)]
  pub id: Option<i64>,
  pub name: String,
  pub students: Value,
}

/// Rad returnert av `get_class`/`get_classes` - `students` er den RÅ
/// TEXT-kolonneverdien (eller `None` for SQL NULL), IKKE parset til en
/// `serde_json::Value`. Dette speiler den gamle Electron/sql.js-kontrakten:
/// backend håndterer aldri innholdet, bare returnerer strengen som ble
/// lagret, og frontend gjør selv `JSON.parse(cls.students)`.
///
/// VIKTIG BUG DETTE FIKSER: da `students` var typet `Value` og
/// `decode_students` PARSET kolonneteksten til et objekt/array, serialiserte
/// Tauri responsen som et ekte JS-objekt - ikke en streng. Frontend sitt
/// `JSON.parse(cls.students)` kastet da en TypeError (kan ikke parse et
/// objekt), som ble fanget av try/catch-blokker og falt stille tilbake til
/// en tom liste. Resultat: elevnavn "forsvant" ved navigering bort og
/// tilbake, selv om lagringen i seg selv fungerte fint.
///
/// `ClassRecord` (over) beholdes uendret for `save_class`-inputen, siden
/// frontend fortsatt kan sende `students` som et ekte array/objekt (ikke
/// bare streng) når den lagrer - se `encode_students`.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ClassReadRecord {
  pub id: Option<i64>,
  pub name: String,
  pub students: Option<String>,
}

/// Speiler JS sin `typeof students === 'string' ? students : JSON.stringify(students)`.
///
/// Hvis `students` allerede ER en JSON-streng-verdi, brukes strengens
/// INNHOLD direkte (uten de omsluttende anførselstegnene JSON.stringify ville
/// lagt til) - den antas å allerede være gyldig, ferdig-serialisert JSON.
/// For alt annet (array, object, tall, bool, null) serialiseres HELE verdien
/// til en JSON-streng.
fn encode_students(students: &Value) -> String {
  match students {
    Value::String(s) => s.clone(),
    other => serde_json::to_string(other).expect("serialisering av serde_json::Value kan ikke feile"),
  }
}

/// Leser `students`-TEXT-kolonnen tilbake for READ-veien (`get_class(es)`).
///
/// INGEN parsing/validering skjer her - dette er et ren pass-through av den
/// rå kolonneteksten, akkurat som den gamle Electron/sql.js `dbAll`/`dbGet`
/// alltid ga frontend den rå TEXT-strengen og lot FRONTEND selv gjøre
/// `JSON.parse` (med sin egen try/catch for korrupt data).
///
/// - `NULL` i databasen -> `None` (serialiseres til JSON `null`, speiler hva
///   en NULL SQL-verdi ville blitt i JS: `null`).
/// - Enhver ikke-NULL kolonneverdi - inkludert eventuelt korrupt/ugyldig
///   JSON-tekst - returneres AS-IS. Vi validerer/parser IKKE på Rust-siden;
///   det ville risikert å stille transformere/miste data på en måte den
///   gamle appen aldri gjorde.
fn decode_students(raw: Option<String>) -> Option<String> {
  raw
}

fn row_to_class(row: &rusqlite::Row) -> rusqlite::Result<ClassReadRecord> {
  Ok(ClassReadRecord {
    id: row.get(0)?,
    name: row.get(1)?,
    students: decode_students(row.get(2)?),
  })
}

pub fn get_classes_impl(conn: &Connection) -> rusqlite::Result<Vec<ClassReadRecord>> {
  let mut stmt = conn.prepare("SELECT id, name, students FROM classes ORDER BY name ASC")?;
  let rows = stmt.query_map([], row_to_class)?;
  rows.collect()
}

pub fn get_class_impl(conn: &Connection, id: i64) -> rusqlite::Result<Option<ClassReadRecord>> {
  conn
    .query_row(
      "SELECT id, name, students FROM classes WHERE id = ?1",
      [id],
      row_to_class,
    )
    .optional()
}

/// Insert (id == None) eller update (id == Some) av en klasse. Returnerer
/// radens id (den eksisterende ved update, den nye autoinkrementerte ved
/// insert) - speiler at frontend etterpå kan referere til klassen uansett
/// hvilken gren som ble tatt.
pub fn save_class_impl(conn: &Connection, record: &ClassRecord) -> rusqlite::Result<i64> {
  let students_json = encode_students(&record.students);

  match record.id {
    Some(id) => {
      conn.execute(
        "UPDATE classes SET name = ?1, students = ?2 WHERE id = ?3",
        rusqlite::params![record.name, students_json, id],
      )?;
      Ok(id)
    }
    None => {
      conn.execute(
        "INSERT INTO classes (name, students) VALUES (?1, ?2)",
        rusqlite::params![record.name, students_json],
      )?;
      Ok(conn.last_insert_rowid())
    }
  }
}

/// Kaskaderende sletting av en klasse og alt tilhørende data på tvers av 8
/// tabeller. Speiler `delete-class`-IPC-handleren i src/ipc-handlers.js:
///
/// 1. Samle alle `seatings.id` for klassen.
/// 2. For hver seating: slett `participation_logs` (via `seating_id`) og
///    `seating_history` (via `chart_id` - IKKE `seating_id`, dette er en
///    reell forskjell i kildekoden).
/// 3. Slett `seatings` (via `class_id`), `student_constraints`,
///    `group_assignments`, `group_history`, `schedule`, `station_sessions`
///    (alle via `class_id`).
/// 4. Slett selve `classes`-raden.
///
/// FORBEDRING utover en bokstavelig port: hele operasjonen kjøres i en
/// enkelt SQLite-transaksjon for atomicitet. JS-originalen gjør ikke dette
/// eksplisitt (hvert dbRun-kall er sin egen implisitte transaksjon), så en
/// feil midtveis der kunne latt databasen i en delvis slettet tilstand.
/// Å transaksjons-wrappe her er en bevisst, strengt-bedre-enn-originalen
/// endring, ikke en avvik fra spesifikasjonen.
pub fn delete_class_impl(conn: &mut Connection, id: i64) -> rusqlite::Result<()> {
  let tx = conn.transaction()?;

  let seating_ids: Vec<i64> = {
    let mut stmt = tx.prepare("SELECT id FROM seatings WHERE class_id = ?1")?;
    let rows = stmt.query_map([id], |row| row.get(0))?;
    rows.collect::<Result<Vec<_>, _>>()?
  };

  for seating_id in &seating_ids {
    tx.execute(
      "DELETE FROM participation_logs WHERE seating_id = ?1",
      [seating_id],
    )?;
    tx.execute(
      "DELETE FROM seating_history WHERE chart_id = ?1",
      [seating_id],
    )?;
  }

  tx.execute("DELETE FROM seatings WHERE class_id = ?1", [id])?;
  tx.execute("DELETE FROM student_constraints WHERE class_id = ?1", [id])?;
  tx.execute("DELETE FROM group_assignments WHERE class_id = ?1", [id])?;
  tx.execute("DELETE FROM group_history WHERE class_id = ?1", [id])?;
  tx.execute("DELETE FROM schedule WHERE class_id = ?1", [id])?;
  tx.execute("DELETE FROM station_sessions WHERE class_id = ?1", [id])?;
  tx.execute("DELETE FROM classes WHERE id = ?1", [id])?;

  tx.commit()
}

// ---- Tauri-kommando-wrappere: låser DbState-Mutex-en og delegerer til *_impl ----

#[tauri::command]
pub fn get_classes(state: State<DbState>) -> Result<Vec<ClassReadRecord>, String> {
  let conn = state.0.lock().map_err(|e| e.to_string())?;
  get_classes_impl(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_class(state: State<DbState>, id: i64) -> Result<Option<ClassReadRecord>, String> {
  let conn = state.0.lock().map_err(|e| e.to_string())?;
  get_class_impl(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_class(state: State<DbState>, record: ClassRecord) -> Result<SaveResult, String> {
  let conn = state.0.lock().map_err(|e| e.to_string())?;
  save_class_impl(&conn, &record)
    .map(SaveResult::new)
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_class(state: State<DbState>, id: i64) -> Result<(), String> {
  let mut conn = state.0.lock().map_err(|e| e.to_string())?;
  delete_class_impl(&mut conn, id).map_err(|e| e.to_string())
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
  fn get_classes_on_empty_db_returns_empty_vec() {
    let conn = setup();
    let classes = get_classes_impl(&conn).unwrap();
    assert!(classes.is_empty());
  }

  #[test]
  fn get_classes_returns_rows_ordered_by_name_asc() {
    let conn = setup();
    conn
      .execute_batch(
        "INSERT INTO classes (name, students) VALUES ('Charlie', '[]');
         INSERT INTO classes (name, students) VALUES ('Alice', '[]');
         INSERT INTO classes (name, students) VALUES ('Bob', '[]');",
      )
      .unwrap();

    let classes = get_classes_impl(&conn).unwrap();
    let names: Vec<&str> = classes.iter().map(|c| c.name.as_str()).collect();
    assert_eq!(names, vec!["Alice", "Bob", "Charlie"]);
  }

  #[test]
  fn class_record_deserializes_when_id_key_is_entirely_absent_from_payload() {
    // Regresjonstest for bug: frontend sin "Opprett ny klasse"-payload
    // inkluderte ikke "id"-nøkkelen i det hele tatt (til forskjell fra
    // `{"id": null, ...}` som resten av appens create-kall bruker), noe som
    // uten `#[serde(default)]` på `ClassRecord.id` fikk Tauri sin IPC-
    // deserialisering til å feile med "missing field `id`" - vist til
    // brukeren som "Kunne ikke opprette ny klasse".
    let json = r#"{"name":"Ny klasse","students":"{\"students\":[],\"rules\":[]}"}"#;
    let record: ClassRecord = serde_json::from_str(json).unwrap();
    assert_eq!(record.id, None);
    assert_eq!(record.name, "Ny klasse");
  }

  #[test]
  fn save_class_with_no_id_inserts_and_returns_new_id() {
    let conn = setup();
    let record = ClassRecord {
      id: None,
      name: "New Class".to_string(),
      students: serde_json::json!([]),
    };
    let id = save_class_impl(&conn, &record).unwrap();
    assert!(id > 0);

    let fetched = get_class_impl(&conn, id).unwrap().unwrap();
    assert_eq!(fetched.name, "New Class");
  }

  #[test]
  fn save_class_with_existing_id_updates_in_place_without_duplicate() {
    let conn = setup();
    let record = ClassRecord {
      id: None,
      name: "Original".to_string(),
      students: serde_json::json!([]),
    };
    let id = save_class_impl(&conn, &record).unwrap();

    let updated = ClassRecord {
      id: Some(id),
      name: "Updated".to_string(),
      students: serde_json::json!(["Alice"]),
    };
    let returned_id = save_class_impl(&conn, &updated).unwrap();
    assert_eq!(returned_id, id);

    let all = get_classes_impl(&conn).unwrap();
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].name, "Updated");
  }

  #[test]
  fn save_class_with_array_students_stores_valid_json_not_double_encoded() {
    let conn = setup();
    let record = ClassRecord {
      id: None,
      name: "Class".to_string(),
      students: serde_json::json!(["Alice", "Bob"]),
    };
    let id = save_class_impl(&conn, &record).unwrap();

    let raw: String = conn
      .query_row("SELECT students FROM classes WHERE id = ?1", [id], |r| {
        r.get(0)
      })
      .unwrap();
    assert_eq!(raw, r#"["Alice","Bob"]"#);

    // READ path returns the raw stored string as-is (not re-parsed into an
    // object) - this is the fix for the bug where the frontend's
    // `JSON.parse(cls.students)` threw on an already-parsed object.
    let fetched = get_class_impl(&conn, id).unwrap().unwrap();
    assert_eq!(fetched.students, Some(r#"["Alice","Bob"]"#.to_string()));
    // Round-trip: the returned string actually parses back to the saved data.
    let reparsed: Value = serde_json::from_str(&fetched.students.unwrap()).unwrap();
    assert_eq!(reparsed, serde_json::json!(["Alice", "Bob"]));
  }

  #[test]
  fn save_class_with_already_stringified_students_is_not_double_encoded() {
    let conn = setup();
    // students arrives as a JSON *string value* whose content is itself a
    // JSON-encoded array - i.e. the caller already ran JSON.stringify().
    let record = ClassRecord {
      id: None,
      name: "Class".to_string(),
      students: Value::String(r#"["Alice","Bob"]"#.to_string()),
    };
    let id = save_class_impl(&conn, &record).unwrap();

    let raw: String = conn
      .query_row("SELECT students FROM classes WHERE id = ?1", [id], |r| {
        r.get(0)
      })
      .unwrap();

    // Must be stored as the raw array JSON, NOT double-encoded as
    // `"\"[\\\"Alice\\\",\\\"Bob\\\"]\""`.
    assert_eq!(raw, r#"["Alice","Bob"]"#);

    let fetched = get_class_impl(&conn, id).unwrap().unwrap();
    assert_eq!(fetched.students, Some(r#"["Alice","Bob"]"#.to_string()));
  }

  #[test]
  fn get_class_existing_and_nonexistent() {
    let conn = setup();
    let record = ClassRecord {
      id: None,
      name: "Solo".to_string(),
      students: serde_json::json!([]),
    };
    let id = save_class_impl(&conn, &record).unwrap();

    let found = get_class_impl(&conn, id).unwrap();
    assert!(found.is_some());
    assert_eq!(found.unwrap().name, "Solo");

    let missing = get_class_impl(&conn, id + 9999).unwrap();
    assert!(missing.is_none());
  }

  #[test]
  fn get_class_with_null_students_decodes_to_none() {
    let conn = setup();
    conn
      .execute(
        "INSERT INTO classes (name, students) VALUES ('NullStudents', NULL)",
        [],
      )
      .unwrap();
    let id = conn.last_insert_rowid();

    let fetched = get_class_impl(&conn, id).unwrap().unwrap();
    assert_eq!(fetched.students, None);
    // Confirm it actually serializes to JSON `null`, matching the old
    // Electron/sql.js NULL -> JS `null` contract.
    let json = serde_json::to_value(&fetched).unwrap();
    assert_eq!(json["students"], serde_json::Value::Null);
  }

  #[test]
  fn get_class_with_malformed_students_json_passes_through_as_is() {
    let conn = setup();
    conn
      .execute(
        "INSERT INTO classes (name, students) VALUES ('Malformed', 'not valid json{{{')",
        [],
      )
      .unwrap();
    let id = conn.last_insert_rowid();

    // No parsing/validation on the read path - the raw (possibly corrupt)
    // stored text is handed back verbatim, exactly like the old app did.
    let fetched = get_class_impl(&conn, id).unwrap().unwrap();
    assert_eq!(fetched.students, Some("not valid json{{{".to_string()));
  }

  #[test]
  fn delete_class_cascades_across_all_related_tables() {
    let mut conn = setup();

    conn
      .execute("INSERT INTO classes (name, students) VALUES ('C', '[]')", [])
      .unwrap();
    let class_id = conn.last_insert_rowid();

    conn
      .execute(
        "INSERT INTO seatings (name, class_id) VALUES ('S', ?1)",
        [class_id],
      )
      .unwrap();
    let seating_id = conn.last_insert_rowid();

    conn
      .execute(
        "INSERT INTO participation_logs (seating_id, student_id, date, events) VALUES (?1, 'stud-1', '2024-01-01', '[]')",
        [seating_id],
      )
      .unwrap();

    conn
      .execute(
        "INSERT INTO seating_history (class_id, chart_id, pairs) VALUES (?1, ?2, '[]')",
        rusqlite::params![class_id, seating_id],
      )
      .unwrap();

    conn
      .execute(
        "INSERT INTO student_constraints (class_id, student_a, student_b, type) VALUES (?1, 'a', 'b', 'avoid')",
        [class_id],
      )
      .unwrap();

    conn
      .execute(
        "INSERT INTO group_assignments (name, class_id) VALUES ('GA', ?1)",
        [class_id],
      )
      .unwrap();

    conn
      .execute(
        "INSERT INTO group_history (class_id, pairs) VALUES (?1, '[]')",
        [class_id],
      )
      .unwrap();

    conn
      .execute(
        "INSERT INTO schedule (class_id, weekday, period) VALUES (?1, 1, 1)",
        [class_id],
      )
      .unwrap();

    conn
      .execute(
        "INSERT INTO station_sessions (name, class_id) VALUES ('SS', ?1)",
        [class_id],
      )
      .unwrap();

    delete_class_impl(&mut conn, class_id).unwrap();

    let count = |table: &str, col: &str| -> i64 {
      conn
        .query_row(
          &format!("SELECT COUNT(*) FROM {table} WHERE {col} = ?1"),
          [class_id],
          |r| r.get(0),
        )
        .unwrap()
    };

    assert_eq!(count("classes", "id"), 0);
    assert_eq!(count("seatings", "class_id"), 0);
    assert_eq!(count("student_constraints", "class_id"), 0);
    assert_eq!(count("group_assignments", "class_id"), 0);
    assert_eq!(count("group_history", "class_id"), 0);
    assert_eq!(count("schedule", "class_id"), 0);
    assert_eq!(count("station_sessions", "class_id"), 0);

    let participation_count: i64 = conn
      .query_row(
        "SELECT COUNT(*) FROM participation_logs WHERE seating_id = ?1",
        [seating_id],
        |r| r.get(0),
      )
      .unwrap();
    assert_eq!(participation_count, 0);

    let seating_history_count: i64 = conn
      .query_row(
        "SELECT COUNT(*) FROM seating_history WHERE chart_id = ?1",
        [seating_id],
        |r| r.get(0),
      )
      .unwrap();
    assert_eq!(seating_history_count, 0);
  }

  #[test]
  fn save_class_command_return_shape_serializes_as_last_id_and_changes() {
    let conn = setup();
    let record = ClassRecord {
      id: None,
      name: "Wrapped".to_string(),
      students: serde_json::json!([]),
    };
    let id = save_class_impl(&conn, &record).unwrap();
    let wrapped = SaveResult::new(id);

    let json = serde_json::to_value(wrapped).unwrap();
    assert_eq!(json, serde_json::json!({"lastID": id, "changes": 1}));
  }

  #[test]
  fn delete_class_with_no_related_rows_succeeds() {
    let mut conn = setup();
    conn
      .execute(
        "INSERT INTO classes (name, students) VALUES ('Lonely', '[]')",
        [],
      )
      .unwrap();
    let class_id = conn.last_insert_rowid();

    let result = delete_class_impl(&mut conn, class_id);
    assert!(result.is_ok());

    let count: i64 = conn
      .query_row("SELECT COUNT(*) FROM classes WHERE id = ?1", [class_id], |r| {
        r.get(0)
      })
      .unwrap();
    assert_eq!(count, 0);
  }
}
