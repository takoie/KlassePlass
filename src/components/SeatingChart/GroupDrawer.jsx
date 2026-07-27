import React from 'react';

/** Skuff for å velge/fjerne makkergruppe-farge før man klikker på bord. */
export default function GroupDrawer({ showGroupDrawer, setShowGroupDrawer, activeGroupId, setActiveGroupId, GROUP_COLORS }) {
  return (
    <div className={`bg-[#171a25] border-slate-800 flex flex-col z-[49] transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 ${showGroupDrawer ? 'w-64 border-r' : 'w-0 border-r-0'}`}>
      <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-[#1a1e2b] whitespace-nowrap min-w-[16rem]">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <i className="fa-solid fa-object-group text-fuchsia-400"></i> Makkergrupper
        </h3>
        <button className="btn btn-ghost btn-xs btn-square hover:bg-slate-800 text-slate-400" onClick={() => { setShowGroupDrawer(false); setActiveGroupId(null); }}>
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-[#171a25] min-w-[16rem]">
        <p className="text-xs text-slate-400 leading-tight">
          Velg en farge, klikk deretter på bordene i klassekartet for å koble dem sammen.
        </p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(g => (
            <button
              key={g}
              className={`h-12 rounded-xl flex items-center justify-center font-black text-slate-900 shadow-md transition-all ${activeGroupId === g ? 'ring-4 ring-white scale-105' : 'hover:scale-105 opacity-80'}`}
              style={{ backgroundColor: GROUP_COLORS[(g - 1) % GROUP_COLORS.length] }}
              onClick={() => setActiveGroupId(prev => prev === g ? null : g)}
            >
              GRUPPE {g}
            </button>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col gap-2">
          <button
            className={`w-full h-10 rounded-xl flex items-center justify-center font-bold text-slate-300 border-2 border-slate-700 border-dashed transition-all ${activeGroupId === 0 ? 'bg-red-500/20 border-red-500 text-red-400' : 'hover:bg-slate-800'}`}
            onClick={() => setActiveGroupId(0)}
          >
            <i className="fa-solid fa-eraser mr-2"></i> Fjern gruppe
          </button>
          {activeGroupId !== null && (
            <button
              className="btn btn-xs btn-ghost text-slate-400 hover:text-white"
              onClick={() => setActiveGroupId(null)}
            >
              <i className="fa-solid fa-check mr-1"></i> Avslutt makkergruppe-modus
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
