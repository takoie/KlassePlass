/**
 * tauriApi.js — Tauri-adapter som speiler `src/preload.js` sin `window.api`-
 * kontrakt 1:1, slik at samtlige ~50+ komponentfiler som kaller
 * `window.api.*` kan kjøre uendret under Tauri.
 *
 * Metodene under er delt i tre grupper:
 *
 * 1. Ekte CRUD-metoder (Klasser/Rom/Klassekart/Constraints/Settings/
 *    Gruppearbeid/Stasjonsundervisning/App info) — disse kaller `invoke()`
 *    mot faktiske, allerede-implementerte `#[tauri::command]`-funksjoner i
 *    src-tauri/src/commands/*.rs (Task 2.1/2.2). Parameternavnene i objektet
 *    som sendes til `invoke()` MÅ matche de eksakte Rust-parameternavnene
 *    (Tauri sin JS-bro slår opp nøkler i dette objektet mot funksjonens
 *    parameternavn) — verifisert ved å lese kommando-signaturene direkte,
 *    ikke gjettet.
 *
 * 2. Ikke-implementerte metoder (Database: backupDb/restoreDb/moveDb;
 *    Print: exportPrintPdf/openPath/showInFolder; Auto-update: onUpdateReady/
 *    restartApp) — disse kommandoene finnes IKKE i Rust-backend ennå
 *    (kommer i migrerings-Task 4.1/5.1/7.1). Vi kaller dem IKKE via
 *    `invoke()` (det ville gitt en kryptisk "command not found"-feil uten
 *    kontekst). I stedet returnerer/kaster de en tydelig, diagnostiserbar
 *    feil med referanse til hvilken fremtidig task som vil implementere dem.
 *
 * 3. Window controls (minimizeWindow/maximizeWindow/closeWindow) — disse
 *    trenger ingen egne Tauri-kommandoer. Tauri 2 sin innebygde
 *    vindushåndtering via `@tauri-apps/api/window`s `getCurrentWindow()`
 *    dekker dette direkte.
 */

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

/** Lager en avvist Promise med en tydelig "ikke implementert ennå"-feil. */
function notImplemented(methodName, taskRef) {
  return Promise.reject(
    new Error(`${methodName}: ikke implementert ennå i Tauri-backend (kommer i migrerings-${taskRef})`),
  );
}

const tauriApi = {
  // Klasser
  getClasses: () => invoke('get_classes'),
  getClass: (id) => invoke('get_class', { id }),
  saveClass: (data) => invoke('save_class', { record: data }),
  deleteClass: (id) => invoke('delete_class', { id }),

  // Rom
  getRooms: () => invoke('get_rooms'),
  getRoom: (id) => invoke('get_room', { id }),
  saveRoom: (data) => invoke('save_room', { record: data }),
  deleteRoom: (id) => invoke('delete_room', { id }),

  // Klassekart
  getSeatings: (cid) => invoke('get_seatings', { classId: cid }),
  getSeating: (id) => invoke('get_seating', { id }),
  saveSeating: (data) => invoke('save_seating', { record: data }),
  deleteSeating: (id) => invoke('delete_seating', { id }),

  // Constraints
  getConstraints: (cid) => invoke('get_constraints', { classId: cid }),

  // Settings
  getSettings: () => invoke('get_settings'),
  saveSettings: (data) => invoke('save_settings', { update: data }),

  // Database — kommandoer finnes ikke ennå i Rust-backend (Task 4.1).
  backupDb: () => notImplemented('backupDb', 'Task 4.1'),
  restoreDb: () => notImplemented('restoreDb', 'Task 4.1'),
  moveDb: () => notImplemented('moveDb', 'Task 4.1'),

  // Print / PDF-eksport — kommandoer finnes ikke ennå i Rust-backend (Task 5.1/6).
  exportPrintPdf: (data) => notImplemented('exportPrintPdf', 'Task 6'),
  openPath: (path) => notImplemented('openPath', 'Task 5.1'),
  showInFolder: (path) => notImplemented('showInFolder', 'Task 5.1'),

  // Auto-update — ikke implementert ennå i Tauri-backend (Task 7.1). Electrons
  // update-ready-event og restart-app-IPC har ingen Tauri-motpart ennå.
  onUpdateReady: (cb) => {
    // Bevisst no-op fremfor å kaste: preload sin onUpdateReady abonnerer bare
    // på en fremtidig hendelse og forventer ingen returverdi/synkron effekt,
    // så en kastet feil her ville krasjet oppstart av komponenter som bare
    // "abonnerer og glemmer". Ikke implementert ennå (Task 7.1).
    console.warn('onUpdateReady: ikke implementert ennå i Tauri-backend (kommer i migrerings-Task 7.1)');
    return () => {};
  },
  restartApp: () => notImplemented('restartApp', 'Task 7.1'),

  // Gruppearbeid
  getGroupAssignments: (cid) => invoke('get_group_assignments', { classId: cid }),
  getGroupAssignment: (id) => invoke('get_group_assignment', { id }),
  saveGroupAssignment: (d) => invoke('save_group_assignment', { input: d }),
  deleteGroupAssignment: (id) => invoke('delete_group_assignment', { id }),
  getGroupAssignmentGroups: (id) => invoke('get_group_assignment_groups', { assignmentId: id }),
  getGroupHistory: (cid, n) => invoke('get_group_history', { classId: cid, n }),
  saveGroupHistory: (d) => invoke('save_group_history', { input: d }),

  // Stasjonsundervisning
  getStationSessions: (cid) => invoke('get_station_sessions', { classId: cid }),
  getStationSession: (id) => invoke('get_station_session', { id }),
  saveStationSession: (d) => invoke('save_station_session', { input: d }),
  deleteStationSession: (id) => invoke('delete_station_session', { id }),

  // App info
  getVersion: () => invoke('get_version'),
  getMigrationInfo: () => invoke('get_migration_info'),

  // Window controls — Tauri 2 sin innebygde vindushåndtering, ingen egne
  // kommandoer nødvendig.
  minimizeWindow: () => getCurrentWindow().minimize(),
  maximizeWindow: async () => {
    const win = getCurrentWindow();
    // Speiler Electrons window-maximize-handler, som toggler mellom
    // maximize/unmaximize basert på gjeldende tilstand.
    if (await win.isMaximized()) {
      return win.unmaximize();
    }
    return win.maximize();
  },
  closeWindow: () => getCurrentWindow().close(),
};

export default tauriApi;
