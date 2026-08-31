import React from 'react';
import { HeaderBarShell, HeaderButton, HeaderDivider, SaveStatus } from '../HeaderControls';

/**
 * Toppbar for rombyggeren. Bevisst minimal: når du først er inne i et rom
 * jobber du KUN med det rommet, så det er ingen rom-nedtrekk eller «nytt/
 * dupliser rom»-knapper her (de hører hjemme i «Mine rom»-oversikten).
 * Romnavnet vises som tittel og endres via penn-ikonet.
 */
export default function HeaderBar({ onBack, selectedRoom, roomName, onEditName, saveState, showToolsDrawer, setShowToolsDrawer }) {
  return (
    <HeaderBarShell>
      {/* Venstre: navigasjon + rom-tittel */}
      <div className="flex items-center gap-2 flex-wrap">
        {onBack && (
          <HeaderButton tone="ghost" icon="fa-solid fa-arrow-left" onClick={onBack}>Tilbake</HeaderButton>
        )}
        <HeaderDivider />
        <HeaderButton
          icon="fa-solid fa-toolbox"
          tone={showToolsDrawer ? 'neutral' : 'primary'}
          active={showToolsDrawer}
          title={showToolsDrawer ? 'Skjul verktøy' : 'Vis verktøy'}
          onClick={() => setShowToolsDrawer(!showToolsDrawer)}
        >
          Verktøy
        </HeaderButton>
        {selectedRoom && (
          <>
            <HeaderDivider />
            <div className="flex items-center gap-2 min-w-0">
              <i className="fa-solid fa-school text-slate-500 text-xs flex-shrink-0"></i>
              <span className="text-sm font-bold text-white truncate max-w-[16rem]" title={roomName}>
                {roomName || 'Uten navn'}
              </span>
              <HeaderButton
                tone="ghost"
                icon="fa-solid fa-pen"
                title="Endre navn på rommet"
                onClick={onEditName}
              />
            </div>
          </>
        )}
      </div>

      {/* Høyre: status + slett */}
      {selectedRoom && (
        <div className="flex items-center gap-2 flex-wrap">
          <SaveStatus saveState={saveState} />
          <HeaderButton
            tone="danger"
            icon="fa-solid fa-trash"
            onClick={() => document.getElementById(`modal_delete_room_${selectedRoom.id}`)?.showModal()}
          >
            Slett rom
          </HeaderButton>
        </div>
      )}
    </HeaderBarShell>
  );
}
