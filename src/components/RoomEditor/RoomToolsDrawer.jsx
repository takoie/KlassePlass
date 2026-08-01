import React from 'react';

export default function RoomToolsDrawer({
  setShowToolsDrawer,
  selectedDesksCount,
  createGroupForSelected,
  clearGroupForSelected,
  setDeskCapacity,
  toggleZoneOnSelected,
  genStructure,
  setGenStructure,
  genRows,
  setGenRows,
  generateStructure,
  addDesk,
  clearDesks,
  showNumbers,
  setShowNumbers,
  showZones,
  setShowZones,
  centerDesks,
  flipRoom
}) {
  return (
    <div className="flex flex-col gap-3 w-64 text-white p-4 h-full overflow-y-auto overflow-x-hidden">
      <div className="flex justify-between items-center pb-2 border-b border-slate-700 mb-2">
        <span className="text-sm font-extrabold uppercase tracking-wider text-emerald-400">
          <i className="fa-solid fa-toolbox"></i> Verktøy
        </span>
        <button className="btn btn-ghost btn-xs btn-square hover:bg-slate-800 text-slate-400" onClick={() => setShowToolsDrawer(false)}>
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      {/* Visning & Kontroll (Collapse) */}
      <details className="collapse collapse-arrow bg-surface-field border border-slate-700 shadow-inner rounded-xl overflow-visible" open>
        <summary className="collapse-title text-xs font-bold text-slate-200 min-h-0 py-3">
          <i className="fa-solid fa-eye text-[#34d399] mr-1.5"></i> Visning & kontroll
        </summary>
        <div className="collapse-content flex flex-col gap-2 pb-3">
          <button 
            className={`btn btn-xs w-full justify-start ${showZones ? 'btn-neutral bg-slate-800 text-amber-300' : 'btn-outline border-slate-600 text-slate-400'} gap-2`}
            onClick={() => setShowZones(!showZones)}
          >
            <i className={`fa-solid w-4 text-center ${showZones ? 'fa-eye' : 'fa-eye-slash'}`}></i>
            {showZones ? 'Viser soner' : 'Skjuler soner'}
          </button>

          <button 
            className={`btn btn-xs w-full justify-start ${showNumbers ? 'btn-neutral bg-slate-800 text-emerald-300' : 'btn-outline border-slate-600 text-slate-400'} gap-2`}
            onClick={() => setShowNumbers(!showNumbers)}
          >
            <i className="fa-solid w-4 text-center fa-hashtag text-[#34d399]"></i>
            {showNumbers ? 'Viser nr.' : 'Skjuler nr.'}
          </button>

          <button className="btn btn-xs w-full justify-start btn-outline border-slate-600 text-slate-300 hover:bg-slate-800 gap-2" onClick={centerDesks}>
            <i className="fa-solid w-4 text-center fa-arrows-to-dot"></i> Sentrer bord
          </button>

          <button className="btn btn-xs w-full justify-start btn-outline border-slate-600 text-slate-300 hover:bg-slate-800 gap-2" onClick={flipRoom}>
            <i className="fa-solid w-4 text-center fa-rotate-left"></i> Flipp 1:1 (180°)
          </button>
        </div>
      </details>

      {/* Oppsett & Generering (Collapse) */}
      <details className="collapse collapse-arrow bg-surface-field border border-slate-700 shadow-inner rounded-xl overflow-visible" open>
        <summary className="collapse-title text-xs font-bold text-slate-200 min-h-0 py-3">
          <i className="fa-solid fa-table-cells text-cyan-400 mr-1.5"></i> Autogenerering
        </summary>
        <div className="collapse-content flex flex-col gap-3 pb-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-extrabold uppercase text-slate-300 px-1">Mønster</label>
              <select className="select select-xs select-bordered bg-base-200 border-slate-600 text-white font-bold" value={genStructure} onChange={e => setGenStructure(e.target.value)}>
                <option value="2-2">2 - 2</option>
                <option value="2-2-2">2 - 2 - 2</option>
                <option value="2-3-2">2 - 3 - 2</option>
                <option value="3-3-3">3 - 3 - 3</option>
                <option value="4-2-4">4 - 2 - 4</option>
                <option value="4-4">4 - 4</option>
                <option value="1-1-1-1-1">Eksamen (1 og 1)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-extrabold uppercase text-slate-300 px-1">Rader</label>
              <input type="number" className="input input-xs input-bordered bg-base-200 border-slate-600 text-white font-bold text-center" value={genRows} onChange={e => setGenRows(Number(e.target.value))} min="1" max="10" />
            </div>
          </div>
          <button className="btn btn-xs btn-primary font-extrabold w-full" onClick={generateStructure}>Generer bord-struktur</button>
        </div>
      </details>

      {/* Legg til Bord (Collapse) */}
      <details className="collapse collapse-arrow bg-surface-field border border-slate-700 shadow-inner rounded-xl overflow-visible" open>
        <summary className="collapse-title text-xs font-bold text-slate-200 min-h-0 py-3">
          <i className="fa-solid fa-chair text-amber-400 mr-1.5"></i> Legg til bord
        </summary>
        <div className="collapse-content flex flex-col gap-2 pb-3">
          <span className="text-[10px] font-bold uppercase text-slate-400 px-1">Antall plasser</span>
          <div className="grid grid-cols-4 gap-1">
            <button className="btn btn-xs bg-indigo-600 hover:bg-indigo-700 text-white border-none font-extrabold" onClick={() => addDesk(1)}>1</button>
            <button className="btn btn-xs bg-indigo-600 hover:bg-indigo-700 text-white border-none font-extrabold" onClick={() => addDesk(2)}>2</button>
            <button className="btn btn-xs bg-indigo-600 hover:bg-indigo-700 text-white border-none font-extrabold" onClick={() => addDesk(3)}>3</button>
            <button className="btn btn-xs bg-indigo-600 hover:bg-indigo-700 text-white border-none font-extrabold" onClick={() => addDesk(4)}>4</button>
          </div>
        </div>
      </details>

      {/* Valgte Bord (Collapse) - Kun åpen hvis bord er valgt */}
      <details className="collapse collapse-arrow bg-surface-field border border-slate-700 shadow-inner rounded-xl overflow-visible" open={selectedDesksCount > 0}>
        <summary className="collapse-title text-xs font-bold text-slate-200 min-h-0 py-3">
          <i className="fa-solid fa-pen-to-square text-fuchsia-400 mr-1.5"></i> Rediger valgte ({selectedDesksCount})
        </summary>
        <div className="collapse-content flex flex-col gap-3 pb-3">
          
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400">Antall plasser per bord</span>
            <div className="grid grid-cols-4 gap-1">
              <button className="btn btn-xs btn-outline border-slate-600 text-[#34d399] font-extrabold hover:bg-emerald-950/60" onClick={() => setDeskCapacity(1)} disabled={selectedDesksCount === 0}>1</button>
              <button className="btn btn-xs btn-outline border-slate-600 text-cyan-300 font-extrabold hover:bg-cyan-950/60" onClick={() => setDeskCapacity(2)} disabled={selectedDesksCount === 0}>2</button>
              <button className="btn btn-xs btn-outline border-slate-600 text-indigo-300 font-extrabold hover:bg-indigo-950/60" onClick={() => setDeskCapacity(3)} disabled={selectedDesksCount === 0}>3</button>
              <button className="btn btn-xs btn-outline border-slate-600 text-purple-300 font-extrabold hover:bg-purple-950/60" onClick={() => setDeskCapacity(4)} disabled={selectedDesksCount === 0}>4</button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mt-2">
            <span className="text-[10px] font-bold uppercase text-slate-400">Sone-tildeling</span>
            <div className="flex flex-col gap-1.5">
              <button className="btn btn-xs btn-outline border-slate-600 text-yellow-300 font-semibold hover:bg-slate-800 gap-2 justify-start" onClick={() => toggleZoneOnSelected('window')} disabled={selectedDesksCount === 0}>
                <i className="fa-solid w-4 text-center fa-sun"></i> Vindurekke
              </button>
              <button className="btn btn-xs btn-outline border-slate-600 text-amber-300 font-semibold hover:bg-slate-800 gap-2 justify-start" onClick={() => toggleZoneOnSelected('door')} disabled={selectedDesksCount === 0}>
                <i className="fa-solid w-4 text-center fa-door-open"></i> Dørsone
              </button>
              <button className="btn btn-xs btn-outline border-slate-600 text-emerald-300 font-semibold hover:bg-slate-800 gap-2 justify-start" onClick={() => toggleZoneOnSelected('front')} disabled={selectedDesksCount === 0}>
                <i className="fa-solid w-4 text-center fa-location-dot"></i> Fremste rad
              </button>
              <button className="btn btn-xs btn-outline border-slate-600 text-purple-300 font-semibold hover:bg-slate-800 gap-2 justify-start" onClick={() => toggleZoneOnSelected('back')} disabled={selectedDesksCount === 0}>
                <i className="fa-solid w-4 text-center fa-arrow-down"></i> Bakerste rad
              </button>
              <button className="btn btn-xs btn-outline border-slate-600 text-cyan-300 font-semibold hover:bg-slate-800 gap-2 justify-start" onClick={() => toggleZoneOnSelected('center')} disabled={selectedDesksCount === 0}>
                <i className="fa-solid w-4 text-center fa-align-center"></i> Midtsone
              </button>
            </div>
          </div>

        </div>
      </details>

      <div className="mt-auto pt-4 flex flex-col gap-2 w-full">
        <button className="btn btn-xs btn-error hover:bg-red-700/80 font-bold opacity-80" onClick={clearDesks}>Tøm hele rommet</button>
      </div>

    </div>
  );
}
