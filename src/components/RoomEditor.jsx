import React, { useState, useEffect } from 'react';
import { DndContext } from '@dnd-kit/core';
import DeskItem from './RoomEditor/DeskItem';
import RoomToolsDrawer from './RoomEditor/RoomToolsDrawer';
import BoardItem from './RoomEditor/BoardItem';
import HeaderBar from './RoomEditor/HeaderBar';
import DeskContextMenu from './RoomEditor/DeskContextMenu';
import BoardContextMenu from './RoomEditor/BoardContextMenu';
import Modals from './RoomEditor/Modals';
import { useCanvasFit } from './RoomEditor/hooks/useCanvasFit';
import { useDeskDragAndDrop } from './RoomEditor/hooks/useDeskDragAndDrop';
import { useDeskSelection } from './RoomEditor/hooks/useDeskSelection';
import { useRooms } from './RoomEditor/hooks/useRooms';
import { centerBoardX as computeCenterBoardX } from './RoomEditor/geometry';

export default function RoomEditor({ onBack, initialId }) {
  const [desks, setDesks] = useState([]); // [{ id, x, y, capacity: 1|2|3|4, zones: [], groupId: null }]
  const [boardObj, setBoardObj] = useState({ x: 405, y: 25 });
  const [boardContextMenu, setBoardContextMenu] = useState(null);

  // UI & Display state
  const [showNumbers, setShowNumbers] = useState(true);
  const [showZones, setShowZones] = useState(false);
  const [showToolsDrawer, setShowToolsDrawer] = useState(true);

  const { scale, offset, containerRef, canvasRef } = useCanvasFit(showToolsDrawer);

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

  const clearAllZones = () => {
    setDesks(desks.map(d => ({ ...d, zones: [] })));
  };

  const {
    selectedDesks, setSelectedDesks,
    selectionBox, contextMenu, setContextMenu,
    handleCanvasMouseDown, handleMouseMoveCanvas, handleCanvasMouseUp,
    handleContextMenu, handleDeskClick,
    handleDeleteSelected, handleDuplicateSelected
  } = useDeskSelection({ desks, setDesks, canvasRef, scale, createGroupForSelected });

  const { sensors, snapToDesksModifier, handleDragStart, handleDragEnd } = useDeskDragAndDrop({
    desks, setDesks, selectedDesks, boardObj, setBoardObj, scale
  });

  useEffect(() => {
    const handleClickOutside = () => setBoardContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleBoardContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setBoardContextMenu({ mouseX: e.clientX, mouseY: e.clientY });
  };

  const centerBoardX = () => {
    setBoardObj(prev => ({ ...prev, x: computeCenterBoardX() }));
  };

  const {
    rooms, selectedRoom,
    newRoomModalName, setNewRoomModalName,
    selectedPreset, setSelectedPreset,
    isCreatingRoom, setIsCreatingRoom,
    saveState,
    genStructure, setGenStructure,
    genRows, setGenRows,
    inputModalRef,
    handleSelectRoom, handleOpenNewModal, handleConfirmCreateNew, handleDelete,
    generateStructure, centerDesks, flipRoom, addDesk, clearDesks,
    canvasLight, toggleCanvasLight
  } = useRooms({ initialId, desks, setDesks, boardObj, setBoardObj, setSelectedDesks });

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

  const presetsList = [
    { id: '2-2-2', title: 'Par-rekker', subtitle: '2-2-2 oppsett', icon: '║ ║ ║' },
    { id: '2-2', title: 'Kompakt par', subtitle: '2-2 oppsett', icon: '║ ║' },
    { id: '3-3-3', title: 'Treklynger', subtitle: '3-3-3 oppsett', icon: '█ █ █' },
    { id: '1-1-1-1-1', title: 'Eksamen', subtitle: 'Enkeltbord', icon: '• • •' },
    { id: 'blank', title: 'Blankt rom', subtitle: 'Bygg selv fra bunnen', icon: '▢' }
  ];

  return (
    <div className="flex flex-col h-full w-full bg-base-300 overflow-hidden" onMouseUp={handleCanvasMouseUp}>
      <HeaderBar
        onBack={onBack}
        rooms={rooms} selectedRoom={selectedRoom} handleSelectRoom={handleSelectRoom}
        handleOpenNewModal={handleOpenNewModal} saveState={saveState}
        showToolsDrawer={showToolsDrawer} setShowToolsDrawer={setShowToolsDrawer}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {selectedRoom ? (
          <>
            <div className={`bg-base-200 border-slate-800 flex flex-col z-10 flex-shrink-0 shadow-xl transition-all duration-300 ease-in-out overflow-hidden ${showToolsDrawer ? 'w-64 border-r' : 'w-0 border-r-0'}`}>
              <RoomToolsDrawer
                setShowToolsDrawer={setShowToolsDrawer}
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
                clearAllZones={clearAllZones}
                genStructure={genStructure}
                setGenStructure={setGenStructure}
                genRows={genRows}
                setGenRows={setGenRows}
                generateStructure={generateStructure}
                addDesk={addDesk}
                clearDesks={clearDesks}
                canvasLight={canvasLight}
                toggleCanvasLight={toggleCanvasLight}
              />
            </div>
            <div ref={containerRef} className="flex-1 w-full h-full overflow-hidden bg-base-300 relative">
              <DndContext 
                sensors={sensors} 
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                modifiers={[snapToDesksModifier]}
              >
                <div
                  ref={canvasRef}
                  className={`absolute rounded-2xl shadow-2xl origin-top-left border-2 ${canvasLight ? 'bg-slate-200 border-slate-400' : 'bg-base-100 border-slate-700'}`}
                  style={{
                    width: '1100px',
                    height: '700px',
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    backgroundImage: canvasLight
                      ? 'radial-gradient(rgba(0,0,0,0.14) 1px, transparent 0)'
                      : 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 0)',
                    backgroundSize: '20px 20px'
                  }}
                  onMouseMove={handleMouseMoveCanvas}
                  onMouseDown={handleCanvasMouseDown}
                >
                {!isCreatingRoom && (
                  <>
                    <BoardItem boardObj={boardObj} onContextMenu={handleBoardContextMenu} />

                    {desks.map((d) => (
                        <DeskItem
                          key={d.id}
                          desk={d}
                          isSelected={selectedDesks.includes(d.id)}
                          showNumbers={showNumbers}
                          showZones={showZones}
                          seatNumbers={deskNumberMap[d.id] || []}
                          onContextMenu={handleContextMenu}
                          onClick={handleDeskClick}
                        />
                    ))}
                  </>
                )}

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

      <BoardContextMenu
        contextMenu={boardContextMenu} setContextMenu={setBoardContextMenu}
        centerBoardX={centerBoardX}
      />

      <Modals
        inputModalRef={inputModalRef}
        newRoomModalName={newRoomModalName} setNewRoomModalName={setNewRoomModalName}
        handleConfirmCreateNew={handleConfirmCreateNew}
        presetsList={presetsList} selectedPreset={selectedPreset} setSelectedPreset={setSelectedPreset}
        selectedRoom={selectedRoom} handleDelete={handleDelete}
        setIsCreatingRoom={setIsCreatingRoom}
      />
    </div>
  );
}
