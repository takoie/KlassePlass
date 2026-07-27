import React from 'react';

/** Venstre verktøypanel: handling/visning/administrasjon-knapper. */
export default function Toolbar({
  unplacedStudents,
  showStudentDrawer, setShowStudentDrawer,
  showGroupDrawer, setShowGroupDrawer, setActiveGroupId,
  showFunDrawer, setShowFunDrawer,
  hideGroups, setHideGroups,
  handleRuleBasedFunSpin, flipRoom, handlePrint,
  showHistory, setShowHistory,
  showNumbers, setShowNumbers,
  showZones, setShowZones,
  hideSensitiveInfo, setHideSensitiveInfo,
  setIsProjectorMode,
}) {
  return (
    <div className="w-64 bg-[#1a1e2b] flex flex-col z-10 flex-shrink-0 border-r border-slate-800 shadow-xl relative overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-[#1a1e2b]">
        <h3 className="font-extrabold text-sm text-emerald-400 flex items-center gap-2 uppercase tracking-widest">
          <i className="fa-solid fa-toolbox"></i> Verktøy
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-3">
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Handling</div>
          <button className="btn btn-sm btn-primary justify-start border-none bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" onClick={() => { setShowStudentDrawer(!showStudentDrawer); setShowGroupDrawer(false); setShowFunDrawer(false); }}>
            <i className="fa-solid fa-users w-5"></i> Elever {unplacedStudents.length > 0 && <span className="badge badge-xs badge-error ml-auto">{unplacedStudents.length}</span>}
          </button>
          <button className={`btn btn-sm justify-start ${showGroupDrawer ? 'btn-neutral bg-fuchsia-900/30 text-fuchsia-400 border-fuchsia-500/50' : 'btn-outline border-slate-700 text-slate-300 hover:bg-slate-800'}`} onClick={() => { setShowGroupDrawer(!showGroupDrawer); if(showGroupDrawer) setActiveGroupId(null); setShowStudentDrawer(false); setShowFunDrawer(false); }}>
            <i className="fa-solid fa-object-group w-5 text-fuchsia-400"></i> Makkergrupper
          </button>
          <button className={`btn btn-sm justify-start ${hideGroups ? 'btn-neutral bg-amber-900/30 text-amber-400 border-amber-500/50' : 'btn-outline border-slate-700 text-slate-300 hover:bg-slate-800'}`} onClick={() => setHideGroups(!hideGroups)}>
            <i className={`fa-solid ${hideGroups ? 'fa-eye-slash' : 'fa-eye'} w-5 ${hideGroups ? 'text-amber-400' : 'text-slate-400'}`}></i> {hideGroups ? 'Vis Makkergrupper' : 'Skjul Makkergrupper'}
          </button>
          <button className={`btn btn-sm justify-start ${showFunDrawer ? 'btn-neutral bg-pink-900/30 text-pink-400 border-pink-500/50' : 'btn-outline border-slate-700 text-slate-300 hover:bg-slate-800'}`} onClick={() => { setShowFunDrawer(!showFunDrawer); setShowStudentDrawer(false); setShowGroupDrawer(false); }}>
            <i className="fa-solid fa-wand-magic-sparkles w-5 text-pink-400"></i> Fun Mode
          </button>
          <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 justify-start hover:bg-slate-800" onClick={handleRuleBasedFunSpin}>
            <i className="fa-solid fa-shuffle w-5 text-amber-400"></i> Randomiser (Med Regler)
          </button>
          <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 justify-start hover:bg-slate-800" onClick={flipRoom}>
            <i className="fa-solid fa-rotate w-5 text-cyan-400"></i> Snu klasserommet
          </button>
          <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 justify-start hover:bg-slate-800" onClick={handlePrint}>
            <i className="fa-solid fa-print w-5 text-indigo-400"></i> Skriv ut / PDF
          </button>
          <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 justify-start hover:bg-slate-800" onClick={() => document.getElementById('modal_sync_room').showModal()} title="Hent siste bordoppsett fra rom-editoren">
            <i className="fa-solid fa-arrows-rotate w-5 text-orange-400"></i> Hent fra rom
          </button>
        </div>

        <div className="h-px bg-slate-800/50 w-full my-1"></div>

        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Visning</div>
          <button className={`btn btn-sm ${showHistory ? 'btn-neutral bg-slate-700 text-amber-400' : 'btn-outline border-slate-700 text-slate-400'} justify-start`} onClick={() => setShowHistory(!showHistory)}>
            <i className="fa-solid fa-clock-rotate-left w-5"></i> {showHistory ? 'Skjul historikk' : 'Vis historikk'}
          </button>
          <button className={`btn btn-sm ${showNumbers ? 'btn-neutral bg-slate-700 text-emerald-400' : 'btn-outline border-slate-700 text-slate-400'} justify-start`} onClick={() => setShowNumbers(!showNumbers)}>
            <i className="fa-solid fa-hashtag w-5"></i> {showNumbers ? 'Skjul numre' : 'Vis numre'}
          </button>
          <button className={`btn btn-sm ${showZones ? 'btn-neutral bg-slate-700 text-cyan-400' : 'btn-outline border-slate-700 text-slate-400'} justify-start`} onClick={() => setShowZones(!showZones)}>
            <i className="fa-solid fa-map w-5"></i> {showZones ? 'Skjul soner' : 'Vis soner'}
          </button>
          <button className={`btn btn-sm ${hideSensitiveInfo ? 'btn-neutral bg-slate-700 text-purple-400' : 'btn-outline border-slate-700 text-slate-400'} justify-start`} onClick={() => setHideSensitiveInfo(!hideSensitiveInfo)}>
            <i className="fa-solid fa-eye-slash w-5"></i> {hideSensitiveInfo ? 'Vis info' : 'Skjul info'}
          </button>
          <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 justify-start hover:bg-slate-800" onClick={() => setIsProjectorMode(true)}>
            <i className="fa-solid fa-expand w-5 text-fuchsia-400"></i> Prosjektor
          </button>
        </div>

        <div className="h-px bg-slate-800/50 w-full my-1"></div>

        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Administrasjon</div>
          <button className="btn btn-sm btn-outline border-red-500/20 text-red-400 justify-start hover:bg-red-500/10" onClick={() => document.getElementById('modal_delete_seating').showModal()}>
            <i className="fa-solid fa-trash w-5"></i> Slett klassekart
          </button>
        </div>
      </div>
    </div>
  );
}
