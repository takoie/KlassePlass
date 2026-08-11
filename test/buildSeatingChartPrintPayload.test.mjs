import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeatingChartPrintPayload } from '../src/components/Print/printLayouts/buildSeatingChartPrintPayload.js';

const GROUP_COLORS = ['#e11d48', '#2563eb', '#16a34a'];
const ZONE_META = {
  quiet: { label: 'STILLE', printColor: '#7c3aed' },
  noPrintColor: { label: 'INGEN-FARGE' },
};

function baseSettings(overrides = {}) {
  return {
    showNumbers: true,
    showZones: true,
    showGroups: true,
    showColors: true,
    ...overrides,
  };
}

function makeStudent(id, name) {
  return { id, name };
}

function getStudentByIdOrName(students) {
  return (val) => students.find((s) => s.id === val || s.name === val) || null;
}

test('desk with a placed student resolves studentName and seatNumber', () => {
  const students = [makeStudent('s1', 'Ola Nordmann')];
  const desks = [{ id: 'd1', x: 10, y: 20, capacity: 1 }];
  const payload = buildSeatingChartPrintPayload({
    boardObj: { x: 0, y: 0 },
    desks,
    deskNumberMap: { d1: [7] },
    placements: { d1_seat_0: 's1' },
    getStudentByIdOrName: getStudentByIdOrName(students),
    groupColors: GROUP_COLORS,
    zoneMeta: ZONE_META,
    groupOverrides: {},
    settings: baseSettings(),
    chartName: 'Klasse A',
    periodText: '1ST5',
  });
  assert.equal(payload.desks.length, 1);
  assert.deepEqual(payload.desks[0].seats, [{ studentName: 'Ola Nordmann', seatNumber: 7 }]);
  assert.equal(payload.chartName, 'Klasse A');
  assert.equal(payload.periodText, '1ST5');
});

test('empty desk slot yields studentName: null', () => {
  const desks = [{ id: 'd1', x: 0, y: 0, capacity: 1 }];
  const payload = buildSeatingChartPrintPayload({
    boardObj: { x: 0, y: 0 },
    desks,
    deskNumberMap: {},
    placements: {},
    getStudentByIdOrName: getStudentByIdOrName([]),
    groupColors: GROUP_COLORS,
    zoneMeta: ZONE_META,
    groupOverrides: {},
    settings: baseSettings(),
    chartName: '',
    periodText: '',
  });
  assert.deepEqual(payload.desks[0].seats, [{ studentName: null, seatNumber: null }]);
});

test('group color applied via desk.groupId, palette-indexed with (gId - 1) % length', () => {
  const desks = [{ id: 'd1', x: 0, y: 0, capacity: 1, groupId: 4 }]; // (4-1)%3 = 0
  const payload = buildSeatingChartPrintPayload({
    boardObj: { x: 0, y: 0 },
    desks,
    deskNumberMap: {},
    placements: {},
    getStudentByIdOrName: getStudentByIdOrName([]),
    groupColors: GROUP_COLORS,
    zoneMeta: ZONE_META,
    groupOverrides: {},
    settings: baseSettings(),
    chartName: '',
    periodText: '',
  });
  assert.equal(payload.desks[0].borderColorHex, GROUP_COLORS[0]);
});

test('groupOverrides takes precedence over desk.groupId', () => {
  const desks = [{ id: 'd1', x: 0, y: 0, capacity: 1, groupId: 4 }]; // would be GROUP_COLORS[0]
  const payload = buildSeatingChartPrintPayload({
    boardObj: { x: 0, y: 0 },
    desks,
    deskNumberMap: {},
    placements: {},
    getStudentByIdOrName: getStudentByIdOrName([]),
    groupColors: GROUP_COLORS,
    zoneMeta: ZONE_META,
    groupOverrides: { d1: 2 }, // (2-1)%3 = 1
    settings: baseSettings(),
    chartName: '',
    periodText: '',
  });
  assert.equal(payload.desks[0].borderColorHex, GROUP_COLORS[1]);
});

test('showGroups: false forces default border color even with a groupId present', () => {
  const desks = [{ id: 'd1', x: 0, y: 0, capacity: 1, groupId: 4 }];
  const payload = buildSeatingChartPrintPayload({
    boardObj: { x: 0, y: 0 },
    desks,
    deskNumberMap: {},
    placements: {},
    getStudentByIdOrName: getStudentByIdOrName([]),
    groupColors: GROUP_COLORS,
    zoneMeta: ZONE_META,
    groupOverrides: {},
    settings: baseSettings({ showGroups: false }),
    chartName: '',
    periodText: '',
  });
  assert.equal(payload.desks[0].borderColorHex, '#475569');
});

test('showColors: false forces default border color even with a resolved group color', () => {
  const desks = [{ id: 'd1', x: 0, y: 0, capacity: 1, groupId: 4 }];
  const payload = buildSeatingChartPrintPayload({
    boardObj: { x: 0, y: 0 },
    desks,
    deskNumberMap: {},
    placements: {},
    getStudentByIdOrName: getStudentByIdOrName([]),
    groupColors: GROUP_COLORS,
    zoneMeta: ZONE_META,
    groupOverrides: {},
    settings: baseSettings({ showColors: false }),
    chartName: '',
    periodText: '',
  });
  assert.equal(payload.desks[0].borderColorHex, '#475569');
});

test('zones included with resolved label/color when showZones: true', () => {
  const desks = [{ id: 'd1', x: 0, y: 0, capacity: 1, zones: ['quiet', 'noPrintColor', 'unknownZone'] }];
  const payload = buildSeatingChartPrintPayload({
    boardObj: { x: 0, y: 0 },
    desks,
    deskNumberMap: {},
    placements: {},
    getStudentByIdOrName: getStudentByIdOrName([]),
    groupColors: GROUP_COLORS,
    zoneMeta: ZONE_META,
    groupOverrides: {},
    settings: baseSettings(),
    chartName: '',
    periodText: '',
  });
  // 'unknownZone' has no zoneMeta entry -> filtered out.
  // 'noPrintColor' has no printColor -> falls back to '#555'.
  assert.deepEqual(payload.desks[0].zoneChips, [
    { label: 'STILLE', colorHex: '#7c3aed' },
    { label: 'INGEN-FARGE', colorHex: '#555' },
  ]);
});

test('zones excluded entirely when showZones: false', () => {
  const desks = [{ id: 'd1', x: 0, y: 0, capacity: 1, zones: ['quiet'] }];
  const payload = buildSeatingChartPrintPayload({
    boardObj: { x: 0, y: 0 },
    desks,
    deskNumberMap: {},
    placements: {},
    getStudentByIdOrName: getStudentByIdOrName([]),
    groupColors: GROUP_COLORS,
    zoneMeta: ZONE_META,
    groupOverrides: {},
    settings: baseSettings({ showZones: false }),
    chartName: '',
    periodText: '',
  });
  assert.deepEqual(payload.desks[0].zoneChips, []);
});

test('zone color falls back to #555 when showColors: false even if zoneMeta has printColor', () => {
  const desks = [{ id: 'd1', x: 0, y: 0, capacity: 1, zones: ['quiet'] }];
  const payload = buildSeatingChartPrintPayload({
    boardObj: { x: 0, y: 0 },
    desks,
    deskNumberMap: {},
    placements: {},
    getStudentByIdOrName: getStudentByIdOrName([]),
    groupColors: GROUP_COLORS,
    zoneMeta: ZONE_META,
    groupOverrides: {},
    settings: baseSettings({ showColors: false }),
    chartName: '',
    periodText: '',
  });
  assert.deepEqual(payload.desks[0].zoneChips, [{ label: 'STILLE', colorHex: '#555' }]);
});

test('seat numbers omitted (null) when showNumbers: false', () => {
  const desks = [{ id: 'd1', x: 0, y: 0, capacity: 1 }];
  const payload = buildSeatingChartPrintPayload({
    boardObj: { x: 0, y: 0 },
    desks,
    deskNumberMap: { d1: [3] },
    placements: {},
    getStudentByIdOrName: getStudentByIdOrName([]),
    groupColors: GROUP_COLORS,
    zoneMeta: ZONE_META,
    groupOverrides: {},
    settings: baseSettings({ showNumbers: false }),
    chartName: '',
    periodText: '',
  });
  assert.equal(payload.desks[0].seats[0].seatNumber, null);
});

test('desk without a seat number entry for its slot yields seatNumber: null even with showNumbers: true', () => {
  const desks = [{ id: 'd1', x: 0, y: 0, capacity: 1 }];
  const payload = buildSeatingChartPrintPayload({
    boardObj: { x: 0, y: 0 },
    desks,
    deskNumberMap: {}, // no entry for d1 at all
    placements: {},
    getStudentByIdOrName: getStudentByIdOrName([]),
    groupColors: GROUP_COLORS,
    zoneMeta: ZONE_META,
    groupOverrides: {},
    settings: baseSettings(),
    chartName: '',
    periodText: '',
  });
  assert.equal(payload.desks[0].seats[0].seatNumber, null);
});

test('multi-seat desk resolves each slot independently via `${deskId}_seat_${slotIdx}` keys', () => {
  const students = [makeStudent('s1', 'A'), makeStudent('s2', 'B')];
  const desks = [{ id: 'd1', x: 0, y: 0, capacity: 3 }];
  const payload = buildSeatingChartPrintPayload({
    boardObj: { x: 0, y: 0 },
    desks,
    deskNumberMap: { d1: [1, 2, 3] },
    placements: { d1_seat_0: 's1', d1_seat_2: 's2' }, // slot 1 left empty
    getStudentByIdOrName: getStudentByIdOrName(students),
    groupColors: GROUP_COLORS,
    zoneMeta: ZONE_META,
    groupOverrides: {},
    settings: baseSettings(),
    chartName: '',
    periodText: '',
  });
  assert.deepEqual(payload.desks[0].seats, [
    { studentName: 'A', seatNumber: 1 },
    { studentName: null, seatNumber: 2 },
    { studentName: 'B', seatNumber: 3 },
  ]);
  assert.equal(payload.desks[0].capacity, 3);
});

test('board and desk positions are centered via the same bounding-box offset algorithm', () => {
  // A single 1-capacity desk (100x60) and the board (256x36) placed so the
  // combined bounding box is smaller than the 1100x700 canvas -> output
  // positions should be shifted by a computed centering offset, not raw x/y.
  const boardObj = { x: 0, y: 0 };
  const desks = [{ id: 'd1', x: 300, y: 300, capacity: 1 }];
  const payload = buildSeatingChartPrintPayload({
    boardObj,
    desks,
    deskNumberMap: {},
    placements: {},
    getStudentByIdOrName: getStudentByIdOrName([]),
    groupColors: GROUP_COLORS,
    zoneMeta: ZONE_META,
    groupOverrides: {},
    settings: baseSettings(),
    chartName: '',
    periodText: '',
  });
  // minX=0, minY=0, maxX=400 (300+100), maxY=336 (300+36 from board? no, board is at 0,0 h=36)
  // bounding box: board rect (0,0,256,36), desk rect (300,300,100,60)
  // minX=0, minY=0, maxX=max(256,400)=400, maxY=max(36,360)=360
  const offsetX = (1100 - (400 - 0)) / 2 - 0;
  const offsetY = (700 - (360 - 0)) / 2 - 0;
  assert.equal(payload.board.x, boardObj.x + offsetX);
  assert.equal(payload.board.y, boardObj.y + offsetY);
  assert.equal(payload.desks[0].x, desks[0].x + offsetX);
  assert.equal(payload.desks[0].y, desks[0].y + offsetY);
});
