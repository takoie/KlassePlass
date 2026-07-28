import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import PrintPage, { computePrintScale } from './PrintPage';
import { usePrintSettings } from './usePrintSettings';
import { buildPrintFilename } from './printFilename';
import SeatingChartPrintContent, { CONTENT_WIDTH_PX, CONTENT_HEIGHT_PX } from './printLayouts/SeatingChartPrintContent';
import StationPrintContent, { STATION_CONTENT_WIDTH_PX, estimateStationContentHeight } from './printLayouts/StationPrintContent';

export default function PrintPreviewModal({
  contentType = 'seatingChart',
  chartName, className, chartComment, boardObj, desks, deskNumberMap, placements,
  getStudentByIdOrName, groupColors, zoneMeta, stationProps,
  initialShowNumbers, initialShowZones, initialShowGroups,
  onClose,
}) {
  const { settings, setShowNumbers, setShowZones, setShowGroups, setShowColors } =
    usePrintSettings({ initialShowNumbers, initialShowZones, initialShowGroups });
  const [exportState, setExportState] = useState({ status: 'idle' }); // idle | working | done | error
  const dialogRef = useRef(null);

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
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Egen listener (i stedet for Reacts onClose-prop) slik at vi kan fjerne den før vi
    // lukker dialogen selv i cleanup — ellers ville React StrictModes dobbeltkjøring av
    // effekter i dev (mount → cleanup → mount) trigget onClose og lukket modalen med en
    // gang den åpnes, siden cleanup sin dialog.close() også fyrer av 'close'-eventet.
    const handleNativeClose = () => onCloseRef.current?.();
    dialog.addEventListener('close', handleNativeClose);
    dialog.showModal();
    return () => {
      dialog.removeEventListener('close', handleNativeClose);
      if (dialog.open) dialog.close();
    };
  }, []); // kjør kun ved faktisk mount/unmount, ikke ved onClose-identitetsendring

  const isStation = contentType === 'station';
  const contentWidthPx = isStation ? STATION_CONTENT_WIDTH_PX : CONTENT_WIDTH_PX;
  const contentHeightPx = isStation ? estimateStationContentHeight(stationProps || {}) : CONTENT_HEIGHT_PX;

  const previewScale = computePrintScale(contentWidthPx, contentHeightPx) * 0.6; // ekstra nedskalering for modal-visning

  const contentProps = {
    boardObj, desks, deskNumberMap, placements, getStudentByIdOrName, groupColors, zoneMeta, settings,
  };

  const content = isStation
    ? <StationPrintContent {...stationProps} settings={settings} />
    : <SeatingChartPrintContent {...contentProps} />;

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = async () => {
    setExportState({ status: 'working' });
    const suggestedName = buildPrintFilename({ className, chartName, prefix: isStation ? 'Stasjonsplan' : 'Klassekart' });
    try {
      const result = await window.api.exportPrintPdf({ suggestedName });
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
        <div className="modal-box max-w-6xl max-h-[85vh] overflow-y-auto">
          <h3 className="font-bold text-lg mb-4">{isStation ? 'Skriv ut / Eksporter stasjonsplan' : 'Skriv ut / Eksporter klassekart'}</h3>
          <div className="flex gap-6">
            <div className="w-48 flex flex-col gap-3">
              <label className="label cursor-pointer justify-between">
                <span>Farger</span>
                <input type="checkbox" className="toggle" checked={settings.showColors} onChange={(e) => setShowColors(e.target.checked)} />
              </label>
              {contentType !== 'station' && (
                <label className="label cursor-pointer justify-between">
                  <span>Numre</span>
                  <input type="checkbox" className="toggle" checked={settings.showNumbers} onChange={(e) => setShowNumbers(e.target.checked)} />
                </label>
              )}
              <label className="label cursor-pointer justify-between">
                <span>Makkergrupper</span>
                <input type="checkbox" className="toggle" checked={settings.showGroups} onChange={(e) => setShowGroups(e.target.checked)} />
              </label>
              {contentType !== 'station' && (
                <label className="label cursor-pointer justify-between">
                  <span>Soner</span>
                  <input type="checkbox" className="toggle" checked={settings.showZones} onChange={(e) => setShowZones(e.target.checked)} />
                </label>
              )}
            </div>
            <div className="flex-1 overflow-auto bg-slate-800 rounded-lg p-4 flex items-center justify-center">
              <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                <PrintPage title={chartName} periodText={[className, chartComment].filter(Boolean).join(' · ')} contentWidthPx={contentWidthPx} contentHeightPx={contentHeightPx}>
                  {content}
                </PrintPage>
              </div>
            </div>
          </div>

          {exportState.status === 'done' && (
            <div className="alert alert-success mt-4 flex justify-between">
              <span>PDF lagret som {exportState.filePath.split(/[\\/]/).pop()}</span>
              <div className="flex gap-2">
                <button className="btn btn-xs" onClick={() => window.api.openPath(exportState.filePath)}>Åpne fil</button>
                <button className="btn btn-xs" onClick={() => window.api.showInFolder(exportState.filePath)}>Åpne mappe</button>
              </div>
            </div>
          )}
          {exportState.status === 'error' && (
            <div className="alert alert-error mt-4">Kunne ikke lagre PDF: {exportState.message}</div>
          )}

          <div className="modal-action">
            <button className="btn" onClick={onClose}>Lukk</button>
            <button className="btn btn-outline" onClick={handlePrint}>Skriv ut</button>
            <button className="btn btn-primary" onClick={handleExportPdf} disabled={exportState.status === 'working'}>
              {exportState.status === 'working' ? 'Genererer PDF…' : 'Eksporter til PDF'}
            </button>
          </div>
        </div>
      </dialog>

      {/* Faktisk print/PDF-mål — skjult utenfor @media print */}
      <div id="print-output">
        <PrintPage title={chartName} periodText={[className, chartComment].filter(Boolean).join(' · ')} contentWidthPx={contentWidthPx} contentHeightPx={contentHeightPx}>
          {content}
        </PrintPage>
      </div>
    </>,
    document.body
  );
}
