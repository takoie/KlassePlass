import React, { useState, useEffect } from 'react';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('visning');
  const [settings, setSettings] = useState({ boardPosition: 'top' });
  const [dbMessage, setDbMessage] = useState(null);

  useEffect(() => {
    loadSettings();
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
      <div className="w-56 bg-[#171a25] border-r border-slate-800 p-4">
        <h2 className="text-xl font-bold mb-6 px-2 flex items-center gap-2 text-white">
          <i className="fa-solid fa-gear text-emerald-400"></i> Innstillinger
        </h2>
        
        <div className="flex flex-col gap-1.5">
          <button 
            className={`overblikk-nav-btn !h-10 text-xs justify-start ${activeTab === 'visning' ? 'active' : ''}`}
            onClick={() => setActiveTab('visning')}
          >
            <i className="fa-solid fa-display text-xs"></i>
            <span>Visning & Generelt</span>
          </button>
          <button
            className={`overblikk-nav-btn !h-10 text-xs justify-start ${activeTab === 'database' ? 'active' : ''}`}
            onClick={() => setActiveTab('database')}
          >
            <i className="fa-solid fa-database text-xs"></i>
            <span>Database & Sikkerhetskopi</span>
          </button>
          <button
            className={`overblikk-nav-btn !h-10 text-xs justify-start ${activeTab === 'om' ? 'active' : ''}`}
            onClick={() => setActiveTab('om')}
          >
            <i className="fa-solid fa-circle-info text-xs"></i>
            <span>Om KlassePlass</span>
          </button>
          <button 
            className={`overblikk-nav-btn !h-10 text-xs justify-start ${activeTab === 'personvern' ? 'active' : ''}`}
            onClick={() => setActiveTab('personvern')}
          >
            <i className="fa-solid fa-shield-halved text-xs"></i>
            <span>Personvern & GDPR</span>
          </button>
          <button 
            className={`overblikk-nav-btn !h-10 text-xs justify-start ${activeTab === 'lisenser' ? 'active' : ''}`}
            onClick={() => setActiveTab('lisenser')}
          >
            <i className="fa-solid fa-scale-balanced text-xs"></i>
            <span>Lisenser</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'visning' && (
          <div className="max-w-2xl">
            <h3 className="text-xl font-bold mb-6 text-white">Visning & Generelt</h3>
            
            <div className="bg-[#262b3a] border border-slate-700/60 rounded-2xl p-6 mb-6">
              <h4 className="font-bold text-sm text-slate-200 mb-1">Standard Tavleplassering</h4>
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
            <h3 className="text-xl font-bold mb-6 text-white">Database & Sikkerhetskopi</h3>

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
              <p className="text-sm text-slate-400 max-w-md mx-auto">Det enkle, raske og 100% lokale verktøyet for lærere til å lage og administrere klassekart i norsk skole.</p>
            </div>
            
            <div className="bg-[#262b3a] border border-slate-700/60 rounded-2xl p-6">
              <h4 className="font-bold text-sm text-slate-200 mb-2">Utvikler & Informasjon</h4>
              <p className="text-xs text-slate-400 mb-2">Utviklet med fokus på brukervennlighet og personvern for lærere.</p>
              <a href="https://stian.taknes.no" className="text-xs text-emerald-400 hover:underline font-bold" target="_blank" rel="noreferrer">stian.taknes.no</a>
            </div>
          </div>
        )}

        {activeTab === 'personvern' && (
          <div className="max-w-2xl">
            <h3 className="text-xl font-bold mb-6 text-white">Personvern og GDPR</h3>
            <div className="bg-amber-950/40 border border-amber-500/40 text-amber-200 rounded-2xl p-6 mb-6">
              <h4 className="font-bold mb-2 flex items-center gap-2 text-amber-300">
                <i className="fa-solid fa-[#f59e0b] fa-shield-halved"></i> 100% Lokal Datatrygghet
              </h4>
              <p className="text-xs leading-relaxed">
                All data i KlassePlass lagres utelukkende lokalt på din egen PC (SQLite-database). Ingen elevnavn eller data sendes noen sinne til skytjenester eller eksterne servere.
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
                  <tr><td className="py-2.5 px-4 font-semibold">React & Vite</td><td className="py-2.5 px-4 text-emerald-400">MIT</td></tr>
                  <tr><td className="py-2.5 px-4 font-semibold">Electron</td><td className="py-2.5 px-4 text-emerald-400">MIT</td></tr>
                  <tr><td className="py-2.5 px-4 font-semibold">Tailwind CSS & DaisyUI</td><td className="py-2.5 px-4 text-emerald-400">MIT</td></tr>
                  <tr><td className="py-2.5 px-4 font-semibold">FontAwesome 6</td><td className="py-2.5 px-4 text-emerald-400">Free License</td></tr>
                  <tr><td className="py-2.5 px-4 font-semibold">better-sqlite3</td><td className="py-2.5 px-4 text-emerald-400">MIT</td></tr>
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
