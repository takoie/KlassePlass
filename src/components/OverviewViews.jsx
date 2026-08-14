import React, { useState, useEffect } from 'react';
import CreateGroupModal from './GroupWork/CreateGroupModal';
import { ExportModal, ImportModal } from './DataTransfer/ExportImportModal';
import { showToast } from '../shared/utils';

export const Card = ({ title, badgeText, badgeColor = 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30', infoList = [], icon, onClick, onDelete, actions }) => (
  <div
    className="relative overflow-hidden rounded-2xl border border-[oklch(var(--p)/0.35)] bg-[oklch(var(--p)/0.10)] backdrop-blur-xl p-5 flex flex-col justify-between cursor-pointer shadow-[inset_0_1px_0_oklch(var(--p)/0.3),0_12px_28px_-10px_rgba(0,0,0,0.6)] transition-all duration-200 group hover:border-[oklch(var(--p)/0.6)] hover:bg-[oklch(var(--p)/0.16)] hover:shadow-[inset_0_1px_0_oklch(var(--p)/0.4),0_18px_36px_-10px_rgba(0,0,0,0.7)]"
    onClick={onClick}
  >
    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[oklch(var(--p)/0.7)] to-transparent"></div>
    <div className="flex items-start gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl bg-[oklch(var(--p)/0.14)] backdrop-blur-sm border border-[oklch(var(--p)/0.3)] flex items-center justify-center text-[oklch(var(--p))] group-hover:scale-105 transition-all flex-shrink-0 mt-0.5">
        <i className={`${icon} text-base`}></i>
      </div>
      <div className="flex-1 overflow-hidden">
        <h3 className="font-bold text-base text-white truncate group-hover:text-[oklch(var(--p))] transition-colors">{title}</h3>
        {badgeText && (
          <div className="mt-1">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {badgeText}
            </span>
          </div>
        )}
      </div>
    </div>

    <div className="flex justify-between items-end pt-3 border-t border-white/10 text-xs text-slate-300">
      <div className="flex flex-col gap-1">
        {infoList.map((info, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <i className={`${info.icon} text-[11px] opacity-80 w-4 text-center text-[oklch(var(--p))]`}></i>
            <span className="font-medium">{info.text}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {actions}
        {onDelete && (
          <button
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-red-500/15 hover:text-red-400 text-slate-400 border border-white/10 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Slett"
          >
            <i className="fa-solid fa-trash text-xs"></i>
          </button>
        )}
        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-slate-300 group-hover:bg-[oklch(var(--p))] group-hover:border-transparent group-hover:text-[oklch(var(--pc))] flex items-center justify-center transition-all shadow">
          <i className="fa-solid fa-arrow-right text-xs"></i>
        </div>
      </div>
    </div>
  </div>
);

export const ConfirmDeleteModal = ({ isOpen, title, itemName, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <dialog className="modal modal-open backdrop-blur-sm">
      <div className="modal-box bg-surface-raised border border-slate-700 text-slate-100 rounded-2xl">
        <h3 className="font-bold text-lg text-red-400 flex items-center gap-2">
          <i className="fa-solid fa-triangle-exclamation"></i> Slett {title}?
        </h3>
        <p className="py-4 text-sm text-slate-300">
          Er du helt sikker på at du vil slette <strong>{itemName}</strong>? 
          <span className="block mt-2 text-red-400 font-bold">Dette vil fjerne ALLE data knyttet til dette elementet. Handlingen kan ikke angres!</span>
        </p>
        <div className="modal-action">
          <button className="btn btn-ghost text-slate-400 hover:text-slate-100" onClick={onCancel}>Avbryt</button>
          <button className="btn btn-error" onClick={onConfirm}>Ja, slett</button>
        </div>
      </div>
    </dialog>
  );
};

export const PageLayout = ({ title, icon, onAdd, onImport, children }) => (
  <div className="h-full flex flex-col p-8 module-content-bg overflow-y-auto">
    <div className="max-w-6xl mx-auto w-full flex justify-between items-center mb-8 pb-4 border-b border-slate-800">
      <div className="flex items-center gap-3">
        <i className={`${icon} text-2xl text-[#34d399]`}></i>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        {onImport && (
          <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 hover:bg-slate-800 gap-2" onClick={onImport}>
            <i className="fa-solid fa-file-import"></i> Importer
          </button>
        )}
        <button className="btn btn-sm bg-[#34d399] hover:bg-[#10b981] text-slate-950 border-none font-bold gap-2 shadow-lg shadow-emerald-950/40" onClick={onAdd}>
          <i className="fa-solid fa-plus"></i> Opprett ny
        </button>
      </div>
    </div>

    <div className="max-w-6xl mx-auto w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {children}
      </div>
    </div>
  </div>
);

export const ClassesOverview = ({ onEdit }) => {
  const [classes, setClasses] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [newClassName, setNewClassName] = useState('');
  const [exportTarget, setExportTarget] = useState(null); // { id, name } | null

  const openExport = (cls) => {
    setExportTarget(cls);
    document.getElementById('modal_export_class')?.showModal();
  };

  useEffect(() => { loadClasses(); }, []);

  const loadClasses = async () => {
    try { setClasses(await window.api.getClasses()); } catch (e) {
      showToast('Kunne ikke hente klassene.', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await window.api.deleteClass(deleteTarget.id);
      await loadClasses();
    } catch (e) {
      console.error('deleteClass feilet:', e);
      showToast('Kunne ikke slette klassen.', 'error');
    }
    setDeleteTarget(null);
  };

  const handleOpenCreate = () => {
    setNewClassName('');
    document.getElementById('modal_create_class')?.showModal();
  };

  const handleCreate = async () => {
    const name = newClassName.trim() || 'Ny klasse';
    try {
      const payload = JSON.stringify({ students: [], rules: [] });
      const result = await window.api.saveClass({ id: null, name, students: payload });
      document.getElementById('modal_create_class')?.close();
      await loadClasses();
      if (result?.lastID) onEdit(result.lastID);
    } catch (e) {
      showToast('Kunne ikke opprette ny klasse.', 'error');
    }
  };

  return (
    <PageLayout
      title="Mine klasser"
      icon="fa-solid fa-users"
      onAdd={handleOpenCreate}
      onImport={() => document.getElementById('modal_import_class')?.showModal()}
    >
      {classes.length === 0 ? <p className="text-slate-400 text-sm italic col-span-full">Ingen klasser opprettet enda.</p> : null}
      {classes.map(cls => {
        let count = 0;
        try {
          const parsed = JSON.parse(cls.students || '[]');
          count = Array.isArray(parsed) ? parsed.length : (parsed.students || []).length;
        } catch(e){}
        return (
          <Card
            key={cls.id}
            title={cls.name}
            badgeText="KLASSE"
            badgeColor="bg-emerald-950/60 text-emerald-400 border-emerald-500/30"
            infoList={[
              { icon: 'fa-solid fa-user-graduate', text: `${count} elever registrert` }
            ]}
            icon="fa-solid fa-users"
            onClick={() => onEdit(cls.id)}
            onDelete={() => setDeleteTarget(cls)}
            actions={
              <button
                className="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-emerald-950/60 hover:text-emerald-400 text-slate-400 border border-slate-700/60 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); openExport(cls); }}
                title="Eksporter klasse"
              >
                <i className="fa-solid fa-file-export text-xs"></i>
              </button>
            }
          />
        );
      })}

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title="klasse"
        itemName={deleteTarget?.name}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <dialog id="modal_create_class" className="modal modal-bottom sm:modal-middle backdrop-blur-sm">
        <div className="modal-box bg-surface-raised border border-slate-700 text-slate-100 rounded-2xl">
          <h3 className="font-bold text-lg text-emerald-400 mb-6 flex items-center gap-2">
            <i className="fa-solid fa-users"></i> Opprett ny klasse
          </h3>

          <div>
            <label className="text-xs font-bold uppercase opacity-50 text-slate-400 mb-1 block">Klassenavn</label>
            <input
              type="text"
              className="input input-bordered w-full bg-surface-field border-slate-600 focus:border-emerald-500"
              value={newClassName}
              onChange={e => setNewClassName(e.target.value)}
              placeholder="F.eks. 8A"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
            />
          </div>

          <div className="modal-action mt-8">
            <form method="dialog">
              <button className="btn btn-ghost text-slate-400 hover:text-slate-100">Avbryt</button>
            </form>
            <button className="btn btn-primary font-bold px-8 shadow-lg shadow-emerald-900/50" onClick={handleCreate}>
              Opprett & rediger <i className="fa-solid fa-arrow-right ml-1"></i>
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      <ExportModal
        modalId="modal_export_class"
        source={{ class: exportTarget, room: null, seating: null }}
        suggestedName={`${exportTarget?.name || 'klasse'}.klasseplass`}
      />
      <ImportModal modalId="modal_import_class" onImported={() => loadClasses()} />
    </PageLayout>
  );
};

export const RoomsOverview = ({ onEdit, onAdd }) => {
  const [rooms, setRooms] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [exportTarget, setExportTarget] = useState(null); // { id, name } | null

  const openExport = (room) => {
    setExportTarget(room);
    document.getElementById('modal_export_room')?.showModal();
  };

  useEffect(() => { loadRooms(); }, []);

  const loadRooms = async () => {
    try { setRooms(await window.api.getRooms()); } catch (e) {
      showToast('Kunne ikke hente rommene.', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await window.api.deleteRoom(deleteTarget.id);
      await loadRooms();
    } catch (e) {
      showToast('Kunne ikke slette rommet.', 'error');
    }
    setDeleteTarget(null);
  };

  return (
    <PageLayout
      title="Mine rom"
      icon="fa-solid fa-school"
      onAdd={onAdd}
      onImport={() => document.getElementById('modal_import_room')?.showModal()}
    >
      {rooms.length === 0 ? <p className="text-slate-400 text-sm italic col-span-full">Ingen rom opprettet enda.</p> : null}
      {rooms.map(rm => {
        let seatCount = 0;
        try {
          const desks = JSON.parse(rm.layout_data || '{}').desks || [];
          seatCount = desks.reduce((sum, d) => sum + (d.capacity || 1), 0);
        } catch(e){}
        return (
          <Card
            key={rm.id}
            title={rm.name}
            badgeText="ROM-OPPSETT"
            badgeColor="bg-purple-950/60 text-purple-400 border-purple-500/30"
            infoList={[
              { icon: 'fa-solid fa-chair', text: `${seatCount} plasser` }
            ]}
            icon="fa-solid fa-school"
            onClick={() => onEdit(rm.id)}
            onDelete={() => setDeleteTarget(rm)}
            actions={
              <button
                className="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-purple-950/60 hover:text-purple-400 text-slate-400 border border-slate-700/60 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); openExport(rm); }}
                title="Eksporter rom"
              >
                <i className="fa-solid fa-file-export text-xs"></i>
              </button>
            }
          />
        );
      })}

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title="rom"
        itemName={deleteTarget?.name}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ExportModal
        modalId="modal_export_room"
        source={{ class: null, room: exportTarget, seating: null }}
        suggestedName={`${exportTarget?.name || 'rom'}.klasseplass`}
      />
      <ImportModal modalId="modal_import_room" onImported={() => loadRooms()} />
    </PageLayout>
  );
};

export const SeatingOverview = ({ onEdit, onAdd }) => {
  const [seatings, setSeatings] = useState([]);
  const [classes, setClasses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [exportTarget, setExportTarget] = useState(null); // seating | null

  const openExport = (seating) => {
    setExportTarget(seating);
    document.getElementById('modal_export_seating')?.showModal();
  };

  // Grupperer klassekart i sammenleggbare skuffer per klasse. Husket i
  // localStorage slik at valget overlever navigering/omstart av appen.
  const [groupedByClass, setGroupedByClass] = useState(() => {
    try { return localStorage.getItem('seatingOverviewGrouped') === 'true'; } catch (e) { return false; }
  });

  const toggleGroupedByClass = () => {
    setGroupedByClass(prev => {
      const next = !prev;
      try { localStorage.setItem('seatingOverviewGrouped', String(next)); } catch (e) {}
      return next;
    });
  };

  // Modal state
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [chartName, setChartName] = useState('');
  const [startWeek, setStartWeek] = useState(1);
  const [periodWeeks, setPeriodWeeks] = useState(4);

  useEffect(() => {
    loadSeatings();
    loadFormData();
  }, []);

  const loadFormData = async () => {
    try {
      const c = await window.api.getClasses();
      const r = await window.api.getRooms();
      setClasses(c);
      setRooms(r);
      if (c.length > 0) setSelectedClass(c[0].id);
      if (r.length > 0) setSelectedRoom(r[0].id);
    } catch(e){
      showToast('Kunne ikke hente klasser og rom.', 'error');
    }
  };

  const loadSeatings = async () => {
    try { setSeatings(await window.api.getSeatings()); } catch (e) {
      showToast('Kunne ikke hente klassekartene.', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.isClassGroup) {
        const classSeatings = seatings.filter(s => s.class_id === deleteTarget.id);
        for (const s of classSeatings) {
          await window.api.deleteSeating(s.id);
        }
      } else {
        await window.api.deleteSeating(deleteTarget.id);
      }
      await loadSeatings();
    } catch (e) {
      showToast('Kunne ikke slette klassekartet.', 'error');
    }
    setDeleteTarget(null);
  };

  const handleOpenCreate = () => {
    setChartName('');
    setStartWeek(1);
    setPeriodWeeks(4);
    const modal = document.getElementById('modal_create_seating');
    if (modal) modal.showModal();
  };

  const handleCreate = async () => {
    if (!selectedClass || !selectedRoom) return;
    try {
      const className = classes.find(c => c.id === Number(selectedClass))?.name || 'Klassekart';
      const name = chartName.trim() || className;
      const weeks = Math.max(1, Number(periodWeeks) || 1);
      const start = Math.max(1, Number(startWeek) || 1);
      const comment = `Uke ${start}-${start + weeks - 1}`;
      const result = await window.api.saveSeating({
        id: null,
        name,
        classId: Number(selectedClass),
        roomId: Number(selectedRoom),
        placements: '{}',
        comment
      });
      const modal = document.getElementById('modal_create_seating');
      if (modal) modal.close();

      await loadSeatings(); // Oppdaterer listen umiddelbart

      if (result?.lastID) {
        onEdit(result.lastID);
      } else {
        // Fallback dersom lastID mangler fra backend
        const all = await window.api.getSeatings();
        const created = all.find(s => s.name === name && s.class_id === Number(selectedClass));
        if (created) onEdit(created.id);
      }
    } catch(e){
      showToast('Kunne ikke opprette klassekartet.', 'error');
    }
  };

  let modalSeatCount = 0;
  try {
    const roomDesks = JSON.parse(rooms.find(r => r.id === Number(selectedRoom))?.layout_data || '{}').desks || [];
    modalSeatCount = roomDesks.reduce((sum, d) => sum + (d.capacity || 1), 0);
  } catch(e){}
  let modalStudentCount = 0;
  try {
    const parsed = JSON.parse(classes.find(c => c.id === Number(selectedClass))?.students || '[]');
    modalStudentCount = Array.isArray(parsed) ? parsed.length : (parsed.students || []).length;
  } catch(e){}

  const renderSeatingCard = (seating) => {
    const cls = classes.find(c => c.id === seating.class_id);

    const handlePrint = (e) => {
      e.stopPropagation();
      // Setter localStorage flagg før vi navigerer, slik at den printer on mount
      localStorage.setItem('print_on_mount', 'true');
      onEdit(seating.id);
    };

    let studentCount = 0;
    try {
      const parsed = JSON.parse(cls?.students || '[]');
      studentCount = Array.isArray(parsed) ? parsed.length : (parsed.students || []).length;
    } catch (e) {}
    const roomName = seating.room_name || rooms.find(r => r.id === seating.room_id)?.name || '—';

    return (
      <Card
        key={seating.id}
        title={seating.name}
        badgeText={cls?.name || seating.class_name || '—'}
        badgeColor="bg-blue-950/60 text-blue-400 border-blue-500/30"
        infoList={[
          { icon: 'fa-solid fa-calendar-week', text: seating.comment || 'Ingen periode angitt' },
          { icon: 'fa-solid fa-school', text: roomName },
          { icon: 'fa-solid fa-users', text: `${studentCount} elever` }
        ]}
        icon="fa-solid fa-users-rectangle"
        onClick={() => onEdit(seating.id)}
        onDelete={() => setDeleteTarget(seating)}
        actions={
          <>
             <button className="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-emerald-950/60 hover:text-emerald-400 text-slate-400 border border-slate-700/60 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100" onClick={handlePrint} title="Skriv ut / PDF"><i className="fa-solid fa-print text-xs"></i></button>
             <button className="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-blue-950/60 hover:text-blue-400 text-slate-400 border border-slate-700/60 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); openExport(seating); }} title="Eksporter kart"><i className="fa-solid fa-file-export text-xs"></i></button>
          </>
        }
      />
    );
  };

  return (
    <PageLayout
      title="Mine klassekart"
      icon="fa-solid fa-map-location-dot"
      onAdd={handleOpenCreate}
      onImport={() => document.getElementById('modal_import_seating')?.showModal()}
    >
      {seatings.length === 0 ? <p className="text-slate-400 text-sm italic col-span-full">Ingen klassekart opprettet enda.</p> : null}

      {seatings.length > 0 && (
        <div className="col-span-full flex justify-end -mb-1">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-400 select-none">
            <span>Grupper per klasse</span>
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-success"
              checked={groupedByClass}
              onChange={toggleGroupedByClass}
            />
          </label>
        </div>
      )}

      {groupedByClass ? (
        classes
          .filter(cls => seatings.some(s => s.class_id === cls.id))
          .sort((a, b) => a.name.localeCompare(b.name, 'nb'))
          .map(cls => {
            const classSeatings = seatings
              .filter(s => s.class_id === cls.id)
              .sort((a, b) => a.name.localeCompare(b.name, 'nb'));

            return (
              <div key={cls.id} className="col-span-full collapse collapse-arrow bg-base-100/40 border border-white/10 rounded-2xl">
                <input type="checkbox" defaultChecked />
                <div className="collapse-title font-bold text-white flex items-center gap-2">
                  <i className="fa-solid fa-users text-emerald-400"></i>
                  {cls.name}
                  <span className="text-xs font-normal text-slate-400">({classSeatings.length} klassekart)</span>
                </div>
                <div className="collapse-content">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
                    {classSeatings.map(seating => renderSeatingCard(seating))}
                  </div>
                </div>
              </div>
            );
          })
      ) : (
        seatings
          .slice()
          .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
          .map(seating => renderSeatingCard(seating))
      )}

      <ConfirmDeleteModal 
        isOpen={!!deleteTarget}
        title={deleteTarget?.isClassGroup ? "klassehistorikk" : "klassekart"}
        itemName={deleteTarget?.name}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <dialog id="modal_create_seating" className="modal modal-bottom sm:modal-middle backdrop-blur-sm">
        <div className="modal-box bg-surface-raised border border-slate-700 text-slate-100 rounded-2xl">
          <h3 className="font-bold text-lg text-emerald-400 mb-6 flex items-center gap-2">
            <i className="fa-solid fa-map-location-dot"></i> Opprett nytt klassekart
          </h3>
          
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold uppercase opacity-50 text-slate-400 mb-1 block">Navn på klassekartet</label>
              <input
                type="text"
                className="input input-bordered w-full bg-surface-field border-slate-600 focus:border-emerald-500"
                value={chartName}
                onChange={e => setChartName(e.target.value)}
                placeholder="Skriv inn navn på klassekart.. Eksempel: Naturfag 1ST3"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase opacity-50 text-slate-400 mb-1 block">Velg klasse</label>
                <select className="select select-bordered w-full bg-surface-field border-slate-600 focus:border-emerald-500" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                  {classes.length === 0 && <option value="" disabled>Ingen klasser funnet</option>}
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {selectedClass && (
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                    <i className="fa-solid fa-users w-3 text-emerald-400"></i> {modalStudentCount} elever
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold uppercase opacity-50 text-slate-400 mb-1 block">Velg klasserom</label>
                <select className="select select-bordered w-full bg-surface-field border-slate-600 focus:border-emerald-500" value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)}>
                  {rooms.length === 0 && <option value="" disabled>Ingen rom funnet</option>}
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                {selectedRoom && (
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                    <i className="fa-solid fa-chair w-3 text-purple-400"></i> {modalSeatCount} elevplasser
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase opacity-50 text-slate-400 mb-1 block">Første periode</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Uke</span>
                <input
                  type="number" min="1" max="52"
                  className="input input-bordered w-20 bg-surface-field border-slate-600 focus:border-emerald-500 text-center"
                  value={startWeek}
                  onChange={e => setStartWeek(e.target.value)}
                />
                <span className="text-xs text-slate-400">i</span>
                <input
                  type="number" min="1" max="52"
                  className="input input-bordered w-20 bg-surface-field border-slate-600 focus:border-emerald-500 text-center"
                  value={periodWeeks}
                  onChange={e => setPeriodWeeks(e.target.value)}
                />
                <span className="text-xs text-slate-400">uker</span>
              </div>
            </div>
          </div>

          <div className="modal-action mt-8">
            <form method="dialog">
              <button className="btn btn-ghost text-slate-400 hover:text-slate-100">Avbryt</button>
            </form>
            <button className="btn btn-primary font-bold px-8 shadow-lg shadow-emerald-900/50" onClick={handleCreate} disabled={!selectedClass || !selectedRoom}>
              Opprett & rediger <i className="fa-solid fa-arrow-right ml-1"></i>
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {(() => {
        const cls = exportTarget ? classes.find(c => c.id === exportTarget.class_id) : null;
        const room = exportTarget ? rooms.find(r => r.id === exportTarget.room_id) : null;
        return (
          <ExportModal
            modalId="modal_export_seating"
            source={{
              class: cls ? { id: cls.id, name: cls.name } : null,
              room: room ? { id: room.id, name: room.name } : null,
              seating: exportTarget ? { id: exportTarget.id, name: exportTarget.name } : null,
            }}
            suggestedName={`${exportTarget?.name || 'klassekart'}.klasseplass`}
          />
        );
      })()}
      <ImportModal modalId="modal_import_seating" onImported={() => loadSeatings()} />
    </PageLayout>
  );
};

export const GroupOverview = ({ onEdit, onAdd }) => {
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [a, c] = await Promise.all([window.api.getGroupAssignments(), window.api.getClasses()]);
      setAssignments(a);
      setClasses(c);
    } catch (e) {
      showToast('Kunne ikke hente gruppeinndelingene.', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.isClassGroup) {
        const classAssignments = assignments.filter(a => a.class_id === deleteTarget.id);
        for (const a of classAssignments) {
          await window.api.deleteGroupAssignment(a.id);
        }
      } else {
        await window.api.deleteGroupAssignment(deleteTarget.id);
      }
      await loadAll();
    } catch (e) {
      showToast('Kunne ikke slette gruppeinndelingen.', 'error');
    }
    setDeleteTarget(null);
  };

  return (
    <PageLayout title="Gruppearbeid" icon="fa-solid fa-people-group" onAdd={() => document.getElementById('modal_create_group')?.showModal()}>
      {assignments.length === 0 ? <p className="text-slate-400 text-sm italic col-span-full">Ingen gruppeinndelinger opprettet enda.</p> : null}

      {classes.map(cls => {
        const classAssignments = assignments.filter(a => a.class_id === cls.id).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        if (classAssignments.length === 0) return null;

        const latest = classAssignments[0];

        const handlePrint = (e) => {
          e.stopPropagation();
          localStorage.setItem('print_on_mount', 'true');
          onEdit(latest.id);
        };

        return (
          <Card
            key={cls.id}
            title={latest.name}
            badgeText={cls.name}
            badgeColor="bg-blue-950/60 text-blue-400 border-blue-500/30"
            infoList={[
              { icon: 'fa-solid fa-object-group', text: `${latest.group_count} grupper` },
              { icon: 'fa-solid fa-layer-group', text: `Historikk: ${classAssignments.length} inndelinger` }
            ]}
            icon="fa-solid fa-people-group"
            onClick={() => onEdit(latest.id)}
            onDelete={() => setDeleteTarget({ ...cls, isClassGroup: true, name: `Klasse ${cls.name}` })}
            actions={
              <button className="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-emerald-950/60 hover:text-emerald-400 text-slate-400 border border-slate-700/60 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100" onClick={handlePrint} title="Skriv ut / PDF">
                <i className="fa-solid fa-print text-xs"></i>
              </button>
            }
          />
        );
      })}

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title={deleteTarget?.isClassGroup ? "all gruppehistorikk" : "gruppeinndeling"}
        itemName={deleteTarget?.name}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <CreateGroupModal classes={classes} onCreated={(id) => { loadAll(); onEdit(id); }} />
    </PageLayout>
  );
};
