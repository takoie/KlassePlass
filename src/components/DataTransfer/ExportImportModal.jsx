import React, { useState } from 'react';
import { showToast } from '../../shared/utils';

const BUNDLE_VERSION = 1;

/**
 * `<dialog>` for å eksportere klasse/rom/klassekart til én fil.
 *
 * `source` beskriver hva som er tilgjengelig å eksportere fra der modalen ble
 * åpnet:
 *   { class: { id, name } | null, room: { id, name } | null, seating: { id, name } | null }
 * Kun de seksjonene som er != null vises som avkrysningsbokser (forhåndshuket).
 */
export function ExportModal({ modalId, source, suggestedName }) {
  const [includeClass, setIncludeClass] = useState(true);
  const [includeRoom, setIncludeRoom] = useState(true);
  const [includeSeating, setIncludeSeating] = useState(true);
  const [busy, setBusy] = useState(false);

  const close = () => document.getElementById(modalId)?.close();

  const handleExport = async () => {
    setBusy(true);
    try {
      const bundle = { version: BUNDLE_VERSION };

      if (includeClass && source.class) {
        const cls = await window.api.getClass(source.class.id);
        const constraintsRaw = await window.api.getConstraints(source.class.id);
        bundle.class = {
          name: cls?.name || source.class.name,
          students: cls?.students ?? null,
          constraints: (constraintsRaw || []).map(c => ({
            studentA: c.student_a, studentB: c.student_b, type: c.type,
          })),
        };
      }

      if (includeRoom && source.room) {
        const room = await window.api.getRoom(source.room.id);
        bundle.room = { name: room?.name || source.room.name, layoutData: room?.layout_data ?? null };
      }

      if (includeSeating && source.seating) {
        const seating = await window.api.getSeating(source.seating.id);
        bundle.seating = {
          name: seating?.name || source.seating.name,
          comment: seating?.comment ?? null,
          placements: seating?.placements ?? null,
        };
      }

      const result = await window.api.exportBundle(bundle, suggestedName);
      if (result?.success) {
        showToast('Eksportert.', 'success');
        close();
      } else if (!result?.canceled) {
        showToast(result?.error || 'Kunne ikke eksportere.', 'error');
      }
    } catch (e) {
      showToast('Kunne ikke eksportere.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog id={modalId} className="modal modal-bottom sm:modal-middle">
      <div className="modal-box bg-surface-raised border border-slate-700 text-slate-100 rounded-2xl">
        <h3 className="font-bold text-lg flex items-center gap-2 text-white">
          <i className="fa-solid fa-file-export text-emerald-400"></i> Eksporter
        </h3>
        <div className="flex flex-col gap-2 py-4">
          {source.class && (
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-200">
              <input type="checkbox" className="checkbox checkbox-sm" checked={includeClass} onChange={e => setIncludeClass(e.target.checked)} />
              Klasse: <span className="font-semibold">{source.class.name}</span>
            </label>
          )}
          {source.room && (
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-200">
              <input type="checkbox" className="checkbox checkbox-sm" checked={includeRoom} onChange={e => setIncludeRoom(e.target.checked)} />
              Rom: <span className="font-semibold">{source.room.name}</span>
            </label>
          )}
          {source.seating && (
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-200">
              <input type="checkbox" className="checkbox checkbox-sm" checked={includeSeating} onChange={e => setIncludeSeating(e.target.checked)} />
              Klassekart: <span className="font-semibold">{source.seating.name}</span>
            </label>
          )}
        </div>
        <div className="modal-action">
          <form method="dialog">
            <button className="btn btn-ghost text-slate-400 mr-2">Avbryt</button>
          </form>
          <button
            className="btn btn-primary gap-2"
            onClick={handleExport}
            disabled={busy || !((includeClass && source.class) || (includeRoom && source.room) || (includeSeating && source.seating))}
          >
            {busy ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-file-export"></i>}
            Eksporter
          </button>
        </div>
      </div>
    </dialog>
  );
}

/**
 * `<dialog>` for å importere en tidligere eksportert fil. `onImported(kind, id)`
 * kalles med den "viktigste" opprettede posten (seating > class > room) slik
 * at parent kan navigere dit/oppdatere listen.
 */
export function ImportModal({ modalId, onImported }) {
  const [picked, setPicked] = useState(null); // { bundle, filePath } | null
  const [includeClass, setIncludeClass] = useState(true);
  const [includeRoom, setIncludeRoom] = useState(true);
  const [includeSeating, setIncludeSeating] = useState(true);
  const [classes, setClasses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [existingClassId, setExistingClassId] = useState('');
  const [existingRoomId, setExistingRoomId] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => document.getElementById(modalId)?.close();

  const reset = () => {
    setPicked(null);
    setIncludeClass(true);
    setIncludeRoom(true);
    setIncludeSeating(true);
    setExistingClassId('');
    setExistingRoomId('');
  };

  const handlePickFile = async () => {
    setBusy(true);
    try {
      const result = await window.api.importBundlePickFile();
      if (!result) { setBusy(false); return; } // avbrutt av bruker
      const { bundle } = result;
      if (!bundle.class && !bundle.room && !bundle.seating) {
        showToast('Fila inneholder ingen gjenkjennelig data.', 'error');
        setBusy(false);
        return;
      }
      setPicked(result);
      setIncludeClass(!!bundle.class);
      setIncludeRoom(!!bundle.room);
      setIncludeSeating(!!bundle.seating);
      if (bundle.seating) {
        const [c, r] = await Promise.all([window.api.getClasses(), window.api.getRooms()]);
        setClasses(c);
        setRooms(r);
      }
    } catch (e) {
      showToast('Filen kunne ikke leses — sjekk at det er en gyldig eksportfil.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const needsExistingClass = picked?.bundle.seating && includeSeating && !(picked.bundle.class && includeClass);
  const needsExistingRoom = picked?.bundle.seating && includeSeating && !(picked.bundle.room && includeRoom);
  const canImport = picked && (includeClass || includeRoom || includeSeating)
    && (!needsExistingClass || existingClassId)
    && (!needsExistingRoom || existingRoomId);

  const handleImport = async () => {
    if (!canImport) return;
    setBusy(true);
    try {
      const { bundle } = picked;
      let classId = needsExistingClass ? Number(existingClassId) : null;
      let roomId = needsExistingRoom ? Number(existingRoomId) : null;
      let createdKind = null;
      let createdId = null;

      if (includeClass && bundle.class) {
        const saved = await window.api.saveClass({ id: null, name: bundle.class.name, students: bundle.class.students ?? '[]' });
        classId = saved?.lastID;
        createdKind = 'class';
        createdId = classId;
        if (bundle.class.constraints?.length && classId) {
          await window.api.importConstraints(classId, bundle.class.constraints);
        }
      }

      if (includeRoom && bundle.room) {
        const saved = await window.api.saveRoom({ id: null, name: bundle.room.name, layoutData: bundle.room.layoutData ?? '{}' });
        roomId = saved?.lastID;
        createdKind = 'room';
        createdId = roomId;
      }

      if (includeSeating && bundle.seating) {
        const saved = await window.api.saveSeating({
          id: null,
          name: bundle.seating.name,
          classId,
          roomId,
          placements: bundle.seating.placements ?? '{}',
          comment: bundle.seating.comment ?? '',
        });
        createdKind = 'seating';
        createdId = saved?.lastID;
      }

      showToast('Importert.', 'success');
      close();
      reset();
      if (createdKind && createdId) onImported(createdKind, createdId);
    } catch (e) {
      showToast('Import feilet delvis — allerede opprettede poster er beholdt.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog id={modalId} className="modal modal-bottom sm:modal-middle" onClose={reset}>
      <div className="modal-box bg-surface-raised border border-slate-700 text-slate-100 rounded-2xl">
        <h3 className="font-bold text-lg flex items-center gap-2 text-white">
          <i className="fa-solid fa-file-import text-purple-400"></i> Importer
        </h3>

        {!picked ? (
          <div className="py-6 flex flex-col items-center gap-3">
            <p className="text-sm text-slate-400 text-center">Velg en tidligere eksportert .klasseplass/.json-fil.</p>
            <button className="btn btn-primary gap-2" onClick={handlePickFile} disabled={busy}>
              {busy ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-folder-open"></i>}
              Velg fil...
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-4">
            {picked.bundle.class && (
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-200">
                <input type="checkbox" className="checkbox checkbox-sm" checked={includeClass} onChange={e => setIncludeClass(e.target.checked)} />
                Klasse: <span className="font-semibold">{picked.bundle.class.name}</span>
              </label>
            )}
            {picked.bundle.room && (
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-200">
                <input type="checkbox" className="checkbox checkbox-sm" checked={includeRoom} onChange={e => setIncludeRoom(e.target.checked)} />
                Rom: <span className="font-semibold">{picked.bundle.room.name}</span>
              </label>
            )}
            {picked.bundle.seating && (
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-200">
                <input type="checkbox" className="checkbox checkbox-sm" checked={includeSeating} onChange={e => setIncludeSeating(e.target.checked)} />
                Klassekart: <span className="font-semibold">{picked.bundle.seating.name}</span>
              </label>
            )}

            {needsExistingClass && (
              <div>
                <label className="text-xs font-bold uppercase opacity-50 text-slate-400 mb-1 block">Klassekartet trenger en klasse</label>
                <select className="select select-bordered select-sm w-full bg-surface-field border-slate-600" value={existingClassId} onChange={e => setExistingClassId(e.target.value)}>
                  <option value="">Velg klasse...</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {needsExistingRoom && (
              <div>
                <label className="text-xs font-bold uppercase opacity-50 text-slate-400 mb-1 block">Klassekartet trenger et rom</label>
                <select className="select select-bordered select-sm w-full bg-surface-field border-slate-600" value={existingRoomId} onChange={e => setExistingRoomId(e.target.value)}>
                  <option value="">Velg rom...</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        <div className="modal-action">
          <form method="dialog">
            <button className="btn btn-ghost text-slate-400 mr-2" onClick={reset}>Avbryt</button>
          </form>
          {picked && (
            <button className="btn btn-primary gap-2" onClick={handleImport} disabled={!canImport || busy}>
              {busy ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-file-import"></i>}
              Importer
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
