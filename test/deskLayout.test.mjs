import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDeskLayout, slotIndexAtPointerX, SEAT_W } from '../src/components/SeatingChart/deskLayout.mjs';

const desk = { id: 'd1', capacity: 4 }; // seteindekser 0,1,2,3

test('ingen skjulte plasser: full bredde, alle seter i vanlig rekkefølge', () => {
  const layout = getDeskLayout(desk, {}, {});
  assert.equal(layout.collapseUnused, false);
  assert.equal(layout.collapsedWhole, false);
  assert.deepEqual(layout.renderSlots, [0, 1, 2, 3]);
  assert.equal(layout.width, 4 * SEAT_W);
});

test('elever på plass 3-4, plass 1-2 skjult: bordet krymper og setene pakkes fra venstre', () => {
  const placements = { d1_seat_2: 'stu-a', d1_seat_3: 'stu-b' };
  const unusedSeats = { d1_seat_0: true, d1_seat_1: true };
  const layout = getDeskLayout(desk, placements, unusedSeats);

  assert.equal(layout.collapseUnused, true);
  assert.deepEqual(layout.renderSlots, [2, 3]);
  assert.equal(layout.width, 2 * SEAT_W);

  // Pekeren over venstre halvdel av det kollapsede bordet -> FAKTISK sete 2
  assert.equal(slotIndexAtPointerX(layout, 0, 0 + 10), 2);
  // Pekeren over høyre halvdel -> faktisk sete 3
  assert.equal(slotIndexAtPointerX(layout, 0, SEAT_W + 10), 3);
  // Pekeren forbi det kollapsede bordet (gammel plass 3-4-sone) klemmes til siste synlige
  assert.equal(slotIndexAtPointerX(layout, 0, 5 * SEAT_W), 3);
});

test('en skjult plass midt i: rekkefølgen hopper over den skjulte', () => {
  const placements = { d1_seat_0: 'a', d1_seat_2: 'b', d1_seat_3: 'c' };
  const unusedSeats = { d1_seat_1: true };
  const layout = getDeskLayout(desk, placements, unusedSeats);
  assert.deepEqual(layout.renderSlots, [0, 2, 3]);
  assert.equal(slotIndexAtPointerX(layout, 0, SEAT_W + 10), 2); // 2. synlige sete = faktisk sete 2
});

test('alle plasser skjult og ingen elever: hele bordet kollapset, ikke et slippmål', () => {
  const unusedSeats = { d1_seat_0: true, d1_seat_1: true, d1_seat_2: true, d1_seat_3: true };
  const layout = getDeskLayout(desk, {}, unusedSeats);
  assert.equal(layout.collapsedWhole, true);
  assert.equal(slotIndexAtPointerX(layout, 0, 10), null);
});

test('skjult plass som likevel har en elev teller ikke som skjult', () => {
  const placements = { d1_seat_0: 'a' };
  const unusedSeats = { d1_seat_0: true }; // merket ubrukt, men opptatt
  const layout = getDeskLayout(desk, placements, unusedSeats);
  assert.equal(layout.collapseUnused, false);
  assert.deepEqual(layout.renderSlots, [0, 1, 2, 3]);
});

// ---- computeDeskNumbering -----------------------------------------------

import { computeDeskNumbering } from '../src/components/SeatingChart/deskLayout.mjs';

const numDesks = [
  { id: 'a', x: 0,   y: 100, capacity: 2 },
  { id: 'b', x: 200, y: 100, capacity: 1 },
  { id: 'c', x: 0,   y: 300, capacity: 2 },
];
const dense = (arr) => Array.from(arr ?? []);

test('computeDeskNumbering: tavla øverst - fortløpende venstre->høyre, rad for rad', () => {
  const { deskNumberMap } = computeDeskNumbering(numDesks, { y: 25 });
  assert.deepEqual(dense(deskNumberMap.a), [1, 2]);
  assert.deepEqual(dense(deskNumberMap.b), [3]);
  assert.deepEqual(dense(deskNumberMap.c), [4, 5]);
});

test('computeDeskNumbering: tavla nederst - nederste rad først, høyre->venstre inni bordet', () => {
  const { sortedDesks, deskNumberMap } = computeDeskNumbering(numDesks, { y: 700 });
  // Nederste rad (y=300) kommer først: bare bord c der. Setene telles fra høyre:
  // slotIdx 1 får 1, slotIdx 0 får 2.
  assert.equal(sortedDesks[0].id, 'c');
  assert.deepEqual(dense(deskNumberMap.c), [2, 1]);
  // Deretter øverste rad, høyre->venstre: b (x=200) før a (x=0).
  assert.deepEqual(dense(deskNumberMap.b), [3]);
  assert.deepEqual(dense(deskNumberMap.a), [5, 4]);
});

test('computeDeskNumbering: ubrukte seter hopper over tellingen (klassekart)', () => {
  const { deskNumberMap } = computeDeskNumbering(numDesks, { y: 25 }, {
    unusedSeats: { 'a_seat_1': true },
  });
  assert.equal(deskNumberMap.a[0], 1);
  assert.equal(deskNumberMap.a[1], undefined);
  assert.deepEqual(dense(deskNumberMap.b), [2]);
  assert.deepEqual(dense(deskNumberMap.c), [3, 4]);
});

test('computeDeskNumbering: helt tomt bord hoppes over når hideEmptyDesks', () => {
  const { deskNumberMap } = computeDeskNumbering(numDesks, { y: 25 }, {
    placements: { 'a_seat_0': 's1', 'c_seat_0': 's2' },
    hideEmptyDesks: true,
  });
  assert.deepEqual(dense(deskNumberMap.a), [1, 2]);
  assert.equal(deskNumberMap.b[0], undefined);
  assert.deepEqual(dense(deskNumberMap.c), [3, 4]);
});

test('computeDeskNumbering: uten opts (romeditor) telles alle seter fortløpende', () => {
  const { deskNumberMap } = computeDeskNumbering(numDesks, { y: 25 });
  const total = Object.values(deskNumberMap).flat().filter(Boolean).length;
  assert.equal(total, 5);
});
