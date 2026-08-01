/**
 * ipc-handlers.js — Alle ipcMain.handle/on registreringer.
 * Importerer db og settings fra db.js. Maks 300 linjer.
 */

const { ipcMain, dialog, app, shell } = require('electron');
const path    = require('path');
const fs      = require('fs');
const { getDb, getDbPathFn, loadSettings, saveSettings, saveDbToDisk, getMigrationInfo } = require('./db.js');

/** Hjelpefunksjon: pakk sql.js inn i Promise for bakoverkompatibilitet */
const dbAll = (sql, p = []) => new Promise((res, rej) => {
  try {
    const stmt = getDb().prepare(sql);
    stmt.bind(p);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    res(results);
  } catch(e) { rej(e); }
});

const dbGet = (sql, p = []) => new Promise((res, rej) => {
  try {
    const stmt = getDb().prepare(sql);
    stmt.bind(p);
    let result = null;
    if (stmt.step()) result = stmt.getAsObject();
    stmt.free();
    res(result);
  } catch(e) { rej(e); }
});

const dbRun = (sql, p = []) => new Promise((res, rej) => {
  try {
    const stmt = getDb().prepare(sql);
    stmt.run(p);
    stmt.free();

    // sql.js don't easily have lastInsertRowid, we must fetch it manually.
    // Må skje FØR saveDbToDisk() — db.export() nullstiller last_insert_rowid().
    let lastID = 0;
    try {
        const resObj = getDb().exec("SELECT last_insert_rowid() as id");
        if (resObj && resObj.length > 0 && resObj[0].values.length > 0) {
            lastID = resObj[0].values[0][0];
        }
    } catch(err) {}

    saveDbToDisk();
    res({ lastID, changes: 1 });
  } catch(e) { rej(e); }
});

function registerHandlers(winRef) {
  // ---- Window controls ----
  ipcMain.on('window-minimize', () => winRef.win?.minimize());
  ipcMain.on('window-maximize', () => winRef.win?.isMaximized() ? winRef.win.unmaximize() : winRef.win.maximize());
  ipcMain.on('window-close',    () => winRef.win?.close());

  // ---- App info ----
  ipcMain.handle('get-version', async () => app.getVersion());
  ipcMain.handle('get-migration-info', async () => getMigrationInfo());

  // ---- Settings ----
  ipcMain.handle('get-settings',   async ()       => loadSettings());
  ipcMain.handle('save-settings',  async (_, d)   => { const s = loadSettings(); saveSettings({ ...s, ...d }); return true; });

  // ---- Klasser ----
  ipcMain.handle('get-classes', async () => dbAll('SELECT * FROM classes ORDER BY name ASC'));
  ipcMain.handle('get-class',   async (_, id) => dbGet('SELECT * FROM classes WHERE id=?', [id]));
  ipcMain.handle('save-class',  async (_, { id, name, students }) => {
    const studentsJson = typeof students === 'string' ? students : JSON.stringify(students);
    if (id) return dbRun('UPDATE classes SET name=?, students=? WHERE id=?', [name, studentsJson, id]);
    return dbRun('INSERT INTO classes (name, students) VALUES (?,?)', [name, studentsJson]);
  });
  ipcMain.handle('delete-class', async (_, id) => {
    const seatings = await dbAll('SELECT id FROM seatings WHERE class_id=?', [id]);
    for (const s of seatings) {
      await dbRun('DELETE FROM participation_logs WHERE seating_id=?', [s.id]);
      await dbRun('DELETE FROM seating_history WHERE chart_id=?', [s.id]);
    }
    await dbRun('DELETE FROM seatings WHERE class_id=?', [id]);
    await dbRun('DELETE FROM student_constraints WHERE class_id=?', [id]);
    await dbRun('DELETE FROM group_assignments WHERE class_id=?', [id]);
    await dbRun('DELETE FROM group_history WHERE class_id=?', [id]);
    await dbRun('DELETE FROM schedule WHERE class_id=?', [id]);
    await dbRun('DELETE FROM station_sessions WHERE class_id=?', [id]);
    return dbRun('DELETE FROM classes WHERE id=?', [id]);
  });

  // ---- Rom ----
  ipcMain.handle('get-rooms', async () => dbAll('SELECT * FROM rooms ORDER BY name ASC'));
  ipcMain.handle('get-room',  async (_, id) => dbGet('SELECT * FROM rooms WHERE id=?', [id]));
  ipcMain.handle('save-room', async (_, { id, name, layoutData }) => {
    const layout = typeof layoutData === 'string' ? layoutData : JSON.stringify(layoutData);
    if (id) return dbRun('UPDATE rooms SET name=?, layout_data=? WHERE id=?', [name, layout, id]);
    return dbRun('INSERT INTO rooms (name, layout_data) VALUES (?,?)', [name, layout]);
  });
  ipcMain.handle('delete-room', async (_, id) => {
    await dbRun('UPDATE seatings SET room_id=NULL WHERE room_id=?', [id]);
    return dbRun('DELETE FROM rooms WHERE id=?', [id]);
  });

  // ---- Klassekart ----
  ipcMain.handle('get-seatings', async (_, classId) => {
    const sql = classId
      ? `SELECT s.*, c.name as class_name, r.name as room_name FROM seatings s
         LEFT JOIN classes c ON s.class_id=c.id LEFT JOIN rooms r ON s.room_id=r.id
         WHERE s.class_id=? ORDER BY s.created_at DESC`
      : `SELECT s.*, c.name as class_name, r.name as room_name FROM seatings s
         LEFT JOIN classes c ON s.class_id=c.id LEFT JOIN rooms r ON s.room_id=r.id
         ORDER BY s.created_at DESC`;
    return classId ? dbAll(sql, [classId]) : dbAll(sql);
  });
  ipcMain.handle('get-seating', async (_, id) => dbGet('SELECT * FROM seatings WHERE id=?', [id]));
  ipcMain.handle('save-seating', async (_, { id, name, classId, roomId, placements, comment }) => {
    const p = typeof placements === 'string' ? placements : JSON.stringify(placements);
    if (id) return dbRun('UPDATE seatings SET name=?,placements=?,comment=? WHERE id=?', [name, p, comment ?? '', id]);
    return dbRun('INSERT INTO seatings (name,class_id,room_id,placements,comment) VALUES (?,?,?,?,?)',
      [name, classId, roomId, p, comment ?? '']);
  });
  ipcMain.handle('delete-seating', async (_, id) => {
    await dbRun('DELETE FROM seating_history WHERE chart_id=?', [id]);
    return dbRun('DELETE FROM seatings WHERE id=?', [id]);
  });

  // ---- Constraints ----
  ipcMain.handle('get-constraints',    async (_, cid) => dbAll('SELECT * FROM student_constraints WHERE class_id=?', [cid]));

  // ---- Gruppearbeid ----
  ipcMain.handle('get-group-assignments', async (_, classId) => {
    const base = `
      SELECT ga.*, c.name as class_name,
        (SELECT COUNT(*) FROM group_assignment_groups g WHERE g.assignment_id = ga.id) as group_count
      FROM group_assignments ga
      LEFT JOIN classes c ON ga.class_id = c.id`;
    const sql = classId
      ? base + ' WHERE ga.class_id=? ORDER BY ga.created_at DESC'
      : base + ' ORDER BY ga.created_at DESC';
    return classId ? dbAll(sql, [classId]) : dbAll(sql);
  });

  ipcMain.handle('get-group-assignment', async (_, id) =>
    dbGet('SELECT * FROM group_assignments WHERE id=?', [id]));

  ipcMain.handle('save-group-assignment', async (_, { id, name, classId, sourceSeatingId, useConstraints, avoidLastN, requireLeaders, leaderIds, lockedIds, useCustomNames, groups }) => {
    const lids = JSON.stringify(leaderIds ?? []);
    const lockIds = JSON.stringify(lockedIds ?? []);
    const useNames = useCustomNames ? 1 : 0;
    let assignmentId = id;
    if (id) {
      await dbRun('UPDATE group_assignments SET name=?,use_constraints=?,avoid_last_n=?,require_leaders=?,leader_ids=?,locked_ids=?,use_custom_names=? WHERE id=?',
        [name, useConstraints ? 1 : 0, avoidLastN, requireLeaders ? 1 : 0, lids, lockIds, useNames, id]);
      await dbRun('DELETE FROM group_assignment_groups WHERE assignment_id=?', [id]);
    } else {
      const r = await dbRun(
        'INSERT INTO group_assignments (name,class_id,source_seating_id,use_constraints,avoid_last_n,require_leaders,leader_ids,locked_ids,use_custom_names) VALUES (?,?,?,?,?,?,?,?,?)',
        [name, classId, sourceSeatingId ?? null, useConstraints ? 1 : 0, avoidLastN, requireLeaders ? 1 : 0, lids, lockIds, useNames]);
      assignmentId = r.lastID;
    }
    for (const g of groups ?? []) {
      await dbRun('INSERT INTO group_assignment_groups (assignment_id,group_number,student_ids,group_name) VALUES (?,?,?,?)',
        [assignmentId, g.groupNumber, JSON.stringify(g.studentIds), g.groupName ?? null]);
    }
    return { lastID: assignmentId };
  });

  ipcMain.handle('delete-group-assignment', async (_, id) => {
    await dbRun('DELETE FROM group_assignment_groups WHERE assignment_id=?', [id]);
    await dbRun('DELETE FROM group_history WHERE assignment_id=?', [id]);
    return dbRun('DELETE FROM group_assignments WHERE id=?', [id]);
  });

  ipcMain.handle('get-group-assignment-groups', async (_, assignmentId) =>
    dbAll('SELECT * FROM group_assignment_groups WHERE assignment_id=? ORDER BY group_number ASC', [assignmentId]));

  ipcMain.handle('get-group-history', async (_, classId, n = 10) =>
    dbAll('SELECT * FROM group_history WHERE class_id=? ORDER BY created_at DESC LIMIT ?', [classId, n]));

  ipcMain.handle('save-group-history', async (_, { classId, assignmentId, pairs }) =>
    dbRun('INSERT INTO group_history (class_id,assignment_id,pairs) VALUES (?,?,?)',
      [classId, assignmentId, JSON.stringify(pairs)]));

  // ---- Database backup / restore / move ----
  ipcMain.handle('backup-db', async () => {
    const date = new Date().toISOString().split('T')[0];
    const result = await dialog.showSaveDialog(winRef.win, {
      title: 'Lagre sikkerhetskopi',
      defaultPath: `klassekart_backup_${date}.db`,
      filters: [{ name: 'Database', extensions: ['db'] }],
    });
    if (result.canceled) return { success: false, canceled: true };
    fs.copyFileSync(getDbPathFn(), result.filePath);
    return { success: true, filePath: result.filePath };
  });

  ipcMain.handle('restore-db', async () => {
    const result = await dialog.showOpenDialog(winRef.win, {
      title: 'Gjenopprett database',
      filters: [{ name: 'Database', extensions: ['db'] }],
      properties: ['openFile'],
    });
    if (result.canceled) return { success: false, canceled: true };
    const src = result.filePaths[0];
    const stats = fs.statSync(src);
    if (stats.size > 100 * 1024 * 1024) return { success: false, error: 'Filen er for stor (maks 100MB)' };
    const backup = getDbPathFn() + '.bak';
    fs.copyFileSync(getDbPathFn(), backup);
    fs.copyFileSync(src, getDbPathFn());
    // .bak beholdes bevisst — gir fallback dersom gjenopprettingen er korrupt
    return { success: true };
  });

  ipcMain.handle('move-db', async () => {
    const result = await dialog.showOpenDialog(winRef.win, {
      title: 'Velg ny plassering',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled) return { success: false, canceled: true };
    const newPath = path.join(result.filePaths[0], 'klassekart_database.db');
    if (fs.existsSync(newPath)) return { success: false, error: 'Database finnes allerede der' };
    fs.copyFileSync(getDbPathFn(), newPath);
    fs.unlinkSync(getDbPathFn());
    const cfgPath = path.join(app.getPath('userData'), 'db-location.json');
    fs.writeFileSync(cfgPath, JSON.stringify({ dbPath: newPath }));
    return { success: true, newPath, requiresRestart: true };
  });

  // ---- Print / PDF-eksport ----
  ipcMain.handle('print:export-pdf', async (_, { suggestedName }) => {
    const settings = loadSettings();
    const defaultDir = settings.lastPrintExportDir || app.getPath('documents');
    const result = await dialog.showSaveDialog(winRef.win, {
      title: 'Eksporter til PDF',
      defaultPath: path.join(defaultDir, suggestedName),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (result.canceled) return { success: false, canceled: true };
    try {
      const pdfBuffer = await winRef.win.webContents.printToPDF({
        landscape: true,
        pageSize: 'A4',
        printBackground: true,
        margins: { marginType: 'none' },
      });
      fs.writeFileSync(result.filePath, pdfBuffer);
      const freshSettings = loadSettings();
      saveSettings({ ...freshSettings, lastPrintExportDir: path.dirname(result.filePath) });
      return { success: true, filePath: result.filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('print:open-path', async (_, filePath) => {
    const err = await shell.openPath(filePath);
    return { success: !err, error: err || null };
  });

  ipcMain.handle('print:show-in-folder', async (_, filePath) => {
    shell.showItemInFolder(filePath);
    return { success: true };
  });

  // ---- Stasjonsundervisning ----
  ipcMain.handle('get-station-sessions', async (_, classId) => {
    const sql = classId
      ? `SELECT ss.*, c.name as class_name FROM station_sessions ss
         LEFT JOIN classes c ON ss.class_id=c.id
         WHERE ss.class_id=? ORDER BY ss.created_at DESC`
      : `SELECT ss.*, c.name as class_name FROM station_sessions ss
         LEFT JOIN classes c ON ss.class_id=c.id
         ORDER BY ss.created_at DESC`;
    return classId ? dbAll(sql, [classId]) : dbAll(sql);
  });

  ipcMain.handle('get-station-session', async (_, id) =>
    dbGet('SELECT * FROM station_sessions WHERE id=?', [id]));

  ipcMain.handle('save-station-session', async (_, { id, name, classId, stations, groups, groupLeaders, rotationPlan, minutesPerStation, secondsPerStation, noTimer }) => {
    const s = JSON.stringify(stations ?? []);
    const g = JSON.stringify(groups ?? []);
    const gl = JSON.stringify(groupLeaders ?? []);
    const r = JSON.stringify(rotationPlan ?? []);
    const nt = noTimer ? 1 : 0;
    if (id) return dbRun(
      'UPDATE station_sessions SET name=?,stations=?,groups=?,group_leaders=?,rotation_plan=?,minutes_per_station=?,seconds_per_station=?,no_timer=? WHERE id=?',
      [name, s, g, gl, r, minutesPerStation ?? 10, secondsPerStation ?? 0, nt, id]);
    return dbRun(
      'INSERT INTO station_sessions (name,class_id,stations,groups,group_leaders,rotation_plan,minutes_per_station,seconds_per_station,no_timer) VALUES (?,?,?,?,?,?,?,?,?)',
      [name, classId, s, g, gl, r, minutesPerStation ?? 10, secondsPerStation ?? 0, nt]);
  });

  ipcMain.handle('delete-station-session', async (_, id) =>
    dbRun('DELETE FROM station_sessions WHERE id=?', [id]));

  // ---- Restart (for auto-update) ----
  ipcMain.on('restart-app', () => {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.quitAndInstall();
  });
}

module.exports = { registerHandlers };
