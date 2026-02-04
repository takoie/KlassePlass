const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'klassekart_database.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS classes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, students TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, layout_data TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS seatings (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        name TEXT, 
        class_id INTEGER, 
        room_id INTEGER, 
        placements TEXT, 
        comment TEXT, 
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  });
}

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 830,
    icon: path.join(__dirname, 'assets/icon.ico'),
    frame: false,
    transparent: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  win.loadFile('index.html');
}

ipcMain.on('app:minimize', () => win.minimize());
ipcMain.on('app:maximize', () => { win.isMaximized() ? win.unmaximize() : win.maximize(); });
ipcMain.on('app:close', () => win.close());

// --- DATABASE HANDLERS ---

// KLASSER
ipcMain.handle('get-classes', async () => new Promise((res, rej) => db.all("SELECT * FROM classes ORDER BY name ASC", [], (err, r) => err ? rej(err) : res(r))));
ipcMain.handle('get-class', async (e, id) => new Promise((res, rej) => db.get("SELECT * FROM classes WHERE id = ?", [id], (err, r) => err ? rej(err) : res(r))));
ipcMain.handle('save-class', async (e, id, name, students) => new Promise((res, rej) => {
  if (id) db.run("UPDATE classes SET name = ?, students = ? WHERE id = ?", [name, students, id], function (err) { err ? rej(err) : res(this.changes); });
  else db.run("INSERT INTO classes (name, students) VALUES (?, ?)", [name, students], function (err) { err ? rej(err) : res(this.lastID); });
}));
ipcMain.handle('delete-class', async (e, id) => new Promise((res, rej) => db.run("DELETE FROM classes WHERE id = ?", [id], (err) => err ? rej(err) : res(true))));

// ROM
ipcMain.handle('get-rooms', async () => new Promise((res, rej) => db.all("SELECT * FROM rooms ORDER BY name ASC", [], (err, r) => err ? rej(err) : res(r))));
ipcMain.handle('save-room', async (e, name, layout) => new Promise((res, rej) => {
  db.run("INSERT INTO rooms (name, layout_data) VALUES (?, ?)", [name, layout], function (err) { err ? rej(err) : res(this.lastID); });
}));
ipcMain.handle('update-room', async (e, id, name, layout) => new Promise((res, rej) => {
  db.run("UPDATE rooms SET name = ?, layout_data = ? WHERE id = ?", [name, layout, id], function (err) { err ? rej(err) : res(this.changes); });
}));
ipcMain.handle('delete-room', async (e, id) => new Promise((res, rej) => db.run("DELETE FROM rooms WHERE id = ?", [id], (err) => err ? rej(err) : res(true))));

// KLASSEKART
ipcMain.handle('get-seatings', async () => new Promise((res, rej) => {
  const sql = `SELECT seatings.*, classes.name as class_name, rooms.name as room_name 
               FROM seatings 
               LEFT JOIN classes ON seatings.class_id = classes.id 
               LEFT JOIN rooms ON seatings.room_id = rooms.id 
               ORDER BY seatings.created_at DESC`;
  db.all(sql, [], (err, r) => err ? rej(err) : res(r));
}));

ipcMain.handle('save-seating', async (e, id, name, classId, roomId, placements, comment) => new Promise((res, rej) => {
  if (id) {
    db.run("UPDATE seatings SET name=?, placements=?, comment=? WHERE id=?", [name, placements, comment, id], function (err) { err ? rej(err) : res(true); });
  } else {
    db.run("INSERT INTO seatings (name, class_id, room_id, placements, comment) VALUES (?, ?, ?, ?, ?)", [name, classId, roomId, placements, comment], function (err) { err ? rej(err) : res(this.lastID); });
  }
}));

ipcMain.handle('delete-seating', async (e, id) => new Promise((res, rej) => db.run("DELETE FROM seatings WHERE id = ?", [id], (err) => err ? rej(err) : res(true))));

// BRANCHING / DUPLISERING
ipcMain.handle('duplicate-seating', async (e, originalId, newName) => new Promise((res, rej) => {
  if (!originalId) return rej(new Error("Missing ID"));

  db.get("SELECT * FROM seatings WHERE id = ?", [originalId], (err, row) => {
    if (err) return rej(err);
    if (!row) return rej(new Error("Fant ikke klassekartet for kopiering"));

    db.run("INSERT INTO seatings (name, class_id, room_id, placements, comment) VALUES (?, ?, ?, ?, ?)",
      [newName, row.class_id, row.room_id, row.placements, row.comment], function (err2) {
        if (err2) rej(err2);
        else res(this.lastID);
      });
  });
}));

app.whenReady().then(() => { initDatabase(); createWindow(); });
app.on('window-all-closed', () => { db.close(); app.quit(); });