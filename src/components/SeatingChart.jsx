import React, { useState, useEffect, useRef } from 'react';
import PrintOverlay from './SeatingChart/PrintOverlay';
import Modals from './SeatingChart/Modals';
import DeskContextMenu from './SeatingChart/DeskContextMenu';
import HeaderBar from './SeatingChart/HeaderBar';
import Toolbar from './SeatingChart/Toolbar';
import StudentDrawer from './SeatingChart/StudentDrawer';

const GROUP_COLORS = [
  '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981',
  '#ef4444', '#6366f1', '#14b8a6', '#f97316', '#84cc16',
  '#06b6d4', '#d946ef', '#e11d48', '#22c55e', '#64748b'
];

const normalizeStudent = (s) => {
  if (typeof s === 'string') {
    return { id: `stu-${Math.random().toString(36).substr(2, 9)}`, name: s, note: '' };
  }
  return s && s.id && s.name ? { ...s, note: s.note || '' } : { id: `stu-${Math.random().toString(36).substr(2, 9)}`, name: String(s || ''), note: '' };
};

const getFontSizeClass = (name) => {
  if (!name) return 'text-xs font-extrabold';
  const len = name.length;
  if (len > 20) return 'text-[9px] font-bold leading-tight';
  if (len > 15) return 'text-[10px] font-bold leading-tight';
  if (len > 10) return 'text-[11px] font-bold leading-tight';
  return 'text-xs font-extrabold';
};

export default function SeatingChart({ onBack, initialId }) {
  const [classes, setClasses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [seatings, setSeatings] = useState([]);
  
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedSeatingId, setSelectedSeatingId] = useState('');
  
  const [chartName, setChartName] = useState('');
  const [chartComment, setChartComment] = useState('Uke 1-4');
  const [desks, setDesks] = useState([]);
  const [doors, setDoors] = useState([]);
  const [windows, setWindows] = useState([]);
  const [boardObj, setBoardObj] = useState({ x: 422, y: 15 });
  const [saveState, setSaveState] = useState('saved');
  
  const [placements, setPlacements] = useState({});
  const [lockedSeats, setLockedSeats] = useState({});
  const [studentRoles, setStudentRoles] = useState({});
  const [studentNotes, setStudentNotes] = useState({});
  const [classRules, setClassRules] = useState([]);
  
  const [allStudents, setAllStudents] = useState([]);
  const [unplacedStudents, setUnplacedStudents] = useState([]);
  const [ruleReport, setRuleReport] = useState(null);

  // UI State
  const [isProjectorMode, setIsProjectorMode] = useState(false);
  const [hideSensitiveInfo, setHideSensitiveInfo] = useState(false);
  const [showNumbers, setShowNumbers] = useState(true);
  const [showZones, setShowZones] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [hideGroups, setHideGroups] = useState(false);
  const [showStudentDrawer, setShowStudentDrawer] = useState(false);
  const [showPeriodsDrawer, setShowPeriodsDrawer] = useState(false);
  const [editingNoteStudent, setEditingNoteStudent] = useState(null);
  const [noteInputValue, setNoteInputValue] = useState('');
  const [historyConflicts, setHistoryConflicts] = useState({});
  const [contextMenu, setContextMenu] = useState(null);
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [newPeriodWeeks, setNewPeriodWeeks] = useState(4);
  
  // Grouping override state (Lasso)
  const [groupOverrides, setGroupOverrides] = useState({});
  const [showGroupDrawer, setShowGroupDrawer] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [lasso, setLasso] = useState(null);

  // Fun Mode state
  const [showFunDrawer, setShowFunDrawer] = useState(false);
  const [hoverSlotKey, setHoverSlotKey] = useState(null);

  // Gradvis avdekking (del av Fun Mode)
  const [revealMode, setRevealMode] = useState(false);
  const [revealOrder, setRevealOrder] = useState([]);
  const [revealedSlots, setRevealedSlots] = useState(new Set());

  // Drag state
  const [draggedStudent, setDraggedStudent] = useState(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-save refs
  const saveTimeoutRef = useRef(null);
  const isInitialLoadRef = useRef(true);

  // Resize Observer for skalering
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        const availW = width - 60;
        const availH = height - 60;
        const sX = availW / 1100;
        const sY = availH / 700;
        // Skaler både ned OG opp for å fylle det tilgjengelige vinduet — ikke
        // bare krymp på små vinduer. Øvre tak hindrer at klasserommet blir
        // urimelig stort/uskarpt-følende på svært brede skjermer.
        const s = Math.min(1.5, sX, sY);
        setScale(s);

        const scaledW = 1100 * s;
        const scaledH = 700 * s;
        setOffset({
          x: Math.max(30, (width - scaledW) / 2),
          y: Math.max(30, (height - scaledH) / 2)
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    loadBaseData();
  }, []);

  const loadBaseData = async () => {
    try {
      const cls = await window.api.getClasses();
      const rms = await window.api.getRooms();
      const sts = await window.api.getSeatings();
      setClasses(cls);
      setRooms(rms);
      setSeatings(sts);
      
      if (initialId && initialId !== 'new') {
        const seating = sts.find(s => s.id === Number(initialId));
        if (seating) {
          setSelectedSeatingId(seating.id);
          setSelectedClass(seating.class_id);
          setSelectedRoom(seating.room_id);
          setChartName(seating.name);
          setChartComment(seating.comment || 'Uke 1-4');
          
          let parsedPlacements = {};
          let deskSnapshot = null;
          try {
            const extraData = seating.placements ? JSON.parse(seating.placements) : {};
            if (extraData.placements) {
              parsedPlacements = extraData.placements;
              setLockedSeats(extraData.lockedSeats || {});
              setStudentRoles(extraData.studentRoles || {});
              setStudentNotes(extraData.studentNotes || {});
              setGroupOverrides(extraData.groupOverrides || {});
              deskSnapshot = extraData.deskLayout || null;
            } else {
              parsedPlacements = extraData;
            }
          } catch(e) {}

          setPlacements(parsedPlacements);

          // Setup chart with local variables
          const clsObj = cls.find(c => c.id === Number(seating.class_id));
          const rmObj = rms.find(r => r.id === Number(seating.room_id));
          setupNewChartLocal(clsObj, rmObj, parsedPlacements, deskSnapshot);
        }
      }
    } catch (e) {}
  };

  // deskSnapshot (om satt): bordoppsettet slik det var da klassekartet sist ble lagret.
  // Rommets layout_data leses live og kan ha blitt regenerert (nye bord-IDer) siden den
  // gang — uten snapshot ville lagrede elevplasseringer da peke på bord som ikke finnes
  // lenger og se ut som om alle elevene forsvant. Se "Hent fra rom"-knappen for bevisst sync.
  const setupNewChartLocal = (cls, rm, currentPlacements, deskSnapshot) => {
    if (deskSnapshot && Array.isArray(deskSnapshot.desks) && deskSnapshot.desks.length) {
      setDesks(deskSnapshot.desks.map(d => ({
        ...d,
        capacity: d.capacity || 1,
        zones: Array.isArray(d.zones) ? d.zones : (d.zone ? [d.zone] : []),
        groupId: d.groupId || null
      })));
      setDoors(deskSnapshot.doors || []);
      setWindows(deskSnapshot.windows || []);
      setBoardObj(deskSnapshot.boardObj || { x: 422, y: 15 });
    } else if (rm) {
      try {
        const layout = JSON.parse(rm.layout_data || '{}');
        setDesks((layout.desks || []).map(d => ({
          ...d,
          capacity: d.capacity || 1,
          zones: Array.isArray(d.zones) ? d.zones : (d.zone ? [d.zone] : []),
          groupId: d.groupId || null
        })));
        setDoors(layout.doors || []);
        setWindows(layout.windows || []);
        setBoardObj(layout.boardObj || { x: 422, y: 15 });
      } catch (e) {}
    }

    if (cls) {
      try {
        const parsedClass = cls.students ? JSON.parse(cls.students) : [];
        let stuList = [];
        let rls = [];

        if (Array.isArray(parsedClass)) {
          stuList = parsedClass.map(normalizeStudent);
        } else {
          stuList = (parsedClass.students || []).map(normalizeStudent);
          rls = parsedClass.rules || [];
        }

        setAllStudents(stuList);
        setClassRules(rls);

        const placedIds = Object.values(currentPlacements);
        setUnplacedStudents(stuList.filter(s => !placedIds.includes(s.id) && !placedIds.includes(s.name)));
      } catch (e) {
        setAllStudents([]);
        setUnplacedStudents([]);
        setClassRules([]);
      }
    }
  };

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('toggle-projector', { detail: isProjectorMode }));
    return () => window.dispatchEvent(new CustomEvent('toggle-projector', { detail: false }));
  }, [isProjectorMode]);

  useEffect(() => {
    if (localStorage.getItem('print_on_mount') === 'true') {
      localStorage.removeItem('print_on_mount');
      setTimeout(() => handlePrint(), 1000);
    }
  }, []);

  useEffect(() => {
    if (isInitialLoadRef.current) return;
    if (!selectedClass || !selectedRoom) return;

    setSaveState('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveCurrentSeating();
    }, 1000);
    
    return () => clearTimeout(saveTimeoutRef.current);
  }, [placements, lockedSeats, studentRoles, studentNotes, chartName, chartComment, selectedClass, selectedRoom, boardObj, groupOverrides]);

  const handleContextMenu = (e, slotKey, studentObj, deskId) => {
    e.preventDefault();
    setContextMenu({ mouseX: e.clientX, mouseY: e.clientY, slotKey, studentObj, deskId });
  };

  const handleDeskContextMenu = (e, desk) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, desk });
  };
  const getNeighbors = (placementsObj) => {
    const pairs = [];
    const placed = Object.keys(placementsObj).map(slot => ({
       slot,
       studentId: placementsObj[slot],
       deskId: slot.split('_seat_')[0]
    }));
    
    for (let i = 0; i < placed.length; i++) {
       for (let j = i + 1; j < placed.length; j++) {
           const p1 = placed[i];
           const p2 = placed[j];
           if (!p1.studentId || !p2.studentId) continue;
           
           let isNeighbor = false;
           if (p1.deskId === p2.deskId) {
               isNeighbor = true; // Samme bord
           } else {
               const d1 = desks.find(d => String(d.id) === String(p1.deskId));
               const d2 = desks.find(d => String(d.id) === String(p2.deskId));
               if (d1 && d2) {
                   if (d1.groupId && d2.groupId && d1.groupId === d2.groupId) {
                       isNeighbor = true; // Samme makkergruppe
                   } else {
                       // Enkel avstandssjekk (ved siden av hverandre)
                       const d1Right = d1.x + (d1.capacity * 95);
                       const d2Right = d2.x + (d2.capacity * 95);
                       const d1Bottom = d1.y + 65;
                       const d2Bottom = d2.y + 65;
                       
                       const isAdjacentHorizontal = Math.abs(d1.y - d2.y) < 20 && (Math.abs(d1.x - d2Right) < 40 || Math.abs(d1Right - d2.x) < 40);
                       const isAdjacentVertical = Math.abs(d1.x - d2.x) < 20 && (Math.abs(d1.y - d2Bottom) < 40 || Math.abs(d1Bottom - d2.y) < 40);
                       
                       if (isAdjacentHorizontal || isAdjacentVertical) isNeighbor = true;
                   }
               }
           }
           if (isNeighbor) pairs.push([p1.studentId, p2.studentId]);
       }
    }
    return pairs;
  };

  useEffect(() => {
    if (!showHistory) {
      setHistoryConflicts({});
      return;
    }
    
    const currentNeighbors = getNeighbors(placements);
    if (currentNeighbors.length === 0) {
      setHistoryConflicts({});
      return;
    }
    
    const pastCharts = seatings
       .filter(s => s.class_id === selectedClass && s.id !== Number(selectedSeatingId))
       .sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
       .slice(0, 5);
       
    const pastNeighborsPerChart = pastCharts.map(c => {
       try {
         const p = JSON.parse(c.placements || '{}');
         return getNeighbors(p.placements || p);
       } catch(e) { return []; }
    });
    
    const conflicts = {};
    const colors = ['bg-red-500/80 border-red-400', 'bg-orange-400/80 border-orange-300', 'bg-yellow-400/80 border-yellow-300', 'bg-lime-400/80 border-lime-300', 'bg-emerald-500/80 border-emerald-400'];
    
    currentNeighbors.forEach(([s1, s2]) => {
        for (let i = 0; i < pastNeighborsPerChart.length; i++) {
           const pastPairs = pastNeighborsPerChart[i];
           const satTogether = pastPairs.some(pair => (pair[0] === s1 && pair[1] === s2) || (pair[0] === s2 && pair[1] === s1));
           if (satTogether) {
               const color = colors[i];
               if (!conflicts[s1] || colors.indexOf(color) < colors.indexOf(conflicts[s1])) conflicts[s1] = color;
               if (!conflicts[s2] || colors.indexOf(color) < colors.indexOf(conflicts[s2])) conflicts[s2] = color;
           }
        }
    });
    setHistoryConflicts(conflicts);
  }, [showHistory, placements, selectedClass, selectedSeatingId, seatings, desks]);

  const handleSelectSeating = async (id, seatingsList = seatings) => {
    isInitialLoadRef.current = true;
    const seating = seatingsList.find(s => s.id === Number(id));
    if (!seating) {
      setSelectedSeatingId('');
      setChartName('Nytt klassekart');
      setChartComment('Uke 1-4');
      setPlacements({});
      setLockedSeats({});
      setStudentRoles({});
      setStudentNotes({});
      if (selectedClass && selectedRoom) setupNewChart(selectedClass, selectedRoom, {});
    } else {
      setSelectedSeatingId(id);
      setSelectedClass(seating.class_id);
      setSelectedRoom(seating.room_id);
      setChartName(seating.name);
      setChartComment(seating.comment || 'Uke 1-4');
      
      let parsedPlacements = {};
      let deskSnapshot = null;
      try {
        const extraData = seating.placements ? JSON.parse(seating.placements) : {};
        if (extraData.placements) {
          parsedPlacements = extraData.placements;
          setLockedSeats(extraData.lockedSeats || {});
          setStudentRoles(extraData.studentRoles || {});
          setStudentNotes(extraData.studentNotes || {});
          deskSnapshot = extraData.deskLayout || null;
        } else {
          parsedPlacements = extraData;
        }
      } catch(e) {}

      setPlacements(parsedPlacements);
      setupNewChart(seating.class_id, seating.room_id, parsedPlacements, deskSnapshot);
    }
    setSaveState('saved');
    setTimeout(() => isInitialLoadRef.current = false, 100);
  };

  const setupNewChart = (cId, rId, currentPlacements, deskSnapshot) => {
    const cls = classes.find(c => c.id === Number(cId));
    const rm = rooms.find(r => r.id === Number(rId));

    if (deskSnapshot && Array.isArray(deskSnapshot.desks) && deskSnapshot.desks.length) {
      setDesks(deskSnapshot.desks.map(d => ({
        ...d,
        capacity: d.capacity || 1,
        zones: Array.isArray(d.zones) ? d.zones : (d.zone ? [d.zone] : []),
        groupId: d.groupId || null
      })));
      setDoors(deskSnapshot.doors || []);
      setWindows(deskSnapshot.windows || []);
      setBoardObj(deskSnapshot.boardObj || { x: 405, y: 25 });
    } else if (rm) {
      try {
        const layout = JSON.parse(rm.layout_data || '{}');
        setDesks((layout.desks || []).map(d => ({
          ...d,
          capacity: d.capacity || 1,
          zones: Array.isArray(d.zones) ? d.zones : (d.zone ? [d.zone] : []),
          groupId: d.groupId || null
        })));
        setDoors(layout.doors || []);
        setWindows(layout.windows || []);
        setBoardObj(layout.boardObj || { x: 405, y: 25 });
      } catch (e) {}
    }

    if (cls) {
      try {
        const parsedClass = cls.students ? JSON.parse(cls.students) : [];
        let stuList = [];
        let rls = [];

        if (Array.isArray(parsedClass)) {
          stuList = parsedClass.map(normalizeStudent);
        } else {
          stuList = (parsedClass.students || []).map(normalizeStudent);
          rls = parsedClass.rules || [];
        }

        setAllStudents(stuList);
        setClassRules(rls);

        const placedIds = Object.values(currentPlacements);
        setUnplacedStudents(stuList.filter(s => !placedIds.includes(s.id) && !placedIds.includes(s.name)));
      } catch (e) {
        setAllStudents([]);
        setUnplacedStudents([]);
        setClassRules([]);
      }
    }
  };

  const getStudentByIdOrName = (idOrName) => {
    return allStudents.find(s => s.id === idOrName || s.name === idOrName) || { id: idOrName, name: idOrName, note: '' };
  };

  const saveCurrentSeating = async () => {
    if (!selectedClass || !selectedRoom || !chartName.trim()) return;
    try {
      const savePayload = JSON.stringify({
        placements,
        lockedSeats,
        studentRoles,
        studentNotes,
        groupOverrides,
        // Frosset kopi av bordoppsettet. Uten denne ville rom-redigering (spesielt
        // Hurtiglayout, som gir alle bord nye IDer) stille gjøre alle plasseringer
        // her foreldreløse neste gang kartet åpnes.
        deskLayout: { desks, doors, windows, boardObj }
      });

      const result = await window.api.saveSeating({
        id: selectedSeatingId || null,
        name: chartName.trim(),
        classId: selectedClass,
        roomId: selectedRoom,
        placements: savePayload,
        comment: chartComment
      });
      if (!selectedSeatingId && result.lastID) {
        setSelectedSeatingId(result.lastID);
      }
      const newSeatings = await window.api.getSeatings();
      setSeatings(newSeatings);
      setSaveState('saved');
    } catch (e) {}
  };

  const handleStartNewPeriod = async (jumpWeeks) => {
    if (!selectedClass || !selectedRoom) return;
    const match = chartComment.match(/Uke\s+(\d+)\s*-\s*(\d+)/i);
    let nextStart = 1;
    if (match && match[2]) {
      nextStart = parseInt(match[2]) + 1;
    }
    const weeks = Math.max(1, Number(jumpWeeks) || 4);
    const nextEnd = nextStart + weeks - 1;

    const newComment = `Uke ${nextStart}-${nextEnd}`;
    // Navnet er gitt av klassen — ingen fritekst å taste inn per periode.
    const newName = classes.find(c => c.id === Number(selectedClass))?.name || chartName;

    try {
      const savePayload = JSON.stringify({
        placements,
        lockedSeats,
        studentRoles,
        studentNotes,
        groupOverrides,
        // Frosset kopi av bordoppsettet. Uten denne ville rom-redigering (spesielt
        // Hurtiglayout, som gir alle bord nye IDer) stille gjøre alle plasseringer
        // her foreldreløse neste gang kartet åpnes.
        deskLayout: { desks, doors, windows, boardObj }
      });

      const result = await window.api.saveSeating({
        id: null,
        name: newName,
        classId: selectedClass,
        roomId: selectedRoom,
        placements: savePayload,
        comment: newComment
      });

      const newSeatings = await window.api.getSeatings();
      setSeatings(newSeatings);
      if (result?.lastID) handleSelectSeating(result.lastID, newSeatings);
      document.getElementById('modal_new_period')?.close();
    } catch (e) {}
  };

  const handleSaveEditedPeriod = async () => {
    if (!editingPeriod) return;
    try {
      const existing = seatings.find(s => s.id === editingPeriod.id);
      if (existing) {
        await window.api.saveSeating({
          id: existing.id,
          name: editingPeriod.name,
          comment: editingPeriod.comment,
          classId: existing.class_id,
          roomId: existing.room_id,
          placements: existing.placements
        });
        const newSeatings = await window.api.getSeatings();
        setSeatings(newSeatings);
        if (existing.id === Number(selectedSeatingId)) {
          setChartName(editingPeriod.name);
          setChartComment(editingPeriod.comment);
        }
      }
      document.getElementById('modal_edit_period').close();
    } catch(e) {}
  };

  const handleDelete = async () => {
    if (!selectedSeatingId) return;
    try {
      await window.api.deleteSeating(selectedSeatingId);
      setSelectedSeatingId('');
      setPlacements({});
      const newSeatings = await window.api.getSeatings();
      setSeatings(newSeatings);
      if (newSeatings.length > 0) handleSelectSeating(newSeatings[0].id, newSeatings);
    } catch (e) {}
  };

  const flipRoom = () => {
    if (desks.length === 0) return;
    const minX = Math.min(...desks.map(d => d.x));
    const maxX = Math.max(...desks.map(d => d.x + 100));
    const minY = Math.min(...desks.map(d => d.y));
    const maxY = Math.max(...desks.map(d => d.y + 60));
    
    const centerX = minX + (maxX - minX) / 2;
    const centerY = minY + (maxY - minY) / 2;

    setDesks(desks.map(d => ({
      ...d,
      x: Math.max(10, Math.min(1100 - (d.capacity || 1) * 100 - 10, Math.round((2 * centerX - d.x - ((d.capacity || 1) * 100)) / 10) * 10)),
      y: Math.max(70, Math.min(700 - 60 - 10, Math.round((2 * centerY - d.y - 60) / 10) * 10))
    })));

    setBoardObj(prev => ({
      x: Math.max(10, Math.min(1050 - 240, Math.round((2 * centerX - prev.x - 240) / 10) * 10)),
      y: Math.max(10, Math.min(700 - 40, Math.round((2 * centerY - prev.y - 40) / 10) * 10))
    }));
  };

  // Henter romets NÅVÆRENDE oppsett og erstatter bord-snapshotet i dette klassekartet.
  // Bord-IDer som ikke lenger finnes i rommet mister plasseringen sin (studenten havner
  // i "uplassert") — det er forventet og er selve poenget: dette er en bevisst handling,
  // ikke noe som skal skje stille av seg selv når rommet redigeres.
  const syncFromRoom = () => {
    const rm = rooms.find(r => r.id === Number(selectedRoom));
    if (!rm) return;
    try {
      const layout = JSON.parse(rm.layout_data || '{}');
      const newDesks = (layout.desks || []).map(d => ({
        ...d,
        capacity: d.capacity || 1,
        zones: Array.isArray(d.zones) ? d.zones : (d.zone ? [d.zone] : []),
        groupId: d.groupId || null
      }));
      const newDeskIds = new Set(newDesks.map(d => String(d.id)));

      setDesks(newDesks);
      setDoors(layout.doors || []);
      setWindows(layout.windows || []);
      setBoardObj(layout.boardObj || { x: 422, y: 15 });

      setPlacements(prev => {
        const next = {};
        for (const [slotKey, val] of Object.entries(prev)) {
          if (newDeskIds.has(slotKey.split('_seat_')[0])) next[slotKey] = val;
        }
        const keptIds = Object.values(next);
        setUnplacedStudents(allStudents.filter(s => !keptIds.includes(s.id) && !keptIds.includes(s.name)));
        return next;
      });
    } catch (e) {}
    document.getElementById('modal_sync_room')?.close();
  };

  const handleAutoFill = () => {
    let seatSlots = [];
    desks.forEach(d => {
      const cap = d.capacity || 1;
      for (let s = 0; s < cap; s++) {
        const slotKey = `${d.id}_seat_${s}`;
        if (!lockedSeats[slotKey]) {
          seatSlots.push({ slotKey, deskId: d.id, slotIdx: s, desk: d });
        }
      }
    });

    let availableStudents = [...unplacedStudents];
    desks.forEach(d => {
      const cap = d.capacity || 1;
      for (let s = 0; s < cap; s++) {
        const slotKey = `${d.id}_seat_${s}`;
        if (!lockedSeats[slotKey] && placements[slotKey]) {
          availableStudents.push(getStudentByIdOrName(placements[slotKey]));
        }
      }
    });

    let bestCandidate = { ...placements };
    seatSlots.forEach(slot => delete bestCandidate[slot.slotKey]);

    const shuffledStudents = [...availableStudents].sort(() => Math.random() - 0.5);
    
    // Sorter pulter etter bordnummer (logisk posisjon i rommet)
    const isBoardAtTop = boardObj.y < 350;
    const sortedDesks = [...desks].sort((a, b) => {
      const yDiff = a.y - b.y;
      if (isBoardAtTop) {
        if (Math.abs(yDiff) > 35) return yDiff;
        return a.x - b.x;
      } else {
        if (Math.abs(yDiff) > 35) return -yDiff;
        return b.x - a.x;
      }
    });

    const deskNumberMap = {};
    sortedDesks.forEach((d, idx) => {
      deskNumberMap[d.id] = idx + 1;
    });

    const sortedSlots = [...seatSlots].sort((a, b) => {
        const num1 = deskNumberMap[a.deskId] || 999;
        const num2 = deskNumberMap[b.deskId] || 999;
        if (num1 === num2) return a.slotIdx - b.slotIdx;
        return num1 - num2;
    });

    // Velg de første N plassene som matcher antall elever
    const targetSlots = sortedSlots.slice(0, shuffledStudents.length);
    // Shuffle KUN disse plassene
    const shuffledSlots = targetSlots.sort(() => Math.random() - 0.5);

    shuffledStudents.forEach((st, idx) => {
      if (idx < shuffledSlots.length) {
        bestCandidate[shuffledSlots[idx].slotKey] = st.id;
      }
    });

    const finalPlacedVals = Object.values(bestCandidate);
    const finalUnplaced = availableStudents.filter(s => !finalPlacedVals.includes(s.id) && !finalPlacedVals.includes(s.name));

    setPlacements(bestCandidate);
    setUnplacedStudents(finalUnplaced);
  };

  // Randomiserer elevplassering umiddelbart (ingen animasjon) — kjører 35
  // tilfeldige forsøk internt og beholder det beste i tråd med reglene.
  const handleRuleBasedFunSpin = () => {
    let seatSlots = [];
    desks.forEach(d => {
      const cap = d.capacity || 1;
      for (let s = 0; s < cap; s++) {
        const slotKey = `${d.id}_seat_${s}`;
        if (!lockedSeats[slotKey]) {
          seatSlots.push({ slotKey, deskId: d.id, slotIdx: s, desk: d });
        }
      }
    });

    if (seatSlots.length === 0 || allStudents.length === 0) return;

    const availableStudents = [...allStudents];

    // Evaluering av plasseringer i tråd med regler (separasjon, makker, soner)
    const evaluatePlacementScore = (candidatePlacements) => {
      let score = 100;
      classRules.forEach(rule => {
        if (!rule || !rule.type) return;
        if (rule.type === 'separate' && rule.student1 && rule.student2) {
          const s1Slot = Object.keys(candidatePlacements).find(k => candidatePlacements[k] === rule.student1);
          const s2Slot = Object.keys(candidatePlacements).find(k => candidatePlacements[k] === rule.student2);
          if (s1Slot && s2Slot) {
            const desk1 = s1Slot.split('_seat_')[0];
            const desk2 = s2Slot.split('_seat_')[0];
            if (desk1 === desk2) score -= 150; // Straff for samme pult
          }
        }
      });
      return score;
    };

    let topScore = -99999;
    let topPlacements = { ...placements };

    for (let attempt = 0; attempt < 35; attempt++) {
      let testPlacements = { ...placements };
      seatSlots.forEach(slot => delete testPlacements[slot.slotKey]);

      const shuffledStus = [...availableStudents].sort(() => Math.random() - 0.5);
      const shuffledSlots = [...seatSlots].sort(() => Math.random() - 0.5);

      shuffledStus.forEach((st, idx) => {
        if (idx < shuffledSlots.length) {
          testPlacements[shuffledSlots[idx].slotKey] = st.id;
        }
      });

      const currentScore = evaluatePlacementScore(testPlacements);
      if (currentScore > topScore) {
        topScore = currentScore;
        topPlacements = testPlacements;
      }
    }

    setPlacements(topPlacements);
    const finalVals = Object.values(topPlacements);
    setUnplacedStudents(allStudents.filter(s => !finalVals.includes(s.id)));
  };

  // Gradvis avdekking: skjuler navnene til alle plasserte elever og lar
  // læreren avsløre dem én og én i tilfeldig rekkefølge (foran klassen).
  const startReveal = () => {
    const placedSlots = Object.keys(placements).filter(k => placements[k]);
    if (placedSlots.length === 0) return;
    setRevealOrder([...placedSlots].sort(() => Math.random() - 0.5));
    setRevealedSlots(new Set());
    setRevealMode(true);
  };

  const revealNext = () => {
    const nextSlot = revealOrder.find(slot => !revealedSlots.has(slot));
    if (!nextSlot) return;
    setRevealedSlots(prev => new Set(prev).add(nextSlot));
  };

  const revealAll = () => {
    setRevealedSlots(new Set(revealOrder));
  };

  const endReveal = () => {
    setRevealMode(false);
    setRevealOrder([]);
    setRevealedSlots(new Set());
  };

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

  const toggleRole = (studentId, roleIcon) => {
    setStudentRoles(prev => ({
      ...prev,
      [studentId]: prev[studentId] === roleIcon ? null : roleIcon
    }));
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
    window.print();
    if (new URLSearchParams(window.location.search).has('print_on_mount')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  const startDrag = (e, studentObj, fromSlotKey = null) => {
    if (e.button === 2) return;
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    
    let currentX = (e.clientX - rect.left) / scale - 50;
    let currentY = (e.clientY - rect.top) / scale - 20;

    setDraggedStudent({
      studentObj,
      fromSlotKey,
      offsetX: 50,
      offsetY: 20,
      currentX,
      currentY
    });
  };

  // --- LASSO SELECTION LOGIC ---
  const startCanvasAction = (e) => {
    if (e.button === 2) return;
    if (activeGroupId !== null) {
      e.preventDefault();
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / scale;
      const cy = (e.clientY - rect.top) / scale;
      setLasso({ startX: cx, startY: cy, currentX: cx, currentY: cy });
    }
  };

  const handleMouseMove = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    
    if (activeGroupId !== null && lasso) {
      setLasso(prev => ({
        ...prev,
        currentX: (e.clientX - rect.left) / scale,
        currentY: (e.clientY - rect.top) / scale
      }));
      return;
    }

    if (!draggedStudent) return;
    const studentCurX = (e.clientX - rect.left) / scale - draggedStudent.offsetX;
    const studentCurY = (e.clientY - rect.top) / scale - draggedStudent.offsetY;

    setDraggedStudent(prev => ({
      ...prev,
      currentX: studentCurX,
      currentY: studentCurY
    }));

    // Calculate hover target desk slot for clear visual highlight
    const cx = studentCurX + 50;
    const cy = studentCurY + 20;
    let targetKey = null;

    for (let d of desks) {
      const cap = d.capacity || 1;
      const deskW = cap * 100;
      if (cx >= d.x && cx <= (d.x + deskW) && cy >= d.y && cy <= (d.y + 60)) {
        const slotIdx = Math.min(cap - 1, Math.max(0, Math.floor((cx - d.x) / 100)));
        targetKey = `${d.id}_seat_${slotIdx}`;
        break;
      }
    }
    setHoverSlotKey(targetKey);
  };

  const handleMouseUp = () => {
    if (activeGroupId !== null && lasso) {
      const minX = Math.min(lasso.startX, lasso.currentX);
      const maxX = Math.max(lasso.startX, lasso.currentX);
      const minY = Math.min(lasso.startY, lasso.currentY);
      const maxY = Math.max(lasso.startY, lasso.currentY);
      
      const newOverrides = { ...groupOverrides };
      desks.forEach(d => {
        const deskW = (d.capacity || 1) * 100;
        const deskH = 60;
        // Sjekk om bordet overlapper med lasso
        if (d.x < maxX && (d.x + deskW) > minX && d.y < maxY && (d.y + deskH) > minY) {
          if (activeGroupId === 0) {
            delete newOverrides[d.id];
          } else {
            newOverrides[d.id] = activeGroupId;
          }
        }
      });
      setGroupOverrides(newOverrides);
      setLasso(null);
      return;
    }

    if (!draggedStudent) return;
    if (!canvasRef.current) { setDraggedStudent(null); return; }
    
    const { studentObj, fromSlotKey, currentX, currentY } = draggedStudent;
    const cx = currentX + 50;
    const cy = currentY + 20;
    
    let targetSlotKey = null;

    for (let d of desks) {
      const cap = d.capacity || 1;
      const deskW = cap * 100;
      if (cx >= d.x && cx <= (d.x + deskW) && cy >= d.y && cy <= (d.y + 60)) {
        const slotW = 100;
        const relativeX = cx - d.x;
        const slotIdx = Math.min(cap - 1, Math.max(0, Math.floor(relativeX / slotW)));
        targetSlotKey = `${d.id}_seat_${slotIdx}`;
        break;
      }
    }

    let newPlacements = { ...placements };
    let newUnplaced = [...unplacedStudents];

    if (targetSlotKey) {
      if (fromSlotKey) delete newPlacements[fromSlotKey];
      else newUnplaced = newUnplaced.filter(s => s.id !== studentObj.id && s.name !== studentObj.name);

      const existingVal = newPlacements[targetSlotKey];
      if (existingVal) {
        const existingObj = getStudentByIdOrName(existingVal);
        if (fromSlotKey) newPlacements[fromSlotKey] = existingObj.id; 
        else newUnplaced.push(existingObj); 
      }
      newPlacements[targetSlotKey] = studentObj.id;
    } else if (cx < -50) {
      // Dratt ut til venstre (over elevskuffen eller verktøymenyen)
      if (fromSlotKey) {
        delete newPlacements[fromSlotKey];
        if (!newUnplaced.some(s => s.id === studentObj.id)) newUnplaced.push(studentObj);
      }
    } else {
      // Sluppet på gulvet - smetter bare tilbake (vi endrer ingenting)
    }

    setPlacements(newPlacements);
    setUnplacedStudents(newUnplaced);
    setDraggedStudent(null);
    setHoverSlotKey(null);
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

  const deskNumberMap = {};
  sortedDesks.forEach((d, idx) => {
    deskNumberMap[d.id] = idx + 1;
  });

  const zoneMeta = {
    window: { label: 'Vindurekke', icon: 'fa-solid fa-sun text-yellow-400', badgeClass: 'border-yellow-500/40 text-yellow-300 bg-yellow-950/80' },
    door: { label: 'Dørsone', icon: 'fa-solid fa-door-open text-amber-400', badgeClass: 'border-amber-500/40 text-amber-300 bg-amber-950/80' },
    front: { label: 'Fremste rad', icon: 'fa-solid fa-location-dot text-emerald-400', badgeClass: 'border-emerald-500/40 text-emerald-300 bg-emerald-950/80' },
    back: { label: 'Bakerste rad', icon: 'fa-solid fa-arrow-down text-purple-400', badgeClass: 'border-purple-500/40 text-purple-300 bg-purple-950/80' },
    center: { label: 'Midtsone', icon: 'fa-solid fa-align-center text-cyan-400', badgeClass: 'border-cyan-500/40 text-cyan-300 bg-cyan-950/80' }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#131620] overflow-hidden relative">
      {/* Top Header Bar - Unifisert med RoomEditor */}
      {!isProjectorMode && (
        <HeaderBar
          onBack={onBack}
          classes={classes} selectedClass={selectedClass} setSelectedClass={setSelectedClass}
          rooms={rooms} selectedRoom={selectedRoom} setSelectedRoom={setSelectedRoom}
          seatings={seatings} selectedSeatingId={selectedSeatingId} handleSelectSeating={handleSelectSeating}
          setEditingPeriod={setEditingPeriod}
          saveState={saveState} handleDelete={handleDelete}
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
            handleRuleBasedFunSpin={handleRuleBasedFunSpin} handleAutoFill={handleAutoFill} flipRoom={flipRoom} handlePrint={handlePrint}
            showHistory={showHistory} setShowHistory={setShowHistory}
            showNumbers={showNumbers} setShowNumbers={setShowNumbers}
            showZones={showZones} setShowZones={setShowZones}
            hideSensitiveInfo={hideSensitiveInfo} setHideSensitiveInfo={setHideSensitiveInfo}
            setIsProjectorMode={setIsProjectorMode}
            revealMode={revealMode} revealedCount={revealedSlots.size} revealTotal={revealOrder.length}
            startReveal={startReveal} revealNext={revealNext} revealAll={revealAll} endReveal={endReveal}
          />
        )}

        {/* 2. Elev Skuff */}
        {!isProjectorMode && (
          <StudentDrawer
            showStudentDrawer={showStudentDrawer} setShowStudentDrawer={setShowStudentDrawer}
            unplacedStudents={unplacedStudents} startDrag={startDrag}
            studentRoles={studentRoles} toggleRole={toggleRole}
          />
        )}

        {/* 5. Main Canvas Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative bg-[#131620]" onMouseDown={startCanvasAction} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onClick={() => setContextMenu(null)}>
          {isProjectorMode && (
            <button className="fixed top-4 right-4 z-[9999] btn btn-error shadow-2xl animate-pulse" onClick={() => setIsProjectorMode(false)}>
              Avslutt Prosjektorvisning
            </button>
          )}

          {/* Container for zooming/skalering */}
          <div ref={containerRef} className="flex-1 w-full h-full overflow-hidden bg-[#131620] relative">
            <div 
              ref={canvasRef}
              className="absolute bg-[#202534] border-2 border-slate-700/50 rounded-2xl shadow-2xl origin-top-left"
              style={{ 
                width: '1100px',
                height: '700px',
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 0)', 
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

                    {/* Dører */}
                    {doors.map((dr) => (
                      <div key={dr.id} className="absolute select-none z-10 flex items-center justify-center pointer-events-none" style={{ left: dr.x, top: dr.y, transform: `rotate(${dr.rotation || 0}deg)` }}>
                        <svg width="60" height="40" viewBox="0 0 60 40">
                          <rect x="0" y="36" width="60" height="4" fill="#f59e0b" opacity="0.4" />
                          <path d="M 0 36 A 36 36 0 0 1 36 0" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 3" />
                          <line x1="0" y1="36" x2="36" y2="0" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" />
                        </svg>
                      </div>
                    ))}

                    {/* Vinduer */}
                    {windows.map((win) => (
                      <div key={win.id} className="absolute select-none z-10 flex items-center justify-center pointer-events-none" style={{ left: win.x, top: win.y, transform: `rotate(${win.rotation || 0}deg)` }}>
                        <div className="w-20 h-6 bg-cyan-950/60 border-2 border-cyan-400 rounded flex flex-col justify-between p-0.5 shadow">
                          <div className="w-full h-[2px] bg-cyan-300 opacity-60"></div>
                          <div className="text-[9px] font-bold text-cyan-200 text-center tracking-widest leading-none">VINDU</div>
                          <div className="w-full h-[2px] bg-cyan-300 opacity-60"></div>
                        </div>
                      </div>
                    ))}

                    {/* Stilrene Bord */}
                    {desks.map((d) => {
                      const cap = d.capacity || 1;
                      const deskW = cap * 100;
                      const visualWidth = deskW;
                      const offsetX = 0;
                      const activeZones = d.zones || [];
                      
                      const gId = groupOverrides[d.id] || d.groupId;
                      const groupColor = (gId && !hideGroups) ? GROUP_COLORS[(gId - 1) % GROUP_COLORS.length] : null;
                      const deskNumber = deskNumberMap[d.id] || '';
                      
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
                          className={`absolute h-[60px] rounded-xl bg-[#1a1e2b] flex flex-col items-center justify-between p-1 shadow-lg transition-all border border-slate-700/70 z-10`}
                          style={{ left: d.x - offsetX, top: d.y, width: `${visualWidth}px`, ...borderStyle }}
                        >
                          {showNumbers && (
                            <div className="absolute -top-3 -left-2.5 z-20 pointer-events-none">
                              <span className="w-6 h-6 rounded-full bg-[#131620] border-2 border-slate-600 text-slate-300 font-black text-xs flex items-center justify-center shadow-lg">
                                {deskNumber}
                              </span>
                            </div>
                          )}

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
                              const studentVal = placements[slotKey];
                              const studentObj = studentVal ? getStudentByIdOrName(studentVal) : null;
                              const isLocked = lockedSeats[slotKey];
                              const role = studentObj ? studentRoles[studentObj.id] : null;
                              const note = studentObj ? studentNotes[studentObj.id] : null;
                              const fontSizeClass = studentObj ? getFontSizeClass(studentObj.name) : '';
                              
                              const isHoverTarget = hoverSlotKey === slotKey;

                              const conflictColor = showHistory && studentObj ? historyConflicts[studentObj.id] : null;
                              let bgClass = conflictColor 
                                ? `${conflictColor} text-white shadow-md border-2` 
                                : (studentObj ? 'bg-emerald-500/10 text-white shadow-md border border-emerald-500/20' : 'bg-[#171a25] text-slate-500 border border-slate-700/30');

                              if (isHoverTarget) {
                                bgClass = 'border-2 border-emerald-400 bg-emerald-500/40 shadow-[0_0_20px_rgba(52,211,153,0.9)] scale-105 z-30 animate-pulse text-white font-extrabold';
                              }

                              return (
                                <div 
                                  key={slotIdx}
                                  className={`flex-1 h-full rounded-lg flex items-center justify-center relative transition-colors ${bgClass}`}
                                  onContextMenu={(e) => { if (activeGroupId === null) handleContextMenu(e, slotKey, studentObj, d.id); }}
                                >
                                  {isHoverTarget && !studentObj && (
                                    <span className="text-[10px] font-black text-emerald-300 uppercase tracking-widest pointer-events-none animate-bounce">Slipp her</span>
                                  )}
                                  {!hideSensitiveInfo && (
                                    <button 
                                      className={`absolute top-0.5 right-0.5 text-[9px] ${isLocked ? 'text-amber-400 opacity-100 z-40' : 'opacity-0 hover:opacity-100 text-slate-400 z-40'}`} 
                                      onClick={(e) => { e.stopPropagation(); toggleLockDesk(d.id); }}
                                      title="Lås/Lås opp hele bordet"
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
                                      onMouseDown={(e) => { if (activeGroupId === null && !revealMode) startDrag(e, studentObj, slotKey); }}
                                      onDoubleClick={() => openNoteModal(studentObj)}
                                    >
                                      {!hideSensitiveInfo && role && <span className="text-[10px]">{role}</span>}
                                      <span className={`truncate ${fontSizeClass} tracking-wide`}>{studentObj.name}</span>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] uppercase tracking-widest opacity-30 font-bold">Ledig</span>
                                  )}
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
                        className="absolute z-50 pointer-events-none cursor-move h-[65px] rounded-xl border-2 border-emerald-500 bg-[#1a1e2b] flex flex-col items-center justify-center p-1 shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-110 opacity-90"
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
        setContextMenu={setContextMenu}
        handleSetGroupContextMenu={handleSetGroupContextMenu}
        GROUP_COLORS={GROUP_COLORS}
      />

      <PrintOverlay
        chartName={chartName}
        className={classes.find(c => c.id === Number(selectedClass))?.name || ''}
        chartComment={chartComment}
        boardObj={boardObj}
        desks={desks}
        deskNumberMap={deskNumberMap}
        placements={placements}
        getStudentByIdOrName={getStudentByIdOrName}
      />
    </div>
  );
}
