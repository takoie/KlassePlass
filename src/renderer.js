/**
 * renderer.js — Tynn router. Maks 100 linjer.
 * Monterer views og delegerer navigasjon.
 */

import { store }                from './store.js';
import { chartsDashboardView }  from './views/charts-dashboard.js';
import { seatingSetupView }     from './views/seating-setup.js';
import { seatingEditorView }    from './views/seating-editor.js';
import { roomEditorView }       from './views/room-editor.js';
import { roomsListView }        from './views/rooms-list.js';
import { classesView }          from './views/classes.js';
import { settingsView }         from './views/settings.js';
import { seatingHistoryView }   from './views/seating-history.js';
import { groupSetupView }       from './views/group-setup.js';
import { groupEditorView }      from './views/group-editor.js';
import { groupDashboardView }   from './views/group-dashboard.js';
import { groupStatsView }        from './views/group-stats.js';
import { stationSetupView }      from './views/station-setup.js';
import { stationPresenterView }  from './views/station-presenter.js';
import { scheduleSettingsView }  from './views/schedule-settings.js';

const VIEWS = {
  'charts-dashboard': chartsDashboardView,
  'seating-setup':    seatingSetupView,
  'seating-editor':   seatingEditorView,
  'room-editor':      roomEditorView,
  'rooms-list':       roomsListView,
  'classes':          classesView,
  'settings':         settingsView,
  'seating-history':  seatingHistoryView,
  'group-dashboard':    groupDashboardView,
  'group-setup':        groupSetupView,
  'group-editor':       groupEditorView,
  'group-stats':        groupStatsView,
  'station-setup':       stationSetupView,
  'station-presenter':   stationPresenterView,
  'schedule-settings':   scheduleSettingsView,
};

let currentViewModule = null;
const appEl = document.getElementById('app-content');

/** Naviger til et view med valgfrie params */
export function navTo(viewName, params = {}) {
  if (currentViewModule?.unmount) currentViewModule.unmount();

  const view = VIEWS[viewName];
  if (!view) { console.error(`Unknown view: ${viewName}`); return; }

  appEl.innerHTML = '';
  currentViewModule = view;
  view.mount(appEl, params);

  store.setState({ currentView: viewName });
  updateNav(viewName);
}

// Vis hvilken nav-gruppe et view tilhører
const NAV_GROUP = {
  'group-dashboard':    'group-dashboard',
  'group-setup':        'group-dashboard',
  'group-editor':       'group-dashboard',
  'group-stats':        'group-dashboard',
  'seating-editor':     'charts-dashboard',
  'seating-setup':      'charts-dashboard',
  'room-editor':        'rooms-list',
  'seating-history':    'charts-dashboard',
  'station-presenter':  'station-setup',
  'schedule-settings':  'charts-dashboard',
};

function updateNav(active) {
  const navKey = NAV_GROUP[active] ?? active;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === navKey);
  });
}

// Globaliser navTo for views som ikke importerer renderer direkte
window.navTo = navTo;

// Init: last settings og start
async function init() {
  const settings = await window.api.getSettings();
  store.setState({ settings });
  applyTheme(settings);
  applyCanvasBg(settings?.canvasBg);

  // Lyt på auto-update
  window.api.onUpdateReady(info => {
    store.setState({ updateReady: info });
    showUpdateBanner(info);
  });

  navTo('charts-dashboard');
}

const DARK_THEMES  = ['night', 'dracula', 'coffee', 'halloween', 'black', 'dim'];
const LIGHT_THEMES = ['nord', 'winter', 'corporate'];

function applyTheme(settings) {
  const mode = settings?.theme ?? 'dark';
  const colorTheme = settings?.colorTheme;
  const validThemes = [...DARK_THEMES, ...LIGHT_THEMES];
  if (colorTheme && validThemes.includes(colorTheme)) {
    document.documentElement.dataset.theme = colorTheme;
  } else {
    document.documentElement.dataset.theme = mode === 'light' ? 'nord' : 'night';
  }
}

function applyCanvasBg(bg) {
  document.documentElement.dataset.canvasBg = bg ?? 'solid';
}

function syncPresentationTheme() {
  window.api.syncPresentationTheme({
    theme:    document.documentElement.dataset.theme ?? 'night',
    canvasBg: document.documentElement.dataset.canvasBg ?? 'solid',
  });
}

function showUpdateBanner(info) {
  const banner = document.getElementById('update-banner');
  if (!banner) return;
  banner.querySelector('#update-version').textContent = info.version ?? '';
  banner.classList.remove('hidden');
}

/* ---- Utskrift / Vikarmodus ---- */

/**
 * Åpne print-overlay med data fra et klassekart (_chart-objektet fra seating-editor).
 * @param {Object} chart
 */
export function openPrintOverlay(chart) {
  const overlay = document.getElementById('print-overlay');
  const nameEl  = document.getElementById('print-chart-name');
  const metaEl  = document.getElementById('print-meta');
  const wrapper = document.getElementById('print-canvas-wrapper');
  if (!overlay || !nameEl || !metaEl || !wrapper) return;

  nameEl.textContent = chart.name ?? 'Klassekart';
  const date = new Date().toLocaleDateString('no-NO', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
  const classLabel = chart.className ?? '';
  metaEl.textContent = `${classLabel ? 'Klasse: ' + classLabel + ' · ' : ''}Utskrift: ${date}`;

  const SCALE = 0.78;
  const canvasH = ((chart.roomHeight ?? 500) + 40) * SCALE;
  const canvasW = 900 * SCALE;
  wrapper.style.width  = canvasW + 'px';
  wrapper.style.height = canvasH + 'px';
  wrapper.innerHTML = '';

  // Tavle-element
  const boardEl = document.createElement('div');
  boardEl.style.cssText = `position:absolute;left:0;right:0;top:0;height:${28 * SCALE}px;` +
    `background:#374151;color:white;display:flex;align-items:center;justify-content:center;` +
    `font-size:11px;font-weight:600;letter-spacing:0.05em;`;
  boardEl.textContent = 'TAVLE';
  wrapper.appendChild(boardEl);

  for (const desk of chart.desks ?? []) {
    const slots = desk.slots ?? [];
    const numSlots = slots.length || 1;
    const deskW = (desk.width ?? 85) * SCALE;
    const deskH = (desk.height ?? 55) * SCALE;
    const baseX = desk.x * SCALE;
    const baseY = 40 * SCALE + desk.y * SCALE;

    slots.forEach((slot, si) => {
      const studentData = slot?.studentId ? chart.studentsById?.[slot.studentId] : null;
      const name = studentData?.name ?? '';
      const note = slot?.note ?? '';
      const isEmpty = !name;

      const slotW = numSlots > 1 ? deskW / numSlots : deskW;
      const slotX = baseX + slotW * si;

      const el = document.createElement('div');
      el.className = 'print-desk' + (isEmpty ? ' print-desk-empty' : '');
      el.style.cssText = `left:${slotX}px;top:${baseY}px;width:${slotW}px;height:${deskH}px;`;
      el.innerHTML =
        `<span class="print-desk-name">${_escPrint(name) || '&nbsp;'}</span>` +
        (note ? `<span class="print-desk-note" title="${_escPrint(note)}">${_escPrint(note)}</span>` : '');
      wrapper.appendChild(el);
    });

    // Pult uten slots-data — vis tom boks
    if (slots.length === 0) {
      const el = document.createElement('div');
      el.className = 'print-desk print-desk-empty';
      el.style.cssText = `left:${baseX}px;top:${baseY}px;width:${deskW}px;height:${deskH}px;`;
      el.innerHTML = '<span class="print-desk-name">&nbsp;</span>';
      wrapper.appendChild(el);
    }
  }

  overlay.style.display = 'block';
}

export function closePrintOverlay() {
  const overlay = document.getElementById('print-overlay');
  if (overlay) overlay.style.display = 'none';
}

function _escPrint(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.openPrintOverlay  = openPrintOverlay;
window.closePrintOverlay = closePrintOverlay;

// Lytt på innstillingsendringer
store.on('settings', s => {
  applyTheme(s);
  applyCanvasBg(s?.canvasBg);
  syncPresentationTheme();
});

document.addEventListener('DOMContentLoaded', init);
