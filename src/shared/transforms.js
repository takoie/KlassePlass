/**
 * Koordinat-transformasjoner for romvisning.
 * Rom lagres alltid i "board-top" koordinater.
 * Flip-transformasjonen brukes kun ved rendering.
 */

import { CANVAS_W, DESK_TYPES } from './constants.js';

/**
 * Speiler alle pulter 180° (horisontal + vertikal).
 * Brukes når "tavle nederst" er aktivt.
 */
export function flipDesks(desks, roomHeight) {
  return desks.map(desk => {
    const { width, height } = DESK_TYPES[desk.type] ?? { width: 85, height: 55 };
    return {
      ...desk,
      x: CANVAS_W - desk.x - width,
      y: roomHeight - desk.y - height,
      rotation: (parseInt(desk.rotation ?? 0, 10) + 180) % 360,
    };
  });
}

/**
 * Returnerer desks klare for rendering — speilet hvis shouldFlip er true.
 */
export function getDisplayDesks(desks, roomHeight, shouldFlip) {
  return shouldFlip ? flipDesks(desks, roomHeight) : desks;
}

/**
 * Konverterer klikk-koordinater tilbake til "board-top"-koordinater
 * når flip er aktivt.
 */
export function unflipPoint(x, y, roomHeight) {
  return { x: CANVAS_W - x, y: roomHeight - y };
}
