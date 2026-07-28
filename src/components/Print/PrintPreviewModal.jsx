import React, { useState } from 'react';
import PrintPage, { computePrintScale } from './PrintPage';
import { usePrintSettings } from './usePrintSettings';
import { buildPrintFilename } from './printFilename';
import SeatingChartPrintContent, { CONTENT_WIDTH_PX, CONTENT_HEIGHT_PX } from './printLayouts/SeatingChartPrintContent';

export default function PrintPreviewModal({
  chartName, className, chartComment, boardObj, desks, deskNumberMap, placements,
  getStudentByIdOrName, groupColors, zoneMeta,
  initialShowNumbers, initialShowZones, initialShowGroups,
  onClose,
}) {
  const { settings, setShowNumbers, setShowZones, setShowGroups, setShowColors } =
    usePrintSettings({ initialShowNumbers, initialShowZones, initialShowGroups });
  const [exportState, setExportState] = useState({ status: 'idle' }); // idle | working | done | error

  const previewScale = computePrintScale(CONTENT_WIDTH_PX, CONTENT_HEIGHT_PX) * 0.6; // ekstra nedskalering for modal-visning

  const contentProps = {
    boardObj, desks, deskNumberMap, placements, getStudentByIdOrName, groupColors, zoneMeta, settings,
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = async () => {
    setExportState({ status: 'working' });
    const suggestedName = buildPrintFilename({ className, chartName });
    try {
      const result = await window.api.exportPrintPdf({ suggestedName });
      if (result.canceled) { setExportState({ status: 'idle' }); return; }
      if (!result.success) { setExportState({ status: 'error', message: result.error }); return; }
      setExportState({ status: 'done', filePath: result.filePath });
    } catch (e) {
      setExportState({ status: 'error', message: e.message });
    }
  };

  return (
    <>
      <dialog id="modal_print_preview" className="modal modal-open" open onClose={onClose}>
        <div className="modal-box max-w-6xl">
          <h3 className="font-bold text-lg mb-4">Skriv ut / Eksporter klassekart</h3>
          <div className="flex gap-6">
            <div className="w-48 flex flex-col gap-3">
              <label className="label cursor-pointer justify-between">
                <span>Farger</span>
                <input type="checkbox" className="toggle" checked={settings.showColors} onChange={(e) => setShowColors(e.target.checked)} />
              </label>
              <label className="label cursor-pointer justify-between">
                <span>Numre</span>
                <input type="checkbox" className="toggle" checked={settings.showNumbers} onChange={(e) => setShowNumbers(e.target.checked)} />
              </label>
              <label className="label cursor-pointer justify-between">
                <span>Makkergrupper</span>
                <input type="checkbox" className="toggle" checked={settings.showGroups} onChange={(e) => setShowGroups(e.target.checked)} />
              </label>
              <label className="label cursor-pointer justify-between">
                <span>Soner</span>
                <input type="checkbox" className="toggle" checked={settings.showZones} onChange={(e) => setShowZones(e.target.checked)} />
              </label>
            </div>
            <div className="flex-1 overflow-auto bg-slate-800 rounded-lg p-4 flex items-center justify-center">
              <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                <PrintPage title={chartName} periodText={[className, chartComment].filter(Boolean).join(' · ')} contentWidthPx={CONTENT_WIDTH_PX} contentHeightPx={CONTENT_HEIGHT_PX}>
                  <SeatingChartPrintContent {...contentProps} />
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
        <PrintPage title={chartName} periodText={[className, chartComment].filter(Boolean).join(' · ')} contentWidthPx={CONTENT_WIDTH_PX} contentHeightPx={CONTENT_HEIGHT_PX}>
          <SeatingChartPrintContent {...contentProps} />
        </PrintPage>
      </div>
    </>
  );
}
