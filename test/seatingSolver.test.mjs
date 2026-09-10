import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortSlotsByDeskOrder, scoreClassPlacement, findBestPlacement } from '../src/lib/seatingSolver.mjs';

const boardObj = { x: 422, y: 15 }; // tavle øverst

function makeDesks() {
  return [
    { id: 'd1', x: 100, y: 100, capacity: 2, zones: ['front'] },
    { id: 'd2', x: 300, y: 100, capacity: 2, zones: [] },
    { id: 'd3', x: 100, y: 300, capacity: 2, zones: ['door'] },
    { id: 'd4', x: 300, y: 300, capacity: 2, zones: ['back', 'window'] },
  ];
}

function buildSeatSlots(desks) {
  const slots = [];
  desks.forEach(d => {
    for (let s = 0; s < d.capacity; s++) slots.push({ slotKey: `${d.id}_seat_${s}`, deskId: d.id, slotIdx: s });
  });
  return slots;
}

test('sortSlotsByDeskOrder: fyller kronologisk, ingen isolerte elever ved delvis fylling', () => {
  const desks = makeDesks();
  const seatSlots = buildSeatSlots(desks);
  const sorted = sortSlotsByDeskOrder(seatSlots, desks, boardObj);

  // 3 elever, 8 seter -> kun seter fra de(t) første bord-paret i rekkefølge skal brukes.
  const targetSlots = sorted.slice(0, 3);
  const desksUsed = new Set(targetSlots.map(s => s.deskId));
  // De 3 første setene skal komme fra maks 2 pulter, og alltid de "tidligste" i rommet
  // (d1 og d2, øverste rad, venstre til høyre) - aldri hoppe over en pult.
  assert.ok(desksUsed.size <= 2);
  assert.ok([...desksUsed].every(id => id === 'd1' || id === 'd2'));
});

test('scoreClassPlacement: avoid-regel gir straff kun når elever faktisk deler pult', () => {
  const desks = makeDesks();
  const rule = { type: 'avoid', priority: 'critical', studentIds: ['s1', 's2'] };

  const separated = { d1_seat_0: 's1', d2_seat_0: 's2' };
  const together = { d1_seat_0: 's1', d1_seat_1: 's2' };

  assert.equal(scoreClassPlacement(separated, [rule], desks), 100);
  assert.equal(scoreClassPlacement(together, [rule], desks), 100 - 500);
});

test('scoreClassPlacement: pair-regel straffer når de IKKE sitter sammen', () => {
  const desks = makeDesks();
  const rule = { type: 'pair', priority: 'important', studentIds: ['s1', 's2'] };

  const together = { d1_seat_0: 's1', d1_seat_1: 's2' };
  const apart = { d1_seat_0: 's1', d2_seat_0: 's2' };

  assert.equal(scoreClassPlacement(together, [rule], desks), 100);
  assert.equal(scoreClassPlacement(apart, [rule], desks), 100 - 150);
});

test('scoreClassPlacement: sone-regler (nearBoard/sitBack/sitMiddle/awayDoor/awayWindow)', () => {
  const desks = makeDesks(); // d1=front, d3=door, d4=back+window

  const nearBoardOk = { d1_seat_0: 's1' };
  const nearBoardBad = { d2_seat_0: 's1' };
  assert.equal(scoreClassPlacement(nearBoardOk, [{ type: 'nearBoard', priority: 'wish', studentIds: ['s1'] }], desks), 100);
  assert.equal(scoreClassPlacement(nearBoardBad, [{ type: 'nearBoard', priority: 'wish', studentIds: ['s1'] }], desks), 100 - 30);

  const awayDoorOk = { d1_seat_0: 's1' };
  const awayDoorBad = { d3_seat_0: 's1' };
  assert.equal(scoreClassPlacement(awayDoorOk, [{ type: 'awayDoor', priority: 'important', studentIds: ['s1'] }], desks), 100);
  assert.equal(scoreClassPlacement(awayDoorBad, [{ type: 'awayDoor', priority: 'important', studentIds: ['s1'] }], desks), 100 - 150);

  const awayWindowBad = { d4_seat_0: 's1' };
  assert.equal(scoreClassPlacement(awayWindowBad, [{ type: 'awayWindow', priority: 'critical', studentIds: ['s1'] }], desks), 100 - 500);
});

test('findBestPlacement: finner en løsning som tilfredsstiller en oppnåelig avoid-regel', () => {
  const desks = makeDesks();
  const seatSlots = buildSeatSlots(desks);
  const students = [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }];
  const rule = { type: 'avoid', priority: 'critical', studentIds: ['s1', 's2'] };

  const { placements, score } = findBestPlacement({ seatSlots, students, classRules: [rule], desks });
  assert.equal(score, 100); // fullt oppnåelig med 4 seter fordelt på 4 pulter
  assert.equal(Object.values(placements).length, 4);
});

test('findBestPlacement: fyller aldri flere seter enn det er studenter', () => {
  const desks = makeDesks();
  const seatSlots = buildSeatSlots(desks); // 8 seter
  const students = [{ id: 's1' }, { id: 's2' }, { id: 's3' }]; // 3 studenter

  const { placements } = findBestPlacement({ seatSlots, students, desks });
  assert.equal(Object.values(placements).length, 3);
});

test('findBestPlacement: dupliserer aldri elever som allerede er låst i basePlacements', () => {
  const desks = makeDesks();
  // d1_seat_1 er låst til s2
  const basePlacements = { d1_seat_1: 's2' };
  // Åpne seter er alle unntatt det låste
  const seatSlots = buildSeatSlots(desks).filter(s => s.slotKey !== 'd1_seat_1');
  // Full elevliste som inkluderer s2
  const allStudents = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];

  const { placements } = findBestPlacement({ seatSlots, students: allStudents, basePlacements, desks });
  const placedValues = Object.values(placements);

  // s2 skal kun forekomme ÉN gang (på d1_seat_1)
  assert.equal(placedValues.filter(id => id === 's2').length, 1);
  assert.equal(placements.d1_seat_1, 's2');
  // Totalt antall plasserte elever skal være 3
  assert.equal(placedValues.length, 3);
});

