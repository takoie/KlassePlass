/**
 * window-manager.js — Oppretting og lifecycle for Electron-vinduer.
 * winRef.win er delt referanse.
 */

const { BrowserWindow, app, screen, shell } = require('electron');
const path = require('path');

/** Delt referanse til vinduer — slik at ipc-handlers.js kan lese dem */
const winRef = { win: null };

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

  // Frameless vinduer maksimerer seg over taskbaren på Windows (kjent Electron-bug:
  // native maximize() bruker skjermens fulle bounds i stedet for workArea når frame:false).
  // Tving vinduet til workArea (ekskl. taskbar) hver gang det maksimeres.
  winRef.win.on('maximize', () => {
    const { workArea } = screen.getDisplayMatching(winRef.win.getBounds());
    winRef.win.setBounds(workArea);
  });

  // Lenker med target="_blank" (og mailto:) skal åpnes i systemets nettleser/e-postklient,
  // ikke i et nytt, uhåndtert Electron-vindu.
  winRef.win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
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

module.exports = { winRef, createMainWindow };
