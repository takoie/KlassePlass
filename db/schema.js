/**
 * schema.js — SQLite schema-definisjon og migrations.
 * Kjøres ved oppstart. CREATE TABLE IF NOT EXISTS er idempotent.
 */

const CURRENT_VERSION = 9;

/** Kjør alle migrations mot en åpen sql.js db-instans */
function runMigrations(db) {
  return new Promise((resolve, reject) => {
    try {
      // ---- Schema-versjonering ----
      db.run(`CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // ---- Eksisterende tabeller (v1 — aldri drop) ----
      db.run(`CREATE TABLE IF NOT EXISTS classes (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        name     TEXT NOT NULL,
        students TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS rooms (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        layout_data TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS seatings (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT,
        class_id   INTEGER,
        room_id    INTEGER,
        placements TEXT,
        comment    TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(class_id) REFERENCES classes(id),
        FOREIGN KEY(room_id)  REFERENCES rooms(id)
      )`);

      // ---- v2: Historikk ----
      db.run(`CREATE TABLE IF NOT EXISTS seating_history (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id   INTEGER NOT NULL,
        chart_id   INTEGER,
        pairs      TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(class_id) REFERENCES classes(id),
        FOREIGN KEY(chart_id) REFERENCES seatings(id)
      )`);

      // ---- v2: Constraints ----
      db.run(`CREATE TABLE IF NOT EXISTS student_constraints (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id  INTEGER NOT NULL,
        student_a TEXT NOT NULL,
        student_b TEXT NOT NULL,
        type      TEXT NOT NULL,
        FOREIGN KEY(class_id) REFERENCES classes(id)
      )`);

      // ---- v3: ROM-migrering — legg til designMode og roomHeight kolonner om de mangler ----
      try { db.run(`ALTER TABLE rooms ADD COLUMN design_mode TEXT DEFAULT 'board-top'`); } catch(e){}
      try { db.run(`ALTER TABLE rooms ADD COLUMN room_height INTEGER DEFAULT 500`); } catch(e){}

      // ---- v4: Gruppearbeid ----
      db.run(`CREATE TABLE IF NOT EXISTS group_assignments (
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
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS group_assignment_groups (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        assignment_id INTEGER NOT NULL,
        group_number  INTEGER NOT NULL,
        student_ids   TEXT NOT NULL,
        FOREIGN KEY(assignment_id) REFERENCES group_assignments(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS group_history (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id      INTEGER NOT NULL,
        assignment_id INTEGER,
        pairs         TEXT NOT NULL,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(class_id) REFERENCES classes(id),
        FOREIGN KEY(assignment_id) REFERENCES group_assignments(id)
      )`);

      // ---- v5: Deltakelseslogg ----
      db.run(`CREATE TABLE IF NOT EXISTS participation_logs (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        seating_id  INTEGER NOT NULL,
        student_id  TEXT NOT NULL,
        date        TEXT NOT NULL,
        events      TEXT NOT NULL DEFAULT '[]',
        UNIQUE(seating_id, student_id, date),
        FOREIGN KEY(seating_id) REFERENCES seatings(id)
      )`);

      // ---- v5: Timeplan ----
      db.run(`CREATE TABLE IF NOT EXISTS schedule (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id  INTEGER NOT NULL,
        weekday   INTEGER NOT NULL,
        period    INTEGER NOT NULL,
        note      TEXT DEFAULT '',
        FOREIGN KEY(class_id) REFERENCES classes(id)
      )`);

      // ---- v5: Stasjonsundervisning ----
      db.run(`CREATE TABLE IF NOT EXISTS station_sessions (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        name                TEXT NOT NULL,
        class_id            INTEGER NOT NULL,
        stations            TEXT NOT NULL DEFAULT '[]',
        groups              TEXT NOT NULL DEFAULT '[]',
        rotation_plan       TEXT NOT NULL DEFAULT '[]',
        minutes_per_station INTEGER DEFAULT 10,
        created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(class_id) REFERENCES classes(id)
      )`);

      // ---- v6: Stasjonskart utbedring — teacher_station_id kolonne ----
      try { db.run(`ALTER TABLE station_sessions ADD COLUMN teacher_station_id INTEGER DEFAULT NULL`); } catch(e){}

      // ---- v7: Nabo-historikk — neighbors kolonne i seating_history ----
      try { db.run(`ALTER TABLE seating_history ADD COLUMN neighbors TEXT DEFAULT '[]'`); } catch(e){}

      // ---- v8: Låste elever i gruppearbeid — locked_ids kolonne ----
      try { db.run(`ALTER TABLE group_assignments ADD COLUMN locked_ids TEXT DEFAULT '[]'`); } catch(e){}

      // ---- v9: Stasjon-gruppeledere — group_leaders kolonne ----
      try { db.run(`ALTER TABLE station_sessions ADD COLUMN group_leaders TEXT DEFAULT '[]'`); } catch(e){}

      // Sett schema-versjon
      db.run(`INSERT OR IGNORE INTO schema_version (version) VALUES (?)`, [CURRENT_VERSION]);
      resolve();
    } catch(err) {
      reject(err);
    }
  });
}

/** Migrer eksisterende rom-data fra gammelt array-format til nytt objekt-format */
function migrateRoomLayouts(db) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare('SELECT id, layout_data FROM rooms');
      let updates = 0;
      while (stmt.step()) {
        const row = stmt.getAsObject();
        if (!row.layout_data) continue;
        try {
          const layout = JSON.parse(row.layout_data);
          if (Array.isArray(layout)) {
            const newLayout = { desks: layout, designMode: 'board-top', roomHeight: 500, decorations: [] };
            db.run('UPDATE rooms SET layout_data = ? WHERE id = ?', [JSON.stringify(newLayout), row.id]);
            updates++;
          }
        } catch { /* skip invalid JSON */ }
      }
      stmt.free();
      resolve(updates);
    } catch(err) {
      reject(err);
    }
  });
}

module.exports = { runMigrations, migrateRoomLayouts, CURRENT_VERSION };
