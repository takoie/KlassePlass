import React from 'react';

/** Alle bekreftelses-/redigeringsdialoger for klassekart-editoren, samlet ett sted. */
export default function Modals({
  editingNoteStudent, noteInputValue, setNoteInputValue, saveStudentNote,
  chartName, handleDelete,
  editingPeriod, setEditingPeriod, handleSaveEditedPeriod,
  newPeriodWeeks, setNewPeriodWeeks, handleStartNewPeriod,
  syncFromRoom,
}) {
  return (
    <>
      <dialog id="modal_student_note" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box bg-[#171a25] border border-slate-700 text-slate-100 rounded-2xl">
          <h3 className="font-bold text-lg text-amber-300 flex items-center gap-2">
            📝 Notat for {editingNoteStudent?.name}
          </h3>
          <p className="py-2 text-xs text-slate-400">Skriv inn notat eller spesiell tilrettelegging for denne eleven:</p>

          <textarea
            className="textarea textarea-bordered w-full h-24 bg-[#262b3a] border-slate-700 text-white mt-2 font-medium focus:border-amber-400"
            placeholder="Skriv notat her..."
            value={noteInputValue}
            onChange={(e) => setNoteInputValue(e.target.value)}
          />

          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost text-slate-400 mr-2">Avbryt</button>
              <button className="btn btn-warning" onClick={saveStudentNote}>Lagre notat</button>
            </form>
          </div>
        </div>
      </dialog>

      <dialog id="modal_delete_seating" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box bg-[#171a25] border border-slate-700 text-slate-100 rounded-2xl">
          <h3 className="font-bold text-red-400 text-lg flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation"></i> Slett klassekart?
          </h3>
          <p className="py-4 text-sm text-slate-300">Er du helt sikker på at du vil slette <strong>{chartName}</strong>?</p>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost text-slate-400 mr-2 hover:bg-slate-800">Avbryt</button>
              <button className="btn btn-error" onClick={handleDelete}>Ja, slett</button>
            </form>
          </div>
        </div>
      </dialog>

      <dialog id="modal_edit_period" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box bg-[#171a25] border border-slate-700 text-slate-100 rounded-2xl">
          <h3 className="font-bold text-slate-100 text-lg flex items-center gap-2">
            <i className="fa-solid fa-pen text-slate-400"></i> Rediger ukeangivelse
          </h3>
          <div className="py-4">
            <label className="text-xs font-bold uppercase opacity-50 text-slate-400 mb-1 block">Periode (f.eks Uke 1-4)</label>
            <input
              type="text"
              className="input input-bordered w-full bg-[#262b3a] border-slate-700 text-white"
              value={editingPeriod?.comment ?? ''}
              onChange={(e) => setEditingPeriod(p => ({ ...p, comment: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost text-slate-400 mr-2 hover:bg-slate-800">Avbryt</button>
            </form>
            <button className="btn btn-primary" onClick={handleSaveEditedPeriod}>Lagre</button>
          </div>
        </div>
      </dialog>

      <dialog id="modal_new_period" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box bg-[#171a25] border border-slate-700 text-slate-100 rounded-2xl">
          <h3 className="font-bold text-slate-100 text-lg flex items-center gap-2">
            <i className="fa-solid fa-plus text-emerald-400"></i> Ny periode
          </h3>
          <p className="py-2 text-sm text-slate-300">
            Lagrer det nåværende oppsettet som historikk og starter en ny periode. Hvor mange uker skal den nye perioden vare?
          </p>
          <div className="py-2 flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="52"
              className="input input-bordered w-24 bg-[#262b3a] border-slate-700 text-white text-center"
              value={newPeriodWeeks}
              onChange={(e) => setNewPeriodWeeks(e.target.value)}
              autoFocus
            />
            <span className="text-sm text-slate-400">uker</span>
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost text-slate-400 mr-2 hover:bg-slate-800">Avbryt</button>
            </form>
            <button className="btn btn-primary" onClick={() => handleStartNewPeriod(newPeriodWeeks)}>Opprett periode</button>
          </div>
        </div>
      </dialog>

      <dialog id="modal_sync_room" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box bg-[#171a25] border border-slate-700 text-slate-100 rounded-2xl">
          <h3 className="font-bold text-orange-400 text-lg flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation"></i> Hent bordoppsett fra rommet?
          </h3>
          <p className="py-4 text-sm text-slate-300">
            Dette klassekartet bruker en lagret kopi av bordoppsettet fra da det sist ble lagret.
            Å hente fra rommet nå erstatter den kopien med rommets nåværende oppsett.
            Elever plassert ved bord som ikke lenger finnes i rommet blir uplasserte.
          </p>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost text-slate-400 mr-2 hover:bg-slate-800">Avbryt</button>
            </form>
            <button className="btn btn-warning" onClick={syncFromRoom}>Ja, hent fra rom</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
