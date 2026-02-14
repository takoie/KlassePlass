const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// --- SETTINGS MANAGEMENT ---
function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  const settingsPath = getSettingsPath();
  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (err) {
      console.error('Error reading settings.json:', err);
    }
  }
  // Default settings
  return {
    defaultFlipped: false,
    onboardingCompleted: false
  };
}

function saveSettings(settings) {
  const settingsPath = getSettingsPath();
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing settings.json:', err);
    return false;
  }
}

// --- DATABASE LOCATION SETUP ---
// Check if user has moved database to custom location
function getDbPath() {
  const configPath = path.join(app.getPath('userData'), 'db-location.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.dbPath && fs.existsSync(config.dbPath)) {
        return config.dbPath;
      }
    } catch (err) {
      console.error('Error reading db-location.json:', err);
    }
  }
  // Default location in AppData
  return path.join(app.getPath('userData'), 'klassekart_database.db');
}

const dbPath = getDbPath();
const db = new sqlite3.Database(dbPath);

console.log("Databasen ligger her:", dbPath); // Viser stien i terminalen ved oppstart

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
    width: 1400, height: 820,
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
ipcMain.handle('get-room', async (e, id) => new Promise((res, rej) => db.get("SELECT * FROM rooms WHERE id = ?", [id], (err, r) => err ? rej(err) : res(r))));
ipcMain.handle('save-room', async (e, name, layout) => new Promise((res, rej) => {
  db.run("INSERT INTO rooms (name, layout_data) VALUES (?, ?)", [name, layout], function (err) { err ? rej(err) : res(this.lastID); });
}));
ipcMain.handle('update-room', async (e, id, name, layout) => new Promise((res, rej) => {
  db.run("UPDATE rooms SET name = ?, layout_data = ? WHERE id = ?", [name, layout, id], function (err) { err ? rej(err) : res(this.changes); });
}));
ipcMain.handle('delete-room', async (e, id) => new Promise((res, rej) => db.run("DELETE FROM rooms WHERE id = ?", [id], (err) => err ? rej(err) : res(true))));

// Migrer rom-struktur til ny format med designMode
ipcMain.handle('migrate-room-structure', async () => new Promise((res, rej) => {
  db.all("SELECT * FROM rooms", [], (err, rooms) => {
    if (err) return rej(err);
    
    let migrated = 0;
    const promises = rooms.map(room => {
      return new Promise((resolve, reject) => {
        try {
          const layout = JSON.parse(room.layout_data);
          
          // Check if already migrated
          if (layout.designMode !== undefined) {
            return resolve();
          }
          
          // Old format: array of desks
          if (Array.isArray(layout)) {
            const newLayout = {
              desks: layout,
              designMode: 'board-top' // Default for existing rooms
            };
            
            db.run("UPDATE rooms SET layout_data = ? WHERE id = ?", 
              [JSON.stringify(newLayout), room.id], 
              (updateErr) => {
                if (updateErr) reject(updateErr);
                else {
                  migrated++;
                  resolve();
                }
              }
            );
          } else {
            resolve();
          }
        } catch (parseErr) {
          reject(parseErr);
        }
      });
    });
    
    Promise.all(promises)
      .then(() => res({ success: true, migrated }))
      .catch(rej);
  });
}));

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

// NY: Slett all historikk for en kombinasjon
ipcMain.handle('delete-seating-history', async (e, classId, roomId) => new Promise((res, rej) => {
  db.run("DELETE FROM seatings WHERE class_id = ? AND room_id = ?", [classId, roomId], (err) => err ? rej(err) : res(true));
}));

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

// --- DATABASE BACKUP/RESTORE HANDLERS ---
ipcMain.handle('backup-database', async () => {
  try {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const defaultFilename = `klassekart_backup_${date}.db`;
    
    const result = await dialog.showSaveDialog(win, {
      title: 'Backup database',
      defaultPath: defaultFilename,
      filters: [
        { name: 'Database Files', extensions: ['db'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    // Copy database file to chosen location
    fs.copyFileSync(dbPath, result.filePath);
    
    return { 
      success: true, 
      filePath: result.filePath,
      filename: path.basename(result.filePath)
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('restore-database', async () => {
  try {
    const result = await dialog.showOpenDialog(win, {
      title: 'Gjenopprett database',
      filters: [
        { name: 'Database Files', extensions: ['db'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    const selectedFile = result.filePaths[0];
    
    // Validate file size (reject files > 100MB)
    const stats = fs.statSync(selectedFile);
    if (stats.size > 100 * 1024 * 1024) {
      return { success: false, error: 'Filen er for stor (maks 100MB)' };
    }

    // Close database connection
    await new Promise((resolve, reject) => {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Backup current database before replacing
    const backupPath = dbPath + '.backup';
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath);
    }

    // Copy selected file to database location
    fs.copyFileSync(selectedFile, dbPath);

    // Reopen database connection
    const newDb = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        // Restore from backup if opening fails
        if (fs.existsSync(backupPath)) {
          fs.copyFileSync(backupPath, dbPath);
        }
        throw err;
      }
    });

    // Replace global db reference
    Object.assign(db, newDb);

    // Clean up backup file
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-db-path', async () => {
  return dbPath;
});

ipcMain.handle('move-database', async () => {
  try {
    const result = await dialog.showOpenDialog(win, {
      title: 'Velg ny plassering for database',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    const newDirectory = result.filePaths[0];
    const newDbPath = path.join(newDirectory, 'klassekart_database.db');
    
    // Check if file already exists at new location
    if (fs.existsSync(newDbPath)) {
      return { success: false, error: 'En database finnes allerede på denne plasseringen' };
    }

    // Test write permissions in new location
    try {
      const testFile = path.join(newDirectory, '.write_test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
    } catch (err) {
      return { success: false, error: 'Ingen skrivetilgang til valgt plassering' };
    }

    // Close database connection
    await new Promise((resolve, reject) => {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Create backup before moving
    const backupPath = dbPath + '.pre-move-backup';
    fs.copyFileSync(dbPath, backupPath);

    try {
      // Copy database to new location
      fs.copyFileSync(dbPath, newDbPath);
      
      // Verify the copy was successful by checking file size
      const oldStats = fs.statSync(dbPath);
      const newStats = fs.statSync(newDbPath);
      
      if (oldStats.size !== newStats.size) {
        throw new Error('Filstørrelse matcher ikke etter kopiering');
      }

      // Delete old database file
      fs.unlinkSync(dbPath);
      
      // Save new path to config file for next startup
      const configPath = path.join(app.getPath('userData'), 'db-location.json');
      fs.writeFileSync(configPath, JSON.stringify({ dbPath: newDbPath }));

      // Clean up backup
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }

      console.log('Database moved successfully to', newDbPath);

      return { 
        success: true, 
        newPath: newDbPath,
        requiresRestart: true
      };
    } catch (error) {
      // Restore from backup if something went wrong
      if (fs.existsSync(backupPath)) {
        if (!fs.existsSync(dbPath)) {
          fs.copyFileSync(backupPath, dbPath);
        }
        fs.unlinkSync(backupPath);
      }
      
      // Reopen database at old location
      const oldDb = new sqlite3.Database(dbPath);
      Object.assign(db, oldDb);
      
      throw error;
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// --- PRESENTATION WINDOW HANDLER ---
ipcMain.on('open-presentation-window', (event, layoutData) => {
  let presentationWin = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "KlassePlass Presentasjon",
    frame: false,           // Rammeløst vindu
    transparent: true,      // Gjennomsiktig bakgrunn (krever at backgroundColor ikke er satt)
    icon: path.join(__dirname, 'assets/icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  presentationWin.loadFile('presentation.html');

  presentationWin.webContents.on('did-finish-load', () => {
    presentationWin.webContents.send('render-layout', JSON.parse(layoutData));
  });
});

app.whenReady().then(() => { 
  // Register settings handlers after app is ready
  ipcMain.handle('get-settings', async () => {
    return loadSettings();
  });

  ipcMain.handle('save-setting', async (e, key, value) => {
    const settings = loadSettings();
    settings[key] = value;
    return saveSettings(settings);
  });

  ipcMain.handle('get-setting', async (e, key) => {
    const settings = loadSettings();
    return settings[key];
  });

  initDatabase(); 
  createWindow(); 
});

app.on('window-all-closed', () => { db.close(); app.quit(); });