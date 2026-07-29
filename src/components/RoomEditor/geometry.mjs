/**
 * Ren, rammeverk-fri geometri-/kollisjons-/plasseringslogikk for RoomEditor.
 * Ingen avhengighet til React eller DOM — testes med `node --test`, samme
 * mønster som src/lib/seatingSolver.mjs.
 */

export const CANVAS_W = 1100;
export const CANVAS_H = 700;
export const DESK_H = 60;
export const DESK_UNIT_W = 100;
export const WALL_LEFT = 15;
export const WALL_TOP = 60;
export const WALL_RIGHT_MARGIN = 15;
export const WALL_BOTTOM_MARGIN = 15;

export function deskWidth(desk) {
  return (desk.capacity || 1) * DESK_UNIT_W;
}

export function getDeskRect(desk, dx = 0, dy = 0) {
  const left = desk.x + dx;
  const top = desk.y + dy;
  return { left, top, right: left + deskWidth(desk), bottom: top + DESK_H };
}

export function rectsOverlap(a, b) {
  return a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
}

export function desksOverlap(a, b) {
  return rectsOverlap(getDeskRect(a), getDeskRect(b));
}

export function findOverlappingDeskIds(desk, otherDesks) {
  return otherDesks.filter(d => d.id !== desk.id && desksOverlap(desk, d)).map(d => d.id);
}

export function hasCollision(movingDesks, testDx, testDy, stationaryDesks, ignoreIds = []) {
  for (const md of movingDesks) {
    const mRect = getDeskRect(md, testDx, testDy);
    for (const sd of stationaryDesks) {
      if (ignoreIds.includes(sd.id)) continue;
      if (rectsOverlap(mRect, getDeskRect(sd))) return true;
    }
  }
  return false;
}

export function findFreeSpot({ capacity = 1, existingDesks, anchor = null }) {
  const w = capacity * DESK_UNIT_W;
  const isFree = (x, y) => !existingDesks.some(d => rectsOverlap(
    { left: x, top: y, right: x + w, bottom: y + DESK_H },
    getDeskRect(d)
  ));

  if (anchor) {
    for (let step = 0; step < 30; step++) {
      const x = anchor.x + step * 20;
      const y = anchor.y + step * 20;
      if (x + w > CANVAS_W - WALL_RIGHT_MARGIN || y + DESK_H > CANVAS_H - WALL_BOTTOM_MARGIN) break;
      if (isFree(x, y)) return { x, y };
    }
  }

  for (let y = 90; y <= CANVAS_H - DESK_H - 20; y += 80) {
    for (let x = 20; x <= CANVAS_W - w - 20; x += 115) {
      if (isFree(x, y)) return { x, y };
    }
  }

  return { x: 50, y: 90 };
}
