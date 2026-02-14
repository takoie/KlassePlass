# Backend Agent - KlassePlass

## Formål
Denne agenten overvåker og dokumenterer backend-arkitekturen for KlassePlass.

---

## Arkitektur

### 🏗️ Stack
- **Platform:** Electron 28.0.0
- **Database:** SQLite3 v5.1.7
- **IPC:** Electron IPC (Inter-Process Communication)
- **Main Process:** `main.js`

---

## Database

### 📊 Schema

**Schema Version:** 1.0.0 (Initial)

> **Note:** Ved fremtidige schema-endringer, opprett `schema_version` tabell for versjonshåndtering (se TAK-33)

#### Tabell: `classes`
```sql
CREATE TABLE classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  students TEXT  -- JSON array
)
```

#### Tabell: `rooms`
```sql
CREATE TABLE rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  layout_data TEXT  -- JSON object
)
```

#### Tabell: `seatings`
```sql
CREATE TABLE seatings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  class_id INTEGER,
  room_id INTEGER,
  placements TEXT,  -- JSON object
  comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### 📍 Database Location
```javascript
const dbPath = path.join(app.getPath('userData'), 'klassekart_database.db');
```
Lagres i brukerens AppData-mappe for å sikre skrivetilgang.

---

## IPC Handlers

### 📚 Classes

| Handler | Type | Beskrivelse |
|---------|------|-------------|
| `get-classes` | handle | Henter alle klasser (ASC) |
| `get-class` | handle | Henter én klasse by ID |
| `save-class` | handle | Oppretter/oppdaterer klasse |
| `delete-class` | handle | Sletter klasse |

**Eksempel:**
```javascript
ipcMain.handle('save-class', async (e, id, name, students) => {
  // INSERT or UPDATE logic
});
```

### 🏠 Rooms

| Handler | Type | Beskrivelse |
|---------|------|-------------|
| `get-rooms` | handle | Henter alle rom (ASC) |
| `save-room` | handle | Oppretter nytt rom |
| `update-room` | handle | Oppdaterer eksisterende rom |
| `delete-room` | handle | Sletter rom |

### 🗺️ Seatings (Klassekart)

| Handler | Type | Beskrivelse |
|---------|------|-------------|
| `get-seatings` | handle | Henter alle klassekart med JOIN |
| `save-seating` | handle | Lagrer/oppdaterer klassekart |
| `delete-seating` | handle | Sletter ett klassekart |
| `delete-seating-history` | handle | Sletter all historikk for kombinasjon |
| `duplicate-seating` | handle | Dupliserer klassekart (ny periode) |

**JOIN eksempel:**
```sql
SELECT seatings.*, classes.name as class_name, rooms.name as room_name 
FROM seatings 
LEFT JOIN classes ON seatings.class_id = classes.id 
LEFT JOIN rooms ON seatings.room_id = rooms.id 
ORDER BY seatings.created_at DESC
```

### 💾 Database Backup/Restore/Move

| Handler | Type | Beskrivelse |
|---------|------|-------------|
| `backup-database` | handle | Backup database til valgt lokasjon |
| `restore-database` | handle | Gjenopprett database fra backup-fil |
| `move-database` | handle | Flytt database til ny plassering |
| `get-db-path` | handle | Henter database-filsti |

**Backup Handler:**
```javascript
ipcMain.handle('backup-database', async () => {
  // Viser save dialog med foreslått filnavn: klassekart_backup_YYYY-MM-DD.db
  // Kopierer klassekart_database.db til valgt lokasjon
  // Returnerer { success, filePath, filename } eller { success: false, error }
});
```

**Restore Handler:**
```javascript
ipcMain.handle('restore-database', async () => {
  // Viser open dialog for .db filer
  // Validerer filstørrelse (max 100MB)
  // Lukker database connection
  // Backup av eksisterende database til .backup
  // Kopierer valgt fil til database-lokasjon
  // Åpner ny database connection
  // Rollback ved feil
  // Returnerer { success } eller { success: false, error }
});
```

**Move Handler:**
```javascript
ipcMain.handle('move-database', async () => {
  // Viser folder selection dialog
  // Tester skrivetilgang i ny plassering
  // Lukker database connection
  // Kopierer database til ny plassering
  // Verifiserer at kopieringen var vellykket
  // Sletter gammel database-fil
  // Lagrer ny plassering i db-location.json config-fil
  // Returnerer { success, newPath, requiresRestart } eller { success: false, error }
});
```

**Get DB Path Handler:**
```javascript
ipcMain.handle('get-db-path', async () => {
  return dbPath; // Returnerer full sti til database
});
```

**Database Path Resolution ved Oppstart:**
```javascript
function getDbPath() {
  // Leser db-location.json config-fil
  // Hvis custom plassering finnes og er gyldig, bruk den
  // Ellers bruk default plassering i userData
  return customPath || defaultPath;
}
```

**Sikkerhet og Feilhåndtering:**
- Filstørrelse-validering (max 100MB) før restore
- Automatisk backup av eksisterende database før restore og move
- Rollback til backup ved feil
- Skrivetilgang-test før flytting
- Filstørrelse-verifisering etter kopiering
- Safe database connection close/reopen
- Persistent lagring av custom database-plassering
- Comprehensive error handling med beskrivende meldinger

**Move Database Use Cases:**
- Flytte til ekstern harddisk
- Flytte til sky-synkronisert mappe (OneDrive, Dropbox, Google Drive)
- Flytte til annen partisjon med mer plass
- Sentralisere for organisatoriske backup-rutiner

---

## Window Management

### 🪟 Window Controls

| Event | Type | Beskrivelse |
|-------|------|-------------|
| `app:minimize` | on | Minimerer vindu |
| `app:maximize` | on | Maksimerer/gjenoppretter |
| `app:close` | on | Lukker vindu |

### 🖥️ Presentation Window

```javascript
ipcMain.on('open-presentation-window', (event, layoutData) => {
  // Åpner nytt frameless, transparent vindu
  // Laster presentation.html
});
```

**Egenskaper:**
- Frameless window
- Transparent background
- Independent window lifecycle

---

## Data Formats

### Students (JSON Array)
```json
["Ola Nordmann", "Kari Hansen", "Per Jensen"]
```

### Layout Data (JSON Object)
```json
{
  "desks": [
    {"x": 100, "y": 150, "num": 1},
    {"x": 200, "y": 150, "num": 2}
  ]
}
```

### Placements (JSON Object)
```json
{
  "0": {"student": "Ola Nordmann", "color": "default", "locked": false, "note": "", "group": "1"},
  "1": {"student": "Kari Hansen", "color": "blue", "locked": true, "note": "Trenger hjelp"}
}
```

---

## Retningslinjer

### ✅ Best Practices
- Bruk Promises for alle database-operasjoner
- Returner spesifikke feilmeldinger
- Valider input før database-kall
- Bruk `db.serialize()` for initialisering
- Lukk database ved `app.quit()`

### ❌ Unngå
- Synkrone database-operasjoner
- Storing sensitive data uten kryptering
- Direkte SQL injection vulnerabilities

---

## Sjekkliste for nye handlers

- [ ] Error handling med try/catch eller reject
- [ ] Parameter validering
- [ ] Promise-basert return
- [ ] Konsistent naming convention (`kebab-case`)
- [ ] Dokumentert i denne filen
- [ ] Testet med både success og error cases

---

## Feilhåndtering

**Standard pattern:**
```javascript
ipcMain.handle('some-operation', async (e, param) => new Promise((res, rej) => {
  db.run("SQL QUERY", [param], function(err) {
    if (err) return rej(err);
    res(this.lastID); // eller this.changes
  });
}));
```

---

**Sist oppdatert:** 2026-02-12
