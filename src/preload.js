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
  saveHistory:      (data)   => ipcRenderer.invoke('save-history', data),
  duplicateSeating: (data)   => ipcRenderer.invoke('duplicate-seating', data),

  // Eksport / Import
  exportBundle:     (cid)    => ipcRenderer.invoke('export-bundle', cid),
  importBundle:     (data)   => ipcRenderer.invoke('import-bundle', data),

  // Presentasjonsvindu
  openPresentation:       (data)   => ipcRenderer.send('open-presentation', data),
  presentationCmd:        (cmd)    => ipcRenderer.send('presentation-cmd', cmd),
  syncPresentationTheme:  (data)   => ipcRenderer.send('sync-presentation-theme', data),

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

  // Deltakelseslogg
  getParticipation:        (sid, date) => ipcRenderer.invoke('get-participation', sid, date),
  saveParticipation:       (d)         => ipcRenderer.invoke('save-participation', d),
  getParticipationSummary: (sid)       => ipcRenderer.invoke('get-participation-summary', sid),
  clearParticipation:      (sid, date) => ipcRenderer.invoke('clear-participation', sid, date),

  // Timeplan
  getSchedule:          ()      => ipcRenderer.invoke('get-schedule'),
  saveScheduleEntry:    (d)     => ipcRenderer.invoke('save-schedule-entry', d),
  deleteScheduleEntry:  (id)    => ipcRenderer.invoke('delete-schedule-entry', id),

  // Stasjonsundervisning
  getStationSessions:   (cid)   => ipcRenderer.invoke('get-station-sessions', cid),
  getStationSession:    (id)    => ipcRenderer.invoke('get-station-session', id),
  saveStationSession:   (d)     => ipcRenderer.invoke('save-station-session', d),
  deleteStationSession: (id)    => ipcRenderer.invoke('delete-station-session', id),

  // App info
  getVersion:       ()       => ipcRenderer.invoke('get-version'),
  getDbPath:        ()       => ipcRenderer.invoke('get-db-path'),

  // Window controls
  minimizeWindow:   ()       => ipcRenderer.send('window-minimize'),
  maximizeWindow:   ()       => ipcRenderer.send('window-maximize'),
  closeWindow:      ()       => ipcRenderer.send('window-close'),
});
