import React, { useState, useEffect, useRef } from 'react';
import { RULE_CATEGORIES, RULE_TYPES, findRuleType } from './ruleTypes';
import StudentAvatar from './StudentAvatar';

const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Kritisk (må oppfylles)', cls: 'btn-error' },
  { value: 'important', label: 'Viktig (bør oppfylles)', cls: 'btn-warning' },
  { value: 'wish', label: 'Ønske (om det går)', cls: 'btn-success' },
];

/**
 * Modal for å legge til én regel, åpnet fra en gitt elev (`sourceStudentId`).
 * Progressiv utfylling i ett skjermbilde: kategori -> spesifikk type ->
 * ev. flere elever (kun for regler som gjelder mer enn én) -> prioritet.
 */
export default function AddRuleModal({ isOpen, onClose, students, sourceStudentId, onSave }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [category, setCategory] = useState(null);
  const [type, setType] = useState(null);
  const [extraIds, setExtraIds] = useState([]);
  const [priority, setPriority] = useState('critical');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleNativeClose = () => onCloseRef.current?.();
    dialog.addEventListener('close', handleNativeClose);
    return () => dialog.removeEventListener('close', handleNativeClose);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      setCategory(null);
      setType(null);
      setExtraIds([]);
      setPriority('critical');
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen, sourceStudentId]);

  const sourceStudent = students.find((s) => s.id === sourceStudentId);
  const meta = type ? findRuleType(type) : null;
  const otherStudents = sourceStudent ? students.filter((s) => s.id !== sourceStudentId) : [];

  const toggleExtra = (id) => {
    if (meta?.extra === 'one') {
      setExtraIds(extraIds.includes(id) ? [] : [id]);
    } else {
      setExtraIds(extraIds.includes(id) ? extraIds.filter((x) => x !== id) : [...extraIds, id].slice(0, 4));
    }
  };

  const canSave = !!meta && (meta.extra === 'none' || extraIds.length > 0);

  const handleSave = () => {
    if (!canSave || !sourceStudentId) return;
    onSave({ type, priority, studentIds: [sourceStudentId, ...extraIds] });
    dialogRef.current?.close();
  };

  return (
    <dialog ref={dialogRef} className="modal modal-bottom sm:modal-middle">
      {sourceStudent && (
        <div className="modal-box bg-surface-raised border border-base-300 text-base-content rounded-2xl">
          <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
            <StudentAvatar student={sourceStudent} size="sm" /> Ny regel for {sourceStudent.name}
          </h3>

          <div className="mt-4">
            <label className="text-[10px] font-bold uppercase opacity-50 text-base-content/60 mb-1.5 block">1. Type regel</label>
            <div className="grid grid-cols-2 gap-2">
              {RULE_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`btn btn-sm justify-start gap-2 ${category === c.id ? 'btn-primary' : 'btn-outline border-base-300 text-base-content/80'}`}
                  onClick={() => { setCategory(c.id); setType(null); setExtraIds([]); }}
                >
                  <i className={c.icon}></i> {c.label}
                </button>
              ))}
            </div>
          </div>

          {category && (
            <div className="mt-3 flex flex-col gap-1.5">
              {RULE_TYPES.filter((r) => r.category === category).map((r) => (
                <button
                  key={r.type}
                  type="button"
                  className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${type === r.type ? 'border-primary bg-primary/10' : 'border-base-300 bg-surface-field hover:bg-base-200'}`}
                  onClick={() => { setType(r.type); setExtraIds([]); }}
                >
                  <i className={`${r.icon} ${r.tone} w-4 text-center`}></i>
                  <span className="flex-1">
                    <span className="text-sm font-semibold block">{r.label}</span>
                    <span className="text-[11px] text-base-content/50">{r.hint}</span>
                  </span>
                  {type === r.type && <i className="fa-solid fa-circle-check text-primary"></i>}
                </button>
              ))}
            </div>
          )}

          {meta && meta.extra !== 'none' && (
            <div className="mt-3">
              <label className="text-[10px] font-bold uppercase opacity-50 text-base-content/60 mb-1.5 block">
                2. {meta.extra === 'one' ? 'Velg makker' : 'Velg de andre elevene (inntil 4)'}
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-surface-field rounded-xl border border-base-300">
                {otherStudents.length === 0 ? (
                  <span className="text-xs text-base-content/50 italic">Ingen andre elever i klassen enda.</span>
                ) : (
                  otherStudents.map((s) => {
                    const isSelected = extraIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`btn btn-xs rounded-full ${isSelected ? 'btn-primary shadow' : 'btn-ghost border-base-300 text-base-content/80'}`}
                        onClick={() => toggleExtra(s.id)}
                      >
                        {isSelected ? '✓ ' : '+ '}{s.name}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {meta && (
            <div className="mt-3">
              <label className="text-[10px] font-bold uppercase opacity-50 text-base-content/60 mb-1.5 block">
                {meta.extra === 'none' ? '2' : '3'}. Viktighetsgrad
              </label>
              <div className="flex gap-1.5">
                {PRIORITY_OPTIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={`btn btn-xs flex-1 ${priority === p.value ? p.cls : 'btn-outline border-base-300 text-base-content/70'}`}
                    onClick={() => setPriority(p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="modal-action">
            <button type="button" className="btn btn-ghost text-base-content/60 mr-2" onClick={() => dialogRef.current?.close()}>Avbryt</button>
            <button type="button" className="btn btn-primary gap-1" disabled={!canSave} onClick={handleSave}>
              <i className="fa-solid fa-plus"></i> Lagre regel
            </button>
          </div>
        </div>
      )}
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}
