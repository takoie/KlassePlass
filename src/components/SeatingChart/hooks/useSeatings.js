import { useState, useRef, useEffect } from 'react';

// Gruppenøkkelen for en seating-rad. Etter v12-backfyllingen har hver rad en
// ikke-tom chart_group; fallbacken ("c{class_id}") dekker bare kort tid før
// backfyllingen har kjørt, og importerte rader uten verdi.
const groupOf = (s) => s?.chart_group || (s?.class_id != null ? `c${s.class_id}` : null);

// Kronologisk rekkefølge for to periode-rader: eldst først, med rad-id som
// tie-break når created_at er lik (id-en er monotont økende). Brukes både til
// sortering og til «er denne perioden eldre enn den åpne?».
const periodOrder = (a, b) =>
  (new Date(a?.created_at || 0) - new Date(b?.created_at || 0)) || (Number(a?.id) - Number(b?.id));

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
export function useSeatings({ initialId, desks, setDesks, boardObj, setBoardObj, groupOverrides, setGroupOverrides, onBack }) {
  const [classes, setClasses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [seatings, setSeatings] = useState([]);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedSeatingId, setSelectedSeatingId] = useState('');
  // Hvilket klassekart (sett av periode-rader) den aktive perioden tilhører.
  // Alle "perioder for dette kartet"-oppslag (nedtrekk, elevhistorikk, sletting)
  // filtreres på denne, IKKE på class_id — ellers blandes to bevisst adskilte
  // klassekart på samme klasse sammen. Se schema::backfill_chart_group.
  const [chartGroup, setChartGroup] = useState(null);

  const [chartName, setChartName] = useState('');
  const [chartComment, setChartComment] = useState('Uke 1-4');
  const [saveState, setSaveState] = useState('saved');

  const [placements, setPlacements] = useState({});
  const [lockedSeats, setLockedSeats] = useState({});
  // Seter markert "ubrukt" for DETTE klassekartet - ekskluderes fra Bordnummer-tellingen
  // og fra Randomiser/Plasser alle/Fun Modes (se buildOpenSeatSlots i useFunModes.js),
  // men kan fortsatt fylles manuelt (som fjerner ubrukt-merkingen automatisk).
  const [unusedSeats, setUnusedSeats] = useState({});
  const [studentRoles, setStudentRoles] = useState({});
  const [studentNotes, setStudentNotes] = useState({});
  const [classRules, setClassRules] = useState([]);

  const [allStudents, setAllStudents] = useState([]);
  const [unplacedStudents, setUnplacedStudents] = useState([]);

  const [showHistory, setShowHistory] = useState(true);
  const [historyConflicts, setHistoryConflicts] = useState({});

  const [editingPeriod, setEditingPeriod] = useState(null);
  const [newPeriodWeeks, setNewPeriodWeeks] = useState(4);

  const [canvasLight, setCanvasLightState] = useState(false);

  const saveTimeoutRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const latestSeatingDataRef = useRef({
    selectedSeatingId, selectedClass, selectedRoom, chartGroup, chartName, chartComment,
    placements, lockedSeats, unusedSeats, studentRoles, studentNotes, groupOverrides, desks, boardObj
  });
  const pendingSaveRef = useRef(false);

  useEffect(() => {
    latestSeatingDataRef.current = {
      selectedSeatingId, selectedClass, selectedRoom, chartGroup, chartName, chartComment,
      placements, lockedSeats, unusedSeats, studentRoles, studentNotes, groupOverrides, desks, boardObj
    };
  });

  useEffect(() => {
    return () => {
      if (pendingSaveRef.current && latestSeatingDataRef.current) {
        const {
          selectedSeatingId: sid, selectedClass: sc, selectedRoom: sr, chartGroup: cg,
          chartName: cn, chartComment: cc, placements: pl, lockedSeats: ls, unusedSeats: us,
          studentRoles: sRoles, studentNotes: sNotes, groupOverrides: go,
          desks: ds, boardObj: bo
        } = latestSeatingDataRef.current;

        if (sc && sr && cn?.trim()) {
          const savePayload = JSON.stringify({
            placements: pl,
            lockedSeats: ls,
            unusedSeats: us,
            studentRoles: sRoles,
            studentNotes: sNotes,
            groupOverrides: go,
            deskLayout: { desks: ds, boardObj: bo }
          });
          window.api.saveSeating({
            // sid kan være en streng når perioden ble valgt via nedtrekket
            // (Select gir tilbake String(value)) - backend krever i64, så
            // en streng-id gjør at lagringen stille feiler.
            id: sid ? Number(sid) : null,
            name: cn.trim(),
            classId: Number(sc),
            roomId: Number(sr),
            placements: savePayload,
            comment: cc,
            chartGroup: cg || undefined
          }).catch(() => {});
        }
      }
    };
  }, []);

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
          setChartGroup(groupOf(seating));
          setChartName(seating.name);
          setChartComment(seating.comment || 'Uke 1-4');

          let parsedPlacements = {};
          let deskSnapshot = null;
          try {
            const extraData = seating.placements ? JSON.parse(seating.placements) : {};
            if (extraData.placements) {
              parsedPlacements = extraData.placements;
              setLockedSeats(extraData.lockedSeats || {});
              setUnusedSeats(extraData.unusedSeats || {});
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

        // Rens bort eventuelle plasseringer for elever som er slettet fra klassen, og dedupliser
        const validIds = new Set(stuList.flatMap(s => [s.id, s.name]));
        const seenStudentIds = new Set();
        const cleanedPlacements = {};

        // Prioriter først låste seter så låste elever beholder sin plass
        for (const [slotKey, val] of Object.entries(currentPlacements || {})) {
          if (val && validIds.has(val) && lockedSeats[slotKey] && !seenStudentIds.has(val)) {
            seenStudentIds.add(val);
            cleanedPlacements[slotKey] = val;
          }
        }
        // Deretter ulåste seter
        for (const [slotKey, val] of Object.entries(currentPlacements || {})) {
          if (val && validIds.has(val) && !cleanedPlacements[slotKey] && !seenStudentIds.has(val)) {
            seenStudentIds.add(val);
            cleanedPlacements[slotKey] = val;
          }
        }
        setPlacements(cleanedPlacements);

        const placedIds = Object.values(cleanedPlacements);
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

    pendingSaveRef.current = true;
    setSaveState('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await saveCurrentSeating();
      pendingSaveRef.current = false;
    }, 1000);

    return () => clearTimeout(saveTimeoutRef.current);
  }, [placements, lockedSeats, unusedSeats, studentRoles, studentNotes, chartName, chartComment, selectedClass, selectedRoom, boardObj, groupOverrides]);

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
    // KUN perioder som ligger FØR den åpne perioden kronologisk. Uten dette ville
    // en eldre periode man går tilbake til fått «historikk» fra perioder som ble
    // laget etterpå - de fremstår da som om den gamle perioden var den nyeste.
    const current = seatings.find(s => Number(s.id) === Number(selectedSeatingId));
    const pastCharts = seatings
      .filter(s => groupOf(s) === chartGroup && Number(s.id) !== Number(selectedSeatingId) && (!current || periodOrder(s, current) < 0))
      .sort((a, b) => periodOrder(b, a));

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

    // Se getRecentPartners: kun perioder FØR den åpne perioden teller som
    // «tidligere» - ellers viser en gammel periode konflikter mot perioder som
    // ble opprettet senere.
    const current = seatings.find(s => Number(s.id) === Number(selectedSeatingId));
    const pastCharts = seatings
       .filter(s => groupOf(s) === chartGroup && Number(s.id) !== Number(selectedSeatingId) && (!current || periodOrder(s, current) < 0))
       .sort((a,b) => periodOrder(b, a))
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
  }, [showHistory, placements, selectedClass, selectedSeatingId, seatings, desks, chartGroup]);

  const handleSelectSeating = async (id, seatingsList = seatings) => {
    // Skyll en ventende autolagring FØR vi bytter kart, ellers ryddes den
    // debouncede timeren under (via isInitialLoadRef) og en endring gjort det
    // siste sekundet på DET FORRIGE kartet ville gått tapt.
    if (pendingSaveRef.current) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      await saveCurrentSeating();
      pendingSaveRef.current = false;
    }
    isInitialLoadRef.current = true;
    // Select gir id-en tilbake som streng. Lagres den rått blir selectedSeatingId
    // en streng, og hver påfølgende autolagring sender { id: "3" } til backend
    // som krever i64 - kallet feiler stille og lagre-statusen henger på "Lagrer…".
    const normId = (id === '' || id == null) ? '' : Number(id);
    const seating = seatingsList.find(s => s.id === Number(id));
    if (!seating) {
      setSelectedSeatingId('');
      setChartGroup(null);
      setChartName('Nytt klassekart');
      setChartComment('Uke 1-4');
      setPlacements({});
      setLockedSeats({});
      setUnusedSeats({});
      setStudentRoles({});
      setStudentNotes({});
      if (selectedClass && selectedRoom) setupNewChart(selectedClass, selectedRoom, {});
    } else {
      setSelectedSeatingId(normId);
      setSelectedClass(seating.class_id);
      setSelectedRoom(seating.room_id);
      setChartGroup(groupOf(seating));
      setChartName(seating.name);
      setChartComment(seating.comment || 'Uke 1-4');

      let parsedPlacements = {};
      let deskSnapshot = null;
      try {
        const extraData = seating.placements ? JSON.parse(seating.placements) : {};
        if (extraData.placements) {
          parsedPlacements = extraData.placements;
          setLockedSeats(extraData.lockedSeats || {});
          setUnusedSeats(extraData.unusedSeats || {});
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

        // Rens bort eventuelle plasseringer for elever som er slettet fra klassen, og dedupliser
        const validIds = new Set(stuList.flatMap(s => [s.id, s.name]));
        const seenStudentIds = new Set();
        const cleanedPlacements = {};

        // Prioriter først låste seter så låste elever beholder sin plass
        for (const [slotKey, val] of Object.entries(currentPlacements || {})) {
          if (val && validIds.has(val) && lockedSeats[slotKey] && !seenStudentIds.has(val)) {
            seenStudentIds.add(val);
            cleanedPlacements[slotKey] = val;
          }
        }
        // Deretter ulåste seter
        for (const [slotKey, val] of Object.entries(currentPlacements || {})) {
          if (val && validIds.has(val) && !cleanedPlacements[slotKey] && !seenStudentIds.has(val)) {
            seenStudentIds.add(val);
            cleanedPlacements[slotKey] = val;
          }
        }
        setPlacements(cleanedPlacements);

        const placedIds = Object.values(cleanedPlacements);
        setUnplacedStudents(stuList.filter(s => !placedIds.includes(s.id) && !placedIds.includes(s.name)));
      } catch (e) {
        setAllStudents([]);
        setUnplacedStudents([]);
        setClassRules([]);
      }
    }
  };

  const getStudentByIdOrName = (idOrName) => {
    if (!idOrName) return null;
    return allStudents.find(s => s.id === idOrName || s.name === idOrName) || null;
  };

  const saveCurrentSeating = async () => {
    if (!selectedClass || !selectedRoom || !chartName.trim()) return;
    try {
      const savePayload = JSON.stringify({
        placements,
        lockedSeats,
        unusedSeats,
        studentRoles,
        studentNotes,
        groupOverrides,
        // Frosset kopi av bordoppsettet. Uten denne ville rom-redigering (spesielt
        // Hurtiglayout, som gir alle bord nye IDer) stille gjøre alle plasseringer
        // her foreldreløse neste gang kartet åpnes.
        deskLayout: { desks, boardObj }
      });

      const result = await window.api.saveSeating({
        // Alltid tall (eller null) - backend krever i64. Se handleSelectSeating.
        id: selectedSeatingId ? Number(selectedSeatingId) : null,
        name: chartName.trim(),
        classId: Number(selectedClass),
        roomId: Number(selectedRoom),
        placements: savePayload,
        comment: chartComment,
        // Utelates ved aller første lagring av et blankt utkast — backend
        // tildeler da "s{id}". Ellers holder vi raden i samme gruppe.
        chartGroup: chartGroup || undefined
      });
      if (!selectedSeatingId && result.lastID) {
        setSelectedSeatingId(result.lastID);
      }
      const newSeatings = await window.api.getSeatings();
      setSeatings(newSeatings);
      if (!chartGroup && result.lastID) {
        const saved = newSeatings.find(s => s.id === Number(result.lastID));
        if (saved) setChartGroup(groupOf(saved));
      }
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
    // Behold kartets navn på tvers av perioder, slik at et kart som ble gitt et
    // eget navn ikke stille bytter til klassenavnet ved hver "Ny periode".
    const newName = chartName?.trim() || classes.find(c => c.id === Number(selectedClass))?.name || 'Klassekart';

    try {
      const savePayload = JSON.stringify({
        placements,
        lockedSeats,
        unusedSeats,
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
        comment: newComment,
        // Ny periode av SAMME klassekart — arver gruppen så historikk/nedtrekk
        // henger sammen. Faller tilbake til class-gruppa for eldre kart.
        chartGroup: chartGroup || `c${Number(selectedClass)}`
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

      const sameChartSeatings = newSeatings.filter(s => groupOf(s) === chartGroup);
      if (sameChartSeatings.length > 0) {
        // Alltid gjennom handleSelectSeating (aldri hopp over den) — den er stedet som
        // friskt regner ut allStudents/unplacedStudents fra klasselisten. Hopper vi over
        // den forblir "uplassert"-lista den gamle, nesten tomme verdien fra det slettede
        // kartet i stedet for full klasseliste, og elevene så ut som de forsvant fra
        // administrer-skuffen.
        handleSelectSeating(sameChartSeatings[0].id, newSeatings);
      } else if (onBack) {
        // Ingen perioder igjen for denne klassen — i stedet for å late som ingenting
        // skjedde ved å bygge et blankt, ulagret utkast-kart i samme visning (periode-
        // nedtrekket ville da bare vist et tomt <select> uten valg), send brukeren
        // tilbake til klassekart-oversikten der de bevisst kan opprette en ny periode.
        onBack();
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

    // Bordets boks flyttes riktig til sitt speilede punkt over, men en 180°-rotasjon
    // snur også venstre/høyre-rekkefølgen INNI hvert bord. Uten dette blir eleven i
    // sete 0 værende i "sete 0" av det flyttede bordet, selv om sete 0 fysisk skal
    // tilsvare det gamle siste setet — det er det som gjorde elevene speilvendte
    // og fikk feil (autoberegnet) plassnummer etter snuing.
    const reverseSeatOrder = (obj) => {
      const next = { ...obj };
      desks.forEach(d => {
        const cap = d.capacity || 1;
        if (cap < 2) return;
        for (let i = 0; i < Math.floor(cap / 2); i++) {
          const keyA = `${d.id}_seat_${i}`;
          const keyB = `${d.id}_seat_${cap - 1 - i}`;
          const hasA = Object.prototype.hasOwnProperty.call(obj, keyA);
          const hasB = Object.prototype.hasOwnProperty.call(obj, keyB);
          if (hasA) next[keyB] = obj[keyA]; else delete next[keyB];
          if (hasB) next[keyA] = obj[keyB]; else delete next[keyA];
        }
      });
      return next;
    };

    setPlacements(prev => reverseSeatOrder(prev));
    setLockedSeats(prev => reverseSeatOrder(prev));
    setUnusedSeats(prev => reverseSeatOrder(prev));
  };

  // Merker/fjerner "ubrukt"-status på ett sete. Brukes fra høyreklikk-menyen på et
  // tomt sete for å bevisst holde det utenfor Bordnummer-tellingen og utenfor
  // Randomiser/Plasser alle/Fun Modes (se buildOpenSeatSlots i useFunModes.js) - f.eks.
  // for å lage et tomrom mellom to rader uten at randomisering fyller det igjen.
  const toggleSeatUnused = (slotKey) => {
    if (!slotKey) return;
    setUnusedSeats(prev => {
      const next = { ...prev };
      if (next[slotKey]) delete next[slotKey];
      else next[slotKey] = true;
      return next;
    });
  };

  // Fjerner "skjul plass"-merkingen for alle seter på ett bord — angre-veien når
  // et bord har kollapsede plasser og det ikke lenger finnes et sete å høyreklikke.
  const restoreDeskSeats = (deskId) => {
    if (deskId == null) return;
    setUnusedSeats(prev => {
      const next = {};
      let changed = false;
      for (const key of Object.keys(prev)) {
        if (key.startsWith(`${deskId}_seat_`)) { changed = true; continue; }
        next[key] = prev[key];
      }
      return changed ? next : prev;
    });
  };

  // Henter romets NÅVÆRENDE oppsett og erstatter bord-snapshotet i dette klassekartet.
  // Bord-IDer eller seter som ikke lenger finnes i rommet mister plasseringen sin (studenten havner
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

      // Bygg liste over alle eksakte gyldige slotKeys i det nye oppsettet
      const validSlotKeys = new Set();
      newDesks.forEach(d => {
        const cap = d.capacity || 1;
        for (let s = 0; s < cap; s++) {
          validSlotKeys.add(`${d.id}_seat_${s}`);
        }
      });

      setDesks(newDesks);
      setBoardObj(layout.boardObj || { x: 422, y: 15 });

      setPlacements(prev => {
        const next = {};
        for (const [slotKey, val] of Object.entries(prev)) {
          if (validSlotKeys.has(slotKey)) next[slotKey] = val;
        }
        const keptIds = Object.values(next);
        setUnplacedStudents(allStudents.filter(s => !keptIds.includes(s.id) && !keptIds.includes(s.name)));
        return next;
      });

      setLockedSeats(prev => {
        const next = {};
        for (const [slotKey, val] of Object.entries(prev)) {
          if (validSlotKeys.has(slotKey)) next[slotKey] = val;
        }
        return next;
      });

      setUnusedSeats(prev => {
        const next = {};
        for (const [slotKey, val] of Object.entries(prev)) {
          if (validSlotKeys.has(slotKey)) next[slotKey] = val;
        }
        return next;
      });
    } catch (e) {}
    document.getElementById('modal_sync_room')?.close();
  };

  // Løsriver den aktive perioden fra klassekartet den deler historikk/nedtrekk
  // med — den blir sitt eget kart ("s{id}"). Brukes fra rediger-modalen når to
  // bevisst adskilte kart har havnet i samme gruppe (typisk gamle kart der
  // v12-backfyllingen ikke kunne skille dem trygt på navn).
  const splitToNewChart = async () => {
    if (!selectedSeatingId) return;
    const newGroup = `s${selectedSeatingId}`;
    try {
      await window.api.setSeatingChartGroup(selectedSeatingId, newGroup);
      const ns = await window.api.getSeatings();
      setSeatings(ns);
      setChartGroup(newGroup);
      setSaveState('saved');
      document.getElementById('modal_edit_period')?.close();
    } catch (e) {}
  };

  // Antall perioder som deler kart med den aktive — > 1 betyr at "skill ut"
  // faktisk har en effekt (og at "Slett" gjelder bare denne perioden).
  const chartPeriodCount = seatings.filter(s => groupOf(s) === chartGroup).length;

  return {
    classes, rooms, seatings,
    chartGroup, splitToNewChart, chartPeriodCount,
    selectedClass, setSelectedClass, selectedRoom, setSelectedRoom, selectedSeatingId,
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
    canvasLight, toggleCanvasLight
  };
}
