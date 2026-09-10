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
