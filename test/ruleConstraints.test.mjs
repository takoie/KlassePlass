import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rulesToGroupConstraints,
  foldLegacyConstraints,
} from '../src/shared/ruleConstraints.mjs';

const students = [
  { id: 's1', name: 'Kari' },
  { id: 's2', name: 'Ola' },
  { id: 's3', name: 'Per' },
  { id: 's4', name: 'Nina' },
];

// ---- rulesToGroupConstraints ------------------------------------------------

test('kritisk avoid med 3 elever gir alle par som never_together', () => {
  const rules = [{ id: 'r1', type: 'avoid', priority: 'critical', studentIds: ['s1', 's2', 's3'] }];
  const out = rulesToGroupConstraints(rules, students);
  assert.deepEqual(
    out.map((c) => [c.studentA, c.studentB, c.type].join('|')).sort(),
    ['Kari|Ola|never_together', 'Kari|Per|never_together', 'Ola|Per|never_together'].sort()
  );
});

test('kun critical slipper gjennom', () => {
  const rules = [
    { id: 'r1', type: 'avoid', priority: 'important', studentIds: ['s1', 's2'] },
    { id: 'r2', type: 'avoid', priority: 'wish', studentIds: ['s3', 's4'] },
  ];
  assert.deepEqual(rulesToGroupConstraints(rules, students), []);
});

test('pair og supportPair blir always_together', () => {
  const rules = [
    { id: 'r1', type: 'pair', priority: 'critical', studentIds: ['s1', 's2'] },
    { id: 'r2', type: 'supportPair', priority: 'critical', studentIds: ['s3', 's4'] },
  ];
  const out = rulesToGroupConstraints(rules, students);
  assert.equal(out.length, 2);
  assert.ok(out.every((c) => c.type === 'always_together'));
});

test('sone-regler ignoreres for grupper', () => {
  const rules = [
    { id: 'r1', type: 'nearBoard', priority: 'critical', studentIds: ['s1'] },
    { id: 'r2', type: 'awayWindow', priority: 'critical', studentIds: ['s2', 's3'] },
  ];
  assert.deepEqual(rulesToGroupConstraints(rules, students), []);
});

test('ID uten matchende elev hoppes over (slettet elev)', () => {
  const rules = [{ id: 'r1', type: 'avoid', priority: 'critical', studentIds: ['s1', 'GHOST'] }];
  assert.deepEqual(rulesToGroupConstraints(rules, students), []);
});

test('duplikat-par (også reversert) fjernes', () => {
  const rules = [
    { id: 'r1', type: 'avoid', priority: 'critical', studentIds: ['s1', 's2'] },
    { id: 'r2', type: 'avoid', priority: 'critical', studentIds: ['s2', 's1'] },
  ];
  assert.equal(rulesToGroupConstraints(rules, students).length, 1);
});

test('tom / manglende regelliste gir tom liste', () => {
  assert.deepEqual(rulesToGroupConstraints([], students), []);
  assert.deepEqual(rulesToGroupConstraints(undefined, students), []);
});

// ---- foldLegacyConstraints ------------------------------------------------

const blob = () => ({
  students: [{ id: 's1', name: 'Kari' }, { id: 's2', name: 'Ola' }],
  rules: [],
});

test('gammel avoid-rad blir kritisk avoid-regel i blobben', () => {
  const out = foldLegacyConstraints(blob(), [
    { student_a: 'Kari', student_b: 'Ola', type: 'avoid' },
  ]);
  assert.equal(out.rules.length, 1);
  assert.equal(out.rules[0].type, 'avoid');
  assert.equal(out.rules[0].priority, 'critical');
  assert.deepEqual([...out.rules[0].studentIds].sort(), ['s1', 's2']);
});

test('together-rad blir pair-regel', () => {
  const out = foldLegacyConstraints(blob(), [
    { student_a: 'Kari', student_b: 'Ola', type: 'together' },
  ]);
  assert.equal(out.rules[0].type, 'pair');
});

test('rad som allerede finnes dobles ikke', () => {
  const b = blob();
  b.rules = [{ id: 'x', type: 'avoid', priority: 'critical', studentIds: ['s1', 's2'] }];
  const out = foldLegacyConstraints(b, [{ student_a: 'Kari', student_b: 'Ola', type: 'avoid' }]);
  assert.equal(out.rules.length, 1);
  assert.equal(out, b, 'ingen endring => samme referanse');
});

test('navn uten treff beholdes som rå streng', () => {
  const out = foldLegacyConstraints(blob(), [
    { student_a: 'Kari', student_b: 'Ukjent', type: 'avoid' },
  ]);
  assert.deepEqual([...out.rules[0].studentIds].sort(), ['Ukjent', 's1'].sort());
});

test('tom rad-liste lar blobben stå urørt (samme referanse)', () => {
  const b = blob();
  assert.equal(foldLegacyConstraints(b, []), b);
});
