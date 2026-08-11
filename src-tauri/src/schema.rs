// schema.rs — SQLite skjema-definisjon og migrasjoner.
//
// Port av db/schema.js. Kjøres ved oppstart. CREATE TABLE IF NOT EXISTS er
// idempotent, og det samme gjelder (i praksis) ALTER TABLE ... ADD COLUMN,
// siden feil derfra svelges.
//
// VIKTIG: dette er IKKE et inkrementelt, versjonsgatet migrasjonssystem.
// `run_migrations` kjører *alle* CREATE TABLE- og ALTER TABLE-setningene
// ubetinget på hver eneste oppstart — det finnes ingen
// "if current_version < N, kjør migrasjon N"-forgrening. `schema_version`-
// tabellen er bare en markør brukt av db.js sin separate backup-deteksjons-
// logikk (Task 1.3), ikke en gate for hva som kjøres her.

use rusqlite::Connection;
use serde_json::{json, Value};

pub const CURRENT_VERSION: i32 = 11;

/// Kjør alle migrasjoner mot en åpen rusqlite-connection.
///
/// Oppfører seg som den ekte `db/schema.js`:
/// 1. Oppretter `schema_version` og alle "v1"-tabellene (classes, rooms,
///    seatings), samt v2-v5 sine nye tabeller, alle via
///    `CREATE TABLE IF NOT EXISTS` (idempotent — no-op om tabellen finnes).
/// 2. Kjører v3, v6-v11 sine `ALTER TABLE ... ADD COLUMN`-setninger. Hver av
///    disse feiler harmløst med en "duplicate column name"-feil om kolonnen
///    allerede finnes, akkurat som i JS-originalen. JS-originalen svelger
///    *enhver* feil fra disse (`catch(e){}`), ikke bare "duplicate column
///    name"-varianten — vi speiler det samme her ved å ignorere ethvert
///    resultat fra disse kallene. Dette er arvet disiplin fra JS-versjonen,
///    ikke nødvendigvis beste praksis (en reell disk-full/permission-feil
///    ville også bli svelget), men det er den faktiske oppførselen vi må
///    matche.
/// 3. Setter `INSERT OR IGNORE INTO schema_version (version) VALUES (11)` —
///    `OR IGNORE` betyr at dette er en no-op om raden med akkurat
///    version=11 allerede finnes. Det oppdaterer IKKE eldre versjonsrader —
///    flere versjonsrader kan sameksistere i tabellen (kun brukt andre
///    steder via `MAX(version)`).
pub fn run_migrations(conn: &Connection) -> rusqlite::Result<()> {
  // ---- Schema-versjonering + v1-v5 tabeller (idempotent) ----
  conn.execute_batch(
    r#"
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS classes (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      name     TEXT NOT NULL,
      students TEXT
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      layout_data TEXT
    );

    CREATE TABLE IF NOT EXISTS seatings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT,
      class_id   INTEGER,
      room_id    INTEGER,
      placements TEXT,
      comment    TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(class_id) REFERENCES classes(id),
      FOREIGN KEY(room_id)  REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS seating_history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id   INTEGER NOT NULL,
      chart_id   INTEGER,
      pairs      TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(class_id) REFERENCES classes(id),
      FOREIGN KEY(chart_id) REFERENCES seatings(id)
    );

    CREATE TABLE IF NOT EXISTS student_constraints (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id  INTEGER NOT NULL,
      student_a TEXT NOT NULL,
      student_b TEXT NOT NULL,
      type      TEXT NOT NULL,
      FOREIGN KEY(class_id) REFERENCES classes(id)
    );

    CREATE TABLE IF NOT EXISTS group_assignments (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      name               TEXT NOT NULL,
      class_id           INTEGER NOT NULL,
      source_seating_id  INTEGER,
      use_constraints    INTEGER DEFAULT 1,
      avoid_last_n       INTEGER DEFAULT 3,
      require_leaders    INTEGER DEFAULT 0,
      leader_ids         TEXT DEFAULT '[]',
      created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(class_id) REFERENCES classes(id),
      FOREIGN KEY(source_seating_id) REFERENCES seatings(id)
    );

    CREATE TABLE IF NOT EXISTS group_assignment_groups (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      group_number  INTEGER NOT NULL,
      student_ids   TEXT NOT NULL,
      FOREIGN KEY(assignment_id) REFERENCES group_assignments(id)
    );

    CREATE TABLE IF NOT EXISTS group_history (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id      INTEGER NOT NULL,
      assignment_id INTEGER,
      pairs         TEXT NOT NULL,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(class_id) REFERENCES classes(id),
      FOREIGN KEY(assignment_id) REFERENCES group_assignments(id)
    );

    CREATE TABLE IF NOT EXISTS participation_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      seating_id  INTEGER NOT NULL,
      student_id  TEXT NOT NULL,
      date        TEXT NOT NULL,
      events      TEXT NOT NULL DEFAULT '[]',
      UNIQUE(seating_id, student_id, date),
      FOREIGN KEY(seating_id) REFERENCES seatings(id)
    );

    CREATE TABLE IF NOT EXISTS schedule (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id  INTEGER NOT NULL,
      weekday   INTEGER NOT NULL,
      period    INTEGER NOT NULL,
      note      TEXT DEFAULT '',
      FOREIGN KEY(class_id) REFERENCES classes(id)
    );

    CREATE TABLE IF NOT EXISTS station_sessions (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      name                TEXT NOT NULL,
      class_id            INTEGER NOT NULL,
      stations            TEXT NOT NULL DEFAULT '[]',
      groups              TEXT NOT NULL DEFAULT '[]',
      rotation_plan       TEXT NOT NULL DEFAULT '[]',
      minutes_per_station INTEGER DEFAULT 10,
      created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(class_id) REFERENCES classes(id)
    );
    "#,
  )?;

  // ---- v3, v6-v11: ALTER TABLE ... ADD COLUMN, hver med feil svelget ----
  // (Speiler JS-originalens bare `try { ... } catch(e){}` rundt hver
  // enkelt ALTER — svelger ALLE feil, ikke bare "duplicate column name".)
  let alters: &[&str] = &[
    // v3
    "ALTER TABLE rooms ADD COLUMN design_mode TEXT DEFAULT 'board-top'",
    "ALTER TABLE rooms ADD COLUMN room_height INTEGER DEFAULT 500",
    // v6
    "ALTER TABLE station_sessions ADD COLUMN teacher_station_id INTEGER DEFAULT NULL",
    // v7
    "ALTER TABLE seating_history ADD COLUMN neighbors TEXT DEFAULT '[]'",
    // v8
    "ALTER TABLE group_assignments ADD COLUMN locked_ids TEXT DEFAULT '[]'",
    // v9
    "ALTER TABLE station_sessions ADD COLUMN group_leaders TEXT DEFAULT '[]'",
    // v10
    "ALTER TABLE station_sessions ADD COLUMN seconds_per_station INTEGER DEFAULT 0",
    "ALTER TABLE station_sessions ADD COLUMN no_timer INTEGER DEFAULT 0",
    // v11
    "ALTER TABLE group_assignments ADD COLUMN use_custom_names INTEGER DEFAULT 0",
    "ALTER TABLE group_assignment_groups ADD COLUMN group_name TEXT",
  ];

  for alter in alters {
    let _ = conn.execute(alter, []);
  }

  // ---- Sett schema-versjon ----
  conn.execute(
    "INSERT OR IGNORE INTO schema_version (version) VALUES (?1)",
    [CURRENT_VERSION],
  )?;

  Ok(())
}

/// Migrer eksisterende rom-data fra gammelt array-format til nytt
/// objekt-format. Separat, engangs *data*-migrasjon (ikke skjema).
///
/// For hver rad i `rooms` med ikke-null `layout_data`: forsøk å parse som
/// JSON. Hvis resultatet er et JSON-array, pakk det inn i
/// `{desks, designMode: "board-top", roomHeight: 500, decorations: []}` og
/// oppdater raden. Ugyldig JSON eller allerede-objekt-format hoppes
/// stille over (matcher JS sin `catch { skip }` / `Array.isArray`-sjekk).
///
/// Returnerer antall rader som ble oppdatert.
pub fn migrate_room_layouts(conn: &Connection) -> rusqlite::Result<u32> {
  let mut stmt = conn.prepare("SELECT id, layout_data FROM rooms")?;
  let rows: Vec<(i64, Option<String>)> = stmt
    .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
    .collect::<Result<Vec<_>, _>>()?;

  let mut updates = 0u32;
  for (id, layout_data) in rows {
    let Some(layout_data) = layout_data else {
      continue;
    };

    let parsed: Result<Value, _> = serde_json::from_str(&layout_data);
    let Ok(layout) = parsed else {
      continue; // ugyldig JSON — hopp over
    };

    if let Value::Array(_) = layout {
      let new_layout = json!({
        "desks": layout,
        "designMode": "board-top",
        "roomHeight": 500,
        "decorations": []
      });
      let new_layout_str = serde_json::to_string(&new_layout)
        .expect("serialisering av kjent JSON-verdi kan ikke feile");

      conn.execute(
        "UPDATE rooms SET layout_data = ?1 WHERE id = ?2",
        rusqlite::params![new_layout_str, id],
      )?;
      updates += 1;
    }
    // ikke-array (allerede objekt-format) — hopp over uten endring
  }

  Ok(updates)
}

#[cfg(test)]
mod tests {
  use super::*;
  use rusqlite::params;

  const EXPECTED_TABLES: &[&str] = &[
    "classes",
    "rooms",
    "seatings",
    "seating_history",
    "student_constraints",
    "group_assignments",
    "group_assignment_groups",
    "group_history",
    "participation_logs",
    "schedule",
    "station_sessions",
    "schema_version",
  ];

  fn table_exists(conn: &Connection, name: &str) -> bool {
    conn
      .query_row(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1",
        [name],
        |_| Ok(()),
      )
      .is_ok()
  }

  #[test]
  fn creates_all_expected_tables() {
    let conn = Connection::open_in_memory().unwrap();
    run_migrations(&conn).unwrap();

    for table in EXPECTED_TABLES {
      assert!(table_exists(&conn, table), "missing table: {table}");
    }
  }

  #[test]
  fn run_migrations_is_idempotent() {
    let conn = Connection::open_in_memory().unwrap();
    run_migrations(&conn).unwrap();
    run_migrations(&conn).unwrap();

    for table in EXPECTED_TABLES {
      assert!(table_exists(&conn, table), "missing table: {table}");
    }
  }

  #[test]
  fn alter_added_columns_exist_after_migration() {
    let conn = Connection::open_in_memory().unwrap();
    run_migrations(&conn).unwrap();

    // rooms: v3 columns
    conn
      .execute(
        "INSERT INTO rooms (name, design_mode, room_height) VALUES ('r', 'board-top', 500)",
        [],
      )
      .unwrap();

    conn
      .execute("INSERT INTO classes (name, students) VALUES ('c', NULL)", [])
      .unwrap();
    let class_id: i64 = conn
      .query_row("SELECT id FROM classes LIMIT 1", [], |row| row.get(0))
      .unwrap();

    // group_assignments: v11 column
    conn
      .execute(
        "INSERT INTO group_assignments (name, class_id, use_custom_names) VALUES ('a', ?1, 1)",
        params![class_id],
      )
      .unwrap();

    let assignment_id: i64 = conn
      .query_row("SELECT id FROM group_assignments LIMIT 1", [], |row| {
        row.get(0)
      })
      .unwrap();

    // group_assignment_groups: v11 column
    conn
      .execute(
        "INSERT INTO group_assignment_groups (assignment_id, group_number, student_ids, group_name) VALUES (?1, 1, '[]', 'Gruppe A')",
        params![assignment_id],
      )
      .unwrap();

    let group_name: String = conn
      .query_row(
        "SELECT group_name FROM group_assignment_groups LIMIT 1",
        [],
        |row| row.get(0),
      )
      .unwrap();
    assert_eq!(group_name, "Gruppe A");
  }

  #[test]
  fn schema_version_row_is_inserted() {
    let conn = Connection::open_in_memory().unwrap();
    run_migrations(&conn).unwrap();

    let version: i32 = conn
      .query_row(
        "SELECT version FROM schema_version WHERE version = ?1",
        [CURRENT_VERSION],
        |row| row.get(0),
      )
      .unwrap();
    assert_eq!(version, 11);
  }

  #[test]
  fn migrate_room_layouts_wraps_array_format() {
    let conn = Connection::open_in_memory().unwrap();
    run_migrations(&conn).unwrap();

    conn
      .execute(
        "INSERT INTO rooms (name, layout_data) VALUES ('r', '[{\"x\":1,\"y\":2}]')",
        [],
      )
      .unwrap();

    let updated = migrate_room_layouts(&conn).unwrap();
    assert_eq!(updated, 1);

    let layout_data: String = conn
      .query_row("SELECT layout_data FROM rooms LIMIT 1", [], |row| {
        row.get(0)
      })
      .unwrap();
    let parsed: Value = serde_json::from_str(&layout_data).unwrap();

    assert_eq!(parsed["desks"], json!([{"x": 1, "y": 2}]));
    assert_eq!(parsed["designMode"], "board-top");
    assert_eq!(parsed["roomHeight"], 500);
    assert_eq!(parsed["decorations"], json!([]));
  }

  #[test]
  fn migrate_room_layouts_leaves_object_format_untouched() {
    let conn = Connection::open_in_memory().unwrap();
    run_migrations(&conn).unwrap();

    let original = r#"{"desks":[],"designMode":"board-top","roomHeight":500,"decorations":[]}"#;
    conn
      .execute(
        "INSERT INTO rooms (name, layout_data) VALUES ('r', ?1)",
        params![original],
      )
      .unwrap();

    let updated = migrate_room_layouts(&conn).unwrap();
    assert_eq!(updated, 0);

    let layout_data: String = conn
      .query_row("SELECT layout_data FROM rooms LIMIT 1", [], |row| {
        row.get(0)
      })
      .unwrap();
    assert_eq!(layout_data, original);
  }

  #[test]
  fn migrate_room_layouts_skips_null_layout_data() {
    let conn = Connection::open_in_memory().unwrap();
    run_migrations(&conn).unwrap();

    conn
      .execute("INSERT INTO rooms (name, layout_data) VALUES ('r', NULL)", [])
      .unwrap();

    let updated = migrate_room_layouts(&conn).unwrap();
    assert_eq!(updated, 0);

    let layout_data: Option<String> = conn
      .query_row("SELECT layout_data FROM rooms LIMIT 1", [], |row| {
        row.get(0)
      })
      .unwrap();
    assert_eq!(layout_data, None);
  }

  #[test]
  fn migrate_room_layouts_skips_malformed_json() {
    let conn = Connection::open_in_memory().unwrap();
    run_migrations(&conn).unwrap();

    let malformed = "{ not valid json";
    conn
      .execute(
        "INSERT INTO rooms (name, layout_data) VALUES ('r', ?1)",
        params![malformed],
      )
      .unwrap();

    let updated = migrate_room_layouts(&conn).unwrap();
    assert_eq!(updated, 0);

    let layout_data: String = conn
      .query_row("SELECT layout_data FROM rooms LIMIT 1", [], |row| {
        row.get(0)
      })
      .unwrap();
    assert_eq!(layout_data, malformed);
  }
}
