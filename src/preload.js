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

  // Settings
  getSettings:      ()       => ipcRenderer.invoke('get-settings'),
  saveSettings:     (data)   => ipcRenderer.invoke('save-settings', data),

  // Database
  backupDb:         ()       => ipcRenderer.invoke('backup-db'),
  restoreDb:        ()       => ipcRenderer.invoke('restore-db'),
  moveDb:           ()       => ipcRenderer.invoke('move-db'),

  // Print / PDF-eksport
  exportPrintPdf:   (data)   => ipcRenderer.invoke('print:export-pdf', data),
  openPath:         (path)   => ipcRenderer.invoke('print:open-path', path),
  showInFolder:     (path)   => ipcRenderer.invoke('print:show-in-folder', path),

  // Auto-update
  onUpdateReady:    (cb)     => ipcRenderer.on('update-ready', (_, info) => cb(info)),
  restartApp:       ()       => ipcRenderer.send('restart-app'),

  // Gruppearbeid
  getGroupAssignments:      (cid)    => ipcRenderer.invoke('get-group-assignments', cid),
  getGroupAssignment:       (id)     => ipcRenderer.invoke('get-group-assignment', id),
  saveGroupAssignment:      (d)      => ipcRenderer.invoke('save-group-assignment', d),
  deleteGroupAssignment:    (id)     => ipcRenderer.invoke('delete-group-assignment', id),
  getGroupAssignmentGroups: (id)     => ipcRenderer.invoke('get-group-assignment-groups', id),
  getGroupHistory:          (cid, n) => ipcRenderer.invoke('get-group-history', cid, n),
  saveGroupHistory:         (d)      => ipcRenderer.invoke('save-group-history', d),

  // Stasjonsundervisning
  getStationSessions:   (cid)   => ipcRenderer.invoke('get-station-sessions', cid),
  getStationSession:    (id)    => ipcRenderer.invoke('get-station-session', id),
  saveStationSession:   (d)     => ipcRenderer.invoke('save-station-session', d),
  deleteStationSession: (id)    => ipcRenderer.invoke('delete-station-session', id),

  // App info
  getVersion:       ()       => ipcRenderer.invoke('get-version'),
  getMigrationInfo: ()       => ipcRenderer.invoke('get-migration-info'),

  // Window controls
  minimizeWindow:   ()       => ipcRenderer.send('window-minimize'),
  maximizeWindow:   ()       => ipcRenderer.send('window-maximize'),
  closeWindow:      ()       => ipcRenderer.send('window-close'),
});
