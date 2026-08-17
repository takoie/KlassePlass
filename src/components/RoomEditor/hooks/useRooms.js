import { useState, useRef, useEffect } from 'react';
import { findFreeSpot } from '../geometry';
import { showToast } from '../../../shared/utils';

// Rom-CRUD (last inn/velg/opprett/slett/lagre), autolagring med debounce,
// og bord-generator/-manipulasjon (autogenerering, sentrer, flipp, legg til/tøm).
// Selve `desks`/`boardObj`-state eies av RoomEditor slik at drag-and-drop- og
// utvalgs-hookene også kan lese/skrive dem direkte.
export function useRooms({ initialId, desks, setDesks, boardObj, setBoardObj, setSelectedDesks }) {
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  const [roomName, setRoomName] = useState('');
  const [newRoomModalName, setNewRoomModalName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('2-2-2');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [saveState, setSaveState] = useState('saved');
  const [defaultBoardPosition, setDefaultBoardPosition] = useState('top');
  const [canvasLight, setCanvasLightState] = useState(false);

  const [genStructure, setGenStructure] = useState('2-2-2');
  const [genRows, setGenRows] = useState(4);

  const inputModalRef = useRef(null);
  const hasAutoOpenedRef = useRef(false);
  const saveTimeoutRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const latestRoomDataRef = useRef({ selectedRoom, roomName, desks, boardObj });
  const pendingSaveRef = useRef(false);

  useEffect(() => {
    latestRoomDataRef.current = { selectedRoom, roomName, desks, boardObj };
  });

  useEffect(() => {
    return () => {
      if (pendingSaveRef.current && latestRoomDataRef.current) {
        const { selectedRoom: sr, roomName: rn, desks: dks, boardObj: bo } = latestRoomDataRef.current;
        if (sr?.id && rn.trim()) {
          const layoutData = { desks: dks, boardObj: bo };
          window.api.saveRoom({
            id: sr.id,
            name: rn.trim(),
            layoutData
          }).catch(() => {});
        }
      }
    };
  }, []);

  useEffect(() => {
    loadRooms();
    window.api?.getSettings?.().then((s) => {
      if (s?.boardPosition) setDefaultBoardPosition(s.boardPosition);
      if (s?.canvasLightMode) setCanvasLightState(true);
    }).catch(() => {});
  }, []);

  const loadRooms = async () => {
    setLoading(true);
    try {
      const data = await window.api.getRooms();
      setRooms(data);
      if (initialId === 'new' && !hasAutoOpenedRef.current) {
        hasAutoOpenedRef.current = true;
        setTimeout(() => handleOpenNewModal(), 100);
      } else if (initialId && initialId !== 'new') {
        const found = data.find(r => r.id === Number(initialId));
        if (found) handleSelectRoom(found);
        else if (data.length > 0) handleSelectRoom(data[0]);
      } else if (data.length > 0 && !selectedRoom) {
        handleSelectRoom(data[0]);
      }
    } catch (e) {
      showToast('Kunne ikke hente rommene. Prøv å starte appen på nytt.', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }
    if (!selectedRoom) return;

    pendingSaveRef.current = true;
    setSaveState('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await saveCurrentRoom();
      pendingSaveRef.current = false;
    }, 1000);

    return () => clearTimeout(saveTimeoutRef.current);
  }, [roomName, desks, boardObj]);

  const handleSelectRoom = (r) => {
    isInitialLoadRef.current = true;
    setSelectedRoom(r);
    setRoomName(r.name);
    try {
      const layout = JSON.parse(r.layout_data || '{}');
      setDesks((layout.desks || []).map(d => ({
        ...d,
        capacity: d.capacity || 1,
        zones: Array.isArray(d.zones) ? d.zones : (d.zone ? [d.zone] : []),
        groupId: d.groupId || null
      })));
      setBoardObj(layout.boardObj || { x: 405, y: 25 });
    } catch (e) {
      setDesks([]);
      setBoardObj({ x: 422, y: 15 });
    }
    setSelectedDesks([]);
    setSaveState('saved');
    setTimeout(() => isInitialLoadRef.current = false, 100);
  };

  const handleOpenNewModal = () => {
    setIsCreatingRoom(true);
    setNewRoomModalName('');
    setSelectedPreset('2-2-2');
    const modal = document.getElementById('modal_create_new_room');
    if (modal) {
      modal.showModal();
      setTimeout(() => inputModalRef.current?.focus(), 150);
    }
  };

  // Antall rader som gir flest hele rader uten å overskride maxSeats, uten å
  // endre selve gruppestrukturen (ingen ekstra bord lagt til for å tette
  // gapet opp til maxSeats - kun antall rader varierer).
  const computePresetRowCount = (structurePattern, maxSeats = 30) => {
    if (structurePattern === 'blank') return 0;
    const seatsPerRow = structurePattern.split('-').map(Number).reduce((sum, g) => sum + (isNaN(g) ? 0 : g), 0);
    if (seatsPerRow <= 0) return 0;
    return Math.max(1, Math.floor(maxSeats / seatsPerRow));
  };

  const buildPresetDesks = (structurePattern, numRows = 4) => {
    if (structurePattern === 'blank') return [];
    const groups = structurePattern.split('-').map(Number);
    const deskW = 100;
    const deskH = 60;
    const gapX = 0;
    const gapY = 24;
    const groupGap = 35;

    let totalCols = 0;
    groups.forEach(g => { if (!isNaN(g)) totalCols += g; });
    const totalW = (totalCols * deskW) + ((totalCols - groups.length) * gapX) + ((groups.length - 1) * groupGap);

    const cw = 1100;
    const ch = 700;

    const startX = Math.max(15, (cw - totalW) / 2);
    const startY = Math.max(70, (ch - (numRows * deskH + (numRows - 1) * gapY)) / 2);

    let newDesks = [];
    let currentId = Date.now();

    for (let r = 0; r < numRows; r++) {
      let currentX = startX;
      for (let g of groups) {
        if (isNaN(g)) continue;
        newDesks.push({
          id: (currentId++).toString(),
          x: Math.round(currentX / 10) * 10,
          y: Math.round((startY + (r * (deskH + gapY))) / 10) * 10,
          capacity: g,
          zones: [],
          groupId: null
        });
        currentX += (deskW * g) + groupGap;
      }
    }
    return newDesks;
  };

  const handleConfirmCreateNew = async () => {
    if (!newRoomModalName.trim()) return;
    isInitialLoadRef.current = true;
    const nameToSave = newRoomModalName.trim();

    const initialDesks = buildPresetDesks(selectedPreset, computePresetRowCount(selectedPreset));
    let initialBoard = { x: 422, y: 15 };
    let finalDesks = initialDesks;

    // Nye rom starter med tavlen øverst — flipp til standardplasseringen
    // fra Innstillinger ("Standard tavleplassering") hvis den er satt til nederst.
    if (defaultBoardPosition === 'bottom') {
      const flipped = flipLayoutData({ desks: initialDesks, boardObj: initialBoard });
      finalDesks = flipped.desks;
      initialBoard = flipped.boardObj;
    }

    try {
      const layoutData = { desks: finalDesks, boardObj: initialBoard };
      const result = await window.api.saveRoom({
        id: null,
        name: nameToSave,
        layoutData
      });

      const createdId = result?.lastID;
      const data = await window.api.getRooms();
      setRooms(data);

      const createdRoom = data.find(r => r.id === Number(createdId)) || {
        id: createdId || Date.now(),
        name: nameToSave,
        layout_data: JSON.stringify(layoutData)
      };

      handleSelectRoom(createdRoom);
    } catch (e) {
      showToast('Kunne ikke opprette nytt rom.', 'error');
    }

    const modal = document.getElementById('modal_create_new_room');
    if (modal) modal.close();
    setTimeout(() => isInitialLoadRef.current = false, 100);
  };

  const saveCurrentRoom = async () => {
    if (!selectedRoom || !roomName.trim()) return;
    try {
      const layoutData = { desks, boardObj };
      const result = await window.api.saveRoom({
        id: selectedRoom.id,
        name: roomName.trim(),
        layoutData
      });
      if (!selectedRoom.id && result?.lastID) {
         setSelectedRoom({ ...selectedRoom, id: result.lastID });
      }
      const data = await window.api.getRooms();
      setRooms(data);
      setSaveState('saved');
    } catch (e) {
      setSaveState('error');
      showToast('Rommet kunne ikke lagres. Sjekk at det er nok diskplass, og prøv igjen.', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await window.api.deleteRoom(id);
      const remaining = rooms.filter(r => r.id !== id);
      setRooms(remaining);
      if (remaining.length > 0) {
        handleSelectRoom(remaining[0]);
      } else {
        setSelectedRoom(null);
      }
    } catch (e) {
      showToast('Kunne ikke slette rommet.', 'error');
    }
  };

  const generateStructure = () => {
    if (!genStructure || !selectedRoom) return;
    const newDesks = buildPresetDesks(genStructure, genRows);
    setDesks(newDesks);
    setSelectedDesks([]);
  };

  const centerDesks = () => {
    if (desks.length === 0) return;
    const minX = Math.min(...desks.map(d => d.x));
    const maxX = Math.max(...desks.map(d => d.x + (d.capacity || 1) * 100));
    const minY = Math.min(...desks.map(d => d.y));
    const maxY = Math.max(...desks.map(d => d.y + 60));

    const cw = 1100;
    const ch = 700;

    const dx = Math.round(((cw / 2) - (minX + (maxX - minX) / 2)) / 10) * 10;
    const dy = Math.round((((ch + 60) / 2) - (minY + (maxY - minY) / 2)) / 10) * 10;

    setDesks(desks.map(d => ({
      ...d,
      x: Math.max(15, Math.min(cw - (d.capacity || 1) * 100 - 15, d.x + dx)),
      y: Math.max(60, Math.min(ch - 60 - 15, d.y + dy))
    })));
  };

  // Speilvender et helt romoppsett (bord, tavle) 180° rundt canvas-senteret.
  // Ren funksjon slik at den kan brukes både av "Flipp"-knappen (muterer
  // state direkte) og ved oppretting av nytt rom (der standard
  // tavleplassering fra Innstillinger skal avgjøre startoppsettet).
  const flipLayoutData = ({ desks: srcDesks, boardObj: srcBoard }) => {
    const cw = 1100;
    const ch = 700;
    const deskH = 60;

    const flippedDesks = srcDesks.map(d => {
      const dW = (d.capacity || 1) * 100;
      const flippedX = cw - (d.x + dW);
      const flippedY = ch - (d.y + deskH);
      return {
        ...d,
        x: Math.max(15, Math.min(cw - dW - 15, Math.round(flippedX / 10) * 10)),
        y: Math.max(60, Math.min(ch - deskH - 15, Math.round(flippedY / 10) * 10))
      };
    });

    const flippedBoard = srcBoard ? (() => {
      const flippedX = cw - (srcBoard.x + 256);
      const flippedY = ch - (srcBoard.y + 36);
      return {
        x: Math.max(15, Math.min(cw - 256 - 15, Math.round(flippedX / 10) * 10)),
        y: Math.max(15, Math.min(ch - 36 - 15, Math.round(flippedY / 10) * 10))
      };
    })() : srcBoard;

    return { desks: flippedDesks, boardObj: flippedBoard };
  };

  const flipRoom = () => {
    if (desks.length === 0 && !boardObj) return;
    const flipped = flipLayoutData({ desks, boardObj });
    setDesks(flipped.desks);
    setBoardObj(flipped.boardObj);
  };

  const addDesk = (capacity = 1) => {
    const spot = findFreeSpot({ capacity, existingDesks: desks });
    setDesks(prev => [
      ...prev,
      { id: Date.now().toString(), x: spot.x, y: spot.y, capacity, zones: [], groupId: null }
    ]);
  };

  const clearDesks = () => {
    setDesks([]);
    setSelectedDesks([]);
  };

  const toggleCanvasLight = () => {
    const next = !canvasLight;
    setCanvasLightState(next);
    window.api?.saveSettings?.({ canvasLightMode: next }).catch(() => {});
  };

  return {
    rooms, selectedRoom, loading,
    roomName, setRoomName,
    newRoomModalName, setNewRoomModalName,
    selectedPreset, setSelectedPreset,
    isCreatingRoom, setIsCreatingRoom,
    saveState, defaultBoardPosition,
    genStructure, setGenStructure,
    genRows, setGenRows,
    inputModalRef,
    handleSelectRoom, handleOpenNewModal, handleConfirmCreateNew, handleDelete,
    generateStructure, centerDesks, flipRoom, addDesk, clearDesks,
    canvasLight, toggleCanvasLight
  };
}
