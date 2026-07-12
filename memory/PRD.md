# Overview — PRD

## Original problem statement
"Overview" — app nativa iOS (realizzata come app Expo/React Native cross-platform su richiesta utente) che estende i sensi umani: trasforma fenomeni fisici reali e invisibili in esperienze visive, sonore e interattive. Principio assoluto: **nessun dato inventato**; se un dato non è disponibile, indicarlo chiaramente. Stile Apple minimal, nero/oro/blu.

## Architecture
- **Frontend**: Expo Router (stack navigation), React Native, Reanimated, react-native-svg, expo-blur (glass), expo-camera, expo-sensors, expo-location, expo-audio, @gorhom/bottom-sheet, react-native-keyboard-controller. Font Geist + Geist Mono.
- **Backend**: FastAPI + MongoDB (motor). Proxy verso fonti scientifiche pubbliche + AI streaming.
- **Core scientifico**: `src/lib/astronomy.ts` implementa l'algoritmo di Paul Schlyter (Sole, Luna con perturbazioni, pianeti Mercurio–Nettuno, alt/az, fasi lunari, alba/tramonto/crepuscolo, velocità orbitale vis-viva, rotazione terrestre, tempo-luce). Tutto calcolato, non inventato.

## Data sources (real, free, no key)
- Open-Meteo: meteo + pressione + qualità aria.
- NOAA SWPC: indice Kp, vento solare, IMF Bz/Bt, flare X-ray, macchie solari, aurore.
- wheretheiss.at (+ open-notify fallback): posizione ISS live.
- GPT-5.5 via Emergent universal key: assistente AI (streaming SSE, cronologia in Mongo).

## Implemented (2026-07-12)
- Home hub animato con 8 moduli, quote, wordmark.
- Qui e Ora: dashboard narrativa real-time (velocità Terra, luce solare, Luna, campo magnetico, coordinate, altitudine, alba/tramonto, meteo, geomagnetismo, ISS).
- Cielo: overlay fotocamera + oggetti calcolati (stelle, pianeti, Luna, Sole, deep-sky, centro galattico) tappabili → bottom sheet; lista "Visibile ora".
- Universo: orrery SVG con posizioni eliocentriche reali dei pianeti, pianeti/legenda tappabili.
- Realtà Invisibile: bussola SVG, magnetometro, gravità/inclinazione, GPS, ISS (guard web).
- Meteo Spaziale: dashboard NOAA con pull-to-refresh.
- Sonificazione: toni reali (WAV pentatonici) pilotati da magnetometro / Kp.
- Timeline: stepper data/ora, ricostruzione cielo + fase lunare per qualsiasi data.
- Assistente: chat GPT-5.5 streaming con suggerimenti, keyboard controller.
- Backend endpoints testati (6/6 pytest). Crash sensori-su-web risolto.

## Backlog (prioritized)
- P1: AR "Cielo" — calibrazione fine del puntamento (fusione magnetometro+giroscopio) su device reale; disegno linee costellazioni.
- P1: Timeline — eclissi ed eventi astronomici (Besselian elements).
- P2: Universo — vista 3D vera (expo-gl/three) con pinch/zoom; stelle vicine.
- P2: Assistente contestuale (passare l'oggetto osservato come `context`).
- P2: Catalogo stellare esteso (Hipparcos) e satelliti (TLE/SGP4) reali sopra la testa.
- P2: Widget / notifiche eventi (solo su richiesta utente).

## Concept evolution (2026-07-12, v2)
Overview = esperienza immersiva "The Invisible Sense" (sottotitolo solo in splash/schermate istituzionali). I "moduli" sono ora **Layer** (strati della realtà). L'app deve sembrare viva.

### Done (Fase 1)
- **Splash** dedicato: nero + stelle discrete, logo OVERVIEW + "The Invisible Sense", curvatura realistica della Terra (limb SVG con atmosfera azzurra + terminatore giorno/notte) in basso; leggera rotazione poi ingresso in Home (`/home`).
- **Home viva**: frase scientifica reale che cambia ogni 5s sotto il logo; sezione "ACCENDI UNO STRATO DELLA REALTÀ"; card Layer con overline (EARTH/SKY/UNIVERSE/MAGNETIC/SOLAR/SIGNAL/TIME LAYER) e caption live (temp, fase lunare, Sole, Kp, oggetto più interessante nel cielo); micro-animazioni: MiniSun (colore varia con Kp), MiniOrrery, MiniField.

### Done (Fase 2, 2026-07-12)
- **Cielo/Fotocamera "Visione"**: pulsante di scatto + barra modalità (Auto/Light+/Spectrum/Detail/Field/Reality/Deep). Auto = analisi reale dei pixel (luminanza/verde/cielo) che sceglie la modalità. Elaborazione via Skia ColorMatrix su pixel reali; Field/Reality sovrappongono dati sensori/oggetti (Skia Text). Salvataggio in **Foto** (expo-media-library) e in galleria interna.
- **Sonificazione/"Listening Layer"**: tab dedicato; analisi reale del microfono (intensità dB, storico ampiezza, impulsi) via expo-audio metering; orb dinamico; registrazione + riascolto originale/amplificato + salvataggio. Spettro FFT completo NON simulato (nota esplicita: richiede modulo nativo).
- **"Le mie osservazioni"** (`/observations`): galleria interna immagini + audio, con eliminazione. Accesso da Cielo e da Suono.
- Permessi foto/microfono aggiunti in app.json. Note "apri in Expo Go" sui gate web.

## Observations system (2026-07-12, v3)
Le foto sono ora **"Observations"**: istantanee scientifiche complete, riapribili e condivisibili.
### Done
- **Satelliti reali (TLE/SGP4)**: backend `/api/satellites` (TLE da tle.ivanstanojevic.me: ISS, Tiangong, Hubble, NOAA/EOS, Starlink, cache 6h). Frontend `satellite.js` propaga alt/az topocentrico per l'osservatore. Marker satelliti live in Cielo + conteggio "sopra di te".
- **Cielo → Observation**: lo scatto raccoglie tutti i dati disponibili (GPS, direzione/azimut/elevazione fotocamera, Sole, Luna+fase, pianeti, costellazioni, stelle, satelliti, ISS, centro Via Lattea, meteo, meteo spaziale) e crea un'Observation con ID progressivo `#000000NNN`. Overlay live: linee costellazioni + satelliti (toggle).
- **Observation viewer** (`/observation?id=`): foto + pannello dati completo; **"What You Couldn't See"** rivela sulla foto ciò che era realmente presente (costellazioni, pianeti, satelliti, ISS, direzione Via Lattea) proiettato da az/alt salvati; watermark elegante "Overview • The Invisible Sense" + codice + data + QR (deep link `frontend://observation?id=`); **Condividi** (view-shot + expo-sharing) e **Salva in Foto**. Il cielo è ricalcolato (deterministico); satelliti/ISS dall'istantanea salvata.
- **Galleria "Le mie osservazioni"**: apre il viewer; audio separato.

### Pending (richiede build/dev-client, non Expo Go)
- **Spettro FFT reale (Listening Layer)**: necessita libreria audio nativa (es. react-native-audio-api AnalyserNode) — NON simulato. Attualmente il Listening Layer mostra intensità/impulsi reali (metering).

### Backlog (Fase 3 — richiede build su iPhone reale, non testabile su web/Expo Go)
- **Fotocamera (in "Cielo")**: analisi automatica della scena con AI che sceglie la modalità; modalità Light+ (amplificazione luce), Spectrum (amplificazione cromatica), Detail (dettagli difficili), Field (campi/dati ambientali overlay), Reality (dati astronomici/satellitari overlay), Deep (universo oltre il visibile). Selezione manuale. Elaborazione immagine via Skia. Salvataggio in Foto (expo-media-library) + galleria interna "Le mie osservazioni".
- **Audio (in "Sonificazione") — "Listening Layer"**: analisi continua del paesaggio sonoro (spettro frequenze, intensità, direzione se stimabile, frequenze predominanti/poco percepite, rumore ambientale, impulsi); ascolto originale/amplificato/elaborato; rappresentazione 3D dinamica; registrazione e salvataggio. Nota tecnica: lo spettro FFT reale richiede accesso PCM/native module non disponibile in Expo managed → valutare dev-client con libreria dedicata; non simulare dati.
- Ristrutturazione completa in 9 Layer (Earth/Atmosphere/Solar/Lunar/Satellite/Magnetic/Signal/Universe/Deep Space) se desiderata.
- Satelliti reali sopra la testa via TLE/SGP4 (conteggio onesto, oggi solo ISS).

## Next tasks
- Testare su iPhone reale i moduli dipendenti da sensori/fotocamera.
- Estendere sorgenti dati satelliti (TLE) e linee costellazioni.

---

## SESSIONE — Social Network + Today's Opportunities + Invisible Fields (COMPLETATO)

### Architettura backend (modularizzata)
- `database.py` (client Mongo + config JWT/upload), `auth.py` (JWT email/password modulare — `auth_providers[]` per futuri Apple/Google, id interno uuid, nickname univoco ≠ email), `social.py` (Observations/feed/interazioni/commenti/follow/save/repost/collection/profili), `ai_features.py` (narrazione AI GPT-5.5, mai inventa dati), `server.py` (endpoint scientifici + wiring router).

### Fatto e verificato (self-test curl + screenshot, NO test agent per volere utente)
1. **Auth JWT** — register/login/me. Utente seed: `explorer@overview.app` / `overview123`.
2. **Observations** — POST con immagine base64 su disco (`/api/media/{id}`), category + Scientific Value (0-100) derivati server-side.
3. **Feed globale** con filtri: sort (smart/recent/observed/discovery/learned/scientific), category, media_type, source, window (today/week), following, nearby (lat/lon haversine). Scoring "smart".
4. **Interazioni (no like)**: Views, Observed, Discovery, Learned (toggle). + **Save**, **Repost**, **Share**, **Commenti**, **Follow/Unfollow**.
5. **Profilo**: stats, bio editabile, Archivio + **My Collection** (salvati). Repost mostrati nel profilo con `reposted_by`.
6. **Today's Opportunities** (`today.tsx`): motto ufficiale + briefing + Curiosità del giorno (AI) + card opportunità. Motore `opportunities.ts` (Sole/tramonto, ISS pass SGP4, Luna, pianeti, Via Lattea, sciami meteorici `events.ts`, aurora/Kp, listening, luce). Sezione OPPORTUNITIES in ogni Layer (`OpportunitiesSection`). Card in Home.
7. **Opportunity detail** (`opportunity.tsx`): DATI SCIENTIFICI + SPIEGAZIONE AI + consigli + favoriti/share + "Crea Observation".
8. **Invisible Fields** (`invisible-fields.tsx`): viz dati fisici reali + "Explain This Visualization" (AI) + **Start Observation** → `invisible-observe.tsx` (camera + overlay campo + vision modes + CAPTURE → Observation). "Explain this Observation" nel viewer `observation.tsx`.
9. **Home** riordinata: OVERVIEW → The Invisible Sense → motto → messaggio dinamico reale (rotante) → Today's Opportunities → Layer.

### Regola AI (rispettata)
Dati sempre da calcoli reali/sensori/fonti scientifiche. AI solo riformula dati verificati (spiegazioni/curiosità/consigli). Mai inventa valori o fenomeni.

### NOTE
- Camera / GPS / magnetometro NON testabili su web/Expo Go: richiedono build su device (Invisible Fields Observation, Cielo, opportunità basate su posizione).

---

## ROADMAP — Grandi funzionalità richieste (DA FARE, a fine lavoro corrente)

### 1. SATELLITE OBSERVATION (nuovo tipo di Observation)
Scoperta personale costruita su dati satellitari: selezione area, disegno (cerchi/frecce/pennelli), confronto date/satelliti/Layer (visibile/IR/vegetazione/radar/termico/meteo/aria), misurazioni, annotazioni, spiegazione AI. Scheda auto-generata (autore, coord, satellite, sorgente, data acquisizione, Layer, strumenti, Scientific Value, AI Confidence, Observation ID, immagini, confronti). Entra nel feed; le Observation evolvono nel tempo (nuove prove/dati/verifiche). Fonti: NASA/ESA/NOAA/ISS.

### 2. SATELLITE INTELLIGENCE LAYER
Nuovo Layer osservazione Terra: Earth Now, Satellite Vision (multispettrale/IR/termico/radar/vegetazione), Then/Now (confronto date), Multiple Eyes (stesso luogo, più strumenti), What Changed? (analisi cambiamenti). AI SEMPRE in 3 sezioni: WHAT WE OBSERVE / POSSIBLE EXPLANATIONS / WHAT WE CANNOT CONCLUDE. Mai certezze da correlazioni.

### 3. UNIVERSE EXPLORER (evoluzione di Universo)
Pulsante "Open Universe Explorer" dalla schermata Universo. Mappa navigabile continua (pinch/drag/rotate/doppio-tap). Livelli: Sistema Solare → Via Lattea → Gruppo Locale → Ammassi → Superammassi → Filamenti → Universo osservabile. Funzione SCALE (zoom continuo utente↔universo e cellula↔quark). Oggetti cliccabili con dati completi (distanze, massa, diametro, gravità, temperatura, periodo, tempo-luce, tempo Voyager/sonde, immagini NASA/ESA/Hubble/JWST, 3D, missioni, curiosità, Observation community, Opportunity). Tocco spazio vuoto → coord/oggetto vicino/costellazione. Timeline (passato/futuro, cielo cambia). Travel Here (velocità: piedi→luce). Gallery immagini swipe. Integrato col Social (crea Observation da qualsiasi oggetto).

Priorità suggerita: 3 (Universe Explorer) e 1 (Satellite Observation) hanno impatto/wow maggiore.


---

## SESSIONE 2 — Universe Explorer + Satellite Observation + Splash/Welcome + About (COMPLETATO)

- **Universe Explorer** (`universe-explorer.tsx`, `scale.tsx`, `cosmic-object.tsx`, `src/lib/cosmos.ts`): hub oggetti cosmici (dati reali NASA/ESA), viaggio SCALE (quark→universo osservabile), dettaglio oggetto con Travel Here (piedi→luce), tempo-luce, curiosità, crea Observation. Pulsante "Open Universe Explorer" in Universo.
- **Satellite Observation / Intelligence** (`satellite-observe.tsx`, `src/lib/satelliteImagery.ts`, backend `/api/ai/analyze-satellite`): immagini reali NASA GIBS/Worldview (True Color, VIIRS, False Color, Termico, Vegetazione, Luci notturne), Then/Now, analisi AI a 3 sezioni (WHAT WE OBSERVE / POSSIBLE EXPLANATIONS / WHAT WE CANNOT CONCLUDE, mai inventa), pubblicazione come Observation (source="satellite", upload immagine base64 via expo-file-system/legacy). Layer in Home.
- **Splash + Welcome + Auth flow**: `index.tsx` = splash a schermo intero (Foto 1 verticale) ~4s → `welcome.tsx` (login/registrazione/ospite) → Home. Se già loggato, splash→Home.
- **App icon**: attiva = anello dorato pulito (`assets/images/icon.png` + `adaptive-icon.png`). Alternative salvate: `icon-ring.png`, `icon-text.png` (l'utente può scegliere puntando app.json).
- **About Overview** (`about.tsx`): carta d'identità (creator Fabio Andreola, special thanks AI, data sources, privacy, disclaimer, version, roadmap coming soon, contatti) + firma "Overview doesn't create reality. It reveals it.". Firma anche in fondo alla Home (tap → About) e accesso da profilo (icona info).
- Social arricchito: **Save/My Collection, Repost, Share, contatori completi** (Views/Observed/Discovery/Learned/commenti/repost/save).

### Verifica: self-test (curl + tsc + lint + screenshot). NESSUN test agent (per volere esplicito dell'utente: "No test agent. Mai").
### Device-only: satellite publish (download immagine), camera Invisible Fields, GPS/sensori.

---

## IDENTITÀ / FILOSOFIA UFFICIALE (2026-06, definita dall'utente)

Overview **non** è un'app di astronomia, **non** è un social. È **un'estensione dei sensi umani**.
L'obiettivo non è osservare il cielo: è osservare **qualsiasi realtà** — un fiore, una persona,
un animale, un edificio, un'auto, una montagna, un lago, un tramonto, il cielo, qualunque cosa.
La domanda guida, sempre: **"Cosa esiste qui che l'occhio umano non riesce a vedere?"**

Nessun dato inventato, nessun effetto speciale. Solo dati **realmente misurabili** (sensori iPhone,
fotocamera, satelliti, API scientifiche, modelli fisici) trasformati in qualcosa che l'occhio possa
finalmente vedere: differenze di temperatura, micro-variazioni di luce, differenze cromatiche invisibili,
amplificazione di micro-movimenti, direzione/intensità del vento, campi magnetici misurabili, percorso
Sole/Luna, satelliti/ISS sopra la scena, confronto temporale della stessa zona, variazioni vegetazione,
UV, qualità aria, umidità, pressione, meteo spaziale, orientamento, gravità, dati astronomici, ecc.

Ogni Observation è la rappresentazione di una realtà invisibile; l'utente la interpreta liberamente
(visualizzazione scientifica / aura / energia). L'app **non afferma mai interpretazioni**: mostra solo
dati reali resi comprensibili.

Motti ufficiali:
- "Everything you see contains much more than you can perceive."
- "You don't need another camera. You need another sense." — **The Invisible Sense.**
- "We don't create invisible worlds. We reveal the invisible parts of the real one."

Implicazione roadmap: l'esperienza di cattura ("Invisible Fields"/Observation) va riorientata dall'essere
cielo-centrica all'essere **soggetto-libero** (qualsiasi cosa inquadrata), proponendo i layer invisibili
reali pertinenti al contesto.

---

## SESSIONE 3 — Diario Collettivo dell'Universo, Slice 1 (2026-06)

### Fatto e verificato (curl + lint, NO test agent)
- **Observation Score (composito)**: `compute_scores` in `social.py` → `overall_score` = 0.35·scientific + 0.30·community + 0.20·rarity + 0.15·confirmed. Restituito da `obs_public` (community_value, rarity_score, confirmed, overall_score). Mostrato come badge headline (sparkles) su ObservationCard + chip "Confermata" (observed≥3).
- **Discovery Level**: ranghi utente Observer → Explorer → Seeker → Investigator → Revealer → Sentinel → Invisible Sense, calcolati da attività reale (observations, interazioni ricevute, follower, avg scientific value). `GET /api/users/{id}` restituisce `discovery_level` {title, points, next_title, next_min, progress}. Mostrato su profilo con progress bar.
- **Observation of the Day**: `GET /api/observation-of-the-day` → observation con `overall_score` più alto nelle ultime 48h (fallback all-time). Sezione in evidenza in Home (`ObservationOfTheDay.tsx`).

### Prossimo (Fase 2 roadmap Diario Collettivo)
- P0: Discovery Card Export (grafica condivisibile: watermark, QR, overlay dati).
- P1: Community Verification (Verified Events), Live Earth (Terra 3D pulsante nel Social), Observation Chains.
- P2: Event Timeline, Observation Replay (time machine), Discovery Challenges.
- P3: Observatory (galleria mondiale delle osservazioni più rare/verificate/belle).
- Riorientamento esperienza cattura secondo la nuova filosofia (soggetto libero, non solo cielo).

---

## SESSIONE 4 — SENSE VISION™ (funzione-firma, 2026-06)

Esperienza di cattura unificata e brandizzata. "Invisible Fields" resta solo come **nome interno
del motore**; per l'utente esiste una sola esperienza: **SENSE VISION™**.

Flusso: 📷 Make a Sense → 👁 analisi scena → ✨ Sense Created → 🌍 Observation → ⭐ Verified Observation.

### Fatto e verificato (lint + screenshot, NO test agent)
- **`/sense-vision.tsx`**: fotocamera con animazione di avvio ("Initializing Sense Vision…" →
  "Looking beyond human perception…"), overlay dati reali (magnetometro/heading via motore Invisible
  Fields), selettore **Sense Layers** (Ambiente, Luce, Colore, Contrasto, Micro-dettaglio, Campo
  magnetico, Sole & UV), pulsante iconico **✨ MAKE A SENSE ✨**, flash "Sense Created" → viewer.
  Cattura funziona anche senza posizione (dati minimi onesti). Soggetto libero (non solo cielo).
- **`SenseVisionCard.tsx`** (Home, protagonista in cima): anteprima ultimo Sense + "MAKE A SENSE".
  Slogan "Reality is richer than your eyes." Layer grid "Invisible Fields" rinominato "Sense Vision".
- **`observation.tsx`** rebrandizzato: hero "SENSE CREATED", riga "Sense Layer", pubblica come
  Observation, nota "Verified Observation quando la community conferma". Watermark/QR/share invariati.
- **Onestà scientifica**: niente mappa termica né UV-riflesso finti (hardware assente). Solo layer
  derivati dai pixel reali + dati ambientali/astronomici reali etichettati. UV = indice ambientale reale.

### Device-only: la cattura Sense Vision (fotocamera + sensori) richiede build nativa; su web/Expo Go
appare il gate permessi "Make a Sense".

---

## SESSIONE 5 — Sense Vision branding + Skia + fix (2026-06)

- **Fix bug scatto**: la cattura salvava solo con GPS concesso → senza posizione non scattava. Ora
  scatta sempre (posizione = dati completi, senza = dati minimi onesti). `invisible-observe` e
  `invisible-fields` → "Start Observation" ora puntano a `/sense-vision` (esperienza unica).
- **Icona-simbolo `SenseMark`** (`src/components/SenseMark.tsx`, asset `assets/images/sense-mark.png`,
  attualmente = anello eclissi Overview): simbolo universale di "Make a Sense", presente in badge Home,
  pulsante MAKE A SENSE, gate/boot/created della cattura, hero del viewer. Animazione (glow+pulse+
  rotazione lenta) mentre `active` (durante il sensing).  ⚠️ Da confermare con l'utente se usare
  un'icona Sense Vision dedicata (basta sostituire il file `sense-mark.png`).
- **Skia real pixel processing** (`src/components/SenseCanvas.tsx`): il Sense catturato viene
  rielaborato con ColorMatrix reali (Luce, Colore, Contrasto, Luminanza, Micro-dettaglio, Originale).
  Selettore "Sense Layers" nel viewer. Trasformazioni oneste dei pixel reali (nessun dato inventato).
  Fallback a immagine semplice su web / non caricata / Originale.
- **Icona Home globale** in `ScreenHeader` (alto a destra, fissa, discreta) → torna alla Home.
- **Credit Emergent** aggiunto in About → SPECIAL THANKS.
- **Fix deploy (BUILD)**: aggiunti i config plugin mancanti in `app.json` (expo-camera, expo-location,
  expo-media-library) — probabile causa di "invalid mobile app config: app.json". Gli errori
  `pull_source: activity error` (DEPLOY/HEALTH_CHECK/MANAGE_SECRETS/MONGODB_MIGRATE) sono lato
  piattaforma/infra (pull sorgente da GCS) → retry + support.

