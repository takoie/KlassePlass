import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDeskRect, rectsOverlap, desksOverlap, findOverlappingDeskIds, hasCollision, findFreeSpot, findFreeGroupOffset, computeBoundedDelta } from '../src/components/RoomEditor/geometry.mjs';

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

test('computeBoundedDelta keeps the desk within wall bounds (and grid-snaps the result)', () => {
  const moving = [{ id: 'm', x: 20, y: 70, capacity: 1 }];
  const result = computeBoundedDelta({ movingDesks: moving, rawDx: -50, rawDy: -50, stationaryDesks: [] });
  const finalX = moving[0].x + result.dx;
  const finalY = moving[0].y + result.dy;
  // Vegg-grensene (WALL_LEFT=15, WALL_TOP=60) skal aldri krysses, og siden
  // ingen magnetisk snap er mulig (ingen stasjonære bord), skal sluttposisjonen
  // alltid rutenett-justeres til nærmeste 10px.
  assert.ok(finalX >= 15, `finalX ${finalX} skal ikke krysse venstre vegg`);
  assert.ok(finalY >= 60, `finalY ${finalY} skal ikke krysse øvre vegg`);
  assert.equal(finalX % 10, 0);
  assert.equal(finalY % 10, 0);
});

test('computeBoundedDelta snaps to the nearest candidate, not the first in array order', () => {
  const moving = [{ id: 'm', x: 0, y: 100, capacity: 1 }];
  // 'far' er først i listen, men krever et mye større hopp fra rå-draget (pull=19)
  // enn 'near' (pull=1) for å snappe pent inntil. Nærmeste skal vinne uansett
  // rekkefølge i arrayet.
  const stationary = [
    { id: 'far', x: 419, y: 100, capacity: 1 },
    { id: 'near', x: 401, y: 100, capacity: 1 },
  ];
  const result = computeBoundedDelta({ movingDesks: moving, rawDx: 300, rawDy: 0, stationaryDesks: stationary });
  assert.equal(result.isSnapped, true);
  assert.equal(result.dx, 301);
  assert.deepEqual(result.targetDeskIds, ['near']);
});

test('computeBoundedDelta falls back to 10px grid snap when nothing is nearby', () => {
  const moving = [{ id: 'm', x: 103, y: 203, capacity: 1 }];
  const result = computeBoundedDelta({ movingDesks: moving, rawDx: 4, rawDy: 4, stationaryDesks: [] });
  assert.equal(result.isSnapped, false);
  assert.equal((moving[0].x + result.dx) % 10, 0);
  assert.equal((moving[0].y + result.dy) % 10, 0);
});

test('computeBoundedDelta with skipSnap=true skips both magnetic and grid snapping', () => {
  const moving = [{ id: 'm', x: 103, y: 203, capacity: 1 }];
  const result = computeBoundedDelta({ movingDesks: moving, rawDx: 44, rawDy: 17, stationaryDesks: [], skipSnap: true });
  assert.equal(result.isSnapped, false);
  assert.equal(result.dx, 44);
  assert.equal(result.dy, 17);
});

test('computeBoundedDelta blocks a move that would create a new overlap', () => {
  const moving = [{ id: 'm', x: 0, y: 100, capacity: 1 }];
  const stationary = [{ id: 's', x: 150, y: 100, capacity: 1 }];
  const result = computeBoundedDelta({ movingDesks: moving, rawDx: 100, rawDy: 0, stationaryDesks: stationary, skipSnap: true });
  // Rå delta ville plassert 'm' oppå 's' (m: 100-200 vs s: 150-250) - blokkeres til dx=0
  assert.equal(result.dx, 0);
});

test('computeBoundedDelta with ignoreOverlapIds allows moving out of a pre-existing overlap', () => {
  const moving = [{ id: 'm', x: 100, y: 100, capacity: 1 }]; // overlapper 's' allerede før draget
  const stationary = [{ id: 's', x: 100, y: 100, capacity: 1 }];
  const result = computeBoundedDelta({
    movingDesks: moving, rawDx: 50, rawDy: 0, stationaryDesks: stationary,
    skipSnap: true, ignoreOverlapIds: ['s']
  });
  // Uten ignoreOverlapIds ville dette blitt blokkert siden 'm' fortsatt
  // overlapper 's' underveis - men 's' er eksplisitt unntatt siden overlappet
  // fantes allerede før draget startet.
  assert.equal(result.dx, 50);
});
