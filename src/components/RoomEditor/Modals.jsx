import React from 'react';

/** Modal for å opprette nytt rom (med preset-valg) og modal for å slette gjeldende rom. */
export default function Modals({
  inputModalRef, newRoomModalName, setNewRoomModalName, handleConfirmCreateNew,
  presetsList, selectedPreset, setSelectedPreset,
  selectedRoom, handleDelete, setIsCreatingRoom,
  renameValue, setRenameValue, handleRenameRoom,
}) {
  const saveRename = () => {
    if (!renameValue.trim()) return;
    handleRenameRoom(renameValue);
    document.getElementById('modal_rename_room')?.close();
  };

  return (
    <>
      <dialog id="modal_rename_room" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box bg-surface-raised border border-base-300 text-base-content rounded-2xl">
          <h3 className="font-bold text-lg text-base-content flex items-center gap-2">
            <i className="fa-solid fa-pen text-base-content/60"></i> Endre romnavn
          </h3>
          <div className="py-4">
            <label className="text-xs font-bold uppercase opacity-50 text-base-content/60 mb-1 block">Navn</label>
            <input
              type="text"
              className="input input-bordered w-full bg-surface-field border-base-300 text-base-content"
              value={renameValue ?? ''}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveRename(); } }}
              autoFocus
            />
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost text-base-content/60 mr-2">Avbryt</button>
            </form>
            <button className="btn btn-primary" onClick={saveRename} disabled={!renameValue?.trim()}>Lagre</button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      <dialog id="modal_create_new_room" className="modal modal-bottom sm:modal-middle" onClose={() => setIsCreatingRoom(false)}>
        <div className="modal-box bg-surface-raised border border-base-300 text-base-content rounded-2xl max-w-lg">
          <h3 className="font-bold text-lg flex items-center gap-2 text-base-content">
            <i className="fa-solid fa-wand-magic-sparkles text-[#f59e0b]"></i> Opprett nytt klasserom
          </h3>
          <p className="py-2 text-xs text-base-content/60">Gi rommet et navn og velg et ferdig oppsett:</p>

          <input
            ref={inputModalRef}
            type="text"
            value={newRoomModalName}
            onChange={(e) => setNewRoomModalName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmCreateNew(); }}
            placeholder="f.eks. Rom 204..."
            className="input input-bordered w-full mb-4 bg-surface-field border-base-300 text-base-content"
            autoFocus
          />

          <label className="text-xs font-bold uppercase opacity-50 text-base-content/60 block mb-2">Velg oppsett (preset)</label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {presetsList.map(p => (
              <div
                key={p.id}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-1 ${selectedPreset === p.id ? 'border-[#34d399] bg-[#34d399]/10 shadow' : 'border-base-300 bg-surface-field hover:bg-base-200'}`}
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedPreset(p.id);
                  inputModalRef.current?.focus();
                }}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-base-content">{p.title}</span>
                  <span className="text-xs font-mono opacity-50">{p.icon}</span>
                </div>
                <span className="text-[11px] opacity-60 text-base-content/60">{p.subtitle}</span>
              </div>
            ))}
          </div>

          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost text-base-content/60 mr-2">Avbryt</button>
              <button className="btn btn-primary" onClick={handleConfirmCreateNew} disabled={!newRoomModalName.trim()}>Opprett rom</button>
            </form>
          </div>
        </div>
      </dialog>

      {selectedRoom && (
        <dialog id={`modal_delete_room_${selectedRoom.id}`} className="modal modal-bottom sm:modal-middle">
          <div className="modal-box bg-surface-raised border border-base-300 text-base-content rounded-2xl">
            <h3 className="font-bold text-lg text-red-400">Slett rom?</h3>
            <p className="py-4 text-sm text-base-content/80">Er du helt sikker på at du vil slette <strong>{selectedRoom.name}</strong>?</p>
            <div className="modal-action">
              <form method="dialog">
                <button className="btn btn-ghost text-base-content/60 mr-2">Avbryt</button>
                <button className="btn btn-error" onClick={() => handleDelete(selectedRoom.id)}>Ja, slett</button>
              </form>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
