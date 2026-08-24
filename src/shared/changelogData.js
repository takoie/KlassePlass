/**
 * changelogData.js — Innebygd endringslogg for KlassePlass.
 * Vises i oppdateringsmodulen slik at lærere og brukere enkelt kan se hva som er nytt.
 */

export const CHANGELOG = [
  {
    version: '2.7.5',
    date: '24. august 2026',
    isLatest: true,
    highlights: [
      {
        type: 'feature',
        title: 'Roter og tilfeldig gruppeleder',
        desc: 'Nye knapper i gruppearbeid setter neste elev i rekkefølgen — eller en helt tilfeldig elev — som leder i alle grupper samtidig med ett trykk.'
      },
      {
        type: 'improvement',
        title: 'Autolagring med bekreftelse',
        desc: 'Gruppearbeid lagres nå automatisk et lite øyeblikk etter siste endring, med en toast som bekrefter lagringen i stedet for en fast "Ulagrede endringer"-tekst.'
      },
      {
        type: 'ui',
        title: 'Ryddigere verktøylinje i gruppeeditor',
        desc: 'Skriv ut/PDF, Lagre og slett er samlet på navnelinjen, mens de øvrige verktøyene ligger på egen rad under. Gruppenavnet redigeres nå via et penn-ikon i stedet for å alltid være et åpent tekstfelt, og navn/klasse er sentrert i toppmenyen.'
      },
      {
        type: 'fix',
        title: 'Uleselig hover-tekst i gruppeeditor',
        desc: 'Rettet mørk tekst på mørk bakgrunn ved musepeker over enkelte knapper i gruppearbeid-verktøylinjen.'
      }
    ]
  },
  {
    version: '2.7.1',
    date: '21. august 2026',
    highlights: [
      {
        type: 'fix',
        title: 'Manglende vindus- og fullskjerm-rettigheter',
        desc: 'La til manglende Tauri-tillatelser som gjorde at maksimer-knapp, vindusdrag og prosjektorvisningens fullskjerm feilet stille.'
      },
      {
        type: 'improvement',
        title: 'Tryggere auto-oppdatering',
        desc: 'Oppdateringer lastes nå kun ned i bakgrunnen, og installeres/restartes først etter eksplisitt brukervalg – ikke automatisk ved oppstart.'
      },
      {
        type: 'feature',
        title: 'Fjern elever-lassomodus',
        desc: 'Ny lassomodus i klassekartet for å fjerne flere elever samtidig, med feilrettet elevliste som tidligere kunne bli tom til "Plasser alle" ble trykket to ganger.'
      },
      {
        type: 'stability',
        title: 'Stabilitetsrettinger',
        desc: 'Unngår kappløp i fullskjerm-veksling (med Escape-fallback), og klarere makkergruppefarger for grupper med mange medlemmer.'
      }
    ]
  },
  {
    version: '2.7.0',
    date: '19. august 2026',
    highlights: [
      {
        type: 'feature',
        title: 'Forbedret utskrift og PDF-eksport',
        desc: 'Profesjonell utskrift og PDF-eksport for klassekart, gruppearbeid og stasjoner, med bedre forhåndsvisning og filnavngiving.'
      },
      {
        type: 'improvement',
        title: 'Oppgradert stasjonsoppsett',
        desc: 'Mer robust og fleksibel konfigurering av stasjonsundervisning.'
      },
      {
        type: 'ui',
        title: 'Forbedret fullskjermvisning',
        desc: 'Jevnere overganger og mer pålitelig fullskjerm for prosjektorvisning.'
      }
    ]
  },
  {
    version: '2.6.1',
    date: '18. august 2026',
    highlights: [
      {
        type: 'stability',
        title: 'Automatisk databasemigrering',
        desc: 'Eldre databaser oppgraderes nå automatisk til nyeste skjema ved oppstart, uten manuell inngripen.'
      },
      {
        type: 'fix',
        title: 'Fullskjerm-fiks',
        desc: 'Rettet feil i fullskjermvisning for klassekart.'
      }
    ]
  },
  {
    version: '2.6.0',
    date: '17. august 2026',
    highlights: [
      {
        type: 'ui',
        title: 'Nytt og raffinert verktøypanel for klassekart',
        desc: 'Logisk inndeling i plassering, visningslag, rom og moduser. Nøytral mørk stil med fargede ikoner for et renere uttrykk.'
      },
      {
        type: 'feature',
        title: 'Ekte av/på-brytere for visningslag',
        desc: 'Tydelige brytere som viser nøyaktig hva som er aktivt, med faste etiketter og forbedrede info-tooltips.'
      },
      {
        type: 'ui',
        title: 'Slank scrollbar & versjonsvisning',
        desc: 'Minimalistisk 4px rullefelt og sentrert versjonsnummer i bunnen av sidemenyen.'
      }
    ]
  },
  {
    version: '2.5.1',
    date: '17. august 2026',
    highlights: [
      {
        type: 'feature',
        title: 'Ny oppdateringsmodul & endringslogg',
        desc: 'Manuell sjekk etter oppdateringer direkte fra venstremenyen med full oversikt over nyheter og endringer.'
      },
      {
        type: 'ui',
        title: 'Oppdateringsindikator i sidemenyen',
        desc: 'Knappen for Oppdatering lyser nå grønt med glød og varselmerke når en oppdatering er klar til installasjon.'
      },
      {
        type: 'ui',
        title: 'Pikselperfekt layout i venstremenyen',
        desc: 'Fast ikonbredde og jevn vertikal linjeføring på tvers av alle navigasjonsknapper.'
      }
    ]
  },
  {
    version: '2.5.0',
    date: '17. august 2026',
    highlights: [
      {
        type: 'feature',
        title: 'Ny oppdateringsmodul & endringslogg',
        desc: 'Manuell sjekk etter oppdateringer direkte fra venstremenyen med full oversikt over nyheter og endringer.'
      },
      {
        type: 'stability',
        title: 'Flush-on-Unmount for autolagring',
        desc: 'Sikrer at endringer i klasser, rom og klassekart aldri går tapt ved rask navigering mellom moduler.'
      },
      {
        type: 'fix',
        title: 'Feilretting: Låste bord og dupliserte elever',
        desc: 'Forhindrer at elever som sitter på låste plasser blir duplisert til andre bord under tilfeldig trekning eller Fun Modes.'
      },
      {
        type: 'fix',
        title: 'Automatisk opprydding av slettede elever',
        desc: 'Når en elev slettes fra en klasse, renses nå alle tilhørende plasseringer og historikk automatisk opp.'
      },
      {
        type: 'ui',
        title: 'Forbedret høyreklikkmeny i klassekart',
        desc: '«Fjern fra bord» er flyttet under «Lås bord», større og tydeligere skriftstørrelse på «Sist sammen med»-historikken, og Vis historikk er nå slått på som standard.'
      },
      {
        type: 'stability',
        title: 'Forbedret romsynkronisering og stasjonsoppsett',
        desc: 'Kapasitetsbevisst oppdatering av romplan og automatisk tømming av utdaterte grupper ved klassebytte i stasjoner.'
      }
    ]
  },
  {
    version: '2.4.1',
    date: '16. august 2026',
    highlights: [
      {
        type: 'feature',
        title: 'Automatisk bakgrunnsoppdatering',
        desc: 'Stille nedlasting av nye versjoner ved oppstart med popup for sømløs omstart og installasjon.'
      },
      {
        type: 'improvement',
        title: 'Brukervennlig installatør',
        desc: 'Installasjon kjører nå i brukerkonto-modus uten krav til administratorpassord.'
      }
    ]
  },
  {
    version: '2.4.0',
    date: '15. august 2026',
    highlights: [
      {
        type: 'feature',
        title: 'Tauri v2 arkitektur',
        desc: 'Overgang til Tauri v2 for lynrask oppstart, lavt minneforbruk og robust SQLite-database.'
      },
      {
        type: 'improvement',
        title: 'Forbedret ytelse og stabilitet',
        desc: 'Raskere innlasting av store klasser og romoppsett.'
      }
    ]
  },
  {
    version: '2.3.0',
    date: '10. august 2026',
    highlights: [
      {
        type: 'feature',
        title: 'Moro-moduser (Fun Modes)',
        desc: 'Roulette, Randombomb, Musikkstoler, Makkerbytte og Spotlight for engasjerende elevplassering.'
      },
      {
        type: 'feature',
        title: 'Utskrift & PDF-eksport',
        desc: 'Profesjonell utskrift og forhåndsvisning for klassekart og stasjonsundervisning.'
      }
    ]
  }
];
