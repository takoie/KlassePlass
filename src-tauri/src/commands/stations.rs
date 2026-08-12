// CRUD Tauri-kommandoer for `station_sessions`.
//
// Port av src/ipc-handlers.js sine get-station-sessions/get-station-session/
// save-station-session/delete-station-session IPC-handlere (linje 266-296).
// Følger mønsteret etablert i classes.rs (Task 2.1)/rooms.rs/seatings.rs.
//
// Kommandonavnet `get_station_sessions` er valgt fremfor det plan-tabellen
// kalte "get_station_session_list" - det matcher den faktiske IPC-kanalen
// (`get-station-sessions`) mer direkte.
//
// VIKTIG (stations/groups/group_leaders/rotation_plan - IKKE
// streng-passthrough PÅ SKRIVE-VEIEN): Samme regel som leader_ids/locked_ids
// i groups.rs - JS-originalen kjører ALLTID `JSON.stringify(value ?? [])`
// ubetinget for disse feltene, ALDRI en `typeof x === 'string'`-sjekk på
// SKRIVE-veien. Vi speiler dette med `json_field::encode_json_field`. Se
// json_field.rs og groups.rs for full begrunnelse.
//
// VIKTIG (LESE-veien ER rå streng-passthrough, samme bug-klasse som
// classes.rs/rooms.rs/seatings.rs/groups.rs): Frontend gjør derimot ALLTID
// selv `JSON.parse(...)` på disse feltene når den LESER dem tilbake (f.eks.
// `JSON.parse(s.stations || '[]')` i StationPresenter.jsx/StationSetup.jsx/
// StationOverview.jsx). Disse feltene var tidligere typet `Value` og PARSET
// via `decode_json_field` på lese-veien - det fikk `JSON.parse` på frontend
// til å kaste en TypeError på et allerede-parset objekt, fanget av
// try/catch og stille erstattet med en tom liste/array. `StationSessionRecord`/
// `StationSessionListItem` (LESE-strukturene under) har derfor feltene typet
// `Option<String>` og lest rått via `row.get(...)` - INGEN decode-wrapper.
// `StationSessionInput` (SKRIVE-strukturen) er UENDRET av denne fiksen.
//
// VIKTIG (save-station-session - BEVART QUIRK, samme som seatings.rs):
// UPDATE-grenen (id er Some) setter KUN name/stations/groups/group_leaders/
// rotation_plan/minutes_per_station/seconds_per_station/no_timer. Den rører
// ALDRI `class_id` - kun INSERT-grenen (id er None) setter den. Vi porterer
// denne atferden bokstavelig.
//
// `minutesPerStation ?? 10` og `secondsPerStation ?? 0` er tallmessige
// defaultverdier som gjelder på BÅDE insert- og update-grenen (i motsetning
// til de streng-serialiserte JSON-feltene, som alltid stringifies friskt uten
// en slik "hvis mangler, bruk X"-fallback FØR JSON.stringify - her derimot ER
// selve default-verdien for tallet det som skal lagres).

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use super::json_field::encode_json_field;
use super::save_result::SaveResult;
use crate::db::DbState;

/// Rad returnert av `get_station_session` (SINGULAR-visningen) -
/// `stations`/`groups`/`rotation_plan`/`group_leaders` er de RÅ
/// TEXT-kolonneverdiene (eller `None` for SQL NULL), IKKE parset til en
/// `serde_json::Value`. Se modul-doc for full begrunnelse (samme bug-klasse
/// som classes.rs::ClassReadRecord/groups.rs::GroupAssignmentRecord).
/// INGEN `#[serde(rename_all = "camelCase")]` her - se rooms.rs::RoomReadRecord
/// for full begrunnelse (samme bug-klasse, samme fiks): frontend leser
/// `class_id`/`created_at`/`teacher_station_id`/`group_leaders`/`no_timer`/
/// osv. (snake_case) rått fra respons-objektet.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct StationSessionRecord {
  pub id: i64,
  pub name: String,
  pub class_id: i64,
  pub stations: Option<String>,
  pub groups: Option<String>,
  pub rotation_plan: Option<String>,
  pub minutes_per_station: Option<i64>,
  pub created_at: Option<String>,
  pub teacher_station_id: Option<i64>,
  pub group_leaders: Option<String>,
  pub seconds_per_station: Option<i64>,
  pub no_timer: i64,
}

/// Rad returnert av `get_station_sessions` (LIST-visningen) - inkluderer
/// LEFT JOIN-et `class_name`, som ikke finnes på `get_station_session`
/// (SINGULAR-visningen). `stations`/`groups`/`rotation_plan`/`group_leaders`
/// er rå TEXT-passthrough, se `StationSessionRecord`.
/// INGEN `#[serde(rename_all = "camelCase")]` her - se `StationSessionRecord` over.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct StationSessionListItem {
  pub id: i64,
  pub name: String,
  pub class_id: i64,
  pub stations: Option<String>,
  pub groups: Option<String>,
  pub rotation_plan: Option<String>,
  pub minutes_per_station: Option<i64>,
  pub created_at: Option<String>,
  pub teacher_station_id: Option<i64>,
  pub group_leaders: Option<String>,
  pub seconds_per_station: Option<i64>,
  pub no_timer: i64,
  pub class_name: Option<String>,
}

/// Input-payload for `save_station_session`. `id: None` -> insert,
/// `id: Some(_)` -> update (som IKKE rører class_id, se modul-doc).
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StationSessionInput {
  pub id: Option<i64>,
  pub name: String,
  /// Kun brukt av INSERT-grenen.
  pub class_id: Option<i64>,
  #[serde(default)]
  pub stations: Option<Value>,
  #[serde(default)]
  pub groups: Option<Value>,
  #[serde(default)]
  pub group_leaders: Option<Value>,
  #[serde(default)]
  pub rotation_plan: Option<Value>,
  #[serde(default)]
  pub minutes_per_station: Option<i64>,
  #[serde(default)]
  pub seconds_per_station: Option<i64>,
  #[serde(default)]
  pub no_timer: bool,
}

fn row_to_station_session(row: &rusqlite::Row) -> rusqlite::Result<StationSessionRecord> {
  Ok(StationSessionRecord {
    id: row.get(0)?,
    name: row.get(1)?,
    class_id: row.get(2)?,
    stations: row.get(3)?,
    groups: row.get(4)?,
    rotation_plan: row.get(5)?,
    minutes_per_station: row.get(6)?,
    created_at: row.get(7)?,
    teacher_station_id: row.get(8)?,
    group_leaders: row.get(9)?,
    seconds_per_station: row.get(10)?,
    no_timer: row.get(11)?,
  })
}

fn row_to_station_session_list_item(row: &rusqlite::Row) -> rusqlite::Result<StationSessionListItem> {
  Ok(StationSessionListItem {
    id: row.get(0)?,
    name: row.get(1)?,
    class_id: row.get(2)?,
    stations: row.get(3)?,
    groups: row.get(4)?,
    rotation_plan: row.get(5)?,
    minutes_per_station: row.get(6)?,
    created_at: row.get(7)?,
    teacher_station_id: row.get(8)?,
    group_leaders: row.get(9)?,
    seconds_per_station: row.get(10)?,
    no_timer: row.get(11)?,
    class_name: row.get(12)?,
  })
}

const STATION_SESSION_COLUMNS: &str = "id, name, class_id, stations, groups, rotation_plan, \
   minutes_per_station, created_at, teacher_station_id, group_leaders, seconds_per_station, no_timer";

const STATION_SESSION_LIST_SELECT: &str = "SELECT ss.id, ss.name, ss.class_id, ss.stations, ss.groups, \
   ss.rotation_plan, ss.minutes_per_station, ss.created_at, ss.teacher_station_id, ss.group_leaders, \
   ss.seconds_per_station, ss.no_timer, c.name as class_name \
   FROM station_sessions ss \
   LEFT JOIN classes c ON ss.class_id = c.id";

/// `class_id: None` -> alle station_sessions (fortsatt med JOIN),
/// `Some(id)` -> filtrert på den klassen. Begge grener sorterer på
/// `created_at DESC`.
pub fn get_station_sessions_impl(
  conn: &Connection,
  class_id: Option<i64>,
) -> rusqlite::Result<Vec<StationSessionListItem>> {
  match class_id {
    Some(cid) => {
      let sql = format!("{STATION_SESSION_LIST_SELECT} WHERE ss.class_id = ?1 ORDER BY ss.created_at DESC");
      let mut stmt = conn.prepare(&sql)?;
      let rows = stmt.query_map([cid], row_to_station_session_list_item)?;
      rows.collect()
    }
    None => {
      let sql = format!("{STATION_SESSION_LIST_SELECT} ORDER BY ss.created_at DESC");
      let mut stmt = conn.prepare(&sql)?;
      let rows = stmt.query_map([], row_to_station_session_list_item)?;
      rows.collect()
    }
  }
}

pub fn get_station_session_impl(
  conn: &Connection,
  id: i64,
) -> rusqlite::Result<Option<StationSessionRecord>> {
  let sql = format!("SELECT {STATION_SESSION_COLUMNS} FROM station_sessions WHERE id = ?1");
  conn.query_row(&sql, [id], row_to_station_session).optional()
}

/// Insert (id == None) eller update (id == Some) av en station_session.
///
/// BEVART QUIRK: UPDATE-grenen setter IKKE class_id - kun INSERT-grenen gjør
/// det (samme kvirk som save_seating_impl i seatings.rs).
///
/// BEVART: stations/groups/group_leaders/rotation_plan stringifies ALLTID
/// friskt via `json_field::encode_json_field` - ALDRI streng-passthrough.
pub fn save_station_session_impl(
  conn: &Connection,
  input: &StationSessionInput,
) -> rusqlite::Result<i64> {
  let stations_json = encode_json_field(input.stations.as_ref());
  let groups_json = encode_json_field(input.groups.as_ref());
  let group_leaders_json = encode_json_field(input.group_leaders.as_ref());
  let rotation_plan_json = encode_json_field(input.rotation_plan.as_ref());
  let minutes = input.minutes_per_station.unwrap_or(10);
  let seconds = input.seconds_per_station.unwrap_or(0);
  let no_timer = input.no_timer as i64;

  match input.id {
    Some(id) => {
      conn.execute(
        "UPDATE station_sessions SET name = ?1, stations = ?2, groups = ?3, group_leaders = ?4, \
         rotation_plan = ?5, minutes_per_station = ?6, seconds_per_station = ?7, no_timer = ?8 \
         WHERE id = ?9",
        rusqlite::params![
          input.name,
          stations_json,
          groups_json,
          group_leaders_json,
          rotation_plan_json,
          minutes,
          seconds,
          no_timer,
          id
        ],
      )?;
      Ok(id)
    }
    None => {
      conn.execute(
        "INSERT INTO station_sessions (name, class_id, stations, groups, group_leaders, \
         rotation_plan, minutes_per_station, seconds_per_station, no_timer) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
          input.name,
          input.class_id,
          stations_json,
          groups_json,
          group_leaders_json,
          rotation_plan_json,
          minutes,
          seconds,
          no_timer
        ],
      )?;
      Ok(conn.last_insert_rowid())
    }
  }
}

pub fn delete_station_session_impl(conn: &Connection, id: i64) -> rusqlite::Result<()> {
  conn.execute("DELETE FROM station_sessions WHERE id = ?1", [id])?;
  Ok(())
}

// ---- Tauri-kommando-wrappere: låser DbState-Mutex-en og delegerer til *_impl ----

#[tauri::command]
pub fn get_station_sessions(
  state: State<DbState>,
  class_id: Option<i64>,
) -> Result<Vec<StationSessionListItem>, String> {
  let conn = state.0.lock().map_err(|e| e.to_string())?;
  get_station_sessions_impl(&conn, class_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_station_session(
  state: State<DbState>,
  id: i64,
) -> Result<Option<StationSessionRecord>, String> {
  let conn = state.0.lock().map_err(|e| e.to_string())?;
  get_station_session_impl(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_station_session(
  state: State<DbState>,
  input: StationSessionInput,
) -> Result<SaveResult, String> {
  let conn = state.0.lock().map_err(|e| e.to_string())?;
  save_station_session_impl(&conn, &input)
    .map(SaveResult::new)
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_station_session(state: State<DbState>, id: i64) -> Result<(), String> {
  let conn = state.0.lock().map_err(|e| e.to_string())?;
  delete_station_session_impl(&conn, id).map_err(|e| e.to_string())
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

  fn base_input(class_id: i64) -> StationSessionInput {
    StationSessionInput {
      id: None,
      name: "Session".to_string(),
      class_id: Some(class_id),
      stations: None,
      groups: None,
      group_leaders: None,
      rotation_plan: None,
      minutes_per_station: None,
      seconds_per_station: None,
      no_timer: false,
    }
  }

  #[test]
  fn get_station_sessions_on_empty_db_returns_empty_vec() {
    let conn = setup();
    let sessions = get_station_sessions_impl(&conn, None).unwrap();
    assert!(sessions.is_empty());
  }

  #[test]
  fn save_station_session_insert_returns_new_id_and_persists_fields() {
    let conn = setup();
    let class_id = insert_class(&conn, "Class A");

    let mut input = base_input(class_id);
    input.stations = Some(serde_json::json!([{"id": 1, "name": "Station 1"}]));
    input.groups = Some(serde_json::json!([["s1", "s2"]]));
    input.group_leaders = Some(serde_json::json!(["s1"]));
    input.rotation_plan = Some(serde_json::json!([[1, 2]]));
    input.minutes_per_station = Some(15);
    input.seconds_per_station = Some(30);
    input.no_timer = true;

    let id = save_station_session_impl(&conn, &input).unwrap();
    assert!(id > 0);

    // READ path returns the raw stored strings as-is (not re-parsed into
    // objects) - this is the fix for the bug where the frontend's
    // `JSON.parse(s.stations || '[]')` etc. threw on an already-parsed
    // object.
    let fetched = get_station_session_impl(&conn, id).unwrap().unwrap();
    assert_eq!(fetched.name, "Session");
    assert_eq!(fetched.class_id, class_id);
    assert_eq!(fetched.stations, Some(r#"[{"id":1,"name":"Station 1"}]"#.to_string()));
    assert_eq!(fetched.groups, Some(r#"[["s1","s2"]]"#.to_string()));
    assert_eq!(fetched.group_leaders, Some(r#"["s1"]"#.to_string()));
    assert_eq!(fetched.rotation_plan, Some(r#"[[1,2]]"#.to_string()));
    assert_eq!(fetched.minutes_per_station, Some(15));
    assert_eq!(fetched.seconds_per_station, Some(30));
    assert_eq!(fetched.no_timer, 1);
    // Round-trip: the returned strings actually parse back to the saved data.
    let reparsed_stations: Value = serde_json::from_str(fetched.stations.as_ref().unwrap()).unwrap();
    assert_eq!(reparsed_stations, serde_json::json!([{"id": 1, "name": "Station 1"}]));
    let reparsed_groups: Value = serde_json::from_str(fetched.groups.as_ref().unwrap()).unwrap();
    assert_eq!(reparsed_groups, serde_json::json!([["s1", "s2"]]));
  }

  #[test]
  fn save_station_session_command_return_shape_serializes_as_last_id_and_changes() {
    let conn = setup();
    let class_id = insert_class(&conn, "Class A");
    let id = save_station_session_impl(&conn, &base_input(class_id)).unwrap();
    let wrapped = SaveResult::new(id);

    let json = serde_json::to_value(wrapped).unwrap();
    assert_eq!(json, serde_json::json!({"lastID": id, "changes": 1}));
  }

  #[test]
  fn save_station_session_numeric_defaults_apply_when_omitted() {
    let conn = setup();
    let class_id = insert_class(&conn, "Class A");
    let input = base_input(class_id); // minutes/seconds: None

    let id = save_station_session_impl(&conn, &input).unwrap();
    let fetched = get_station_session_impl(&conn, id).unwrap().unwrap();
    assert_eq!(fetched.minutes_per_station, Some(10));
    assert_eq!(fetched.seconds_per_station, Some(0));
    assert_eq!(fetched.no_timer, 0);
  }

  #[test]
  fn save_station_session_json_fields_default_to_empty_array_when_omitted() {
    let conn = setup();
    let class_id = insert_class(&conn, "Class A");
    let input = base_input(class_id); // stations/groups/group_leaders/rotation_plan: None

    let id = save_station_session_impl(&conn, &input).unwrap();
    let fetched = get_station_session_impl(&conn, id).unwrap().unwrap();
    assert_eq!(fetched.stations, Some("[]".to_string()));
    assert_eq!(fetched.groups, Some("[]".to_string()));
    assert_eq!(fetched.group_leaders, Some("[]".to_string()));
    assert_eq!(fetched.rotation_plan, Some("[]".to_string()));
  }

  #[test]
  fn get_station_session_with_null_group_leaders_decodes_to_none() {
    // NB: `stations`/`groups`/`rotation_plan` are `TEXT NOT NULL DEFAULT '[]'`
    // in the schema (can never actually be SQL NULL), but `group_leaders` was
    // added later via a plain `ADD COLUMN ... TEXT DEFAULT '[]'` (nullable) -
    // see schema.rs. So this is the only one of the four JSON-blob fields
    // that can genuinely be NULL in the database.
    let conn = setup();
    let class_id = insert_class(&conn, "Class A");
    conn
      .execute(
        "INSERT INTO station_sessions (name, class_id, group_leaders) VALUES ('NullFields', ?1, NULL)",
        [class_id],
      )
      .unwrap();
    let id = conn.last_insert_rowid();

    let fetched = get_station_session_impl(&conn, id).unwrap().unwrap();
    assert_eq!(fetched.group_leaders, None);
    let json = serde_json::to_value(&fetched).unwrap();
    assert_eq!(json["groupLeaders"], serde_json::Value::Null);
  }

  #[test]
  fn get_station_session_with_malformed_json_fields_passes_through_as_is() {
    let conn = setup();
    let class_id = insert_class(&conn, "Class A");
    conn
      .execute(
        "INSERT INTO station_sessions (name, class_id, stations, groups, group_leaders, rotation_plan) \
         VALUES ('Malformed', ?1, 'not valid json{{{', '[]', '[]', '[]')",
        [class_id],
      )
      .unwrap();
    let id = conn.last_insert_rowid();

    let fetched = get_station_session_impl(&conn, id).unwrap().unwrap();
    assert_eq!(fetched.stations, Some("not valid json{{{".to_string()));
  }

  #[test]
  fn get_station_sessions_list_returns_raw_json_field_strings_not_parsed_values() {
    let conn = setup();
    let class_id = insert_class(&conn, "Class A");
    let mut input = base_input(class_id);
    input.stations = Some(serde_json::json!([{"id": 1}]));
    input.groups = Some(serde_json::json!([["s1"]]));
    save_station_session_impl(&conn, &input).unwrap();

    let list = get_station_sessions_impl(&conn, None).unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].stations, Some(r#"[{"id":1}]"#.to_string()));
    assert_eq!(list[0].groups, Some(r#"[["s1"]]"#.to_string()));
  }

  #[test]
  fn save_station_session_update_does_not_touch_class_id() {
    let conn = setup();
    let class_1 = insert_class(&conn, "Class 1");
    let class_2 = insert_class(&conn, "Class 2");

    let input = base_input(class_1);
    let id = save_station_session_impl(&conn, &input).unwrap();

    let mut update = base_input(class_2); // attempt to "move" the session
    update.id = Some(id);
    update.name = "Renamed".to_string();
    let returned_id = save_station_session_impl(&conn, &update).unwrap();
    assert_eq!(returned_id, id);

    let fetched = get_station_session_impl(&conn, id).unwrap().unwrap();
    assert_eq!(fetched.name, "Renamed");
    // class_id did NOT change - still pointing at the original class.
    assert_eq!(fetched.class_id, class_1);
  }

  #[test]
  fn save_station_session_update_persists_all_updatable_fields() {
    let conn = setup();
    let class_id = insert_class(&conn, "Class A");
    let id = save_station_session_impl(&conn, &base_input(class_id)).unwrap();

    let mut update = base_input(class_id);
    update.id = Some(id);
    update.name = "Updated".to_string();
    update.stations = Some(serde_json::json!(["a"]));
    update.groups = Some(serde_json::json!(["b"]));
    update.group_leaders = Some(serde_json::json!(["c"]));
    update.rotation_plan = Some(serde_json::json!(["d"]));
    update.minutes_per_station = Some(20);
    update.seconds_per_station = Some(45);
    update.no_timer = true;

    save_station_session_impl(&conn, &update).unwrap();

    let fetched = get_station_session_impl(&conn, id).unwrap().unwrap();
    assert_eq!(fetched.name, "Updated");
    assert_eq!(fetched.stations, Some(r#"["a"]"#.to_string()));
    assert_eq!(fetched.groups, Some(r#"["b"]"#.to_string()));
    assert_eq!(fetched.group_leaders, Some(r#"["c"]"#.to_string()));
    assert_eq!(fetched.rotation_plan, Some(r#"["d"]"#.to_string()));
    assert_eq!(fetched.minutes_per_station, Some(20));
    assert_eq!(fetched.seconds_per_station, Some(45));
    assert_eq!(fetched.no_timer, 1);
  }

  #[test]
  fn get_station_sessions_filters_by_class_id_and_includes_class_name() {
    let conn = setup();
    let class_a = insert_class(&conn, "Class A");
    let class_b = insert_class(&conn, "Class B");
    save_station_session_impl(&conn, &base_input(class_a)).unwrap();
    save_station_session_impl(&conn, &base_input(class_b)).unwrap();

    let all = get_station_sessions_impl(&conn, None).unwrap();
    assert_eq!(all.len(), 2);

    let filtered = get_station_sessions_impl(&conn, Some(class_a)).unwrap();
    assert_eq!(filtered.len(), 1);
    assert_eq!(filtered[0].class_id, class_a);
    assert_eq!(filtered[0].class_name.as_deref(), Some("Class A"));
  }

  #[test]
  fn get_station_session_existing_and_nonexistent() {
    let conn = setup();
    let class_id = insert_class(&conn, "Class A");
    let id = save_station_session_impl(&conn, &base_input(class_id)).unwrap();

    let found = get_station_session_impl(&conn, id).unwrap();
    assert!(found.is_some());

    let missing = get_station_session_impl(&conn, id + 9999).unwrap();
    assert!(missing.is_none());
  }

  #[test]
  fn delete_station_session_removes_the_row() {
    let conn = setup();
    let class_id = insert_class(&conn, "Class A");
    let id = save_station_session_impl(&conn, &base_input(class_id)).unwrap();

    delete_station_session_impl(&conn, id).unwrap();

    let found = get_station_session_impl(&conn, id).unwrap();
    assert!(found.is_none());
  }
}
