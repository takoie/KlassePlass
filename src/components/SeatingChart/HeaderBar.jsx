import React from 'react';

/** Toppbar: klasse/rom/periode-valg, kartnavn, lagre-status og slett-knapp. */
export default function HeaderBar({
  onBack,
  classes, selectedClass, setSelectedClass,
  rooms, selectedRoom, setSelectedRoom,
  seatings, selectedSeatingId, handleSelectSeating, setEditingPeriod, handleStartNewPeriod,
  chartName, setChartName, chartComment, setChartComment,
  saveState, handleDelete,
}) {
  return (
    <div className="px-4 py-2 bg-[#1a1e2b] border-b border-slate-800 flex flex-wrap justify-between items-center gap-x-4 gap-y-2 z-20 flex-shrink-0 shadow-md">
      <div className="flex items-center gap-2 flex-wrap">
        {onBack && (
          <button className="btn btn-ghost btn-xs text-slate-400 hover:text-white gap-1" onClick={onBack}>
            <i className="fa-solid fa-arrow-left"></i> Tilbake
          </button>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold uppercase opacity-50 text-slate-400">Klasse:</span>
          <select
            className="select select-bordered select-xs bg-[#262b3a] border-slate-700 text-white font-bold max-w-28"
            value={selectedClass}
            onChange={(e) => setSelectedClass(Number(e.target.value))}
          >
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold uppercase opacity-50 text-slate-400">Rom:</span>
          <select
            className="select select-bordered select-xs bg-[#262b3a] border-slate-700 text-white font-bold max-w-28"
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(Number(e.target.value))}
          >
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-bold uppercase opacity-50 text-slate-400">Periode:</span>
        <select
          className="select select-bordered select-xs bg-[#262b3a] border-slate-700 text-white font-bold max-w-32"
          value={selectedSeatingId}
          onChange={(e) => handleSelectSeating(e.target.value)}
        >
          {seatings
            .filter(s => s.class_id === Number(selectedClass))
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
            .map(s => <option key={s.id} value={s.id}>{s.comment && !s.name.includes(s.comment) ? `${s.name} (${s.comment})` : s.name}</option>)}
        </select>
        <button
          className="btn btn-ghost btn-xs text-slate-400 hover:text-white"
          title="Rediger periodenavn"
          onClick={() => {
            const existing = seatings.find(s => s.id === Number(selectedSeatingId));
            if (existing) setEditingPeriod({ id: existing.id, name: existing.name, comment: existing.comment || '' });
            document.getElementById('modal_edit_period')?.showModal();
          }}
        >
          <i className="fa-solid fa-pen"></i>
        </button>
        <button
          className="btn btn-outline btn-xs border-slate-700 text-slate-300 hover:bg-slate-800"
          title="Start ny periode (beholder dette kartet som historikk)"
          onClick={handleStartNewPeriod}
        >
          <i className="fa-solid fa-plus"></i> Ny periode
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={chartName}
          onChange={(e) => setChartName(e.target.value)}
          className="input input-ghost text-sm font-bold bg-[#262b3a] border border-slate-700 focus:border-[#34d399] px-3 h-8 rounded text-white w-36"
          placeholder="Navn på klassekart..."
        />
        <input
          type="text"
          value={chartComment}
          onChange={(e) => setChartComment(e.target.value)}
          className="input input-ghost text-xs font-bold text-amber-300 bg-[#262b3a] border border-slate-700 px-3 h-8 w-24 text-center rounded"
          placeholder="f.eks Uke 1-4..."
        />
      </div>

      <div className="flex items-center gap-2">
        {saveState === 'saving' ? (
          <span className="text-amber-400 opacity-80 text-xs font-semibold flex items-center gap-1 whitespace-nowrap">
            <i className="fa-solid fa-spinner fa-spin"></i> Lagrer...
          </span>
        ) : (
          <span className="text-[#34d399] text-xs font-semibold flex items-center gap-1 whitespace-nowrap">
            <i className="fa-solid fa-circle-check text-[#34d399]"></i> Lagret
          </span>
        )}
        <button
          className="btn btn-ghost text-red-400 hover:bg-red-950/40 btn-xs whitespace-nowrap"
          onClick={handleDelete}
        >
          <i className="fa-solid fa-trash"></i> Slett kart
        </button>
      </div>
    </div>
  );
}
