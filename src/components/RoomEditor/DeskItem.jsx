import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

const GROUP_COLORS = [
  '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981',
  '#ef4444', '#6366f1', '#14b8a6', '#f97316', '#84cc16',
  '#06b6d4', '#d946ef', '#e11d48', '#22c55e', '#64748b'
];

const zoneMeta = {
  window: { label: 'Vindurekke', badgeClass: 'border-yellow-500/40 text-yellow-300 bg-yellow-950/80' },
  door: { label: 'Dørsone', badgeClass: 'border-amber-500/40 text-amber-300 bg-amber-950/80' },
  front: { label: 'Fremste rad', badgeClass: 'border-emerald-500/40 text-emerald-300 bg-emerald-950/80' },
  back: { label: 'Bakerste rad', badgeClass: 'border-purple-500/40 text-purple-300 bg-purple-950/80' },
  center: { label: 'Midtsone', badgeClass: 'border-cyan-500/40 text-cyan-300 bg-cyan-950/80' }
};

export default function DeskItem({
  desk,
  isSelected,
  showNumbers,
  showZones,
  deskNumber,
  onContextMenu,
  onClick
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: desk.id,
    data: { type: 'desk', desk }
  });

  const activeZones = desk.zones || [];
  const cap = desk.capacity || 1;
  const deskWidth = cap * 100;
  const groupColor = desk.groupId ? GROUP_COLORS[(desk.groupId - 1) % GROUP_COLORS.length] : null;

  let borderStyle = groupColor ? { borderWidth: '3px', borderColor: groupColor } : {};
  let borderClass = 'border border-slate-700/70 bg-base-200 hover:border-[#34d399]';
  
  if (isSelected) {
    borderClass = 'border-2 border-indigo-500 bg-indigo-950/50 shadow-[0_0_16px_rgba(99,102,241,0.6)] z-20 scale-105';
  }
  
  if (isDragging) {
    borderClass += ' opacity-50 shadow-2xl scale-110';
  }

  const style = {
    left: desk.x,
    top: desk.y,
    width: `${deskWidth}px`,
    ...borderStyle,
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      id={`desk-item-${desk.id}`}
      className={`absolute h-[60px] rounded-xl flex flex-col justify-between p-1.5 select-none cursor-pointer desk-item ${borderClass}`}
      style={{ ...style, width: `${deskWidth}px`, zIndex: isDragging ? 10 : 1 }}
      {...attributes}
      {...listeners}
      onContextMenu={(e) => onContextMenu(e, desk)}
      onClick={(e) => onClick(e, desk)}
    >
      {showNumbers && (
        <div className="absolute top-1 left-1.5 z-20">
          <span className="px-1.5 py-0.5 min-w-[20px] rounded bg-base-300/90 border border-slate-700/50 text-slate-300 font-extrabold text-[10px] flex items-center justify-center shadow-sm">
            {deskNumber}
          </span>
        </div>
      )}

      {desk.groupId && (
        <div className="absolute -top-2.5 right-2 z-20">
          <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded text-slate-950 shadow" style={{ backgroundColor: groupColor }}>
            Gruppe {desk.groupId}
          </span>
        </div>
      )}

      <div className="flex gap-1 w-full flex-1 items-center justify-center">
        {Array.from({ length: cap }).map((_, slotIdx) => (
          <div key={slotIdx} className="flex-1 h-full bg-surface-field rounded-lg flex items-center justify-center text-xs font-bold text-slate-400">
          </div>
        ))}
      </div>

      {showZones && activeZones.length > 0 && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1 flex-wrap justify-center max-w-full z-30 whitespace-nowrap">
          {activeZones.map(zKey => {
            const zm = zoneMeta[zKey];
            return zm ? (
              <span key={zKey} className={`text-[9px] px-2 py-0.5 rounded-full font-bold border shadow ${zm.badgeClass}`}>
                {zm.label}
              </span>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
