import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDeskRect, rectsOverlap, desksOverlap, findOverlappingDeskIds } from '../src/components/RoomEditor/geometry.mjs';

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
