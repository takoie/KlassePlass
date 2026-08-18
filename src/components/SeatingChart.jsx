import React, { useState, useEffect, useRef } from 'react';
import { lightenHex } from '../shared/utils';
import PrintPreviewModal from './Print/PrintPreviewModal';
import Modals from './SeatingChart/Modals';
import DeskContextMenu from './SeatingChart/DeskContextMenu';
import HeaderBar from './SeatingChart/HeaderBar';
import Toolbar from './SeatingChart/Toolbar';
import StudentDrawer from './SeatingChart/StudentDrawer';
import { useCanvasFit } from './SeatingChart/hooks/useCanvasFit';
import { useFunModes } from './SeatingChart/hooks/useFunModes';
import { useGroupLasso } from './SeatingChart/hooks/useGroupLasso';
import { useStudentDragAndDrop } from './SeatingChart/hooks/useStudentDragAndDrop';
import { useSeatings } from './SeatingChart/hooks/useSeatings';

// Makkergruppe-fargene 1-12 (se [1..12]-gridet i DeskContextMenu.jsx/
// Toolbar.jsx). Brukerspesifisert palett (kategorisk, D3/Tableau-aktig) valgt
// for tydelig innbyrdes forskjell mellom alle 12 - se SeatingChartPrintContent.jsx
// for hvorfor dette er ekstra viktig på papir (bordene der markeres KUN med en
// tynn kantfarge, ingen tall/etikett attåt).
const GROUP_COLORS = [
  '#1F77B4', '#FF7F0E', '#2CA02C', '#D62728',
  '#9467BD', '#8C564B', '#E377C2', '#17BECF',
  '#E7BA52', '#4D4D4D', '#55A868', '#C44E52'
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
  const [ruleReport, setRuleReport] = useState(null);

  // UI State
  const [isProjectorMode, setIsProjectorMode] = useState(false);
  const [projectorZoom, setProjectorZoom] = useState(1);
  const [projectorPan, setProjectorPan] = useState({ x: 0, y: 0 });
  const [isProjectorPanning, setIsProjectorPanning] = useState(false);
  const projectorPanLastPosRef = useRef({ x: 0, y: 0 });
  const [hideSensitiveInfo, setHideSensitiveInfo] = useState(false);
  const [showNumbers, setShowNumbers] = useState(true);
  const [showZones, setShowZones] = useState(false);
  const [hideGroups, setHideGroups] = useState(false);
  const [colorSeatsByGroup, setColorSeatsByGroup] = useState(false);
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

  const {
    groupOverrides, setGroupOverrides,
    activeGroupId, setActiveGroupId,
    lasso, startCanvasAction,
    handleMouseMove: handleLassoMouseMove,
    handleMouseUp: handleLassoMouseUp
  } = useGroupLasso({ desks, canvasRef, scale });

  const {
    classes, rooms, seatings,
    selectedClass, setSelectedClass, selectedRoom, setSelectedRoom, selectedSeatingId,
    chartName, setChartName, chartComment, setChartComment, saveState,
    placements, setPlacements, lockedSeats, setLockedSeats,
    studentRoles, setStudentRoles, studentNotes, setStudentNotes, classRules,
    allStudents, unplacedStudents, setUnplacedStudents,
    showHistory, setShowHistory, historyConflicts,
    editingPeriod, setEditingPeriod, newPeriodWeeks, setNewPeriodWeeks,
    getStudentByIdOrName, getRecentPartners,
    handleSelectSeating, handleStartNewPeriod, handleSaveEditedPeriod, handleDelete,
    flipRoom, syncFromRoom,
    canvasLight, toggleCanvasLight
  } = useSeatings({ initialId, desks, setDesks, boardObj, setBoardObj, groupOverrides, setGroupOverrides });


  useEffect(() => {
    window.api?.setFullscreen?.(isProjectorMode).catch(() => {});
    window.dispatchEvent(new CustomEvent('toggle-projector', { detail: isProjectorMode }));
    return () => {
      window.api?.setFullscreen?.(false).catch(() => {});
      window.dispatchEvent(new CustomEvent('toggle-projector', { detail: false }));
    };
  }, [isProjectorMode]);

  // Start alltid med full oversikt hver gang prosjektorvisningen åpnes, uansett
  // hvilken zoom/pan-posisjon som var aktiv sist gang den var åpen.
  useEffect(() => {
    if (isProjectorMode) {
      setProjectorZoom(1);
      setProjectorPan({ x: 0, y: 0 });
    }
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


  const handleDeskContextMenu = (e, desk, student = null, slotKey = null) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, desk, student, slotKey });
  };

  const {
    draggedStudent, hoverSlotKey, startDrag,
    handleMouseMove: handleDragMouseMove,
    handleMouseUp: handleDragMouseUp
  } = useStudentDragAndDrop({
    canvasRef, scale, desks, placements, setPlacements,
    unplacedStudents, setUnplacedStudents, getStudentByIdOrName
  });

  const handleMouseMove = (e) => {
    if (handleLassoMouseMove(e)) return;
    handleDragMouseMove(e);
  };

  const handleMouseUp = () => {
    if (handleLassoMouseUp()) return;
    handleDragMouseUp();
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
    desks, boardObj, placements, setPlacements, lockedSeats,
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
    const nums = [];
    for (let i = 0; i < cap; i++) {
      seatCounter += 1;
      nums.push(seatCounter);
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
          classes={classes} selectedClass={selectedClass} setSelectedClass={setSelectedClass}
          rooms={rooms} selectedRoom={selectedRoom} setSelectedRoom={setSelectedRoom}
          seatings={seatings} selectedSeatingId={selectedSeatingId} handleSelectSeating={handleSelectSeating}
          setEditingPeriod={setEditingPeriod}
          saveState={saveState} handleDelete={handleDelete} handlePrint={handlePrint}
        />
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* 1. ToolBox Sidebar */}
        {!isProjectorMode && (
          <Toolbar
            unplacedStudents={unplacedStudents}
            showStudentDrawer={showStudentDrawer} setShowStudentDrawer={setShowStudentDrawer}
            showGroupDrawer={showGroupDrawer} setShowGroupDrawer={setShowGroupDrawer}
            activeGroupId={activeGroupId} setActiveGroupId={setActiveGroupId} GROUP_COLORS={GROUP_COLORS}
            showFunDrawer={showFunDrawer} setShowFunDrawer={setShowFunDrawer}
            hideGroups={hideGroups} setHideGroups={setHideGroups}
            colorSeatsByGroup={colorSeatsByGroup} setColorSeatsByGroup={setColorSeatsByGroup}
            handleRuleBasedFunSpin={handleRuleBasedFunSpin} handleAutoFill={handleAutoFill} flipRoom={flipRoom}
            showHistory={showHistory} setShowHistory={setShowHistory}
            showNumbers={showNumbers} setShowNumbers={setShowNumbers}
            showZones={showZones} setShowZones={setShowZones}
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
          />
        )}

        {/* 5. Main Canvas Area */}
        <div
          className={`flex-1 flex flex-col overflow-hidden relative bg-base-300 ${isProjectorMode && projectorZoom > PROJECTOR_ZOOM_MIN ? (isProjectorPanning ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
          onMouseDown={isProjectorMode ? handleProjectorPanStart : startCanvasAction}
          onMouseMove={isProjectorMode ? handleProjectorPanMove : handleMouseMove}
          onMouseUp={isProjectorMode ? handleProjectorPanEnd : handleMouseUp}
          onMouseLeave={isProjectorMode ? handleProjectorPanEnd : handleMouseUp}
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

          {isProjectorMode && (
            <>
              <button className="fixed top-4 right-4 z-[9999] btn btn-error shadow-2xl animate-pulse" onClick={() => setIsProjectorMode(false)}>
                Avslutt prosjektorvisning
              </button>
              <div className="fixed top-4 left-4 z-[9999] flex items-center gap-1.5 bg-base-200/95 border border-slate-700 rounded-xl shadow-2xl p-1.5">
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
                      const deskW = cap * 100;
                      const visualWidth = deskW;
                      const offsetX = 0;
                      const activeZones = d.zones || [];
                      
                      const gId = groupOverrides[d.id] || d.groupId;
                      const groupColor = (gId && !hideGroups) ? GROUP_COLORS[(gId - 1) % GROUP_COLORS.length] : null;
                      const seatNumbers = deskNumberMap[d.id] || [];
                      
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
                          className={`absolute h-[60px] rounded-xl bg-base-200 flex flex-col items-center justify-between p-1 shadow-lg transition-all border border-slate-700/70 z-10`}
                          style={{ left: d.x - offsetX, top: d.y, width: `${visualWidth}px`, ...borderStyle }}
                        >
                          {gId && !hideGroups && (
                            <div className="absolute -top-2.5 right-2 z-20 pointer-events-none">
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded text-slate-950 shadow tracking-wider" style={{ backgroundColor: groupColor }}>
                                Gruppe {gId}
                              </span>
                            </div>
                          )}

                          <div className="flex gap-1 w-full flex-1 items-center justify-center">
                            {Array.from({ length: cap }).map((_, slotIdx) => {
                              const slotKey = `${d.id}_seat_${slotIdx}`;
                              const ghostVal = funModeGhosts ? funModeGhosts[slotKey] : undefined;
                              const isGhostSeat = ghostVal !== undefined;
                              const studentVal = isGhostSeat ? ghostVal : placements[slotKey];
                              const studentObj = studentVal ? getStudentByIdOrName(studentVal) : null;
                              const isLocked = lockedSeats[slotKey];
                              const role = studentObj ? studentRoles[studentObj.id] : null;
                              const note = studentObj ? studentNotes[studentObj.id] : null;
                              const fontSizeClass = studentObj ? getFontSizeClass(studentObj.name) : '';
                              
                              const isHoverTarget = hoverSlotKey === slotKey;

                              const conflictColor = showHistory && studentObj ? historyConflicts[studentObj.id] : null;
                              let bgClass = conflictColor
                                ? `${conflictColor} text-white shadow-md border-2`
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
                                  onContextMenu={(e) => { if (studentObj) { e.preventDefault(); e.stopPropagation(); handleDeskContextMenu(e, d, studentObj, slotKey); } }}
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
                                    <div className="absolute top-0.5 left-0.5 text-[9px] text-amber-300 opacity-80" title={note}>
                                      <i className="fa-solid fa-note-sticky"></i>
                                    </div>
                                  )}

                                  {studentObj && revealMode && !revealedSlots.has(slotKey) ? (
                                    <div className="w-full h-full flex items-center justify-center px-1 bg-cyan-950/60 border border-cyan-500/30 rounded-lg">
                                      <span className="text-lg font-black text-cyan-400">?</span>
                                    </div>
                                  ) : studentObj ? (
                                    <div
                                      className={`w-full h-full flex items-center justify-center gap-1 px-1 truncate ${activeGroupId !== null || revealMode ? '' : 'cursor-move'}`}
                                      onMouseDown={(e) => { if (activeGroupId === null && !revealMode && !activeFunMode) startDrag(e, studentObj, slotKey); }}
                                      onDoubleClick={() => openNoteModal(studentObj)}
                                    >
                                      {!hideSensitiveInfo && role && <span className="text-[10px]">{role}</span>}
                                      <span className={`truncate ${fontSizeClass} tracking-wide`}>{studentObj.name}</span>
                                    </div>
                                  ) : !isHoverTarget ? (
                                    <span className="text-[10px] uppercase tracking-widest opacity-30 font-bold">Ledig</span>
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
                    
                    {/* Dragged student overlay */}
                    {draggedStudent && (
                      <div 
                        className="absolute z-50 pointer-events-none cursor-move h-[65px] rounded-xl border-2 border-emerald-500 bg-base-200 flex flex-col items-center justify-center p-1 shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-110 opacity-90"
                        style={{ left: draggedStudent.currentX - 47, top: draggedStudent.currentY - 32, width: '109px' }}
                      >
                        <div className="w-full h-full rounded-lg flex items-center justify-center bg-emerald-500/20 text-white border border-emerald-500/40 text-sm font-bold truncate px-1 shadow-md">
                          {draggedStudent.studentObj.name}
                        </div>
                      </div>
                    )}

                    {/* Lasso visual */}
                    {lasso && activeGroupId !== null && (
                      <div 
                        className="absolute z-40 border-2 border-fuchsia-400 bg-fuchsia-500/20 pointer-events-none"
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

      {/* Modals and Context Menus */}
      <Modals
        editingNoteStudent={editingNoteStudent}
        noteInputValue={noteInputValue}
        setNoteInputValue={setNoteInputValue}
        saveStudentNote={saveStudentNote}
        chartName={chartName}
        handleDelete={handleDelete}
        editingPeriod={editingPeriod}
        setEditingPeriod={setEditingPeriod}
        handleSaveEditedPeriod={handleSaveEditedPeriod}
        newPeriodWeeks={newPeriodWeeks} setNewPeriodWeeks={setNewPeriodWeeks} handleStartNewPeriod={handleStartNewPeriod}
        syncFromRoom={syncFromRoom}
      />

      <DeskContextMenu
        contextMenu={contextMenu}
        lockedSeats={lockedSeats}
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
          getStudentByIdOrName={getStudentByIdOrName}
          groupColors={GROUP_COLORS}
          zoneMeta={zoneMeta}
          groupOverrides={groupOverrides}
          initialShowNumbers={false}
          initialShowZones={showZones}
          initialShowGroups={!hideGroups}
          initialColorSeats={colorSeatsByGroup}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
    </div>
  );
}
