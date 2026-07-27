import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

export default function BoardItem({ boardObj }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: 'board',
    data: { type: 'board' }
  });

  const style = {
    left: boardObj.x,
    top: boardObj.y,
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div 
      ref={setNodeRef}
      className="absolute board-item z-20 cursor-move group select-none"
      style={style}
      {...attributes}
      {...listeners}
    >
      <div className="w-64 h-9 bg-slate-900/90 border border-[#f59e0b]/50 rounded-full shadow-xl flex items-center justify-center text-[#f59e0b] font-bold tracking-[0.5em] text-sm hover:border-[#f59e0b]">
        T A V L E
      </div>
    </div>
  );
}
