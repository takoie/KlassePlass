/**
 * rooms-list.js — Oversikt over alle rom.
 */

import { showToast } from '../shared/utils.js';

let _rooms = [];

const TEMPLATE = `
<div class="view-header">
  <div>
    <h1 class="view-title">Rom</h1>
    <p class="view-subtitle">Administrer klasserom og oppsett</p>
  </div>
  <button class="btn btn-secondary btn-sm" id="btn-new-room">
    <i class="fa-solid fa-plus"></i> Nytt rom
  </button>
</div>
<div id="rooms-grid" class="cards-grid"></div>
<div id="rooms-empty" class="empty-state hidden">
  <i class="fa-solid fa-door-open"></i>
  <h3>Ingen rom ennå</h3>
  <p>Opprett ditt første rom for å designe klasseromsoppsett.</p>
  <button class="btn btn-primary" id="btn-new-room-empty">
    <i class="fa-solid fa-plus"></i> Opprett rom
  </button>
</div>`;

export const roomsListView = {
  async mount(container) {
    container.innerHTML = TEMPLATE;
    await loadRooms();
    bindEvents();
  },
  unmount() { _rooms = []; },
};

async function loadRooms() {
  _rooms = await window.api.getRooms();
  renderRooms();
}

function renderRooms() {
  const grid  = document.getElementById('rooms-grid');
  const empty = document.getElementById('rooms-empty');
  if (!grid) return;

  grid.innerHTML = '';

  if (_rooms.length === 0) {
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  _rooms.forEach(room => {
    const card = buildRoomCard(room);
    grid.appendChild(card);
  });
}

function buildRoomCard(room) {
  const layout = parseLayout(room.layout_data);
  const deskCount = layout?.desks?.length ?? 0;
  const mode = layout?.designMode === 'board-bottom' ? 'Tavle nederst' : 'Tavle øverst';
  const modeIcon = layout?.designMode === 'board-bottom' ? 'fa-arrow-down' : 'fa-arrow-up';

  const card = document.createElement('div');
  card.className = 'chart-card';
  card.innerHTML = `
    <div class="chart-card-title">${escHtml(room.name ?? 'Uten navn')}</div>
    <div class="chart-card-meta">
      <span><i class="fa-solid fa-table w-4 text-center" style="margin-right:4px"></i>${deskCount} bord</span>
      <span><i class="fa-solid ${modeIcon} w-4 text-center" style="margin-right:4px"></i>${mode}</span>
    </div>
    <div class="chart-card-actions">
      <button class="btn btn-ghost btn-sm btn-delete-room" data-id="${room.id}" title="Slett">
        <i class="fa-solid fa-trash text-error"></i>
      </button>
      <button class="btn btn-outline btn-primary btn-sm btn-edit-room" data-id="${room.id}">
        <i class="fa-solid fa-pen"></i> Rediger
      </button>
    </div>
  `;

  card.querySelector('.btn-edit-room').addEventListener('click', (e) => {
    e.stopPropagation();
    window.navTo('room-editor', { roomId: room.id });
  });
  card.querySelector('.btn-delete-room').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm(`Slett rommet "${room.name}"? Dette kan ikke angres.`)) return;
    await window.api.deleteRoom(room.id);
    showToast('Rom slettet', 'info');
    await loadRooms();
  });
  card.addEventListener('click', () => window.navTo('room-editor', { roomId: room.id }));
  return card;
}

function bindEvents() {
  document.getElementById('btn-new-room')?.addEventListener('click', () => window.navTo('room-editor'));
  document.getElementById('btn-new-room-empty')?.addEventListener('click', () => window.navTo('room-editor'));
}

function parseLayout(raw) {
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
