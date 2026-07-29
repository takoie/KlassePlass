import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDeskRect, rectsOverlap, desksOverlap, findOverlappingDeskIds, hasCollision, findFreeSpot, findFreeGroupOffset } from '../src/components/RoomEditor/geometry.mjs';

test('getDeskRect uses capacity*100 width and 60 height', () => {
  const rect = getDeskRect({ x: 10, y: 20, capacity: 2 });
  assert.deepEqual(rect, { left: 10, top: 20, right: 210, bottom: 80 });
});

test('getDeskRect applies dx/dy offset', () => {
  const rect = getDeskRect({ x: 10, y: 20, capacity: 1 }, 5, -5);
  assert.deepEqual(rect, { left: 15, top: 15, right: 115, bottom: 75 });
});

test('rectsOverlap is true for overlapping rects', () => {
  const a = { left: 0, top: 0, right: 100, bottom: 60 };
  const b = { left: 50, top: 0, right: 150, bottom: 60 };
  assert.equal(rectsOverlap(a, b), true);
});

test('rectsOverlap is false for edge-adjacent rects (touching, not overlapping)', () => {
  const a = { left: 0, top: 0, right: 100, bottom: 60 };
  const b = { left: 100, top: 0, right: 200, bottom: 60 };
  assert.equal(rectsOverlap(a, b), false);
});

test('desksOverlap wraps rectsOverlap for desk objects', () => {
  const a = { id: 'a', x: 0, y: 0, capacity: 1 };
  const b = { id: 'b', x: 50, y: 0, capacity: 1 };
  assert.equal(desksOverlap(a, b), true);
});

test('findOverlappingDeskIds returns only overlapping desks, excludes self', () => {
  const target = { id: 'a', x: 0, y: 0, capacity: 1 };
  const others = [
    { id: 'a', x: 0, y: 0, capacity: 1 },
    { id: 'b', x: 50, y: 0, capacity: 1 },
    { id: 'c', x: 500, y: 500, capacity: 1 },
  ];
  assert.deepEqual(findOverlappingDeskIds(target, others), ['b']);
});

test('hasCollision detects overlap at a given test offset', () => {
  const moving = [{ id: 'm', x: 0, y: 0, capacity: 1 }];
  const stationary = [{ id: 's', x: 50, y: 0, capacity: 1 }];
  assert.equal(hasCollision(moving, 0, 0, stationary, []), true);
  assert.equal(hasCollision(moving, 200, 0, stationary, []), false);
});

test('hasCollision ignores desk ids in ignoreIds', () => {
  const moving = [{ id: 'm', x: 0, y: 0, capacity: 1 }];
  const stationary = [{ id: 's', x: 50, y: 0, capacity: 1 }];
  assert.equal(hasCollision(moving, 0, 0, stationary, ['s']), false);
});

test('findFreeSpot with no anchor returns first free grid cell (top-left scan)', () => {
  const spot = findFreeSpot({ capacity: 1, existingDesks: [] });
  assert.deepEqual(spot, { x: 20, y: 90 });
});

test('findFreeSpot with no anchor skips occupied cells', () => {
  const existing = [{ id: 'a', x: 20, y: 90, capacity: 1 }];
  const spot = findFreeSpot({ capacity: 1, existingDesks: existing });
  assert.deepEqual(spot, { x: 135, y: 90 });
});

test('findFreeSpot with anchor returns anchor itself if free', () => {
  const spot = findFreeSpot({ capacity: 1, existingDesks: [], anchor: { x: 300, y: 300 } });
  assert.deepEqual(spot, { x: 300, y: 300 });
});

test('findFreeSpot with anchor steps diagonally past an occupied anchor', () => {
  const existing = [{ id: 'a', x: 300, y: 300, capacity: 1 }];
  const spot = findFreeSpot({ capacity: 1, existingDesks: existing, anchor: { x: 300, y: 300 } });
  // Bordet er 100x60: en diagonal +20-steg overlapper fortsatt (både x- og
  // y-avstand under bordets bredde/høyde) helt til steg 3 (+60,+60), der
  // y-avstanden (60) akkurat klarer å bryte overlappet.
  assert.deepEqual(spot, { x: 360, y: 360 });
});

test('findFreeSpot falls back to grid scan when anchor search cannot find a spot', () => {
  // Fyll hele det diagonale søket fra (300,300) og fremover med opptatte bord,
  // slik at anchor-søket gir opp og faller tilbake til rutenett-skannet.
  const existing = [];
  for (let step = 0; step < 30; step++) {
    existing.push({ id: `blocker-${step}`, x: 300 + step * 20, y: 300 + step * 20, capacity: 1 });
  }
  const spot = findFreeSpot({ capacity: 1, existingDesks: existing, anchor: { x: 300, y: 300 } });
  assert.deepEqual(spot, { x: 20, y: 90 });
});

test('findFreeGroupOffset returns the start offset when the whole group fits there', () => {
  // y:100 (ikke 0) - må være >= WALL_TOP(60) for at gruppen skal stå på en
  // gyldig hvileposisjon i utgangspunktet, ellers trigges vegg-klipping.
  const group = [
    { id: 'a', x: 0, y: 100, capacity: 1 },
    { id: 'b', x: 100, y: 100, capacity: 1 },
  ];
  const offset = findFreeGroupOffset({ desks: group, existingDesks: [], startDx: 20, startDy: 20 });
  assert.deepEqual(offset, { dx: 20, dy: 20 });
});

test('findFreeGroupOffset steps past a spot that only partially fits', () => {
  const group = [
    { id: 'a', x: 0, y: 100, capacity: 1 },
    { id: 'b', x: 100, y: 100, capacity: 1 },
  ];
  // Blokkerer nøyaktig der (a) ville landet ved startDx/startDy=20,20 (x=20,y=120)
  const existing = [{ id: 'blocker', x: 20, y: 120, capacity: 1 }];
  const offset = findFreeGroupOffset({ desks: group, existingDesks: existing, startDx: 20, startDy: 20 });
  // Bordet er 100x60: trenger dy >= 79px fra blocker.y(120) for å klarere i
  // høyden, som først skjer ved steg 3 (dy = 20 + 3*20 = 80).
  assert.deepEqual(offset, { dx: 80, dy: 80 });
});

test('findFreeGroupOffset returns null when no offset within canvas bounds works', () => {
  const group = [{ id: 'a', x: 1000, y: 600, capacity: 1 }]; // allerede nær kanten
  const existing = [];
  const offset = findFreeGroupOffset({ desks: group, existingDesks: existing, startDx: 20, startDy: 20 });
  assert.equal(offset, null);
});
