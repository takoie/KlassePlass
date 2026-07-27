import React, { useState, useEffect } from 'react';
import CreateGroupModal from './GroupWork/CreateGroupModal';

export const Card = ({ title, badgeText, badgeColor = 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30', infoList = [], icon, onClick, onDelete, actions }) => (
  <div 
    className="bg-[#262b3a] border border-slate-700/70 rounded-2xl p-5 flex flex-col justify-between cursor-pointer hover:border-slate-500 hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all group duration-200 relative overflow-hidden"
    onClick={onClick}
  >
    <div className="flex items-start gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl bg-blue-950/80 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-all flex-shrink-0 mt-0.5">
        <i className={`${icon} text-base`}></i>
      </div>
      <div className="flex-1 overflow-hidden">
        <h3 className="font-bold text-base text-white truncate group-hover:text-emerald-400 transition-colors">{title}</h3>
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

    <div className="flex justify-between items-end pt-3 border-t border-slate-800/80 text-xs text-slate-300">
      <div className="flex flex-col gap-1">
        {infoList.map((info, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <i className={`${info.icon} text-[11px] opacity-80 w-4 text-center text-emerald-400`}></i>
            <span className="font-medium">{info.text}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {actions}
        {onDelete && (
          <button 
            className="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-red-950/60 hover:text-red-400 text-slate-400 border border-slate-700/60 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Slett"
          >
            <i className="fa-solid fa-trash text-xs"></i>
          </button>
        )}
        <div className="w-8 h-8 rounded-full bg-[#1b1e28] text-slate-300 group-hover:bg-[#34d399] group-hover:text-slate-950 flex items-center justify-center transition-all shadow">
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
      <div className="modal-box bg-[#171a25] border border-slate-700 text-slate-100 rounded-2xl">
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

export const PageLayout = ({ title, icon, onAdd, children }) => (
  <div className="h-full flex flex-col p-8 bg-[#1e2230] overflow-y-auto">
    <div className="max-w-6xl mx-auto w-full flex justify-between items-center mb-8 pb-4 border-b border-slate-800">
      <div className="flex items-center gap-3">
        <i className={`${icon} text-2xl text-[#34d399]`}></i>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">{title}</h1>
      </div>
      <button className="btn btn-sm bg-[#34d399] hover:bg-[#10b981] text-slate-950 border-none font-bold gap-2 shadow-lg shadow-emerald-950/40" onClick={onAdd}>
        <i className="fa-solid fa-plus"></i> Opprett ny
      </button>
    </div>

    <div className="max-w-6xl mx-auto w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {children}
      </div>
    </div>
  </div>
);

export const ClassesOverview = ({ onEdit, onAdd }) => {
  const [classes, setClasses] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  
  useEffect(() => { loadClasses(); }, []);
  
  const loadClasses = async () => {
    try { setClasses(await window.api.getClasses()); } catch (e) {}
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await window.api.deleteClass(deleteTarget.id);
      await loadClasses();
    } catch (e) {}
    setDeleteTarget(null);
  };

  return (
    <PageLayout title="Mine Klasser" icon="fa-solid fa-users" onAdd={onAdd}>
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
              { icon: 'fa-solid fa-user-graduate', text: `${count} Elever registrert` }
            ]}
            icon="fa-solid fa-users"
            onClick={() => onEdit(cls.id)}
            onDelete={() => setDeleteTarget(cls)}
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
    </PageLayout>
  );
};

export const RoomsOverview = ({ onEdit, onAdd }) => {
  const [rooms, setRooms] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => { loadRooms(); }, []);

  const loadRooms = async () => {
    try { setRooms(await window.api.getRooms()); } catch (e) {}
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await window.api.deleteRoom(deleteTarget.id);
      await loadRooms();
    } catch (e) {}
    setDeleteTarget(null);
  };

  return (
    <PageLayout title="Mine Rom" icon="fa-solid fa-school" onAdd={onAdd}>
      {rooms.length === 0 ? <p className="text-slate-400 text-sm italic col-span-full">Ingen rom opprettet enda.</p> : null}
      {rooms.map(rm => {
        let deskCount = 0;
        try { deskCount = (JSON.parse(rm.layout_data || '{}').desks || []).length; } catch(e){}
        return (
          <Card 
            key={rm.id}
            title={rm.name}
            badgeText="ROM-OPPSETT"
            badgeColor="bg-purple-950/60 text-purple-400 border-purple-500/30"
            infoList={[
              { icon: 'fa-solid fa-chair', text: `${deskCount} Bord-plasser` }
            ]}
            icon="fa-solid fa-school"
            onClick={() => onEdit(rm.id)}
            onDelete={() => setDeleteTarget(rm)}
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
    </PageLayout>
  );
};

export const SeatingOverview = ({ onEdit, onAdd }) => {
  const [seatings, setSeatings] = useState([]);
  const [classes, setClasses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  
  // Modal state
  const [newChartName, setNewChartName] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');

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
    } catch(e){}
  };

  const loadSeatings = async () => {
    try { setSeatings(await window.api.getSeatings()); } catch (e) {}
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
    } catch (e) {}
    setDeleteTarget(null);
  };

  const handleOpenCreate = () => {
    setNewChartName('');
    const modal = document.getElementById('modal_create_seating');
    if (modal) modal.showModal();
  };

  const handleCreate = async () => {
    if (!newChartName.trim() || !selectedClass || !selectedRoom) return;
    try {
      const result = await window.api.saveSeating({
        id: null,
        name: newChartName.trim(),
        classId: selectedClass,
        roomId: selectedRoom,
        placements: '{}',
        comment: 'Uke 1-4'
      });
      const modal = document.getElementById('modal_create_seating');
      if (modal) modal.close();
      
      await loadSeatings(); // Oppdaterer listen umiddelbart
      
      if (result?.lastID) {
        onEdit(result.lastID);
      } else {
        // Fallback dersom lastID mangler fra backend
        const all = await window.api.getSeatings();
        const created = all.find(s => s.name === newChartName.trim() && s.class_id === Number(selectedClass));
        if (created) onEdit(created.id);
      }
    } catch(e){}
  };

  return (
    <PageLayout title="Mine Klassekart" icon="fa-solid fa-map-location-dot" onAdd={handleOpenCreate}>
      {seatings.length === 0 ? <p className="text-slate-400 text-sm italic col-span-full">Ingen klassekart opprettet enda.</p> : null}
      
      {classes.map(cls => {
        const classSeatings = seatings.filter(s => s.class_id === cls.id).sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        if (classSeatings.length === 0) return null;
        
        const latestChart = classSeatings[0];

        const handleExport = (e) => {
          e.stopPropagation();
          const exportData = {
             name: latestChart.name,
             comment: latestChart.comment,
             desks: latestChart.room_id ? rooms.find(r => r.id === latestChart.room_id)?.layout_data : null,
             placements: JSON.parse(latestChart.placements || '{}')
          };
          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
          const downloadAnchor = document.createElement('a');
          downloadAnchor.setAttribute("href", dataStr);
          downloadAnchor.setAttribute("download", `${latestChart.name || 'klassekart'}.klasseplass`);
          document.body.appendChild(downloadAnchor);
          downloadAnchor.click();
          downloadAnchor.remove();
        };

        const handleImport = (e) => {
          e.stopPropagation();
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.klasseplass,.json';
          input.onchange = async (event) => {
             const file = event.target.files[0];
             if(!file) return;
             const reader = new FileReader();
             reader.onload = async (ev) => {
               try {
                 const imported = JSON.parse(ev.target.result);
                 // Opprett en ny periode for denne klassen
                 const result = await window.api.saveSeating({
                   id: null,
                   name: (imported.name || 'Importert kart') + ' (Importert)',
                   classId: cls.id,
                   roomId: latestChart.room_id,
                   placements: JSON.stringify(imported.placements || {}),
                   comment: imported.comment || 'Importert'
                 });
                 if (result?.lastID) onEdit(result.lastID);
                 await loadSeatings();
               } catch(err) { console.error("Import feilet", err); }
             };
             reader.readAsText(file);
          };
          input.click();
        };

        const handlePrint = (e) => {
          e.stopPropagation();
          // Setter localStorage flagg før vi navigerer, slik at den printer on mount
          localStorage.setItem('print_on_mount', 'true');
          onEdit(latestChart.id);
        };

        return (
          <Card 
            key={cls.id}
            title={cls.name}
            infoList={[
              { icon: 'fa-solid fa-map-location-dot', text: `Aktivt: ${latestChart.name}` },
              { icon: 'fa-solid fa-school', text: `Rom: ${latestChart.room_name || latestChart.room_id}` },
              { icon: 'fa-solid fa-layer-group', text: `Historikk: ${classSeatings.length} perioder` }
            ]}
            icon="fa-solid fa-users-rectangle"
            onClick={() => onEdit(latestChart.id)}
            onDelete={() => setDeleteTarget({ ...cls, isClassGroup: true, name: `Klasse ${cls.name}` })}
            actions={
              <>
                 <button className="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-emerald-950/60 hover:text-emerald-400 text-slate-400 border border-slate-700/60 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100" onClick={handlePrint} title="Skriv ut / PDF"><i className="fa-solid fa-print text-xs"></i></button>
                 <button className="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-blue-950/60 hover:text-blue-400 text-slate-400 border border-slate-700/60 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100" onClick={handleExport} title="Eksporter nyeste kart"><i className="fa-solid fa-download text-xs"></i></button>
                 <button className="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-purple-950/60 hover:text-purple-400 text-slate-400 border border-slate-700/60 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100" onClick={handleImport} title="Importer til ny periode"><i className="fa-solid fa-upload text-xs"></i></button>
              </>
            }
          />
        );
      })}

      <ConfirmDeleteModal 
        isOpen={!!deleteTarget}
        title={deleteTarget?.isClassGroup ? "klassehistorikk" : "klassekart"}
        itemName={deleteTarget?.name}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <dialog id="modal_create_seating" className="modal modal-bottom sm:modal-middle backdrop-blur-sm">
        <div className="modal-box bg-[#171a25] border border-slate-700 text-slate-100 rounded-2xl">
          <h3 className="font-bold text-lg text-emerald-400 mb-6 flex items-center gap-2">
            <i className="fa-solid fa-map-location-dot"></i> Opprett nytt klassekart
          </h3>
          
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold uppercase opacity-50 text-slate-400 mb-1 block">Navn på klassekart</label>
              <input type="text" className="input input-bordered w-full bg-[#262b3a] border-slate-600 focus:border-emerald-500 transition-colors" placeholder="F.eks Høstsemesteret" value={newChartName} onChange={e => setNewChartName(e.target.value)} autoFocus />
            </div>

            <div>
              <label className="text-xs font-bold uppercase opacity-50 text-slate-400 mb-1 block">Velg klasse</label>
              <select className="select select-bordered w-full bg-[#262b3a] border-slate-600 focus:border-emerald-500" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                {classes.length === 0 && <option value="" disabled>Ingen klasser funnet</option>}
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase opacity-50 text-slate-400 mb-1 block">Velg klasserom</label>
              <select className="select select-bordered w-full bg-[#262b3a] border-slate-600 focus:border-emerald-500" value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)}>
                {rooms.length === 0 && <option value="" disabled>Ingen rom funnet</option>}
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          <div className="modal-action mt-8">
            <form method="dialog">
              <button className="btn btn-ghost text-slate-400 hover:text-slate-100">Avbryt</button>
            </form>
            <button className="btn btn-primary font-bold px-8 shadow-lg shadow-emerald-900/50" onClick={handleCreate} disabled={!newChartName.trim() || !selectedClass || !selectedRoom}>
              Opprett & Rediger <i className="fa-solid fa-arrow-right ml-1"></i>
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

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
    } catch (e) {}
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
    } catch (e) {}
    setDeleteTarget(null);
  };

  return (
    <PageLayout title="Gruppearbeid" icon="fa-solid fa-people-group" onAdd={() => document.getElementById('modal_create_group')?.showModal()}>
      {assignments.length === 0 ? <p className="text-slate-400 text-sm italic col-span-full">Ingen gruppeinndelinger opprettet enda.</p> : null}

      {classes.map(cls => {
        const classAssignments = assignments.filter(a => a.class_id === cls.id).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        if (classAssignments.length === 0) return null;

        const latest = classAssignments[0];

        return (
          <Card
            key={cls.id}
            title={cls.name}
            infoList={[
              { icon: 'fa-solid fa-people-group', text: `Siste: ${latest.name}` },
              { icon: 'fa-solid fa-object-group', text: `${latest.group_count} grupper` },
              { icon: 'fa-solid fa-layer-group', text: `Historikk: ${classAssignments.length} inndelinger` }
            ]}
            icon="fa-solid fa-people-group"
            onClick={() => onEdit(latest.id)}
            onDelete={() => setDeleteTarget({ ...cls, isClassGroup: true, name: `Klasse ${cls.name}` })}
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
