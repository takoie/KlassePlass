import React, { useLayoutEffect, useRef, useState } from 'react';

/** Høyreklikk-meny på ett eller flere valgte bord: gruppe, kapasitet, soner, dupliser/slett. */
export default function DeskContextMenu({
  contextMenu, setContextMenu, selectedDesks,
  createGroupForSelected, clearGroupForSelected,
  setDeskCapacity, toggleZoneOnSelected,
  handleDuplicateSelected, handleDeleteSelected,
}) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  // Menyens reelle høyde varierer med innhold og kan ikke gjettes på forhånd -
  // mål den faktiske DOM-størrelsen og klem den innenfor vinduet før den vises,
  // slik at den ikke havner delvis skjult under vinduskanten når bordet ligger langt ned.
  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current) { setPos(null); return; }
    const margin = 8;
    const { offsetWidth: w, offsetHeight: h } = menuRef.current;
    let top = contextMenu.mouseY;
    let left = contextMenu.mouseX;
    if (top + h > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - h - margin);
    if (left + w > window.innerWidth - margin) left = Math.max(margin, window.innerWidth - w - margin);
    setPos({ top, left });
  }, [contextMenu]);

  if (!contextMenu) return null;

  const style = pos
    ? { top: pos.top, left: pos.left }
    : { top: contextMenu.mouseY, left: contextMenu.mouseX, visibility: 'hidden' };

  return (
    <ul
      ref={menuRef}
      className="menu bg-surface-raised border border-slate-700 rounded-2xl shadow-2xl fixed z-50 p-2 text-xs text-slate-200 w-56"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      <li className="menu-title py-1 px-2 text-[10px] uppercase opacity-50 text-slate-400">Makkergrupper</li>
      <li><a onClick={() => { createGroupForSelected(); setContextMenu(null); }}><i className="fa-solid fa-object-group text-amber-400"></i> Lag makkergruppe</a></li>
      <li><a onClick={() => { clearGroupForSelected(); setContextMenu(null); }}><i className="fa-solid fa-object-ungroup text-slate-400"></i> Fjern fra gruppe</a></li>
      <div className="divider my-0 h-1"></div>
      <li className="menu-title py-1 px-2 text-[10px] uppercase opacity-50 text-slate-400">Plasser per bord</li>
      <div className="flex gap-1 px-2 py-1">
        <button className="btn btn-xs btn-outline flex-1 border-slate-700 text-[#34d399]" onClick={() => { setDeskCapacity(1); setContextMenu(null); }}>1</button>
        <button className="btn btn-xs btn-outline flex-1 border-slate-700 text-cyan-300" onClick={() => { setDeskCapacity(2); setContextMenu(null); }}>2</button>
        <button className="btn btn-xs btn-outline flex-1 border-slate-700 text-indigo-300" onClick={() => { setDeskCapacity(3); setContextMenu(null); }}>3</button>
        <button className="btn btn-xs btn-outline flex-1 border-slate-700 text-purple-300" onClick={() => { setDeskCapacity(4); setContextMenu(null); }}>4</button>
      </div>
      <div className="divider my-0 h-1"></div>
      <li className="menu-title py-1 px-2 text-[10px] uppercase opacity-50 text-slate-400">Toggle soner ({selectedDesks.length})</li>
      <li><a onClick={() => { toggleZoneOnSelected('window'); setContextMenu(null); }}><i className="fa-solid fa-sun text-yellow-400"></i> Vindurekke</a></li>
      <li><a onClick={() => { toggleZoneOnSelected('door'); setContextMenu(null); }}><i className="fa-solid fa-door-open text-amber-400"></i> Dørsone</a></li>
      <li><a onClick={() => { toggleZoneOnSelected('front'); setContextMenu(null); }}><i className="fa-solid fa-location-dot text-emerald-400"></i> Fremste rad</a></li>
      <li><a onClick={() => { toggleZoneOnSelected('back'); setContextMenu(null); }}><i className="fa-solid fa-arrow-down text-purple-400"></i> Bakerste rad</a></li>
      <li><a onClick={() => { toggleZoneOnSelected('center'); setContextMenu(null); }}><i className="fa-solid fa-align-center text-cyan-400"></i> Midtsone</a></li>
      <div className="divider my-0 h-1"></div>
      <li className="menu-title py-1 px-2 text-[10px] uppercase opacity-50 text-slate-400">Handlinger</li>
      <li><a onClick={handleDuplicateSelected}><i className="fa-solid fa-copy"></i> Dupliser bord ({selectedDesks.length})</a></li>
      <div className="divider my-0 h-1"></div>
      <li className="text-red-400"><a onClick={handleDeleteSelected}><i className="fa-solid fa-trash"></i> Slett bord ({selectedDesks.length})</a></li>
    </ul>
  );
}
