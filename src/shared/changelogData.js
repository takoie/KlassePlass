/**
 * changelogData.js — Innebygd endringslogg for KlassePlass.
 * Vises i oppdateringsmodulen slik at lærere og brukere enkelt kan se hva som er nytt.
 */

export const CHANGELOG = [
  {
    version: '2.9.5',
    date: '9. september 2026',
    isLatest: true,
    highlights: [
      {
        type: 'feature',
        title: 'Ett kort per klassekart – periodene samles under',
        desc: 'I «Mine klassekart» får hvert klassekart nå ett kort, ikke ett kort per periode. Kortet viser antall perioder og den nyeste perioden, og et klikk åpner den siste perioden – periodene byttes videre fra nedtrekket inne i visningen. Sletteknappen på kortet fjerner hele klassekartet (alle periodene); enkeltperioder slettes fortsatt inne i editoren.'
      },
      {
        type: 'ui',
        title: 'Nytt, ryddigere kortdesign i alle oversikter',
        desc: 'Kortene i Klasser, Rom, Klassekart, Gruppearbeid og Stasjoner har fått felles, strammere design med egen fargeidentitet per modul. Info-linjene har fått full bredde, så ukenummer og annen tekst ikke lenger brekker over flere linjer. Handlingsknappene ligger samlet på én rad, og hele kortet kan nå fokuseres og åpnes med tastatur.'
      },
      {
        type: 'ui',
        title: 'Tydeligere ikoner i meny og sidetitler',
        desc: 'Klassekart har fått nytt ikon i sidemenyen, og det aktive menyikonet følger nå temafargen i stedet for å være fast grønt. Ikonet i hver sidetittel bruker modulens egen farge.'
      }
    ]
  },
  {
    version: '2.9.1',
    date: '1. september 2026',
    highlights: [
      {
        type: 'feature',
        title: 'Bytt klassekart direkte fra topplinja',
        desc: 'Nedtrekket øverst i klassekart-visningen bytter nå mellom hele klassekart – ikke bare klasser. Velg et annet kart, så lastes klasse, rom, bordoppsett og elevliste automatisk, uten å gå ut i oversikten. En ventende autolagring skylles først, så du ikke mister en endring gjort rett før byttet.'
      },
      {
        type: 'ui',
        title: 'Topplinja bryter ikke lenger over flere linjer',
        desc: 'Topplinjene i klassekart og rombygger holdes alltid på én rad. Nedtrekkene er litt smalere, «Skriv ut / PDF» er kortet til «PDF», og ved ekstremt smal vindusbredde scrolles linja vannrett i stedet for å hoppe ned i to rader.'
      }
    ]
  },
  {
    version: '2.9.0',
    date: '31. august 2026',
    highlights: [
      {
        type: 'feature',
        title: 'Skjul ubrukte plasser og bord i klassekartet',
        desc: 'Høyreklikk en ledig plass og velg «Skjul denne plassen» for å trekke bordet sammen rundt elevene som faktisk sitter der – på skjerm, i utskrift og PDF. Makkergruppe-fargen og kanten beholdes, og et lite øye-ikon henter plassene fram igjen. Ny «Skjul tomme bord»-bryter i utskrift/PDF-vinduet utelater bord uten elever fra papiret.'
      },
      {
        type: 'feature',
        title: 'Hold fraværende elever utenfor gruppefordelingen',
        desc: 'Ny «Ikke med i fordelingen»-sone i gruppearbeidmodulen. Dra en elev dit – eller høyreklikk og velg «Sett som fraværende» – så holdes vedkommende utenfor når du genererer på nytt eller jevner ut grupper. «Ta med alle» henter dem inn igjen. Sonen kan felles sammen som en skuff så navnene ikke vises (f.eks. på prosjektor), og valget huskes per gruppeinndeling. Autolagringen viser nå én diskré «Lagret»-toast i stedet for en stabel med bokser, og de to reglene i «Ny gruppeinndeling» starter avslått.'
      },
      {
        type: 'feature',
        title: 'Dra elever av kartet for å fjerne dem',
        desc: 'Dra en plassert elev vekk fra setet og slipp hvor som helst som ikke er et sete – på gulvet, over menyene – så tas eleven av kartet og legges i elevlista. Navneboksen blir rød med «Fjern» mens du drar, så du ser hva som skjer. Du kan fortsatt dra rett til elevlista, eller høyreklikke en elev og velge «Fjern fra bord».'
      },
      {
        type: 'fix',
        title: '«Plasser alle» flyttet elever som allerede satt',
        desc: '«Plasser alle» byttet tidligere om på elevene i lista og de som allerede var plassert. Nå fyller den kun ledige plasser og lar elever som sitter være i fred – «Randomiser» stokker fortsatt om på alle.'
      },
      {
        type: 'fix',
        title: 'Uleselig tekst på knapper ved musepeker',
        desc: 'Rettet mørk tekst på mørk bakgrunn ved musepeker over «Skriv ut / PDF» og en rekke andre knapper i hele programmet.'
      },
      {
        type: 'ui',
        title: 'Nye, tema-tilpassede nedtrekksmenyer',
        desc: 'Alle nedtrekksmenyer (klasse-, rom- og periodevalg m.fl.) har fått en egen mørk meny som matcher resten av appen, i stedet for operativsystemets lyse standardliste. De virker nå også inne i popup-vinduer (bl.a. «Ny gruppeinndeling»), der lista tidligere ikke lot seg åpne.'
      },
      {
        type: 'ui',
        title: 'Ensartet design i klassekart, rombygger og utskrift',
        desc: 'Sidemenyene og topplinjene i klassekart og rombygger, samt venstremenyen i utskrift/PDF-vinduet, bruker nå samme flate og kompakte knappe- og bryterstil. Hjelpetekstene (info-boblene) er stilt likt og klippes ikke lenger av vinduskanten. Rombyggerens topplinje er forenklet: når du er inne i et rom vises romnavnet som tittel (endres med penn-ikonet), uten rom-nedtrekk eller «nytt/dupliser rom»-knapper.'
      },
      {
        type: 'improvement',
        title: 'Bordnummer huskes og er av som standard',
        desc: 'Bryteren for bordnummer i klassekartet starter nå avslått og husker valget ditt mellom økter. Bordnumrene vises igjen som de skal i utskrifts­forhåndsvisningen.'
      },
      {
        type: 'feature',
        title: 'Dupliser rom',
        desc: 'Lag et nytt rom fra en kopi av et eksisterende bord- og tavleoppsett rett fra kortet i «Mine rom» – du får en dialog for å skrive inn navnet på det nye rommet. Originalrommet og klassekartene som bruker det påvirkes ikke.'
      },
      {
        type: 'fix',
        title: 'Flere klassekart på samme klasse og rom blandet seg sammen',
        desc: 'To klassekart laget av samme klasse og rom (f.eks. ett vanlig og ett til klassefest) delte tidligere periode-nedtrekk og elevhistorikk, så plasseringer og uker fra det ene lekket inn i det andre. Nå holdes hvert klassekart helt for seg selv, med egne perioder og egen historikk. Eksisterende kart beholdes – kart som ikke lot seg skille automatisk kan løsrives med «Skill ut som eget klassekart» i rediger-vinduet.'
      },
      {
        type: 'improvement',
        title: 'Mange små finjusteringer',
        desc: 'En rekke mindre justeringer og opprydninger i grensesnittet – blant annet lik størrelse på nedtrekksmenyer og knapper i topplinjene (med litt mindre tekst enn før), at verktøypanelet i rombyggeren alltid kan scrolles selv når mange seksjoner er åpne samtidig, og at navneboksen når du drar en elev nå henger ned til høyre for musepekeren (med en liten ring på selve slippunktet) i stedet for å dekke det.'
      }
    ]
  },
  {
    version: '2.8.1',
    date: '27. august 2026',
    highlights: [
      {
        type: 'feature',
        title: '"Hva er nytt"-popup etter oppdatering',
        desc: 'Rett etter en fullført oppdatering vises nå en egen popup med kun nyeste versjons endringer (merket Nyhet/Feilretting/Forbedring/Stabilitet), til forskjell fra den fulle historikken i "Oppdatering og endringslogg".'
      },
      {
        type: 'ui',
        title: 'Ryddigere "hva er nytt"-visning',
        desc: 'Merkelappene (Nyhet, Feilretting osv.) vises nå sentrert over hver endring i stedet for ved siden av teksten, og "Nyhet" sorteres alltid øverst.'
      }
    ]
  },
  {
    version: '2.8.0',
    date: '27. august 2026',
    highlights: [
      {
        type: 'fix',
        title: 'Snu klasserommet plasserte elever speilvendt',
        desc: 'Snuing av klasserom (bord og elever) ga tidligere feil rekkefølge innad i par-/gruppebord og feil plassnummer. Rettet i både rombygger og klassekart-visning.'
      },
      {
        type: 'feature',
        title: 'Skjul tomme bord og merk seter som ubrukt',
        desc: 'Ny "Skjul tomme bord"-visning i klassekartet skjuler bord uten elever automatisk (og unngås av Randomiser/Plasser alle/Fun Modes). Enkeltseter kan nå høyreklikkes og merkes "ubrukt" for å lage bevisste tomrom mellom rader uten at randomisering fyller dem igjen.'
      },
      {
        type: 'feature',
        title: 'Snu klasserommet i prosjektormodus',
        desc: 'Ny knapp i prosjektorvisningens verktøylinje for å snu klasserommet uten å måtte gå ut av fullskjerm.'
      },
      {
        type: 'improvement',
        title: 'Tryggere og tydeligere sletting av klassekart',
        desc: 'Slett-knappen viser nå "Slett periode" eller "Slett kart" avhengig av om klassen har flere perioder, spør alltid om bekreftelse først, og sender deg tilbake til klassekart-oversikten i stedet for et tomt utkast når siste periode for en klasse slettes.'
      },
      {
        type: 'ui',
        title: 'Ryddigere visningsmeny i klassekartet',
        desc: '"Fargelagte bord" og "Plassnumre" heter nå "Bordfarger" og "Bordnummer". Makkergrupper, Bordfarger og Historikk er slått på som standard.'
      }
    ]
  },
  {
    version: '2.7.5',
    date: '24. august 2026',
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
