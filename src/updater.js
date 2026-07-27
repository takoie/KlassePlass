/**
 * updater.js — electron-updater logikk.
 * Sjekker for oppdateringer og sender melding til renderer når klar.
 */

function setupUpdater(winRef) {
  // Lazy require: electron-updater instansierer NsisUpdater ved property-access
  // på `autoUpdater`, og den konstruktøren leser `app.getVersion()` med en gang.
  // Kravd for tidlig (modul-nivå, før app.whenReady()) ga `app` som undefined
  // og krasjet hele prosessen ved oppstart.
  const { autoUpdater } = require('electron-updater');

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
