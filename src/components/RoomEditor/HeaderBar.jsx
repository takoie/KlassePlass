import React from 'react';

/** Toppbar: rom-valg, nytt rom-knapp, lagre-status og slett-knapp. */
export default function HeaderBar({ onBack, rooms, selectedRoom, handleSelectRoom, handleOpenNewModal, saveState }) {
  return (
    <div className="px-4 py-2 bg-[#1a1e2b] border-b border-slate-800 flex flex-wrap justify-between items-center gap-x-4 gap-y-2 z-20 flex-shrink-0">
      <div className="flex items-center gap-2 flex-wrap">
        {onBack && (
          <button className="btn btn-ghost btn-xs text-slate-400 hover:text-white gap-1" onClick={onBack}>
            <i className="fa-solid fa-arrow-left"></i> Tilbake
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase opacity-50 text-slate-400">Rom:</span>
          <select
            className="select select-bordered select-xs bg-[#262b3a] border-slate-700 text-white font-bold min-w-40"
            value={selectedRoom?.id || ''}
            onChange={(e) => {
              const found = rooms.find(r => r.id === Number(e.target.value));
              if (found) handleSelectRoom(found);
            }}
          >
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary btn-xs gap-1 font-bold" onClick={handleOpenNewModal}>
          <i className="fa-solid fa-plus"></i> Nytt rom
        </button>
      </div>

      {selectedRoom && (
        <div className="flex items-center gap-2">
          <div className="w-20 min-w-20 flex items-center justify-end">
            {saveState === 'saving' ? (
              <span className="text-amber-400 opacity-80 text-xs font-semibold flex items-center gap-1">
                <i className="fa-solid fa-spinner fa-spin"></i> Lagrer...
              </span>
            ) : (
              <span className="text-[#34d399] text-xs font-semibold flex items-center gap-1">
                <i className="fa-solid fa-circle-check text-[#34d399]"></i> Lagret
              </span>
            )}
          </div>

          <button
            className="btn btn-ghost text-red-400 hover:bg-red-950/40 btn-xs"
            onClick={() => document.getElementById(`modal_delete_room_${selectedRoom.id}`).showModal()}
          >
            <i className="fa-solid fa-trash"></i> Slett rom
          </button>
        </div>
      )}
    </div>
  );
}
