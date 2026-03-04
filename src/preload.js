/**
 * preload.js — contextBridge IPC-bridge.
 * Eksponerer window.api til renderer. Ingen direkte Node.js-tilgang i renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Klasser
  getClasses:       ()       => ipcRenderer.invoke('get-classes'),
  getClass:         (id)     => ipcRenderer.invoke('get-class', id),
  saveClass:        (data)   => ipcRenderer.invoke('save-class', data),
  deleteClass:      (id)     => ipcRenderer.invoke('delete-class', id),

  // Rom
  getRooms:         ()       => ipcRenderer.invoke('get-rooms'),
  getRoom:          (id)     => ipcRenderer.invoke('get-room', id),
  saveRoom:         (data)   => ipcRenderer.invoke('save-room', data),
  deleteRoom:       (id)     => ipcRenderer.invoke('delete-room', id),

  // Klassekart
  getSeatings:      (cid)    => ipcRenderer.invoke('get-seatings', cid),
  getSeating:       (id)     => ipcRenderer.invoke('get-seating', id),
  saveSeating:      (data)   => ipcRenderer.invoke('save-seating', data),
  deleteSeating:    (id)     => ipcRenderer.invoke('delete-seating', id),

  // Constraints
  getConstraints:   (cid)    => ipcRenderer.invoke('get-constraints', cid),
  saveConstraint:   (data)   => ipcRenderer.invoke('save-constraint', data),
  deleteConstraint: (id)     => ipcRenderer.invoke('delete-constraint', id),

  // Historikk
  getHistory:       (cid, n) => ipcRenderer.invoke('get-history', cid, n),

  // Eksport / Import
  exportBundle:     (cid)    => ipcRenderer.invoke('export-bundle', cid),
  importBundle:     (data)   => ipcRenderer.invoke('import-bundle', data),

  // Presentasjonsvindu
  openPresentation: (data)   => ipcRenderer.send('open-presentation', data),
  presentationCmd:  (cmd)    => ipcRenderer.send('presentation-cmd', cmd),

  // Settings
  getSettings:      ()       => ipcRenderer.invoke('get-settings'),
  saveSettings:     (data)   => ipcRenderer.invoke('save-settings', data),

  // Database
  backupDb:         ()       => ipcRenderer.invoke('backup-db'),
  restoreDb:        ()       => ipcRenderer.invoke('restore-db'),
  moveDb:           ()       => ipcRenderer.invoke('move-db'),

  // Auto-update
  onUpdateReady:    (cb)     => ipcRenderer.on('update-ready', (_, info) => cb(info)),
  restartApp:       ()       => ipcRenderer.send('restart-app'),

  // Window controls
  minimizeWindow:   ()       => ipcRenderer.send('window-minimize'),
  maximizeWindow:   ()       => ipcRenderer.send('window-maximize'),
  closeWindow:      ()       => ipcRenderer.send('window-close'),
});
