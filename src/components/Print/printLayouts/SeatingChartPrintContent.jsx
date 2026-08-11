import React from 'react';

export const CONTENT_WIDTH_PX = 1100;
export const CONTENT_HEIGHT_PX = 700;

const BOARD_W = 256;
const BOARD_H = 36;
const DESK_H = 60;

// Rommet i klasseromsbyggeren fyller ikke nødvendigvis hele det faste
// 1100×700-canvaset (f.eks. et smalt eller lite rom) — uten dette havner
// pultene der de en gang ble plassert på canvaset, som ofte er forskjøvet
// fra midten av papirarket. Vi regner derfor ut den faktiske bounding-boksen
// til tavle+pulter og sentrerer DEN i print-arealet, slik at utskriften alltid
// er sentrert uten at læreren må justere zoom/pan manuelt.
function computeCenteringOffset(boardObj, desks) {
  const rects = [
    { x: boardObj.x, y: boardObj.y, w: BOARD_W, h: BOARD_H },
    ...desks.map((d) => ({ x: d.x, y: d.y, w: (d.capacity || 1) * 100, h: DESK_H })),
  ];
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  return {
    x: (CONTENT_WIDTH_PX - (maxX - minX)) / 2 - minX,
    y: (CONTENT_HEIGHT_PX - (maxY - minY)) / 2 - minY,
  };
}

export default function SeatingChartPrintContent({
  boardObj, desks, deskNumberMap, placements, getStudentByIdOrName,
  groupColors, zoneMeta, groupOverrides, settings,
}) {
  const { showNumbers, showZones, showGroups, showColors } = settings;
  const offset = computeCenteringOffset(boardObj, desks);
  return (
    <div style={{ position: 'relative', width: CONTENT_WIDTH_PX, height: CONTENT_HEIGHT_PX }}>
      <div
        style={{
          position: 'absolute', left: boardObj.x + offset.x, top: boardObj.y + offset.y, width: BOARD_W, height: BOARD_H,
          border: '1px solid #374151', borderRadius: 18, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', color: '#374151',
        }}
      >
        TAVLE
      </div>
      {desks.map((d) => {
        const cap = d.capacity || 1;
        const deskW = cap * 100;
        const seatNumbers = deskNumberMap[d.id] || [];
        const gId = (groupOverrides && groupOverrides[d.id]) || d.groupId;
        const groupColor = (gId && showGroups) ? groupColors[(gId - 1) % groupColors.length] : null;
        const activeZones = showZones ? (d.zones || []) : [];
        return (
          <div
            key={d.id}
            className="print-desk"
            style={{
              left: d.x + offset.x, top: d.y + offset.y, width: deskW, height: DESK_H,
              borderColor: showColors && groupColor ? groupColor : '#475569',
            }}
          >
            <div style={{ display: 'flex', width: '100%', height: '100%' }}>
              {Array.from({ length: cap }).map((_, slotIdx) => {
                const slotKey = `${d.id}_seat_${slotIdx}`;
                const studentVal = placements[slotKey];
                const studentObj = studentVal ? getStudentByIdOrName(studentVal) : null;
                return (
                  <div
                    key={slotIdx}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: slotIdx > 0 ? '1px solid #e5e7eb' : 'none', overflow: 'hidden', position: 'relative' }}
                  >
                    {showNumbers && seatNumbers[slotIdx] !== undefined && (
                      <span style={{ position: 'absolute', top: -14, left: -2, fontSize: 10, fontWeight: 700, color: '#555' }}>
                        {seatNumbers[slotIdx]}
                      </span>
                    )}
                    <span className={`print-desk-name ${studentObj ? '' : 'print-desk-empty'}`}>
                      {studentObj ? studentObj.name : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
            {activeZones.length > 0 && (
              <div
                style={{
                  position: 'absolute', top: '100%', marginTop: 4, left: '50%', transform: 'translateX(-50%)',
                  display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2,
                  width: Math.max(deskW, 90), zIndex: 5,
                }}
              >
                {activeZones.map((zKey) => {
                  const zm = zoneMeta[zKey];
                  if (!zm) return null;
                  const color = (showColors && zm.printColor) ? zm.printColor : '#555';
                  return (
                    <span
                      key={zKey}
                      style={{
                        fontSize: 7, fontWeight: 700, padding: '1px 4px', borderRadius: 6, whiteSpace: 'nowrap',
                        color, border: `1px solid ${color}`, background: '#fff',
                      }}
                    >
                      {zm.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
