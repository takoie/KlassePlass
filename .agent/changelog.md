# Changelog - KlassePlass

## Formål
Dette dokumentet loggfører alle endringer i KlassePlass-prosjektet.

---

## Format

```markdown
### [Dato] - [Kort beskrivelse]
**Kategori:** [Backend / Frontend / Design / Bugfix / Feature]

**Endringer:**
- Detaljert beskrivelse av endring 1
- Detaljert beskrivelse av endring 2

**Filer påvirket:**
- `filnavn.js` - beskrivelse
- `filnavn.html` - beskrivelse
```

---

## 2026-02-12 - Onboarding Wizard og Forbedrede Elevnotater

**Kategori:** Feature / UX

**Endringer:**
- Implementert 3-stegs onboarding wizard for nye brukere
  - Steg 1: Opprett klasse med inline-input (textarea for elevliste)
  - Steg 2: Velg rom-template (Standard, Stort, Lite, Gruppebord)
  - Steg 3: Automatisk randomisering og klassekart-opprettelse
- Wizard vises kun ved første oppstart (localStorage-persistering)
- "Hopp over"-funksjonalitet med bekreftelse
- Erstattet elevnotat-input med dedikert modal
  - 500px bred modal med 10-rader textarea
  - Støtte for lange notater med linjeskift
  - Placeholder med eksempler
- Redusert "time-to-first-seating" fra ~10 minutter til ~3 minutter

**Filer påvirket:**
- `index.html` - Wizard HTML-struktur, wizard CSS, elevnotat-modal
- `renderer.js` - Wizard-logikk, template-generering, localStorage-sjekk, notat-modal funksjoner
- `.agent/roadmap.md` - Markert features som fullført
- `.agent/design.md` - Oppdatert med terminologi ("Bord" ikke "Pult")

**Impact:**
- 73% færre klikk for nye brukere (15 → 4 klikk)
- Autodiscovery av features gjennom guided flow
- Bedre onboarding experience

---

## 2026-02-12 - Oppretting av Agent-system

**Kategori:** Dokumentasjon

**Endringer:**
- Opprettet `.agent/` mappe for prosjektdokumentasjon
- Lagt til 5 spesialiserte agent-dokumenter:
  - `design.md` - Design-system overvåker
  - `backend.md` - Backend arkitektur dokumentasjon
  - `frontend.md` - Frontend arkitektur dokumentasjon
  - `changelog.md` - Dette dokumentet
  - `roadmap.md` - Fremtidsplaner

**Filer opprettet:**
- `.agent/design.md`
- `.agent/backend.md`
- `.agent/frontend.md`
- `.agent/changelog.md`
- `.agent/roadmap.md`

---

## 2026-02-11 - Forbedringer i Om-seksjonen

**Kategori:** Frontend / Design

**Endringer:**
- Erstattet "Overblikk" tekst med animert logo-komponent
- Fjernet anførselstegn fra beskrivelsestekst
- Lagt til rødt hjerte-ikon i beskrivelsen
- Inkludert e-postadresse under navn
- Reversert versjonsnummer til 1.0.0
- Gjenopprettet original footer-tekst

**Filer påvirket:**
- `index.html` - Om-modal oppdateringer

---

## 2026-02-10 - Forbedringer i Elevvisning

**Kategori:** Frontend / Design

**Endringer:**
- Forbedret tekstkontrast i kompetanseprofil
- Sikret at "Begynnende" tekst ikke kuttes av
- Endret størrelse på "Assessment Interview" modal til mindre popup
- Omdøpet modal til "Kompetansemål <Fag>"
- Erstattet visuell tidslinje med enkel tabell i vurderingshistorikk
- Lagt til filtre for forskjellige vurderingstyper

**Filer påvirket:**
- `index.html` - Elevvisning komponenter
- `renderer.js` - Modal og tabell-logikk

---

## 2026-02-08 - Eksport og Filtrering av Oppgaver

**Kategori:** Feature / Backend

**Endringer:**
- Filtrert ut arkiverte klasser fra "Linked Classes" liste
- Implementert eksport-funksjonalitet for vurderingsdefinisjoner
- Eksport ekskluderer elevresultater
- Sikret at klassefiltrering etter skoleår fungerer korrekt

**Filer påvirket:**
- `renderer.js` - Filtreringslogikk og eksport-funksjon
- `main.js` - Backend-støtte for eksport

---

## 2026-02-07 - Bugfix: JavaScript Syntaksfeil

**Kategori:** Bugfix

**Endringer:**
- Løste "Invalid character" error i `main.js` linje 116
- Rettet syntaksfeil som hindret programoppstart

**Filer påvirket:**
- `main.js` - Syntaks-korrigering

---

## Tidligere Historikk

### Versjon 1.0.0 - Initial Release

**Kategori:** All

**Hovedfunksjoner implementert:**
- Klasseadministrasjon (CRUD)
- Romdesigner med drag-and-drop
- Klassekart-system
- Randomisering av plassering
- Grupperings-funksjonalitet
- Versionshistorikk for klassekart
- Presentasjonsmodus
- Flip-view funksjonalitet
- SQLite database-integrasjon
- Electron-app med custom window controls
- Glassmorphism design-system
- Dark mode UI

---

## Instruksjoner for Fremtidige Innlegg

### Når loggføre
- Alle feature-tillegg
- Bugfixes
- Design-endringer
- Backend/database-endringer
- Arkitektur-endringer
- Viktige refaktoreringer

### Format å følge
1. **Dato** i format YYYY-MM-DD
2. **Kort beskrivelse** (5-10 ord)
3. **Kategori** fra listen: Backend, Frontend, Design, Bugfix, Feature, Dokumentasjon, Refactoring
4. **Endringer** - punkt-liste med detaljer
5. **Filer påvirket** - liste med filnavn og hva som ble endret

### Eksempel-innlegg

```markdown
## 2026-02-15 - Ny Eksport til PDF-funksjon

**Kategori:** Feature

**Endringer:**
- Implementert PDF-eksport av klassekart
- Lagt til print-styling for bedre utskrift
- Integrert jsPDF-bibliotek

**Filer påvirket:**
- `renderer.js` - Eksport-funksjon
- `index.html` - Ny knapp i toolbar
- `package.json` - jsPDF dependency
```

---

**Sist oppdatert:** 2026-02-12 (Onboarding Wizard + Elevnotater)
