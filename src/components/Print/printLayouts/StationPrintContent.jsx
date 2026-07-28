import React from 'react';

export const STATION_CONTENT_WIDTH_PX = 1000;

export function estimateStationContentHeight({ stations = [], groups = [], rotationPlan = [] }) {
  const HEADER_HEIGHT = 36;
  const ROW_BASE = 30;
  const LINE_HEIGHT = 16;
  const MIN_HEIGHT = 200;

  const rowHeights = stations.map((_, stationIdx) => {
    const maxLines = Math.max(
      1,
      ...rotationPlan.map((step) => {
        const groupIdx = step[stationIdx];
        const studentIds = groups[groupIdx] || [];
        return studentIds.length;
      })
    );
    return ROW_BASE + maxLines * LINE_HEIGHT;
  });

  const total = HEADER_HEIGHT + rowHeights.reduce((sum, h) => sum + h, 0);
  return Math.max(MIN_HEIGHT, total);
}

export default function StationPrintContent({ stations, groups, groupLeaders, rotationPlan, students, settings }) {
  const findStudentName = (id) => students.find(s => s.id === id)?.name || id;

  return (
    <table className="station-print-table" style={{ width: STATION_CONTENT_WIDTH_PX }}>
      <thead>
        <tr>
          <th>Stasjon</th>
          {rotationPlan.map((_, i) => <th key={i}>Rotasjon {i + 1}</th>)}
        </tr>
      </thead>
      <tbody>
        {stations.map((station, stationIdx) => (
          <tr key={stationIdx}>
            <th>{station.name || `Stasjon ${stationIdx + 1}`}</th>
            {rotationPlan.map((step, rotIdx) => {
              const groupIdx = step[stationIdx];
              const studentIds = groups[groupIdx] || [];
              const leaderId = settings.showGroups ? groupLeaders?.[groupIdx] : null;
              return (
                <td key={rotIdx}>
                  {studentIds.map((sid) => (
                    <div key={sid}>
                      {settings.showGroups && sid === leaderId ? '★ ' : ''}
                      {findStudentName(sid)}
                    </div>
                  ))}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
