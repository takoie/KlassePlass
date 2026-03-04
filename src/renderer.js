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

const VIEWS = {
  'charts-dashboard': chartsDashboardView,
  'seating-setup':    seatingSetupView,
  'seating-editor':   seatingEditorView,
  'room-editor':      roomEditorView,
  'rooms-list':       roomsListView,
  'classes':          classesView,
  'settings':         settingsView,
  'seating-history':  seatingHistoryView,
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

function updateNav(active) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === active);
  });
}

// Globaliser navTo for views som ikke importerer renderer direkte
window.navTo = navTo;

// Init: last settings og start
async function init() {
  const settings = await window.api.getSettings();
  store.setState({ settings });
  applyTheme(settings);

  // Lyt på auto-update
  window.api.onUpdateReady(info => {
    store.setState({ updateReady: info });
    showUpdateBanner(info);
  });

  navTo('charts-dashboard');
}

const DARK_THEMES  = ['night', 'dracula', 'coffee'];
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

function showUpdateBanner(info) {
  const banner = document.getElementById('update-banner');
  if (!banner) return;
  banner.querySelector('#update-version').textContent = info.version ?? '';
  banner.classList.remove('hidden');
}

// Lytt på tema-endringer
store.on('settings', s => applyTheme(s));

document.addEventListener('DOMContentLoaded', init);
