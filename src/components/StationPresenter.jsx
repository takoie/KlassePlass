import React, { useState, useEffect, useRef } from 'react';

const GROUP_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#84cc16'];

export default function StationPresenter({ onBack, initialId }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [studentsById, setStudentsById] = useState({});
  const [rotationIndex, setRotationIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => { load(); return () => clearInterval(timerRef.current); }, [initialId]);

  const load = async () => {
    setLoading(true);
    try {
      const s = await window.api.getStationSession(initialId);
      if (!s) { setLoading(false); return; }

      let stations = [], groups = [], rotationPlan = [];
      try { stations = JSON.parse(s.stations || '[]'); } catch (e) {}
      try { groups = JSON.parse(s.groups || '[]'); } catch (e) {}
      try { rotationPlan = JSON.parse(s.rotation_plan || '[]'); } catch (e) {}

      const cls = await window.api.getClass(s.class_id);
      let byId = {};
      try {
        const parsed = cls?.students ? JSON.parse(cls.students) : [];
        const list = Array.isArray(parsed) ? parsed : (parsed.students || []);
        byId = Object.fromEntries(list.map(st => [st.id, st]));
      } catch (e) {}

      setSession({ ...s, stations, groups, rotationPlan, className: cls?.name || '' });
      setStudentsById(byId);
      setSecondsLeft((s.minutes_per_station || 10) * 60);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => {
    if (!isRunning) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          setTimeUp(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [isRunning]);

  const resetTimer = () => {
    clearInterval(timerRef.current);
    setIsRunning(false);
    setTimeUp(false);
    setSecondsLeft((session?.minutes_per_station || 10) * 60);
  };

  const goToRotation = (idx) => {
    if (!session || idx < 0 || idx >= session.rotationPlan.length) return;
    setRotationIndex(idx);
    resetTimer();
  };

  if (loading) {
    return <div className="flex h-full w-full items-center justify-center bg-[#131620] text-slate-500">Laster...</div>;
  }

  if (!session) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center bg-[#131620] text-slate-500 gap-3">
        <i className="fa-solid fa-arrows-rotate text-5xl opacity-20"></i>
        <h2 className="text-lg font-bold text-white">Fant ikke stasjonsøkten</h2>
        <button className="btn btn-ghost btn-sm text-slate-400" onClick={onBack}>
          <i className="fa-solid fa-arrow-left"></i> Tilbake
        </button>
      </div>
    );
  }

  const currentStep = session.rotationPlan[rotationIndex] || [];
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');
  const isLastRotation = rotationIndex >= session.rotationPlan.length - 1;

  return (
    <div className="flex flex-col h-full w-full bg-[#131620] overflow-hidden">
      <div className="px-6 py-3 bg-[#1a1e2b] border-b border-slate-800 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-4">
          <button className="btn btn-ghost btn-xs text-slate-400 hover:text-white gap-1" onClick={onBack}>
            <i className="fa-solid fa-arrow-left"></i> Avslutt
          </button>
          <h1 className="text-lg font-bold text-white">{session.name}</h1>
          <span className="text-xs font-bold uppercase opacity-50 text-slate-400">{session.className}</span>
        </div>
        <span className="text-sm font-bold text-slate-300">Rotasjon {rotationIndex + 1} av {session.rotationPlan.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(260px, 1fr))` }}>
          {session.stations.map((station, stationIdx) => {
            const groupIdx = currentStep[stationIdx];
            const studentIds = session.groups[groupIdx] || [];
            return (
              <div key={station.id} className={`rounded-2xl border-2 overflow-hidden ${station.isTeacher ? 'border-orange-500' : 'border-slate-800'}`}>
                <div className={`px-4 py-3 flex items-center justify-between ${station.isTeacher ? 'bg-orange-500/20' : 'bg-[#1a1e2b]'}`}>
                  <span className="font-bold text-white flex items-center gap-2">
                    {station.isTeacher && <i className="fa-solid fa-chalkboard-user text-orange-400"></i>}
                    {station.name}
                  </span>
                  {typeof groupIdx === 'number' && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full text-slate-900" style={{ backgroundColor: GROUP_COLORS[groupIdx % GROUP_COLORS.length] }}>
                      Gruppe {groupIdx + 1}
                    </span>
                  )}
                </div>
                <div className="bg-[#171a25] p-3 flex flex-col gap-1 min-h-[60px]">
                  {studentIds.map(sid => (
                    <span key={sid} className="text-sm text-slate-200">{studentsById[sid]?.name || sid}</span>
                  ))}
                  {station.note && (
                    <p className="text-xs text-slate-500 italic mt-2 border-t border-slate-800 pt-2">{station.note}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-6 py-4 bg-[#1a1e2b] border-t border-slate-800 flex items-center justify-center gap-6 flex-shrink-0">
        <button className="btn btn-outline border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => goToRotation(rotationIndex - 1)} disabled={rotationIndex === 0}>
          <i className="fa-solid fa-backward-step"></i> Forrige
        </button>

        <div className={`text-4xl font-black tabular-nums px-6 ${timeUp ? 'text-red-500 animate-pulse' : 'text-white'}`}>
          {mins}:{secs}
        </div>

        <button className="btn btn-circle bg-emerald-500/20 text-emerald-400 border-none hover:bg-emerald-500/30" onClick={() => setIsRunning(r => !r)}>
          <i className={`fa-solid ${isRunning ? 'fa-pause' : 'fa-play'}`}></i>
        </button>
        <button className="btn btn-ghost text-slate-400 hover:text-white" onClick={resetTimer} title="Start tiden på nytt">
          <i className="fa-solid fa-rotate-left"></i>
        </button>

        <button className="btn btn-primary" onClick={() => goToRotation(rotationIndex + 1)} disabled={isLastRotation}>
          Neste rotasjon <i className="fa-solid fa-forward-step"></i>
        </button>
      </div>
    </div>
  );
}
