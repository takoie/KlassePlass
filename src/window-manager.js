/**
 * window-manager.js — Oppretting og lifecycle for Electron-vinduer.
 * winRef.win og winRef.presentationWin er delt referanse.
 */

const { BrowserWindow, ipcMain, app, screen } = require('electron');
const path = require('path');

/** Delt referanse til vinduer — slik at ipc-handlers.js kan lese dem */
const winRef = { win: null, presentationWin: null };

// Standardstørrelse ved oppstart. Klemmes mot faktisk tilgjengelig
// arbeidsområde slik at vinduet aldri åpnes større enn skjermen selv.
function getInitialWindowSize() {
  const { width: workW, height: workH } = screen.getPrimaryDisplay().workAreaSize;
  const targetW = 1450;
  const targetH = 850;
  return {
    width: Math.min(targetW, workW - 20),
    height: Math.min(targetH, workH - 20),
  };
}

function createMainWindow() {
  const { width, height } = getInitialWindowSize();
  winRef.win = new BrowserWindow({
    width,
    height,
    minWidth: 1024,
    minHeight: 650,
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    frame: false,
    transparent: true,
    roundedCorners: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (!app.isPackaged) {
    winRef.win.loadURL('http://localhost:3000');
    // Open DevTools by default in dev mode
    winRef.win.webContents.openDevTools();
  } else {
    winRef.win.loadFile(path.join(__dirname, '..', 'dist-react', 'index.html'));
  }

  return winRef.win;
}

function registerPresentationHandler() {
  // We handle presentation window in a similar way, using a React route e.g., /presentation
  ipcMain.on('open-presentation-window', (_, layoutDataJson) => {
    if (winRef.presentationWin && !winRef.presentationWin.isDestroyed()) {
      winRef.presentationWin.focus();
      winRef.presentationWin.webContents.send('render-layout', JSON.parse(layoutDataJson));
      return;
    }

    winRef.presentationWin = new BrowserWindow({
      width: 1280,
      height: 800,
      title: 'KlassePlass Presentasjon',
      frame: false,
      transparent: false,
      backgroundColor: '#16181d',
      icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    if (!app.isPackaged) {
      winRef.presentationWin.loadURL('http://localhost:3000/#/presentation');
    } else {
      winRef.presentationWin.loadFile(path.join(__dirname, '..', 'dist-react', 'index.html'), { hash: 'presentation' });
    }

    winRef.presentationWin.webContents.once('did-finish-load', () => {
      winRef.presentationWin.webContents.send('render-layout', JSON.parse(layoutDataJson));
    });
    winRef.presentationWin.on('closed', () => { winRef.presentationWin = null; });
  });

  // Forwardér presentation-kommandoer (next/show-all/reset) til presentasjonsvinduet
  ipcMain.on('presentation-cmd', (_, cmd) => {
    winRef.presentationWin?.webContents.send('presentation-cmd', cmd);
  });

  // Synkroniser tema-endringer fra hovedvinduet til presentasjonsvinduet
  ipcMain.on('sync-presentation-theme', (_, themeData) => {
    if (winRef.presentationWin && !winRef.presentationWin.isDestroyed()) {
      winRef.presentationWin.webContents.send('apply-theme', themeData);
    }
  });
}

module.exports = { winRef, createMainWindow, registerPresentationHandler };
