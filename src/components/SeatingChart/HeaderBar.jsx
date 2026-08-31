import React from 'react';
import Select from '../Select';
import { HeaderBarShell, HeaderButton, HeaderField, HeaderDivider, SaveStatus } from '../HeaderControls';

/**
 * Toppbar: klasse-valg, periode-valg, lagre-status og slett-knapp.
 * Perioden identifiseres kun av ukeangivelsen, som vises direkte i
 * nedtrekksmenyen — kartets eget navn redigeres via blyant-ikonet
 * (modal_edit_period). Rommet knyttes til klassen én gang (ved opprettelse)
 * og vises derfor kun som info her, ikke som en egen nedtrekksmeny å endre
 * løpende.
 */

export default function HeaderBar({
  onBack,
  classes, selectedClass, setSelectedClass,
  rooms, selectedRoom,
  seatings, selectedSeatingId, handleSelectSeating, chartGroup, setEditingPeriod,
  saveState, handlePrint, isOnlyPeriod,
}) {
  const roomName = rooms.find(r => r.id === Number(selectedRoom))?.name || '—';
  // Periode-nedtrekket viser BARE periodene som hører til det aktive
  // klassekartet, ikke alle rader for klassen (som ville blandet inn et helt
  // annet kart på samme klasse). Fallback for rader fra før v12-backfyllingen.
  const groupKey = (s) => s.chart_group || (s.class_id != null ? `c${s.class_id}` : null);

  return (
    <HeaderBarShell>
      {/* Venstre: navigasjon + kontekst */}
      <div className="flex items-center gap-2 flex-wrap">
        {onBack && (
          <HeaderButton tone="ghost" icon="fa-solid fa-arrow-left" onClick={onBack}>Tilbake</HeaderButton>
        )}
        <HeaderDivider />
        <HeaderField label="Klasse">
          <Select
            size="bar"
            className="w-36"
            ariaLabel="Klasse"
            value={selectedClass}
            onChange={(v) => setSelectedClass(Number(v))}
            options={classes.map(c => ({ value: c.id, label: c.name }))}
          />
        </HeaderField>
        <HeaderField label="Rom" title="Rommet er knyttet til klassen og endres i rom-editoren">
          <span className="h-9 flex items-center px-3 rounded-md bg-surface-field border border-slate-700 text-xs font-semibold text-slate-300 max-w-40 truncate">
            {roomName}
          </span>
        </HeaderField>
      </div>

      {/* Midten: periode */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <HeaderField label="Periode">
          <Select
            size="bar"
            className="w-40"
            ariaLabel="Periode"
            value={selectedSeatingId}
            onChange={(v) => handleSelectSeating(v)}
            options={seatings
              .filter(s => groupKey(s) === chartGroup)
              .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
              .map(s => ({ value: s.id, label: s.comment || s.name }))}
          />
        </HeaderField>
        <HeaderButton
          tone="neutral"
          icon="fa-solid fa-pen"
          title="Rediger navn og periode"
          onClick={() => {
            const existing = seatings.find(s => s.id === Number(selectedSeatingId));
            if (existing) setEditingPeriod({ id: existing.id, name: existing.name, comment: existing.comment || '' });
            document.getElementById('modal_edit_period')?.showModal();
          }}
        />
        <HeaderButton
          tone="neutral"
          icon="fa-solid fa-plus"
          title="Start ny periode (beholder dette kartet som historikk)"
          onClick={() => document.getElementById('modal_new_period')?.showModal()}
        >
          Ny periode
        </HeaderButton>
      </div>

      {/* Høyre: status + handlinger */}
      <div className="flex items-center gap-2 flex-wrap">
        <SaveStatus saveState={saveState} />
        <HeaderButton
          tone="neutral"
          icon="fa-solid fa-print"
          iconClass="text-indigo-300"
          onClick={handlePrint}
        >
          Skriv ut / PDF
        </HeaderButton>
        <HeaderButton
          tone="danger"
          icon="fa-solid fa-trash"
          title={isOnlyPeriod ? 'Sletter hele klassekartet - klassen har ingen andre perioder' : 'Sletter kun den valgte perioden - andre perioder for klassen beholdes'}
          onClick={() => document.getElementById('modal_delete_seating')?.showModal()}
        >
          {isOnlyPeriod ? 'Slett kart' : 'Slett periode'}
        </HeaderButton>
      </div>
    </HeaderBarShell>
  );
}
