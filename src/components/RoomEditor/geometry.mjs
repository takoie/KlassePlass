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
export const BOARD_W = 256;
export const BOARD_H = 36;

export function centerBoardX() {
  return CANVAS_W / 2 - BOARD_W / 2;
}

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

export function findFreeGroupOffset({ desks, existingDesks, startDx = 20, startDy = 20, stepSize = 20, maxSteps = 30 }) {
  for (let step = 0; step < maxSteps; step++) {
    const dx = startDx + step * stepSize;
    const dy = startDy + step * stepSize;

    const withinBounds = desks.every(d => {
      const w = deskWidth(d);
      return d.x + dx >= WALL_LEFT && d.x + dx + w <= CANVAS_W - WALL_RIGHT_MARGIN &&
             d.y + dy >= WALL_TOP && d.y + dy + DESK_H <= CANVAS_H - WALL_BOTTOM_MARGIN;
    });
    if (!withinBounds) break;

    if (!hasCollision(desks, dx, dy, existingDesks, [])) {
      return { dx, dy };
    }
  }
  return null;
}

export const SNAP_THRESHOLD = 20;
const ADJACENCY_TOLERANCE = 14;
// Når to nabo-pulter konkurrerer om snapping med nesten lik "pull" (f.eks. flere pulter
// på rad i et generert oppsett), gir vi den pulten som allerede var snap-mål forrige frame
// en liten fordel. Uten dette kan ett piksels muselbevegelse vippe valget mellom to
// nesten likeverdige mål og få pulten til å "hoppe" til et annet sted enn ventet.
const HYSTERESIS_BONUS = 6;

function computeMagneticSnap(movingDesks, rawDx, rawDy, stationaryDesks, preferredTargetId = null) {
  let best = null;
  for (const md of movingDesks) {
    const mdx = md.x + rawDx;
    const mdy = md.y + rawDy;
    const mdWidth = deskWidth(md);
    for (const sd of stationaryDesks) {
      const sx = sd.x, sy = sd.y;
      const ow = deskWidth(sd);
      const candidates = [];

      if (Math.abs(mdy - sy) < ADJACENCY_TOLERANCE && Math.abs(mdx - (sx + ow)) < SNAP_THRESHOLD) {
        candidates.push({ dx: (sx + ow) - md.x, dy: sy - md.y });
      }
      if (Math.abs(mdy - sy) < ADJACENCY_TOLERANCE && Math.abs((mdx + mdWidth) - sx) < SNAP_THRESHOLD) {
        candidates.push({ dx: (sx - mdWidth) - md.x, dy: sy - md.y });
      }
      if (Math.abs(mdx - sx) < ADJACENCY_TOLERANCE && Math.abs(mdy - (sy + DESK_H)) < SNAP_THRESHOLD) {
        candidates.push({ dx: sx - md.x, dy: (sy + DESK_H) - md.y });
      }
      if (Math.abs(mdx - sx) < ADJACENCY_TOLERANCE && Math.abs((mdy + DESK_H) - sy) < SNAP_THRESHOLD) {
        candidates.push({ dx: sx - md.x, dy: (sy - DESK_H) - md.y });
      }

      for (const c of candidates) {
        let pull = Math.abs(c.dx - rawDx) + Math.abs(c.dy - rawDy);
        if (preferredTargetId && sd.id === preferredTargetId) pull -= HYSTERESIS_BONUS;
        if (!best || pull < best.pull) best = { ...c, targetId: sd.id, pull };
      }
    }
  }
  return best;
}

export function computeBoundedDelta({
  movingDesks, rawDx, rawDy, stationaryDesks,
  skipSnap = false, ignoreOverlapIds = [], preferredTargetId = null
}) {
  let maxDx = rawDx, maxDy = rawDy;
  movingDesks.forEach(d => {
    const w = deskWidth(d);
    const px = d.x + rawDx, py = d.y + rawDy;
    if (px < WALL_LEFT) maxDx = Math.max(maxDx, WALL_LEFT - d.x);
    if (px > CANVAS_W - w - WALL_RIGHT_MARGIN) maxDx = Math.min(maxDx, CANVAS_W - w - WALL_RIGHT_MARGIN - d.x);
    if (py < WALL_TOP) maxDy = Math.max(maxDy, WALL_TOP - d.y);
    if (py > CANVAS_H - DESK_H - WALL_BOTTOM_MARGIN) maxDy = Math.min(maxDy, CANVAS_H - DESK_H - WALL_BOTTOM_MARGIN - d.y);
  });

  let finalDx = maxDx, finalDy = maxDy;
  let isSnapped = false;
  let targetDeskIds = [];

  if (!skipSnap) {
    const snap = computeMagneticSnap(movingDesks, finalDx, finalDy, stationaryDesks, preferredTargetId);
    if (snap) {
      finalDx = snap.dx; finalDy = snap.dy; isSnapped = true;
      targetDeskIds = [snap.targetId];
    } else if (movingDesks.length > 0) {
      finalDx = Math.round((movingDesks[0].x + finalDx) / 10) * 10 - movingDesks[0].x;
      finalDy = Math.round((movingDesks[0].y + finalDy) / 10) * 10 - movingDesks[0].y;
    }
  }

  if (hasCollision(movingDesks, finalDx, finalDy, stationaryDesks, ignoreOverlapIds)) {
    if (!hasCollision(movingDesks, finalDx, 0, stationaryDesks, ignoreOverlapIds)) finalDy = 0;
    else if (!hasCollision(movingDesks, 0, finalDy, stationaryDesks, ignoreOverlapIds)) finalDx = 0;
    else { finalDx = 0; finalDy = 0; }
  }

  const xLines = [];
  const yLines = [];
  movingDesks.forEach(md => {
    const fx = md.x + finalDx;
    const fy = md.y + finalDy;
    const fw = deskWidth(md);
    const fh = DESK_H;
    const fCenterX = fx + fw / 2;
    const fCenterY = fy + fh / 2;

    stationaryDesks.forEach(sd => {
      const ox = sd.x, oy = sd.y;
      const ow = deskWidth(sd), oh = DESK_H;
      const oCenterX = ox + ow / 2;
      const oCenterY = oy + oh / 2;

      if (Math.abs(fy - oy) <= 2) yLines.push(oy);
      if (Math.abs(fCenterY - oCenterY) <= 2) yLines.push(oCenterY);
      if (Math.abs((fy + fh) - (oy + oh)) <= 2) yLines.push(oy + oh);
      if (Math.abs(fy - (oy + oh)) <= 2) yLines.push(oy + oh);
      if (Math.abs((fy + fh) - oy) <= 2) yLines.push(oy);

      if (Math.abs(fx - ox) <= 2) xLines.push(ox);
      if (Math.abs(fCenterX - oCenterX) <= 2) xLines.push(oCenterX);
      if (Math.abs((fx + fw) - (ox + ow)) <= 2) xLines.push(ox + ow);
      if (Math.abs(fx - (ox + ow)) <= 2) xLines.push(ox + ow);
      if (Math.abs((fx + fw) - ox) <= 2) xLines.push(ox);

      const isAdjacentHorizontal = Math.abs(fy - oy) < ADJACENCY_TOLERANCE && (Math.abs(fx - (ox + ow)) < 6 || Math.abs((fx + fw) - ox) < 6);
      const isAdjacentVertical = Math.abs(fx - ox) < ADJACENCY_TOLERANCE && (Math.abs(fy - (oy + oh)) < 6 || Math.abs((fy + fh) - oy) < 6);
      if (isAdjacentHorizontal || isAdjacentVertical) {
        if (!targetDeskIds.includes(sd.id)) targetDeskIds.push(sd.id);
      }
    });
  });

  return {
    dx: finalDx,
    dy: finalDy,
    isSnapped,
    targetDeskIds,
    alignmentGuides: { xLines: [...new Set(xLines)], yLines: [...new Set(yLines)] }
  };
}
