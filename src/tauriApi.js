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
 * 2. Auto-update (onUpdateReady/restartApp) — portet i Task 7.1 til
 *    `@tauri-apps/plugin-updater` (pull-basert `check()`/
 *    `downloadAndInstall()`, se `src/tauriUpdater.js`) og
 *    `@tauri-apps/plugin-process` (`relaunch()`). `onUpdateReady` her
 *    delegerer til `tauriUpdater.js` sin callback-registrering, som kalles
 *    når `initAutoUpdateCheck()` (kjørt fra `main.jsx` ved oppstart) har
 *    fullført en vellykket nedlasting+installasjon — samme "registrer og
 *    glem"-kontrakt som Electron-preloadens `onUpdateReady`, så
 *    `UpdateBanner.jsx` er uendret.
 *    (Database: backupDb/restoreDb/moveDb var i denne kategorien frem til
 *    Task 4.1, som portet `src-tauri/src/commands/db_maintenance.rs` — de
 *    kaller nå de ekte `backup_db`/`restore_db`/`move_db`-kommandoene.
 *    Print: openPath/showInFolder var i denne kategorien frem til Task 5.1,
 *    som portet dem til `@tauri-apps/plugin-opener` — se gruppe 4. exportPrintPdf
 *    var i denne kategorien frem til Task 6.3, som portet den ekte
 *    seatingChart-veien til `export_seating_chart_pdf` — station/groupWork
 *    har fortsatt ingen Rust-payload og får en tydelig avvist Promise, se
 *    `exportPrintPdf` under gruppe 4 for detaljer.)
 *
 * 3. Window controls (minimizeWindow/maximizeWindow/closeWindow) — disse
 *    trenger ingen egne Tauri-kommandoer. Tauri 2 sin innebygde
 *    vindushåndtering via `@tauri-apps/api/window`s `getCurrentWindow()`
 *    dekker dette direkte.
 *
 * 4. Shell/OS-integrasjon (openPath/showInFolder) — trenger ingen egen
 *    `#[tauri::command]`-wrapper i det hele tatt (i motsetning til
 *    SQL-baserte kommandoer i gruppe 1). `@tauri-apps/plugin-opener`
 *    eksponerer sin egen JS-API (`openPath`/`revealItemInDir`) som kalles
 *    direkte fra denne adapteren (Task 5.1). Speiler Electrons
 *    `shell.openPath`/`shell.showItemInFolder` fra
 *    `src/ipc-handlers.js:256-264`.
 */

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, currentMonitor } from '@tauri-apps/api/window';
import { openPath as pluginOpenPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import { relaunch } from '@tauri-apps/plugin-process';
import {
  onUpdateReady as onUpdateReadyImpl,
  checkForUpdatesManually,
  downloadAndInstallUpdate,
  simulateUpdateReady
} from './tauriUpdater.js';

// --- Egendefinert maksimer/gjenopprett-tilstand ------------------------
// Tauris native isMaximized() på Windows avgjøres ved å sammenligne
// vindusstørrelsen mot FULL skjermstørrelse (ikke workArea). Et manuelt
// setPosition/setSize-kall til workArea (nødvendig for å unngå at
// rammeløse vinduer maksimerer seg over taskbaren - samme kjente bug som
// den gamle Electron-fiksen i window-manager.js løste) gjør derfor at
// isMaximized() ALDRI igjen kan gjenkjenne vinduet som maksimert, siden
// størrelsen etter korreksjonen aldri matcher full skjermstørrelse. Native
// maximize()/unmaximize()/isMaximized() kan følgelig ikke brukes som
// sannhetskilde her i det hele tatt - vi holder derfor helt selv styr på
// "er maksimert" + de opprinnelige (ikke-maksimerte) bounds, og bruker
// UTELUKKENDE setPosition/setSize for både å maksimere og gjenopprette.
let restoreBounds = null; // { position: PhysicalPosition, size: PhysicalSize } | null - satt når "maksimert"
let lastKnownNormalBounds = null; // cache av siste kjente ikke-maksimerte bounds - dekker at vinduet kan bli native maksimert via dobbeltklikk på tittellinjen/Windows-snap, som omgår knappen (og dermed restoreBounds-fangsten i applyMaximize)
const maximizeListeners = new Set();
const notifyMaximizeListeners = (maximized) => maximizeListeners.forEach((cb) => cb(maximized));

const applyMaximize = async (win) => {
  const monitor = await currentMonitor();
  if (!monitor) return;
  if (!restoreBounds) {
    restoreBounds = lastKnownNormalBounds || {
      position: await win.outerPosition(),
      size: await win.outerSize(),
    };
  }
  await win.setPosition(monitor.workArea.position);
  await win.setSize(monitor.workArea.size);
  notifyMaximizeListeners(true);
};

const applyRestore = async (win) => {
  if (!restoreBounds) return;
  const bounds = restoreBounds;
  restoreBounds = null;
  await win.setPosition(bounds.position);
  await win.setSize(bounds.size);
  notifyMaximizeListeners(false);
};

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
  importConstraints: (classId, constraints) => invoke('import_constraints', { classId, constraints }),

  // Eksport/import
  exportBundle: (bundle, suggestedName) => invoke('export_bundle', { bundle, suggestedName }),
  importBundlePickFile: () => invoke('import_bundle_pick_file'),

  // Settings
  getSettings: () => invoke('get_settings'),
  saveSettings: (data) => invoke('save_settings', { update: data }),

  // Database
  backupDb: () => invoke('backup_db'),
  restoreDb: () => invoke('restore_db'),
  moveDb: () => invoke('move_db'),

  // Print / PDF-eksport (Task 6.3) — `exportPrintPdf` kaller den ekte
  // `export_seating_chart_pdf`-kommandoen (Task 6.3, src-tauri/src/commands/
  // print_export.rs) NÅR `data.contentType === 'seatingChart'` OG
  // `data.payload` faktisk følger med (bygget av `buildSeatingChartPrintPayload`
  // i PrintPreviewModal.jsx sin handleExportPdf). For station/groupWork finnes
  // det INGEN Rust-payload-bygger ennå (se pdf_export.rs sin modul-doc) — de
  // må ALDRI kalle den ekte kommandoen med søppel-/manglende data, så vi
  // returnerer i stedet en avvist Promise med en tydelig, ikke-krasjende
  // feilmelding. PrintPreviewModal.jsx sin handleExportPdf fanger denne og
  // viser den i den allerede eksisterende feil-alerten — "Skriv ut" (window.print())
  // fortsetter å fungere uendret for disse typene uansett.
  //
  // openPath/showInFolder trenger derimot ingen egen `#[tauri::command]` —
  // `@tauri-apps/plugin-opener` eksponerer sin egen JS-API og kalles direkte
  // (Task 5.1). Returverdiene er formet for å matche Electron-preloadens
  // `{ success, error }`-kontrakt, siden plugin-funksjonene selv kaster en
  // Error ved feil i stedet for å returnere en feilstreng slik Electrons
  // `shell.openPath` gjør.
  exportPrintPdf: (data) => {
    if (data?.contentType === 'seatingChart' && data?.payload) {
      return invoke('export_seating_chart_pdf', {
        payload: data.payload,
        suggestedName: data.suggestedName,
      });
    }
    return Promise.reject(
      new Error('PDF-eksport er foreløpig kun tilgjengelig for klassekart — bruk «Skriv ut» i mellomtiden.'),
    );
  },
  openPath: async (path) => {
    try {
      await pluginOpenPath(path);
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err?.message ?? String(err) };
    }
  },
  showInFolder: async (path) => {
    try {
      await revealItemInDir(path);
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err?.message ?? String(err) };
    }
  },

  // Auto-update (Task 7.1) — se src/tauriUpdater.js for pull->push-broen som
  // gjør at denne callback-kontrakten kan speile Electrons push-baserte
  // `onUpdateReady` 1:1.
  onUpdateReady: (cb) => onUpdateReadyImpl(cb),
  restartApp: () => relaunch(),
  checkForUpdates: () => checkForUpdatesManually(),
  downloadAndInstallUpdate: (u, onProgress) => downloadAndInstallUpdate(u, onProgress),
  simulateUpdate: (v) => simulateUpdateReady(v),

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

  // Window controls — minimer/lukk bruker Tauri 2 sin native
  // vindushåndtering direkte. Maksimer/gjenopprett gjør IKKE det - se
  // modul-doc ved `restoreBounds` over.
  minimizeWindow: () => getCurrentWindow().minimize(),
  maximizeWindow: async () => {
    const win = getCurrentWindow();
    // IKKE native win.maximize()/unmaximize() - se modul-doc over
    // (applyMaximize/applyRestore) for hvorfor. `restoreBounds` er vår egen
    // sannhetskilde: satt = "maksimert" (av OSS), null = "normal".
    if (restoreBounds) {
      return applyRestore(win);
    }
    return applyMaximize(win);
  },
  closeWindow: () => getCurrentWindow().close(),
  isWindowMaximized: () => Promise.resolve(restoreBounds !== null),
  // Callback får gjeldende maksimert-tilstand hver gang den endres - enten
  // via knappen (applyMaximize/applyRestore over) eller via native
  // dobbeltklikk-på-tittellinje/Windows-snap (fanget opp av
  // resize-lytteren under, som holder `lastKnownNormalBounds` oppdatert
  // mens vi IKKE selv tror vinduet er maksimert, og korrigerer til
  // workArea + registrerer det i vårt system idet OS-et sier isMaximized()
  // uten at VI initierte det). Returnerer en Promise for unlisten-funksjonen.
  onWindowMaximizeChange: (callback) => {
    maximizeListeners.add(callback);
    const win = getCurrentWindow();
    let checking = false;
    const unlistenPromise = win.onResized(async () => {
      if (checking || restoreBounds) return; // vi styrer allerede denne overgangen (knapp ELLER en tidligere iterasjon av denne korreksjonen)
      checking = true;
      try {
        const nativeMaximized = await win.isMaximized();
        if (nativeMaximized) {
          await applyMaximize(win);
        } else {
          lastKnownNormalBounds = {
            position: await win.outerPosition(),
            size: await win.outerSize(),
          };
        }
      } catch (e) { /* best effort */ }
      finally { checking = false; }
    });
    return unlistenPromise.then((unlistenResize) => () => {
      maximizeListeners.delete(callback);
      unlistenResize();
    });
  },
};

export default tauriApi;
