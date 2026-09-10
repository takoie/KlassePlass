import React from 'react';
import { InfoTip } from '../HoverTip';
import { ActionRow, ToggleRow, Chevron, SectionLabel } from '../SidebarRow';

/**
 * Venstre verktøypanel for klassekart:
 * - Plassering, Randomiser, Makkergrupper og Snu rom samlet øverst
 * - Visning med rene toggle-brytere i midten
 * - Rom / Prosjektor
 * - Fun Mode plassert nederst
 */
export default function Toolbar({
  unplacedStudents,
  showStudentDrawer, setShowStudentDrawer,
  showGroupDrawer, setShowGroupDrawer, activeGroupId, setActiveGroupId, GROUP_COLORS,
  removeStudentsMode, toggleRemoveStudentsMode,
  showFunDrawer, setShowFunDrawer,
  hideGroups, setHideGroups,
  showGroupNumbers, setShowGroupNumbers,
  colorSeatsByGroup, setColorSeatsByGroup,
  handleRuleBasedFunSpin, handleAutoFill, flipRoom,
  showHistory, setShowHistory,
  showNumbers, setShowNumbers,
  showZones, setShowZones,
  hideEmptyDesks, setHideEmptyDesks,
  setIsProjectorMode,
  revealMode, revealedCount, revealTotal, startReveal, revealNext, revealAll, endReveal,
  activeFunMode,
  startRoulette, stopRoulette,
  bombCountdown, bombBoom, startRandombomb, cancelRandombomb,
  startMusikkstoler,
  startMakkerbytte,
  spotlightSlotKey, startSpotlight, dismissSpotlight,
  canvasLight, toggleCanvasLight,
}) {
  return (
    <div className="w-64 bg-base-200 flex flex-col z-10 flex-shrink-0 border-r border-base-300 shadow-xl relative overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-base-300 flex justify-between items-center bg-base-200">
        <h3 className="font-extrabold text-xs text-success flex items-center gap-2 uppercase tracking-widest">
          <i className="fa-solid fa-toolbox"></i> Verktøy
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-5 p-3 custom-scrollbar">
        {/* Seksjon 1: Plassering & Makkergrupper */}
        <div className="flex flex-col gap-1">
          <SectionLabel>Plassering & Grupper</SectionLabel>

          <ActionRow
            icon="fa-solid fa-users"
            iconColor="text-success"
            label="Elever"
            active={showStudentDrawer}
            badge={unplacedStudents.length > 0 ? unplacedStudents.length : null}
            onClick={() => { setShowStudentDrawer(!showStudentDrawer); setShowGroupDrawer(false); setShowFunDrawer(false); }}
          />

          <ActionRow
            icon="fa-solid fa-people-arrows"
            iconColor="text-success"
            label="Plasser alle"
            disabled={unplacedStudents.length === 0}
            title="Fyll alle ledige plasser med uplasserte elever"
            onClick={handleAutoFill}
          />

          <ActionRow
            icon="fa-solid fa-user-xmark"
            iconColor="text-rose-400"
            label={removeStudentsMode ? 'Avslutt fjerne-modus' : 'Fjern elever'}
            active={removeStudentsMode}
            activeTone="rose"
            onClick={toggleRemoveStudentsMode}
          />

          {removeStudentsMode && (
            <div className="px-2.5 py-2 rounded-xl bg-rose-950/30 border border-rose-500/30 text-[10px] text-rose-200 leading-snug">
              Dra en boks rundt elevene du vil fjerne. Låste elever hoppes over.
            </div>
          )}

          <ActionRow
            icon="fa-solid fa-shuffle"
            iconColor="text-amber-400"
            label="Randomiser"
            onClick={handleRuleBasedFunSpin}
          />

          <ActionRow
            icon="fa-solid fa-object-group"
            iconColor="text-fuchsia-400"
            label="Makkergrupper"
            active={showGroupDrawer}
            trailing={<Chevron open={showGroupDrawer} />}
            onClick={() => { setShowGroupDrawer(!showGroupDrawer); if (showGroupDrawer) setActiveGroupId(null); setShowStudentDrawer(false); setShowFunDrawer(false); }}
          />

          {/* Makkergrupper ekspanderbar boks */}
          {showGroupDrawer && (
            <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-base-300/80 border border-fuchsia-500/30 animate-[fadeIn_0.15s_ease-out]">
              <p className="text-[10px] text-base-content/60 leading-tight">Velg farge og klikk på bordene for å koble dem sammen.</p>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(g => (
                  <button
                    key={g}
                    className={`h-8 rounded-lg flex items-center justify-center font-black text-xs text-slate-900 shadow transition-transform hover:scale-105 ${activeGroupId === g ? 'ring-2 ring-white scale-105' : 'opacity-90'}`}
                    style={{ backgroundColor: GROUP_COLORS[(g - 1) % GROUP_COLORS.length] }}
                    onClick={() => setActiveGroupId(prev => prev === g ? null : g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <button
                className={`h-7 rounded-lg flex items-center justify-center text-[11px] font-bold border transition-all ${activeGroupId === 0 ? 'bg-red-500/20 border-red-500 text-red-400' : 'border-base-300 text-base-content/60 hover:bg-base-200'}`}
                onClick={() => setActiveGroupId(0)}
              >
                <i className="fa-solid fa-eraser mr-1.5 text-[10px]"></i> Fjern gruppe
              </button>
              {activeGroupId !== null && (
                <button
                  className="h-7 rounded-lg flex items-center justify-center gap-1 text-[11px] font-bold bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 transition-all"
                  onClick={() => setActiveGroupId(null)}
                >
                  <i className="fa-solid fa-xmark text-[10px]"></i> Avslutt modus
                </button>
              )}
              <div className="h-px bg-base-200 my-0.5"></div>
              <ToggleRow
                icon="fa-solid fa-hashtag"
                label="Vis gruppenummer"
                checked={showGroupNumbers}
                onChange={() => setShowGroupNumbers(!showGroupNumbers)}
                tip="Viser 'Gruppe X'-merkelappen på fargelagte bord. Fargen vises uansett."
              />
            </div>
          )}

          <ActionRow
            icon="fa-solid fa-rotate"
            iconColor="text-cyan-400"
            label="Snu klasserommet"
            onClick={flipRoom}
          />
        </div>

        {/* Seksjon 2: Visning */}
        <div className="flex flex-col gap-1">
          <SectionLabel>Visning</SectionLabel>

          <ToggleRow
            icon="fa-solid fa-eye"
            label="Makkergrupper"
            checked={!hideGroups}
            onChange={() => setHideGroups(!hideGroups)}
          />

          <ToggleRow
            icon="fa-solid fa-fill-drip"
            label="Bordfarger"
            checked={colorSeatsByGroup}
            onChange={() => setColorSeatsByGroup(!colorSeatsByGroup)}
            disabled={hideGroups}
            tip="Fyller bordene med en lysere tone av makkergruppe-fargen."
          />

          <ToggleRow
            icon="fa-solid fa-clock-rotate-left"
            label="Historikk"
            checked={showHistory}
            onChange={() => setShowHistory(!showHistory)}
            tip={'Fargen viser hvor nylig elevparet satt sammen sist:\nRød = forrige klassekart\nOransje = 2 kart siden\nGul = 3 kart siden\nLime = 4 kart siden\nGrønn = 5 kart siden'}
          />

          <ToggleRow
            icon="fa-solid fa-hashtag"
            label="Bordnummer"
            checked={showNumbers}
            onChange={() => setShowNumbers(!showNumbers)}
          />

          <ToggleRow
            icon="fa-solid fa-map"
            label="Soner"
            checked={showZones}
            onChange={() => setShowZones(!showZones)}
          />

          <ToggleRow
            icon="fa-solid fa-eye-slash"
            label="Skjul tomme bord"
            checked={hideEmptyDesks}
            onChange={() => setHideEmptyDesks(!hideEmptyDesks)}
            tip={'Skjuler bord der ingen elever sitter i det hele tatt. Randomiser/Plasser alle unngår skjulte bord. Under en dra-handling vises skjulte bord midlertidig som gyldige mål.\n\nEnkeltplasser: høyreklikk en ledig plass → «Skjul denne plassen» (virker også i utskrift).'}
          />

          <ToggleRow
            icon={canvasLight ? "fa-solid fa-sun" : "fa-solid fa-moon"}
            label="Lys bakgrunn"
            checked={canvasLight}
            onChange={toggleCanvasLight}
          />
        </div>

        {/* Seksjon 3: Rom & Prosjektor */}
        <div className="flex flex-col gap-1">
          <SectionLabel>Rom & Visningsmodus</SectionLabel>

          <ActionRow
            icon="fa-solid fa-expand"
            iconColor="text-fuchsia-400"
            label="Prosjektor-modus"
            onClick={() => setIsProjectorMode(true)}
          />

          <ActionRow
            icon="fa-solid fa-arrows-rotate"
            iconColor="text-orange-400"
            label="Oppdater romplan"
            tip={'Klassekartet bruker et fastfrosset øyeblikksbilde av bordoppsettet.\n\nHar du gjort endringer i rommet i Rom-editoren, må du trykke her for å hente inn det nye oppsettet.'}
            onClick={() => document.getElementById('modal_sync_room')?.showModal()}
          />
        </div>

        {/* Seksjon 4: Fun mode (Nederst) */}
        <div className="flex flex-col gap-1">
          <ActionRow
            icon="fa-solid fa-wand-magic-sparkles"
            iconColor="text-pink-400"
            label="Fun mode"
            active={showFunDrawer}
            trailing={<Chevron open={showFunDrawer} />}
            onClick={() => { setShowFunDrawer(!showFunDrawer); setShowStudentDrawer(false); setShowGroupDrawer(false); }}
          />

          {showFunDrawer && (
            <div className="flex flex-col gap-2.5 p-2.5 rounded-xl bg-base-300/80 border border-pink-500/30 animate-[fadeIn_0.15s_ease-out]">
              {/* Gradvis avdekking */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-base-content/60 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fa-solid fa-masks-theater text-cyan-400"></i> Gradvis avdekking
                </span>
                {!revealMode ? (
                  <button className="btn btn-xs bg-cyan-600 hover:bg-cyan-500 text-base-content gap-1.5 font-bold" onClick={startReveal} disabled={!!activeFunMode}>
                    <i className="fa-solid fa-eye-slash"></i> Start avdekking
                  </button>
                ) : (
                  <>
                    <p className="text-[10px] text-center text-cyan-300 font-semibold">{revealedCount} av {revealTotal} avslørt</p>
                    <button className="btn btn-xs bg-cyan-600 hover:bg-cyan-500 text-base-content gap-1.5 font-bold" onClick={revealNext} disabled={revealedCount >= revealTotal}>
                      <i className="fa-solid fa-eye"></i> Avslør neste
                    </button>
                    <button className="btn btn-xs btn-ghost border border-base-300 text-base-content/80 hover:bg-base-200 hover:text-base-content" onClick={revealAll} disabled={revealedCount >= revealTotal}>
                      Avslør alle
                    </button>
                    <button className="btn btn-xs btn-ghost text-base-content/60 hover:text-base-content" onClick={endReveal}>
                      <i className="fa-solid fa-xmark"></i> Avslutt
                    </button>
                  </>
                )}
              </div>

              <div className="h-px bg-base-200"></div>

              {/* Roulette */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-base-content/60 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fa-solid fa-dice text-amber-400"></i> Roulette
                </span>
                {activeFunMode === 'roulette' ? (
                  <button className="btn btn-xs bg-amber-600 hover:bg-amber-500 text-base-content gap-1.5 font-bold" onClick={stopRoulette}>
                    <i className="fa-solid fa-stop"></i> Stopp
                  </button>
                ) : (
                  <button className="btn btn-xs bg-amber-600 hover:bg-amber-500 text-base-content gap-1.5 font-bold" onClick={startRoulette} disabled={!!activeFunMode || revealMode}>
                    <i className="fa-solid fa-play"></i> Start roulette
                  </button>
                )}
              </div>

              <div className="h-px bg-base-200"></div>

              {/* Randombomb */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-base-content/60 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fa-solid fa-bomb text-rose-400"></i> Randombomb
                </span>
                {activeFunMode === 'randombomb' ? (
                  <>
                    <p className="text-[10px] text-center text-rose-300 font-semibold">{bombBoom ? 'BOOM!' : `Nedtelling: ${bombCountdown}`}</p>
                    <button className="btn btn-xs btn-ghost border border-base-300 text-base-content/80 hover:bg-base-200 hover:text-base-content" onClick={cancelRandombomb} disabled={bombBoom}>
                      <i className="fa-solid fa-xmark"></i> Avbryt
                    </button>
                  </>
                ) : (
                  <button className="btn btn-xs bg-rose-600 hover:bg-rose-500 text-base-content gap-1.5 font-bold" onClick={startRandombomb} disabled={!!activeFunMode || revealMode}>
                    <i className="fa-solid fa-play"></i> Start randombomb
                  </button>
                )}
              </div>

              <div className="h-px bg-base-200"></div>

              {/* Musikkstoler & Makkerbytte */}
              <div className="grid grid-cols-2 gap-1.5">
                <button className="btn btn-xs bg-lime-600 hover:bg-lime-500 text-base-content gap-1 font-bold truncate" onClick={startMusikkstoler} disabled={!!activeFunMode || revealMode} title="Musikkstoler (stokk raskt)">
                  <i className="fa-solid fa-music text-[10px]"></i> Musikkstoler
                </button>
                <button className="btn btn-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-base-content gap-1 font-bold truncate" onClick={startMakkerbytte} disabled={!!activeFunMode || revealMode} title="Bytt om grupper">
                  <i className="fa-solid fa-shuffle text-[10px]"></i> Makkerbytte
                </button>
              </div>

              {/* Trekk en elev */}
              <div className="flex flex-col gap-1.5 pt-1">
                <button className="btn btn-xs bg-yellow-600 hover:bg-yellow-500 text-base-content gap-1.5 font-bold" onClick={startSpotlight} disabled={!!activeFunMode || revealMode}>
                  <i className="fa-solid fa-star text-[10px]"></i> Trekk en elev
                </button>
                {spotlightSlotKey && (
                  <button className="btn btn-xs btn-ghost text-base-content/60 hover:text-base-content" onClick={dismissSpotlight}>
                    <i className="fa-solid fa-xmark"></i> Fjern uthevning
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
