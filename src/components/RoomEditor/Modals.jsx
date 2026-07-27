import React from 'react';

/** Modal for å opprette nytt rom (med preset-valg) og modal for å slette gjeldende rom. */
export default function Modals({
  inputModalRef, newRoomModalName, setNewRoomModalName, handleConfirmCreateNew,
  presetsList, selectedPreset, setSelectedPreset,
  selectedRoom, handleDelete,
}) {
  return (
    <>
      <dialog id="modal_create_new_room" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box bg-[#171a25] border border-slate-700 text-slate-100 rounded-2xl max-w-lg">
          <h3 className="font-bold text-lg flex items-center gap-2 text-white">
            <i className="fa-solid fa-wand-magic-sparkles text-[#f59e0b]"></i> Opprett nytt klasserom
          </h3>
          <p className="py-2 text-xs text-slate-400">Gi rommet et navn og velg et ferdig oppsett:</p>

          <input
            ref={inputModalRef}
            type="text"
            value={newRoomModalName}
            onChange={(e) => setNewRoomModalName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmCreateNew(); }}
            placeholder="f.eks. Rom 204..."
            className="input input-bordered w-full mb-4 bg-[#262b3a] border-slate-700 text-white"
            autoFocus
          />

          <label className="text-xs font-bold uppercase opacity-50 text-slate-400 block mb-2">Velg oppsett (Preset)</label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {presetsList.map(p => (
              <div
                key={p.id}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-1 ${selectedPreset === p.id ? 'border-[#34d399] bg-[#34d399]/10 shadow' : 'border-slate-800 bg-[#262b3a] hover:bg-slate-800'}`}
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedPreset(p.id);
                  inputModalRef.current?.focus();
                }}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-white">{p.title}</span>
                  <span className="text-xs font-mono opacity-50">{p.icon}</span>
                </div>
                <span className="text-[11px] opacity-60 text-slate-400">{p.subtitle}</span>
              </div>
            ))}
          </div>

          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost text-slate-400 mr-2">Avbryt</button>
              <button className="btn btn-primary" onClick={handleConfirmCreateNew} disabled={!newRoomModalName.trim()}>Opprett rom</button>
            </form>
          </div>
        </div>
      </dialog>

      {selectedRoom && (
        <dialog id={`modal_delete_room_${selectedRoom.id}`} className="modal modal-bottom sm:modal-middle">
          <div className="modal-box bg-[#171a25] border border-slate-700 text-slate-100 rounded-2xl">
            <h3 className="font-bold text-lg text-red-400">Slett rom?</h3>
            <p className="py-4 text-sm text-slate-300">Er du helt sikker på at du vil slette <strong>{selectedRoom.name}</strong>?</p>
            <div className="modal-action">
              <form method="dialog">
                <button className="btn btn-ghost text-slate-400 mr-2">Avbryt</button>
                <button className="btn btn-error" onClick={() => handleDelete(selectedRoom.id)}>Ja, slett</button>
              </form>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
