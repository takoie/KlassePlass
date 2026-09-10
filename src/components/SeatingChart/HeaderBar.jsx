import React from 'react';
import Select from '../Select';
import { HeaderBarShell, HeaderButton, HeaderField, HeaderDivider, SaveStatus } from '../HeaderControls';

/**
 * Toppbar: klassekart-valg, periode-valg, lagre-status og slett-knapp.
 *
 * «Klassekart»-nedtrekket bytter mellom ulike klassekart (chart_group) uten å
 * gå ut av editoren — `handleSelectSeating` laster hele kartet på nytt, så
 * klasse, rom, bord og elevliste følger med automatisk. Rommet vises kun som
 * info (bindes til kartet ved opprettelse). Perioden identifiseres av
 * ukeangivelsen; kartets navn redigeres via blyant-ikonet (modal_edit_period).
 */

export default function HeaderBar({
  onBack,
  classes,
  rooms, selectedRoom,
  seatings, selectedSeatingId, handleSelectSeating, chartGroup, setEditingPeriod,
  saveState, handlePrint, isOnlyPeriod,
  onUndo, onRedo, onRestoreToOpen, canUndo, canRedo, canRestoreToOpen, undoDepth,
}) {
  const roomName = rooms.find(r => r.id === Number(selectedRoom))?.name || '—';
  // Periode-nedtrekket viser BARE periodene som hører til det aktive
  // klassekartet, ikke alle rader for klassen (som ville blandet inn et helt
  // annet kart på samme klasse). Fallback for rader fra før v12-backfyllingen.
  const groupKey = (s) => s.chart_group || (s.class_id != null ? `c${s.class_id}` : null);

  // Ett valg per klassekart (chart_group), representert av den nyeste perioden.
  const chartsByGroup = new Map();
  for (const s of seatings) {
    const g = groupKey(s);
    if (g == null) continue;
    const cur = chartsByGroup.get(g);
    if (!cur || new Date(s.created_at || 0) > new Date(cur.created_at || 0)) chartsByGroup.set(g, s);
  }
  const chartReps = [...chartsByGroup.values()];
  // Vis klassenavn i tillegg når to kart har samme navn (ellers ikke til bry).
  const nameCounts = chartReps.reduce((m, s) => m.set(s.name, (m.get(s.name) || 0) + 1), new Map());
  const chartOptions = chartReps
    .map(s => {
      const cls = classes.find(c => c.id === Number(s.class_id))?.name;
      const ambiguous = nameCounts.get(s.name) > 1 && cls;
      return { value: s.id, label: ambiguous ? `${cls} · ${s.name}` : (s.name || 'Uten navn') };
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'nb'));
  const currentChartValue = chartsByGroup.get(chartGroup)?.id ?? '';

  return (
    <HeaderBarShell>
      {/* Venstre: navigasjon + kontekst */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {onBack && (
          <HeaderButton tone="ghost" icon="fa-solid fa-arrow-left" onClick={onBack}>Tilbake</HeaderButton>
        )}
        <HeaderDivider />
        <HeaderField label="Klassekart">
          <Select
            size="bar"
            className="w-36"
            ariaLabel="Klassekart"
            value={currentChartValue}
            onChange={(v) => handleSelectSeating(v)}
            options={chartOptions}
          />
        </HeaderField>
        <HeaderField label="Rom" title="Rommet er knyttet til klassekartet og settes ved opprettelse">
          <span className="h-9 flex items-center px-3 rounded-md bg-surface-field border border-base-300 text-xs font-semibold text-base-content/80 max-w-28 truncate">
            {roomName}
          </span>
        </HeaderField>
      </div>

      {/* Midten: periode */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <HeaderField label="Periode">
          <Select
            size="bar"
            className="w-28"
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

      {/* Angre / gjør om / tilbakestill */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <HeaderDivider />
        <HeaderButton
          tone="neutral"
          icon="fa-solid fa-rotate-left"
          title={canUndo ? `Angre siste endring (Ctrl+Z)${undoDepth ? ` · ${undoDepth} steg` : ''}` : 'Ingenting å angre'}
          onClick={onUndo}
          disabled={!canUndo}
        />
        <HeaderButton
          tone="neutral"
          icon="fa-solid fa-rotate-right"
          title={canRedo ? 'Gjør om (Ctrl+Shift+Z)' : 'Ingenting å gjøre om'}
          onClick={onRedo}
          disabled={!canRedo}
        />
        <HeaderButton
          tone="neutral"
          icon="fa-solid fa-clock-rotate-left"
          title={canRestoreToOpen
            ? 'Tilbakestill alle plasseringer til slik de var da du åpnet perioden'
            : 'Plasseringene er som da du åpnet perioden'}
          onClick={onRestoreToOpen}
          disabled={!canRestoreToOpen}
        />
      </div>

      {/* Høyre: status + handlinger */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <SaveStatus saveState={saveState} />
        <HeaderButton
          tone="neutral"
          icon="fa-solid fa-print"
          iconClass="text-indigo-300"
          title="Skriv ut / PDF"
          onClick={handlePrint}
        >
          PDF
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
