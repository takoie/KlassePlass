/**
 * ipc-handlers.js — Alle ipcMain.handle/on registreringer.
 * Importerer db og settings fra db.js. Maks 300 linjer.
 */

const { ipcMain, dialog, app } = require('electron');
const path    = require('path');
const fs      = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { getDb, getDbPathFn, loadSettings, saveSettings } = require('./db.js');

/** Hjelpefunksjon: pakk db.all/get/run inn i Promise */
const dbAll  = (sql, p = []) => new Promise((res, rej) => getDb().all(sql, p, (e, r) => e ? rej(e) : res(r)));
const dbGet  = (sql, p = []) => new Promise((res, rej) => getDb().get(sql, p, (e, r) => e ? rej(e) : res(r)));
const dbRun  = (sql, p = []) => new Promise((res, rej) => getDb().run(sql, p, function(e) { e ? rej(e) : res({ lastID: this.lastID, changes: this.changes }); }));

function registerHandlers(winRef) {
  // ---- Window controls ----
  ipcMain.on('window-minimize', () => winRef.win?.minimize());
  ipcMain.on('window-maximize', () => winRef.win?.isMaximized() ? winRef.win.unmaximize() : winRef.win.maximize());
  ipcMain.on('window-close',    () => winRef.win?.close());

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
  ipcMain.handle('delete-class', async (_, id) => dbRun('DELETE FROM classes WHERE id=?', [id]));

  // ---- Rom ----
  ipcMain.handle('get-rooms', async () => dbAll('SELECT * FROM rooms ORDER BY name ASC'));
  ipcMain.handle('get-room',  async (_, id) => dbGet('SELECT * FROM rooms WHERE id=?', [id]));
  ipcMain.handle('save-room', async (_, { id, name, layoutData }) => {
    const layout = typeof layoutData === 'string' ? layoutData : JSON.stringify(layoutData);
    if (id) return dbRun('UPDATE rooms SET name=?, layout_data=? WHERE id=?', [name, layout, id]);
    return dbRun('INSERT INTO rooms (name, layout_data) VALUES (?,?)', [name, layout]);
  });
  ipcMain.handle('delete-room', async (_, id) => dbRun('DELETE FROM rooms WHERE id=?', [id]));

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

  // ---- Historikk ----
  ipcMain.handle('get-history', async (_, classId, n = 10) =>
    dbAll('SELECT * FROM seating_history WHERE class_id=? ORDER BY created_at DESC LIMIT ?', [classId, n]));

  // Lagre historikk kalles fra save-seating-path (etter lagring)
  ipcMain.handle('save-history', async (_, { classId, chartId, pairs }) =>
    dbRun('INSERT INTO seating_history (class_id, chart_id, pairs) VALUES (?,?,?)',
      [classId, chartId, JSON.stringify(pairs)]));

  // ---- Constraints ----
  ipcMain.handle('get-constraints',    async (_, cid) => dbAll('SELECT * FROM student_constraints WHERE class_id=?', [cid]));
  ipcMain.handle('save-constraint',    async (_, { classId, studentA, studentB, type }) =>
    dbRun('INSERT INTO student_constraints (class_id,student_a,student_b,type) VALUES (?,?,?,?)',
      [classId, studentA, studentB, type]));
  ipcMain.handle('delete-constraint',  async (_, id) => dbRun('DELETE FROM student_constraints WHERE id=?', [id]));

  // ---- Eksport / Import bundle ----
  ipcMain.handle('export-bundle', async (_, classId) => {
    const cls      = await dbGet('SELECT * FROM classes WHERE id=?', [classId]);
    const seatings = await dbAll('SELECT * FROM seatings WHERE class_id=?', [classId]);
    const history  = await dbAll('SELECT * FROM seating_history WHERE class_id=?', [classId]);
    const constr   = await dbAll('SELECT * FROM student_constraints WHERE class_id=?', [classId]);
    return { version: 2, class: cls, seatings, history, constraints: constr, exportedAt: new Date().toISOString() };
  });

  ipcMain.handle('import-bundle', async (_, bundle) => {
    if (!bundle?.class) return { success: false, error: 'Ugyldig bundle' };
    const { lastID: cid } = await dbRun('INSERT INTO classes (name, students) VALUES (?,?)',
      [bundle.class.name + ' (importert)', bundle.class.students]);
    for (const s of bundle.seatings ?? []) {
      const { lastID: sid } = await dbRun(
        'INSERT INTO seatings (name,class_id,room_id,placements,comment,created_at) VALUES (?,?,?,?,?,?)',
        [s.name, cid, s.room_id, s.placements, s.comment ?? '', s.created_at]);
      for (const h of bundle.history?.filter(x => x.chart_id === s.id) ?? []) {
        await dbRun('INSERT INTO seating_history (class_id,chart_id,pairs,created_at) VALUES (?,?,?,?)',
          [cid, sid, h.pairs, h.created_at]);
      }
    }
    return { success: true, newClassId: cid };
  });

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
    if (fs.existsSync(backup)) fs.unlinkSync(backup);
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

  // ---- Restart (for auto-update) ----
  ipcMain.on('restart-app', () => {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.quitAndInstall();
  });
}

module.exports = { registerHandlers };
