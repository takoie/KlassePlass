import React, { useState, useEffect, useRef } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import DeskItem from './RoomEditor/DeskItem';
import RoomToolsDrawer from './RoomEditor/RoomToolsDrawer';
import BoardItem from './RoomEditor/BoardItem';
import DoorItem from './RoomEditor/DoorItem';
import WindowItem from './RoomEditor/WindowItem';
import HeaderBar from './RoomEditor/HeaderBar';
import DeskContextMenu from './RoomEditor/DeskContextMenu';
import Modals from './RoomEditor/Modals';

const GROUP_COLORS = [
  '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981',
  '#ef4444', '#6366f1', '#14b8a6', '#f97316', '#84cc16',
  '#06b6d4', '#d946ef', '#e11d48', '#22c55e', '#64748b'
];

export default function RoomEditor({ onBack, initialId }) {
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  // Room state
  const [roomName, setRoomName] = useState('');
  const [newRoomModalName, setNewRoomModalName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('2-2-2');
  const [desks, setDesks] = useState([]); // [{ id, x, y, capacity: 1|2|3|4, zones: [], groupId: null }]
  const [doors, setDoors] = useState([]);
  const [windows, setWindows] = useState([]);
  const [boardObj, setBoardObj] = useState({ x: 405, y: 25 });
  const [saveState, setSaveState] = useState('saved');
  
  // Generator state
  const [genStructure, setGenStructure] = useState('2-2-2');
  const [genRows, setGenRows] = useState(4);

  // UI & Display state
  const [showNumbers, setShowNumbers] = useState(true);
  const [showZones, setShowZones] = useState(false);
  
  // Selection State
  const [selectedDesks, setSelectedDesks] = useState([]);
  const [selectionBox, setSelectionBox] = useState(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const inputModalRef = useRef(null);
  const desksRef = useRef(desks);
  const selectedDesksRef = useRef(selectedDesks);
  const isDraggingRef = useRef(false);
  const hasAutoOpenedRef = useRef(false);

  useEffect(() => { desksRef.current = desks; }, [desks]);
  useEffect(() => { selectedDesksRef.current = selectedDesks; }, [selectedDesks]);

  const [contextMenu, setContextMenu] = useState(null);
  const saveTimeoutRef = useRef(null);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    loadRooms();
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

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
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }
    if (!selectedRoom) return;

    setSaveState('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveCurrentRoom();
    }, 1000); 
    
    return () => clearTimeout(saveTimeoutRef.current);
  }, [roomName, desks, doors, windows, boardObj]);

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
      setDoors((layout.doors || []).map(d => ({ ...d, rotation: d.rotation || 0 })));
      setWindows((layout.windows || []).map(w => ({ ...w, rotation: w.rotation || 0 })));
      setBoardObj(layout.boardObj || { x: 405, y: 25 });
    } catch (e) {
      setDesks([]);
      setDoors([]);
      setWindows([]);
      setBoardObj({ x: 422, y: 15 });
    }
    setSelectedDesks([]);
    setSaveState('saved');
    setTimeout(() => isInitialLoadRef.current = false, 100);
  };

  const handleOpenNewModal = () => {
    setNewRoomModalName('');
    setSelectedPreset('2-2-2');
    const modal = document.getElementById('modal_create_new_room');
    if (modal) {
      modal.showModal();
      setTimeout(() => inputModalRef.current?.focus(), 150);
    }
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
        for (let c = 0; c < g; c++) {
          newDesks.push({
            id: (currentId++).toString(),
            x: Math.round(currentX / 10) * 10,
            y: Math.round((startY + (r * (deskH + gapY))) / 10) * 10,
            capacity: 1,
            zones: [],
            groupId: null
          });
          currentX += deskW + gapX;
        }
        currentX += groupGap - gapX;
      }
    }
    return newDesks;
  };

  const handleConfirmCreateNew = async () => {
    if (!newRoomModalName.trim()) return;
    isInitialLoadRef.current = true;
    const nameToSave = newRoomModalName.trim();
    
    const initialDesks = buildPresetDesks(selectedPreset, 4);
    const defaultDoors = [];
    const defaultWindows = [];
    const defaultBoard = { x: 422, y: 15 };

    try {
      const layoutData = { desks: initialDesks, doors: defaultDoors, windows: defaultWindows, boardObj: defaultBoard };
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
    } catch (e) {}

    const modal = document.getElementById('modal_create_new_room');
    if (modal) modal.close();
    setTimeout(() => isInitialLoadRef.current = false, 100);
  };

  const saveCurrentRoom = async () => {
    if (!selectedRoom || !roomName.trim()) return;
    try {
      const layoutData = { desks, doors, windows, boardObj };
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
    } catch (e) {}
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
    } catch (e) {}
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

  const flipRoom = () => {
    if (desks.length === 0 && !boardObj) return;
    const cw = 1100;
    const ch = 700;
    const deskH = 60;

    setDesks(prev => prev.map(d => {
      const dW = (d.capacity || 1) * 100;
      const flippedX = cw - (d.x + dW);
      const flippedY = ch - (d.y + deskH);
      return {
        ...d,
        x: Math.max(15, Math.min(cw - dW - 15, Math.round(flippedX / 10) * 10)),
        y: Math.max(60, Math.min(ch - deskH - 15, Math.round(flippedY / 10) * 10))
      };
    }));

    setBoardObj(prev => {
      if (!prev) return prev;
      const flippedX = cw - (prev.x + 256);
      const flippedY = ch - (prev.y + 36);
      return {
        x: Math.max(15, Math.min(cw - 256 - 15, Math.round(flippedX / 10) * 10)),
        y: Math.max(15, Math.min(ch - 36 - 15, Math.round(flippedY / 10) * 10))
      };
    });

    setDoors(prev => prev.map(dr => ({
      ...dr,
      x: Math.max(15, Math.min(cw - 64 - 15, Math.round((cw - (dr.x + 64)) / 10) * 10)),
      y: Math.max(15, Math.min(ch - 64 - 15, Math.round((ch - (dr.y + 64)) / 10) * 10)),
      rotation: (dr.rotation + 180) % 360
    })));

    setWindows(prev => prev.map(win => ({
      ...win,
      x: Math.max(15, Math.min(cw - 80 - 15, Math.round((cw - (win.x + 80)) / 10) * 10)),
      y: Math.max(15, Math.min(ch - 80 - 15, Math.round((ch - (win.y + 80)) / 10) * 10)),
      rotation: (win.rotation + 180) % 360
    })));
  };

  const addSingleDesk = () => {
    const cw = 1100;
    const ch = 700;
    const deskW = 100;
    const deskH = 60;

    const isOccupied = (testPos) => {
      return desks.some(d => {
        const dW = (d.capacity || 1) * 100;
        return (
          testPos.x < d.x + dW &&
          testPos.x + deskW > d.x &&
          testPos.y < d.y + 60 &&
          testPos.y + deskH > d.y
        );
      });
    };

    let candidate = null;
    for (let y = 90; y <= ch - deskH - 20; y += 80) {
      for (let x = 20; x <= cw - deskW - 20; x += 115) {
        if (!isOccupied({ x, y })) {
          candidate = { x, y };
          break;
        }
      }
      if (candidate) break;
    }

    if (!candidate) {
      candidate = { x: 50, y: 90 };
    }

    setDesks(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        x: candidate.x,
        y: candidate.y,
        capacity: 1,
        zones: [],
        groupId: null
      }
    ]);
  };

  const clearDesks = () => {
    setDesks([]);
    setSelectedDesks([]);
  };

  const setDeskCapacity = (cap) => {
    if (selectedDesks.length === 0) return;
    setDesks(desks.map(d => selectedDesks.includes(d.id) ? { ...d, capacity: cap } : d));
  };

  const createGroupForSelected = () => {
    if (selectedDesks.length === 0) return;
    const currentGroupIds = desks.map(d => d.groupId || 0);
    const maxGroupId = Math.max(...currentGroupIds, 0);
    const newGroupId = maxGroupId + 1;

    setDesks(desks.map(d => selectedDesks.includes(d.id) ? { ...d, groupId: newGroupId } : d));
  };

  const clearGroupForSelected = () => {
    if (selectedDesks.length === 0) return;
    setDesks(desks.map(d => selectedDesks.includes(d.id) ? { ...d, groupId: null } : d));
  };

  const toggleZoneOnSelected = (zoneType) => {
    if (selectedDesks.length === 0) return;
    setDesks(desks.map(d => {
      if (!selectedDesks.includes(d.id)) return d;
      const currentZones = d.zones || [];
      const has = currentZones.includes(zoneType);
      const nextZones = has ? currentZones.filter(z => z !== zoneType) : [...currentZones, zoneType];
      return { ...d, zones: nextZones };
    }));
  };

  const addDoor = () => {
    const offset = doors.length * 35;
    setDoors([...doors, { id: Date.now().toString(), x: 40 + offset, y: 40, rotation: 0, label: 'Dør' }]);
  };

  const addWindow = () => {
    const offset = windows.length * 40;
    setWindows([...windows, { id: Date.now().toString(), x: 260 + offset, y: 40, rotation: 0, label: 'Vindu' }]);
  };

  const rotateDoor = (id) => {
    setDoors(doors.map(d => d.id === id ? { ...d, rotation: (d.rotation + 90) % 360 } : d));
  };

  const rotateWindow = (id) => {
    setWindows(windows.map(w => w.id === id ? { ...w, rotation: (w.rotation + 90) % 360 } : w));
  };

  const removeDoor = (id) => {
    setDoors(doors.filter(d => d.id !== id));
  };

  const removeWindow = (id) => {
    setWindows(windows.filter(w => w.id !== id));
  };

  const handleObjectMouseDown = (e, item, type) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = item.x;
    const origY = item.y;

    const onMouseMove = (moveEv) => {
      const dx = moveEv.clientX - startX;
      const dy = moveEv.clientY - startY;
      const nx = Math.max(15, Math.min(1300 - 60, Math.round((origX + dx) / 10) * 10));
      const ny = Math.max(15, Math.min(800 - 40, Math.round((origY + dy) / 10) * 10));

      if (type === 'door') {
        setDoors(prev => prev.map(d => d.id === item.id ? { ...d, x: nx, y: ny } : d));
      } else if (type === 'window') {
        setWindows(prev => prev.map(w => w.id === item.id ? { ...w, x: nx, y: ny } : w));
      } else if (type === 'board') {
        setBoardObj({ x: nx, y: ny });
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const getBoundedDelta = (movingDesks, rawDx, rawDy, stationaryDesks) => {
    const cw = 1100;
    const ch = 700;
    const deskH = 60;

    // 1. Enforce Wall Boundaries
    let maxAllowedDx = rawDx;
    let maxAllowedDy = rawDy;
    movingDesks.forEach(d => {
      const deskW = (d.capacity || 1) * 100;
      const potentialX = d.x + rawDx;
      const potentialY = d.y + rawDy;
      if (potentialX < 15) maxAllowedDx = Math.max(maxAllowedDx, 15 - d.x);
      if (potentialX > cw - deskW - 15) maxAllowedDx = Math.min(maxAllowedDx, cw - deskW - 15 - d.x);
      if (potentialY < 60) maxAllowedDy = Math.max(maxAllowedDy, 60 - d.y);
      if (potentialY > ch - deskH - 15) maxAllowedDy = Math.min(maxAllowedDy, ch - deskH - 15 - d.y);
    });

    let finalDx = maxAllowedDx;
    let finalDy = maxAllowedDy;
    let isSnapped = false;
    let targetDeskIds = [];
    const snapThreshold = 20;

    // 2. Magnetic Snapping to Stationary Desks
    for (let md of movingDesks) {
       const mdx = md.x + finalDx;
       const mdy = md.y + finalDy;
       const mdWidth = (md.capacity || 1) * 100;
       const mdHeight = 60;

       for (let sd of stationaryDesks) {
         const sx = sd.x;
         const sy = sd.y;
         const ow = (sd.capacity || 1) * 100;
         const oh = 60;

         // Horizontal Snap (Adjacent Side-by-Side)
         if (Math.abs(mdy - sy) < 14 && Math.abs(mdx - (sx + ow)) < snapThreshold) {
           finalDx = (sx + ow) - md.x;
           finalDy = sy - md.y;
           isSnapped = true;
           break;
         } else if (Math.abs(mdy - sy) < 14 && Math.abs((mdx + mdWidth) - sx) < snapThreshold) {
           finalDx = (sx - mdWidth) - md.x;
           finalDy = sy - md.y;
           isSnapped = true;
           break;
         } 
         // Vertical Snap (Adjacent Top-to-Bottom)
         else if (Math.abs(mdx - sx) < 14) {
           if (Math.abs(mdy - (sy + oh)) < snapThreshold) {
             finalDy = (sy + oh) - md.y;
             finalDx = sx - md.x;
             isSnapped = true;
             break;
           } else if (Math.abs((mdy + mdHeight) - sy) < snapThreshold) {
             finalDy = (sy - mdHeight) - md.y;
             finalDx = sx - md.x;
             isSnapped = true;
             break;
           }
         }
       }
    }

    // Grid snap if not magnetically snapped
    if (!isSnapped && movingDesks.length > 0) {
      finalDx = Math.round((movingDesks[0].x + finalDx) / 10) * 10 - movingDesks[0].x;
      finalDy = Math.round((movingDesks[0].y + finalDy) / 10) * 10 - movingDesks[0].y;
    }

    // 3. Collision Prevention (NO Overlaps Allowed)
    const hasOverlap = (testDx, testDy) => {
      for (let md of movingDesks) {
        const mLeft = md.x + testDx;
        const mRight = mLeft + (md.capacity || 1) * 100;
        const mTop = md.y + testDy;
        const mBottom = mTop + 60;

        for (let sd of stationaryDesks) {
          const sLeft = sd.x;
          const sRight = sLeft + (sd.capacity || 1) * 100;
          const sTop = sd.y;
          const sBottom = sTop + 60;

          if (mLeft < sRight - 1 && mRight > sLeft + 1 && mTop < sBottom - 1 && mBottom > sTop + 1) {
            return true;
          }
        }
      }
      return false;
    };

    if (hasOverlap(finalDx, finalDy)) {
      if (!hasOverlap(finalDx, 0)) {
        finalDy = 0;
      } else if (!hasOverlap(0, finalDy)) {
        finalDx = 0;
      } else {
        finalDx = 0;
        finalDy = 0;
      }
    }

    // 4. Calculate Alignment Guide Lines (Stiplelinjer)
    const xLines = [];
    const yLines = [];

    movingDesks.forEach(md => {
      const fx = md.x + finalDx;
      const fy = md.y + finalDy;
      const fw = (md.capacity || 1) * 100;
      const fh = 60;
      const fCenterX = fx + fw / 2;
      const fCenterY = fy + fh / 2;
      
      stationaryDesks.forEach(sd => {
         const ox = sd.x;
         const oy = sd.y;
         const ow = (sd.capacity || 1) * 100;
         const oh = 60;
         const oCenterX = ox + ow / 2;
         const oCenterY = oy + oh / 2;

         // Check Horizontal Alignment (Top, Center, Bottom)
         if (Math.abs(fy - oy) <= 2) yLines.push(oy);
         if (Math.abs(fCenterY - oCenterY) <= 2) yLines.push(oCenterY);
         if (Math.abs((fy + fh) - (oy + oh)) <= 2) yLines.push(oy + oh);
         if (Math.abs(fy - (oy + oh)) <= 2) yLines.push(oy + oh);
         if (Math.abs((fy + fh) - oy) <= 2) yLines.push(oy);

         // Check Vertical Alignment (Left, Center, Right)
         if (Math.abs(fx - ox) <= 2) xLines.push(ox);
         if (Math.abs(fCenterX - oCenterX) <= 2) xLines.push(oCenterX);
         if (Math.abs((fx + fw) - (ox + ow)) <= 2) xLines.push(ox + ow);
         if (Math.abs(fx - (ox + ow)) <= 2) xLines.push(ox + ow);
         if (Math.abs((fx + fw) - ox) <= 2) xLines.push(ox);

         const isAdjacentHorizontal = Math.abs(fy - oy) < 14 && (Math.abs(fx - (ox + ow)) < 6 || Math.abs((fx + fw) - ox) < 6);
         const isAdjacentVertical = Math.abs(fx - ox) < 14 && (Math.abs(fy - (oy + oh)) < 6 || Math.abs((fy + fh) - oy) < 6);

         if (isAdjacentHorizontal || isAdjacentVertical) {
             if (!targetDeskIds.includes(sd.id)) targetDeskIds.push(sd.id);
         }
      });
    });

    return {
      x: finalDx * scale,
      y: finalDy * scale,
      targetDeskIds,
      alignmentGuides: {
        xLines: [...new Set(xLines)],
        yLines: [...new Set(yLines)]
      }
    };
  };

  const snapToDesksModifier = ({ transform, active }) => {
    if (!isDraggingRef.current || !active?.data?.current) return transform;
    const rawDx = transform.x / scale;
    const rawDy = transform.y / scale;

    if (active.data.current.type !== 'desk') {
       return { 
         ...transform, 
         x: Math.round(rawDx / 10) * 10 * scale, 
         y: Math.round(rawDy / 10) * 10 * scale 
       };
    }

    const draggedDeskId = active.id;
    const isPartOftMultiSelection = selectedDesksRef.current.includes(draggedDeskId);
    const desksToMoveIds = isPartOftMultiSelection ? selectedDesksRef.current : [draggedDeskId];
    
    const movingDesksObjs = desksRef.current.filter(d => desksToMoveIds.includes(d.id));
    if (movingDesksObjs.length === 0) return transform;
    const stationary = desksRef.current.filter(d => !desksToMoveIds.includes(d.id));

    const result = getBoundedDelta(movingDesksObjs, rawDx, rawDy, stationary);

    // Direct DOM guide lines (60fps performance without React re-render loops)
    const xGuide = document.getElementById('guide-line-x');
    const yGuide = document.getElementById('guide-line-y');

    if (xGuide) {
      if (result.alignmentGuides.xLines.length > 0) {
        xGuide.style.left = `${result.alignmentGuides.xLines[0]}px`;
        xGuide.style.display = 'block';
      } else {
        xGuide.style.display = 'none';
      }
    }

    if (yGuide) {
      if (result.alignmentGuides.yLines.length > 0) {
        yGuide.style.top = `${result.alignmentGuides.yLines[0]}px`;
        yGuide.style.display = 'block';
      } else {
        yGuide.style.display = 'none';
      }
    }

    // Apply real-time visual transform & style to ALL moving desks in selection
    movingDesksObjs.forEach(md => {
       const el = document.getElementById(`desk-item-${md.id}`);
       if (el) {
          el.style.transform = `translate3d(${result.x}px, ${result.y}px, 0)`;
          el.style.boxShadow = '0 0 24px rgba(99, 102, 241, 0.8)';
          el.style.borderColor = '#6366f1';
          el.style.zIndex = '100';
       }
    });

    // Apply snap target highlight to stationary desks being snapped to
    stationary.forEach(s => {
       const el = document.getElementById(`desk-item-${s.id}`);
       if (el) {
          if (result.targetDeskIds.includes(s.id)) {
             el.style.boxShadow = '0 0 30px rgba(16, 185, 129, 0.95)';
             el.style.borderColor = '#10b981';
             el.style.zIndex = '50';
          } else {
             el.style.boxShadow = '';
             el.style.borderColor = '';
             el.style.zIndex = '';
          }
       }
    });
    
    return {
       ...transform,
       x: result.x,
       y: result.y,
    };
  };

  const handleDragStart = (event) => {
    isDraggingRef.current = true;
    const { active } = event;
    if (!active || active.data.current?.type !== 'desk') return;
    
    const isPartOftMultiSelection = selectedDesksRef.current.includes(active.id);
    const desksToMove = isPartOftMultiSelection ? selectedDesksRef.current : [active.id];
    
    desksToMove.forEach(id => {
       const el = document.getElementById(`desk-item-${id}`);
       if (el) el.style.zIndex = '100';
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event) => {
    isDraggingRef.current = false;
    const xGuide = document.getElementById('guide-line-x');
    const yGuide = document.getElementById('guide-line-y');
    if (xGuide) xGuide.style.display = 'none';
    if (yGuide) yGuide.style.display = 'none';

    desksRef.current.forEach(d => {
       const el = document.getElementById(`desk-item-${d.id}`);
       if (el) { 
         el.style.boxShadow = ''; 
         el.style.borderColor = ''; 
         el.style.transform = ''; 
         el.style.zIndex = '';
       }
    });

    const { active, delta } = event;
    if (!active || !active.data.current) return;
    
    if (active.data.current.type === 'board') {
      setBoardObj(prev => ({
        x: Math.max(10, Math.min(1100 - 256 - 10, prev.x + delta.x / scale)),
        y: Math.max(10, Math.min(700 - 36 - 10, prev.y + delta.y / scale))
      }));
    } else if (active.data.current.type === 'door') {
      const doorId = active.data.current.door.id;
      setDoors(prev => prev.map(d => d.id === doorId ? {
        ...d, 
        x: Math.max(10, Math.min(1100 - 64, d.x + delta.x / scale)), 
        y: Math.max(10, Math.min(700 - 64, d.y + delta.y / scale))
      } : d));
    } else if (active.data.current.type === 'window') {
      const windowId = active.data.current.windowObj.id;
      setWindows(prev => prev.map(w => w.id === windowId ? {
        ...w, 
        x: Math.max(10, Math.min(1100 - 80, w.x + delta.x / scale)), 
        y: Math.max(10, Math.min(700 - 80, w.y + delta.y / scale))
      } : w));
    } else if (active.data.current.type === 'desk') {
      const draggedDeskId = active.id;
      const isPartOftMultiSelection = selectedDesks.includes(draggedDeskId);
      const desksToMove = isPartOftMultiSelection ? selectedDesks : [draggedDeskId];
      const draggedDesk = desks.find(d => d.id === draggedDeskId);
      if (!draggedDesk) return;
      const stationary = desks.filter(d => !desksToMove.includes(d.id));
      const movingDesks = desks.filter(d => desksToMove.includes(d.id));
      const result = getBoundedDelta(movingDesks, delta.x / scale, delta.y / scale, stationary);

      setDesks(prev => prev.map(d => {
        if (desksToMove.includes(d.id)) {
          return { ...d, x: Math.round(d.x + result.x / scale), y: Math.round(d.y + result.y / scale) };
        }
        return d;
      }));
    }
  };

  const handleCanvasMouseDown = (e) => {
    if (e.target !== canvasRef.current && e.target.closest('.desk-item, .board-item, .door-item, .window-item')) return;
    if (e.button === 2) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const startX = (e.clientX - rect.left) / scale;
    const startY = (e.clientY - rect.top) / scale;
    setSelectionBox({ startX, startY, currentX: startX, currentY: startY });
    if (!e.shiftKey) setSelectedDesks([]);
  };

  const handleMouseMoveCanvas = (e) => {
    if (!selectionBox || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / scale;
    const currentY = (e.clientY - rect.top) / scale;
    
    setSelectionBox(prev => ({
      ...prev,
      currentX,
      currentY
    }));

    const minX = Math.min(selectionBox.startX, currentX);
    const maxX = Math.max(selectionBox.startX, currentX);
    const minY = Math.min(selectionBox.startY, currentY);
    const maxY = Math.max(selectionBox.startY, currentY);
    
    const newSelected = desks.filter(d => {
      const dW = (d.capacity || 1) * 100;
      const cx = d.x + dW / 2;
      const cy = d.y + 30;
      return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY;
    }).map(d => d.id);
    
    setSelectedDesks(newSelected);
  };

  const handleCanvasMouseUp = () => {
    setSelectionBox(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedDesks.length > 0) {
        setDesks(desks.filter(d => !selectedDesks.includes(d.id)));
        setSelectedDesks([]);
      }
    } else if (e.key === 'Enter') {
      if (selectedDesks.length > 0) {
        createGroupForSelected();
      }
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDesks, desks]);

  const handleContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedDesks.includes(item.id)) {
      setSelectedDesks([item.id]);
    }
    
    const menuHeight = 400; 
    let y = e.clientY;
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 20;
    }
    
    setContextMenu({ mouseX: e.clientX, mouseY: y });
  };

  const handleDeskClick = (e, item) => {
    e.stopPropagation();
    if (e.shiftKey) {
      if (selectedDesks.includes(item.id)) {
        setSelectedDesks(selectedDesks.filter(id => id !== item.id));
      } else {
        setSelectedDesks([...selectedDesks, item.id]);
      }
    } else {
      setSelectedDesks([item.id]);
    }
  };

  const handleDeleteSelected = () => {
    setDesks(desks.filter(d => !selectedDesks.includes(d.id)));
    setSelectedDesks([]);
    setContextMenu(null);
  };

  const handleDuplicateSelected = () => {
    const toDuplicate = desks.filter(d => selectedDesks.includes(d.id));
    const newDesks = toDuplicate.map(d => ({
      ...d,
      id: Date.now() + Math.random().toString(),
      x: Math.min(1100 - 100, d.x + 20),
      y: Math.min(700 - 60, d.y + 20)
    }));
    setDesks([...desks, ...newDesks]);
    setSelectedDesks(newDesks.map(d => d.id));
    setContextMenu(null);
  };

  const isBoardAtTop = (boardObj?.y || 25) < 350;

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

  const zoneMeta = {
    window: { label: 'Vindurekke', icon: 'fa-solid fa-sun text-yellow-400', badgeClass: 'border-yellow-500/40 text-yellow-300 bg-yellow-950/80' },
    door: { label: 'Dørsone', icon: 'fa-solid fa-door-open text-amber-400', badgeClass: 'border-amber-500/40 text-amber-300 bg-amber-950/80' },
    front: { label: 'Fremste rad', icon: 'fa-solid fa-location-dot text-emerald-400', badgeClass: 'border-emerald-500/40 text-emerald-300 bg-emerald-950/80' },
    back: { label: 'Bakerste rad', icon: 'fa-solid fa-arrow-down text-purple-400', badgeClass: 'border-purple-500/40 text-purple-300 bg-purple-950/80' },
    center: { label: 'Midtsone', icon: 'fa-solid fa-align-center text-cyan-400', badgeClass: 'border-cyan-500/40 text-cyan-300 bg-cyan-950/80' }
  };

  const presetsList = [
    { id: '2-2-2', title: 'Par-rekker', subtitle: '2-2-2 oppsett', icon: '║ ║ ║' },
    { id: '2-2', title: 'Kompakt par', subtitle: '2-2 oppsett', icon: '║ ║' },
    { id: '3-3-3', title: 'Treklynger', subtitle: '3-3-3 oppsett', icon: '█ █ █' },
    { id: '1-1-1-1-1', title: 'Eksamen', subtitle: 'Enkeltbord', icon: '• • •' },
    { id: 'blank', title: 'Blankt rom', subtitle: 'Bygg selv fra bunnen', icon: '▢' }
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[#131620] overflow-hidden" onMouseUp={handleCanvasMouseUp}>
      <HeaderBar
        onBack={onBack}
        rooms={rooms} selectedRoom={selectedRoom} handleSelectRoom={handleSelectRoom}
        handleOpenNewModal={handleOpenNewModal} saveState={saveState}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {selectedRoom ? (
          <>
            <div className="w-64 bg-[#1a1e2b] border-r border-slate-800 flex flex-col z-10 flex-shrink-0 overflow-y-auto shadow-xl">
              <RoomToolsDrawer
                showNumbers={showNumbers}
                setShowNumbers={setShowNumbers}
                showZones={showZones}
                setShowZones={setShowZones}
                centerDesks={centerDesks}
                flipRoom={flipRoom}
                selectedDesksCount={selectedDesks.length}
                createGroupForSelected={createGroupForSelected}
                clearGroupForSelected={clearGroupForSelected}
                setDeskCapacity={setDeskCapacity}
                toggleZoneOnSelected={toggleZoneOnSelected}
                genStructure={genStructure}
                setGenStructure={setGenStructure}
                genRows={genRows}
                setGenRows={setGenRows}
                generateStructure={generateStructure}
                addDoor={addDoor}
                addWindow={addWindow}
                addSingleDesk={addSingleDesk}
                clearDesks={clearDesks}
              />
            </div>
            <div ref={containerRef} className="flex-1 w-full h-full overflow-hidden bg-[#131620] relative">
              <DndContext 
                sensors={sensors} 
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                modifiers={[snapToDesksModifier]}
              >
                <div 
                  ref={canvasRef}
                  className="absolute bg-[#202534] border-2 border-slate-700 rounded-2xl shadow-2xl origin-top-left" 
                  style={{ 
                    width: '1100px',
                    height: '700px',
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 0)', 
                    backgroundSize: '20px 20px'
                  }}
                  onMouseMove={handleMouseMoveCanvas}
                  onMouseDown={handleCanvasMouseDown}
                >
                <BoardItem boardObj={boardObj} />

                {doors.map((dr) => (
                  <DoorItem key={dr.id} door={dr} onRotate={rotateDoor} onRemove={removeDoor} />
                ))}

                {windows.map((win) => (
                  <WindowItem key={win.id} windowObj={win} onRotate={rotateWindow} onRemove={removeWindow} />
                ))}

                {desks.map((d) => (
                    <DeskItem
                      key={d.id}
                      desk={d}
                      isSelected={selectedDesks.includes(d.id)}
                      showNumbers={showNumbers}
                      showZones={showZones}
                      deskNumber={deskNumberMap[d.id] || ''}
                      onContextMenu={handleContextMenu}
                      onClick={handleDeskClick}
                    />
                ))}

                {selectionBox && (
                  <div 
                    className="absolute border-2 border-indigo-500 bg-indigo-500/10 pointer-events-none z-50 rounded-lg"
                    style={{
                      left: Math.min(selectionBox.startX, selectionBox.currentX),
                      top: Math.min(selectionBox.startY, selectionBox.currentY),
                      width: Math.abs(selectionBox.currentX - selectionBox.startX),
                      height: Math.abs(selectionBox.currentY - selectionBox.startY)
                    }}
                  />
                )}

                {/* Direct DOM Alignment Guides (60fps performance without React re-renders) */}
                <div 
                  id="guide-line-x"
                  className="absolute top-0 bottom-0 border-l-2 border-dashed border-indigo-400 opacity-90 z-40 pointer-events-none hidden shadow-[0_0_10px_rgba(129,140,248,0.9)]"
                />
                <div 
                  id="guide-line-y"
                  className="absolute left-0 right-0 border-t-2 border-dashed border-indigo-400 opacity-90 z-40 pointer-events-none hidden shadow-[0_0_10px_rgba(129,140,248,0.9)]"
                />

                </div>
              </DndContext>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <i className="fa-solid fa-school text-5xl mb-3 opacity-20"></i>
            <h2 className="text-lg font-bold text-white">Ingen rom funnet</h2>
            <p className="text-sm">Klikk "+ Nytt rom" i toppbaren for å opprette ditt første rom.</p>
          </div>
        )}
      </div>
      
      {/* Context Menu Popup */}
      <DeskContextMenu
        contextMenu={contextMenu} setContextMenu={setContextMenu} selectedDesks={selectedDesks}
        createGroupForSelected={createGroupForSelected} clearGroupForSelected={clearGroupForSelected}
        setDeskCapacity={setDeskCapacity} toggleZoneOnSelected={toggleZoneOnSelected}
        handleDuplicateSelected={handleDuplicateSelected} handleDeleteSelected={handleDeleteSelected}
      />

      <Modals
        inputModalRef={inputModalRef}
        newRoomModalName={newRoomModalName} setNewRoomModalName={setNewRoomModalName}
        handleConfirmCreateNew={handleConfirmCreateNew}
        presetsList={presetsList} selectedPreset={selectedPreset} setSelectedPreset={setSelectedPreset}
        selectedRoom={selectedRoom} handleDelete={handleDelete}
      />
    </div>
  );
}
