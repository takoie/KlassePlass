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
