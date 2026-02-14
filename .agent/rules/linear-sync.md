# Linear Sync Agent - KlassePlass

## Formål

Denne agenten sørger for at oppdateringer på planer og roadmap i prosjektet automatisk synkroniseres til Linear. Når planer endres eller oppgaver fullføres, skal Linear oppdateres for å holde begge systemer i sync.

---

## Når skal Linear oppdateres?

### 1. Ved endringer i roadmap eller planer

- **Filer:** `.agent/roadmap.md`, `.agent/changelog.md`, plan-filer i `.cursor/plans/` eller lignende
- **Trigger:** Når disse filene redigeres, oppdateres eller lagres
- **Handling:** Bruk Linear MCP-verktøy for å opprette, oppdatere eller stenge issues

### 2. Ved statusendringer

- Når et backlog-element markeres som **✅ Fullført** i roadmap
- Når et element flyttes fra **🔴 Ikke startet** til **🟢 Godkjent** eller **🔵 I arbeid**
- Når nye oppgaver legges til i roadmap eller plan

### 3. Ved changelog-oppdateringer

- Når en ny changelog-post legges til som beskriver fullførte features
- Koble changelog-posten til tilsvarende Linear-issue og marker som Done

---

## Status-mapping

| Roadmap/Plan | Linear status |
|--------------|---------------|
| 🔴 Ikke startet | Backlog |
| 🟡 Under vurdering | Backlog (evt. med label) |
| 🟢 Godkjent | Todo eller Backlog |
| 🔵 I arbeid | In Progress |
| ✅ Fullført | Done |

---

## Prosedyre for synkronisering

### Ved ny oppgave i roadmap/plan

1. Søk i Linear etter eksisterende issue med tilsvarende tittel
2. Hvis ikke funnet: Opprett ny issue med `mcp_linear_create_issue`
   - **team:** Takoie (eller aktuelt team-ID)
   - **title:** Tittel fra roadmap/plan
   - **description:** Beskrivelse fra roadmap + teknisk info hvis relevant
   - **labels:** Evt. basert på prioritet (Høy/Medium/Lav)

### Ved statusendring til Fullført

1. Finn tilsvarende Linear-issue (søk på tittel eller beskrivelse)
2. Oppdater issue med `mcp_linear_update_issue`
   - **state:** Done
   - **description:** Legg til referanse til changelog-post hvis relevant

### Ved endring i plan-fil

1. Parse endringene (nye oppgaver, statusendringer, slettede oppgaver)
2. For hver endring: Utfør tilsvarende Linear-operasjon
3. Hvis brukeren ber om det: Gi kort oppsummering av hva som ble synkronisert

---

## Linear MCP-verktøy å bruke

- **mcp_linear_list_issues** – Søk etter eksisterende issues
- **mcp_linear_create_issue** – Opprett ny issue
- **mcp_linear_update_issue** – Oppdater status, beskrivelse, etc.
- **mcp_linear_get_issue** – Hent detaljer for én issue

---

## Prosjektkontekst

- **Prosjekt:** KlassePlass – verktøy for organisering av klassekart
- **Linear team:** Takoie
- **Plan-filer:** `.agent/roadmap.md`, `.agent/changelog.md`, planer i Cursor plans-mappe

---

## Eksempler på brukerhenvendelser som trigge sync

- "Oppdater Linear med de gjenværende oppgavene fra planen"
- "Marker [oppgave X] som fullført i Linear"
- "Opprett Linear-issues for alle manglende oppgaver i roadmap"
- "Sync roadmap-endringene til Linear"

---

**Sist oppdatert:** 2026-02-13
