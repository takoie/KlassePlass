import React, { useState, useEffect } from 'react';
import CreateGroupModal from './GroupWork/CreateGroupModal';
import { ExportModal, ImportModal } from './DataTransfer/ExportImportModal';
import { showToast } from '../shared/utils';
import Select from './Select';

// Navngitte aksentfarger per modul. Kortet får identitet fra denne ene fargen
// (ikonflis, hover-kant, pil-fyll, info-ikoner) i stedet for at alt tegnes i
// temaets primærfarge. Rå hex godtas også.
const CARD_ACCENTS = {
  emerald: '#34d399',
  violet: '#a78bfa',
  sky: '#38bdf8',
  indigo: '#818cf8',
  amber: '#fbbf24',
};

const hexToRgbTriplet = (hex) => {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

// Delt knappestil for de valgfrie `actions`-knappene (eksporter, dupliser,
// skriv ut). Ligger inne i Card sitt `group` og arver `--ca-rgb`.
export const cardActionBtnClass =
  'grid place-items-center w-7 h-7 rounded-md text-base-content/60 opacity-0 transition-colors ' +
  'hover:bg-[rgb(var(--ca-rgb)/0.16)] hover:text-[rgb(var(--ca-rgb))] group-hover:opacity-100 ' +
  'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[rgb(var(--ca-rgb)/0.6)]';

export const Card = ({ title, badgeText, accent = 'sky', infoList = [], icon, onClick, onDelete, actions }) => {
  const accentColor = CARD_ACCENTS[accent] || accent;
  const handleKeyDown = (e) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); }
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{ '--ca': accentColor, '--ca-rgb': hexToRgbTriplet(accentColor) }}
      className="group relative flex flex-col rounded-xl border border-base-content/10 bg-base-200 p-4
                 shadow-[0_1px_2px_rgba(0,0,0,0.28),0_12px_32px_-18px_rgba(0,0,0,0.6)]
                 cursor-pointer transition-[transform,border-color,box-shadow,background-color] duration-200 ease-out
                 hover:-translate-y-0.5 hover:border-[rgb(var(--ca-rgb)/0.45)] hover:bg-base-300
                 hover:shadow-[0_2px_4px_rgba(0,0,0,0.34),0_22px_48px_-20px_rgba(0,0,0,0.72)]
                 focus-visible:outline-none focus-visible:border-[rgb(var(--ca-rgb)/0.55)]
                 focus-visible:ring-2 focus-visible:ring-[rgb(var(--ca-rgb)/0.4)]"
    >
      <div className="flex items-start gap-3">
        <span className="grid place-items-center w-9 h-9 rounded-lg shrink-0 border transition-transform duration-200 group-hover:scale-105"
          style={{ backgroundColor: 'rgb(var(--ca-rgb)/0.13)', borderColor: 'rgb(var(--ca-rgb)/0.28)', color: 'var(--ca)' }}>
          <i className={`${icon} text-sm`}></i>
        </span>
        <div className="min-w-0 flex-1 pt-px">
          <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-base-content transition-colors group-hover:text-[rgb(var(--ca-rgb))]">
            {title}
          </h3>
          {badgeText && (
            <p className="mt-0.5 truncate text-[11px] font-medium text-[rgb(var(--ca-rgb)/0.8)]">{badgeText}</p>
          )}
        </div>
      </div>

      {infoList.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {infoList.map((info, i) => (
            <div key={i} className="flex items-center gap-2 min-w-0 text-[12.5px] leading-tight text-base-content/80">
              <i className={`${info.icon} w-4 shrink-0 text-center text-[11px] text-[rgb(var(--ca-rgb)/0.6)]`}></i>
              <span className="min-w-0 truncate">{info.text}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-[0.875rem]"></div>

      <div className="flex items-center justify-end gap-1.5 border-t border-base-content/10 pt-3">
        {actions}
        {onDelete && (
          <button
            className="grid place-items-center w-7 h-7 rounded-md text-base-content/60 opacity-70 transition-colors hover:bg-red-500/20 hover:text-red-300 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400/60"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Slett"
          >
            <i className="fa-solid fa-trash-can text-[11px]"></i>
          </button>
        )}
        <span className="grid place-items-center w-7 h-7 rounded-md ml-0.5 bg-base-content/5 text-base-content/60 transition-colors group-hover:bg-[rgb(var(--ca-rgb))] group-hover:text-primary-content">
          <i className="fa-solid fa-arrow-right text-[11px]"></i>
        </span>
      </div>
    </div>
  );
};

export const ConfirmDeleteModal = ({ isOpen, title, itemName, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <dialog className="modal modal-open backdrop-blur-sm">
      <div className="modal-box bg-surface-raised border border-base-300 text-base-content rounded-2xl">
        <h3 className="font-bold text-lg text-red-400 flex items-center gap-2">
          <i className="fa-solid fa-triangle-exclamation"></i> Slett {title}?
        </h3>
        <p className="py-4 text-sm text-base-content/80">
          Er du helt sikker på at du vil slette <strong>{itemName}</strong>? 
          <span className="block mt-2 text-red-400 font-bold">Dette vil fjerne ALLE data knyttet til dette elementet. Handlingen kan ikke angres!</span>
        </p>
        <div className="modal-action">
          <button className="btn btn-ghost text-base-content/60 hover:text-base-content" onClick={onCancel}>Avbryt</button>
          <button className="btn btn-error" onClick={onConfirm}>Ja, slett</button>
        </div>
      </div>
    </dialog>
  );
};

export const PageLayout = ({ title, icon, accent = 'emerald', onAdd, onImport, children }) => (
  <div className="h-full flex flex-col p-8 module-content-bg overflow-y-auto">
    <div className="max-w-6xl mx-auto w-full flex justify-between items-center mb-8 pb-4 border-b border-base-300">
      <div className="flex items-center gap-3">
        <i className={`${icon} text-2xl`} style={{ color: CARD_ACCENTS[accent] || accent }}></i>
        <h1 className="text-3xl font-extrabold text-base-content tracking-tight">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        {onImport && (
          <button className="btn btn-sm btn-outline border-base-300 text-base-content/80 hover:bg-base-200 gap-2" onClick={onImport}>
            <i className="fa-solid fa-file-import"></i> Importer
          </button>
        )}
        <button className="btn btn-sm bg-primary hover:bg-primary/90 text-slate-950 border-none font-bold gap-2 shadow-lg shadow-emerald-950/40" onClick={onAdd}>
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
      accent="emerald"
      onAdd={handleOpenCreate}
      onImport={() => document.getElementById('modal_import_class')?.showModal()}
    >
      {classes.length === 0 ? <p className="text-base-content/60 text-sm italic col-span-full">Ingen klasser opprettet enda.</p> : null}
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
            accent="emerald"
            infoList={[
              { icon: 'fa-solid fa-user-graduate', text: `${count} ${count === 1 ? 'elev' : 'elever'}` }
            ]}
            icon="fa-solid fa-users"
            onClick={() => onEdit(cls.id)}
            onDelete={() => setDeleteTarget(cls)}
            actions={
              <button
                className={cardActionBtnClass}
                onClick={(e) => { e.stopPropagation(); openExport(cls); }}
                title="Eksporter klasse"
              >
                <i className="fa-solid fa-file-export text-[11px]"></i>
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
        <div className="modal-box bg-surface-raised border border-base-300 text-base-content rounded-2xl">
          <h3 className="font-bold text-lg text-emerald-400 mb-6 flex items-center gap-2">
            <i className="fa-solid fa-users"></i> Opprett ny klasse
          </h3>

          <div>
            <label className="text-xs font-bold uppercase opacity-50 text-base-content/60 mb-1 block">Klassenavn</label>
            <input
              type="text"
              className="input input-bordered w-full bg-surface-field border-base-300 focus:border-emerald-500"
              value={newClassName}
              onChange={e => setNewClassName(e.target.value)}
              placeholder="F.eks. 8A"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
            />
          </div>

          <div className="modal-action mt-8">
            <form method="dialog">
              <button className="btn btn-ghost text-base-content/60 hover:text-base-content">Avbryt</button>
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

// "Rom A" -> "Rom A (kopi)", så "(kopi 2)", "(kopi 3)" … En eksisterende
// "(kopi)"-hale strippes først så man ikke får "(kopi) (kopi)".
const suggestCopyName = (base, existing) => {
  const taken = new Set((existing || []).map(r => r.name));
  const root = (base || 'Rom').replace(/\s*\(kopi(?:\s+\d+)?\)\s*$/i, '').trim() || 'Rom';
  let candidate = `${root} (kopi)`;
  let n = 2;
  while (taken.has(candidate)) { candidate = `${root} (kopi ${n})`; n += 1; }
  return candidate;
};

export const RoomsOverview = ({ onEdit, onAdd }) => {
  const [rooms, setRooms] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [exportTarget, setExportTarget] = useState(null); // { id, name } | null
  const [duplicateTarget, setDuplicateTarget] = useState(null); // rom som skal dupliseres
  const [dupName, setDupName] = useState('');

  const openExport = (room) => {
    setExportTarget(room);
    document.getElementById('modal_export_room')?.showModal();
  };

  const openDuplicate = (room) => {
    setDuplicateTarget(room);
    setDupName(suggestCopyName(room.name, rooms));
    document.getElementById('modal_duplicate_room')?.showModal();
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

  const handleConfirmDuplicate = async () => {
    if (!duplicateTarget) return;
    const name = dupName.trim();
    if (!name) return;
    if (rooms.some(r => r.name === name)) {
      showToast('Det finnes allerede et rom med dette navnet.', 'error');
      return;
    }
    try {
      await window.api.saveRoom({
        id: null,
        name,
        // Rå layout-streng kopieres uendret — bord og tavle blir identiske.
        layoutData: duplicateTarget.layout_data || '{}'
      });
      document.getElementById('modal_duplicate_room')?.close();
      setDuplicateTarget(null);
      await loadRooms();
      showToast(`Rommet ble duplisert som «${name}».`, 'success');
    } catch (e) {
      showToast('Kunne ikke duplisere rommet.', 'error');
    }
  };

  return (
    <PageLayout
      title="Mine rom"
      icon="fa-solid fa-school"
      accent="violet"
      onAdd={onAdd}
      onImport={() => document.getElementById('modal_import_room')?.showModal()}
    >
      {rooms.length === 0 ? <p className="text-base-content/60 text-sm italic col-span-full">Ingen rom opprettet enda.</p> : null}
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
            accent="violet"
            infoList={[
              { icon: 'fa-solid fa-chair', text: `${seatCount} ${seatCount === 1 ? 'plass' : 'plasser'}` }
            ]}
            icon="fa-solid fa-school"
            onClick={() => onEdit(rm.id)}
            onDelete={() => setDeleteTarget(rm)}
            actions={
              <>
                <button
                  className={cardActionBtnClass}
                  onClick={(e) => { e.stopPropagation(); openDuplicate(rm); }}
                  title="Dupliser rom"
                >
                  <i className="fa-solid fa-copy text-[11px]"></i>
                </button>
                <button
                  className={cardActionBtnClass}
                  onClick={(e) => { e.stopPropagation(); openExport(rm); }}
                  title="Eksporter rom"
                >
                  <i className="fa-solid fa-file-export text-[11px]"></i>
                </button>
              </>
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

      <dialog id="modal_duplicate_room" className="modal modal-bottom sm:modal-middle backdrop-blur-sm">
        <div className="modal-box bg-surface-raised border border-base-300 text-base-content rounded-2xl">
          <h3 className="font-bold text-lg text-purple-400 mb-6 flex items-center gap-2">
            <i className="fa-solid fa-copy"></i> Dupliser rom
          </h3>

          <p className="text-sm text-base-content/60 mb-4">
            Lager et nytt rom med en kopi av bord- og tavleoppsettet fra
            {' '}<strong className="text-base-content">{duplicateTarget?.name}</strong>.
            Originalrommet og klassekartene som bruker det påvirkes ikke.
          </p>

          <div>
            <label className="text-xs font-bold uppercase opacity-50 text-base-content/60 mb-1 block">Navn på det nye rommet</label>
            <input
              type="text"
              className="input input-bordered w-full bg-surface-field border-base-300 focus:border-purple-500"
              value={dupName}
              onChange={e => setDupName(e.target.value)}
              placeholder="F.eks. Naturfagrom (kopi)"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleConfirmDuplicate(); } }}
            />
          </div>

          <div className="modal-action mt-8">
            <form method="dialog">
              <button className="btn btn-ghost text-base-content/60 hover:text-base-content" onClick={() => setDuplicateTarget(null)}>Avbryt</button>
            </form>
            <button
              className="btn bg-purple-600 hover:bg-purple-500 text-base-content border-none font-bold px-8 shadow-lg shadow-purple-900/50 disabled:opacity-40"
              onClick={handleConfirmDuplicate}
              disabled={!dupName.trim()}
            >
              Dupliser rom
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setDuplicateTarget(null)}>close</button>
        </form>
      </dialog>

      <ExportModal
        modalId="modal_export_room"
        source={{ class: null, room: exportTarget, seating: null }}
        suggestedName={`${exportTarget?.name || 'rom'}.klasseplass`}
      />
      <ImportModal modalId="modal_import_room" onImported={() => loadRooms()} />
    </PageLayout>
  );
};

// Gruppenøkkel for en klassekart-periode. Speiler HeaderBar.jsx og
// useSeatings.js: etter v12-backfyllingen har hver rad en ikke-tom chart_group;
// class-fallbacken dekker importerte/eldre rader, og s{id}-fallbacken holder
// rader helt uten klasse adskilt (ellers ville de smeltet sammen til ett kort).
const groupKey = (s) => s.chart_group || (s.class_id != null ? `c${s.class_id}` : `s${s.id}`);

// Slår periode-radene sammen til ett objekt per klassekart. `newest` (nyeste
// created_at) representerer kortet: navn, klasse, rom og elevtall leses derfra,
// og klikk på kortet åpner den perioden.
const buildCharts = (rows) => {
  const byGroup = new Map();
  for (const s of rows) {
    const key = groupKey(s);
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(s);
  }
  return Array.from(byGroup.entries()).map(([key, periods]) => {
    const sorted = periods.slice().sort(
      (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );
    return { groupKey: key, periods: sorted, newest: sorted[0], periodCount: sorted.length };
  });
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
      if (deleteTarget.isChartGroup) {
        // Ett kort = ett helt klassekart. Slett alle periode-radene som deler
        // gruppenøkkel (chart_group), samme mønster som enkeltsletting under.
        const groupSeatings = seatings.filter(s => groupKey(s) === deleteTarget.groupKey);
        for (const s of groupSeatings) {
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

  // Ett kort per klassekart (chart_group), ikke ett per periode-rad.
  const charts = buildCharts(seatings);

  const renderChartCard = (chart) => {
    const seating = chart.newest;
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
    const hasValidRoom = !!(seating.room_id && rooms.some(r => r.id === seating.room_id));
    const roomName = seating.room_name || rooms.find(r => r.id === seating.room_id)?.name || (hasValidRoom ? '—' : 'Mangler rom');
    const periodWord = chart.periodCount === 1 ? 'periode' : 'perioder';
    const periodLabel = `${chart.periodCount} ${periodWord} · ${seating.comment || 'ingen periode angitt'}`;

    return (
      <Card
        key={chart.groupKey}
        title={seating.name}
        badgeText={cls?.name || seating.class_name || '—'}
        accent="sky"
        infoList={[
          { icon: 'fa-solid fa-calendar-week', text: periodLabel },
          { icon: hasValidRoom ? 'fa-solid fa-school' : 'fa-solid fa-triangle-exclamation text-amber-400', text: roomName },
          { icon: 'fa-solid fa-users', text: `${studentCount} ${studentCount === 1 ? 'elev' : 'elever'}` }
        ]}
        icon="fa-solid fa-users-rectangle"
        onClick={() => onEdit(seating.id)}
        onDelete={() => setDeleteTarget({ isChartGroup: true, groupKey: chart.groupKey, name: seating.name, periodCount: chart.periodCount })}
        actions={
          <>
             <button className={cardActionBtnClass} onClick={handlePrint} title="Skriv ut / PDF"><i className="fa-solid fa-print text-[11px]"></i></button>
             <button className={cardActionBtnClass} onClick={(e) => { e.stopPropagation(); openExport(seating); }} title="Eksporter kart"><i className="fa-solid fa-file-export text-[11px]"></i></button>
          </>
        }
      />
    );
  };

  return (
    <PageLayout
      title="Mine klassekart"
      icon="fa-solid fa-users-rectangle"
      accent="sky"
      onAdd={handleOpenCreate}
      onImport={() => document.getElementById('modal_import_seating')?.showModal()}
    >
      {charts.length === 0 ? <p className="text-base-content/60 text-sm italic col-span-full">Ingen klassekart opprettet enda.</p> : null}

      {charts.length > 0 && (
        <div className="col-span-full flex justify-end -mb-1">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-base-content/60 select-none">
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
          .filter(cls => charts.some(ch => ch.newest.class_id === cls.id))
          .sort((a, b) => a.name.localeCompare(b.name, 'nb'))
          .map(cls => {
            const classCharts = charts
              .filter(ch => ch.newest.class_id === cls.id)
              .sort((a, b) => (a.newest.name || '').localeCompare(b.newest.name || '', 'nb'));

            return (
              <div key={cls.id} className="col-span-full collapse collapse-arrow bg-base-100/40 border border-base-content/10 rounded-2xl">
                <input type="checkbox" defaultChecked />
                <div className="collapse-title font-bold text-base-content flex items-center gap-2">
                  <i className="fa-solid fa-users text-emerald-400"></i>
                  {cls.name}
                  <span className="text-xs font-normal text-base-content/60">({classCharts.length} klassekart)</span>
                </div>
                <div className="collapse-content">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
                    {classCharts.map(ch => renderChartCard(ch))}
                  </div>
                </div>
              </div>
            );
          })
      ) : (
        charts
          .slice()
          .sort((a, b) => new Date(b.newest.created_at || 0) - new Date(a.newest.created_at || 0))
          .map(ch => renderChartCard(ch))
      )}

      <ConfirmDeleteModal 
        isOpen={!!deleteTarget}
        title="klassekart"
        itemName={deleteTarget?.isChartGroup && deleteTarget.periodCount > 1
          ? `${deleteTarget.name} (${deleteTarget.periodCount} perioder)`
          : deleteTarget?.name}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <dialog id="modal_create_seating" className="modal modal-bottom sm:modal-middle backdrop-blur-sm">
        <div className="modal-box bg-surface-raised border border-base-300 text-base-content rounded-2xl">
          <h3 className="font-bold text-lg text-emerald-400 mb-6 flex items-center gap-2">
            <i className="fa-solid fa-map-location-dot"></i> Opprett nytt klassekart
          </h3>
          
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold uppercase opacity-50 text-base-content/60 mb-1 block">Navn på klassekartet</label>
              <input
                type="text"
                className="input input-bordered w-full bg-surface-field border-base-300 focus:border-emerald-500"
                value={chartName}
                onChange={e => setChartName(e.target.value)}
                placeholder="Skriv inn navn på klassekart.. Eksempel: Naturfag 1ST3"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase opacity-50 text-base-content/60 mb-1 block">Velg klasse</label>
                <Select
                  size="sm"
                  className="w-full"
                  ariaLabel="Velg klasse"
                  placeholder="Velg klasse …"
                  value={selectedClass}
                  onChange={setSelectedClass}
                  options={classes.length
                    ? classes.map(c => ({ value: c.id, label: c.name }))
                    : [{ value: '', label: 'Ingen klasser funnet', disabled: true }]}
                />
                {selectedClass && (
                  <p className="text-[11px] text-base-content/60 mt-1 flex items-center gap-1.5">
                    <i className="fa-solid fa-users w-3 text-emerald-400"></i> {modalStudentCount} elever
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold uppercase opacity-50 text-base-content/60 mb-1 block">Velg klasserom</label>
                <Select
                  size="sm"
                  className="w-full"
                  ariaLabel="Velg klasserom"
                  placeholder="Velg rom …"
                  value={selectedRoom}
                  onChange={setSelectedRoom}
                  options={rooms.length
                    ? rooms.map(r => ({ value: r.id, label: r.name }))
                    : [{ value: '', label: 'Ingen rom funnet', disabled: true }]}
                />
                {selectedRoom && (
                  <p className="text-[11px] text-base-content/60 mt-1 flex items-center gap-1.5">
                    <i className="fa-solid fa-chair w-3 text-purple-400"></i> {modalSeatCount} elevplasser
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase opacity-50 text-base-content/60 mb-1 block">Første periode</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-base-content/60">Uke</span>
                <input
                  type="number" min="1" max="52"
                  className="input input-bordered w-20 bg-surface-field border-base-300 focus:border-emerald-500 text-center"
                  value={startWeek}
                  onChange={e => setStartWeek(e.target.value)}
                />
                <span className="text-xs text-base-content/60">i</span>
                <input
                  type="number" min="1" max="52"
                  className="input input-bordered w-20 bg-surface-field border-base-300 focus:border-emerald-500 text-center"
                  value={periodWeeks}
                  onChange={e => setPeriodWeeks(e.target.value)}
                />
                <span className="text-xs text-base-content/60">uker</span>
              </div>
            </div>
          </div>

          <div className="modal-action mt-8">
            <form method="dialog">
              <button className="btn btn-ghost text-base-content/60 hover:text-base-content">Avbryt</button>
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
    <PageLayout title="Gruppearbeid" icon="fa-solid fa-people-group" accent="indigo" onAdd={() => document.getElementById('modal_create_group')?.showModal()}>
      {assignments.length === 0 ? <p className="text-base-content/60 text-sm italic col-span-full">Ingen gruppeinndelinger opprettet enda.</p> : null}

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
            accent="indigo"
            infoList={[
              { icon: 'fa-solid fa-object-group', text: `${latest.group_count} grupper` },
              { icon: 'fa-solid fa-layer-group', text: `Historikk: ${classAssignments.length} inndelinger` }
            ]}
            icon="fa-solid fa-people-group"
            onClick={() => onEdit(latest.id)}
            onDelete={() => setDeleteTarget({ ...cls, isClassGroup: true, name: `Klasse ${cls.name}` })}
            actions={
              <button className={cardActionBtnClass} onClick={handlePrint} title="Skriv ut / PDF">
                <i className="fa-solid fa-print text-[11px]"></i>
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
