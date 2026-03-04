# Roadmap - KlassePlass

## Formål
Dette dokumentet holder oversikt over fremtidige planer, funksjoner og forbedringer for KlassePlass.

---

## 🎯 Status-nøkkel

- 🔴 **Ikke startet** - Idé eller planlagt
- 🟡 **Under vurdering** - Gjennomgås for feasibility
- 🟢 **Godkjent** - Klar for implementering
- 🔵 **I arbeid** - Aktivt under utvikling
- ✅ **Fullført** - Implementert og testet

---

## 🚀 Prioritert Backlog

### Høy Prioritet (UX-forbedringer - Sprint 1)

#### 🟢 Elevnavn textarea (i stedet for kommaseparert)
**Status:** Godkjent  
**Beskrivelse:** Bytt input-felt til textarea hvor hver elev skrives på ny linje.  
**Teknisk:** Endre `<input>` til `<textarea>`, split på `\n` i stedet for `,`.  
**Estimat:** Liten (2t)  
**Sprint:** 1

#### 🟢 Rom-templates  
**Status:** Godkjent  
**Beskrivelse:** Forhåndsdefinerte rom-layouts (Standard 24, Stort 30, Lite 20, Gruppebord).  
**Teknisk:** Template-selector UI, predefinerte grid-layouts.  
**Estimat:** Liten (4t)  
**Sprint:** 1

#### 🟢 Validering: Elever vs. Pulter
**Status:** Godkjent  
**Beskrivelse:** Sjekk at antall elever matcher antall pulter, vis advarsel.  
**Teknisk:** Valider ved createChart(), showToast() hvis mismatch.  
**Estimat:** Liten (1t)  
**Sprint:** 1

#### 🟢 Labels, Tooltips og Placeholders
**Status:** Godkjent  
**Beskrivelse:** Alle knapper får tooltips, alle inputs får placeholders.  
**Teknisk:** Legg til `title` attributes, oppdater placeholders.  
**Estimat:** Liten (2t)  
**Sprint:** 1

---

### Medium Prioritet (UX-forbedringer - Sprint 2-3)

#### 🟢 Kombinert modal for auto-generer
**Status:** Godkjent  
**Beskrivelse:** Én modal med både rader og kolonner (i stedet for to separate).  
**Teknisk:** Ny `openDualInputModal()` funksjon.  
**Estimat:** Liten (3t)  
**Sprint:** 2

#### 🟢 Empty states med hints
**Status:** Godkjent  
**Beskrivelse:** Veiledning når dashboard/lister er tomme.  
**Teknisk:** Conditional rendering av help-text og CTA-knapper.  
**Estimat:** Liten (4t)  
**Sprint:** 2

#### 🟢 Bulk-operasjoner for elevplassering
**Status:** Godkjent  
**Beskrivelse:** "Fyll fra venstre til høyre", "Fjern alle" funksjoner.  
**Teknisk:** Nye funksjoner som itererer over desks/students.  
**Estimat:** Liten (4t)  
**Sprint:** 2

#### 🟢 CSV-import for elever
**Status:** Godkjent  
**Beskrivelse:** Importer elevlister fra CSV-fil eller clipboard.  
**Teknisk:** File picker + CSV parser, eller parse clipboard.  
**Estimat:** Medium (5t)  
**Sprint:** 3

#### ✅ Onboarding Wizard
**Status:** Fullført (2026-02-12)
**Beskrivelse:** Guide nye brukere gjennom første klassekart-oppsett.  
**Teknisk:** 3-stegs wizard med template-valg, localStorage-persistering.  
**Impact:** Reduserer tid til første klassekart fra 10 min til 3 min.3

#### 🟢 Keyboard Shortcuts
**Status:** Godkjent  
**Beskrivelse:** Hurtigtaster for vanlige operasjoner.  
**Teknisk:** Global keydown listener med mapping.  
**Estimat:** Liten (4t)  
**Sprint:** 3

**Shortcuts:**
- `Ctrl+N` - Nytt klassekart
- `Ctrl+S` - Lagre
- `Del` - Slett valgt
- `Ctrl+Z` - Undo
- `Esc` - Lukk modal

---

### Medium Prioritet (Fortsatt planlagt)

#### ✅ Elevnotater som pop-out
**Status:** Fullført (2026-02-12)
**Beskrivelse:** Større notat-felt (textarea 10 linjer) for utfyllende elevnotater.  
**Teknisk:** Dedikert modal (500px bred) med textarea-lagring.

#### 🔴 Søkefunksjon
**Status:** Ikke startet  
**Beskrivelse:** Søk etter elever, klasser, eller rom.  
**Teknisk:** Filter-funksjon i renderer.  
**Estimat:** Liten

---

### Lav Prioritet

#### 🔴 PDF-eksport av klassekart
**Status:** Ikke startet  
**Beskrivelse:** Mulighet til å eksportere klassekart som PDF for utskrift eller deling.  
**Teknisk:** Integrer jsPDF eller lignende bibliotek.  
**Estimat:** Medium

#### ✅ Backup/Restore/Move Database (TAK-21)
**Status:** Fullført  
**Beskrivelse:** Manuell backup, gjenoppretting og flytting av database med sikkerhet.  
**Implementert:**
- Backup til valgt lokasjon med dato i filnavn
- Gjenopprett med validering og rollback
- Flytt database til ny plassering (ekstern disk, sky-mappe)
- Persistent lagring av custom database-plassering
- Settings modal med tabs og glassmorphism design  
**Teknisk:** Electron dialog, fs.copyFileSync, config-fil for custom path  
**Fullført:** 2026-02-13

#### 🟡 Database Schema-versjonering (TAK-33)
**Status:** Under vurdering  
**Beskrivelse:** Håndtere schema-endringer over tid med versjonering og migrering.  
**Teknisk:** 
- `schema_version` tabell
- Versjonsnummer i backup-filnavn
- Validering ved restore
- Automatisk migrering av gamle backups  
**Estimat:** Medium (6t)  
**Prioritet:** Medium  
**Relatert til:** TAK-21

#### 🔴 Drag-to-reorder i elevlister
**Status:** Ikke startet  
**Beskrivelse:** Dra elever for å endre rekkefølgen i klasselisten.  
**Teknisk:** Implementer sortable.js eller custom drag-drop.  
**Estimat:** Medium

#### 🔴 Statistikk-dashboard
**Status:** Ikke startet  
**Beskrivelse:** Statistikk over elever, rom, klassekart.  
**Teknisk:** Aggregering av data fra SQLite.  
**Estimat:** Stor

#### ✅ Temaer — mørk/lys modus + fargeprøver
**Status:** Fullført (2026-03-04)
**Beskrivelse:** Bytte mellom mørk og lys modus, pluss valg av fargetema (DaisyUI-temaer) per modus.
**Implementert:**
- 6 mørke temaer: Natt, Dracula, Kaffe, Halloween, Svart, Dim
- 3 lyse temaer: Nord, Vinter, Bedrift
- Fargeprøver (swatches) i innstillinger — Utseende-fanen
- Valget persisteres i `settings.json` som `colorTheme`-felt
**Teknisk:** DaisyUI `data-theme` på `<html>`, `applyTheme(settings)` i `renderer.js`

#### 🔴 Multi-språk support
**Status:** Ikke startet  
**Beskrivelse:** Støtte for engelsk og andre språk.  
**Teknisk:** i18n-bibliotek eller custom løsning.  
**Estimat:** Stor

---

## 💡 Idéer til Vurdering

### 🟡 Cloud Sync
**Beskrivelse:** Synkroniser database til cloud for tilgang på flere enheter.  
**Utfordringer:** Krever backend-server, autentisering, synkroniseringslogikk.  
**Estimat:** X-Large

### 🟡 Samarbeidsredigering
**Beskrivelse:** Flere lærere kan redigere samme klassekart samtidig.  
**Utfordringer:** WebSocket, conflict resolution, samme som cloud sync.  
**Estimat:** X-Large

### 🟡 Mobile App
**Beskrivelse:** iOS/Android versjon av KlassePlass.  
**Utfordringer:** Helt ny kodebase (React Native / Flutter).  
**Estimat:** XX-Large

### 🟡 QR-kode generator
**Beskrivelse:** Generer QR-kode for klassekart som elever kan scanne.  
**Utfordringer:** Hva skal QR-koden gjøre? Vise plasseringen?  
**Estimat:** Medium

### 🟡 Fraværsregistrering
**Beskrivelse:** Marker elever som fraværende direkte i klassekartet.  
**Utfordringer:** Krever tracking av dato, lagring av fraværsdata.  
**Estimat:** Large

---

## 🐛 Kjente Bugs & Forbedringer

### Bugs
- Ingen kjente kritiske bugs for øyeblikket

### Forbedringer
- **Performance:** Optimalisere rendering ved store klasserom (50+ pulter)
- **UX:** Bedre visuell feedback ved drag-operasjoner
- **Accessibility:** Keyboard navigation, screen reader support
- **Validation:** Bedre input-validering (tomme navn, duplikater)

---

## 🔄 Kontinuerlige Oppgaver

### Vedlikehold
- [ ] Oppdatere Electron til siste versjon jevnlig
- [ ] Oppdatere dependencies (npm audit)
- [ ] Sikkerhetstesting
- [ ] Performance monitoring

### Dokumentasjon
- [ ] Brukermanual / User Guide
- [ ] Video-tutorials
- [ ] FAQ-seksjon

---

## ✅ Fullførte Funksjoner

### Versjon 1.0.0
- ✅ Klasseadministrasjon (CRUD)
- ✅ Romdesigner med drag-and-drop
- ✅ Klassekart-system
- ✅ Randomisering
- ✅ Grupperings-funksjonalitet
- ✅ Versionshistorikk
- ✅ Presentasjonsmodus
- ✅ Flip-view
- ✅ SQLite database
- ✅ Custom window controls
- ✅ Glassmorphism design

### Nylige Oppdateringer
- ✅ Om-seksjon forbedringer (feb 2026)
- ✅ Elevvisning forbedringer (feb 2026)
- ✅ Eksport og filtrering (feb 2026)

---

## 📋 Slik Bruker du Roadmap

### Legge til ny idé
1. Bestem prioritet (Høy/Medium/Lav/Idé)
2. Legg til under riktig seksjon
3. Inkluder status-emoji
4. Beskriv funksjonalitet
5. Vurder teknisk kompleksitet
6. Estimer størrelse

### Oppdatere status
- Endre emoji når status endres
- Flytt mellom seksjoner ved behov
- Dokumenter beslutninger i beskrivelsen
- Når fullført, flytt til "Fullførte Funksjoner"

### Estimat-størrelser
- **Liten:** < 4 timer
- **Medium:** 4-8 timer
- **Stor:** 1-3 dager
- **X-Large:** 1-2 uker
- **XX-Large:** > 2 uker

---

**Sist oppdatert:** 2026-03-04 (Fargetemaer fullført, innstillinger redesignet med faner)
