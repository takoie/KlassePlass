/**
 * window-manager.js — Oppretting og lifecycle for Electron-vinduer.
 * winRef.win og winRef.presentationWin er delt referanse.
 */

const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

/** Delt referanse til vinduer — slik at ipc-handlers.js kan lese dem */
const winRef = { win: null, presentationWin: null };

function createMainWindow() {
  winRef.win = new BrowserWindow({
    width: 1400,
    height: 820,
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    frame: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  winRef.win.loadFile(path.join(__dirname, '..', 'index.html'));
  return winRef.win;
}

function registerPresentationHandler() {
  ipcMain.on('open-presentation', (_, layoutDataJson) => {
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
      transparent: true,
      icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    winRef.presentationWin.loadFile(path.join(__dirname, '..', 'presentation.html'));
    winRef.presentationWin.webContents.once('did-finish-load', () => {
      winRef.presentationWin.webContents.send('render-layout', JSON.parse(layoutDataJson));
    });
    winRef.presentationWin.on('closed', () => { winRef.presentationWin = null; });
  });

  // Forwardér presentation-kommandoer (next/show-all/reset) til presentasjonsvinduet
  ipcMain.on('presentation-cmd', (_, cmd) => {
    winRef.presentationWin?.webContents.send('presentation-cmd', cmd);
  });
}

module.exports = { winRef, createMainWindow, registerPresentationHandler };
