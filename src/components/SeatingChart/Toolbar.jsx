import React from 'react';

/** Info-ikon med egen hover-boks (stilt som appens modaler), i stedet for nettleserens native title-tooltip. */
function InfoTip({ text }) {
  return (
    <span className="relative inline-flex group/tip ml-auto">
      <i className="fa-solid fa-circle-info w-4 text-slate-400 opacity-60 group-hover/tip:opacity-100"></i>
      <div className="absolute right-0 bottom-full mb-2 w-56 p-2.5 rounded-lg bg-surface-raised border border-slate-700 shadow-xl text-[11px] leading-relaxed text-slate-300 text-left normal-case font-normal tracking-normal whitespace-pre-line opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-opacity z-50 pointer-events-none">
        {text}
      </div>
    </span>
  );
}

/**
 * Venstre verktøypanel: administrer/visning-knapper.
 * Makkergrupper og Fun Mode utvider seg inline i panelet i stedet for å åpne
 * egne skuffer — det holder selve klasseromsvisningen i konstant bredde.
 */
export default function Toolbar({
  unplacedStudents,
  showStudentDrawer, setShowStudentDrawer,
  showGroupDrawer, setShowGroupDrawer, activeGroupId, setActiveGroupId, GROUP_COLORS,
  showFunDrawer, setShowFunDrawer,
  hideGroups, setHideGroups,
  handleRuleBasedFunSpin, handleAutoFill, flipRoom,
  showHistory, setShowHistory,
  showNumbers, setShowNumbers,
  showZones, setShowZones,
  hideSensitiveInfo, setHideSensitiveInfo,
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
    <div className="w-64 bg-base-200 flex flex-col z-10 flex-shrink-0 border-r border-slate-800 shadow-xl relative overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-base-200">
        <h3 className="font-extrabold text-sm text-emerald-400 flex items-center gap-2 uppercase tracking-widest">
          <i className="fa-solid fa-toolbox"></i> Verktøy
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-3">
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Administrer</div>
          <button className="btn btn-sm btn-primary justify-start border-none bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" onClick={() => { setShowStudentDrawer(!showStudentDrawer); setShowGroupDrawer(false); setShowFunDrawer(false); }}>
            <i className="fa-solid fa-users w-5"></i> Elever {unplacedStudents.length > 0 && <span className="badge badge-sm badge-error font-bold ml-auto">{unplacedStudents.length}</span>}
          </button>
          <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 justify-start hover:bg-slate-800" onClick={handleAutoFill} disabled={unplacedStudents.length === 0} title="Fyll alle ledige plasser med uplasserte elever">
            <i className="fa-solid fa-people-arrows w-5 text-emerald-400"></i> Plasser alle
          </button>

          <button className={`btn btn-sm justify-start ${showGroupDrawer ? 'btn-neutral bg-fuchsia-900/30 text-fuchsia-400 border-fuchsia-500/50' : 'btn-outline border-slate-700 text-slate-300 hover:bg-slate-800'}`} onClick={() => { setShowGroupDrawer(!showGroupDrawer); if (showGroupDrawer) setActiveGroupId(null); setShowStudentDrawer(false); setShowFunDrawer(false); }}>
            <i className="fa-solid fa-object-group w-5 text-fuchsia-400"></i> Makkergrupper
          </button>
          {showGroupDrawer && (
            <div className="flex flex-col gap-2 pl-2 ml-1 border-l-2 border-fuchsia-500/30">
              <p className="text-[10px] text-slate-400 leading-tight px-1">Velg en farge, klikk deretter på bordene for å koble dem sammen.</p>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(g => (
                  <button
                    key={g}
                    className={`h-9 rounded-lg flex items-center justify-center font-black text-slate-900 shadow transition-transform hover:scale-110 ${activeGroupId === g ? 'ring-2 ring-white scale-105' : 'opacity-90'}`}
                    style={{ backgroundColor: GROUP_COLORS[(g - 1) % GROUP_COLORS.length] }}
                    onClick={() => setActiveGroupId(prev => prev === g ? null : g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <button
                className={`h-8 rounded-lg flex items-center justify-center text-xs font-bold border-2 border-dashed transition-all ${activeGroupId === 0 ? 'bg-red-500/20 border-red-500 text-red-400' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                onClick={() => setActiveGroupId(0)}
              >
                <i className="fa-solid fa-eraser mr-2"></i> Fjern gruppe
              </button>
              {activeGroupId !== null && (
                <button className="btn btn-xs btn-ghost text-slate-400 hover:text-white" onClick={() => setActiveGroupId(null)}>
                  <i className="fa-solid fa-check mr-1"></i> Avslutt makkergruppe-modus
                </button>
              )}
            </div>
          )}

          <button className={`btn btn-sm justify-start ${showFunDrawer ? 'btn-neutral bg-pink-900/30 text-pink-400 border-pink-500/50' : 'btn-outline border-slate-700 text-slate-300 hover:bg-slate-800'}`} onClick={() => { setShowFunDrawer(!showFunDrawer); setShowStudentDrawer(false); setShowGroupDrawer(false); }}>
            <i className="fa-solid fa-wand-magic-sparkles w-5 text-pink-400"></i> Fun mode
          </button>
          {showFunDrawer && (
            <div className="flex flex-col gap-3 pl-2 ml-1 border-l-2 border-pink-500/30">
              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-slate-400 leading-tight px-1 flex items-center gap-1.5">
                  <i className="fa-solid fa-masks-theater text-cyan-400"></i> Gradvis avdekking
                </p>
                {!revealMode ? (
                  <button className="btn btn-xs bg-cyan-600 hover:bg-cyan-500 text-white gap-2 font-bold" onClick={startReveal} disabled={!!activeFunMode}>
                    <i className="fa-solid fa-eye-slash"></i> Start avdekking
                  </button>
                ) : (
                  <>
                    <p className="text-[10px] text-center text-cyan-300 font-semibold">{revealedCount} av {revealTotal} avslørt</p>
                    <button className="btn btn-xs bg-cyan-600 hover:bg-cyan-500 text-white gap-2 font-bold" onClick={revealNext} disabled={revealedCount >= revealTotal}>
                      <i className="fa-solid fa-eye"></i> Avslør neste
                    </button>
                    <button className="btn btn-xs btn-outline border-slate-700 text-slate-300 hover:bg-slate-800" onClick={revealAll} disabled={revealedCount >= revealTotal}>
                      Avslør alle
                    </button>
                    <button className="btn btn-xs btn-ghost text-slate-400 hover:text-white" onClick={endReveal}>
                      <i className="fa-solid fa-xmark"></i> Avslutt avdekking
                    </button>
                  </>
                )}
              </div>

              <div className="h-px bg-slate-800/40"></div>

              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-slate-400 leading-tight px-1 flex items-center gap-1.5">
                  <i className="fa-solid fa-dice text-amber-400"></i> Roulette
                </p>
                {activeFunMode === 'roulette' ? (
                  <button className="btn btn-xs bg-amber-600 hover:bg-amber-500 text-white gap-2 font-bold" onClick={stopRoulette}>
                    <i className="fa-solid fa-stop"></i> Stopp
                  </button>
                ) : (
                  <button className="btn btn-xs bg-amber-600 hover:bg-amber-500 text-white gap-2 font-bold" onClick={startRoulette} disabled={!!activeFunMode || revealMode}>
                    <i className="fa-solid fa-play"></i> Start roulette
                  </button>
                )}
              </div>

              <div className="h-px bg-slate-800/40"></div>

              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-slate-400 leading-tight px-1 flex items-center gap-1.5">
                  <i className="fa-solid fa-bomb text-rose-400"></i> Randombomb
                </p>
                {activeFunMode === 'randombomb' ? (
                  <>
                    <p className="text-[10px] text-center text-rose-300 font-semibold">{bombBoom ? 'BOOM!' : `Nedtelling: ${bombCountdown}`}</p>
                    <button className="btn btn-xs btn-outline border-slate-700 text-slate-300 hover:bg-slate-800" onClick={cancelRandombomb} disabled={bombBoom}>
                      <i className="fa-solid fa-xmark"></i> Avbryt
                    </button>
                  </>
                ) : (
                  <button className="btn btn-xs bg-rose-600 hover:bg-rose-500 text-white gap-2 font-bold" onClick={startRandombomb} disabled={!!activeFunMode || revealMode}>
                    <i className="fa-solid fa-play"></i> Start randombomb
                  </button>
                )}
              </div>

              <div className="h-px bg-slate-800/40"></div>

              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-slate-400 leading-tight px-1 flex items-center gap-1.5">
                  <i className="fa-solid fa-music text-lime-400"></i> Musikkstoler
                </p>
                <button className="btn btn-xs bg-lime-600 hover:bg-lime-500 text-white gap-2 font-bold" onClick={startMusikkstoler} disabled={!!activeFunMode || revealMode}>
                  <i className="fa-solid fa-shuffle"></i> Stokk raskt
                </button>
              </div>

              <div className="h-px bg-slate-800/40"></div>

              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-slate-400 leading-tight px-1 flex items-center gap-1.5">
                  <i className="fa-solid fa-people-group text-fuchsia-400"></i> Makkerbytte
                </p>
                <button className="btn btn-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white gap-2 font-bold" onClick={startMakkerbytte} disabled={!!activeFunMode || revealMode} title="Bytter kun elever i pulter som har en makkergruppe-farge">
                  <i className="fa-solid fa-shuffle"></i> Bytt om grupper
                </button>
              </div>

              <div className="h-px bg-slate-800/40"></div>

              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-slate-400 leading-tight px-1 flex items-center gap-1.5">
                  <i className="fa-solid fa-star text-yellow-400"></i> Trekk en elev
                </p>
                <button className="btn btn-xs bg-yellow-600 hover:bg-yellow-500 text-white gap-2 font-bold" onClick={startSpotlight} disabled={!!activeFunMode || revealMode}>
                  <i className="fa-solid fa-wand-sparkles"></i> Trekk elev
                </button>
                {spotlightSlotKey && (
                  <button className="btn btn-xs btn-ghost text-slate-400 hover:text-white" onClick={dismissSpotlight}>
                    <i className="fa-solid fa-xmark"></i> Fjern uthevning
                  </button>
                )}
              </div>
            </div>
          )}

          <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 justify-start hover:bg-slate-800" onClick={handleRuleBasedFunSpin}>
            <i className="fa-solid fa-shuffle w-5 text-amber-400"></i> Randomiser
          </button>
          <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 justify-start hover:bg-slate-800" onClick={() => document.getElementById('modal_sync_room').showModal()}>
            <i className="fa-solid fa-arrows-rotate w-5 text-orange-400"></i> Oppdater romplan
            <InfoTip text={'Klassekartet bruker et fastfrosset øyeblikksbilde av bordoppsettet.\n\nHar du gjort endringer i rommet (flyttet, lagt til eller fjernet bord) i Rom-editoren, må du trykke her for å hente inn det nye oppsettet.'} />
          </button>
        </div>

        <div className="h-px bg-slate-800/50 w-full my-1"></div>

        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Visning</div>
          <button className={`btn btn-sm justify-start ${hideGroups ? 'btn-neutral bg-amber-900/30 text-amber-400 border-amber-500/50' : 'btn-outline border-slate-700 text-slate-300 hover:bg-slate-800'}`} onClick={() => setHideGroups(!hideGroups)}>
            <i className={`fa-solid ${hideGroups ? 'fa-eye-slash' : 'fa-eye'} w-5 ${hideGroups ? 'text-amber-400' : 'text-slate-400'}`}></i> {hideGroups ? 'Vis makkergrupper' : 'Skjul makkergrupper'}
          </button>
          <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 justify-start hover:bg-slate-800" onClick={flipRoom}>
            <i className="fa-solid fa-rotate w-5 text-cyan-400"></i> Snu klasserommet
          </button>
          <button className={`btn btn-sm ${showHistory ? 'btn-neutral bg-slate-700 text-amber-400' : 'btn-outline border-slate-700 text-slate-400'} justify-start`} onClick={() => setShowHistory(!showHistory)}>
            <i className="fa-solid fa-clock-rotate-left w-5"></i> {showHistory ? 'Skjul historikk' : 'Vis historikk'}
            <InfoTip text={'Fargen viser hvor nylig elevparet satt sammen sist:\nRød = forrige klassekart\nOransje = 2 kart siden\nGul = 3 kart siden\nLime = 4 kart siden\nGrønn = 5 kart siden'} />
          </button>
          <button className={`btn btn-sm ${showNumbers ? 'btn-neutral bg-slate-700 text-emerald-400' : 'btn-outline border-slate-700 text-slate-400'} justify-start`} onClick={() => setShowNumbers(!showNumbers)}>
            <i className="fa-solid fa-hashtag w-5"></i> {showNumbers ? 'Skjul numre' : 'Vis numre'}
          </button>
          <button className={`btn btn-sm ${showZones ? 'btn-neutral bg-slate-700 text-cyan-400' : 'btn-outline border-slate-700 text-slate-400'} justify-start`} onClick={() => setShowZones(!showZones)}>
            <i className="fa-solid fa-map w-5"></i> {showZones ? 'Skjul soner' : 'Vis soner'}
          </button>
          <button className={`btn btn-sm ${hideSensitiveInfo ? 'btn-neutral bg-slate-700 text-purple-400' : 'btn-outline border-slate-700 text-slate-400'} justify-start`} onClick={() => setHideSensitiveInfo(!hideSensitiveInfo)}>
            <i className="fa-solid fa-eye-slash w-5"></i> {hideSensitiveInfo ? 'Vis info' : 'Skjul info'}
          </button>
          <button className={`btn btn-sm ${canvasLight ? 'btn-neutral bg-slate-700 text-amber-300' : 'btn-outline border-slate-700 text-slate-400'} justify-start`} onClick={toggleCanvasLight}>
            <i className={`fa-solid ${canvasLight ? 'fa-sun' : 'fa-moon'} w-5`}></i> {canvasLight ? 'Lys flate' : 'Mørk flate'}
          </button>
          <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 justify-start hover:bg-slate-800" onClick={() => setIsProjectorMode(true)}>
            <i className="fa-solid fa-expand w-5 text-fuchsia-400"></i> Prosjektor
          </button>
        </div>
      </div>
    </div>
  );
}
