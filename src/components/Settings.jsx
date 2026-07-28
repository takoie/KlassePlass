import React, { useState, useEffect } from 'react';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('visning');
  const [settings, setSettings] = useState({ boardPosition: 'top' });
  const [dbMessage, setDbMessage] = useState(null);
  const [appVersion, setAppVersion] = useState(null);

  useEffect(() => {
    loadSettings();
    window.api?.getVersion?.().then(setAppVersion).catch(() => {});
  }, []);

  const loadSettings = async () => {
    try {
      const s = await window.api.getSettings();
      if (s) setSettings(s);
    } catch(e) {}
  };

  const handleSaveSetting = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    try {
      await window.api.saveSettings({ [key]: value });
    } catch(e) {}
  };

  const handleBackup = async () => {
    setDbMessage(null);
    try {
      const result = await window.api.backupDb();
      if (result.canceled) return;
      setDbMessage(result.success
        ? { type: 'success', text: `Sikkerhetskopi lagret: ${result.filePath}` }
        : { type: 'error', text: result.error || 'Kunne ikke lagre sikkerhetskopi.' });
    } catch (e) {
      setDbMessage({ type: 'error', text: 'Kunne ikke lagre sikkerhetskopi.' });
    }
  };

  const handleRestore = async () => {
    document.getElementById('modal_restore_db')?.close();
    setDbMessage(null);
    try {
      const result = await window.api.restoreDb();
      if (result.canceled) return;
      setDbMessage(result.success
        ? { type: 'success', text: 'Database gjenopprettet. Start appen på nytt for at endringene skal vises overalt.' }
        : { type: 'error', text: result.error || 'Kunne ikke gjenopprette database.' });
    } catch (e) {
      setDbMessage({ type: 'error', text: 'Kunne ikke gjenopprette database.' });
    }
  };

  const handleMove = async () => {
    document.getElementById('modal_move_db')?.close();
    setDbMessage(null);
    try {
      const result = await window.api.moveDb();
      if (result.canceled) return;
      setDbMessage(result.success
        ? { type: 'success', text: `Database flyttet til: ${result.newPath}. Start appen på nytt.` }
        : { type: 'error', text: result.error || 'Kunne ikke flytte database.' });
    } catch (e) {
      setDbMessage({ type: 'error', text: 'Kunne ikke flytte database.' });
    }
  };

  return (
    <div className="flex h-full bg-[#1e2230] text-slate-100">
      {/* Sidebar for settings tabs */}
      <div className="w-64 bg-[#171a25] border-r border-slate-800 p-4 flex-shrink-0">
        <h2 className="text-xl font-bold mb-6 px-2 flex items-center gap-2 text-white">
          <i className="fa-solid fa-gear text-emerald-400"></i> Innstillinger
        </h2>

        <div className="flex flex-col gap-1.5">
          <button
            className={`overblikk-nav-btn !h-10 text-xs justify-start ${activeTab === 'visning' ? 'active' : ''}`}
            onClick={() => setActiveTab('visning')}
          >
            <i className="fa-solid fa-display text-xs flex-shrink-0"></i>
            <span className="truncate min-w-0 flex-1 text-left">Visning & generelt</span>
          </button>
          <button
            className={`overblikk-nav-btn !h-10 text-xs justify-start ${activeTab === 'database' ? 'active' : ''}`}
            onClick={() => setActiveTab('database')}
          >
            <i className="fa-solid fa-database text-xs flex-shrink-0"></i>
            <span className="truncate min-w-0 flex-1 text-left">Database & sikkerhetskopi</span>
          </button>
          <button
            className={`overblikk-nav-btn !h-10 text-xs justify-start ${activeTab === 'om' ? 'active' : ''}`}
            onClick={() => setActiveTab('om')}
          >
            <i className="fa-solid fa-circle-info text-xs flex-shrink-0"></i>
            <span className="truncate min-w-0 flex-1 text-left">Om KlassePlass</span>
          </button>
          <button
            className={`overblikk-nav-btn !h-10 text-xs justify-start ${activeTab === 'personvern' ? 'active' : ''}`}
            onClick={() => setActiveTab('personvern')}
          >
            <i className="fa-solid fa-shield-halved text-xs flex-shrink-0"></i>
            <span className="truncate min-w-0 flex-1 text-left">Personvern & GDPR</span>
          </button>
          <button
            className={`overblikk-nav-btn !h-10 text-xs justify-start ${activeTab === 'lisenser' ? 'active' : ''}`}
            onClick={() => setActiveTab('lisenser')}
          >
            <i className="fa-solid fa-scale-balanced text-xs flex-shrink-0"></i>
            <span className="truncate min-w-0 flex-1 text-left">Lisenser</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'visning' && (
          <div className="max-w-2xl">
            <h3 className="text-xl font-bold mb-6 text-white">Visning & generelt</h3>
            
            <div className="bg-[#262b3a] border border-slate-700/60 rounded-2xl p-6 mb-6">
              <h4 className="font-bold text-sm text-slate-200 mb-1">Standard tavleplassering</h4>
              <p className="text-xs text-slate-400 mb-4">Velg om tavlen skal ligge øverst eller nederst i klasserommet som standard.</p>
              
              <div className="form-control max-w-xs">
                <select 
                  className="select select-bordered bg-[#1a1e2b] border-slate-700 text-slate-200 focus:border-emerald-500"
                  value={settings.boardPosition || 'top'}
                  onChange={(e) => handleSaveSetting('boardPosition', e.target.value)}
                >
                  <option value="top">Tavle øverst</option>
                  <option value="bottom">Tavle nederst</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'database' && (
          <div className="max-w-2xl">
            <h3 className="text-xl font-bold mb-6 text-white">Database & sikkerhetskopi</h3>

            {dbMessage && (
              <div className={`rounded-2xl p-4 mb-6 text-xs font-semibold border ${
                dbMessage.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/40 border-red-500/40 text-red-300'
              }`}>
                {dbMessage.text}
              </div>
            )}

            <div className="bg-[#262b3a] border border-slate-700/60 rounded-2xl p-6 mb-6">
              <h4 className="font-bold text-sm text-slate-200 mb-1">Ta sikkerhetskopi</h4>
              <p className="text-xs text-slate-400 mb-4">Lagre en kopi av hele databasen (alle klasser, rom og klassekart) som en fil du selv velger.</p>
              <button className="btn btn-sm bg-emerald-500/20 text-emerald-400 border-none hover:bg-emerald-500/30 gap-2" onClick={handleBackup}>
                <i className="fa-solid fa-download"></i> Lagre sikkerhetskopi
              </button>
            </div>

            <div className="bg-[#262b3a] border border-slate-700/60 rounded-2xl p-6 mb-6">
              <h4 className="font-bold text-sm text-slate-200 mb-1">Gjenopprett fra sikkerhetskopi</h4>
              <p className="text-xs text-slate-400 mb-4">Erstatter hele den nåværende databasen med innholdet i en valgt sikkerhetskopi-fil. Den nåværende databasen tas automatisk vare på som <code>.bak</code> først.</p>
              <button className="btn btn-sm btn-outline border-amber-500/40 text-amber-400 hover:bg-amber-500/10 gap-2" onClick={() => document.getElementById('modal_restore_db')?.showModal()}>
                <i className="fa-solid fa-upload"></i> Gjenopprett fra fil...
              </button>
            </div>

            <div className="bg-[#262b3a] border border-slate-700/60 rounded-2xl p-6">
              <h4 className="font-bold text-sm text-slate-200 mb-1">Flytt database</h4>
              <p className="text-xs text-slate-400 mb-4">Flytt databasefilen til en annen mappe (f.eks. en delt nettverksstasjon eller skylagringsmappe). Appen må startes på nytt etterpå.</p>
              <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 hover:bg-slate-800 gap-2" onClick={() => document.getElementById('modal_move_db')?.showModal()}>
                <i className="fa-solid fa-folder-tree"></i> Velg ny plassering...
              </button>
            </div>
          </div>
        )}

        {activeTab === 'om' && (
          <div className="max-w-2xl">
            <div className="text-center py-10 bg-[#262b3a] border border-slate-700/60 rounded-2xl mb-6 shadow-xl">
              <h1 className="text-4xl font-extrabold mb-2 text-white tracking-wider">
                KLASSE<span className="text-[#f59e0b]">PLASS</span>
              </h1>
              {appVersion && (
                <p className="text-xs text-slate-500 font-mono mb-2">v{appVersion}</p>
              )}
              <p className="text-sm text-slate-400 max-w-md mx-auto">Et enkelt, raskt og 100% lokalt verktøy for lærere — opprett klasser, design klasserom, sett sammen klassekart, fordel elever i grupper og kjør stasjonsundervisning.</p>
            </div>

            <div className="bg-[#262b3a] border border-slate-700/60 rounded-2xl p-6">
              <h4 className="font-bold text-sm text-slate-200 mb-2">Utvikler & informasjon</h4>
              <p className="text-xs text-slate-400">
                Utviklet av Stian Taknæs - <a href="mailto:stian@taknes.no" className="text-emerald-400 hover:underline font-bold">stian@taknes.no</a>
              </p>
            </div>
          </div>
        )}

        {activeTab === 'personvern' && (
          <div className="max-w-2xl">
            <h3 className="text-xl font-bold mb-6 text-white">Personvern og GDPR</h3>
            <div className="bg-amber-950/40 border border-amber-500/40 text-amber-200 rounded-2xl p-6 mb-6">
              <h4 className="font-bold mb-2 flex items-center gap-2 text-amber-300">
                <i className="fa-solid fa-[#f59e0b] fa-shield-halved"></i> 100% lokal datatrygghet
              </h4>
              <p className="text-xs leading-relaxed">
                All data i KlassePlass lagres utelukkende lokalt på din egen PC (SQLite-database). Ingen elevnavn eller annen data sendes til skytjenester eller eksterne servere.
              </p>
            </div>
            
            <div className="bg-[#262b3a] border border-slate-700/60 rounded-2xl p-6">
              <h4 className="font-bold text-sm text-slate-200 mb-3">Retningslinjer for skolen</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Behandling av personopplysninger skjer i henhold til skolens interne personvernrutiner og UDIRs retningslinjer for digitale verktøy i skolen.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'lisenser' && (
          <div className="max-w-2xl">
            <h3 className="text-xl font-bold mb-6 text-white">Tredjepartsbiblioteker & Lisenser</h3>
            <div className="overflow-x-auto bg-[#262b3a] border border-slate-700/60 rounded-2xl">
              <table className="table w-full text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-700/80 text-slate-400">
                    <th className="py-3 px-4 text-left">Bibliotek</th>
                    <th className="py-3 px-4 text-left">Lisens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  <tr><td className="py-2.5 px-4 font-semibold">React & React DOM</td><td className="py-2.5 px-4 text-emerald-400">MIT</td></tr>
                  <tr><td className="py-2.5 px-4 font-semibold">Electron</td><td className="py-2.5 px-4 text-emerald-400">MIT</td></tr>
                  <tr><td className="py-2.5 px-4 font-semibold">electron-updater</td><td className="py-2.5 px-4 text-emerald-400">MIT</td></tr>
                  <tr><td className="py-2.5 px-4 font-semibold">Vite</td><td className="py-2.5 px-4 text-emerald-400">MIT</td></tr>
                  <tr><td className="py-2.5 px-4 font-semibold">Tailwind CSS & daisyUI</td><td className="py-2.5 px-4 text-emerald-400">MIT</td></tr>
                  <tr><td className="py-2.5 px-4 font-semibold">dnd kit</td><td className="py-2.5 px-4 text-emerald-400">MIT</td></tr>
                  <tr><td className="py-2.5 px-4 font-semibold">sql.js (SQLite for nettleser/WASM)</td><td className="py-2.5 px-4 text-emerald-400">MIT</td></tr>
                  <tr><td className="py-2.5 px-4 font-semibold">Font Awesome Free</td><td className="py-2.5 px-4 text-emerald-400">CC BY 4.0 / SIL OFL 1.1 / MIT</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      <dialog id="modal_restore_db" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box bg-[#171a25] border border-slate-700 text-slate-100 rounded-2xl">
          <h3 className="font-bold text-lg text-amber-400 flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation"></i> Gjenopprett database?
          </h3>
          <p className="py-4 text-sm text-slate-300">
            Dette erstatter <strong>hele</strong> den nåværende databasen med innholdet i filen du velger.
            Alle klasser, rom og klassekart som er lagt til etter sikkerhetskopien går tapt.
            Den nåværende databasen tas automatisk vare på som <code>.bak</code> først.
          </p>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost text-slate-400 mr-2 hover:bg-slate-800">Avbryt</button>
            </form>
            <button className="btn btn-warning" onClick={handleRestore}>Velg fil og gjenopprett</button>
          </div>
        </div>
      </dialog>

      <dialog id="modal_move_db" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box bg-[#171a25] border border-slate-700 text-slate-100 rounded-2xl">
          <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
            <i className="fa-solid fa-folder-tree text-slate-400"></i> Flytt database?
          </h3>
          <p className="py-4 text-sm text-slate-300">
            Databasefilen flyttes til mappen du velger. Appen må startes på nytt etter flyttingen for at endringen skal tre i kraft.
          </p>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost text-slate-400 mr-2 hover:bg-slate-800">Avbryt</button>
            </form>
            <button className="btn btn-primary" onClick={handleMove}>Velg mappe og flytt</button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
