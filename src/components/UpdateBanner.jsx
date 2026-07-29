import React, { useEffect, useState } from 'react';

export default function UpdateBanner() {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    window.api?.onUpdateReady?.((info) => setUpdateInfo(info));
  }, []);

  if (!updateInfo) return null;

  const handleRestart = () => {
    setRestarting(true);
    window.api?.restartApp?.();
  };

  return (
    <div className="fixed bottom-4 right-4 z-[200] w-80 bg-surface-field border border-emerald-500/40 rounded-2xl shadow-2xl p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <i className="fa-solid fa-arrow-up text-emerald-400 text-sm"></i>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Ny versjon er klar</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {updateInfo.version ? `KlassePlass v${updateInfo.version} er lastet ned.` : 'En oppdatering er lastet ned.'} Restart for å installere.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              className="btn btn-xs bg-emerald-500/20 text-emerald-400 border-none hover:bg-emerald-500/30 gap-1.5"
              onClick={handleRestart}
              disabled={restarting}
            >
              <i className="fa-solid fa-rotate-right"></i>
              {restarting ? 'Restarter...' : 'Restart nå'}
            </button>
            <button
              className="btn btn-xs btn-ghost text-slate-400 hover:bg-slate-800"
              onClick={() => setUpdateInfo(null)}
              disabled={restarting}
            >
              Senere
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
