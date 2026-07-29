import React, { useState, useEffect, useRef } from 'react';

const STEPS = [
  {
    icon: 'fa-solid fa-hand-sparkles',
    title: 'Velkommen til KlassePlass',
    text: 'KlassePlass hjelper deg å planlegge klasserommet, klassekart, gruppearbeid og stasjonsundervisning - alt lagret lokalt på din egen maskin. Denne guiden viser deg kjapt hva hver modul gjør.',
  },
  {
    icon: 'fa-solid fa-users',
    title: 'Klasser',
    text: 'Registrer klassene og elevene dine, og definer regler for hvem som bør eller ikke bør sitte sammen. Reglene brukes automatisk senere når du genererer klassekart og grupper.',
  },
  {
    icon: 'fa-solid fa-school',
    title: 'Rom',
    text: 'Tegn opp klasserommet fritt med bord, tavle, dører og vinduer - dra og slipp i en egen romeditor. Du kan lage flere rom og gjenbruke dem til ulike klassekart.',
  },
  {
    icon: 'fa-solid fa-map-location-dot',
    title: 'Klassekart',
    text: 'Plasser elevene i rommet, la KlassePlass generere forslag automatisk ut fra reglene dine, og hold styr på flere perioder over tid.',
  },
  {
    icon: 'fa-solid fa-people-group',
    title: 'Gruppearbeid',
    text: 'Sett sammen makkergrupper automatisk ut fra reglene dine, med historikk som unngår at de samme elevene alltid havner sammen.',
  },
  {
    icon: 'fa-solid fa-arrows-rotate',
    title: 'Stasjoner',
    text: 'Planlegg og kjør stasjonsundervisning med rotasjon mellom grupper - klart for visning på prosjektor når timen starter.',
  },
  {
    icon: 'fa-solid fa-gear',
    title: 'Innstillinger & utskrift',
    text: 'Under Innstillinger finner du fargetema, sikkerhetskopi/gjenoppretting og flytting av databasen. Klassekart og stasjonsplaner kan skrives ut eller eksporteres som PDF direkte fra sin egen modul.',
  },
  {
    icon: 'fa-solid fa-circle-check',
    title: 'Klar til å starte',
    text: 'Det var alt! Du finner denne guiden igjen når som helst via "Veiledning" i venstremenyen.',
  },
];

export default function OnboardingGuide({ onClose }) {
  const [step, setStep] = useState(0);
  const dialogRef = useRef(null);

  // Samme mønster som Print/PrintPreviewModal.jsx: hold siste onClose i en ref
  // slik at åpne/lukk-effekten under ikke må kjøre på nytt hver gang App.jsx
  // sender en ny inline-funksjon inn.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleNativeClose = () => onCloseRef.current?.();
    dialog.addEventListener('close', handleNativeClose);
    if (!dialog.open) dialog.showModal();
    return () => {
      dialog.removeEventListener('close', handleNativeClose);
    };
  }, []);

  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const handleNext = () => {
    if (isLast) { dialogRef.current?.close(); return; }
    setStep((s) => s + 1);
  };
  const handlePrev = () => setStep((s) => Math.max(0, s - 1));

  return (
    <dialog ref={dialogRef} className="modal modal-bottom sm:modal-middle">
      <div className="modal-box bg-surface-raised border border-slate-700 text-slate-100 rounded-2xl max-w-lg">
        <div className="flex items-start gap-4 mb-2">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-400/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <i className={`${current.icon} text-lg`}></i>
          </div>
          <div className="pt-1">
            <h3 className="font-bold text-lg text-white">{current.title}</h3>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed min-h-[4.5rem]">{current.text}</p>

        <div className="flex items-center justify-center gap-1.5 my-5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`Gå til steg ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === step ? 'w-5 bg-emerald-400' : 'w-2 bg-slate-600 hover:bg-slate-500'}`}
            ></button>
          ))}
        </div>

        <div className="modal-action items-center justify-between mt-0">
          <form method="dialog">
            <button className="btn btn-ghost btn-sm text-slate-400 hover:bg-slate-800">Hopp over</button>
          </form>
          <div className="flex gap-2">
            {!isFirst && (
              <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 hover:bg-slate-800 gap-2" onClick={handlePrev}>
                <i className="fa-solid fa-arrow-left"></i> Forrige
              </button>
            )}
            <button className="btn btn-sm bg-emerald-500/20 text-emerald-400 border-none hover:bg-emerald-500/30 gap-2" onClick={handleNext}>
              {isLast ? 'Kom i gang' : 'Neste'} {!isLast && <i className="fa-solid fa-arrow-right"></i>}
            </button>
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}
