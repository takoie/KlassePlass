// CRUD Tauri-kommandoer for `group_assignments`, `group_assignment_groups` og
// `group_history`.
//
// Port av src/ipc-handlers.js sine get-group-assignments/get-group-assignment/
// save-group-assignment/delete-group-assignment/get-group-assignment-groups/
// get-group-history/save-group-history IPC-handlere (linje 131-183). Følger
// mønsteret etablert i classes.rs (Task 2.1)/rooms.rs/seatings.rs.
//
// VIKTIG (leader_ids/locked_ids/student_ids/pairs - IKKE streng-passthrough
// PÅ SKRIVE-VEIEN): I motsetning til `students`/`layout_data`/`placements`
// (classes.rs/rooms.rs/seatings.rs), gjør JS-originalen ALDRI en
// `typeof x === 'string'`-sjekk for disse feltene på SKRIVE-veien. Den
// kjører ubetinget `JSON.stringify(value ?? [])`. Vi speiler dette med
// `json_field::encode_json_field`, IKKE med et passthrough-mønster. Se
// json_field.rs for full begrunnelse.
//
// VIKTIG (LESE-veien ER rå streng-passthrough, samme bug-klasse som
// classes.rs/rooms.rs/seatings.rs): Frontend gjør derimot ALLTID selv
// `JSON.parse(...)` på disse feltene når den LESER dem tilbake (f.eks.
// `JSON.parse(assignment.leader_ids || '[]')` i GroupEditor.jsx). Disse
// feltene var tidligere typet `Value` og PARSET via `decode_json_field` på
// lese-veien - det fikk `JSON.parse` på frontend til å kaste en TypeError på
// et allerede-parset objekt, fanget av try/catch og stille erstattet med en
// tom liste. `GroupAssignmentRecord`/`GroupAssignmentListItem`/
// `GroupAssignmentGroupRecord`/`GroupHistoryRecord` (LESE-strukturene under)
// har derfor feltene typet `Option<String>` og lest rått via `row.get(...)`
// - INGEN decode-wrapper. `GroupAssignmentInput`/`GroupHistoryInput`
// (SKRIVE-strukturene) er UENDRET av denne fiksen.
//
// VIKTIG (save-group-assignment - parent+children i ÉN transaksjon):
// JS-originalen gjør et upsert av parent-raden (`group_assignments`) PLUSS et
// full-replace av child-radene (`group_assignment_groups`): ved update
// slettes ALLE eksisterende children først, deretter settes de nye inn fra
// payloadens `groups`-array; ved insert settes de nye barna inn direkte etter
// at parent-id er kjent. Dette wrappes i en enkelt SQLite-transaksjon her -
// en delvis feil (f.eks. parent oppdateres men child-insert feiler) ville
// ellers latt databasen i en inkonsistent tilstand. `groups ?? []` betyr at
// et fraværende/null `groups`-felt behandles som et tomt array (ingen
// children settes inn / full-replace resulterer i null children).
//
// VIKTIG (get-group-assignments vs get-group-assignment - to ulike
// respons-former): LIST-varianten (`get_group_assignments`) inkluderer en
// beregnet `group_count`-subquery-kolonne og en `class_name` LEFT JOIN.
// SINGULAR-varianten (`get_group_assignment`, ved id) er et rent
// `SELECT ...` uten joins/beregnede kolonner. Speiler
// SeatingRecord/SeatingListItem-splitten fra seatings.rs.
//
// delete-group-assignment kaskaderer gjennom `group_assignment_groups` og
// `group_history` (begge via `assignment_id`) FØR parent-raden slettes -
// wrappet i en transaksjon.

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use super::json_field::encode_json_field;
use super::save_result::SaveResult;
use crate::db::DbState;

/// Rad returnert av `get_group_assignment` (SINGULAR-visningen) - `leader_ids`
/// og `locked_ids` er de RÅ TEXT-kolonneverdiene (eller `None` for SQL NULL),
/// IKKE parset til en `serde_json::Value`. Se modul-doc for full begrunnelse
/// (samme bug-klasse som classes.rs::ClassReadRecord).
/// INGEN `#[serde(rename_all = "camelCase")]` her - se rooms.rs::RoomReadRecord
/// for full begrunnelse (samme bug-klasse, samme fiks): frontend leser
/// `class_id`/`source_seating_id`/`leader_ids`/`locked_ids`/`created_at`/osv.
/// (snake_case) rått fra respons-objektet.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct GroupAssignmentRecord {
  pub id: i64,
  pub name: String,
  pub class_id: i64,
  pub source_seating_id: Option<i64>,
  pub use_constraints: i64,
  pub avoid_last_n: Option<i64>,
  pub require_leaders: i64,
  pub leader_ids: Option<String>,
  pub created_at: Option<String>,
  pub locked_ids: Option<String>,
  pub use_custom_names: i64,
}

/// Rad returnert av `get_group_assignments` (LIST-visningen) - inkluderer
/// LEFT JOIN-et `class_name` og en beregnet `group_count`-subquery-kolonne
/// som ikke finnes på `get_group_assignment` (SINGULAR-visningen).
/// `leader_ids`/`locked_ids` er rå TEXT-passthrough, se `GroupAssignmentRecord`.
/// INGEN `#[serde(rename_all = "camelCase")]` her - se `GroupAssignmentRecord` over.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct GroupAssignmentListItem {
  pub id: i64,
  pub name: String,
  pub class_id: i64,
  pub source_seating_id: Option<i64>,
  pub use_constraints: i64,
  pub avoid_last_n: Option<i64>,
  pub require_leaders: i64,
  pub leader_ids: Option<String>,
  pub created_at: Option<String>,
  pub locked_ids: Option<String>,
  pub use_custom_names: i64,
  pub class_name: Option<String>,
  pub group_count: i64,
}

/// Rad returnert av `get_group_assignment_groups` - `student_ids` er rå
/// TEXT-passthrough, se `GroupAssignmentRecord`.
/// INGEN `#[serde(rename_all = "camelCase")]` her - se `GroupAssignmentRecord` over.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct GroupAssignmentGroupRecord {
  pub id: i64,
  pub assignment_id: i64,
  pub group_number: i64,
  pub student_ids: Option<String>,
  pub group_name: Option<String>,
}

/// Rad returnert av `get_group_history` - `pairs` er rå TEXT-passthrough, se
/// `GroupAssignmentRecord`.
/// INGEN `#[serde(rename_all = "camelCase")]` her - se `GroupAssignmentRecord` over.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct GroupHistoryRecord {
  pub id: i64,
  pub class_id: i64,
  pub assignment_id: Option<i64>,
  pub pairs: Option<String>,
  pub created_at: Option<String>,
}

/// Payload for et enkelt element i `save_group_assignment`s `groups`-array.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GroupInput {
  pub group_number: i64,
  pub student_ids: Value,
  #[serde(default)]
  pub group_name: Option<String>,
}

/// Input-payload for `save_group_assignment`. `id: None` -> insert,
/// `id: Some(_)` -> update (som samtidig fullt erstatter children).
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GroupAssignmentInput {
  pub id: Option<i64>,
  pub name: String,
  /// Kun brukt av INSERT-grenen (speiler JS: UPDATE-SQL-en har ikke
  /// class_id i SET-klausulen, se save_group_assignment_impl).
  pub class_id: Option<i64>,
  #[serde(default)]
  pub source_seating_id: Option<i64>,
  #[serde(default)]
  pub use_constraints: bool,
  #[serde(default)]
  pub avoid_last_n: Option<i64>,
  #[serde(default)]
  pub require_leaders: bool,
  #[serde(default)]
  pub leader_ids: Option<Value>,
  #[serde(default)]
  pub locked_ids: Option<Value>,
  #[serde(default)]
  pub use_custom_names: bool,
  #[serde(default)]
  pub groups: Option<Vec<GroupInput>>,
}

/// Input-payload for `save_group_history`.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GroupHistoryInput {
  pub class_id: i64,
  #[serde(default)]
  pub assignment_id: Option<i64>,
  pub pairs: Value,
}

fn row_to_group_assignment(row: &rusqlite::Row) -> rusqlite::Result<GroupAssignmentRecord> {
  Ok(GroupAssignmentRecord {
    id: row.get(0)?,
    name: row.get(1)?,
    class_id: row.get(2)?,
    source_seating_id: row.get(3)?,
    use_constraints: row.get(4)?,
    avoid_last_n: row.get(5)?,
    require_leaders: row.get(6)?,
    leader_ids: row.get(7)?,
    created_at: row.get(8)?,
    locked_ids: row.get(9)?,
    use_custom_names: row.get(10)?,
  })
}

fn row_to_group_assignment_list_item(row: &rusqlite::Row) -> rusqlite::Result<GroupAssignmentListItem> {
  Ok(GroupAssignmentListItem {
    id: row.get(0)?,
    name: row.get(1)?,
    class_id: row.get(2)?,
    source_seating_id: row.get(3)?,
    use_constraints: row.get(4)?,
    avoid_last_n: row.get(5)?,
    require_leaders: row.get(6)?,
    leader_ids: row.get(7)?,
    created_at: row.get(8)?,
    locked_ids: row.get(9)?,
    use_custom_names: row.get(10)?,
    class_name: row.get(11)?,
    group_count: row.get(12)?,
  })
}

fn row_to_group_assignment_group(row: &rusqlite::Row) -> rusqlite::Result<GroupAssignmentGroupRecord> {
  Ok(GroupAssignmentGroupRecord {
    id: row.get(0)?,
    assignment_id: row.get(1)?,
    group_number: row.get(2)?,
    student_ids: row.get(3)?,
    group_name: row.get(4)?,
  })
}

fn row_to_group_history(row: &rusqlite::Row) -> rusqlite::Result<GroupHistoryRecord> {
  Ok(GroupHistoryRecord {
    id: row.get(0)?,
    class_id: row.get(1)?,
    assignment_id: row.get(2)?,
    pairs: row.get(3)?,
    created_at: row.get(4)?,
  })
}

const GROUP_ASSIGNMENT_LIST_SELECT: &str = "SELECT ga.id, ga.name, ga.class_id, ga.source_seating_id, \
   ga.use_constraints, ga.avoid_last_n, ga.require_leaders, ga.leader_ids, ga.created_at, \
   ga.locked_ids, ga.use_custom_names, c.name as class_name, \
   (SELECT COUNT(*) FROM group_assignment_groups g WHERE g.assignment_id = ga.id) as group_count \
   FROM group_assignments ga \
   LEFT JOIN classes c ON ga.class_id = c.id";

/// `class_id: None` -> alle group_assignments (fortsatt med JOIN/group_count),
/// `Some(id)` -> filtrert på den klassen. Begge grener sorterer på
/// `created_at DESC`.
pub fn get_group_assignments_impl(
  conn: &Connection,
  class_id: Option<i64>,
) -> rusqlite::Result<Vec<GroupAssignmentListItem>> {
  match class_id {
    Some(cid) => {
      let sql = format!("{GROUP_ASSIGNMENT_LIST_SELECT} WHERE ga.class_id = ?1 ORDER BY ga.created_at DESC");
      let mut stmt = conn.prepare(&sql)?;
      let rows = stmt.query_map([cid], row_to_group_assignment_list_item)?;
      rows.collect()
    }
    None => {
      let sql = format!("{GROUP_ASSIGNMENT_LIST_SELECT} ORDER BY ga.created_at DESC");
      let mut stmt = conn.prepare(&sql)?;
      let rows = stmt.query_map([], row_to_group_assignment_list_item)?;
      rows.collect()
    }
  }
}

pub fn get_group_assignment_impl(
  conn: &Connection,
  id: i64,
) -> rusqlite::Result<Option<GroupAssignmentRecord>> {
  conn
    .query_row(
      "SELECT id, name, class_id, source_seating_id, use_constraints, avoid_last_n, \
       require_leaders, leader_ids, created_at, locked_ids, use_custom_names \
       FROM group_assignments WHERE id = ?1",
      [id],
      row_to_group_assignment,
    )
    .optional()
}

/// Insert (id == None) eller update (id == Some) av en group_assignment,
/// PLUSS full-replace av dens `group_assignment_groups`-children - alt i ÉN
/// transaksjon (se modul-doc). Returnerer parent-radens id.
///
/// BEVART: leader_ids/locked_ids/student_ids stringifies ALLTID friskt via
/// `json_field::encode_json_field` - ALDRI streng-passthrough. Se modul-doc.
pub fn save_group_assignment_impl(
  conn: &mut Connection,
  input: &GroupAssignmentInput,
) -> rusqlite::Result<i64> {
  let leader_ids_json = encode_json_field(input.leader_ids.as_ref());
  let locked_ids_json = encode_json_field(input.locked_ids.as_ref());
  let use_constraints = input.use_constraints as i64;
  let require_leaders = input.require_leaders as i64;
  let use_custom_names = input.use_custom_names as i64;

  let tx = conn.transaction()?;

  let assignment_id = match input.id {
    Some(id) => {
      // BEVART QUIRK (speiler seatings.rs sin save_seating_impl): UPDATE
      // setter IKKE class_id - kun INSERT-grenen gjør det.
      tx.execute(
        "UPDATE group_assignments SET name = ?1, use_constraints = ?2, avoid_last_n = ?3, \
         require_leaders = ?4, leader_ids = ?5, locked_ids = ?6, use_custom_names = ?7 \
         WHERE id = ?8",
        rusqlite::params![
          input.name,
          use_constraints,
          input.avoid_last_n,
          require_leaders,
          leader_ids_json,
          locked_ids_json,
          use_custom_names,
          id
        ],
      )?;
      tx.execute(
        "DELETE FROM group_assignment_groups WHERE assignment_id = ?1",
        [id],
      )?;
      id
    }
    None => {
      tx.execute(
        "INSERT INTO group_assignments (name, class_id, source_seating_id, use_constraints, \
         avoid_last_n, require_leaders, leader_ids, locked_ids, use_custom_names) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
          input.name,
          input.class_id,
          input.source_seating_id,
          use_constraints,
          input.avoid_last_n,
          require_leaders,
          leader_ids_json,
          locked_ids_json,
          use_custom_names
        ],
      )?;
      tx.last_insert_rowid()
    }
  };

  // `groups ?? []`: et fraværende/null groups-felt betyr null children.
  for g in input.groups.iter().flatten() {
    tx.execute(
      "INSERT INTO group_assignment_groups (assignment_id, group_number, student_ids, group_name) \
       VALUES (?1, ?2, ?3, ?4)",
      rusqlite::params![
        assignment_id,
        g.group_number,
        encode_json_field(Some(&g.student_ids)),
        g.group_name
      ],
    )?;
  }

  tx.commit()?;
  Ok(assignment_id)
}

/// Kaskaderende sletting: `group_assignment_groups` og `group_history` (begge
/// via `assignment_id`) FØR parent-raden selv slettes. Wrappet i transaksjon.
pub fn delete_group_assignment_impl(conn: &mut Connection, id: i64) -> rusqlite::Result<()> {
  let tx = conn.transaction()?;
  tx.execute(
    "DELETE FROM group_assignment_groups WHERE assignment_id = ?1",
    [id],
  )?;
  tx.execute("DELETE FROM group_history WHERE assignment_id = ?1", [id])?;
  tx.execute("DELETE FROM group_assignments WHERE id = ?1", [id])?;
  tx.commit()
}

pub fn get_group_assignment_groups_impl(
  conn: &Connection,
  assignment_id: i64,
) -> rusqlite::Result<Vec<GroupAssignmentGroupRecord>> {
  let mut stmt = conn.prepare(
    "SELECT id, assignment_id, group_number, student_ids, group_name \
     FROM group_assignment_groups WHERE assignment_id = ?1 ORDER BY group_number ASC",
  )?;
  let rows = stmt.query_map([assignment_id], row_to_group_assignment_group)?;
  rows.collect()
}

/// `n` defaulter til 10 (speiler JS sin `async (_, classId, n = 10) => ...`).
pub fn get_group_history_impl(
  conn: &Connection,
  class_id: i64,
  n: Option<i64>,
) -> rusqlite::Result<Vec<GroupHistoryRecord>> {
  let limit = n.unwrap_or(10);
  let mut stmt = conn.prepare(
    "SELECT id, class_id, assignment_id, pairs, created_at FROM group_history \
     WHERE class_id = ?1 ORDER BY created_at DESC LIMIT ?2",
  )?;
  let rows = stmt.query_map(rusqlite::params![class_id, limit], row_to_group_history)?;
  rows.collect()
}

/// `pairs` stringifies ALLTID friskt (samme regel som leader_ids/locked_ids/
/// student_ids over). Returnerer den nye radens id ("lastID").
pub fn save_group_history_impl(
  conn: &Connection,
  input: &GroupHistoryInput,
) -> rusqlite::Result<i64> {
  let pairs_json = encode_json_field(Some(&input.pairs));
  if let Some(aid) = input.assignment_id {
    conn.execute("DELETE FROM group_history WHERE assignment_id = ?1", [aid])?;
  }
  conn.execute(
    "INSERT INTO group_history (class_id, assignment_id, pairs) VALUES (?1, ?2, ?3)",
    rusqlite::params![input.class_id, input.assignment_id, pairs_json],
  )?;
  Ok(conn.last_insert_rowid())
}

// ---- Tauri-kommando-wrappere: låser DbState-Mutex-en og delegerer til *_impl ----

#[tauri::command]
pub fn get_group_assignments(
  state: State<DbState>,
  class_id: Option<i64>,
) -> Result<Vec<GroupAssignmentListItem>, String> {
  let conn = state.0.lock().map_err(|e| e.to_string())?;
  get_group_assignments_impl(&conn, class_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_group_assignment(
  state: State<DbState>,
  id: i64,
) -> Result<Option<GroupAssignmentRecord>, String> {
  let conn = state.0.lock().map_err(|e| e.to_string())?;
  get_group_assignment_impl(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_group_assignment(
  state: State<DbState>,
  input: GroupAssignmentInput,
) -> Result<SaveResult, String> {
  let mut conn = state.0.lock().map_err(|e| e.to_string())?;
  save_group_assignment_impl(&mut conn, &input)
    .map(SaveResult::new)
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_group_assignment(state: State<DbState>, id: i64) -> Result<(), String> {
  let mut conn = state.0.lock().map_err(|e| e.to_string())?;
  delete_group_assignment_impl(&mut conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_group_assignment_groups(
  state: State<DbState>,
  assignment_id: i64,
) -> Result<Vec<GroupAssignmentGroupRecord>, String> {
  let conn = state.0.lock().map_err(|e| e.to_string())?;
  get_group_assignment_groups_impl(&conn, assignment_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_group_history(
  state: State<DbState>,
  class_id: i64,
  n: Option<i64>,
) -> Result<Vec<GroupHistoryRecord>, String> {
  let conn = state.0.lock().map_err(|e| e.to_string())?;
  get_group_history_impl(&conn, class_id, n).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_group_history(state: State<DbState>, input: GroupHistoryInput) -> Result<i64, String> {
  let conn = state.0.lock().map_err(|e| e.to_string())?;
  save_group_history_impl(&conn, &input).map_err(|e| e.to_string())
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

  fn base_input(class_id: i64) -> GroupAssignmentInput {
    GroupAssignmentInput {
      id: None,
      name: "Assignment".to_string(),
      class_id: Some(class_id),
      source_seating_id: None,
      use_constraints: true,
      avoid_last_n: Some(3),
      require_leaders: false,
      leader_ids: None,
      locked_ids: None,
      use_custom_names: false,
      groups: None,
    }
  }

  #[test]
  fn save_group_assignment_insert_with_groups_creates_parent_and_children() {
    let mut conn = setup();
    let class_id = insert_class(&conn, "Class A");

    let mut input = base_input(class_id);
    input.groups = Some(vec![
      GroupInput {
        group_number: 1,
        student_ids: serde_json::json!(["s1", "s2"]),
        group_name: Some("Gruppe 1".to_string()),
      },
      GroupInput {
        group_number: 2,
        student_ids: serde_json::json!(["s3"]),
        group_name: None,
      },
    ]);

    let id = save_group_assignment_impl(&mut conn, &input).unwrap();
    assert!(id > 0);

    let parent = get_group_assignment_impl(&conn, id).unwrap().unwrap();
    assert_eq!(parent.name, "Assignment");
    assert_eq!(parent.class_id, class_id);

    let children = get_group_assignment_groups_impl(&conn, id).unwrap();
    assert_eq!(children.len(), 2);
    assert_eq!(children[0].group_number, 1);
    // READ path returns the raw stored string, not a re-parsed Value.
    assert_eq!(children[0].student_ids, Some(r#"["s1","s2"]"#.to_string()));
    assert_eq!(children[0].group_name, Some("Gruppe 1".to_string()));
    assert_eq!(children[1].group_number, 2);
    assert_eq!(children[1].group_name, None);
  }

  #[test]
  fn save_group_assignment_command_return_shape_serializes_as_last_id_and_changes() {
    let mut conn = setup();
    let class_id = insert_class(&conn, "Class A");
    let id = save_group_assignment_impl(&mut conn, &base_input(class_id)).unwrap();
    let wrapped = SaveResult::new(id);

    let json = serde_json::to_value(wrapped).unwrap();
    assert_eq!(json, serde_json::json!({"lastID": id, "changes": 1}));
  }

  #[test]
  fn save_group_assignment_update_fully_replaces_children() {
    let mut conn = setup();
    let class_id = insert_class(&conn, "Class A");

    let mut input = base_input(class_id);
    input.groups = Some(vec![
      GroupInput {
        group_number: 1,
        student_ids: serde_json::json!(["s1"]),
        group_name: None,
      },
      GroupInput {
        group_number: 2,
        student_ids: serde_json::json!(["s2"]),
        group_name: None,
      },
    ]);
    let id = save_group_assignment_impl(&mut conn, &input).unwrap();
    assert_eq!(get_group_assignment_groups_impl(&conn, id).unwrap().len(), 2);

    let mut update = base_input(class_id);
    update.id = Some(id);
    update.name = "Renamed".to_string();
    update.groups = Some(vec![
      GroupInput {
        group_number: 1,
        student_ids: serde_json::json!(["a"]),
        group_name: None,
      },
      GroupInput {
        group_number: 2,
        student_ids: serde_json::json!(["b"]),
        group_name: None,
      },
      GroupInput {
        group_number: 3,
        student_ids: serde_json::json!(["c"]),
        group_name: None,
      },
    ]);
    let returned_id = save_group_assignment_impl(&mut conn, &update).unwrap();
    assert_eq!(returned_id, id);

    let children = get_group_assignment_groups_impl(&conn, id).unwrap();
    assert_eq!(children.len(), 3);
    let student_ids: Vec<Option<String>> = children.iter().map(|c| c.student_ids.clone()).collect();
    assert_eq!(
      student_ids,
      vec![
        Some(r#"["a"]"#.to_string()),
        Some(r#"["b"]"#.to_string()),
        Some(r#"["c"]"#.to_string())
      ]
    );

    let parent = get_group_assignment_impl(&conn, id).unwrap().unwrap();
    assert_eq!(parent.name, "Renamed");
  }

  #[test]
  fn save_group_assignment_update_does_not_touch_class_id() {
    let mut conn = setup();
    let class_1 = insert_class(&conn, "Class 1");
    let class_2 = insert_class(&conn, "Class 2");

    let input = base_input(class_1);
    let id = save_group_assignment_impl(&mut conn, &input).unwrap();

    let mut update = base_input(class_2); // attempt to "move" assignment
    update.id = Some(id);
    save_group_assignment_impl(&mut conn, &update).unwrap();

    let parent = get_group_assignment_impl(&conn, id).unwrap().unwrap();
    assert_eq!(parent.class_id, class_1);
  }

  #[test]
  fn save_group_assignment_with_omitted_groups_inserts_zero_children() {
    let mut conn = setup();
    let class_id = insert_class(&conn, "Class A");
    let input = base_input(class_id); // groups: None
    let id = save_group_assignment_impl(&mut conn, &input).unwrap();

    let children = get_group_assignment_groups_impl(&conn, id).unwrap();
    assert!(children.is_empty());
  }

  #[test]
  fn save_group_assignment_leader_ids_and_locked_ids_serialize_freshly() {
    let mut conn = setup();
    let class_id = insert_class(&conn, "Class A");
    let mut input = base_input(class_id);
    input.leader_ids = Some(serde_json::json!(["leader-1", "leader-2"]));
    input.locked_ids = Some(serde_json::json!(["locked-1"]));

    let id = save_group_assignment_impl(&mut conn, &input).unwrap();

    let raw_leader_ids: String = conn
      .query_row(
        "SELECT leader_ids FROM group_assignments WHERE id = ?1",
        [id],
        |r| r.get(0),
      )
      .unwrap();
    assert_eq!(raw_leader_ids, r#"["leader-1","leader-2"]"#);

    // READ path returns the raw stored string as-is (not re-parsed into an
    // object) - this is the fix for the bug where the frontend's
    // `JSON.parse(assignment.leader_ids || '[]')` threw on an already-parsed
    // object.
    let parent = get_group_assignment_impl(&conn, id).unwrap().unwrap();
    assert_eq!(parent.leader_ids, Some(r#"["leader-1","leader-2"]"#.to_string()));
    assert_eq!(parent.locked_ids, Some(r#"["locked-1"]"#.to_string()));
    // Round-trip: the returned strings actually parse back to the saved data.
    let reparsed_leaders: Value = serde_json::from_str(&parent.leader_ids.unwrap()).unwrap();
    assert_eq!(reparsed_leaders, serde_json::json!(["leader-1", "leader-2"]));
    let reparsed_locked: Value = serde_json::from_str(&parent.locked_ids.unwrap()).unwrap();
    assert_eq!(reparsed_locked, serde_json::json!(["locked-1"]));
  }

  #[test]
  fn save_group_assignment_with_omitted_leader_ids_defaults_to_empty_array() {
    let mut conn = setup();
    let class_id = insert_class(&conn, "Class A");
    let input = base_input(class_id); // leader_ids/locked_ids: None
    let id = save_group_assignment_impl(&mut conn, &input).unwrap();

    let parent = get_group_assignment_impl(&conn, id).unwrap().unwrap();
    assert_eq!(parent.leader_ids, Some("[]".to_string()));
    assert_eq!(parent.locked_ids, Some("[]".to_string()));
  }

  #[test]
  fn get_group_assignment_with_null_leader_ids_and_locked_ids_decodes_to_none() {
    let conn = setup();
    let class_id = insert_class(&conn, "Class A");
    conn
      .execute(
        "INSERT INTO group_assignments (name, class_id, leader_ids, locked_ids) \
         VALUES ('NullFields', ?1, NULL, NULL)",
        [class_id],
      )
      .unwrap();
    let id = conn.last_insert_rowid();

    let fetched = get_group_assignment_impl(&conn, id).unwrap().unwrap();
    assert_eq!(fetched.leader_ids, None);
    assert_eq!(fetched.locked_ids, None);
    let json = serde_json::to_value(&fetched).unwrap();
    assert_eq!(json["leaderIds"], serde_json::Value::Null);
    assert_eq!(json["lockedIds"], serde_json::Value::Null);
  }

  #[test]
  fn get_group_assignment_with_malformed_leader_ids_json_passes_through_as_is() {
    let conn = setup();
    let class_id = insert_class(&conn, "Class A");
    conn
      .execute(
        "INSERT INTO group_assignments (name, class_id, leader_ids, locked_ids) \
         VALUES ('Malformed', ?1, 'not valid json{{{', '[]')",
        [class_id],
      )
      .unwrap();
    let id = conn.last_insert_rowid();

    let fetched = get_group_assignment_impl(&conn, id).unwrap().unwrap();
    assert_eq!(fetched.leader_ids, Some("not valid json{{{".to_string()));
  }

  #[test]
  fn get_group_assignments_list_returns_raw_leader_ids_and_locked_ids_string_not_parsed_value() {
    let mut conn = setup();
    let class_id = insert_class(&conn, "Class A");
    let mut input = base_input(class_id);
    input.leader_ids = Some(serde_json::json!(["leader-1"]));
    input.locked_ids = Some(serde_json::json!(["locked-1"]));
    save_group_assignment_impl(&mut conn, &input).unwrap();

    let list = get_group_assignments_impl(&conn, None).unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].leader_ids, Some(r#"["leader-1"]"#.to_string()));
    assert_eq!(list[0].locked_ids, Some(r#"["locked-1"]"#.to_string()));
  }

  #[test]
  fn delete_group_assignment_cascades_through_groups_and_history() {
    let mut conn = setup();
    let class_id = insert_class(&conn, "Class A");
    let mut input = base_input(class_id);
    input.groups = Some(vec![GroupInput {
      group_number: 1,
      student_ids: serde_json::json!(["s1"]),
      group_name: None,
    }]);
    let id = save_group_assignment_impl(&mut conn, &input).unwrap();

    save_group_history_impl(
      &conn,
      &GroupHistoryInput {
        class_id,
        assignment_id: Some(id),
        pairs: serde_json::json!([["s1", "s2"]]),
      },
    )
    .unwrap();

    delete_group_assignment_impl(&mut conn, id).unwrap();

    let assignment = get_group_assignment_impl(&conn, id).unwrap();
    assert!(assignment.is_none());

    let children = get_group_assignment_groups_impl(&conn, id).unwrap();
    assert!(children.is_empty());

    let history_count: i64 = conn
      .query_row(
        "SELECT COUNT(*) FROM group_history WHERE assignment_id = ?1",
        [id],
        |r| r.get(0),
      )
      .unwrap();
    assert_eq!(history_count, 0);
  }

  #[test]
  fn get_group_assignments_list_view_includes_group_count_and_class_name() {
    let mut conn = setup();
    let class_id = insert_class(&conn, "Class A");
    let mut input = base_input(class_id);
    input.groups = Some(vec![
      GroupInput {
        group_number: 1,
        student_ids: serde_json::json!(["s1"]),
        group_name: None,
      },
      GroupInput {
        group_number: 2,
        student_ids: serde_json::json!(["s2"]),
        group_name: None,
      },
    ]);
    save_group_assignment_impl(&mut conn, &input).unwrap();

    let list = get_group_assignments_impl(&conn, None).unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].class_name.as_deref(), Some("Class A"));
    assert_eq!(list[0].group_count, 2);
  }

  #[test]
  fn get_group_assignments_filters_by_class_id() {
    let mut conn = setup();
    let class_a = insert_class(&conn, "Class A");
    let class_b = insert_class(&conn, "Class B");
    save_group_assignment_impl(&mut conn, &base_input(class_a)).unwrap();
    save_group_assignment_impl(&mut conn, &base_input(class_b)).unwrap();

    let filtered = get_group_assignments_impl(&conn, Some(class_a)).unwrap();
    assert_eq!(filtered.len(), 1);
    assert_eq!(filtered[0].class_id, class_a);
  }

  #[test]
  fn get_group_history_respects_n_and_defaults_to_ten() {
    let conn = setup();
    let class_id = insert_class(&conn, "Class A");

    for i in 0..12 {
      conn
        .execute(
          "INSERT INTO group_history (class_id, pairs, created_at) VALUES (?1, '[]', ?2)",
          rusqlite::params![class_id, format!("2024-01-{:02} 10:00:00", i + 1)],
        )
        .unwrap();
    }

    let default_limited = get_group_history_impl(&conn, class_id, None).unwrap();
    assert_eq!(default_limited.len(), 10);

    let custom_limited = get_group_history_impl(&conn, class_id, Some(3)).unwrap();
    assert_eq!(custom_limited.len(), 3);
  }

  #[test]
  fn save_group_history_pairs_serializes_freshly_and_returns_last_id() {
    let conn = setup();
    let class_id = insert_class(&conn, "Class A");

    let id = save_group_history_impl(
      &conn,
      &GroupHistoryInput {
        class_id,
        assignment_id: None,
        pairs: serde_json::json!([["a", "b"], ["c", "d"]]),
      },
    )
    .unwrap();
    assert!(id > 0);

    let raw: String = conn
      .query_row("SELECT pairs FROM group_history WHERE id = ?1", [id], |r| {
        r.get(0)
      })
      .unwrap();
    assert_eq!(raw, r#"[["a","b"],["c","d"]]"#);

    // READ path returns the raw stored string as-is (not re-parsed into an
    // object) - fix for the bug where frontend's `JSON.parse(row.pairs)`
    // threw on an already-parsed object.
    let fetched = get_group_history_impl(&conn, class_id, None).unwrap();
    assert_eq!(fetched.len(), 1);
    assert_eq!(fetched[0].pairs, Some(r#"[["a","b"],["c","d"]]"#.to_string()));
    // Round-trip: the returned string actually parses back to the saved data.
    let reparsed: Value = serde_json::from_str(fetched[0].pairs.as_ref().unwrap()).unwrap();
    assert_eq!(reparsed, serde_json::json!([["a", "b"], ["c", "d"]]));
  }

  #[test]
  fn get_group_history_with_malformed_pairs_json_passes_through_as_is() {
    let conn = setup();
    let class_id = insert_class(&conn, "Class A");
    conn
      .execute(
        "INSERT INTO group_history (class_id, pairs) VALUES (?1, 'not valid json{{{')",
        [class_id],
      )
      .unwrap();

    let fetched = get_group_history_impl(&conn, class_id, None).unwrap();
    assert_eq!(fetched.len(), 1);
    assert_eq!(fetched[0].pairs, Some("not valid json{{{".to_string()));
  }

  #[test]
  fn get_group_assignment_groups_returns_raw_student_ids_string_not_parsed_value() {
    let mut conn = setup();
    let class_id = insert_class(&conn, "Class A");
    let mut input = base_input(class_id);
    input.groups = Some(vec![GroupInput {
      group_number: 1,
      student_ids: serde_json::json!(["s1", "s2"]),
      group_name: None,
    }]);
    let id = save_group_assignment_impl(&mut conn, &input).unwrap();

    let children = get_group_assignment_groups_impl(&conn, id).unwrap();
    assert_eq!(children.len(), 1);
    assert_eq!(children[0].student_ids, Some(r#"["s1","s2"]"#.to_string()));
    // Round-trip: the returned string actually parses back to the saved data.
    let reparsed: Value = serde_json::from_str(children[0].student_ids.as_ref().unwrap()).unwrap();
    assert_eq!(reparsed, serde_json::json!(["s1", "s2"]));
  }

  #[test]
  fn get_group_assignment_groups_with_malformed_student_ids_json_passes_through_as_is() {
    let conn = setup();
    let class_id = insert_class(&conn, "Class A");
    let assignment_id = conn
      .execute(
        "INSERT INTO group_assignments (name, class_id) VALUES ('A', ?1)",
        [class_id],
      )
      .map(|_| conn.last_insert_rowid())
      .unwrap();
    conn
      .execute(
        "INSERT INTO group_assignment_groups (assignment_id, group_number, student_ids) \
         VALUES (?1, 1, 'not valid json{{{')",
        [assignment_id],
      )
      .unwrap();

    let children = get_group_assignment_groups_impl(&conn, assignment_id).unwrap();
    assert_eq!(children.len(), 1);
    assert_eq!(children[0].student_ids, Some("not valid json{{{".to_string()));
  }

  #[test]
  fn get_group_assignment_groups_ordered_by_group_number_asc() {
    let mut conn = setup();
    let class_id = insert_class(&conn, "Class A");
    let mut input = base_input(class_id);
    input.groups = Some(vec![
      GroupInput {
        group_number: 3,
        student_ids: serde_json::json!([]),
        group_name: None,
      },
      GroupInput {
        group_number: 1,
        student_ids: serde_json::json!([]),
        group_name: None,
      },
      GroupInput {
        group_number: 2,
        student_ids: serde_json::json!([]),
        group_name: None,
      },
    ]);
    let id = save_group_assignment_impl(&mut conn, &input).unwrap();

    let children = get_group_assignment_groups_impl(&conn, id).unwrap();
    let numbers: Vec<i64> = children.iter().map(|c| c.group_number).collect();
    assert_eq!(numbers, vec![1, 2, 3]);
  }

  #[test]
  fn get_group_assignment_existing_and_nonexistent() {
    let mut conn = setup();
    let class_id = insert_class(&conn, "Class A");
    let id = save_group_assignment_impl(&mut conn, &base_input(class_id)).unwrap();

    let found = get_group_assignment_impl(&conn, id).unwrap();
    assert!(found.is_some());

    let missing = get_group_assignment_impl(&conn, id + 9999).unwrap();
    assert!(missing.is_none());
  }

  #[test]
  fn save_group_history_replaces_existing_for_same_assignment_id() {
    let mut conn = setup();
    let class_id = insert_class(&conn, "Class A");
    let assignment_id = save_group_assignment_impl(&mut conn, &base_input(class_id)).unwrap();

    let hist1 = GroupHistoryInput {
      class_id,
      assignment_id: Some(assignment_id),
      pairs: serde_json::json!([["s1", "s2"]]),
    };
    save_group_history_impl(&conn, &hist1).unwrap();

    let hist2 = GroupHistoryInput {
      class_id,
      assignment_id: Some(assignment_id),
      pairs: serde_json::json!([["s1", "s3"]]),
    };
    save_group_history_impl(&conn, &hist2).unwrap();

    let history = get_group_history_impl(&conn, class_id, Some(10)).unwrap();
    assert_eq!(history.len(), 1);
    assert_eq!(history[0].pairs.as_deref(), Some(r#"[["s1","s3"]]"#));
  }
}

