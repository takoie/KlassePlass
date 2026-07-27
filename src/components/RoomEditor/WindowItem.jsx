import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

export default function WindowItem({ windowObj, onRotate, onRemove }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `window-${windowObj.id}`,
    data: { type: 'window', windowObj }
  });

  const style = {
    left: windowObj.x,
    top: windowObj.y,
    width: windowObj.rotation % 180 === 0 ? '80px' : '24px',
    height: windowObj.rotation % 180 === 0 ? '24px' : '80px',
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
      <div style={{ transform: `rotate(${windowObj.rotation}deg)` }} className="w-full h-full flex items-center justify-center">
        <div className="w-full h-full bg-cyan-950/60 border-2 border-cyan-400 rounded flex flex-col justify-between p-0.5 shadow">
          <div className="w-full h-[2px] bg-cyan-300 opacity-60"></div>
          <div className="text-[9px] font-bold text-cyan-200 text-center tracking-widest leading-none">VINDU</div>
          <div className="w-full h-[2px] bg-cyan-300 opacity-60"></div>
        </div>
      </div>

      <div className="absolute -top-3 right-0 opacity-0 group-hover:opacity-100 flex gap-1 bg-slate-900/90 p-0.5 rounded border border-slate-700 pointer-events-auto">
        <button 
          className="text-[10px] text-cyan-400 hover:text-white px-1 font-bold" 
          onClick={(e) => { e.stopPropagation(); onRotate(windowObj.id); }} 
          title="Roter 90°"
          onPointerDown={(e) => e.stopPropagation()}
        >🔄</button>
        <button 
          className="text-[10px] text-red-400 hover:text-white px-1 font-bold" 
          onClick={(e) => { e.stopPropagation(); onRemove(windowObj.id); }} 
          title="Slett vindu"
          onPointerDown={(e) => e.stopPropagation()}
        >✕</button>
      </div>
    </div>
  );
}
