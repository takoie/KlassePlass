/**
 * updater.js — electron-updater logikk.
 * Sjekker for oppdateringer og sender melding til renderer når klar.
 */

const { autoUpdater } = require('electron-updater');

function setupUpdater(winRef) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', (info) => {
    if (winRef.win) {
      winRef.win.webContents.send('update-ready', { version: info.version });
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err?.message ?? err);
  });

  autoUpdater.checkForUpdatesAndNotify().catch(() => {
    // Stille feil ved manglende nettverkstilgang / utvikling uten GitHub release
  });
}

module.exports = { setupUpdater };
