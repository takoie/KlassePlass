import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { lightenHex } from '../shared/utils';
import PrintPreviewModal from './Print/PrintPreviewModal';
import Modals from './SeatingChart/Modals';
import DeskContextMenu from './SeatingChart/DeskContextMenu';
import HeaderBar from './SeatingChart/HeaderBar';
import Toolbar from './SeatingChart/Toolbar';
import StudentDrawer from './SeatingChart/StudentDrawer';
import { HoverTip } from './HoverTip';
import { useCanvasFit } from './SeatingChart/hooks/useCanvasFit';
import { useFunModes } from './SeatingChart/hooks/useFunModes';
import { evaluateRules } from '../lib/seatingSolver.mjs';
import { useGroupLasso } from './SeatingChart/hooks/useGroupLasso';
import { useStudentDragAndDrop } from './SeatingChart/hooks/useStudentDragAndDrop';
import { useSeatings } from './SeatingChart/hooks/useSeatings';
import { useSeatingUndo } from './SeatingChart/hooks/useSeatingUndo';
import { getDeskLayout } from './SeatingChart/deskLayout';

// Makkergruppe-fargene 1-12 (se [1..12]-gridet i DeskContextMenu.jsx/
// Toolbar.jsx). Brukerspesifisert palett (kategorisk, D3/Tableau-aktig) valgt
// for tydelig innbyrdes forskjell mellom alle 12 - se SeatingChartPrintContent.jsx
// for hvorfor dette er ekstra viktig på papir (bordene der markeres KUN med en
// tynn kantfarge, ingen tall/etikett attåt).
const GROUP_COLORS = [
  '#1F77B4', '#FF7F0E', '#2CA02C', '#D62728',
  '#9467BD', '#C9A227', '#E377C2', '#17BECF',
  '#D6336C', '#0D9488', '#6366F1', '#F2994A'
];

const getFontSizeClass = (name) => {
  if (!name) return 'text-sm font-extrabold';
  const len = name.length;
  if (len > 20) return 'text-[10px] font-bold leading-tight';
  if (len > 15) return 'text-[11px] font-bold leading-tight';
  if (len > 10) return 'text-xs font-bold leading-tight';
  return 'text-sm font-extrabold';
};

export default function SeatingChart({ onBack, initialId }) {
  const [desks, setDesks] = useState([]);
  const [boardObj, setBoardObj] = useState({ x: 422, y: 15 });
  const [ruleBannerHidden, setRuleBannerHidden] = useState(false);

  // UI State
  const [isProjectorMode, setIsProjectorMode] = useState(false);
  const [projectorZoom, setProjectorZoom] = useState(1);
  const [projectorPan, setProjectorPan] = useState({ x: 0, y: 0 });
  const [isProjectorPanning, setIsProjectorPanning] = useState(false);
  const projectorPanLastPosRef = useRef({ x: 0, y: 0 });
  const [hideSensitiveInfo, setHideSensitiveInfo] = useState(false);
  // Bordnummer (setenummerering): default AV, men valget huskes på tvers av økter.
  const [showNumbers, setShowNumbers] = useState(() => {
    try { return localStorage.getItem('seatingChart_showNumbers') === 'true'; } catch (e) { return false; }
  });
  const [showZones, setShowZones] = useState(false);
  const [hideGroups, setHideGroups] = useState(false);
  const [showGroupNumbers, setShowGroupNumbers] = useState(false);
  const [removeStudentsMode, setRemoveStudentsMode] = useState(false);
  const [colorSeatsByGroup, setColorSeatsByGroup] = useState(true);
  const [hideEmptyDesks, setHideEmptyDesks] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showStudentDrawer, setShowStudentDrawer] = useState(false);
  const [showPeriodsDrawer, setShowPeriodsDrawer] = useState(false);
  const [editingNoteStudent, setEditingNoteStudent] = useState(null);
  const [noteInputValue, setNoteInputValue] = useState('');
  const [contextMenu, setContextMenu] = useState(null);

  const [showGroupDrawer, setShowGroupDrawer] = useState(false);

  // Fun Mode state
  const [showFunDrawer, setShowFunDrawer] = useState(false);

  const fileInputRef = useRef(null);

  const { scale, offset, containerRef, canvasRef } = useCanvasFit();

  // "Fjern elever"-lassoen trenger handleUnseatMultiple, som igjen trenger
  // placements/lockedSeats/setUnplacedStudents fra useSeatings(...) under -
  // men useSeatings(...) trenger selv groupOverrides/setGroupOverrides FRA
  // useGroupLasso(...), så de to hookene kan ikke enkelt bytte rekkefølge
  // (sirkulær avhengighet). Løsning: en stabil ref-wrapper som fylles inn
  // med den ferske handle-funksjonen etter at useSeatings(...) har kjørt
  // lenger ned, men som allerede kan sendes inn til useGroupLasso(...) her.
  const onRemoveInBoxRef = useRef(() => {});

  const {
    groupOverrides, setGroupOverrides,
    activeGroupId, setActiveGroupId,
    lasso, startCanvasAction,
    handleMouseMove: handleLassoMouseMove,
    handleMouseUp: handleLassoMouseUp
  } = useGroupLasso({
    desks, canvasRef, scale,
    removeMode: removeStudentsMode,
    onRemoveInBox: (deskIds) => onRemoveInBoxRef.current(deskIds)
  });

  const toggleRemoveStudentsMode = () => {
    setRemoveStudentsMode(prev => {
      const next = !prev;
      if (next) setActiveGroupId(null);
      return next;
    });
  };

  const setActiveGroupIdExclusive = (updater) => {
    setActiveGroupId(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next !== null) setRemoveStudentsMode(false);
      return next;
    });
  };

  const {
    classes, rooms, seatings,
    selectedClass, selectedRoom, selectedSeatingId,
    chartName, setChartName, chartComment, setChartComment, saveState,
    placements, setPlacements, lockedSeats, setLockedSeats,
    unusedSeats, setUnusedSeats, toggleSeatUnused, restoreDeskSeats,
    studentRoles, setStudentRoles, studentNotes, setStudentNotes, classRules,
    allStudents, unplacedStudents, setUnplacedStudents,
    showHistory, setShowHistory, historyConflicts,
    editingPeriod, setEditingPeriod, newPeriodWeeks, setNewPeriodWeeks,
    getStudentByIdOrName, getRecentPartners,
    handleSelectSeating, handleStartNewPeriod, handleSaveEditedPeriod, handleDelete,
    flipRoom, syncFromRoom,
    canvasLight, toggleCanvasLight,
    chartGroup, splitToNewChart, chartPeriodCount
  } = useSeatings({ initialId, desks, setDesks, boardObj, setBoardObj, groupOverrides, setGroupOverrides, onBack });

  // Regel-tilbakemelding: hvor mange av klassens regler den gjeldende
  // plasseringen oppfyller. Beregnes reaktivt, så den dekker alle kilder
  // (Plasser alle, Randomiser, fun modes, manuell dra, angre/gjør-om).
  const ruleReport = useMemo(
    () => evaluateRules(placements, classRules, desks, allStudents),
    [placements, classRules, desks, allStudents]
  );
  // Enhver endring i plasseringene viser stripa igjen selv om den ble lukket.
  useEffect(() => { setRuleBannerHidden(false); }, [placements]);

  // Når klassekartet kun har én periode er den perioden reelt sett HELE kartet -
  // "Slett periode" ville da vært misvisende (antyder at kartet lever videre med
  // andre perioder), så knappen/dialogen kaller det "Slett kart" i stedet.
  const isOnlyPeriod = chartPeriodCount <= 1;

  // Angre/gjør-om for elevplasseringer m.m. mens editoren er åpen på denne
  // perioden. Bytte periode nullstiller loggen (se hooken).
  const {
    undo, redo, restoreToOpen, canUndo, canRedo, canRestoreToOpen, undoDepth,
  } = useSeatingUndo({
    selectedSeatingId,
    placements, setPlacements,
    lockedSeats, setLockedSeats,
    unusedSeats, setUnusedSeats,
    groupOverrides, setGroupOverrides,
    allStudents, setUnplacedStudents,
  });

  const openRestoreToOpenModal = () => {
    if (canRestoreToOpen) document.getElementById('modal_restore_open')?.showModal();
  };

  // Ctrl/Cmd+Z = angre, Ctrl+Shift+Z / Ctrl+Y = gjør om. Ignoreres når
  // markøren står i et skrivefelt (navn/notat-modaler o.l.).
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const wantRedo = key === 'y' || (key === 'z' && e.shiftKey);
      e.preventDefault();
      if (wantRedo) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // Speiler isProjectorMode mot native OS-fullskjerm. Kjøres KUN på faktisk
  // endring (ikke som cleanup+body-par), for å unngå to overlappende
  // setFullscreen-kall til WebView2 når man går ut av prosjektorvisning
  // (root cause for at "Avslutt"-knappen sluttet å svare - se
  // docs/plans/2026-08-20-fullskjerm-avslutt-fiks.md).
  useEffect(() => {
    window.api?.setFullscreen?.(isProjectorMode)
      .catch((err) => console.error('setFullscreen feilet:', err));
    window.dispatchEvent(new CustomEvent('toggle-projector', { detail: isProjectorMode }));
  }, [isProjectorMode]);

  // Sikkerhetsnett: hvis komponenten unmountes mens prosjektorvisning er
  // aktiv (f.eks. bytte av klassekart), sørg for at vinduet faktisk går ut
  // av native fullskjerm. Tom dep-array = kjører kun ved ekte unmount, ikke
  // ved hver isProjectorMode-endring.
  useEffect(() => {
    return () => {
      window.api?.setFullscreen?.(false)
        .catch((err) => console.error('setFullscreen cleanup feilet:', err));
      window.dispatchEvent(new CustomEvent('toggle-projector', { detail: false }));
    };
  }, []);

  // Start alltid med full oversikt hver gang prosjektorvisningen åpnes, uansett
  // hvilken zoom/pan-posisjon som var aktiv sist gang den var åpen.
  useEffect(() => {
    if (isProjectorMode) {
      setProjectorZoom(1);
      setProjectorPan({ x: 0, y: 0 });
    }
  }, [isProjectorMode]);

  // Fallback dersom "Avslutt"-knappen av en eller annen grunn ikke fanger
  // klikket (fokus-kant-tilfeller rundt native fullskjerm-overganger).
  useEffect(() => {
    if (!isProjectorMode) return;
    const handler = (e) => {
      if (e.key === 'Escape') setIsProjectorMode(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isProjectorMode]);

  const PROJECTOR_ZOOM_MIN = 1;
  const PROJECTOR_ZOOM_MAX = 4;

  const handleProjectorWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setProjectorZoom(z => Math.min(PROJECTOR_ZOOM_MAX, Math.max(PROJECTOR_ZOOM_MIN, z + delta)));
  };

  const handleProjectorZoomButton = (delta) => {
    setProjectorZoom(z => Math.min(PROJECTOR_ZOOM_MAX, Math.max(PROJECTOR_ZOOM_MIN, z + delta)));
  };

  const handleProjectorZoomReset = () => {
    setProjectorZoom(1);
    setProjectorPan({ x: 0, y: 0 });
  };

  const handleProjectorPanStart = (e) => {
    if (projectorZoom <= PROJECTOR_ZOOM_MIN) return;
    setIsProjectorPanning(true);
    projectorPanLastPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleProjectorPanMove = (e) => {
    if (!isProjectorPanning) return;
    const last = projectorPanLastPosRef.current;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    projectorPanLastPosRef.current = { x: e.clientX, y: e.clientY };
    setProjectorPan(p => ({ x: p.x + dx, y: p.y + dy }));
  };

  const handleProjectorPanEnd = () => {
    setIsProjectorPanning(false);
  };

  useEffect(() => {
    if (localStorage.getItem('print_on_mount') === 'true') {
      localStorage.removeItem('print_on_mount');
      setTimeout(() => handlePrint(), 1000);
    }
  }, []);

  // Husk siste valg for setenummerering (samme mønster som andre visningsinnstillinger).
  useEffect(() => {
    try { localStorage.setItem('seatingChart_showNumbers', String(showNumbers)); } catch (e) {}
  }, [showNumbers]);


  const handleDeskContextMenu = (e, desk, student = null, slotKey = null) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, desk, student, slotKey });
  };

  const {
    draggedStudent, hoverSlotKey, overDrawer, startDrag,
  } = useStudentDragAndDrop({
    canvasRef, scale, desks, placements, setPlacements,
    unplacedStudents, setUnplacedStudents, getStudentByIdOrName,
    unusedSeats, setUnusedSeats
  });

  // Sant når det som dras er en elev hentet FRA et sete, pekeren er over
  // "ingenting" (verken et sete eller skuffen), og draget har flyttet seg nok
  // til at et slipp nå ville fjerne eleven fra kartet. Styrer den røde
  // "Fjern"-varianten av drag-boksen.
  const willRemoveOnDrop = !!draggedStudent?.fromSlotKey && !hoverSlotKey && !overDrawer &&
    (draggedStudent.startClientX == null ||
      Math.hypot(draggedStudent.pointerX - draggedStudent.startClientX, draggedStudent.pointerY - draggedStudent.startClientY) > 20);

  // Elevdrag (flytt/hover/slipp) håndteres av vindus-lyttere i
  // useStudentDragAndDrop – lerret-handlerne her tar seg kun av lasso, slik at
  // draget ikke dobbelt-prosesseres eller avbrytes når pekeren forlater lerretet.
  const handleMouseMove = (e) => {
    handleLassoMouseMove(e);
  };

  const handleMouseUp = () => {
    handleLassoMouseUp();
  };

  const handleCanvasMouseLeave = () => {
    handleLassoMouseUp();
  };


  const {
    activeFunMode, funModeGhosts, bombCountdown, bombBoom, spotlightSlotKey,
    revealMode, revealOrder, revealedSlots,
    handleAutoFill, handleRuleBasedFunSpin,
    startRoulette, stopRoulette,
    startRandombomb, cancelRandombomb,
    startMusikkstoler, startMakkerbytte,
    startSpotlight, dismissSpotlight,
    startReveal, revealNext, revealAll, endReveal
  } = useFunModes({
    desks, boardObj, placements, setPlacements, lockedSeats, unusedSeats, hideEmptyDesks,
    allStudents, unplacedStudents, setUnplacedStudents, classRules,
    groupOverrides, getStudentByIdOrName
  });

  const toggleLockDesk = (deskId) => {
    const desk = desks.find(d => d.id === deskId);
    if (!desk) return;
    const cap = desk.capacity || 1;
    setLockedSeats(prev => {
      const next = { ...prev };
      const isLocked = !!next[`${deskId}_seat_0`];
      for (let i = 0; i < cap; i++) {
        next[`${deskId}_seat_${i}`] = !isLocked;
      }
      return next;
    });
  };

  // Låser/åpner KUN den ene setet en elev sitter i - til forskjell fra
  // toggleLockDesk over, som låser/åpner alle seter ved bordet samlet.
  const toggleLockStudent = (slotKey) => {
    if (!slotKey) return;
    setLockedSeats(prev => ({ ...prev, [slotKey]: !prev[slotKey] }));
  };

  const handleUnseatStudent = (slotKey, studentObj) => {
    if (!slotKey) return;
    setPlacements(prev => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
    setLockedSeats(prev => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
    if (studentObj) {
      setUnplacedStudents(prev => {
        if (!prev.some(s => s.id === studentObj.id)) return [...prev, studentObj];
        return prev;
      });
    }
  };

  // Batchet variant av handleUnseatStudent over — brukes av "Fjern elever"-
  // lassoen for å fjerne flere elever i én operasjon (én state-oppdatering
  // per state-variabel, ikke én per elev).
  const handleUnseatMultiple = (slotKeys) => {
    if (!slotKeys || slotKeys.length === 0) return;
    const removedStudents = slotKeys
      .map(sk => placements[sk])
      .filter(Boolean)
      .map(idOrName => getStudentByIdOrName(idOrName))
      .filter(Boolean);
    setPlacements(prev => {
      const next = { ...prev };
      slotKeys.forEach(sk => delete next[sk]);
      return next;
    });
    setLockedSeats(prev => {
      const next = { ...prev };
      slotKeys.forEach(sk => delete next[sk]);
      return next;
    });
    if (removedStudents.length > 0) {
      setUnplacedStudents(prev => {
        const existingIds = new Set(prev.map(s => s.id));
        const toAdd = removedStudents.filter(s => !existingIds.has(s.id));
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
    }
  };

  // Holder useGroupLasso sin onRemoveInBox-callback fersk hver render (se
  // kommentar ved onRemoveInBoxRef over) - regner ut hvilke sete-nøkler
  // (låste seter hoppes over) som skal fjernes for bordene lassoen traff.
  onRemoveInBoxRef.current = (deskIds) => {
    const slotKeys = [];
    deskIds.forEach(deskId => {
      const desk = desks.find(d => d.id === deskId);
      if (!desk) return;
      const cap = desk.capacity || 1;
      for (let i = 0; i < cap; i++) {
        const slotKey = `${deskId}_seat_${i}`;
        if (placements[slotKey] && !lockedSeats[slotKey]) {
          slotKeys.push(slotKey);
        }
      }
    });
    handleUnseatMultiple(slotKeys);
  };

  const openNoteModal = (studentObj) => {
    setEditingNoteStudent(studentObj);
    setNoteInputValue(studentNotes[studentObj.id] || '');
    const m = document.getElementById('modal_student_note');
    if (m) m.showModal();
  };

  const saveStudentNote = () => {
    if (!editingNoteStudent) return;
    setStudentNotes(prev => ({ ...prev, [editingNoteStudent.id]: noteInputValue.trim() }));
    const m = document.getElementById('modal_student_note');
    if (m) m.close();
  };


  const handleSetGroupContextMenu = (groupId) => {
    if (contextMenu?.desk) {
      const newOverrides = { ...groupOverrides };
      if (groupId === null) {
        delete newOverrides[contextMenu.desk.id];
      } else {
        newOverrides[contextMenu.desk.id] = groupId;
      }
      setGroupOverrides(newOverrides);
    }
    setContextMenu(null);
  };

  const handlePrint = () => {
    setShowPrintPreview(true);
    if (new URLSearchParams(window.location.search).has('print_on_mount')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  // Autonummerering: Teller konsekvent basert på tavlas plassering (lærerperspektiv)
  const isBoardAtTop = (boardObj?.y || 25) < 350;

  const sortedDesks = [...desks].sort((a, b) => {
    const yDiff = a.y - b.y;
    
    if (isBoardAtTop) {
      if (Math.abs(yDiff) > 35) return yDiff;
      return a.x - b.x;
    } else {
      // Tavla er i bunnen, rad 1 er nederst. Teller fra høyre mot venstre (lærerens venstre)
      if (Math.abs(yDiff) > 35) return -yDiff;
      return b.x - a.x;
    }
  });

  // Numrene følger seteplasser, ikke bord — et 2-seters bord opptar to numre,
  // ett per sete, slik at neste bord fortsetter fra riktig sete-nummer, ikke bord-nummer.
  const deskNumberMap = {};
  let seatCounter = 0;
  sortedDesks.forEach((d) => {
    const cap = d.capacity || 1;
    const nums = new Array(cap);
    // Bord som er helt skjult (tomme + "Skjul tomme bord" på) skal heller ikke
    // "bruke opp" plassnumre de aldri viser - samme resonnement som ubrukte seter.
    const isFullyEmptyDesk = hideEmptyDesks &&
      Array.from({ length: cap }, (_, s) => placements[`${d.id}_seat_${s}`]).every(val => !val);
    // Når tavla er i bunnen telles bordene fra høyre mot venstre (se sorteringen
    // over), så setene INNI hvert bord må også telles fra høyre mot venstre —
    // ellers får det synlig venstre setet lavest nummer uansett, og nummerering
    // stemmer ikke med hvilken side som faktisk er nærmest tavla.
    for (let i = 0; i < cap; i++) {
      const slotIdx = isBoardAtTop ? i : (cap - 1 - i);
      // Ubrukte seter og skjulte tomme bord hopper HELT over tellingen (ikke bare
      // "vises ikke") slik at resten av plassene forblir sammenhengende (1,2,3...).
      if (isFullyEmptyDesk || unusedSeats[`${d.id}_seat_${slotIdx}`]) continue;
      seatCounter += 1;
      nums[slotIdx] = seatCounter;
    }
    deskNumberMap[d.id] = nums;
  });

  const zoneMeta = {
    window: { label: 'Vindurekke', icon: 'fa-solid fa-sun text-yellow-400', badgeClass: 'border-yellow-500/40 text-yellow-300 bg-yellow-950/80', printColor: '#a16207' },
    door: { label: 'Dørsone', icon: 'fa-solid fa-door-open text-amber-400', badgeClass: 'border-amber-500/40 text-amber-300 bg-amber-950/80', printColor: '#b45309' },
    front: { label: 'Fremste rad', icon: 'fa-solid fa-location-dot text-emerald-400', badgeClass: 'border-emerald-500/40 text-emerald-300 bg-emerald-950/80', printColor: '#047857' },
    back: { label: 'Bakerste rad', icon: 'fa-solid fa-arrow-down text-purple-400', badgeClass: 'border-purple-500/40 text-purple-300 bg-purple-950/80', printColor: '#7e22ce' },
    center: { label: 'Midtsone', icon: 'fa-solid fa-align-center text-cyan-400', badgeClass: 'border-cyan-500/40 text-cyan-300 bg-cyan-950/80', printColor: '#0e7490' }
  };

  return (
    <div className="flex flex-col h-full w-full bg-base-300 overflow-hidden relative">
      {/* Top Header Bar - Unifisert med RoomEditor */}
      {!isProjectorMode && (
        <HeaderBar
          onBack={onBack}
          classes={classes}
          rooms={rooms} selectedRoom={selectedRoom}
          seatings={seatings} selectedSeatingId={selectedSeatingId} handleSelectSeating={handleSelectSeating}
          chartGroup={chartGroup}
          setEditingPeriod={setEditingPeriod}
          saveState={saveState} handlePrint={handlePrint}
          isOnlyPeriod={isOnlyPeriod}
          onUndo={undo} onRedo={redo} onRestoreToOpen={openRestoreToOpenModal}
          canUndo={canUndo} canRedo={canRedo} canRestoreToOpen={canRestoreToOpen}
          undoDepth={undoDepth}
        />
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* 1. ToolBox Sidebar */}
        {!isProjectorMode && (
          <Toolbar
            unplacedStudents={unplacedStudents}
            showStudentDrawer={showStudentDrawer} setShowStudentDrawer={setShowStudentDrawer}
            showGroupDrawer={showGroupDrawer} setShowGroupDrawer={setShowGroupDrawer}
            activeGroupId={activeGroupId} setActiveGroupId={setActiveGroupIdExclusive} GROUP_COLORS={GROUP_COLORS}
            removeStudentsMode={removeStudentsMode} toggleRemoveStudentsMode={toggleRemoveStudentsMode}
            showFunDrawer={showFunDrawer} setShowFunDrawer={setShowFunDrawer}
            hideGroups={hideGroups} setHideGroups={setHideGroups}
            showGroupNumbers={showGroupNumbers} setShowGroupNumbers={setShowGroupNumbers}
            colorSeatsByGroup={colorSeatsByGroup} setColorSeatsByGroup={setColorSeatsByGroup}
            handleRuleBasedFunSpin={handleRuleBasedFunSpin} handleAutoFill={handleAutoFill} flipRoom={flipRoom}
            showHistory={showHistory} setShowHistory={setShowHistory}
            showNumbers={showNumbers} setShowNumbers={setShowNumbers}
            showZones={showZones} setShowZones={setShowZones}
            hideEmptyDesks={hideEmptyDesks} setHideEmptyDesks={setHideEmptyDesks}
            hideSensitiveInfo={hideSensitiveInfo} setHideSensitiveInfo={setHideSensitiveInfo}
            setIsProjectorMode={setIsProjectorMode}
            revealMode={revealMode} revealedCount={revealedSlots.size} revealTotal={revealOrder.length}
            startReveal={startReveal} revealNext={revealNext} revealAll={revealAll} endReveal={endReveal}
            activeFunMode={activeFunMode}
            startRoulette={startRoulette} stopRoulette={stopRoulette}
            bombCountdown={bombCountdown} bombBoom={bombBoom} startRandombomb={startRandombomb} cancelRandombomb={cancelRandombomb}
            startMusikkstoler={startMusikkstoler}
            startMakkerbytte={startMakkerbytte}
            spotlightSlotKey={spotlightSlotKey} startSpotlight={startSpotlight} dismissSpotlight={dismissSpotlight}
            canvasLight={canvasLight}
            toggleCanvasLight={toggleCanvasLight}
          />
        )}

        {/* 2. Elev Skuff */}
        {!isProjectorMode && (
          <StudentDrawer
            showStudentDrawer={showStudentDrawer} setShowStudentDrawer={setShowStudentDrawer}
            unplacedStudents={unplacedStudents} startDrag={startDrag}
            overDrawer={overDrawer}
          />
        )}

        {/* 5. Main Canvas Area */}
        <div
          className={`flex-1 flex flex-col overflow-hidden relative bg-base-300 ${isProjectorMode && projectorZoom > PROJECTOR_ZOOM_MIN ? (isProjectorPanning ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
          onMouseDown={isProjectorMode ? handleProjectorPanStart : startCanvasAction}
          onMouseMove={isProjectorMode ? handleProjectorPanMove : handleMouseMove}
          onMouseUp={isProjectorMode ? handleProjectorPanEnd : handleMouseUp}
          onMouseLeave={isProjectorMode ? handleProjectorPanEnd : handleCanvasMouseLeave}
          onWheel={isProjectorMode ? handleProjectorWheel : undefined}
          onClick={() => setContextMenu(null)}
        >
          {activeFunMode === 'randombomb' && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none">
              <div className={`text-[10rem] font-black drop-shadow-[0_0_30px_rgba(244,63,94,0.8)] transition-transform ${bombBoom ? 'text-emerald-400 scale-125' : 'text-rose-500 animate-bounce'}`}>
                {bombBoom ? '💥' : bombCountdown}
              </div>
            </div>
          )}

          {!isProjectorMode && ruleReport.total > 0 && !ruleBannerHidden && (
            <div className={`absolute top-2 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs shadow-lg border ${
              ruleReport.violations.length === 0
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : 'bg-amber-950/90 border-amber-500/40 text-amber-100'
            }`}>
              <i className={`fa-solid ${ruleReport.violations.length === 0 ? 'fa-circle-check' : 'fa-triangle-exclamation'}`}></i>
              <span>{ruleReport.satisfied} av {ruleReport.total} regler oppfylt</span>
              {ruleReport.violations.length > 0 && (
                <span className="opacity-90">
                  · brutt: {ruleReport.violations
                    .map(v => v.studentNames.join(v.rule.type === 'avoid' ? ' ✕ ' : ' + '))
                    .join(', ')}
                </span>
              )}
              <button
                className="ml-1 opacity-70 hover:opacity-100"
                aria-label="Lukk"
                onClick={() => setRuleBannerHidden(true)}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          )}

          {isProjectorMode && (
            <>
              <button className="fixed top-4 right-4 z-[9999] btn btn-error shadow-2xl animate-pulse" onMouseDown={(e) => e.stopPropagation()} onClick={() => setIsProjectorMode(false)}>
                Avslutt prosjektorvisning
              </button>
              <div className="fixed top-4 left-4 z-[9999] flex items-center gap-1.5 bg-base-200/95 border border-slate-700 rounded-xl shadow-2xl p-1.5" onMouseDown={(e) => e.stopPropagation()}>
                <button className="btn btn-sm btn-square btn-ghost text-slate-300" title="Zoom ut" onClick={() => handleProjectorZoomButton(-0.25)} disabled={projectorZoom <= PROJECTOR_ZOOM_MIN}>
                  <i className="fa-solid fa-magnifying-glass-minus"></i>
                </button>
                <span className="text-xs font-bold text-slate-300 w-10 text-center">{Math.round(projectorZoom * 100)}%</span>
                <button className="btn btn-sm btn-square btn-ghost text-slate-300" title="Zoom inn" onClick={() => handleProjectorZoomButton(0.25)} disabled={projectorZoom >= PROJECTOR_ZOOM_MAX}>
                  <i className="fa-solid fa-magnifying-glass-plus"></i>
                </button>
                <button className="btn btn-sm btn-square btn-ghost text-slate-300" title="Nullstill visning" onClick={handleProjectorZoomReset} disabled={projectorZoom === PROJECTOR_ZOOM_MIN && projectorPan.x === 0 && projectorPan.y === 0}>
                  <i className="fa-solid fa-compress"></i>
                </button>
                <div className="w-px h-5 bg-slate-700 mx-0.5"></div>
                <button className="btn btn-sm btn-square btn-ghost text-cyan-400" title="Snu klasserommet" onClick={flipRoom}>
                  <i className="fa-solid fa-rotate"></i>
                </button>
              </div>
            </>
          )}

          {/* Container for zooming/skalering */}
          <div
            className="flex-1 w-full h-full overflow-hidden bg-base-300 relative"
            style={isProjectorMode ? { transform: `translate(${projectorPan.x}px, ${projectorPan.y}px) scale(${projectorZoom})`, transformOrigin: 'center center' } : undefined}
          >
          <div ref={containerRef} className="w-full h-full relative">
            <div
              ref={canvasRef}
              className={`absolute rounded-2xl shadow-2xl origin-top-left border-2 ${canvasLight ? 'bg-slate-200 border-slate-400/70' : 'bg-base-100 border-slate-700/50'}`}
              style={{
                width: '1100px',
                height: '700px',
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                backgroundImage: canvasLight
                  ? 'radial-gradient(rgba(0,0,0,0.14) 1px, transparent 0)'
                  : 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 0)',
                backgroundSize: '20px 20px'
              }}
            >
                    {/* Fast Tavle */}
                    <div 
                      className="absolute board-item z-20 pointer-events-none select-none"
                      style={{ left: boardObj.x, top: boardObj.y }}
                    >
                      <div className="w-64 h-9 bg-slate-900/90 border border-[#f59e0b]/50 rounded-full shadow-xl flex items-center justify-center text-[#f59e0b] font-bold tracking-[0.5em] text-sm">
                        T A V L E
                      </div>
                    </div>

                    {/* Stilrene Bord */}
                    {desks.map((d) => {
                      const cap = d.capacity || 1;
                      const offsetX = 0;
                      const activeZones = d.zones || [];

                      const gId = groupOverrides[d.id] || d.groupId;
                      const groupColor = (gId && !hideGroups) ? GROUP_COLORS[(gId - 1) % GROUP_COLORS.length] : null;
                      const seatNumbers = deskNumberMap[d.id] || [];

                      // "Skjul denne plassen" (unusedSeats) på en tom plass: plassen
                      // kollapser helt, bordet krymper til resten og makkergruppe-
                      // border/farge beholdes rundt dem. Vanlig "Ledig" beholdes.
                      // Kollaps kun når minst én plass blir igjen (ellers er det et
                      // vanlig tomt bord) og ikke midt i en dra-handling (da trengs
                      // alle plassene som gyldige slippmål).
                      // Kollaps-geometri (hvilke seter vises, i hvilken rekkefølge, hvor
                      // bredt bordet blir) ligger i deskLayout.mjs – DELT med treff-testen
                      // i useStudentDragAndDrop, ellers driver slippmålene fra setene.
                      // Håndskjulte plasser forblir skjult også under en dra-handling
                      // (i motsetning til bord skjult av "Skjul tomme bord"-toggelen) –
                      // brukeren gjemte dem bevisst, så de skal ikke dukke opp som "Ubrukt".
                      const {
                        hasStudents, hiddenSlotCount,
                        collapsedWhole: deskCollapsedWhole, collapseUnused, renderSlots, width: deskW,
                      } = getDeskLayout(d, placements, unusedSeats);
                      const visualWidth = deskW;

                      // "Skjul tomme bord": bord uten en eneste elev forsvinner helt fra
                      // visningen når toggelen er på. Under en aktiv dra-handling vises de
                      // likevel midlertidig (lav opacity) som gyldige mål, se Toolbar.jsx.
                      const isDeskFullyEmpty = !hasStudents;
                      const isHiddenEmptyDesk = hideEmptyDesks && isDeskFullyEmpty;
                      if (isHiddenEmptyDesk && !draggedStudent) return null;

                      // Hele bordet er trukket sammen: kompakt brikke, ingen seter/soner.
                      if (deskCollapsedWhole) {
                        return (
                          <div
                            key={d.id}
                            onContextMenu={(e) => { e.preventDefault(); handleDeskContextMenu(e, d); }}
                            className="absolute h-[60px] rounded-xl bg-base-200/60 border-2 border-dashed border-slate-600/70 opacity-50 hover:opacity-90 flex items-center justify-center shadow-lg transition-all z-10"
                            style={{ left: d.x - offsetX, top: d.y, width: '54px' }}
                          >
                            <HoverTip content={`${hiddenSlotCount} skjulte plasser – klikk for å vise bordet`}>
                              <button
                                className="w-6 h-6 rounded-full bg-base-300 border-2 border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 shadow-lg flex items-center justify-center text-[10px] transition-colors"
                                onClick={(e) => { e.stopPropagation(); restoreDeskSeats(d.id); }}
                              >
                                <i className="fa-solid fa-eye"></i>
                              </button>
                            </HoverTip>
                          </div>
                        );
                      }

                      let borderStyle = groupColor ? { borderWidth: '3px', borderColor: groupColor } : {};

                      // Highlight if inside lasso
                      if (activeGroupId !== null && lasso) {
                        const minX = Math.min(lasso.startX, lasso.currentX);
                        const maxX = Math.max(lasso.startX, lasso.currentX);
                        const minY = Math.min(lasso.startY, lasso.currentY);
                        const maxY = Math.max(lasso.startY, lasso.currentY);
                        if (d.x < maxX && (d.x + deskW) > minX && d.y < maxY && (d.y + 60) > minY) {
                          borderStyle = { borderWidth: '3px', borderColor: '#f472b6', boxShadow: '0 0 15px #f472b6' };
                        }
                      }

                      return (
                        <div
                          key={d.id}
                          onContextMenu={(e) => { e.preventDefault(); handleDeskContextMenu(e, d); }}
                          className={`absolute h-[60px] rounded-xl bg-base-200 flex flex-col items-center justify-between p-1 shadow-lg transition-all border border-slate-700/70 z-10 ${isHiddenEmptyDesk ? 'opacity-40 border-dashed' : ''}`}
                          style={{ left: d.x - offsetX, top: d.y, width: `${visualWidth}px`, ...borderStyle }}
                        >
                          {gId && !hideGroups && showGroupNumbers && (
                            <div className="absolute -top-2.5 right-2 z-20 pointer-events-none">
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded text-slate-950 shadow tracking-wider" style={{ backgroundColor: groupColor }}>
                                Gruppe {gId}
                              </span>
                            </div>
                          )}

                          {collapseUnused && (
                            <HoverTip
                              content={`${hiddenSlotCount} skjult${hiddenSlotCount > 1 ? 'e' : ''} plass${hiddenSlotCount > 1 ? 'er' : ''} – klikk for å vise`}
                              className="absolute top-1/2 -left-2.5 -translate-y-1/2 z-30"
                            >
                              <button
                                className="w-5 h-5 rounded-full bg-base-300 border-2 border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 shadow-lg flex items-center justify-center text-[9px] transition-colors"
                                onClick={(e) => { e.stopPropagation(); restoreDeskSeats(d.id); }}
                              >
                                <i className="fa-solid fa-eye"></i>
                              </button>
                            </HoverTip>
                          )}

                          <div className="flex gap-1 w-full flex-1 items-center justify-center">
                            {renderSlots.map((slotIdx) => {
                              const slotKey = `${d.id}_seat_${slotIdx}`;
                              const ghostVal = funModeGhosts ? funModeGhosts[slotKey] : undefined;
                              const isGhostSeat = ghostVal !== undefined;
                              const studentVal = isGhostSeat ? ghostVal : placements[slotKey];
                              const studentObj = studentVal ? getStudentByIdOrName(studentVal) : null;
                              const isLocked = lockedSeats[slotKey];
                              const isUnused = !studentObj && !!unusedSeats[slotKey];
                              const role = studentObj ? studentRoles[studentObj.id] : null;
                              const note = studentObj ? studentNotes[studentObj.id] : null;
                              const fontSizeClass = studentObj ? getFontSizeClass(studentObj.name) : '';

                              const isHoverTarget = hoverSlotKey === slotKey;

                              const conflictColor = showHistory && studentObj ? historyConflicts[studentObj.id] : null;
                              let bgClass = conflictColor
                                ? `${conflictColor} text-white shadow-md border-2`
                                : isUnused
                                ? 'bg-slate-950/60 text-slate-600 border border-dashed border-slate-700/60'
                                : (studentObj ? 'bg-emerald-500/10 text-white shadow-md border border-emerald-500/20' : 'bg-surface-raised text-slate-500 border border-slate-700/30');

                              // Makkergruppe-farge på selve setet: lysere fyll-tone (via lightenHex)
                              // + full-metning kant, slik at borderen fortsatt er tydelig synlig mot
                              // fyllet - se lightenHex-doc i shared/utils.js.
                              let groupFillStyle = null;
                              if (!conflictColor && studentObj && colorSeatsByGroup && groupColor) {
                                bgClass = 'text-slate-900 shadow-md border-2';
                                groupFillStyle = { backgroundColor: lightenHex(groupColor, 0.65), borderColor: groupColor };
                              }

                              if (isHoverTarget) {
                                bgClass = 'border-2 border-emerald-400 bg-emerald-500/40 shadow-[0_0_20px_rgba(52,211,153,0.9)] scale-105 z-30 animate-pulse text-white font-extrabold';
                                groupFillStyle = null;
                              }

                              if (isGhostSeat) {
                                bgClass = studentObj
                                  ? 'border-2 border-amber-400 bg-amber-500/25 shadow-[0_0_18px_rgba(251,191,36,0.7)] scale-[1.03] z-30 text-white font-extrabold animate-pulse'
                                  : 'border-2 border-amber-400/40 bg-amber-500/5';
                                groupFillStyle = null;
                              }

                              const isSpotlit = spotlightSlotKey === slotKey;
                              if (isSpotlit) {
                                bgClass = 'border-2 border-yellow-400 bg-yellow-400/20 shadow-[0_0_25px_rgba(250,204,21,0.85)] scale-105 z-30 text-white font-extrabold';
                                groupFillStyle = null;
                              }

                              return (
                                <div
                                  key={slotIdx}
                                  className={`flex-1 h-full rounded-lg flex items-center justify-center relative transition-colors ${bgClass}`}
                                  style={groupFillStyle || undefined}
                                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); handleDeskContextMenu(e, d, studentObj, slotKey); }}
                                >
                                  {showNumbers && seatNumbers[slotIdx] !== undefined && (
                                    <div className="absolute -top-3 -left-2 z-20 pointer-events-none">
                                      <span className="min-w-[20px] h-5 px-1 rounded-full bg-base-300 border-2 border-slate-600 text-slate-300 font-black text-[10px] flex items-center justify-center shadow-lg whitespace-nowrap">
                                        {seatNumbers[slotIdx]}
                                      </span>
                                    </div>
                                  )}
                                  {isHoverTarget && !studentObj && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                      <span className="text-[10px] font-black text-emerald-300 uppercase tracking-widest animate-bounce">Slipp her</span>
                                    </div>
                                  )}
                                  {!hideSensitiveInfo && (
                                    <button 
                                      className={`absolute top-0.5 right-0.5 text-[9px] ${isLocked ? 'text-amber-400 opacity-100 z-40' : 'opacity-0 hover:opacity-100 text-slate-400 z-40'}`}
                                      onClick={(e) => { e.stopPropagation(); toggleLockStudent(slotKey); }}
                                      title="Lås/Lås opp elev"
                                    >
                                      <i className={`fa-solid ${isLocked ? 'fa-lock drop-shadow-[0_0_2px_rgba(251,191,36,0.8)]' : 'fa-lock-open'}`}></i>
                                    </button>
                                  )}
                                  
                                  {note && !hideSensitiveInfo && (
                                    <HoverTip content={note} className="absolute top-0.5 left-0.5 z-30">
                                      <span className="text-[9px] text-amber-300 opacity-80 cursor-help">
                                        <i className="fa-solid fa-note-sticky"></i>
                                      </span>
                                    </HoverTip>
                                  )}

                                  {studentObj && revealMode && !revealedSlots.has(slotKey) ? (
                                    <div className="w-full h-full flex items-center justify-center px-1 bg-cyan-950/60 border border-cyan-500/30 rounded-lg">
                                      <span className="text-lg font-black text-cyan-400">?</span>
                                    </div>
                                  ) : studentObj ? (
                                    <div
                                      className={`w-full h-full flex items-center justify-center gap-1 px-1 truncate ${activeGroupId !== null || removeStudentsMode || revealMode ? '' : 'cursor-move'}`}
                                      onMouseDown={(e) => { if (activeGroupId === null && !removeStudentsMode && !revealMode && !activeFunMode) startDrag(e, studentObj, slotKey); }}
                                      onDoubleClick={() => openNoteModal(studentObj)}
                                    >
                                      {!hideSensitiveInfo && role && <span className="text-[10px]">{role}</span>}
                                      <span className={`truncate ${fontSizeClass} tracking-wide`}>{studentObj.name}</span>
                                    </div>
                                  ) : !isHoverTarget ? (
                                    <span className={`text-[10px] uppercase tracking-widest font-bold ${isUnused ? 'opacity-50' : 'opacity-30'}`}>
                                      {isUnused ? 'Ubrukt' : 'Ledig'}
                                    </span>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>

                          {showZones && activeZones.length > 0 && (
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1 flex-wrap justify-center max-w-full z-30 whitespace-nowrap">
                              {activeZones.map(zKey => {
                                const zm = zoneMeta[zKey];
                                return zm ? (
                                  <span key={zKey} className={`text-[9px] px-2 py-0.5 rounded-full font-bold border shadow ${zm.badgeClass}`}>
                                    {zm.label}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {/* Lasso visual */}
                    {lasso && (activeGroupId !== null || removeStudentsMode) && (
                      <div
                        className={`absolute z-40 border-2 pointer-events-none ${removeStudentsMode ? 'border-rose-400 bg-rose-500/20' : 'border-fuchsia-400 bg-fuchsia-500/20'}`}
                        style={{
                          left: Math.min(lasso.startX, lasso.currentX),
                          top: Math.min(lasso.startY, lasso.currentY),
                          width: Math.abs(lasso.currentX - lasso.startX),
                          height: Math.abs(lasso.currentY - lasso.startY)
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

      {/* Elev som dras. Rendret i en portal på body (fixed) så den aldri klippes
          av lerretet eller havner bak skuffen. Navneboksen henger NED-TIL-HØYRE
          for pekeren – ikke midt under den – slik at selve slippunktet (og
          "Slipp her"-highlightet på setet) er synlig. En liten ring markerer det
          nøyaktige punktet der eleven havner. */}
      {draggedStudent && createPortal(
        <>
          <div
            className={`fixed z-[9999] pointer-events-none w-3 h-3 rounded-full border-2 -translate-x-1/2 -translate-y-1/2 ${
              willRemoveOnDrop ? 'border-rose-400 bg-rose-500/40' : 'border-emerald-300 bg-emerald-400/40'
            }`}
            style={{ left: draggedStudent.pointerX, top: draggedStudent.pointerY }}
          />
          <div
            className={`fixed z-[9999] pointer-events-none h-[58px] w-[104px] rounded-xl border-2 bg-base-200 flex items-center justify-center p-1 opacity-95 transition-colors ${
              willRemoveOnDrop
                ? 'border-rose-500 shadow-[0_0_18px_rgba(244,63,94,0.35)]'
                : 'border-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.3)]'
            }`}
            style={{ left: draggedStudent.pointerX, top: draggedStudent.pointerY, transform: 'translate(16px, 14px)' }}
          >
            <div className={`w-full h-full rounded-lg flex items-center justify-center gap-1.5 text-white border text-sm font-bold truncate px-1 shadow-md ${
              willRemoveOnDrop ? 'bg-rose-500/20 border-rose-500/40' : 'bg-emerald-500/20 border-emerald-500/40'
            }`}>
              {willRemoveOnDrop && <i className="fa-solid fa-user-minus text-rose-300 flex-shrink-0"></i>}
              <span className="truncate">{willRemoveOnDrop ? 'Fjern' : draggedStudent.studentObj.name}</span>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Modals and Context Menus */}
      <Modals
        editingNoteStudent={editingNoteStudent}
        noteInputValue={noteInputValue}
        setNoteInputValue={setNoteInputValue}
        saveStudentNote={saveStudentNote}
        chartName={chartName}
        handleDelete={handleDelete}
        isOnlyPeriod={isOnlyPeriod}
        editingPeriod={editingPeriod}
        setEditingPeriod={setEditingPeriod}
        handleSaveEditedPeriod={handleSaveEditedPeriod}
        newPeriodWeeks={newPeriodWeeks} setNewPeriodWeeks={setNewPeriodWeeks} handleStartNewPeriod={handleStartNewPeriod}
        canSplitChart={chartPeriodCount > 1} splitToNewChart={splitToNewChart}
        syncFromRoom={syncFromRoom}
        restoreToOpen={restoreToOpen}
      />

      <DeskContextMenu
        contextMenu={contextMenu}
        lockedSeats={lockedSeats}
        unusedSeats={unusedSeats}
        toggleSeatUnused={toggleSeatUnused}
        restoreDeskSeats={restoreDeskSeats}
        toggleLockDesk={toggleLockDesk}
        toggleLockStudent={toggleLockStudent}
        handleUnseatStudent={handleUnseatStudent}
        setContextMenu={setContextMenu}
        handleSetGroupContextMenu={handleSetGroupContextMenu}
        GROUP_COLORS={GROUP_COLORS}
        getRecentPartners={getRecentPartners}
      />

      {showPrintPreview && (
        <PrintPreviewModal
          chartName={chartName}
          className={classes.find(c => c.id === Number(selectedClass))?.name || ''}
          chartComment={chartComment}
          boardObj={boardObj}
          desks={desks}
          deskNumberMap={deskNumberMap}
          placements={placements}
          unusedSeats={unusedSeats}
          getStudentByIdOrName={getStudentByIdOrName}
          groupColors={GROUP_COLORS}
          zoneMeta={zoneMeta}
          groupOverrides={groupOverrides}
          initialShowNumbers={false}
          initialShowZones={showZones}
          initialShowGroups={!hideGroups}
          initialColorSeats={colorSeatsByGroup}
          initialHideEmptyDesks={hideEmptyDesks}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
    </div>
  );
}
