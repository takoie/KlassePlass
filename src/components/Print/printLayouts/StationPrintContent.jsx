import React from 'react';

export const STATION_CONTENT_WIDTH_PX = 1000;
export const STATION_CONTENT_HEIGHT_PX = 600;

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
