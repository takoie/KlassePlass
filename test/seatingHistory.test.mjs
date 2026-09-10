import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sameArrangement, initHistory, historyReducer, MAX_HISTORY,
} from '../src/components/SeatingChart/seatingHistory.mjs';

const arr = (placements = {}, lockedSeats = {}, unusedSeats = {}, groupOverrides = {}) =>
  ({ placements, lockedSeats, unusedSeats, groupOverrides });

test('sameArrangement ignorerer nøkkelrekkefølge, ser reell forskjell', () => {
  assert.equal(sameArrangement(arr({ a: '1', b: '2' }), arr({ b: '2', a: '1' })), true);
  assert.equal(sameArrangement(arr({ a: '1' }), arr({ a: '2' })), false);
  assert.equal(sameArrangement(arr({}, { s: true }), arr({}, {})), false);
});

test('RECORD legger til steg, men ikke for identisk oppsett', () => {
  let s = initHistory(arr({ a: '1' }));
  s = historyReducer(s, { type: 'RECORD', snapshot: arr({ a: '1' }) }); // ingen endring
  assert.equal(s.past.length, 0);
  s = historyReducer(s, { type: 'RECORD', snapshot: arr({ a: '2' }) });
  assert.equal(s.past.length, 1);
  assert.deepEqual(s.present.placements, { a: '2' });
});

test('UNDO/REDO flytter mellom past og future og bumper applySeq', () => {
  let s = initHistory(arr({ p: 'start' }));
  s = historyReducer(s, { type: 'RECORD', snapshot: arr({ p: 'a' }) });
  s = historyReducer(s, { type: 'RECORD', snapshot: arr({ p: 'b' }) });
  const seq0 = s.applySeq;

  s = historyReducer(s, { type: 'UNDO' });
  assert.deepEqual(s.present.placements, { p: 'a' });
  assert.equal(s.future.length, 1);
  assert.equal(s.applySeq, seq0 + 1);

  s = historyReducer(s, { type: 'UNDO' });
  assert.deepEqual(s.present.placements, { p: 'start' });
  assert.equal(s.past.length, 0);

  s = historyReducer(s, { type: 'UNDO' }); // ingenting igjen
  assert.deepEqual(s.present.placements, { p: 'start' });

  s = historyReducer(s, { type: 'REDO' });
  assert.deepEqual(s.present.placements, { p: 'a' });
  s = historyReducer(s, { type: 'REDO' });
  assert.deepEqual(s.present.placements, { p: 'b' });
  assert.equal(s.future.length, 0);
});

test('en ny RECORD tømmer future (redo-grenen)', () => {
  let s = initHistory(arr({ p: 'start' }));
  s = historyReducer(s, { type: 'RECORD', snapshot: arr({ p: 'a' }) });
  s = historyReducer(s, { type: 'UNDO' });
  s = historyReducer(s, { type: 'RECORD', snapshot: arr({ p: 'c' }) });
  assert.equal(s.future.length, 0);
  assert.deepEqual(s.present.placements, { p: 'c' });
  s = historyReducer(s, { type: 'REDO' });
  assert.deepEqual(s.present.placements, { p: 'c' }); // redo gjør ingenting
});

test('RESTORE_OPEN hopper til åpningspunktet og kan angres videre', () => {
  let s = initHistory(arr({ p: 'open' }));
  s = historyReducer(s, { type: 'RECORD', snapshot: arr({ p: 'a' }) });
  s = historyReducer(s, { type: 'RECORD', snapshot: arr({ p: 'b' }) });
  s = historyReducer(s, { type: 'RESTORE_OPEN' });
  assert.deepEqual(s.present.placements, { p: 'open' });
  assert.equal(s.future.length, 0);
  // b lå på past-toppen før restore, så UNDO tar oss tilbake dit
  s = historyReducer(s, { type: 'UNDO' });
  assert.deepEqual(s.present.placements, { p: 'b' });
});

test('RESTORE_OPEN er en no-op når vi allerede er på åpningspunktet', () => {
  let s = initHistory(arr({ p: 'open' }));
  const before = s;
  s = historyReducer(s, { type: 'RESTORE_OPEN' });
  assert.equal(s, before);
});

test('RESET tømmer loggen og setter nytt åpningspunkt', () => {
  let s = initHistory(arr({ p: 'x' }));
  s = historyReducer(s, { type: 'RECORD', snapshot: arr({ p: 'y' }) });
  s = historyReducer(s, { type: 'RESET', snapshot: arr({ p: 'periode2' }) });
  assert.equal(s.past.length, 0);
  assert.equal(s.future.length, 0);
  assert.deepEqual(s.present.placements, { p: 'periode2' });
  assert.deepEqual(s.open.placements, { p: 'periode2' });
});

test('past er begrenset til MAX_HISTORY', () => {
  let s = initHistory(arr({ n: '0' }));
  for (let i = 1; i <= MAX_HISTORY + 25; i++) {
    s = historyReducer(s, { type: 'RECORD', snapshot: arr({ n: String(i) }) });
  }
  assert.equal(s.past.length, MAX_HISTORY);
});
