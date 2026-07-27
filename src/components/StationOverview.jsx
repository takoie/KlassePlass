import React, { useState, useEffect } from 'react';
import { Card, PageLayout, ConfirmDeleteModal } from './OverviewViews';

export default function StationOverview({ onEdit, onAdd }) {
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [s, c] = await Promise.all([window.api.getStationSessions(), window.api.getClasses()]);
      setSessions(s);
      setClasses(c);
    } catch (e) {}
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.isClassGroup) {
        const classSessions = sessions.filter(s => s.class_id === deleteTarget.id);
        for (const s of classSessions) {
          await window.api.deleteStationSession(s.id);
        }
      } else {
        await window.api.deleteStationSession(deleteTarget.id);
      }
      await loadAll();
    } catch (e) {}
    setDeleteTarget(null);
  };

  return (
    <PageLayout title="Stasjonsundervisning" icon="fa-solid fa-arrows-rotate" onAdd={onAdd}>
      {sessions.length === 0 ? <p className="text-slate-400 text-sm italic col-span-full">Ingen stasjonsøkter opprettet enda.</p> : null}

      {classes.map(cls => {
        const classSessions = sessions.filter(s => s.class_id === cls.id).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        if (classSessions.length === 0) return null;

        const latest = classSessions[0];
        let stationCount = 0, groupCount = 0;
        try { stationCount = JSON.parse(latest.stations || '[]').length; } catch (e) {}
        try { groupCount = JSON.parse(latest.groups || '[]').length; } catch (e) {}

        return (
          <Card
            key={cls.id}
            title={cls.name}
            infoList={[
              { icon: 'fa-solid fa-arrows-rotate', text: `Siste: ${latest.name}` },
              { icon: 'fa-solid fa-signs-post', text: `${stationCount} stasjoner · ${groupCount} grupper` },
              { icon: 'fa-solid fa-layer-group', text: `Historikk: ${classSessions.length} økter` }
            ]}
            icon="fa-solid fa-arrows-rotate"
            onClick={() => onEdit(latest.id)}
            onDelete={() => setDeleteTarget({ ...cls, isClassGroup: true, name: `Klasse ${cls.name}` })}
          />
        );
      })}

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title={deleteTarget?.isClassGroup ? "all stasjonshistorikk" : "stasjonsøkt"}
        itemName={deleteTarget?.name}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageLayout>
  );
}
