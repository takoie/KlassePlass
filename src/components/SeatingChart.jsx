import React, { useState, useEffect, useRef } from 'react';

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
  
  // Grouping override state (Lasso)
  const [groupOverrides, setGroupOverrides] = useState({});
  const [showGroupDrawer, setShowGroupDrawer] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [lasso, setLasso] = useState(null);

  // Fun Mode state
  const [showFunDrawer, setShowFunDrawer] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinTargetSlot, setSpinTargetSlot] = useState(null);
  const [spinTargetStudent, setSpinTargetStudent] = useState(null);
  const [hoverSlotKey, setHoverSlotKey] = useState(null);

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
        const s = Math.min(1, sX, sY);
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

  const handleSelectSeating = async (id) => {
    isInitialLoadRef.current = true;
    const seating = seatings.find(s => s.id === Number(id));
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

  const handleStartNewPeriod = async () => {
    if (!selectedClass || !selectedRoom) return;
    const match = chartComment.match(/Uke\s+(\d+)\s*-\s*(\d+)/i);
    let nextStart = 5;
    let nextEnd = 8;

    if (match && match[2]) {
      nextStart = parseInt(match[2]) + 1;
      nextEnd = nextStart + 3;
    }

    const newComment = `Uke ${nextStart}-${nextEnd}`;
    const newName = `${chartName} (${newComment})`;

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
      if (result?.lastID) handleSelectSeating(result.lastID);
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
      if (newSeatings.length > 0) handleSelectSeating(newSeatings[0].id);
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

    if (seatSlots.length === 0 || allStudents.length === 0 || isSpinning) return;

    let availableStudents = [...allStudents];
    let bestPlacement = { ...placements };

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

    setIsSpinning(true);
    let iterations = 0;
    const interval = setInterval(() => {
      iterations++;
      const randomTempPlacements = { ...placements };
      const tempStus = [...availableStudents].sort(() => Math.random() - 0.5);
      seatSlots.forEach((slot, idx) => {
        if (idx < tempStus.length) {
          randomTempPlacements[slot.slotKey] = tempStus[idx].id;
        }
      });
      setPlacements(randomTempPlacements);

      if (iterations >= 30) {
        clearInterval(interval);
        setPlacements(topPlacements);
        const finalVals = Object.values(topPlacements);
        setUnplacedStudents(allStudents.filter(s => !finalVals.includes(s.id)));
        setIsSpinning(false);
      }
    }, 70);
  };

  const handleFunModeSpin = (spinAll = false) => {
    // Hvis kalt fra timeout, må vi sjekke latest state, men vi kan bare stole på at funksjonen trigger state updates riktig
    // For å unngå stale state i setInterval, bruker vi en ref eller funksjonell state updates.
    // Vi bruker setTimeout og kaller en lokal nextSpin() funksjon
    
    setUnplacedStudents(currentUnplaced => {
      if (currentUnplaced.length === 0 || isSpinning) return currentUnplaced;

      let currentPlacements = {};
      let currentLocked = {};
      setPlacements(p => { currentPlacements = p; return p; });
      setLockedSeats(l => { currentLocked = l; return l; });

      const emptySlots = [];
      sortedDesks.forEach(d => {
        const cap = d.capacity || 1;
        for (let s = 0; s < cap; s++) {
          const slotKey = `${d.id}_seat_${s}`;
          if (!currentLocked[slotKey] && !currentPlacements[slotKey]) {
            emptySlots.push(slotKey);
          }
        }
      });

      if (emptySlots.length === 0) return currentUnplaced;

      setShowFunDrawer(false); // Lukk skuffen!
      setIsSpinning(true);
      const nextSlot = emptySlots[0];
      const winningStudent = currentUnplaced[Math.floor(Math.random() * currentUnplaced.length)];
      setSpinTargetSlot(nextSlot);
      
      let spins = 0;
      const interval = setInterval(() => {
        spins++;
        setSpinTargetStudent(currentUnplaced[Math.floor(Math.random() * currentUnplaced.length)]);
        
        if (spins > (spinAll ? 8 : 20)) { // Raskere spinning hvis spinAll
          clearInterval(interval);
          setSpinTargetStudent(winningStudent);
          
          setTimeout(() => {
            setPlacements(prev => ({ ...prev, [nextSlot]: winningStudent.id }));
            setIsSpinning(false);
            setSpinTargetSlot(null);
            setSpinTargetStudent(null);
            
            // Fiks arrayet
            const newUnplaced = currentUnplaced.filter(s => s.id !== winningStudent.id);
            setUnplacedStudents(newUnplaced);
            
            if (spinAll && newUnplaced.length > 0 && emptySlots.length > 1) {
              setTimeout(() => {
                handleFunModeSpin(true);
              }, 300);
            }
          }, spinAll ? 600 : 1500); // Kortere visning hvis spinAll
        }
      }, spinAll ? 50 : 100);

      return currentUnplaced; // State blir faktisk oppdatert i timeout
    });
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
        <div className="px-6 py-2.5 bg-[#1a1e2b] border-b border-slate-800 flex justify-between items-center z-20 flex-shrink-0 shadow-md">
          <div className="flex items-center gap-4">
            {onBack && (
              <button className="btn btn-ghost btn-xs text-slate-400 hover:text-white gap-1" onClick={onBack}>
                <i className="fa-solid fa-arrow-left"></i> Tilbake
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase opacity-50 text-slate-400">Klasse:</span>
              <select 
                className="select select-bordered select-xs bg-[#262b3a] border-slate-700 text-white font-bold min-w-32"
                value={selectedClass}
                onChange={(e) => setSelectedClass(Number(e.target.value))}
              >
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase opacity-50 text-slate-400">Rom:</span>
              <select 
                className="select select-bordered select-xs bg-[#262b3a] border-slate-700 text-white font-bold min-w-32"
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(Number(e.target.value))}
              >
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input 
              type="text" 
              value={chartName}
              onChange={(e) => setChartName(e.target.value)}
              className="input input-ghost text-base font-bold bg-[#262b3a] border border-slate-700 focus:border-[#34d399] px-3 h-8 rounded text-white min-w-44"
              placeholder="Navn på klassekart..."
            />
            <input 
              type="text" 
              value={chartComment}
              onChange={(e) => setChartComment(e.target.value)}
              className="input input-ghost text-xs font-bold text-amber-300 bg-[#262b3a] border border-slate-700 px-3 h-8 w-28 text-center rounded"
              placeholder="f.eks Uke 1-4..."
            />
          </div>

          <div className="flex items-center gap-3">
            {saveState === 'saving' ? (
              <span className="text-amber-400 opacity-80 text-xs font-semibold flex items-center gap-1">
                <i className="fa-solid fa-spinner fa-spin"></i> Lagrer...
              </span>
            ) : (
              <span className="text-[#34d399] text-xs font-semibold flex items-center gap-1">
                <i className="fa-solid fa-circle-check text-[#34d399]"></i> Lagret
              </span>
            )}
            <button 
              className="btn btn-ghost text-red-400 hover:bg-red-950/40 btn-xs" 
              onClick={handleDelete}
            >
              <i className="fa-solid fa-trash"></i> Slett kart
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* 1. ToolBox Sidebar */}
        {!isProjectorMode && (
          <div className="w-64 bg-[#1a1e2b] flex flex-col z-10 flex-shrink-0 border-r border-slate-800 shadow-xl relative overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-[#1a1e2b]">
              <h3 className="font-extrabold text-sm text-emerald-400 flex items-center gap-2 uppercase tracking-widest">
                <i className="fa-solid fa-toolbox"></i> Verktøy
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-3">
              <div className="flex flex-col gap-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Handling</div>
                <button className="btn btn-sm btn-primary justify-start border-none bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" onClick={() => { setShowStudentDrawer(!showStudentDrawer); setShowGroupDrawer(false); setShowFunDrawer(false); }}>
                  <i className="fa-solid fa-users w-5"></i> Elever {unplacedStudents.length > 0 && <span className="badge badge-xs badge-error ml-auto">{unplacedStudents.length}</span>}
                </button>
                <button className={`btn btn-sm justify-start ${showGroupDrawer ? 'btn-neutral bg-fuchsia-900/30 text-fuchsia-400 border-fuchsia-500/50' : 'btn-outline border-slate-700 text-slate-300 hover:bg-slate-800'}`} onClick={() => { setShowGroupDrawer(!showGroupDrawer); if(showGroupDrawer) setActiveGroupId(null); setShowStudentDrawer(false); setShowFunDrawer(false); }}>
                  <i className="fa-solid fa-object-group w-5 text-fuchsia-400"></i> Makkergrupper
                </button>
                <button className={`btn btn-sm justify-start ${hideGroups ? 'btn-neutral bg-amber-900/30 text-amber-400 border-amber-500/50' : 'btn-outline border-slate-700 text-slate-300 hover:bg-slate-800'}`} onClick={() => setHideGroups(!hideGroups)}>
                  <i className={`fa-solid ${hideGroups ? 'fa-eye-slash' : 'fa-eye'} w-5 ${hideGroups ? 'text-amber-400' : 'text-slate-400'}`}></i> {hideGroups ? 'Vis Makkergrupper' : 'Skjul Makkergrupper'}
                </button>
                <button className={`btn btn-sm justify-start ${showFunDrawer ? 'btn-neutral bg-pink-900/30 text-pink-400 border-pink-500/50' : 'btn-outline border-slate-700 text-slate-300 hover:bg-slate-800'}`} onClick={() => { setShowFunDrawer(!showFunDrawer); setShowStudentDrawer(false); setShowGroupDrawer(false); }}>
                  <i className="fa-solid fa-wand-magic-sparkles w-5 text-pink-400"></i> Fun Mode
                </button>
                <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 justify-start hover:bg-slate-800" onClick={handleRuleBasedFunSpin}>
                  <i className="fa-solid fa-shuffle w-5 text-amber-400"></i> Randomiser (Med Regler)
                </button>
                <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 justify-start hover:bg-slate-800" onClick={flipRoom}>
                  <i className="fa-solid fa-rotate w-5 text-cyan-400"></i> Snu klasserommet
                </button>
                <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 justify-start hover:bg-slate-800" onClick={handlePrint}>
                  <i className="fa-solid fa-print w-5 text-indigo-400"></i> Skriv ut / PDF
                </button>
                <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 justify-start hover:bg-slate-800" onClick={() => document.getElementById('modal_sync_room').showModal()} title="Hent siste bordoppsett fra rom-editoren">
                  <i className="fa-solid fa-arrows-rotate w-5 text-orange-400"></i> Hent fra rom
                </button>
              </div>
              
              <div className="h-px bg-slate-800/50 w-full my-1"></div>

              <div className="flex flex-col gap-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Visning</div>
                <button className={`btn btn-sm ${showHistory ? 'btn-neutral bg-slate-700 text-amber-400' : 'btn-outline border-slate-700 text-slate-400'} justify-start`} onClick={() => setShowHistory(!showHistory)}>
                  <i className="fa-solid fa-clock-rotate-left w-5"></i> {showHistory ? 'Skjul historikk' : 'Vis historikk'}
                </button>
                <button className={`btn btn-sm ${showNumbers ? 'btn-neutral bg-slate-700 text-emerald-400' : 'btn-outline border-slate-700 text-slate-400'} justify-start`} onClick={() => setShowNumbers(!showNumbers)}>
                  <i className="fa-solid fa-hashtag w-5"></i> {showNumbers ? 'Skjul numre' : 'Vis numre'}
                </button>
                <button className={`btn btn-sm ${showZones ? 'btn-neutral bg-slate-700 text-cyan-400' : 'btn-outline border-slate-700 text-slate-400'} justify-start`} onClick={() => setShowZones(!showZones)}>
                  <i className="fa-solid fa-map w-5"></i> {showZones ? 'Skjul soner' : 'Vis soner'}
                </button>
                <button className={`btn btn-sm ${hideSensitiveInfo ? 'btn-neutral bg-slate-700 text-purple-400' : 'btn-outline border-slate-700 text-slate-400'} justify-start`} onClick={() => setHideSensitiveInfo(!hideSensitiveInfo)}>
                  <i className="fa-solid fa-eye-slash w-5"></i> {hideSensitiveInfo ? 'Vis info' : 'Skjul info'}
                </button>
                <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 justify-start hover:bg-slate-800" onClick={() => setIsProjectorMode(true)}>
                  <i className="fa-solid fa-expand w-5 text-fuchsia-400"></i> Prosjektor
                </button>
              </div>
              
              <div className="h-px bg-slate-800/50 w-full my-1"></div>
              
              <div className="flex flex-col gap-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Administrasjon</div>
                <button className="btn btn-sm btn-outline border-red-500/20 text-red-400 justify-start hover:bg-red-500/10" onClick={() => document.getElementById('modal_delete_seating').showModal()}>
                  <i className="fa-solid fa-trash w-5"></i> Slett klassekart
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Elev Skuff */}
        {!isProjectorMode && (
          <div className={`bg-[#171a25] border-slate-800 flex flex-col z-[49] transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 ${showStudentDrawer ? 'w-64 border-r' : 'w-0 border-r-0'}`}>
             <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-[#1a1e2b] whitespace-nowrap min-w-[16rem]">
               <h3 className="text-sm font-bold text-white flex items-center gap-2">
                 <i className="fa-solid fa-users text-emerald-400"></i> Elever ({unplacedStudents.length})
               </h3>
               <button className="btn btn-ghost btn-xs btn-square hover:bg-slate-800 text-slate-400" onClick={() => setShowStudentDrawer(false)}>
                 <i className="fa-solid fa-xmark"></i>
               </button>
             </div>
             <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5 bg-[#171a25] min-w-[16rem]">
                {unplacedStudents.length === 0 ? (
                  <div className="text-center opacity-50 text-xs text-slate-400 p-4 font-semibold mt-10">
                    <i className="fa-solid fa-check-circle text-2xl mb-2 text-emerald-500 block"></i>
                    Alle elever er plassert!
                  </div>
                ) : (
                  unplacedStudents.map(student => (
                    <div 
                      key={student.id} 
                      className="p-2.5 bg-[#202534] hover:bg-[#34d399] hover:text-slate-950 text-sm font-bold rounded-lg cursor-move flex justify-between items-center shadow-sm transition-colors text-slate-200 border border-slate-700/50"
                      onMouseDown={(e) => startDrag(e, student, null)}
                    >
                      <span className="truncate">{student.name}</span>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button className={`btn btn-ghost btn-xs btn-square ${studentRoles[student.id] === '⭐' ? 'text-warning' : 'opacity-30'}`} onClick={() => toggleRole(student.id, '⭐')} title="Gruppeleder ⭐">⭐</button>
                        <button className={`btn btn-ghost btn-xs btn-square ${studentRoles[student.id] === '💬' ? 'text-info' : 'opacity-30'}`} onClick={() => toggleRole(student.id, '💬')} title="Elevråd 💬">💬</button>
                      </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        )}

        {/* 3. Makkergruppe Skuff */}
        {!isProjectorMode && (
          <div className={`bg-[#171a25] border-slate-800 flex flex-col z-[49] transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 ${showGroupDrawer ? 'w-64 border-r' : 'w-0 border-r-0'}`}>
             <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-[#1a1e2b] whitespace-nowrap min-w-[16rem]">
               <h3 className="text-sm font-bold text-white flex items-center gap-2">
                 <i className="fa-solid fa-object-group text-fuchsia-400"></i> Makkergrupper
               </h3>
               <button className="btn btn-ghost btn-xs btn-square hover:bg-slate-800 text-slate-400" onClick={() => { setShowGroupDrawer(false); setActiveGroupId(null); }}>
                 <i className="fa-solid fa-xmark"></i>
               </button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-[#171a25] min-w-[16rem]">
                <p className="text-xs text-slate-400 leading-tight">
                  Velg en farge, klikk deretter på bordene i klassekartet for å koble dem sammen.
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(g => (
                    <button 
                      key={g}
                      className={`h-12 rounded-xl flex items-center justify-center font-black text-slate-900 shadow-md transition-all ${activeGroupId === g ? 'ring-4 ring-white scale-105' : 'hover:scale-105 opacity-80'}`}
                      style={{ backgroundColor: GROUP_COLORS[(g-1) % GROUP_COLORS.length] }}
                      onClick={() => setActiveGroupId(prev => prev === g ? null : g)}
                    >
                      GRUPPE {g}
                    </button>
                  ))}
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col gap-2">
                  <button 
                    className={`w-full h-10 rounded-xl flex items-center justify-center font-bold text-slate-300 border-2 border-slate-700 border-dashed transition-all ${activeGroupId === 0 ? 'bg-red-500/20 border-red-500 text-red-400' : 'hover:bg-slate-800'}`}
                    onClick={() => setActiveGroupId(0)}
                  >
                    <i className="fa-solid fa-eraser mr-2"></i> Fjern gruppe
                  </button>
                  {activeGroupId !== null && (
                    <button 
                      className="btn btn-xs btn-ghost text-slate-400 hover:text-white"
                      onClick={() => setActiveGroupId(null)}
                    >
                      <i className="fa-solid fa-check mr-1"></i> Avslutt makkergruppe-modus
                    </button>
                  )}
                </div>
             </div>
          </div>
        )}

        {/* 4. Fun Mode Skuff */}
        {!isProjectorMode && (
          <div className={`bg-[#171a25] border-slate-800 flex flex-col z-[49] transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 ${showFunDrawer ? 'w-64 border-r' : 'w-0 border-r-0'}`}>
             <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-[#1a1e2b] whitespace-nowrap min-w-[16rem]">
               <h3 className="text-sm font-bold text-white flex items-center gap-2">
                 <i className="fa-solid fa-wand-magic-sparkles text-pink-400"></i> Fun Mode
               </h3>
               <button className="btn btn-ghost btn-xs btn-square hover:bg-slate-800 text-slate-400" onClick={() => setShowFunDrawer(false)}>
                 <i className="fa-solid fa-xmark"></i>
               </button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-[#171a25] min-w-[16rem] items-center justify-center">
                <div className="text-center">
                  <i className={`fa-solid fa-wand-magic-sparkles text-4xl text-pink-400 mb-2 ${isSpinning ? 'animate-bounce' : ''}`}></i>
                  <h4 className="font-bold text-white text-sm">Elev-Randomiserer</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Spinn klassen for å plassere elevene med spennende visualisering og 100% regel-overholdelse.
                  </p>
                </div>

                <button 
                  className={`btn btn-pink bg-pink-600 hover:bg-pink-500 text-white w-full gap-2 font-bold shadow-lg ${isSpinning ? 'loading' : ''}`}
                  onClick={handleRuleBasedFunSpin}
                  disabled={isSpinning}
                >
                  <i className="fa-solid fa-play"></i> {isSpinning ? 'Spinner...' : 'Spin & Plasser (Med Regler)'}
                </button>
             </div>
          </div>
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

                                  {studentObj ? (
                                    <div 
                                      className={`w-full h-full flex items-center justify-center gap-1 px-1 truncate ${activeGroupId !== null ? '' : 'cursor-move'}`}
                                      onMouseDown={(e) => { if (activeGroupId === null) startDrag(e, studentObj, slotKey); }}
                                      onDoubleClick={() => openNoteModal(studentObj)}
                                    >
                                      {!hideSensitiveInfo && role && <span className="text-[10px]">{role}</span>}
                                      <span className={`truncate ${fontSizeClass} tracking-wide`}>{studentObj.name}</span>
                                    </div>
                                  ) : spinTargetSlot === slotKey ? (
                                    <div className="w-full h-full flex items-center justify-center px-1 bg-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.8)] rounded-lg font-black text-xs truncate z-50 overflow-hidden relative">
                                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                      <span className="relative z-10">{spinTargetStudent ? spinTargetStudent.name : '???'}</span>
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

      {/* Context Menu (Høyreklikk på Bord) */}
      {contextMenu && contextMenu.desk && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)}></div>
          <div 
            className="fixed z-[9999] bg-[#1a1e2b] border border-slate-700 shadow-2xl rounded-xl w-48 overflow-hidden flex flex-col"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 bg-[#202534] border-b border-slate-700 text-xs font-bold text-slate-300 flex justify-between items-center">
              Bord-valg
              {lockedSeats[`${contextMenu.desk.id}_seat_0`] && <i className="fa-solid fa-lock text-red-400"></i>}
            </div>
            
            <button 
              className="px-4 py-2.5 text-left text-sm hover:bg-[#262b3a] text-slate-200 flex items-center gap-2 transition-colors"
              onClick={() => {
                toggleLockDesk(contextMenu.desk.id);
                setContextMenu(null);
              }}
            >
              <i className={`fa-solid ${lockedSeats[`${contextMenu.desk.id}_seat_0`] ? 'fa-unlock text-emerald-400' : 'fa-lock text-red-400'} w-4`}></i>
              {lockedSeats[`${contextMenu.desk.id}_seat_0`] ? 'Lås opp bord' : 'Lås bord'}
            </button>
            
            <div className="border-t border-slate-700/50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-[#171a25]">
              Sett makkergruppe:
            </div>
            <div className="grid grid-cols-4 gap-1 px-3 pb-3 pt-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(g => (
                <button 
                  key={g}
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-slate-900 shadow transition-transform hover:scale-110"
                  style={{ backgroundColor: GROUP_COLORS[(g-1) % GROUP_COLORS.length] }}
                  onClick={() => handleSetGroupContextMenu(g)}
                >
                  {g}
                </button>
              ))}
              <button 
                className="col-span-4 mt-2 h-7 rounded-lg border border-slate-700 text-xs text-slate-400 hover:bg-slate-800 transition-colors"
                onClick={() => handleSetGroupContextMenu(null)}
              >
                Fjern gruppe
              </button>
            </div>
          </div>
        </>
      )}

      {/* Utskriftsvisning — usynlig på skjerm, vises kun av skriveren via @media print (print.css) */}
      <div id="print-overlay">
        <div className="print-header">
          <div>
            <div className="print-chart-name">{chartName || 'Klassekart'}</div>
            <div className="print-meta">
              {classes.find(c => c.id === Number(selectedClass))?.name || ''}
              {chartComment ? ` · ${chartComment}` : ''}
            </div>
          </div>
          <div className="print-meta">{new Date().toLocaleDateString('no-NO')}</div>
        </div>
        <div className="print-canvas-wrapper" style={{ width: '1100px', height: '700px' }}>
          <div
            style={{
              position: 'absolute', left: boardObj.x, top: boardObj.y, width: 256, height: 36,
              border: '1px solid #374151', borderRadius: 18, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', color: '#374151',
            }}
          >
            TAVLE
          </div>
          {desks.map((d) => {
            const cap = d.capacity || 1;
            const deskW = cap * 100;
            const deskNumber = deskNumberMap[d.id] || '';
            return (
              <div key={d.id} className="print-desk" style={{ left: d.x, top: d.y, width: deskW, height: 60 }}>
                <span style={{ position: 'absolute', top: -14, left: -4, fontSize: 10, fontWeight: 700, color: '#555' }}>{deskNumber}</span>
                <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                  {Array.from({ length: cap }).map((_, slotIdx) => {
                    const slotKey = `${d.id}_seat_${slotIdx}`;
                    const studentVal = placements[slotKey];
                    const studentObj = studentVal ? getStudentByIdOrName(studentVal) : null;
                    return (
                      <div
                        key={slotIdx}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: slotIdx > 0 ? '1px solid #e5e7eb' : 'none', overflow: 'hidden' }}
                      >
                        <span className={`print-desk-name ${studentObj ? '' : 'print-desk-empty'}`}>
                          {studentObj ? studentObj.name : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
