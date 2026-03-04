/**
 * main.js — Electron bootstrap. Maks 40 linjer.
 * All logikk er splittet til src/db.js, src/ipc-handlers.js,
 * src/updater.js og src/window-manager.js.
 */

const { app } = require('electron');
const { initDb, getDb } = require('./src/db.js');
const { registerHandlers } = require('./src/ipc-handlers.js');
const { setupUpdater } = require('./src/updater.js');
const { winRef, createMainWindow, registerPresentationHandler } = require('./src/window-manager.js');

app.whenReady().then(async () => {
  await initDb();
  registerHandlers(winRef);
  registerPresentationHandler();
  createMainWindow();
  setupUpdater(winRef);
});

app.on('window-all-closed', () => {
  getDb()?.close();
  app.quit();
});
