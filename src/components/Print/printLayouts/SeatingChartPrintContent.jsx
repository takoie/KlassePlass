import React from 'react';
import { lightenHex } from '../../../shared/utils';
import { BOARD_W, BOARD_H, DESK_H, CONTENT_WIDTH_PX, CONTENT_HEIGHT_PX, computeCenteringOffset } from './printGeometry';

export { CONTENT_WIDTH_PX, CONTENT_HEIGHT_PX };

export default function SeatingChartPrintContent({
  boardObj, desks, deskNumberMap, placements, getStudentByIdOrName,
  groupColors, zoneMeta, groupOverrides, settings,
}) {
  const { showNumbers, showZones, showGroups, showColors, colorSeats } = settings;
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
        // NB: denne gruppefarge-oppløsningen (groupOverrides-fallback + palett-indeksering)
        // er duplisert i buildSeatingChartPrintPayload.js for PDF-eksport, siden Rust ikke
        // kan kjøre JS-domenelogikk. Endres logikken her, må den speiles der også.
        const gId = (groupOverrides && groupOverrides[d.id]) || d.groupId;
        const groupColor = (gId && showGroups) ? groupColors[(gId - 1) % groupColors.length] : null;
        const activeZones = showZones ? (d.zones || []) : [];
        const fillColor = (showColors && groupColor && colorSeats) ? lightenHex(groupColor, 0.65) : null;
        return (
          <div
            key={d.id}
            className="print-desk"
            style={{
              left: d.x + offset.x, top: d.y + offset.y, width: deskW, height: DESK_H,
              borderColor: showColors && groupColor ? groupColor : '#475569',
              ...(fillColor ? { background: fillColor } : {}),
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
                  // NB: samme sone-oppløsning (zoneMeta-oppslag + showColors/'#555'-fallback)
                  // er duplisert i buildSeatingChartPrintPayload.js for PDF-eksport — se NB
                  // over ved gruppefargen for hvorfor (Rust har ingen domenelogikk).
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
