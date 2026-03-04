/**
 * settings.js — Innstillinger: tema, database, om-info.
 */

import { store } from '../store.js';
import { showToast, getPortal } from '../shared/utils.js';

const TEMPLATE = `
<div class="view-header">
  <h1 class="view-title">Innstillinger</h1>
</div>
<div class="settings-layout">
  <section class="settings-section">
    <h2 class="settings-section-title">Utseende</h2>
    <div class="settings-row">
      <div>
        <div class="settings-label">Tema</div>
        <div class="settings-hint">Bytt mellom mørk og lys modus</div>
      </div>
      <div class="theme-toggle" id="theme-toggle">
        <button class="theme-btn" data-theme="dracula" id="btn-theme-dark"><i class="fa-solid fa-moon"></i> Mørk</button>
        <button class="theme-btn" data-theme="light" id="btn-theme-light"><i class="fa-solid fa-sun"></i> Lys</button>
      </div>
    </div>
    <div class="settings-row">
      <div>
        <div class="settings-label">Roter visning som standard</div>
        <div class="settings-hint">Åpne klassekart med visningen rotert 180° som standard</div>
      </div>
      <input type="checkbox" id="setting-flip-display" class="toggle toggle-primary">
    </div>
  </section>
  <section class="settings-section">
    <h2 class="settings-section-title">Database</h2>
    <div class="settings-row">
      <div><div class="settings-label">Sikkerhetskopi</div><div class="settings-hint">Lagre en kopi av databasen</div></div>
      <button class="btn btn-outline btn-sm" id="btn-backup-db"><i class="fa-solid fa-download"></i> Ta backup</button>
    </div>
    <div class="settings-row">
      <div><div class="settings-label">Gjenopprett</div><div class="settings-hint">Last inn en tidligere sikkerhetskopi</div></div>
      <button class="btn btn-outline btn-sm" id="btn-restore-db"><i class="fa-solid fa-upload"></i> Gjenopprett</button>
    </div>
    <div class="settings-row">
      <div><div class="settings-label">Flytt database</div><div class="settings-hint">Lagre databasen på en annen plassering</div></div>
      <button class="btn btn-outline btn-sm" id="btn-move-db"><i class="fa-solid fa-folder-open"></i> Flytt</button>
    </div>
    <div class="settings-row">
      <div><div class="settings-label">Databaseplassering</div><div id="db-path-display" class="settings-hint code-hint"></div></div>
    </div>
  </section>
  <section class="settings-section">
    <h2 class="settings-section-title">Eksport og import</h2>
    <div class="settings-row">
      <div>
        <div class="settings-label">Eksporter klasse</div>
        <div class="settings-hint">Eksporter en klasse med alle kart og historikk som JSON-fil</div>
      </div>
      <button class="btn btn-outline btn-sm" id="btn-export-class"><i class="fa-solid fa-file-export"></i> Eksporter</button>
    </div>
    <div class="settings-row">
      <div>
        <div class="settings-label">Importer klasse</div>
        <div class="settings-hint">Importer en tidligere eksportert klasse-bundle</div>
      </div>
      <button class="btn btn-outline btn-sm" id="btn-import-class"><i class="fa-solid fa-file-import"></i> Importer</button>
    </div>
  </section>
  <section class="settings-section">
    <h2 class="settings-section-title">Om KlassePlass</h2>
    <div class="settings-row">
      <div><div class="settings-label">Versjon</div><div id="app-version" class="settings-hint"></div></div>
    </div>
    <div class="settings-row">
      <div><div class="settings-label">Utvikler</div><div class="settings-hint">Stian Taknes — stian.taknes.no</div></div>
    </div>
  </section>
</div>`;

export const settingsView = {
  async mount(container) {
    container.innerHTML = TEMPLATE;
    await loadSettings();
    bindEvents();
  },
  unmount() {},
};

async function loadSettings() {
  const settings = await window.api.getSettings();
  store.setState({ settings });

  // Tema-toggle
  const currentTheme = settings.theme ?? 'dracula';
  document.getElementById('btn-theme-dark')?.classList.toggle('active', currentTheme === 'dracula');
  document.getElementById('btn-theme-light')?.classList.toggle('active', currentTheme === 'light');

  // Flip display
  const flipEl = document.getElementById('setting-flip-display');
  if (flipEl) flipEl.checked = settings.defaultFlipDisplay ?? false;

  // DB-path
  const dbPathEl = document.getElementById('db-path-display');
  if (dbPathEl) {
    try {
      const dbPath = await window.api.getDbPath();
      dbPathEl.textContent = dbPath ?? '—';
    } catch { dbPathEl.textContent = '—'; }
  }

  // App-versjon
  const verEl = document.getElementById('app-version');
  if (verEl) {
    try {
      const version = await window.api.getVersion();
      verEl.textContent = `v${version}`;
    } catch { verEl.textContent = '—'; }
  }
}

function bindEvents() {
  // Tema
  document.getElementById('btn-theme-dark')?.addEventListener('click', () => setTheme('dracula'));
  document.getElementById('btn-theme-light')?.addEventListener('click', () => setTheme('light'));

  // Flip
  document.getElementById('setting-flip-display')?.addEventListener('change', async (e) => {
    await window.api.saveSettings({ defaultFlipDisplay: e.target.checked });
    const s = store.getState().settings;
    store.setState({ settings: { ...s, defaultFlipDisplay: e.target.checked } });
  });

  // Eksport / Import
  document.getElementById('btn-export-class')?.addEventListener('click', exportClass);
  document.getElementById('btn-import-class')?.addEventListener('click', importClass);

  // Database
  document.getElementById('btn-backup-db')?.addEventListener('click', async () => {
    const r = await window.api.backupDb();
    if (r.success) showToast(`Backup lagret: ${r.filePath}`, 'success');
    else if (!r.canceled) showToast('Backup feilet: ' + r.error, 'error');
  });

  document.getElementById('btn-restore-db')?.addEventListener('click', async () => {
    if (!confirm('Gjenopprette database? Nåværende data erstattes.')) return;
    const r = await window.api.restoreDb();
    if (r.success) { showToast('Database gjenopprettet. Start appen på nytt.', 'success'); }
    else if (!r.canceled) showToast('Gjenoppretting feilet: ' + r.error, 'error');
  });

  document.getElementById('btn-move-db')?.addEventListener('click', async () => {
    const r = await window.api.moveDb();
    if (r.success) showToast('Database flyttet. Start appen på nytt.', 'success');
    else if (!r.canceled) showToast('Feil: ' + r.error, 'error');
  });
}

async function exportClass() {
  const classes = await window.api.getClasses();
  if (!classes.length) { showToast('Ingen klasser å eksportere', 'error'); return; }

  // Velg klasse
  const backdrop = document.createElement('div');
  backdrop.className = 'kp-backdrop';
  backdrop.innerHTML = `
    <div class="kp-modal">
      <div class="modal-header"><span class="modal-title">Eksporter klasse</span></div>
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">Velg klasse</label>
        <select id="export-class-sel" class="form-input">
          ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="exp-cancel">Avbryt</button>
        <button class="btn btn-primary" id="exp-ok">Eksporter</button>
      </div>
    </div>
  `;
  getPortal().appendChild(backdrop);
  backdrop.querySelector('#exp-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#exp-ok').addEventListener('click', async () => {
    const classId = parseInt(backdrop.querySelector('#export-class-sel').value);
    backdrop.remove();
    const bundle = await window.api.exportBundle(classId);
    const json   = JSON.stringify(bundle, null, 2);
    const blob   = new Blob([json], { type: 'application/json' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href = url;
    a.download = `klasseplass-${bundle.class.name.replace(/\s+/g,'-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Klasse eksportert!', 'success');
  });
}

async function importClass() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text   = await file.text();
      const bundle = JSON.parse(text);
      if (!bundle.class) { showToast('Ugyldig fil — ikke en KlassePlass-bundle', 'error'); return; }
      const result = await window.api.importBundle(bundle);
      if (result.success) showToast(`Klasse "${bundle.class.name}" importert!`, 'success');
      else showToast('Import feilet: ' + result.error, 'error');
    } catch (err) {
      showToast('Feil ved lesing av fil: ' + err.message, 'error');
    }
  });
  input.click();
}

async function setTheme(theme) {
  document.getElementById('btn-theme-dark')?.classList.toggle('active', theme === 'dracula');
  document.getElementById('btn-theme-light')?.classList.toggle('active', theme === 'light');
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dracula';
  await window.api.saveSettings({ theme });
  const s = store.getState().settings;
  store.setState({ settings: { ...s, theme } });
}
