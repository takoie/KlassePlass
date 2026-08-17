import { useState, useRef, useEffect } from 'react';
import { findBestPlacement } from '../../../lib/seatingSolver.mjs';

// Automatisk plassering ("Fyll automatisk"/"Trekk klasse") og alle fem
// "fun modes" (Rulett, Randombombe, Musikkstoler, Makkerbytte, Spotlight),
// pluss gradvis avdekking ("Reveal"). Delte fun modes viser `funModeGhosts`
// OPPÅ de virkelige `placements` for de aktuelle setene under en kjøring —
// selve `placements` (og dermed autolagringen) røres ikke før resultatet er
// avgjort, bortsett fra Roulette som committer én elev om gangen.
export function useFunModes({
  desks, boardObj, placements, setPlacements, lockedSeats,
  allStudents, unplacedStudents, setUnplacedStudents, classRules,
  groupOverrides, getStudentByIdOrName
}) {
  const [activeFunMode, setActiveFunMode] = useState(null); // 'roulette' | 'randombomb' | 'musikkstoler' | 'makkerbytte' | 'spotlight' | null
  const [funModeGhosts, setFunModeGhosts] = useState(null); // { [slotKey]: studentId | null } | null
  const [bombCountdown, setBombCountdown] = useState(null);
  const [bombBoom, setBombBoom] = useState(false);
  const [spotlightSlotKey, setSpotlightSlotKey] = useState(null);

  // Gradvis avdekking (del av Fun Mode)
  const [revealMode, setRevealMode] = useState(false);
  const [revealOrder, setRevealOrder] = useState([]);
  const [revealedSlots, setRevealedSlots] = useState(new Set());

  const funModeTimerRef = useRef(null);
  const funModeFinalRef = useRef(null); // beregnet sluttresultat for gjeldende kjøring
  const funModePreStateRef = useRef(null); // placements før Randombomb startet (for avbrytelse)

  // Sorterer seteplasser etter bordnummer (logisk posisjon i rommet, fra tavlen og utover)
  // slik at "de første N plassene" alltid betyr "de N plassene nærmest start på et fullt bord
  // først" — ingen elev havner alene ved et bord mens et tidligere bord står halvfullt.
  const sortSlotsByDeskOrder = (slots) => {
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

    return [...slots].sort((a, b) => {
      const num1 = deskNumberMap[a.deskId] || 999;
      const num2 = deskNumberMap[b.deskId] || 999;
      if (num1 === num2) return a.slotIdx - b.slotIdx;
      return num1 - num2;
    });
  };

  const handleAutoFill = () => {
    const seatSlots = buildOpenSeatSlots();
    if (seatSlots.length === 0) return;

    const basePlacements = { ...placements };
    seatSlots.forEach(slot => delete basePlacements[slot.slotKey]);

    const placedStudentIds = new Set(Object.values(basePlacements));
    const availableStudents = unplacedStudents.filter(st => !placedStudentIds.has(st.id) && !placedStudentIds.has(st.name));
    if (availableStudents.length === 0) return;

    const sortedSlots = sortSlotsByDeskOrder(seatSlots, desks, boardObj);
    const targetSlots = sortedSlots.slice(0, availableStudents.length);

    const { placements: bestCandidate } = findBestPlacement({
      seatSlots: targetSlots,
      students: availableStudents,
      basePlacements,
      classRules,
      desks,
    });

    const finalPlacedVals = new Set(Object.values(bestCandidate));
    const finalUnplaced = allStudents.filter(s => !finalPlacedVals.has(s.id) && !finalPlacedVals.has(s.name));

    setPlacements(bestCandidate);
    setUnplacedStudents(finalUnplaced);
  };

  // Randomiserer elevplassering umiddelbart (ingen animasjon) — bruker den delte
  // regelmotoren i src/lib/seatingSolver.mjs (samme motor som Roulette/Randombomb/
  // Musikkstoler/Makkerbytte bruker for å beregne SITT sluttresultat).
  const handleRuleBasedFunSpin = () => {
    const seatSlots = buildOpenSeatSlots();
    if (seatSlots.length === 0 || allStudents.length === 0) return;

    const basePlacements = { ...placements };
    seatSlots.forEach(slot => delete basePlacements[slot.slotKey]);

    const placedStudentIds = new Set(Object.values(basePlacements));
    const availableStudents = allStudents.filter(st => !placedStudentIds.has(st.id) && !placedStudentIds.has(st.name));
    if (availableStudents.length === 0) return;

    const sortedSlots = sortSlotsByDeskOrder(seatSlots, desks, boardObj);
    const targetSlots = sortedSlots.slice(0, availableStudents.length);

    const { placements: topPlacements } = findBestPlacement({
      seatSlots: targetSlots,
      students: availableStudents,
      basePlacements,
      classRules,
      desks,
    });

    setPlacements(topPlacements);
    const finalVals = new Set(Object.values(topPlacements));
    setUnplacedStudents(allStudents.filter(s => !finalVals.has(s.id) && !finalVals.has(s.name)));
  };

  const clearFunModeTimer = () => {
    if (funModeTimerRef.current) {
      clearTimeout(funModeTimerRef.current);
      funModeTimerRef.current = null;
    }
  };

  // Rydder opp løpende animasjoner hvis komponenten forlates (naviger bort) midt i en
  // fun mode-kjøring.
  useEffect(() => () => clearFunModeTimer(), []);

  // Setter det endelige, ekte resultatet og oppdaterer uplasserte-listen deretter.
  const applyFunModeResult = (finalPlacements) => {
    setPlacements(finalPlacements);
    const finalVals = new Set(Object.values(finalPlacements));
    setUnplacedStudents(allStudents.filter(s => !finalVals.has(s.id) && !finalVals.has(s.name)));
  };

  // Felles avslutning: stopper timer, fjerner spøkelses-/nedtellings-visning. Rører
  // ALDRI spotlightSlotKey — den gule uthevningen skal stå til neste trekning.
  const endFunMode = () => {
    clearFunModeTimer();
    setFunModeGhosts(null);
    setBombCountdown(null);
    setBombBoom(false);
    setActiveFunMode(null);
    funModeFinalRef.current = null;
    funModePreStateRef.current = null;
  };

  // Bygger listen av ikke-låste seteplasser for hele klasserommet — brukt av alle fem
  // fun modes (Makkerbytte bruker en egen, filtrert variant, se under).
  const buildOpenSeatSlots = () => {
    const seatSlots = [];
    desks.forEach(d => {
      const cap = d.capacity || 1;
      for (let s = 0; s < cap; s++) {
        const slotKey = `${d.id}_seat_${s}`;
        if (!lockedSeats[slotKey]) seatSlots.push({ slotKey, deskId: d.id, slotIdx: s, desk: d });
      }
    });
    return seatSlots;
  };

  const ROULETTE_HOP_DELAYS = [90, 100, 120, 150, 190, 250]; // ms per hopp, bremser ned
  const ROULETTE_PAUSE_AFTER_LANDING = 150; // ms før neste elev starter

  const startRoulette = () => {
    if (activeFunMode || revealMode) return;
    const seatSlots = buildOpenSeatSlots();
    if (seatSlots.length === 0 || allStudents.length === 0) return;

    const basePlacements = { ...placements };
    seatSlots.forEach(slot => delete basePlacements[slot.slotKey]);

    const placedStudentIds = new Set(Object.values(basePlacements));
    const availableStudents = allStudents.filter(st => !placedStudentIds.has(st.id) && !placedStudentIds.has(st.name));
    if (availableStudents.length === 0) return;

    const sortedSlots = sortSlotsByDeskOrder(seatSlots, desks, boardObj);
    const targetSlots = sortedSlots.slice(0, availableStudents.length);

    const { placements: finalPlacements } = findBestPlacement({
      seatSlots: targetSlots,
      students: availableStudents,
      basePlacements,
      classRules,
      desks,
    });

    const revealOrderIds = availableStudents
      .map(s => s.id)
      .filter(id => Object.values(finalPlacements).includes(id))
      .sort(() => Math.random() - 0.5);

    funModeFinalRef.current = finalPlacements;
    setActiveFunMode('roulette');
    setPlacements(basePlacements);
    runRouletteStep(revealOrderIds, finalPlacements, basePlacements, 0);
  };

  const runRouletteStep = (order, finalPlacements, committedPlacements, idx) => {
    if (idx >= order.length) {
      applyFunModeResult(finalPlacements);
      endFunMode();
      return;
    }

    const studentId = order[idx];
    const finalSlotKey = Object.keys(finalPlacements).find(k => finalPlacements[k] === studentId);
    const openSlots = Object.keys(finalPlacements).filter(k => !committedPlacements[k] && k !== finalSlotKey);
    const hopPool = openSlots.length > 0 ? openSlots : [finalSlotKey];
    const hopSlotKeys = ROULETTE_HOP_DELAYS.map(() => hopPool[Math.floor(Math.random() * hopPool.length)]);

    const runHop = (hopIdx) => {
      if (hopIdx >= hopSlotKeys.length) {
        const updated = { ...committedPlacements, [finalSlotKey]: studentId };
        setFunModeGhosts(null);
        setPlacements(updated);
        funModeTimerRef.current = setTimeout(
          () => runRouletteStep(order, finalPlacements, updated, idx + 1),
          ROULETTE_PAUSE_AFTER_LANDING
        );
        return;
      }
      setFunModeGhosts({ [hopSlotKeys[hopIdx]]: studentId });
      funModeTimerRef.current = setTimeout(() => runHop(hopIdx + 1), ROULETTE_HOP_DELAYS[hopIdx]);
    };

    runHop(0);
  };

  const stopRoulette = () => {
    if (!funModeFinalRef.current) return;
    clearFunModeTimer();
    applyFunModeResult(funModeFinalRef.current);
    endFunMode();
  };

  const RANDOMBOMB_TICK_MS = 700;

  const startRandombomb = () => {
    if (activeFunMode || revealMode) return;
    const seatSlots = buildOpenSeatSlots();
    if (seatSlots.length === 0 || allStudents.length === 0) return;

    const basePlacements = { ...placements };
    seatSlots.forEach(slot => delete basePlacements[slot.slotKey]);

    const placedStudentIds = new Set(Object.values(basePlacements));
    const availableStudents = allStudents.filter(st => !placedStudentIds.has(st.id) && !placedStudentIds.has(st.name));
    if (availableStudents.length === 0) return;

    const sortedSlots = sortSlotsByDeskOrder(seatSlots, desks, boardObj);
    const targetSlots = sortedSlots.slice(0, availableStudents.length);

    const { placements: finalPlacements } = findBestPlacement({
      seatSlots: targetSlots,
      students: availableStudents,
      basePlacements,
      classRules,
      desks,
    });

    funModeFinalRef.current = finalPlacements;
    funModePreStateRef.current = { ...placements };
    setActiveFunMode('randombomb');
    runBombTick(targetSlots, availableStudents, 5);
  };

  const runBombTick = (targetSlots, students, count) => {
    setBombCountdown(count);

    if (count <= 1) {
      funModeTimerRef.current = setTimeout(() => {
        setFunModeGhosts(null);
        applyFunModeResult(funModeFinalRef.current);
        setBombBoom(true);
        funModeTimerRef.current = setTimeout(() => endFunMode(), 500);
      }, RANDOMBOMB_TICK_MS);
      return;
    }

    const shuffledStudents = [...students].sort(() => Math.random() - 0.5);
    const shuffledSlots = [...targetSlots].sort(() => Math.random() - 0.5);
    const ghostMap = {};
    shuffledSlots.forEach((slot, idx) => {
      ghostMap[slot.slotKey] = idx < shuffledStudents.length ? shuffledStudents[idx].id : null;
    });
    setFunModeGhosts(ghostMap);

    funModeTimerRef.current = setTimeout(() => runBombTick(targetSlots, students, count - 1), RANDOMBOMB_TICK_MS);
  };

  const cancelRandombomb = () => {
    clearFunModeTimer();
    if (funModePreStateRef.current) setPlacements(funModePreStateRef.current);
    endFunMode();
  };

  const FUN_FLASH_COUNT = 5;
  const FUN_FLASH_MS = 120;

  // Rask "alle stoler flimrer"-animasjon uten nedtelling — brukes av både Musikkstoler
  // og Makkerbytte (som sender inn en begrenset targetSlots/students-delmengde).
  const runFlashTick = (targetSlots, students, remaining) => {
    if (remaining <= 0) {
      setFunModeGhosts(null);
      applyFunModeResult(funModeFinalRef.current);
      endFunMode();
      return;
    }

    const shuffledStudents = [...students].sort(() => Math.random() - 0.5);
    const shuffledSlots = [...targetSlots].sort(() => Math.random() - 0.5);
    const ghostMap = {};
    shuffledSlots.forEach((slot, idx) => {
      ghostMap[slot.slotKey] = idx < shuffledStudents.length ? shuffledStudents[idx].id : null;
    });
    setFunModeGhosts(ghostMap);

    funModeTimerRef.current = setTimeout(() => runFlashTick(targetSlots, students, remaining - 1), FUN_FLASH_MS);
  };

  const startMusikkstoler = () => {
    if (activeFunMode || revealMode) return;
    const seatSlots = buildOpenSeatSlots();
    if (seatSlots.length === 0 || allStudents.length === 0) return;

    const basePlacements = { ...placements };
    seatSlots.forEach(slot => delete basePlacements[slot.slotKey]);

    const placedStudentIds = new Set(Object.values(basePlacements));
    const availableStudents = allStudents.filter(st => !placedStudentIds.has(st.id) && !placedStudentIds.has(st.name));
    if (availableStudents.length === 0) return;

    const sortedSlots = sortSlotsByDeskOrder(seatSlots, desks, boardObj);
    const targetSlots = sortedSlots.slice(0, availableStudents.length);

    const { placements: finalPlacements } = findBestPlacement({
      seatSlots: targetSlots,
      students: availableStudents,
      basePlacements,
      classRules,
      desks,
    });

    funModeFinalRef.current = finalPlacements;
    setActiveFunMode('musikkstoler');
    runFlashTick(targetSlots, availableStudents, FUN_FLASH_COUNT);
  };

  const startMakkerbytte = () => {
    if (activeFunMode || revealMode) return;

    const groupedDesks = desks.filter(d => (groupOverrides[d.id] || d.groupId));
    if (groupedDesks.length === 0) return;

    let seatSlots = [];
    groupedDesks.forEach(d => {
      const cap = d.capacity || 1;
      for (let s = 0; s < cap; s++) {
        const slotKey = `${d.id}_seat_${s}`;
        if (!lockedSeats[slotKey]) seatSlots.push({ slotKey, deskId: d.id, slotIdx: s, desk: d });
      }
    });
    if (seatSlots.length === 0) return;

    const basePlacements = { ...placements };
    seatSlots.forEach(slot => delete basePlacements[slot.slotKey]);

    const placedStudentIds = new Set(Object.values(basePlacements));

    // Elever som allerede sitter i en åpen gruppe-pult, pluss uplasserte (kan trekkes inn
    // hvis det er ledig plass i gruppene). Låste elever og elever ved ugrupperte pulter røres ikke.
    const groupedSeatKeys = new Set(seatSlots.map(s => s.slotKey));
    const groupedStudents = Object.entries(placements)
      .filter(([slotKey]) => groupedSeatKeys.has(slotKey))
      .map(([, studentId]) => getStudentByIdOrName(studentId))
      .filter(Boolean);
    const candidateStudents = [...groupedStudents, ...unplacedStudents]
      .filter(st => !placedStudentIds.has(st.id) && !placedStudentIds.has(st.name));

    if (candidateStudents.length === 0) return;

    const sortedSlots = sortSlotsByDeskOrder(seatSlots, desks, boardObj);
    const targetSlots = sortedSlots.slice(0, candidateStudents.length);

    const { placements: groupResult } = findBestPlacement({
      seatSlots: targetSlots,
      students: candidateStudents,
      basePlacements,
      classRules,
      desks,
    });

    // Slå sammen med resten av klasserommet, som IKKE er del av denne kjøringen.
    const finalPlacements = { ...placements };
    seatSlots.forEach(slot => delete finalPlacements[slot.slotKey]);
    Object.assign(finalPlacements, groupResult);

    funModeFinalRef.current = finalPlacements;
    setActiveFunMode('makkerbytte');
    runFlashTick(targetSlots, candidateStudents, FUN_FLASH_COUNT);
  };

  const SPOTLIGHT_HOP_DELAYS = [80, 90, 110, 140, 180, 230, 300];

  const startSpotlight = () => {
    if (activeFunMode || revealMode) return;
    const occupiedSlotKeys = Object.keys(placements).filter(k => placements[k]);
    if (occupiedSlotKeys.length === 0) return;

    setActiveFunMode('spotlight');
    setSpotlightSlotKey(null);
    runSpotlightHop(occupiedSlotKeys, 0);
  };

  const runSpotlightHop = (occupiedSlotKeys, hopIdx) => {
    if (hopIdx >= SPOTLIGHT_HOP_DELAYS.length) {
      const finalPick = occupiedSlotKeys[Math.floor(Math.random() * occupiedSlotKeys.length)];
      setSpotlightSlotKey(finalPick);
      endFunMode();
      return;
    }
    const hop = occupiedSlotKeys[Math.floor(Math.random() * occupiedSlotKeys.length)];
    setSpotlightSlotKey(hop);
    funModeTimerRef.current = setTimeout(() => runSpotlightHop(occupiedSlotKeys, hopIdx + 1), SPOTLIGHT_HOP_DELAYS[hopIdx]);
  };

  const dismissSpotlight = () => {
    endFunMode();
    setSpotlightSlotKey(null);
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

  return {
    activeFunMode, funModeGhosts, bombCountdown, bombBoom, spotlightSlotKey,
    revealMode, revealOrder, revealedSlots,
    sortSlotsByDeskOrder,
    handleAutoFill, handleRuleBasedFunSpin,
    startRoulette, stopRoulette,
    startRandombomb, cancelRandombomb,
    startMusikkstoler, startMakkerbytte,
    startSpotlight, dismissSpotlight,
    startReveal, revealNext, revealAll, endReveal
  };
}
