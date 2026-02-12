# Design Agent - KlassePlass

## Formål
Denne agenten overvåker og dokumenterer design-systemet for KlassePlass-applikasjonen.

---

## Design-system

### 🎨 Fargepalett

#### Primærfarger
```css
--bg-app: #0f111a           /* Hovedbakgrunn */
--glass-bg: rgba(30, 35, 50, 0.6)  /* Glassmorphism bakgrunn */
--accent: #3b82f6           /* Primær accent (blå) */
--accent-hover: #2563eb     /* Hover-state */
--text-main: #ffffff        /* Hovedtekst */
--header-height: 40px       /* Header høyde */
```

#### Neon-effekter
- **Neon Blue:** `#e0f2fe` med `text-shadow: 0 0 10px rgba(59, 130, 246, 0.8)`
- **Neon Orange:** `#fbbf24` med `text-shadow: 0 0 15px #f59e0b, 0 0 25px #d97706`

#### Pulte-farger
- **Standard:** `#2d3748` / `#64748b`
- **Rød:** `#7f1d1d` / `#991b1b`
- **Gul:** `#78350f` / `#92400e`
- **Grønn:** `#064e3b` / `#065f46`
- **Blå:** `#1e3a8a` / `#1e40af`

#### Gruppefarger (10 farger)
```javascript
'#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981',
'#ef4444', '#6366f1', '#14b8a6', '#f97316', '#84cc16'
```

---

### 📐 Layout & Spacing

#### Terminologi
- **Bord** (ikke "pult") - Brukes konsekvent i UI og kode
- **Klasserom** (ikke "rom") - Når vi snakker om fysiske rom
- **Klassekart** - Kombinasjon av klasse + rom med elevplassering

#### Dimensjoner
- **Sidebar:** 260px bred
- **Bord (desk):** 85px × 55px
- **Front Board:** 400px × 30px
- **Snap Threshold:** 15px

#### Border Radius
- **Window:** 12px
- **Cards:** 12px
- **Buttons:** 6px
- **Inputs:** 6px

---

### ✨ Effekter

#### Glassmorphism
```css
background: rgba(30, 35, 50, 0.6);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.15);
```

#### Bakgrunnsmønster
```css
background-image: radial-gradient(#2d3748 1px, transparent 1px);
background-size: 30px 30px;
```

#### Animasjoner
- **fadeIn:** opacity + translateY(5px) → 0
- **Transform transitions:** 0.2s - 0.5s ease

---

### 🔤 Typografi

**Font:** Inter (Google Fonts)
- Weights: 300, 400, 500, 600, 700, 800

#### Størrelser
- **Logo:** 1.8rem, weight 800, italic, uppercase
- **Card title:** 1.4rem, weight 700
- **Normal text:** 0.95rem
- **Small text:** 0.75-0.85rem
- **Icon text:** 0.65-0.7rem

---

## Komponenter

### 🎴 Cards
- **Background:** `rgba(45, 50, 65, 0.6)`
- **Border:** `1px solid rgba(255, 255, 255, 0.1)`
- **Hover:** translateY(-3px), border-color → accent

### 🔘 Buttons
**Primær:**
- Padding: 6px 15px
- Font-size: 0.85rem
- Background: var(--accent)

**Sekundær:**
- Background: rgba(255, 255, 255, 0.1)
- Border: 1px solid rgba(255, 255, 255, 0.2)

**Danger:**
- Background: rgba(220, 38, 38, 0.2)
- Color: #fca5a5
- Hover: #dc2626 (solid)

### 📝 Inputs
```css
background: rgba(0, 0, 0, 0.3);
border: 1px solid rgba(255, 255, 255, 0.2);
color: white;
padding: 8px 10px;
border-radius: 6px;
```

---

## Retningslinjer

### ✅ Gjør
- Bruk **"Bord"** konsekvent (ikke "pult") i all UI-tekst
- Bruk glassmorphism for større UI-elementer
- Konsistent bruk av accent-fargen (#3b82f6)
- Smooth overganger (0.2s - 0.5s)
- Bruk neon-effekter på viktige elementer
- Dark mode alltid

### ❌ Ikke gjør
- Ikke bland andre fargesystemer
- Ikke bruk lysere bakgrunner
- Ikke endre Inter font-familien
- Ikke bruk skarpere border-radius enn 12px på store elementer

---

## Sjekkliste for nye komponenter

- [ ] Bruker farger fra design-systemet
- [ ] Har hover/active states
- [ ] Har smooth transitions
- [ ] Følger spacing-standarder
- [ ] Bruker Inter font
- [ ] Responsiv til vindusendringer
- [ ] Konsistent med eksisterende komponenter

---

**Sist oppdatert:** 2026-02-12 (Terminologi: "Bord" i stedet for "Pult")
