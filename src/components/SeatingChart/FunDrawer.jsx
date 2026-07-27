import React from 'react';

/** Skuff for regelbasert randomisering og gradvis avdekking ("Fun Mode"). */
export default function FunDrawer({
  showFunDrawer, setShowFunDrawer, isSpinning, handleRuleBasedFunSpin,
  revealMode, revealedCount, revealTotal, startReveal, revealNext, revealAll, endReveal,
}) {
  return (
    <div className={`bg-[#171a25] border-slate-800 flex flex-col z-[49] transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 ${showFunDrawer ? 'w-64 border-r' : 'w-0 border-r-0'}`}>
      <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-[#1a1e2b] whitespace-nowrap min-w-[16rem]">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <i className="fa-solid fa-wand-magic-sparkles text-pink-400"></i> Fun Mode
        </h3>
        <button className="btn btn-ghost btn-xs btn-square hover:bg-slate-800 text-slate-400" onClick={() => setShowFunDrawer(false)}>
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-[#171a25] min-w-[16rem] items-center justify-center">
        <div className="text-center">
          <i className={`fa-solid fa-wand-magic-sparkles text-4xl text-pink-400 mb-2 ${isSpinning ? 'animate-bounce' : ''}`}></i>
          <h4 className="font-bold text-white text-sm">Elev-Randomiserer</h4>
          <p className="text-xs text-slate-400 mt-1">
            Spinn klassen for å plassere elevene med spennende visualisering og 100% regel-overholdelse.
          </p>
        </div>

        <button
          className={`btn btn-pink bg-pink-600 hover:bg-pink-500 text-white w-full gap-2 font-bold shadow-lg ${isSpinning ? 'loading' : ''}`}
          onClick={handleRuleBasedFunSpin}
          disabled={isSpinning}
        >
          <i className="fa-solid fa-play"></i> {isSpinning ? 'Spinner...' : 'Spin & Plasser (Med Regler)'}
        </button>

        <div className="h-px bg-slate-800/50 w-full my-1"></div>

        <div className="text-center">
          <i className="fa-solid fa-masks-theater text-4xl text-cyan-400 mb-2"></i>
          <h4 className="font-bold text-white text-sm">Gradvis avdekking</h4>
          <p className="text-xs text-slate-400 mt-1">
            Skjul hvem som sitter hvor, og avslør elev for elev — nyttig for å skape spenning foran klassen.
          </p>
        </div>

        {!revealMode ? (
          <button className="btn bg-cyan-600 hover:bg-cyan-500 text-white w-full gap-2 font-bold shadow-lg" onClick={startReveal}>
            <i className="fa-solid fa-eye-slash"></i> Start avdekking
          </button>
        ) : (
          <div className="w-full flex flex-col gap-2">
            <p className="text-xs text-center text-cyan-300 font-semibold">{revealedCount} av {revealTotal} avslørt</p>
            <button className="btn bg-cyan-600 hover:bg-cyan-500 text-white w-full gap-2 font-bold shadow-lg" onClick={revealNext} disabled={revealedCount >= revealTotal}>
              <i className="fa-solid fa-eye"></i> Avslør neste
            </button>
            <button className="btn btn-outline border-slate-700 text-slate-300 hover:bg-slate-800 w-full gap-2" onClick={revealAll} disabled={revealedCount >= revealTotal}>
              Avslør alle
            </button>
            <button className="btn btn-ghost text-slate-400 hover:text-white w-full gap-2" onClick={endReveal}>
              <i className="fa-solid fa-xmark"></i> Avslutt avdekking
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
