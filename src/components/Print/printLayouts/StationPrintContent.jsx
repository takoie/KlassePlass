import React from 'react';
import { getPrintableAreaPx } from '../PrintPage';

const STATION_COL_WIDTH = 130;
const ROTATION_COL_WIDTH = 150;
const HEADER_HEIGHT = 40;
const ROW_BASE = 34;
const LINE_HEIGHT = 17;
const MIN_HEIGHT = 200;

/**
 * Deler rotasjonene inn i sider basert på hvor mange kolonner som faktisk får
 * plass i printbart areal — for mange rotasjoner i én tabell blir uleselig smalt.
 */
export function paginateStationRotations(rotationPlan) {
  const printable = getPrintableAreaPx();
  const maxCols = Math.max(1, Math.floor((printable.width - STATION_COL_WIDTH) / ROTATION_COL_WIDTH));
  const pages = [];
  for (let i = 0; i < rotationPlan.length; i += maxCols) {
    pages.push({ rotations: rotationPlan.slice(i, i + maxCols), startIndex: i });
  }
  return pages.length > 0 ? pages : [{ rotations: [], startIndex: 0 }];
}

export function getStationPageWidthPx(rotationsOnPage) {
  return STATION_COL_WIDTH + rotationsOnPage.length * ROTATION_COL_WIDTH;
}

export function estimateStationPageHeight({ stations = [], groups = [] }, rotationsOnPage) {
  const rowHeights = stations.map((_, stationIdx) => {
    const maxLines = Math.max(
      1,
      ...rotationsOnPage.map((step) => {
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

export default function StationPrintContent({
  stations, groups, groupLeaders, rotationsOnPage, startIndex, students, groupColors, settings,
}) {
  const findStudentName = (id) => students.find(s => s.id === id)?.name || id;

  return (
    <table className="station-print-table" style={{ width: getStationPageWidthPx(rotationsOnPage) }}>
      <thead>
        <tr>
          <th style={{ width: STATION_COL_WIDTH }}>Stasjon</th>
          {rotationsOnPage.map((_, i) => <th key={i} style={{ width: ROTATION_COL_WIDTH }}>Rotasjon {startIndex + i + 1}</th>)}
        </tr>
      </thead>
      <tbody>
        {stations.map((station, stationIdx) => (
          <tr key={stationIdx}>
            <th>{station.name || `Stasjon ${stationIdx + 1}`}</th>
            {rotationsOnPage.map((step, rotIdx) => {
              const groupIdx = step[stationIdx];
              const studentIds = groups[groupIdx] || [];
              const leaderId = settings.showGroups ? groupLeaders?.[groupIdx] : null;
              const groupColor = (settings.showColors && groupColors && typeof groupIdx === 'number')
                ? groupColors[groupIdx % groupColors.length] : null;
              return (
                <td key={rotIdx}>
                  {groupColor && (
                    <span style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, marginBottom: 3, background: groupColor, color: '#111' }}>
                      Gruppe {groupIdx + 1}
                    </span>
                  )}
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
