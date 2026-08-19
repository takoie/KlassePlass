import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import PrintPage, { computePrintScale, getPageSizePx } from './PrintPage';
import { usePrintSettings } from './usePrintSettings';
import { buildPrintFilename } from './printFilename';
import RoomViewport from './RoomViewport';
import SeatingChartPrintContent, { CONTENT_WIDTH_PX, CONTENT_HEIGHT_PX } from './printLayouts/SeatingChartPrintContent';
import buildSeatingChartPrintPayload from './printLayouts/buildSeatingChartPrintPayload';
import StationPrintContent, { paginateStationRotations, getStationPageWidthPx, estimateStationPageHeight } from './printLayouts/StationPrintContent';
import GroupPrintContent, { paginateGroups, GROUP_CONTENT_WIDTH_PX, estimateGroupsPageHeight } from './printLayouts/GroupPrintContent';

const ROOM_ZOOM_MIN = 1;
const ROOM_ZOOM_MAX = 2.5;

export default function PrintPreviewModal({
  contentType = 'seatingChart',
  chartName, className, chartComment, boardObj, desks, deskNumberMap, placements,
  getStudentByIdOrName, groupColors, zoneMeta, groupOverrides, stationProps, groupWorkProps,
  initialShowNumbers, initialShowZones, initialShowGroups, initialColorSeats,
  onClose,
}) {
  const isStation = contentType === 'station';
  const isGroupWork = contentType === 'groupWork';
  const isSeatingChart = !isStation && !isGroupWork;

  const { settings, setShowNumbers, setShowZones, setShowGroups, setShowColors, setColorSeats, setGroupLayout } =
    usePrintSettings({ initialShowNumbers, initialShowZones, initialShowGroups, initialColorSeats });
  const [exportState, setExportState] = useState({ status: 'idle' }); // idle | working | done | error
  const dialogRef = useRef(null);
  const previewPaneRef = useRef(null);
  const [previewPaneSize, setPreviewPaneSize] = useState(null);
  // Kamera for selve innholdet (pulter/tabell): lar læreren zoome/panorere
  // uavhengig av topptekst/bunntekst på arket, i stedet for å skalere hele siden.
  const [roomZoom, setRoomZoom] = useState(1);
  const [roomPan, setRoomPan] = useState({ x: 0, y: 0 });
  const resetRoomView = () => { setRoomZoom(1); setRoomPan({ x: 0, y: 0 }); };

  // Alltid siste onClose tilgjengelig for lytteren under, uten at selve
  // åpne/lukk-effekten må kjøre på nytt hver gang onClose bytter identitet
  // (SeatingChart.jsx sender inn en ny inline-funksjon ved hver egen re-render,
  // noe som skjer ofte — uten dette rekker effekten under å lukke og gjenåpne
  // dialogen i utide, synlig som at modalen blafrer opp og lukkes med en gang).
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Ekte showModal() promoterer dialogen til nettleserens "top layer" — den rendres
  // da alltid over resten av appen uansett z-index/stacking-context i foreldre-treet.
  // Uten dette (kun open-attributtet) kan sidepanelet/verktøylinjen male over modalen
  // og stjele klikk som visuelt treffer bryterne.
  //
  // VIKTIG: dialog.close() kø-legger 'close'-eventet som en task i stedet for å fyre
  // det synkront (jf. HTML-spesifikasjonen). React StrictMode kjører denne effekten
  // mount → cleanup → mount i rask rekkefølge i dev — hvis cleanup kaller close(), når
  // den kø-lagte 'close'-hendelsen først fram EFTER den andre (ekte) monteringen har
  // lagt til sin egen listener, som da feilaktig mottar en gammel lukk-hendelse og
  // lukker modalen med det samme den åpnes. Derfor kaller cleanup ALDRI close() — kun
  // showModal() beskyttet av en open-sjekk (så et ubrukt gjenåpningsforsøk ikke kaster
  // InvalidStateError), og selve lukkingen skjer utelukkende via ekte brukerhandling
  // (Lukk-knappen eller ESC), som fyrer 'close' korrekt og trygt.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleNativeClose = () => onCloseRef.current?.();
    dialog.addEventListener('close', handleNativeClose);
    if (!dialog.open) dialog.showModal();
    return () => {
      dialog.removeEventListener('close', handleNativeClose);
    };
  }, []); // kjør kun ved faktisk mount/unmount, ikke ved onClose-identitetsendring

  // Måler tilgjengelig plass i preview-ruten løpende, slik at previewen alltid
  // fyller ruten mest mulig i stedet for å bruke en fast, vilkårlig nedskalering.
  useEffect(() => {
    const el = previewPaneRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setPreviewPaneSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Bygger listen over sider som faktisk skal skrives ut. Stasjonsplan
  // paginerer rotasjoner i kolonner (for mange rotasjoner blir uleselig
  // smalt), gruppearbeid paginerer grupper i rader (for mange/store grupper
  // blir en uoversiktlig lang liste) — klassekart er alltid én side.
  let pages;
  if (isStation) {
    const rotationPages = paginateStationRotations(stationProps?.rotationPlan || []);
    pages = rotationPages.map((rp) => ({
      contentWidthPx: getStationPageWidthPx(rp.rotations),
      contentHeightPx: estimateStationPageHeight(stationProps || {}, rp.rotations),
      node: (
        <StationPrintContent
          stations={stationProps.stations}
          groups={stationProps.groups}
          groupLeaders={stationProps.groupLeaders}
          students={stationProps.students}
          groupColors={stationProps.groupColors}
          rotationsOnPage={rp.rotations}
          startIndex={rp.startIndex}
          settings={settings}
        />
      ),
    }));
  } else if (isGroupWork) {
    const groupPages = paginateGroups(groupWorkProps?.groups || [], settings.groupLayout);
    pages = groupPages.map((groupsOnPage) => ({
      contentWidthPx: GROUP_CONTENT_WIDTH_PX,
      contentHeightPx: estimateGroupsPageHeight(groupsOnPage, settings.groupLayout),
      node: (
        <GroupPrintContent
          groupsOnPage={groupsOnPage}
          studentsById={groupWorkProps.studentsById}
          leaderIds={groupWorkProps.leaderIds}
          groupColors={groupWorkProps.groupColors}
          groupNames={groupWorkProps.groupNames}
          settings={settings}
        />
      ),
    }));
  } else {
    pages = [{
      contentWidthPx: CONTENT_WIDTH_PX,
      contentHeightPx: CONTENT_HEIGHT_PX,
      node: (
        <SeatingChartPrintContent
          boardObj={boardObj} desks={desks} deskNumberMap={deskNumberMap} placements={placements}
          getStudentByIdOrName={getStudentByIdOrName} groupColors={groupColors} zoneMeta={zoneMeta}
          groupOverrides={groupOverrides} settings={settings}
        />
      ),
    }];
  }

  const pageSizePx = getPageSizePx();
  const PANE_PADDING_PX = 16;
  const previewScale = previewPaneSize
    ? Math.min(
        (previewPaneSize.width - PANE_PADDING_PX) / pageSizePx.width,
        (previewPaneSize.height - PANE_PADDING_PX) / pageSizePx.height,
      )
    : 1;

  // Skjermpiksler i den interaktive previewen tilsvarer sidens contentWidthPx/Height
  // nedskalert to ganger (modal-panelets tilpasning + PrintPage sin egen
  // sideoppsett-skalering). Dra-avstanden må konverteres tilbake til denne
  // koordinaten, ellers "løper" panoreringen fra musepekeren i takt med hvor
  // nedskalert previewen er.
  const wrapWithViewport = (page, interactive) => {
    const dragScale = interactive ? previewScale * computePrintScale(page.contentWidthPx, page.contentHeightPx) : 1;
    return (
      <RoomViewport
        width={page.contentWidthPx}
        height={page.contentHeightPx}
        zoom={roomZoom}
        panX={roomPan.x}
        panY={roomPan.y}
        onPanChange={(x, y) => setRoomPan({ x, y })}
        dragScale={dragScale}
        interactive={interactive}
      >
        {page.node}
      </RoomViewport>
    );
  };

  const periodText = [className, chartComment].filter(Boolean).join(' · ');
  const groupsToggleLabel = isSeatingChart ? 'Makkergrupper' : 'Ledere';
  const titleText = isStation ? 'Skriv ut / Eksporter stasjonsplan'
    : isGroupWork ? 'Skriv ut / Eksporter gruppeinndeling'
    : 'Skriv ut / Eksporter klassekart';
  const filenamePrefix = isStation ? 'Stasjonsplan' : isGroupWork ? 'Gruppeinndeling' : 'Klassekart';

  const handlePrint = () => {
    const originalTitle = document.title;
    try {
      document.title = '';
      window.print();
    } finally {
      document.title = originalTitle;
    }
  };

  const handleExportPdf = async () => {
    setExportState({ status: 'working' });
    const suggestedName = buildPrintFilename({ className, chartName, chartComment, prefix: filenamePrefix });
    const payload = isSeatingChart
      ? buildSeatingChartPrintPayload({
          boardObj, desks, deskNumberMap, placements, getStudentByIdOrName,
          groupColors, zoneMeta, groupOverrides, settings, chartName, periodText,
          roomZoom, roomPan,
        })
      : null;
    try {
      const result = await window.api.exportPrintPdf({ suggestedName, contentType, payload });
      if (result.canceled) { setExportState({ status: 'idle' }); return; }
      if (!result.success) { setExportState({ status: 'error', message: result.error }); return; }
      setExportState({ status: 'done', filePath: result.filePath });
    } catch (e) {
      setExportState({ status: 'error', message: e.message });
    }
  };

  return createPortal(
    <>
      <dialog id="modal_print_preview" ref={dialogRef} className="modal modal-open">
        <div className="modal-box bg-surface-raised border border-slate-700 text-slate-100 rounded-2xl w-[95vw] max-w-[95vw] h-[92vh] max-h-[92vh] overflow-y-auto flex flex-col">
          <h3 className="font-bold text-lg mb-4">{titleText}</h3>
          <div className="flex gap-4 flex-1 min-h-0">
            <div className="w-44 flex-shrink-0 flex flex-col gap-2 bg-base-200 border border-slate-800 rounded-xl p-3">
              <label className="flex items-center justify-between cursor-pointer text-sm text-slate-300">
                <span>Farger</span>
                <input type="checkbox" className="toggle toggle-sm toggle-primary" checked={settings.showColors} onChange={(e) => setShowColors(e.target.checked)} />
              </label>
              {isSeatingChart && (
                <label className="flex items-center justify-between cursor-pointer text-sm text-slate-300">
                  <span>Numre</span>
                  <input type="checkbox" className="toggle toggle-sm toggle-primary" checked={settings.showNumbers} onChange={(e) => setShowNumbers(e.target.checked)} />
                </label>
              )}
              <label className="flex items-center justify-between cursor-pointer text-sm text-slate-300">
                <span>{groupsToggleLabel}</span>
                <input type="checkbox" className="toggle toggle-sm toggle-primary" checked={settings.showGroups} onChange={(e) => setShowGroups(e.target.checked)} />
              </label>
              {isSeatingChart && (
                <label className="flex items-center justify-between cursor-pointer text-sm text-slate-300">
                  <span>Fargelegg bord</span>
                  <input
                    type="checkbox" className="toggle toggle-sm toggle-primary"
                    checked={settings.colorSeats}
                    onChange={(e) => setColorSeats(e.target.checked)}
                    disabled={!settings.showGroups}
                  />
                </label>
              )}
              {isSeatingChart && (
                <label className="flex items-center justify-between cursor-pointer text-sm text-slate-300">
                  <span>Soner</span>
                  <input type="checkbox" className="toggle toggle-sm toggle-primary" checked={settings.showZones} onChange={(e) => setShowZones(e.target.checked)} />
                </label>
              )}
              {isGroupWork && (
                <label className="flex items-center justify-between cursor-pointer text-sm text-slate-300">
                  <span>Vannrett</span>
                  <input
                    type="checkbox" className="toggle toggle-sm toggle-primary"
                    checked={settings.groupLayout === 'horizontal'}
                    onChange={(e) => setGroupLayout(e.target.checked ? 'horizontal' : 'vertical')}
                  />
                </label>
              )}
              <div className="border-t border-slate-800 my-1"></div>
              <div className="flex flex-col gap-1">
                <span className="flex justify-between text-sm text-slate-300">
                  <span>Zoom</span>
                  <span className="text-slate-500">{Math.round(roomZoom * 100)}%</span>
                </span>
                <input
                  type="range"
                  className="range range-xs range-primary"
                  min={ROOM_ZOOM_MIN}
                  max={ROOM_ZOOM_MAX}
                  step={0.05}
                  value={roomZoom}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setRoomZoom(next);
                    if (next <= 1) setRoomPan({ x: 0, y: 0 });
                  }}
                />
                <p className="text-xs text-slate-500">
                  {roomZoom > 1 ? 'Dra i forhåndsvisningen for å flytte utsnittet.' : 'Zoom inn for å kunne dra i utsnittet.'}
                </p>
                {(roomZoom !== 1 || roomPan.x !== 0 || roomPan.y !== 0) && (
                  <button className="btn btn-ghost btn-xs self-start" onClick={resetRoomView}>Nullstill utsnitt</button>
                )}
              </div>
              {pages.length > 1 && (
                <>
                  <div className="border-t border-slate-800 my-1"></div>
                  <p className="text-xs text-slate-400">
                    <i className="fa-solid fa-file-lines mr-1"></i>{pages.length} sider ved utskrift
                  </p>
                </>
              )}
            </div>
            <div ref={previewPaneRef} className="flex-1 min-h-0 overflow-auto bg-slate-900/60 border border-slate-800/80 rounded-xl p-2 flex flex-col items-center justify-center gap-4">
              {pages.map((page, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  {pages.length > 1 && (
                    <div className="flex items-center gap-2">
                      {i > 0 && <div className="w-full border-t border-dashed border-slate-500"></div>}
                      <span className="px-2 py-0.5 rounded-full bg-slate-700/80 border border-slate-600 text-[11px] font-bold text-slate-200 whitespace-nowrap">
                        Side {i + 1} av {pages.length}
                      </span>
                    </div>
                  )}
                  <div style={{ zoom: previewScale }}>
                    <PrintPage title={chartName} periodText={periodText} contentWidthPx={page.contentWidthPx} contentHeightPx={page.contentHeightPx}>
                      {wrapWithViewport(page, true)}
                    </PrintPage>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {exportState.status === 'done' && (
            <div className="mt-4 flex items-center justify-between bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <i className="fa-solid fa-circle-check text-sm"></i>
                </div>
                <div>
                  <div className="font-semibold text-white text-xs">PDF lagret</div>
                  <div className="text-[11px] text-slate-400 font-mono truncate max-w-sm" title={exportState.filePath}>
                    {exportState.filePath.split(/[\\/]/).pop()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 gap-1.5 font-medium transition-all"
                  onClick={() => window.api.openPath(exportState.filePath)}
                >
                  <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i> Åpne fil
                </button>
                <button
                  type="button"
                  className="btn btn-xs bg-slate-700/80 hover:bg-slate-600 text-slate-200 border border-slate-600 gap-1.5 font-medium transition-all"
                  onClick={() => window.api.showInFolder(exportState.filePath)}
                >
                  <i className="fa-regular fa-folder-open text-[10px]"></i> Åpne mappe
                </button>
              </div>
            </div>
          )}
          {exportState.status === 'error' && (
            <div className="mt-4 flex items-center gap-3 bg-red-950/40 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-200">
              <i className="fa-solid fa-triangle-exclamation text-red-400 text-base"></i>
              <span>Kunne ikke lagre PDF: {exportState.message}</span>
            </div>
          )}

          <div className="modal-action flex justify-between items-center">
            <button className="btn btn-ghost text-slate-400 hover:text-white" onClick={onClose}>Lukk</button>
            <div className="flex items-center gap-2">
              <button className="btn btn-outline border-slate-700 text-slate-200 hover:bg-slate-800 gap-2" onClick={handlePrint}>
                <i className="fa-solid fa-print"></i> Skriv ut
              </button>
              <button className="btn btn-primary gap-2" onClick={handleExportPdf} disabled={exportState.status === 'working'}>
                <i className="fa-solid fa-file-pdf"></i> {exportState.status === 'working' ? 'Genererer PDF…' : 'Eksporter til PDF'}
              </button>
            </div>
          </div>
        </div>
      </dialog>

      {/* Faktisk print/PDF-mål — skjult utenfor @media print */}
      <div id="print-output">
        {pages.map((page, i) => (
          <PrintPage key={i} title={chartName} periodText={periodText} contentWidthPx={page.contentWidthPx} contentHeightPx={page.contentHeightPx}>
            {wrapWithViewport(page, false)}
          </PrintPage>
        ))}
      </div>
    </>,
    document.body
  );
}
