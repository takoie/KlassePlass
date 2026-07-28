import React from 'react';

export const CONTENT_WIDTH_PX = 1100;
export const CONTENT_HEIGHT_PX = 700;

export default function SeatingChartPrintContent({
  boardObj, desks, deskNumberMap, placements, getStudentByIdOrName,
  groupColors, zoneMeta, settings,
}) {
  const { showNumbers, showZones, showGroups, showColors } = settings;
  return (
    <div style={{ position: 'relative', width: CONTENT_WIDTH_PX, height: CONTENT_HEIGHT_PX }}>
      <div
        style={{
          position: 'absolute', left: boardObj.x, top: boardObj.y, width: 256, height: 36,
          border: '1px solid #374151', borderRadius: 18, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', color: '#374151',
        }}
      >
        TAVLE
      </div>
      {desks.map((d) => {
        const cap = d.capacity || 1;
        const deskW = cap * 100;
        const deskNumber = deskNumberMap[d.id] || '';
        const gId = d.groupId;
        const groupColor = (gId && showGroups) ? groupColors[(gId - 1) % groupColors.length] : null;
        const activeZones = showZones ? (d.zones || []) : [];
        return (
          <div
            key={d.id}
            className="print-desk"
            style={{
              left: d.x, top: d.y, width: deskW, height: 60,
              borderColor: showColors && groupColor ? groupColor : '#374151',
            }}
          >
            {showNumbers && (
              <span style={{ position: 'absolute', top: -14, left: -4, fontSize: 10, fontWeight: 700, color: '#555' }}>
                {deskNumber}
              </span>
            )}
            {showGroups && gId && (
              <span
                style={{
                  position: 'absolute', top: -14, right: -2, fontSize: 8, fontWeight: 700,
                  color: showColors ? '#fff' : '#111', background: showColors ? groupColor : 'transparent',
                  border: showColors ? 'none' : '1px solid #374151', borderRadius: 4, padding: '1px 4px',
                }}
              >
                {gId}
              </span>
            )}
            <div style={{ display: 'flex', width: '100%', height: '100%' }}>
              {Array.from({ length: cap }).map((_, slotIdx) => {
                const slotKey = `${d.id}_seat_${slotIdx}`;
                const studentVal = placements[slotKey];
                const studentObj = studentVal ? getStudentByIdOrName(studentVal) : null;
                return (
                  <div
                    key={slotIdx}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: slotIdx > 0 ? '1px solid #e5e7eb' : 'none', overflow: 'hidden' }}
                  >
                    <span className={`print-desk-name ${studentObj ? '' : 'print-desk-empty'}`}>
                      {studentObj ? studentObj.name : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
            {activeZones.length > 0 && (
              <div style={{ position: 'absolute', bottom: -12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 2 }}>
                {activeZones.map((zKey) => {
                  const zm = zoneMeta[zKey];
                  if (!zm) return null;
                  return (
                    <span key={zKey} style={{ fontSize: 7, fontWeight: 700, padding: '1px 3px', border: '1px solid #999', borderRadius: 6, whiteSpace: 'nowrap' }}>
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
