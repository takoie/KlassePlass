import React, { useState, useEffect, useRef } from 'react';
import { showToast } from '../shared/utils';
import Select from './Select';

const normalizeStudent = (s) => {
  if (typeof s === 'string') {
    return { id: `stu-${Math.random().toString(36).substr(2, 9)}`, name: s };
  }
  return s && s.id && s.name ? s : { id: `stu-${Math.random().toString(36).substr(2, 9)}`, name: String(s || '') };
};

// Fornavn = første token, etternavn = siste token, mellomnavn = alt i mellom.
// Brukes av masseimport for å la lærere velge bort mellomnavn og/eller
// forkorte/fjerne etternavn ved import (uten å røre navn som allerede står
// i klasselisten fra før).
const transformImportedName = (rawName, { stripMiddleNames, lastNameMode }) => {
  const parts = rawName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts.join(' ');
  const first = parts[0];
  const last = parts[parts.length - 1];
  const middle = stripMiddleNames ? [] : parts.slice(1, -1);
  let lastPart = last;
  if (lastNameMode === 'remove') lastPart = null;
  else if (lastNameMode === 'initial') lastPart = `${last.charAt(0).toUpperCase()}.`;
  return [first, ...middle, ...(lastPart ? [lastPart] : [])].join(' ');
};

export default function ClassManager({ onBack, initialId }) {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [className, setClassName] = useState('');
  const [students, setStudents] = useState([]);
  const [rules, setRules] = useState([]);
  const [newStudentName, setNewStudentName] = useState('');
  const [importData, setImportData] = useState('');
  const [importStripMiddleNames, setImportStripMiddleNames] = useState(false);
  const [importLastNameMode, setImportLastNameMode] = useState('keep'); // 'keep' | 'initial' | 'remove'
  const [saveState, setSaveState] = useState('saved');

  // Rule Form States
  const [ruleType, setRuleType] = useState('avoid');
  const [rulePriority, setRulePriority] = useState('critical');
  const [selectedRuleStudentIds, setSelectedRuleStudentIds] = useState([]);
  const [activeTab, setActiveTab] = useState('students');
  
  const saveTimeoutRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const latestClassDataRef = useRef({ selectedClass, className, students, rules });
  const pendingSaveRef = useRef(false);

  useEffect(() => {
    latestClassDataRef.current = { selectedClass, className, students, rules };
  });

  useEffect(() => {
    return () => {
      if (pendingSaveRef.current && latestClassDataRef.current) {
        const { selectedClass: sc, className: cn, students: st, rules: rl } = latestClassDataRef.current;
        if (sc?.id && cn.trim()) {
          const payload = JSON.stringify({
            students: st.filter(s => s.name.trim() !== ''),
            rules: rl
          });
          window.api.saveClass({
            id: sc.id,
            name: cn.trim(),
            students: payload
          }).catch(() => {});
        }
      }
    };
  }, []);

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    setLoading(true);
    try {
      const data = await window.api.getClasses();
      setClasses(data);
      if (initialId && initialId !== 'new') {
        const found = data.find(c => c.id === Number(initialId));
        if (found) handleSelectClass(found);
        else if (data.length > 0) handleSelectClass(data[0]);
      } else if (data.length > 0 && !selectedClass) {
        handleSelectClass(data[0]);
      }
    } catch (e) {
      showToast('Kunne ikke hente klassene. Prøv å starte appen på nytt.', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }
    if (!selectedClass || !selectedClass.id) return;

    pendingSaveRef.current = true;
    setSaveState('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await saveCurrentClass();
      pendingSaveRef.current = false;
    }, 500); 
    
    return () => clearTimeout(saveTimeoutRef.current);
  }, [className, students, rules]);

  const handleSelectClass = (cls) => {
    isInitialLoadRef.current = true;
    setSelectedClass(cls);
    setClassName(cls.name);
    
    try {
      const parsedData = cls.students ? JSON.parse(cls.students) : [];
      if (Array.isArray(parsedData)) {
        setStudents(parsedData.map(normalizeStudent));
        setRules([]);
      } else {
        setStudents((parsedData.students || []).map(normalizeStudent));
        setRules(parsedData.rules || []);
      }
    } catch (e) {
      setStudents([]);
      setRules([]);
    }

    setSaveState('saved');
    setTimeout(() => isInitialLoadRef.current = false, 100);
  };

  const handleCreateNew = async () => {
    isInitialLoadRef.current = true;
    try {
      const payload = JSON.stringify({ students: [], rules: [] });
      const result = await window.api.saveClass({ id: null, name: 'Ny klasse', students: payload });
      const newCls = { id: result.lastID, name: 'Ny klasse', students: payload };
      setSelectedClass(newCls);
      setClassName('Ny klasse');
      setStudents([]);
      setRules([]);
      await loadClasses();
      setSaveState('saved');
    } catch (e) {
      showToast('Kunne ikke opprette ny klasse.', 'error');
    }
    setTimeout(() => isInitialLoadRef.current = false, 100);
  };

  const saveCurrentClass = async () => {
    if (!className.trim() || !selectedClass?.id) return;
    try {
      const payload = JSON.stringify({
        students: students.filter(s => s.name.trim() !== ''),
        rules: rules
      });

      await window.api.saveClass({
        id: selectedClass.id,
        name: className.trim(),
        students: payload
      });

      const data = await window.api.getClasses();
      setClasses(data);
      setSaveState('saved');
    } catch (e) {
      setSaveState('error');
      showToast('Klassen kunne ikke lagres. Sjekk at det er nok diskplass, og prøv igjen.', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await window.api.deleteClass(id);
      const remaining = classes.filter(c => c.id !== id);
      setClasses(remaining);
      if (remaining.length > 0) {
        handleSelectClass(remaining[0]);
      } else {
        setSelectedClass(null);
      }
    } catch (e) {
      console.error('deleteClass feilet:', e);
      showToast('Kunne ikke slette klassen.', 'error');
    }
  };

  const addStudent = (e) => {
    e.preventDefault();
    if (newStudentName.trim()) {
      const newStu = {
        id: `stu-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: newStudentName.trim()
      };
      setStudents([...students, newStu]);
      setNewStudentName('');
    }
  };

  const removeStudent = (id) => {
    setStudents(students.filter(s => s.id !== id));
    setRules(rules.filter(r => !(r.studentIds || []).includes(id)));
  };

  const updateStudent = (id, newName) => {
    setStudents(students.map(s => s.id === id ? { ...s, name: newName } : s));
  };

  const toggleStudentForRule = (sId) => {
    if (selectedRuleStudentIds.includes(sId)) {
      setSelectedRuleStudentIds(selectedRuleStudentIds.filter(id => id !== sId));
    } else {
      setSelectedRuleStudentIds([...selectedRuleStudentIds, sId]);
    }
  };

  const handleAddRule = (e) => {
    e.preventDefault();
    if (selectedRuleStudentIds.length === 0) return;

    setRules([...rules, {
      id: Date.now().toString(),
      type: ruleType,
      priority: rulePriority,
      studentIds: selectedRuleStudentIds
    }]);

    setSelectedRuleStudentIds([]);
  };

  const removeRule = (ruleId) => {
    setRules(rules.filter(r => r.id !== ruleId));
  };

  const handleImportStudents = () => {
    if (!importData.trim()) return;
    const imported = importData.split(/[\n,\t]+/).map(s => s.trim()).filter(s => s !== '');
    const newObjects = imported.map(name => ({
      id: `stu-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: transformImportedName(name, { stripMiddleNames: importStripMiddleNames, lastNameMode: importLastNameMode })
    }));
    setStudents([...students, ...newObjects]);
    setImportData('');
    document.getElementById('modal_import_students')?.close();
  };

  const ruleOptions = [
    { type: 'avoid', label: '⛔ Skal IKKE sitte sammen (2 til 5 elever)', icon: 'fa-solid fa-shield-halved text-red-400' },
    { type: 'pair', label: '💚 God makkermatch (2 elever)', icon: 'fa-solid fa-heart text-success' },
    { type: 'nearBoard', label: '📍 Må sitte nær tavlen (fremste rad)', icon: 'fa-solid fa-location-dot text-amber-400' },
    { type: 'sitBack', label: '🔙 Må sitte bakerst (bakre rad)', icon: 'fa-solid fa-arrow-down text-purple-400' },
    { type: 'sitMiddle', label: '↔️ Må sitte i midten (midterste rad)', icon: 'fa-solid fa-align-center text-cyan-400' },
    { type: 'awayDoor', label: '🚪 Skjermet for dør-støy (unngå dør)', icon: 'fa-solid fa-door-open text-blue-400' },
    { type: 'awayWindow', label: '🪟 Skjermet fra vindu (unngå vindu)', icon: 'fa-solid fa-sun text-yellow-400' },
    { type: 'supportPair', label: '🎓 Faglig støttemakker (2 elever)', icon: 'fa-solid fa-graduation-cap text-indigo-400' }
  ];

  return (
    <div className="flex flex-col h-full w-full bg-base-100 overflow-hidden">
      {/* Topp-bar */}
      <div className="px-4 py-2 bg-base-200 border-b border-base-300 flex flex-wrap justify-between items-center gap-x-4 gap-y-2 z-10 flex-shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {onBack && (
            <button className="btn btn-ghost btn-sm text-base-content/60 hover:text-base-content gap-1" onClick={onBack}>
              <i className="fa-solid fa-arrow-left"></i> Tilbake
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase opacity-50 text-base-content/60">Klasse:</span>
            <Select
              size="sm"
              className="min-w-40"
              ariaLabel="Klasse"
              value={selectedClass?.id || ''}
              onChange={(v) => {
                const found = classes.find(c => c.id === Number(v));
                if (found) handleSelectClass(found);
              }}
              options={classes.map(c => ({ value: c.id, label: c.name }))}
            />
          </div>
          <button className="btn btn-primary btn-sm gap-1" onClick={handleCreateNew}>
            <i className="fa-solid fa-plus"></i> Ny klasse
          </button>
        </div>

        {selectedClass && (
          <button 
            className="btn btn-ghost text-red-400 hover:bg-red-950/40 btn-xs"
            onClick={() => document.getElementById(`modal_delete_${selectedClass.id}`)?.showModal()}
          >
            <i className="fa-solid fa-trash"></i> Slett klasse
          </button>
        )}
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden items-center px-8 py-6">
        {selectedClass ? (
          <div className="flex-1 flex flex-col h-full w-full max-w-4xl overflow-hidden items-center">
            
            {/* Tittel */}
            <div className="w-full text-center mb-6 relative">
              <input 
                type="text" 
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="input input-ghost text-3xl font-extrabold w-full bg-transparent border-b-2 border-transparent hover:border-base-300 focus:bg-base-200 focus:border-primary px-2 transition-all rounded-none h-14 text-center text-base-content"
                placeholder="Klassenavn..."
              />
              <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-semibold">
                {saveState === 'saving' ? (
                  <span className="text-amber-400 opacity-80 flex items-center gap-1">
                    <i className="fa-solid fa-spinner fa-spin"></i> Lagrer...
                  </span>
                ) : saveState === 'error' ? (
                  <span className="text-red-400 flex items-center gap-1 shadow-sm">
                    <i className="fa-solid fa-triangle-exclamation"></i> Kunne ikke lagre
                  </span>
                ) : (
                  <span className="text-primary flex items-center gap-1 shadow-sm">
                    <i className="fa-solid fa-circle-check"></i> Lagret
                  </span>
                )}
              </div>
            </div>
            
            {/* Faner */}
            <div className="w-full mb-4 flex justify-center">
              <div className="bg-base-200 border border-base-300 p-1 rounded-xl flex gap-1">
                <button 
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'students' ? 'bg-primary text-slate-950 shadow' : 'text-base-content/60 hover:text-base-content'}`}
                  onClick={() => setActiveTab('students')}
                >
                  <i className="fa-solid fa-users"></i> Elever ({students.length})
                </button>
                <button 
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'rules' ? 'bg-primary text-slate-950 shadow' : 'text-base-content/60 hover:text-base-content'}`}
                  onClick={() => setActiveTab('rules')}
                >
                  <i className="fa-solid fa-shield-halved"></i> Elev-regler og tilrettelegging ({rules.length})
                </button>
              </div>
            </div>

            {/* Fane 1: Elev-liste */}
            {activeTab === 'students' && (
              <div className="flex-1 overflow-hidden flex flex-col w-full">
                <form onSubmit={addStudent} className="flex gap-2 mb-4">
                  <input 
                    type="text" 
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    className="input input-bordered input-sm flex-1 bg-base-200 border-base-300 text-base-content placeholder-slate-500" 
                    placeholder="Skriv inn elevens navn..."
                    autoFocus
                  />
                  <button type="submit" className="btn btn-primary btn-sm gap-1">
                    <i className="fa-solid fa-user-plus"></i> Legg til elev
                  </button>
                  <button 
                    type="button"
                    className="btn btn-outline btn-sm border-base-300 text-base-content/80 hover:bg-base-200 gap-1"
                    onClick={() => document.getElementById('modal_import_students').showModal()}
                    title="Masseimport fra Excel/Word/CSV"
                  >
                    <i className="fa-solid fa-file-import text-indigo-400"></i> Masseimport
                  </button>
                </form>

                <div
                  className="bg-base-200 rounded-2xl shadow-inner border border-base-300 flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-1 content-start"
                  style={students.length > 0 ? { gridTemplateRows: `repeat(${Math.ceil(students.length / 2)}, minmax(0, auto))`, gridAutoFlow: 'column' } : undefined}
                >
                  {students.length === 0 ? (
                    <div className="col-span-full flex-1 flex flex-col items-center justify-center text-base-content/50 p-8 text-center h-full">
                      <i className="fa-solid fa-users text-4xl mb-2 opacity-30"></i>
                      <p>Ingen elever lagt til enda.</p>
                    </div>
                  ) : (
                    students.map((student, idx) => {
                      const rowCount = Math.ceil(students.length / 2);
                      const rowIdx = idx % rowCount;
                      return (
                      <div key={student.id} className={`flex justify-between items-center p-2 hover:bg-surface-field rounded-xl group transition-colors ${rowIdx % 2 === 1 ? 'bg-black/15' : ''}`}>
                        <div className="flex items-center gap-3 flex-1">
                          <span className="badge badge-sm font-mono opacity-50 w-6 border-none bg-base-200 text-base-content/80">{idx + 1}</span>
                          <input 
                            type="text" 
                            value={student.name}
                            onChange={(e) => updateStudent(student.id, e.target.value)}
                            className="input input-sm input-ghost flex-1 font-medium bg-transparent px-1 text-base-content focus:bg-base-200 focus:outline-none"
                          />
                        </div>
                        <button 
                          className="btn btn-ghost btn-xs text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeStudent(student.id)}
                          title="Fjern elev"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Fane 2: Elev-regler og tilrettelegging */}
            {activeTab === 'rules' && (
              <div className="flex-1 overflow-hidden flex flex-col w-full">
                <form onSubmit={handleAddRule} className="bg-base-200 p-4 rounded-2xl border border-base-300 mb-4 flex flex-col gap-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase opacity-50 text-base-content/60 mb-1 block">Regel-type</label>
                      <Select
                        size="xs"
                        className="w-full"
                        ariaLabel="Regel-type"
                        value={ruleType}
                        onChange={(v) => { setRuleType(v); setSelectedRuleStudentIds([]); }}
                        options={ruleOptions.map(opt => ({ value: opt.type, label: opt.label }))}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase opacity-50 text-base-content/60 mb-1 block">Viktighetsgrad (prioritet)</label>
                      <Select
                        size="xs"
                        className="w-full"
                        ariaLabel="Viktighetsgrad"
                        value={rulePriority}
                        onChange={setRulePriority}
                        options={[
                          { value: 'critical', label: '🔴 Kritisk (Må oppfylles)' },
                          { value: 'important', label: '🟡 Viktig (Bør oppfylles)' },
                          { value: 'wish', label: '🟢 Ønske (Om det går)' },
                        ]}
                      />
                    </div>
                  </div>

                  <div className="text-xs opacity-60 text-base-content/60">Velg elev(er) for denne regelen (du kan kombinere flere regler for samme elev):</div>
                  
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-surface-field rounded-xl border border-base-300">
                    {students.map((s) => {
                      const isSelected = selectedRuleStudentIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={`btn btn-xs rounded-full ${isSelected ? 'btn-primary shadow' : 'btn-ghost border-base-300 text-base-content/80'}`}
                          onClick={() => toggleStudentForRule(s.id)}
                        >
                          {isSelected ? '✓ ' : '+ '}{s.name}
                        </button>
                      );
                    })}
                  </div>

                  <button type="submit" className="btn btn-xs btn-primary self-end" disabled={selectedRuleStudentIds.length === 0}>
                    + Lagre regel ({selectedRuleStudentIds.length} elever valgt)
                  </button>
                </form>

                <div className="bg-base-200 rounded-2xl shadow-inner border border-base-300 flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                  {rules.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-base-content/50 p-8 text-center h-full">
                      <i className="fa-solid fa-shield-halved text-4xl mb-2 opacity-30"></i>
                      <p className="text-sm">Ingen spesielle regler definert.</p>
                    </div>
                  ) : (
                    rules.map((r) => {
                      const optionMeta = ruleOptions.find(o => o.type === r.type);
                      const ruleStudentNames = (r.studentIds || []).map(id => students.find(s => s.id === id)?.name || id);
                      
                      let prioBadge = <span className="badge badge-error badge-xs font-bold gap-1"><i className="fa-solid fa-circle-exclamation"></i> Kritisk</span>;
                      if (r.priority === 'important') prioBadge = <span className="badge badge-warning badge-xs font-bold gap-1"><i className="fa-solid fa-triangle-exclamation"></i> Viktig</span>;
                      if (r.priority === 'wish') prioBadge = <span className="badge badge-success badge-xs font-bold gap-1"><i className="fa-solid fa-circle-check"></i> Ønske</span>;

                      return (
                        <div key={r.id} className="p-3 bg-surface-field rounded-xl border border-base-300 flex justify-between items-center">
                          <div className="flex items-center gap-3 flex-wrap">
                            {prioBadge}
                            <span className="badge badge-neutral gap-1.5 text-xs bg-base-200 text-base-content border-base-300">
                              <i className={optionMeta?.icon}></i>
                              {optionMeta?.label.split('(')[0]}
                            </span>
                            <div className="flex flex-wrap gap-1 items-center">
                              {ruleStudentNames.map((stName, i) => (
                                <span key={i} className="badge bg-indigo-950 text-indigo-300 border-indigo-500/30 text-xs">{stName}</span>
                              ))}
                            </div>
                          </div>
                          <button className="btn btn-ghost btn-xs text-red-400" onClick={() => removeRule(r.id)}>✕ Fjern</button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-base-content/50">
            <i className="fa-solid fa-users text-5xl mb-4 opacity-20"></i>
            <h2 className="text-xl font-bold text-base-content">Ingen klasser funnet</h2>
            <p>Trykk på "+ Ny klasse" i toppbaren for å komme i gang.</p>
          </div>
        )}
      </div>
      
      {/* Masseimport modal */}
      <dialog id="modal_import_students" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box bg-surface-raised border border-base-300 text-base-content rounded-2xl">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <i className="fa-solid fa-file-import text-indigo-400"></i> Masseimport av elever
          </h3>
          <p className="text-xs text-base-content/60 mb-2">Lim inn navn fra Excel, Word eller CSV. Skill med linjeskift eller komma.</p>
          <textarea
            className="textarea textarea-bordered w-full h-48 bg-surface-field border-base-300 font-mono text-sm text-base-content"
            placeholder="Kari Anne Nordmann&#10;Ola Nordmann&#10;Per P..."
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
          ></textarea>
          <div className="flex flex-wrap items-center gap-4 mt-3">
            <label className="flex items-center gap-2 text-xs text-base-content/80 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox checkbox-xs"
                checked={importStripMiddleNames}
                onChange={(e) => setImportStripMiddleNames(e.target.checked)}
              />
              Fjern mellomnavn
            </label>
            <label className="flex items-center gap-2 text-xs text-base-content/80">
              Etternavn
              <Select
                size="xs"
                className="w-44"
                ariaLabel="Etternavn"
                value={importLastNameMode}
                onChange={setImportLastNameMode}
                options={[
                  { value: 'keep', label: 'Behold fullt' },
                  { value: 'initial', label: 'Vis kun forbokstav' },
                  { value: 'remove', label: 'Fjern' },
                ]}
              />
            </label>
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost text-base-content/60 mr-2" onClick={() => setImportData('')}>Avbryt</button>
              <button className="btn btn-primary" onClick={handleImportStudents}>Importer elever</button>
            </form>
          </div>
        </div>
      </dialog>

      {/* Slette-modal */}
      {selectedClass && (
        <dialog id={`modal_delete_${selectedClass.id}`} className="modal modal-bottom sm:modal-middle">
          <div className="modal-box bg-surface-raised border border-base-300 text-base-content rounded-2xl">
            <h3 className="font-bold text-lg text-red-400">Slett klasse?</h3>
            <p className="py-4 text-sm text-base-content/80">Er du helt sikker på at du vil slette <strong>{selectedClass.name}</strong>?</p>
            <div className="modal-action">
              <form method="dialog">
                <button className="btn btn-ghost text-base-content/60 mr-2">Avbryt</button>
                <button className="btn btn-error" onClick={() => handleDelete(selectedClass.id)}>Ja, slett</button>
              </form>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
