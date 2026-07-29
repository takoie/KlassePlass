import React, { useLayoutEffect, useRef, useState } from 'react';

/** Høyreklikk-meny på et bord: lås/lås opp, sett/fjern makkergruppe. */
export default function DeskContextMenu({ contextMenu, lockedSeats, toggleLockDesk, setContextMenu, handleSetGroupContextMenu, GROUP_COLORS }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  // Mål faktisk menyhøyde og klem posisjonen innenfor vinduet, så menyen ikke
  // havner delvis skjult under vinduskanten når bordet ligger langt ned/til høyre.
  useLayoutEffect(() => {
    if (!contextMenu?.desk || !menuRef.current) { setPos(null); return; }
    const margin = 8;
    const { offsetWidth: w, offsetHeight: h } = menuRef.current;
    let left = contextMenu.x;
    let top = contextMenu.y;
    if (top + h > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - h - margin);
    if (left + w > window.innerWidth - margin) left = Math.max(margin, window.innerWidth - w - margin);
    setPos({ top, left });
  }, [contextMenu]);

  if (!contextMenu || !contextMenu.desk) return null;

  const isLocked = !!lockedSeats[`${contextMenu.desk.id}_seat_0`];
  const style = pos
    ? { left: pos.left, top: pos.top }
    : { left: contextMenu.x, top: contextMenu.y, visibility: 'hidden' };

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)}></div>
      <div
        ref={menuRef}
        className="fixed z-[9999] bg-base-200 border border-slate-700 shadow-2xl rounded-xl w-48 overflow-hidden flex flex-col"
        style={style}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 bg-base-100 border-b border-slate-700 text-xs font-bold text-slate-300 flex justify-between items-center">
          Bord-valg
          {isLocked && <i className="fa-solid fa-lock text-red-400"></i>}
        </div>

        <button
          className="px-4 py-2.5 text-left text-sm hover:bg-surface-field text-slate-200 flex items-center gap-2 transition-colors"
          onClick={() => {
            toggleLockDesk(contextMenu.desk.id);
            setContextMenu(null);
          }}
        >
          <i className={`fa-solid ${isLocked ? 'fa-unlock text-emerald-400' : 'fa-lock text-red-400'} w-4`}></i>
          {isLocked ? 'Lås opp bord' : 'Lås bord'}
        </button>

        <div className="border-t border-slate-700/50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-surface-raised">
          Sett makkergruppe:
        </div>
        <div className="grid grid-cols-4 gap-1 px-3 pb-3 pt-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(g => (
            <button
              key={g}
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-slate-900 shadow transition-transform hover:scale-110"
              style={{ backgroundColor: GROUP_COLORS[(g - 1) % GROUP_COLORS.length] }}
              onClick={() => handleSetGroupContextMenu(g)}
            >
              {g}
            </button>
          ))}
          <button
            className="col-span-4 mt-2 h-7 rounded-lg border border-slate-700 text-xs text-slate-400 hover:bg-slate-800 transition-colors"
            onClick={() => handleSetGroupContextMenu(null)}
          >
            Fjern gruppe
          </button>
        </div>
      </div>
    </>
  );
}
