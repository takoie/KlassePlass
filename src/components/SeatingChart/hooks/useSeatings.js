import { useState, useRef, useEffect } from 'react';

const normalizeStudent = (s) => {
  if (typeof s === 'string') {
    return { id: `stu-${Math.random().toString(36).substr(2, 9)}`, name: s, note: '' };
  }
  return s && s.id && s.name ? { ...s, note: s.note || '' } : { id: `stu-${Math.random().toString(36).substr(2, 9)}`, name: String(s || ''), note: '' };
};

// Klassekart-CRUD (klasser/rom/klassekart, valg, opprett/slett/lagre), autolagring
// med debounce, periode-håndtering (start ny periode / rediger periode), "flipp rom"
// og "oppdater fra romplan", samt historikk-konflikt-beregning (elever som satt sammen
// i en tidligere periode). `desks`/`boardObj`/`groupOverrides` eies utenfor denne hooken
// (delt med drag-and-drop-, lasso- og fun mode-hookene), og sendes inn som parametre.
export function useSeatings({ initialId, desks, setDesks, boardObj, setBoardObj, groupOverrides, setGroupOverrides }) {
  const [classes, setClasses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [seatings, setSeatings] = useState([]);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedSeatingId, setSelectedSeatingId] = useState('');

  const [chartName, setChartName] = useState('');
  const [chartComment, setChartComment] = useState('Uke 1-4');
  const [saveState, setSaveState] = useState('saved');

  const [placements, setPlacements] = useState({});
  const [lockedSeats, setLockedSeats] = useState({});
  const [studentRoles, setStudentRoles] = useState({});
  const [studentNotes, setStudentNotes] = useState({});
  const [classRules, setClassRules] = useState([]);

  const [allStudents, setAllStudents] = useState([]);
  const [unplacedStudents, setUnplacedStudents] = useState([]);

  const [showHistory, setShowHistory] = useState(false);
  const [historyConflicts, setHistoryConflicts] = useState({});

  const [editingPeriod, setEditingPeriod] = useState(null);
  const [newPeriodWeeks, setNewPeriodWeeks] = useState(4);

  const [canvasLight, setCanvasLightState] = useState(false);

  const saveTimeoutRef = useRef(null);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    window.api?.getSettings?.().then((s) => {
      if (s?.canvasLightMode) setCanvasLightState(true);
    }).catch(() => {});
  }, []);

  const toggleCanvasLight = () => {
    const next = !canvasLight;
    setCanvasLightState(next);
    window.api?.saveSettings?.({ canvasLightMode: next }).catch(() => {});
  };

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
  // lenger og se ut som om alle elevene forsvant. Se "Oppdater romplan"-knappen for bevisst sync.
  const setupNewChartLocal = (cls, rm, currentPlacements, deskSnapshot) => {
    if (deskSnapshot && Array.isArray(deskSnapshot.desks) && deskSnapshot.desks.length) {
      setDesks(deskSnapshot.desks.map(d => ({
        ...d,
        capacity: d.capacity || 1,
        zones: Array.isArray(d.zones) ? d.zones : (d.zone ? [d.zone] : []),
        groupId: d.groupId || null
      })));
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
    // isInitialLoadRef hopper over NØYAKTIG én kjøring — den umiddelbart etter at et
    // klassekart nettopp ble lastet (så vi ikke "lagrer" data vi selv nettopp leste inn).
    // Nullstilles her, IKKE via en tidsbasert setTimeout — en fast frist (f.eks. 100ms)
    // ville stille droppe autolagringen for enhver ekte brukerendring (f.eks. "plasser
    // alle") som skjedde å skje innenfor akkurat det tidsvinduet, uten at noe senere
    // endring noensinne trigget et nytt lagringsforsøk.
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }
    if (!selectedClass || !selectedRoom) return;

    setSaveState('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveCurrentSeating();
    }, 1000);

    return () => clearTimeout(saveTimeoutRef.current);
  }, [placements, lockedSeats, studentRoles, studentNotes, chartName, chartComment, selectedClass, selectedRoom, boardObj, groupOverrides]);

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
                   // Kun fysisk snappede pulter (0px mellomrom) teller som "sitter sammen" —
                   // makkergruppe (fargekode, ikke fysisk plassering) og løs nærhet (f.eks.
                   // raden foran/bak uten at pultene faktisk er snappet) skal IKKE telle.
                   // Snappede pulter har eksakt 0px mellomrom (se computeMagneticSnap i
                   // RoomEditor/geometry.mjs) — GAP_TOLERANCE gir kun litt slingringsmonn
                   // for avrunding, ikke nok til å dekke normal rad-/gruppeavstand (24-35px).
                   const DESK_UNIT_W = 100;
                   const DESK_H = 60;
                   const GAP_TOLERANCE = 4;
                   const ROW_ALIGN_TOLERANCE = 14;

                   const d1Width = (d1.capacity || 1) * DESK_UNIT_W;
                   const d2Width = (d2.capacity || 1) * DESK_UNIT_W;
                   const d1Right = d1.x + d1Width;
                   const d2Right = d2.x + d2Width;
                   const d1Bottom = d1.y + DESK_H;
                   const d2Bottom = d2.y + DESK_H;

                   const isSnappedHorizontal = Math.abs(d1.y - d2.y) < ROW_ALIGN_TOLERANCE &&
                       (Math.abs(d1.x - d2Right) <= GAP_TOLERANCE || Math.abs(d1Right - d2.x) <= GAP_TOLERANCE);
                   const isSnappedVertical = Math.abs(d1.x - d2.x) < ROW_ALIGN_TOLERANCE &&
                       (Math.abs(d1.y - d2Bottom) <= GAP_TOLERANCE || Math.abs(d1Bottom - d2.y) <= GAP_TOLERANCE);

                   if (isSnappedHorizontal || isSnappedVertical) isNeighbor = true;
               }
           }
           if (isNeighbor) pairs.push([p1.studentId, p2.studentId]);
       }
    }
    return pairs;
  };

  // Går bakover gjennom klassekart-historikken (nyeste først) og samler de `maxCount`
  // siste ULIKE elevene denne eleven satt ved siden av (samme bord/snappet, se
  // getNeighbors), på tvers av så mange tidligere kart som nødvendig for å fylle opp.
  const getRecentPartners = (studentId, maxCount = 2) => {
    if (!studentId) return [];
    const pastCharts = seatings
      .filter(s => s.class_id === Number(selectedClass) && s.id !== Number(selectedSeatingId))
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    const foundIds = [];
    for (const c of pastCharts) {
      if (foundIds.length >= maxCount) break;
      let chartPlacements;
      try {
        const p = JSON.parse(c.placements || '{}');
        chartPlacements = p.placements || p;
      } catch (e) { continue; }

      const neighbors = getNeighbors(chartPlacements);
      for (const [s1, s2] of neighbors) {
        if (foundIds.length >= maxCount) break;
        let partnerId = null;
        if (s1 === studentId) partnerId = s2;
        else if (s2 === studentId) partnerId = s1;
        if (partnerId && !foundIds.includes(partnerId)) foundIds.push(partnerId);
      }
    }

    return foundIds.map(id => getStudentByIdOrName(id)).filter(Boolean).map(s => s.name);
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
       .filter(s => s.class_id === Number(selectedClass) && s.id !== Number(selectedSeatingId))
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
        deskLayout: { desks, boardObj }
      });

      const result = await window.api.saveSeating({
        id: selectedSeatingId || null,
        name: chartName.trim(),
        classId: Number(selectedClass),
        roomId: Number(selectedRoom),
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
        deskLayout: { desks, boardObj }
      });

      const result = await window.api.saveSeating({
        id: null,
        name: newName,
        classId: Number(selectedClass),
        roomId: Number(selectedRoom),
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
    if (!editingPeriod || !editingPeriod.name?.trim()) return;
    try {
      const existing = seatings.find(s => s.id === editingPeriod.id);
      if (existing) {
        await window.api.saveSeating({
          id: existing.id,
          name: editingPeriod.name.trim(),
          comment: editingPeriod.comment,
          classId: existing.class_id,
          roomId: existing.room_id,
          placements: existing.placements
        });
        const newSeatings = await window.api.getSeatings();
        setSeatings(newSeatings);
        if (existing.id === Number(selectedSeatingId)) {
          setChartName(editingPeriod.name.trim());
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
      const newSeatings = await window.api.getSeatings();
      setSeatings(newSeatings);

      // Alltid gjennom handleSelectSeating (aldri hopp over den) — den er stedet som
      // friskt regner ut allStudents/unplacedStudents fra klasselisten. Hopper vi over
      // den (som før, når ingen kart var igjen) forblir "uplassert"-lista den gamle,
      // nesten tomme verdien fra det slettede kartet i stedet for full klasseliste,
      // og elevene så ut som de forsvant fra administrer-skuffen.
      const sameClassSeatings = newSeatings.filter(s => s.class_id === Number(selectedClass));
      if (sameClassSeatings.length > 0) {
        handleSelectSeating(sameClassSeatings[0].id, newSeatings);
      } else {
        handleSelectSeating('', newSeatings);
      }
    } catch (e) {}
  };

  const flipRoom = () => {
    if (desks.length === 0) return;
    // Speiles rundt canvasets faste senter (1100×700), samme referanse som
    // RoomEditors flipLayoutData bruker. Tavlen ligger normalt utenfor
    // pultenes bounding box, så et senter regnet ut fra kun pultene ville
    // gitt en annen speilingsakse enn den tavlens posisjon opprinnelig var
    // satt relativt til — og tavlen havnet skjevt i forhold til pultene.
    const centerX = 1100 / 2;
    const centerY = 700 / 2;

    setDesks(desks.map(d => ({
      ...d,
      x: Math.max(10, Math.min(1100 - (d.capacity || 1) * 100 - 10, Math.round((2 * centerX - d.x - ((d.capacity || 1) * 100)) / 10) * 10)),
      y: Math.max(70, Math.min(700 - 60 - 10, Math.round((2 * centerY - d.y - 60) / 10) * 10))
    })));

    // Tavlen er 256×36px på skjermen (w-64 h-9) — speilingen må bruke disse
    // faktiske målene, ikke de gamle 240×40, ellers havner tavlen noen px
    // forskjøvet fra sin egentlige speilvendte posisjon i forhold til pultene.
    setBoardObj(prev => ({
      x: Math.max(10, Math.min(1100 - 256 - 10, Math.round((2 * centerX - prev.x - 256) / 10) * 10)),
      y: Math.max(10, Math.min(700 - 36 - 10, Math.round((2 * centerY - prev.y - 36) / 10) * 10))
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

  return {
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
  };
}
