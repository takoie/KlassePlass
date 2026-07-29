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
