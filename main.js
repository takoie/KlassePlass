/**
 * main.js — Electron bootstrap. Maks 40 linjer.
 * All logikk er splittet til src/db.js, src/ipc-handlers.js,
 * src/updater.js og src/window-manager.js.
 */

const { app } = require('electron');
const { initDb, getDb } = require('./src/db.js');
const { registerHandlers } = require('./src/ipc-handlers.js');
const { setupUpdater } = require('./src/updater.js');
const { winRef, createMainWindow } = require('./src/window-manager.js');

// Uten dette bruker `npm start` og en installert exe samme userData-mappe
// (begge faller tilbake til package.json sitt "name"-felt), slik at en
// fersk build ved en feiltakelse laster utviklerens database. Kun
// utviklingsmodus flyttes — den installerte appens mappe røres ikke, siden
// eksisterende brukere allerede har data der.
if (!app.isPackaged) {
  app.setName('KlassePlass-dev');
}

app.whenReady().then(async () => {
  await initDb();
  registerHandlers(winRef);
  createMainWindow();
  setupUpdater(winRef);
});

app.on('window-all-closed', () => {
  getDb()?.close();
  app.quit();
});
