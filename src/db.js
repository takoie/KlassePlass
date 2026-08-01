const path    = require('path');
const fs      = require('fs');
const initSqlJs = require('sql.js');
const { app } = require('electron');
const { runMigrations, migrateRoomLayouts, CURRENT_VERSION } = require('../db/schema.js');

let db = null;
let dbPath = null;
let SQL = null;
let lastMigrationInfo = null;

/** Leser høyeste schema_version fra en åpen db. 0 hvis tabellen mangler/er tom. */
function getSchemaVersion(db) {
  try {
    const stmt = db.prepare('SELECT MAX(version) as v FROM schema_version');
    stmt.step();
    const version = stmt.getAsObject().v;
    stmt.free();
    return version || 0;
  } catch {
    return 0;
  }
}

function getDbPath() {
  const configPath = path.join(app.getPath('userData'), 'db-location.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.dbPath && fs.existsSync(config.dbPath)) return config.dbPath;
    } catch { /* fall through */ }
  }
  return path.join(app.getPath('userData'), 'klassekart_database.db');
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  const p = getSettingsPath();
  if (fs.existsSync(p)) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { /* fall through */ }
  }
  return { theme: 'dark', colorTheme: 'night', canvasBg: 'solid', defaultFlipDisplay: false, onboardingCompleted: false };
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch { return false; }
}

async function initDb() {
  dbPath = getDbPath();
  console.log('Database:', dbPath);
  
  SQL = await initSqlJs();
  lastMigrationInfo = null;
  if (fs.existsSync(dbPath)) {
    const filebuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(filebuffer);

    // Databasen fantes fra før og skal til en nyere schema-versjon:
    // ta en sikkerhetskopi før migrations kjøres, og varsle renderer om det.
    const fromVersion = getSchemaVersion(db);
    if (fromVersion > 0 && fromVersion < CURRENT_VERSION) {
      const backupPath = dbPath.replace(/\.db$/i, '') + `.v${fromVersion}-backup-${Date.now()}.db`;
      fs.copyFileSync(dbPath, backupPath);
      lastMigrationInfo = { fromVersion, toVersion: CURRENT_VERSION, backupPath };
    }
  } else {
    db = new SQL.Database();
  }

  await runMigrations(db);
  await migrateRoomLayouts(db);
  saveDbToDisk();
  return db;
}

function getMigrationInfo() { return lastMigrationInfo; }

function saveDbToDisk() {
  if (!db || !dbPath) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function getDb()     { return db; }
function getDbPathFn() { return dbPath; }

module.exports = { initDb, getDb, getDbPathFn, loadSettings, saveSettings, saveDbToDisk, getMigrationInfo };
