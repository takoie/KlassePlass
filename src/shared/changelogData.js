/**
 * changelogData.js — Innebygd endringslogg for KlassePlass.
 * Vises i oppdateringsmodulen slik at lærere og brukere enkelt kan se hva som er nytt.
 */

export const CHANGELOG = [
  {
    version: '2.5.0',
    date: '17. august 2026',
    isLatest: true,
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
