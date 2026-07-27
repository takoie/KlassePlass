import React from 'react';

/** Høyreklikk-meny på et bord: lås/lås opp, sett/fjern makkergruppe. */
export default function DeskContextMenu({ contextMenu, lockedSeats, toggleLockDesk, setContextMenu, handleSetGroupContextMenu, GROUP_COLORS }) {
  if (!contextMenu || !contextMenu.desk) return null;

  const isLocked = !!lockedSeats[`${contextMenu.desk.id}_seat_0`];

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)}></div>
      <div
        className="fixed z-[9999] bg-[#1a1e2b] border border-slate-700 shadow-2xl rounded-xl w-48 overflow-hidden flex flex-col"
        style={{ left: contextMenu.x, top: contextMenu.y }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 bg-[#202534] border-b border-slate-700 text-xs font-bold text-slate-300 flex justify-between items-center">
          Bord-valg
          {isLocked && <i className="fa-solid fa-lock text-red-400"></i>}
        </div>

        <button
          className="px-4 py-2.5 text-left text-sm hover:bg-[#262b3a] text-slate-200 flex items-center gap-2 transition-colors"
          onClick={() => {
            toggleLockDesk(contextMenu.desk.id);
            setContextMenu(null);
          }}
        >
          <i className={`fa-solid ${isLocked ? 'fa-unlock text-emerald-400' : 'fa-lock text-red-400'} w-4`}></i>
          {isLocked ? 'Lås opp bord' : 'Lås bord'}
        </button>

        <div className="border-t border-slate-700/50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-[#171a25]">
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
