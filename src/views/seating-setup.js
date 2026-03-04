/**
 * seating-setup.js — Opprett nytt klassekart (steg 1).
 */

import { normalizeStudents, showToast } from '../shared/utils.js';

const TEMPLATE = `
<div class="view-header">
  <div>
    <h1 class="view-title">Nytt klassekart</h1>
    <p class="view-subtitle">Velg klasse, rom og innstillinger</p>
  </div>
  <button class="btn btn-ghost" id="btn-setup-cancel">
    <i class="fa-solid fa-arrow-left"></i> Avbryt
  </button>
</div>
<div class="setup-form">
  <div class="form-group">
    <label class="form-label">Navn på klassekart</label>
    <input type="text" id="setup-name" class="form-input" placeholder="f.eks. Klasse 1A — Uke 10">
  </div>
  <div class="form-group">
    <label class="form-label">Klasse</label>
    <select id="setup-class" class="form-input"><option value="">Velg klasse...</option></select>
    <div id="setup-class-info" class="form-hint hidden"></div>
  </div>
  <div class="form-group">
    <label class="form-label">Rom</label>
    <select id="setup-room" class="form-input"><option value="">Velg rom...</option></select>
    <div id="setup-room-info" class="form-hint hidden"></div>
  </div>
  <div id="setup-mismatch-warning" class="alert alert-warning hidden">
    <i class="fa-solid fa-triangle-exclamation"></i>
    <span id="setup-mismatch-msg"></span>
  </div>
  <details class="form-advanced">
    <summary class="form-advanced-toggle">Avanserte innstillinger</summary>
    <div class="form-group" style="margin-top:12px">
      <label class="form-label">Unngå par fra siste</label>
      <div style="display:flex;align-items:center;gap:8px">
        <input type="number" id="setup-avoid-n" class="form-input" value="3" min="0" max="20" style="width:70px">
        <span style="color:var(--text-secondary);font-size:13px">kart</span>
      </div>
      <div class="form-hint">Randomiseringen vil forsøke å unngå gjentatte sidepartnere</div>
    </div>
    <div class="form-group">
      <label class="form-label">Visning</label>
      <label class="checkbox-label">
        <input type="checkbox" id="setup-flip-display"> Vis tavle nederst på skjermen
      </label>
    </div>
  </details>
  <div class="form-actions">
    <button class="btn btn-ghost" id="btn-setup-cancel2">Avbryt</button>
    <button class="btn btn-accent btn-lg" id="btn-setup-create" disabled>
      <i class="fa-solid fa-wand-magic-sparkles"></i> Generer klassekart
    </button>
  </div>
</div>`;

export const seatingSetupView = {
  async mount(container) {
    container.innerHTML = TEMPLATE;
    await loadSelects();
    bindEvents();
  },
  unmount() {},
};

async function loadSelects() {
  const [classes, rooms, settings] = await Promise.all([
    window.api.getClasses(),
    window.api.getRooms(),
    window.api.getSettings(),
  ]);

  const clsSel = document.getElementById('setup-class');
  classes.forEach(c => {
    const students = parseStudents(c.students);
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} (${students.length} elever)`;
    opt.dataset.count = students.length;
    clsSel.appendChild(opt);
  });

  const rmSel = document.getElementById('setup-room');
  rooms.forEach(r => {
    const layout = parseLayout(r.layout_data);
    const capacity = countCapacity(layout?.desks ?? []);
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = `${r.name} (${capacity} plasser)`;
    opt.dataset.capacity = capacity;
    rmSel.appendChild(opt);
  });

  // Default innstillinger
  const flipChk = document.getElementById('setup-flip-display');
  if (flipChk) flipChk.checked = settings.defaultFlipDisplay ?? false;

  // Auto-fyll navn
  const nameInput = document.getElementById('setup-name');
  if (nameInput) {
    const today = new Date().toLocaleDateString('no-NO', { day:'2-digit', month:'short' });
    nameInput.placeholder = `f.eks. Klasse 1A — ${today}`;
  }
}

function bindEvents() {
  const clsSel   = document.getElementById('setup-class');
  const rmSel    = document.getElementById('setup-room');
  const createBtn = document.getElementById('btn-setup-create');

  clsSel?.addEventListener('change', () => { validateForm(); updateInfo(); });
  rmSel?.addEventListener('change',  () => { validateForm(); updateInfo(); });
  document.getElementById('setup-name')?.addEventListener('input', validateForm);

  createBtn?.addEventListener('click', createChart);
  document.getElementById('btn-setup-cancel')?.addEventListener('click', () => window.navTo('charts-dashboard'));
  document.getElementById('btn-setup-cancel2')?.addEventListener('click', () => window.navTo('charts-dashboard'));
}

function validateForm() {
  const name = document.getElementById('setup-name')?.value.trim();
  const cls  = document.getElementById('setup-class')?.value;
  const rm   = document.getElementById('setup-room')?.value;
  const btn  = document.getElementById('btn-setup-create');
  if (btn) btn.disabled = !(name && cls && rm);

  // Mismatch-sjekk
  const clsOpt = document.querySelector('#setup-class option:checked');
  const rmOpt  = document.querySelector('#setup-room option:checked');
  const students = parseInt(clsOpt?.dataset.count ?? 0);
  const capacity = parseInt(rmOpt?.dataset.capacity ?? 0);
  const warning  = document.getElementById('setup-mismatch-warning');
  const msg      = document.getElementById('setup-mismatch-msg');

  if (cls && rm && students && capacity && students !== capacity && warning && msg) {
    msg.textContent = `Klassen har ${students} elever, men rommet har ${capacity} plasser.`;
    warning.classList.remove('hidden');
  } else {
    warning?.classList.add('hidden');
  }
}

function updateInfo() {
  const clsOpt = document.querySelector('#setup-class option:checked');
  const rmOpt  = document.querySelector('#setup-room option:checked');
  const clsInfo = document.getElementById('setup-class-info');
  const rmInfo  = document.getElementById('setup-room-info');

  if (clsInfo && clsOpt?.value) {
    clsInfo.textContent = `${clsOpt.dataset.count} elever`;
    clsInfo.classList.remove('hidden');
  }
  if (rmInfo && rmOpt?.value) {
    rmInfo.textContent = `${rmOpt.dataset.capacity} plasser`;
    rmInfo.classList.remove('hidden');
  }
}

async function createChart() {
  const name    = document.getElementById('setup-name')?.value.trim();
  const classId = parseInt(document.getElementById('setup-class')?.value);
  const roomId  = parseInt(document.getElementById('setup-room')?.value);
  const avoidN  = parseInt(document.getElementById('setup-avoid-n')?.value ?? 3);
  const flip    = document.getElementById('setup-flip-display')?.checked ?? false;

  if (!name || !classId || !roomId) return;

  const [cls, room] = await Promise.all([
    window.api.getClass(classId),
    window.api.getRoom(roomId),
  ]);

  const students = normalizeStudents(parseStudents(cls.students));
  const layout   = parseLayout(room.layout_data);

  if (!layout?.desks?.length) {
    showToast('Rommet har ingen pulter. Rediger rommet først.', 'error');
    return;
  }

  window.navTo('seating-editor', {
    mode: 'new',
    name, classId, roomId, students,
    desks: layout.desks,
    roomDesignMode: layout.designMode ?? 'board-top',
    roomHeight: layout.roomHeight ?? 500,
    decorations: layout.decorations ?? [],
    flipForDisplay: flip,
    avoidLastN: avoidN,
  });
}

function parseStudents(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : raw.split('\n').filter(Boolean);
  } catch {
    return String(raw).split('\n').filter(Boolean);
  }
}

function parseLayout(raw) {
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
}

function countCapacity(desks) {
  const CAPACITY = { single:1, bench2:2, bench4:4, round3:3, round4:4, round6:6 };
  return desks.reduce((sum, d) => sum + (CAPACITY[d.type] ?? 1), 0);
}
