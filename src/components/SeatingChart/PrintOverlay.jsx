import React from 'react';

/**
 * Utskriftsvisning — usynlig på skjerm, vises kun av skriveren via
 * @media print (print.css). Ren presentasjon, ingen egen state.
 */
export default function PrintOverlay({ chartName, className, chartComment, boardObj, desks, deskNumberMap, placements, getStudentByIdOrName }) {
  return (
    <div id="print-overlay">
      <div className="print-header">
        <div>
          <div className="print-chart-name">{chartName || 'Klassekart'}</div>
          <div className="print-meta">
            {className || ''}
            {chartComment ? ` · ${chartComment}` : ''}
          </div>
        </div>
        <div className="print-meta">{new Date().toLocaleDateString('no-NO')}</div>
      </div>
      <div className="print-canvas-wrapper" style={{ width: '1100px', height: '700px' }}>
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
          return (
            <div key={d.id} className="print-desk" style={{ left: d.x, top: d.y, width: deskW, height: 60 }}>
              <span style={{ position: 'absolute', top: -14, left: -4, fontSize: 10, fontWeight: 700, color: '#555' }}>{deskNumber}</span>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
