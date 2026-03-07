/**
 * schema.js — SQLite schema-definisjon og migrations.
 * Kjøres ved oppstart. CREATE TABLE IF NOT EXISTS er idempotent.
 */

const CURRENT_VERSION = 4;

/** Kjør alle migrations mot en åpen sqlite3 db-instans */
function runMigrations(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
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
      db.run(`ALTER TABLE rooms ADD COLUMN design_mode TEXT DEFAULT 'board-top'`, () => {});
      db.run(`ALTER TABLE rooms ADD COLUMN room_height INTEGER DEFAULT 500`, () => {});

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

      // Sett schema-versjon
      db.run(
        `INSERT OR IGNORE INTO schema_version (version) VALUES (?)`,
        [CURRENT_VERSION],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  });
}

/** Migrer eksisterende rom-data fra gammelt array-format til nytt objekt-format */
function migrateRoomLayouts(db) {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, layout_data FROM rooms', [], (err, rows) => {
      if (err) return reject(err);

      const updates = [];
      for (const row of rows) {
        if (!row.layout_data) continue;
        try {
          const layout = JSON.parse(row.layout_data);
          if (Array.isArray(layout)) {
            const newLayout = { desks: layout, designMode: 'board-top', roomHeight: 500, decorations: [] };
            updates.push({ id: row.id, layout: JSON.stringify(newLayout) });
          }
        } catch { /* skip invalid JSON */ }
      }

      if (updates.length === 0) return resolve(0);

      let done = 0;
      for (const u of updates) {
        db.run('UPDATE rooms SET layout_data = ? WHERE id = ?', [u.layout, u.id], () => {
          done++;
          if (done === updates.length) resolve(done);
        });
      }
    });
  });
}

module.exports = { runMigrations, migrateRoomLayouts, CURRENT_VERSION };
