import React from 'react';
import Select from '../Select';
import { ActionRow, ToggleRow } from '../SidebarRow';

/**
 * Sammenleggbart panel med samme uttrykk som de utvidbare boksene i klassekart-menyen.
 * `flex-shrink-0` er kritisk: uten den ville et panel med `overflow-hidden` få
 * "automatisk min-høyde 0" og bli klemt sammen (og klippe eget innhold) i stedet
 * for at scroll-området over får overflyt og scrollbar.
 */
const Panel = ({ icon, iconColor, title, open, children }) => (
  <details className="group flex-shrink-0 rounded-xl bg-slate-900/40 border border-slate-800 overflow-hidden" open={open}>
    <summary className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors">
      <i className={`${icon} fa-fw text-xs ${iconColor}`}></i>
      <span className="flex-1">{title}</span>
      <i className="fa-solid fa-chevron-down text-[10px] opacity-50 transition-transform group-open:rotate-180"></i>
    </summary>
    <div className="flex flex-col gap-1 px-2 pb-2.5">{children}</div>
  </details>
);

const capBtnCls =
  'h-8 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-200 text-xs font-bold ' +
  'hover:bg-slate-700 hover:border-slate-600 disabled:opacity-30 disabled:hover:bg-slate-800/50 ' +
  'disabled:hover:border-slate-700 transition-colors';

const subLabelCls = 'text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1 pt-1';

const STRUCTURE_OPTIONS = [
  { value: '2-2', label: '2 - 2' },
  { value: '2-2-2', label: '2 - 2 - 2' },
  { value: '2-3-2', label: '2 - 3 - 2' },
  { value: '3-3-3', label: '3 - 3 - 3' },
  { value: '4-2-4', label: '4 - 2 - 4' },
  { value: '4-4', label: '4 - 4' },
  { value: '1-1-1-1-1', label: 'Eksamen (1 og 1)' },
];

export default function RoomToolsDrawer({
  setShowToolsDrawer,
  selectedDesksCount,
  createGroupForSelected,
  clearGroupForSelected,
  setDeskCapacity,
  toggleZoneOnSelected,
  clearAllZones,
  genStructure,
  setGenStructure,
  genRows,
  setGenRows,
  generateStructure,
  addDesk,
  clearDesks,
  deskCount = 0,
  showNumbers,
  setShowNumbers,
  showZones,
  setShowZones,
  centerDesks,
  flipRoom,
  canvasLight,
  toggleCanvasLight,
}) {
  return (
    <>
      {/* Header */}
      <div className="flex-shrink-0 min-w-[16rem] px-4 py-3 border-b border-slate-800 flex justify-between items-center">
        <h3 className="font-extrabold text-xs text-emerald-400 flex items-center gap-2 uppercase tracking-widest">
          <i className="fa-solid fa-toolbox"></i> Verktøy
        </h3>
        <button
          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          onClick={() => setShowToolsDrawer(false)}
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div className="flex-1 min-h-0 min-w-[16rem] overflow-y-auto flex flex-col gap-3 p-3 custom-scrollbar">
        <Panel icon="fa-solid fa-eye" iconColor="text-emerald-400" title="Visning & kontroll" open>
          <ToggleRow
            icon="fa-solid fa-map"
            iconColor="text-amber-400"
            label="Soner"
            checked={showZones}
            onChange={() => setShowZones(!showZones)}
          />
          <ToggleRow
            icon="fa-solid fa-hashtag"
            label="Bordnummer"
            checked={showNumbers}
            onChange={() => setShowNumbers(!showNumbers)}
          />
          <ToggleRow
            icon={canvasLight ? 'fa-solid fa-sun' : 'fa-solid fa-moon'}
            iconColor="text-amber-200"
            label="Lys bakgrunn"
            checked={canvasLight}
            onChange={toggleCanvasLight}
          />
          <ActionRow icon="fa-solid fa-arrows-to-dot" iconColor="text-slate-300" label="Sentrer bord" onClick={centerDesks} />
          <ActionRow icon="fa-solid fa-rotate-left" iconColor="text-cyan-400" label="Flipp rommet 180°" onClick={flipRoom} />
        </Panel>

        <Panel icon="fa-solid fa-table-cells" iconColor="text-cyan-400" title="Autogenerering" open>
          <div className="grid grid-cols-2 gap-2 px-1 pt-1">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mønster</span>
              <Select
                size="xs"
                className="w-full"
                ariaLabel="Mønster"
                value={genStructure}
                onChange={setGenStructure}
                options={STRUCTURE_OPTIONS}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Rader</span>
              <input
                type="number"
                className="input input-xs input-bordered h-7 min-h-0 bg-surface-field border-slate-700 text-slate-100 font-semibold text-center focus:border-emerald-500 focus:outline-none"
                value={genRows}
                onChange={e => setGenRows(Number(e.target.value))}
                min="1"
                max="10"
              />
            </div>
          </div>
          <button
            className="mt-2 h-8 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
            onClick={() => (deskCount > 0
              ? document.getElementById('modal_confirm_generate')?.showModal()
              : generateStructure())}
          >
            Generer bord-struktur
          </button>
        </Panel>

        <Panel icon="fa-solid fa-chair" iconColor="text-amber-400" title="Legg til bord" open>
          <span className={subLabelCls}>Antall plasser</span>
          <div className="grid grid-cols-4 gap-1.5">
            {[1, 2, 3, 4].map(n => (
              <button key={n} className={capBtnCls} onClick={() => addDesk(n)}>{n}</button>
            ))}
          </div>
        </Panel>

        <Panel
          icon="fa-solid fa-pen-to-square"
          iconColor="text-fuchsia-400"
          title={`Rediger valgte (${selectedDesksCount})`}
          open={selectedDesksCount > 0}
        >
          <span className={subLabelCls}>Plasser per bord</span>
          <div className="grid grid-cols-4 gap-1.5">
            {[1, 2, 3, 4].map(n => (
              <button
                key={n}
                className={capBtnCls}
                disabled={selectedDesksCount === 0}
                onClick={() => setDeskCapacity(n)}
              >
                {n}
              </button>
            ))}
          </div>

          <span className={`${subLabelCls} pt-2`}>Sone-tildeling</span>
          <ActionRow icon="fa-solid fa-sun" iconColor="text-yellow-300" label="Vindurekke" disabled={selectedDesksCount === 0} onClick={() => toggleZoneOnSelected('window')} />
          <ActionRow icon="fa-solid fa-door-open" iconColor="text-amber-300" label="Dørsone" disabled={selectedDesksCount === 0} onClick={() => toggleZoneOnSelected('door')} />
          <ActionRow icon="fa-solid fa-location-dot" iconColor="text-emerald-300" label="Fremste rad" disabled={selectedDesksCount === 0} onClick={() => toggleZoneOnSelected('front')} />
          <ActionRow icon="fa-solid fa-arrow-down" iconColor="text-purple-300" label="Bakerste rad" disabled={selectedDesksCount === 0} onClick={() => toggleZoneOnSelected('back')} />
          <ActionRow icon="fa-solid fa-align-center" iconColor="text-cyan-300" label="Midtsone" disabled={selectedDesksCount === 0} onClick={() => toggleZoneOnSelected('center')} />
          <ActionRow icon="fa-solid fa-eraser" iconColor="text-rose-300" label="Fjern alle soner" onClick={clearAllZones} />
        </Panel>
      </div>

      {/* Pinnet bunn – alltid synlig, konkurrerer ikke med scroll-området over. */}
      <div className="flex-shrink-0 min-w-[16rem] border-t border-slate-800 p-3">
        <button
          className="w-full h-8 rounded-md border border-rose-500/30 text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 text-xs font-semibold transition-colors"
          onClick={() => document.getElementById('modal_confirm_clear_room')?.showModal()}
        >
          <i className="fa-solid fa-trash mr-1.5"></i> Tøm hele rommet
        </button>
      </div>

      <dialog id="modal_confirm_clear_room" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box bg-surface-raised border border-slate-700 text-slate-100 rounded-2xl">
          <h3 className="font-bold text-lg text-rose-400">Tøm hele rommet?</h3>
          <p className="py-4 text-sm text-slate-300">Alle bord fjernes fra rommet. Dette kan ikke angres.</p>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost text-slate-400 mr-2">Avbryt</button>
              <button className="btn btn-error" onClick={clearDesks}>Ja, tøm rommet</button>
            </form>
          </div>
        </div>
      </dialog>

      <dialog id="modal_confirm_generate" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box bg-surface-raised border border-slate-700 text-slate-100 rounded-2xl">
          <h3 className="font-bold text-lg text-amber-400">Generer ny bord-struktur?</h3>
          <p className="py-4 text-sm text-slate-300">Dette erstatter alle bordene i rommet, inkludert soner og grupper du har satt. Kan ikke angres.</p>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost text-slate-400 mr-2">Avbryt</button>
              <button className="btn btn-warning" onClick={generateStructure}>Ja, generer</button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
