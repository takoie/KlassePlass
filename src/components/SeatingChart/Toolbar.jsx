import React from 'react';

/** Info-ikon med egen hover-boks (stilt som appens modaler), i stedet for nettleserens native title-tooltip. */
function InfoTip({ text }) {
  return (
    <span className="relative inline-flex group/tip ml-auto flex-shrink-0">
      <i className="fa-solid fa-circle-info w-3.5 text-slate-400 opacity-60 group-hover/tip:opacity-100 transition-opacity"></i>
      <div className="absolute right-0 bottom-full mb-2 w-56 p-2.5 rounded-lg bg-surface-raised border border-slate-700 shadow-xl text-[11px] leading-relaxed text-slate-300 text-left normal-case font-normal tracking-normal whitespace-pre-line opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-opacity z-50 pointer-events-none">
        {text}
      </div>
    </span>
  );
}

/** Tydelig rad for visningsbrytere med fast ikon, fast tekst og moderne iOS/macOS toggle-bryter */
function ToggleRow({ icon, label, checked, onChange, disabled, tip }) {
  return (
    <button
      type="button"
      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
        disabled
          ? 'opacity-35 cursor-not-allowed border-transparent bg-transparent text-slate-500'
          : checked
          ? 'bg-slate-800/80 text-slate-100 border-slate-700 shadow-sm'
          : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-slate-200'
      }`}
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <i className={`${icon} fa-fw text-xs flex-shrink-0 ${checked ? 'text-emerald-400' : 'text-slate-500'}`}></i>
        <span className="truncate text-left">{label}</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        {tip && <InfoTip text={tip} />}
        <div className={`w-7 h-4 rounded-full transition-colors relative flex items-center p-0.5 ${checked ? 'bg-emerald-500' : 'bg-slate-700'}`}>
          <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 shadow-sm ${checked ? 'translate-x-3' : 'translate-x-0'}`}></div>
        </div>
      </div>
    </button>
  );
}

/**
 * Venstre verktøypanel: strukturert i Handlinger, Moduser, Visningslag og Klasserom.
 */
export default function Toolbar({
  unplacedStudents,
  showStudentDrawer, setShowStudentDrawer,
  showGroupDrawer, setShowGroupDrawer, activeGroupId, setActiveGroupId, GROUP_COLORS,
  showFunDrawer, setShowFunDrawer,
  hideGroups, setHideGroups,
  colorSeatsByGroup, setColorSeatsByGroup,
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
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-base-200">
        <h3 className="font-extrabold text-xs text-emerald-400 flex items-center gap-2 uppercase tracking-widest">
          <i className="fa-solid fa-toolbox"></i> Verktøy & Visning
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-3 custom-scrollbar">
        {/* Seksjon 1: Elevplassering */}
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Plassering</div>
          
          <button 
            className={`btn btn-sm justify-start border transition-all ${
              showStudentDrawer 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm' 
                : 'btn-outline border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
            onClick={() => { setShowStudentDrawer(!showStudentDrawer); setShowGroupDrawer(false); setShowFunDrawer(false); }}
          >
            <i className="fa-solid fa-users fa-fw text-xs text-emerald-400"></i>
            <span className="flex-1 text-left">Elever</span>
            {unplacedStudents.length > 0 && (
              <span className="badge badge-sm bg-rose-500 text-white font-bold ml-auto border-none">
                {unplacedStudents.length}
              </span>
            )}
          </button>

          <button 
            className="btn btn-sm btn-outline border-slate-700 text-slate-300 justify-start hover:bg-slate-800" 
            onClick={handleAutoFill} 
            disabled={unplacedStudents.length === 0} 
            title="Fyll alle ledige plasser med uplasserte elever"
          >
            <i className="fa-solid fa-people-arrows fa-fw text-xs text-emerald-400"></i>
            <span>Plasser alle</span>
          </button>

          <button 
            className="btn btn-sm btn-outline border-slate-700 text-slate-300 justify-start hover:bg-slate-800" 
            onClick={handleRuleBasedFunSpin}
          >
            <i className="fa-solid fa-shuffle fa-fw text-xs text-amber-400"></i>
            <span>Randomiser</span>
          </button>
        </div>

        {/* Seksjon 2: Verktøymoduser */}
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Moduser</div>

          {/* Makkergrupper Modus */}
          <button 
            className={`btn btn-sm justify-start border transition-all ${
              showGroupDrawer 
                ? 'bg-fuchsia-950/50 text-fuchsia-300 border-fuchsia-500/50 shadow-sm' 
                : 'btn-outline border-slate-700 text-slate-300 hover:bg-slate-800'
            }`} 
            onClick={() => { setShowGroupDrawer(!showGroupDrawer); if (showGroupDrawer) setActiveGroupId(null); setShowStudentDrawer(false); setShowFunDrawer(false); }}
          >
            <i className="fa-solid fa-object-group fa-fw text-xs text-fuchsia-400"></i>
            <span className="flex-1 text-left">Makkergrupper</span>
            <i className={`fa-solid fa-chevron-${showGroupDrawer ? 'up' : 'down'} text-[10px] opacity-60`}></i>
          </button>

          {showGroupDrawer && (
            <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-fuchsia-500/30">
              <p className="text-[10px] text-slate-400 leading-tight">Velg farge og klikk på bordene for å koble dem sammen.</p>
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
                className={`h-7 rounded-lg flex items-center justify-center text-[11px] font-bold border transition-all ${activeGroupId === 0 ? 'bg-red-500/20 border-red-500 text-red-400' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}
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
            </div>
          )}

          {/* Fun Mode Modus */}
          <button 
            className={`btn btn-sm justify-start border transition-all ${
              showFunDrawer 
                ? 'bg-pink-950/50 text-pink-300 border-pink-500/50 shadow-sm' 
                : 'btn-outline border-slate-700 text-slate-300 hover:bg-slate-800'
            }`} 
            onClick={() => { setShowFunDrawer(!showFunDrawer); setShowStudentDrawer(false); setShowGroupDrawer(false); }}
          >
            <i className="fa-solid fa-wand-magic-sparkles fa-fw text-xs text-pink-400"></i>
            <span className="flex-1 text-left">Fun mode</span>
            <i className={`fa-solid fa-chevron-${showFunDrawer ? 'up' : 'down'} text-[10px] opacity-60`}></i>
          </button>

          {showFunDrawer && (
            <div className="flex flex-col gap-2.5 p-2.5 rounded-xl bg-slate-900/60 border border-pink-500/30">
              {/* Gradvis avdekking */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fa-solid fa-masks-theater text-cyan-400"></i> Gradvis avdekking
                </span>
                {!revealMode ? (
                  <button className="btn btn-xs bg-cyan-600 hover:bg-cyan-500 text-white gap-1.5 font-bold" onClick={startReveal} disabled={!!activeFunMode}>
                    <i className="fa-solid fa-eye-slash"></i> Start avdekking
                  </button>
                ) : (
                  <>
                    <p className="text-[10px] text-center text-cyan-300 font-semibold">{revealedCount} av {revealTotal} avslørt</p>
                    <button className="btn btn-xs bg-cyan-600 hover:bg-cyan-500 text-white gap-1.5 font-bold" onClick={revealNext} disabled={revealedCount >= revealTotal}>
                      <i className="fa-solid fa-eye"></i> Avslør neste
                    </button>
                    <button className="btn btn-xs btn-outline border-slate-700 text-slate-300 hover:bg-slate-800" onClick={revealAll} disabled={revealedCount >= revealTotal}>
                      Avslør alle
                    </button>
                    <button className="btn btn-xs btn-ghost text-slate-400 hover:text-white" onClick={endReveal}>
                      <i className="fa-solid fa-xmark"></i> Avslutt
                    </button>
                  </>
                )}
              </div>

              <div className="h-px bg-slate-800"></div>

              {/* Roulette */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fa-solid fa-dice text-amber-400"></i> Roulette
                </span>
                {activeFunMode === 'roulette' ? (
                  <button className="btn btn-xs bg-amber-600 hover:bg-amber-500 text-white gap-1.5 font-bold" onClick={stopRoulette}>
                    <i className="fa-solid fa-stop"></i> Stopp
                  </button>
                ) : (
                  <button className="btn btn-xs bg-amber-600 hover:bg-amber-500 text-white gap-1.5 font-bold" onClick={startRoulette} disabled={!!activeFunMode || revealMode}>
                    <i className="fa-solid fa-play"></i> Start roulette
                  </button>
                )}
              </div>

              <div className="h-px bg-slate-800"></div>

              {/* Randombomb */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fa-solid fa-bomb text-rose-400"></i> Randombomb
                </span>
                {activeFunMode === 'randombomb' ? (
                  <>
                    <p className="text-[10px] text-center text-rose-300 font-semibold">{bombBoom ? 'BOOM!' : `Nedtelling: ${bombCountdown}`}</p>
                    <button className="btn btn-xs btn-outline border-slate-700 text-slate-300 hover:bg-slate-800" onClick={cancelRandombomb} disabled={bombBoom}>
                      <i className="fa-solid fa-xmark"></i> Avbryt
                    </button>
                  </>
                ) : (
                  <button className="btn btn-xs bg-rose-600 hover:bg-rose-500 text-white gap-1.5 font-bold" onClick={startRandombomb} disabled={!!activeFunMode || revealMode}>
                    <i className="fa-solid fa-play"></i> Start randombomb
                  </button>
                )}
              </div>

              <div className="h-px bg-slate-800"></div>

              {/* Musikkstoler & Makkerbytte */}
              <div className="grid grid-cols-2 gap-1.5">
                <button className="btn btn-xs bg-lime-600 hover:bg-lime-500 text-white gap-1 font-bold truncate" onClick={startMusikkstoler} disabled={!!activeFunMode || revealMode} title="Musikkstoler (stokk raskt)">
                  <i className="fa-solid fa-music text-[10px]"></i> Musikkstoler
                </button>
                <button className="btn btn-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white gap-1 font-bold truncate" onClick={startMakkerbytte} disabled={!!activeFunMode || revealMode} title="Bytt om grupper">
                  <i className="fa-solid fa-shuffle text-[10px]"></i> Makkerbytte
                </button>
              </div>

              {/* Trekk en elev */}
              <div className="flex flex-col gap-1.5 pt-1">
                <button className="btn btn-xs bg-yellow-600 hover:bg-yellow-500 text-white gap-1.5 font-bold" onClick={startSpotlight} disabled={!!activeFunMode || revealMode}>
                  <i className="fa-solid fa-star text-[10px]"></i> Trekk en elev
                </button>
                {spotlightSlotKey && (
                  <button className="btn btn-xs btn-ghost text-slate-400 hover:text-white" onClick={dismissSpotlight}>
                    <i className="fa-solid fa-xmark"></i> Fjern uthevning
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Seksjon 3: Visningslag (Toggles) */}
        <div className="flex flex-col gap-1 p-2 rounded-xl bg-surface-field/40 border border-slate-800">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 mb-1">
            Visningslag
          </div>

          <ToggleRow
            icon="fa-solid fa-eye"
            label="Makkergrupper"
            checked={!hideGroups}
            onChange={() => setHideGroups(!hideGroups)}
          />

          <ToggleRow
            icon="fa-solid fa-fill-drip"
            label="Fargelagte bord"
            checked={colorSeatsByGroup}
            onChange={() => setColorSeatsByGroup(!colorSeatsByGroup)}
            disabled={hideGroups}
            tip="Fyller bordene med en lysere tone av makkergruppe-fargen."
          />

          <ToggleRow
            icon="fa-solid fa-clock-rotate-left"
            label="Makkere (historikk)"
            checked={showHistory}
            onChange={() => setShowHistory(!showHistory)}
            tip={'Fargen viser hvor nylig elevparet satt sammen sist:\nRød = forrige klassekart\nOransje = 2 kart siden\nGul = 3 kart siden\nLime = 4 kart siden\nGrønn = 5 kart siden'}
          />

          <ToggleRow
            icon="fa-solid fa-hashtag"
            label="Plassnumre"
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
            icon="fa-solid fa-user-shield"
            label="Skjul personinfo"
            checked={hideSensitiveInfo}
            onChange={() => setHideSensitiveInfo(!hideSensitiveInfo)}
          />

          <ToggleRow
            icon={canvasLight ? "fa-solid fa-sun" : "fa-solid fa-moon"}
            label="Lys bakgrunn"
            checked={canvasLight}
            onChange={toggleCanvasLight}
          />
        </div>

        {/* Seksjon 4: Klasserom og visningsmodus */}
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Klasserom</div>

          <button 
            className="btn btn-sm btn-outline border-slate-700 text-slate-300 justify-start hover:bg-slate-800" 
            onClick={flipRoom}
          >
            <i className="fa-solid fa-rotate fa-fw text-xs text-cyan-400"></i>
            <span>Snu klasserommet</span>
          </button>

          <button 
            className="btn btn-sm btn-outline border-slate-700 text-slate-300 justify-start hover:bg-slate-800" 
            onClick={() => setIsProjectorMode(true)}
          >
            <i className="fa-solid fa-expand fa-fw text-xs text-fuchsia-400"></i>
            <span>Prosjektor-modus</span>
          </button>

          <button 
            className="btn btn-sm btn-outline border-slate-700 text-slate-300 justify-start hover:bg-slate-800" 
            onClick={() => document.getElementById('modal_sync_room')?.showModal()}
          >
            <i className="fa-solid fa-arrows-rotate fa-fw text-xs text-orange-400"></i>
            <span className="flex-1 text-left">Oppdater romplan</span>
            <InfoTip text={'Klassekartet bruker et fastfrosset øyeblikksbilde av bordoppsettet.\n\nHar du gjort endringer i rommet i Rom-editoren, må du trykke her for å hente inn det nye oppsettet.'} />
          </button>
        </div>
      </div>
    </div>
  );
}
