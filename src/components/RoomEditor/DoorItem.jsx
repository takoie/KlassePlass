import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

export default function DoorItem({ door, onRotate, onRemove }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `door-${door.id}`,
    data: { type: 'door', door }
  });

  const style = {
    left: door.x,
    top: door.y,
    width: door.rotation % 180 === 0 ? '64px' : '40px',
    height: door.rotation % 180 === 0 ? '40px' : '64px',
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div 
      ref={setNodeRef}
      className="absolute select-none z-10 cursor-move group flex items-center justify-center"
      style={style}
      {...attributes}
      {...listeners}
    >
      <div style={{ transform: `rotate(${door.rotation}deg)` }} className="w-full h-full flex items-center justify-center">
        <svg width="60" height="40" viewBox="0 0 60 40" className="overflow-visible">
          <rect x="0" y="36" width="60" height="4" fill="#f59e0b" opacity="0.4" />
          <path d="M 0 36 A 36 36 0 0 1 36 0" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="0" y1="36" x2="36" y2="0" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      </div>

      <div className="absolute -top-3 right-0 opacity-0 group-hover:opacity-100 flex gap-1 bg-slate-900/90 p-0.5 rounded border border-slate-700 pointer-events-auto">
        <button 
          className="text-[10px] text-emerald-400 hover:text-white px-1 font-bold" 
          onClick={(e) => { e.stopPropagation(); onRotate(door.id); }} 
          title="Roter 90°"
          onPointerDown={(e) => e.stopPropagation()} // Prevent drag start when clicking button
        >🔄</button>
        <button 
          className="text-[10px] text-red-400 hover:text-white px-1 font-bold" 
          onClick={(e) => { e.stopPropagation(); onRemove(door.id); }} 
          title="Slett dør"
          onPointerDown={(e) => e.stopPropagation()}
        >✕</button>
      </div>
    </div>
  );
}
