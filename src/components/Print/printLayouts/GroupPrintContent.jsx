import React from 'react';
import { getPrintableAreaPx } from '../PrintPage';

export const GROUP_CONTENT_WIDTH_PX = 1000;

const HEADER_HEIGHT = 28;
const MEMBER_LINE_HEIGHT = 17;
const CARD_PADDING = 18;
const CARD_GAP = 12;
const MIN_COL_WIDTH = 200;
const MIN_HEIGHT = 150;

const gridCols = () => Math.max(1, Math.floor(GROUP_CONTENT_WIDTH_PX / MIN_COL_WIDTH));

function cardHeight(studentIds) {
  return HEADER_HEIGHT + CARD_PADDING + Math.max(1, studentIds.length) * MEMBER_LINE_HEIGHT;
}

function barHeight() {
  return HEADER_HEIGHT + CARD_PADDING + MEMBER_LINE_HEIGHT;
}

/**
 * Deler grupper inn i sider. "vertical" (rutenett, likt GroupEditor sin egen
 * kort-visning) pakker kolonne × rad basert på hvor mange kort som faktisk får
 * plass — bruker hele sidebredden i stedet for kun én smal kolonne. "horizontal"
 * (fulle bredde-striper, én rad medlemmer per gruppe) paginerer på akkumulert høyde.
 */
export function paginateGroups(groups, layout = 'vertical') {
  const printable = getPrintableAreaPx();

  if (layout === 'horizontal') {
    const pages = [];
    let current = [];
    let height = 0;
    groups.forEach((studentIds, idx) => {
      const h = barHeight() + CARD_GAP;
      if (current.length > 0 && height + h > printable.height) {
        pages.push(current);
        current = [];
        height = 0;
      }
      current.push({ studentIds, groupIdx: idx });
      height += h;
    });
    if (current.length > 0) pages.push(current);
    return pages.length > 0 ? pages : [[]];
  }

  const cols = gridCols();
  const rowHeight = Math.max(1, ...groups.map(cardHeight)) + CARD_GAP;
  const rowsPerPage = Math.max(1, Math.floor(printable.height / rowHeight));
  const groupsPerPage = cols * rowsPerPage;

  const pages = [];
  for (let i = 0; i < groups.length; i += groupsPerPage) {
    pages.push(groups.slice(i, i + groupsPerPage).map((studentIds, j) => ({ studentIds, groupIdx: i + j })));
  }
  return pages.length > 0 ? pages : [[]];
}

export function estimateGroupsPageHeight(groupsOnPage, layout = 'vertical') {
  if (layout === 'horizontal') {
    const total = groupsOnPage.reduce((sum, g) => sum + barHeight() + CARD_GAP, 0);
    return Math.max(MIN_HEIGHT, total);
  }
  const cols = gridCols();
  const rows = Math.ceil(groupsOnPage.length / cols) || 1;
  const rowHeight = Math.max(1, ...groupsOnPage.map(g => cardHeight(g.studentIds))) + CARD_GAP;
  return Math.max(MIN_HEIGHT, rows * rowHeight);
}

function GroupCard({ studentIds, groupIdx, color, showColors, leaderId, findStudentName, membersDirection, groupName }) {
  return (
    <div style={{ border: `1px solid ${color}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '4px 10px', fontSize: 12, fontWeight: 700, background: showColors ? color : '#f3f4f6', color: '#111' }}>
        {groupName || `Gruppe ${groupIdx + 1}`} <span style={{ fontWeight: 400, opacity: 0.7 }}>({studentIds.length} elever)</span>
      </div>
      <div style={{ padding: '6px 12px', display: 'flex', flexDirection: membersDirection, flexWrap: 'wrap', gap: membersDirection === 'row' ? '2px 16px' : 2 }}>
        {studentIds.length === 0 && <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>Ingen elever</span>}
        {studentIds.map((sid) => (
          <span key={sid} style={{ fontSize: 12, color: '#111' }}>
            {sid === leaderId ? '★ ' : ''}{findStudentName(sid)}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function GroupPrintContent({ groupsOnPage, studentsById, leaderIds, groupColors, groupNames, settings }) {
  const layout = settings.groupLayout || 'vertical';
  const findStudentName = (id) => studentsById[id]?.name || id;

  const cards = groupsOnPage.map(({ studentIds, groupIdx }) => {
    const color = (settings.showColors && groupColors) ? groupColors[groupIdx % groupColors.length] : '#374151';
    const leaderId = settings.showGroups ? leaderIds?.find(id => studentIds.includes(id)) : null;
    return (
      <GroupCard
        key={groupIdx}
        studentIds={studentIds} groupIdx={groupIdx} color={color} showColors={settings.showColors}
        leaderId={leaderId} findStudentName={findStudentName} groupName={groupNames?.[groupIdx]}
        membersDirection={layout === 'horizontal' ? 'row' : 'column'}
      />
    );
  });

  if (layout === 'horizontal') {
    return <div style={{ width: GROUP_CONTENT_WIDTH_PX, display: 'flex', flexDirection: 'column', gap: CARD_GAP }}>{cards}</div>;
  }

  return (
    <div style={{ width: GROUP_CONTENT_WIDTH_PX, display: 'grid', gridTemplateColumns: `repeat(${gridCols()}, 1fr)`, gap: CARD_GAP, alignItems: 'start' }}>
      {cards}
    </div>
  );
}
