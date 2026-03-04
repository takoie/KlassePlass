/**
 * seating-setup.js — Opprett nytt klassekart (steg 1).
 */

import { normalizeStudents, showToast } from '../shared/utils.js';

export const seatingSetupView = {
  async mount(container) {
    const html = await fetch('src/views/seating-setup.html').then(r => r.text());
    container.innerHTML = html;
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
