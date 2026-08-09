# Overview — PRD

## Original problem statement
"Overview" — app nativa iOS (realizzata come app Expo/React Native cross-platform su richiesta utente) che estende i sensi umani: trasforma fenomeni fisici reali e invisibili in esperienze visive, sonore e interattive. Principio assoluto: **nessun dato inventato**; se un dato non è disponibile, indicarlo chiaramente. Stile Apple minimal, nero/oro/blu.

## SESSIONE — Globo condiviso + Ecoes™ Fase 3 (2026-06)
- **GlobeBase condiviso (FATTO)**: `src/components/GlobeBase.tsx` è ora l'UNICA base SVG orthographic (sfera, continenti, rotazione auto, drag+pinch, proiezione stabile). `LiveEarth.tsx` (Observe) ed `EcoesGlobe.tsx` la consumano via `overlay(ctx)`; risolta la deformazione del globo su rotazione/zoom. GlobeBase ha prop `interactive` (compact Observe disabilita pan/pinch). Nessuna regressione (città, puntini osservazioni, lista, reset, pulsazioni Ecoes).
- **Report Sense Vision (SOLO analisi, nessun codice)**: consegnato all'utente. Sistema attuale = riconoscimento di UN solo soggetto (Live Sense™) via OpenAI GPT-5.4 (endpoint /api/ai/live-recognize, /scene, /recognize-subject, /see); categorie abilitate (default preset "balanced", 9 su 12), soglia confidenza (<0.55 scartato in silenzio), snapshot ridotto a 640px. Astronomia gestita da motore deterministico separato. Evoluzione futura concordata (NON ancora implementata): scena completa, multi-soggetto, confidenza per elemento, "non determinabile" esplicito, risoluzione adattiva.
- **Ecoes™ Fase 3 (FATTO, testato 17/17 backend + frontend)**:
  - Thread/risposte: `POST /api/ecoes/rooms/{cid}/posts` accetta `parent_id` (validato); UI room con risposte indentate + banner "In risposta a…".
  - Condivisione Sense: `POST /api/ecoes/rooms/{cid}/share-sense` — `image_base64` (sense solo-room, moderato, R2 prefix "chat") oppure `obs_id` (referenzia un Sense già pubblicato in Observe). Frontend: sheet con Fotocamera/Galleria + switch "Pubblica anche in Observe" (se ON crea prima l'observation via flusso Observe intatto, poi la referenzia).
  - DM tra partecipanti: RIUSA il sistema Messaggi esistente (`dmApi.start` → `/chat`), nessun sistema parallelo. Chip partecipante toccabile.
  - Evoluzione automatica titolo: `maintenance_loop` (ogni 30min) → `maybe_evolve_title` (GPT-5.4) rinomina solo su reale spostamento di significato (cooldown 2h, ≥6 nuovi post), aggiorna `title_history`, notifica i partecipanti. NON crea post (non gonfia l'attività). UI: sezione "EVOLUZIONE DEL TITOLO" nel pannello info.
  - Segnala → moderazione: `POST /api/ecoes/rooms/{cid}/report` (post o connection) → `ecoes_flags` status "reported", auto-escalation se abusivo. Menu ⋯ sui post altrui.
  - Bot di sistema: sempre presenti, tag "SISTEMA", non utenti, non conteggiati, non influenzano la pulsazione (invariato Fasi 1/2). Moderazione AI continua sul post (422 se abusivo).
  - Pulsazione dinamica: già gestita da `_intensity` (recency+attività, dormant<0.28) + EcoesGlobe (velocità/opacità ∝ intensità). Nessun numero pubblico.
  - VINCOLI rispettati: logica Fasi 1/2 invariata, Sense Vision non toccato, nessun conteggio pubblico utenti, identità visiva Ecoes World invariata.
  - Nuovi campi post: `parent_id`, `kind:"sense"` con `image_media_id`/`obs_id`. Serializzatore `_post_public`. Seed di test: `/app/backend/seed_ecoes_room.py` (connection `test-ecoes-room-0001`, membri explorer+Apple).


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

### FIX DEPLOY DEFINITIVO (causa reale del Cloud Build fallito)
Riprodotto in locale `npx expo export --platform web` → falliva con:
`SyntaxError: node_modules/satellite.js/wasm-build/pthreads-release/index.js: Unexpected token «require»`.
Causa: **satellite.js 7.0.1** include un build WASM (emscripten) che il minifier di Metro non riesce a
parsare durante l'export di produzione (in dev non veniva minificato → preview ok, deploy ko).
Fix: **downgrade a satellite.js 5.0.0** (JS puro, stessa API SGP4, nessun WASM). `radiansToDegrees`
non è nei typings v5 → sostituito con conversione inline `* 180/π`. `npx expo export` ora EXIT 0,
`dist/` generato correttamente. Anche i config plugin (expo-camera/location/media-library) restano in
app.json (best practice). App verificata funzionante in preview dopo il downgrade.

---

## SESSIONE 6 — Beta + moderazione contenuti + policy foto (2026-06)

- **Avviso Beta**: banner "BETA · versione in fase di sviluppo" su `login.tsx` e pill "BETA · IN
  SVILUPPO" su `welcome.tsx`.
- **Moderazione anti-nudità** (App Store compliance): alla pubblicazione di una foto utente
  (`create_observation`, source != satellite) il backend invia l'immagine base64 a **OpenAI gpt-5.4
  (vision)** via emergentintegrations `ImageContent` (`ai_features.moderate_image_safe`) → JSON
  {nudity, sexual, safe}. Se non safe → **HTTP 422** e pubblicazione bloccata (nessun media salvato).
  NASA GIBS (satellite) salta il controllo. Fail-OPEN sugli errori tecnici. Testato: immagine benigna
  → {safe:True, checked:True}. Frontend (`observation.tsx`) mostra il messaggio di blocco 422.
- **Solo foto in-app pubblicabili**: garantito by design (nessun picker di galleria; pubblicazione
  solo dal viewer del Sense catturato o da immagini satellitari NASA). Nota di policy aggiunta.
- Playbook test immagini in `/app/image_testing.md`.


---

## SESSIONE 7 — Discovery Card Export (P0, 2026-06)

- **`src/components/DiscoveryCard.tsx`**: card grafica condivisibile (nero/oro, brand Overview + SenseMark,
  overlay dati reali, QR, data/coordinate, cornice oro). Due formati: **1:1 (Post)** e **9:16 (Story)**.
- **QR** → URL web `${EXPO_PUBLIC_BACKEND_URL}/observation-detail?id=<publishedId>` (apribile via web;
  se non pubblicata → base app). Deep-link "apri nell'app" (universal/app links) da finalizzare dopo il
  deploy con associazione dominio.
- **`observation.tsx`**: pulsante "Esporta Discovery Card" → modale con toggle formato + anteprima
  (`DiscoveryCard` in ViewShot) + **Condividi** (Sharing) / **Salva** (MediaLibrary → PNG). Cattura via
  `captureRef(cardRef)`.
- Verifica: lint + tsc puliti; app carica in preview. Export end-to-end (capture PNG + share/save)
  testabile solo su **build nativa** (serve un Sense catturato in-app e permesso Foto).
---

## SESSIONE 8 — Universe Explorer: da database a esperienza (FASE 1, 2026-06)

Visione utente: Universe non deve sembrare una lista, ma un'esplorazione reale. Confermato piano a fasi.
FASE 1 (fatta):
- **Backend** `GET /api/cosmos-images?q=&limit=`: proxy a NASA Images API (pubblico dominio) → lista
  immagini reali {thumb,image,title,description,center,date}. Testato (Jupiter/Saturn OK).
- **`cosmos.ts`**: `NASA_QUERY` per oggetto + `nasaQueryFor()` + `compareWithEarth()` (dimensione/peso/massa).
- **`ImageZoomViewer.tsx`**: viewer full-screen, swipe tra immagini + pinch-zoom + doppio-tap + pan
  (gesture-handler/reanimated), supporta rotazione.
- **`cosmic-object.tsx` riscritto**: hero foto reale + watermark (snapshot-ready), **galleria reale**
  (thumbnail → viewer), confronto con la Terra, Travel Here, curiosità, **Snapshot** (condividi/salva via
  view-shot, senza UI), campo **"Aggiungi descrizione"** + **Pubblica come Observation** (scarica img NASA
  → base64 → createObservation source="cosmos", passa dalla moderazione).
- Verifica: lint+tsc puliti; scheda Saturno mostra 12 immagini reali NASA in preview.

Prossime fasi: F2 Sense Layers cosmici (multi-wavelength reale + overlay etichettati) + modalità Confronta;
F3 mappa immersiva pan/pinch multi-scala + Esplora intorno; F4 Viaggio animato + Timeline + Community
Observations per oggetto. Nota: capture/publish/zoom si validano a pieno su build nativa.

---

## SESSIONE 9 — Sense Vision come MOTORE trasversale (direzione utente, 2026-06)

Direzione: NO nuove sezioni. Sense Vision non è una sezione ma il MOTORE che alimenta ogni funzione che
crea immagini. Toggle Layer con icone intuitive + spiegazione onesta ("cosa mostra"), sempre dati reali.
Slice A (fatta):
- **`src/lib/senseLayers.ts`**: unica fonte di verità dei Sense Layer visivi (pixel reali): Originale ⭕,
  Luce ☀️, Colore 🎨, Dettaglio ✨, Contrasto 🌓, Luminanza 🔆 — ognuno con testo `reveals` onesto.
- **`src/components/SenseLayerBar.tsx`**: barra icone riusabile (piccola, intuitiva) + descrizione del layer attivo.
- Applicata al **viewer Sense** (`observation.tsx`, sostituite le vecchie chip) e a **Universe**
  (`cosmic-object.tsx`): la foto reale NASA passa dal motore `SenseCanvas` con la barra Layer. Watermark
  include il layer attivo.
- **Fix crash web**: Skia `useImage` chiamato solo dentro un componente figlio nativo (`SkiaSense`); su web
  fallback a immagine semplice (Skia CanvasKit non può fetchare immagini cross-origin). Verificato: Marte OK.
- Onestà: i layer pixel sono rimappe reali dei pixel della foto (mai dati inventati).

Prossime slice (stessa direzione, da confermare/costruire):
- Layer DATI per-contesto (🧲 Magnetic, ☀ Solar, 🌙 Lunar, 🛰 Satellite, 🌌 Universe, 🌬 Air, 🎧 Audio,
  🧭 Motion, 🌡 Heat solo se hardware reale) mostrati solo se il dato reale è disponibile.
- Auto-riconoscimento del soggetto (AI vision) → propone i layer più utili (cielo/Luna/persona/auto/fiore).
- Spiegazione AI automatica dopo ogni Sense (rigorosa, mai "aura"): descrive layer attivi + dati reali.
- Estendere la barra a Snapshot/Discovery Card/confronti.

---

## SESSIONE 10 — Sense Layers DATI + spiegazione AI automatica (2026-06)

- **Layer-dati per-contesto** (`senseLayers.ts` → `DATA_LAYERS` + `availableDataLayers(d)`): 🧲 Magnetico,
  ☀️ Solare, 🌙 Lunare, 🛰 Satelliti, 🌌 Universo, 🌬 Atmosfera, ☄️ Meteo spaziale, 🧭 Orientamento.
  Ogni layer estrae il valore REALE da ObsData; **mostrato solo se il dato esiste** (mai inventato).
  🌡 Heat e 🎧 Audio restano nascosti per foto (hardware/contesto non disponibile) → onestà.
- **Viewer Sense** (`observation.tsx`): sezione "DATI REALI RILEVATI" con chip toggle (solo disponibili);
  attivandoli compaiono **pill con i valori reali sovrapposte alla foto** (catturate anche nell'export).
- **Magnetometro** ora salvato in `ObsData.magnetic` alla cattura (sense-vision + invisible-observe).
- **Spiegazione AI automatica** dopo ogni Sense: parte al caricamento, usa `/ai/explain-visualization`
  (system: "NON è un'aura, non paranormale — resa grafica di dati reali"). Verificata via curl: rigorosa,
  cita solo dati reali, nessuna pseudoscienza.
- **Barra Sense estesa** al modale Discovery Card (cambio layer per la card esportata).

Rimane da fare (stessa direzione): **auto-riconoscimento del soggetto via AI vision** (cielo/Luna/persona/
auto/fiore) per proporre automaticamente i layer migliori — attivazione manuale già completa.

---

## SESSIONE 11 — Schermata "Before You Begin" (2026-06)

- **`app/before-you-begin.tsx`**: manifesto/filosofia premium (sfondo scuro stellato, SenseMark dorato,
  titolo con rule oro, paragrafi con fade-in scaglionato, chiusura "Explore your reality / Discover the
  invisible / Overview — The Invisible Sense"). **Toggle lingua IT/EN** (testi ufficiali forniti dall'utente).
- **Gate primo avvio**: `index.tsx` dopo lo splash → se non loggato e flag AsyncStorage `overview_seen_intro`
  assente → `/before-you-begin`; "Ho capito, procedi" salva il flag e va a `/welcome`. Se già visto → welcome.
- **Sempre consultabile** da About Overview: riga "Before You Begin" (`?from=about`) → modalità consultazione
  con "Chiudi" (nessun gate). Verificata in preview (IT+EN).

---

## SESSIONE 12 — Icona Sense Vision + auto-riconoscimento AI (2026-06)

- **Icona ufficiale Sense Vision** impostata come `assets/images/sense-mark.png` (anello dorato + iride
  spettrale, fornita dall'utente) → appare ovunque via `SenseMark` (gate/pulsante/created/badge Home/
  viewer/Universe). L'icona app launcher resta il brand Overview (anello).
- **Auto-riconoscimento soggetto (AI vision)**: `POST /api/ai/recognize-subject` (gpt-5.4 vision) →
  {subject, label_it}, fail-open. `senseLayers.SUBJECT_LAYERS` mappa il soggetto → layer consigliati
  (pixel + dati) in modo deterministico e onesto. Nel viewer Sense: legge base64 della foto, riconosce
  il soggetto, mostra banner "Soggetto rilevato: …", **evidenzia i layer consigliati** (dot) nella
  SenseLayerBar e **auto-attiva i data-layer consigliati disponibili**. Attivazione manuale sempre libera.
  Verificato: cerchio bianco su sfondo scuro → "moon / luna piena".
- Device-only: la lettura base64 della foto (per il riconoscimento) richiede un Sense catturato sul dispositivo.

Ancora in sospeso: deep-link QR "apri nell'app" (universal/app links) → richiede il dominio definitivo
DOPO il deploy (associazione dominio iOS/Android). Il QR web funziona già.

---
## Sessione (fork) — Overview Sense Universe + P1

### Completato
1. **Rebranding social** → "🌍 Overview Sense Universe™", sottotitolo "The social universe of real discoveries." (`app/feed.tsx`). Card Home rinominata da "Feed mondiale".
2. **Scorciatoia Home in alto a sinistra**: `SenseMark` fisso (overlay) che apre il feed; puntino oro pulsante mostrato SOLO quando ci sono nuove Observation dall'ultima visita (confronto `osu_last_seen` in AsyncStorage vs feed `sort=recent`). (`app/home.tsx`)
3. **P1 Verified Events**: backend `GET /api/events/verified` (cluster per categoria notevole + giorno UTC, ≥2 osservatori distinti). Carousel "Eventi verificati dalla community" in cima al feed (`src/components/VerifiedEvents.tsx`).
4. **P1 Live Earth**: backend `GET /api/events/live-earth` (coordinate reali ultime 24h). Globo ortografico SVG con graticule rotante + dot pulsanti geolocalizzati (`src/components/LiveEarth.tsx`), in cima al feed.
5. **P1 Observation Chains**: backend `GET /api/observations/{id}/chain` (stesso fenomeno ±36h; globale per fenomeni rari, altrimenti <300km). Sezione "Catena …" in `app/observation-detail.tsx`.
6. **Fix**: `nf()` (`src/lib/format.ts`) ora ritorna "—" per valori non finiti → risolto crash observation-detail su dati incompleti (es. ISS senza alt).

Nuovo modulo backend: `/app/backend/events.py` (registrato in server.py).

### Prossimo (P1 rimanente)
- **Universe Explorer Fase 2**: snapshot camera interno (watermark), modalità Compare, Object Timeline, Explore Around, Journey Mode, Community Observations sugli oggetti cosmici.

### Bloccato
- QR deep link nativo → attende dominio di produzione dopo deploy.

### Live Earth — Globo interattivo (upgrade)
`src/components/LiveEarth.tsx` riscritto come esperienza interattiva:
- Rotazione libera 360° con un dito (Pan), pinch-zoom 1x–6x (Pinch), auto-rotazione lenta quando fermo, ripresa dopo il rilascio.
- Continenti reali (Natural Earth 110m, semplificati in `src/lib/continents.ts`, ~1300 punti) come SOLO contorni dorati; oceani scuri; graticule tenue.
- Osservazioni sempre visibili (dot pulsanti), doppio tap sull'Observation → apre la scheda (verificato).
- Dettaglio progressivo con lo zoom: icone categoria (≥1.5x), anteprime Sense Vision (≥1.8x), città principali `src/lib/cities.ts` (≥2.2x). Pulsante Reset.
- Backend `live-earth` arricchito con `image_url`/`nickname`.
- Scroll del feed disabilitato durante l'interazione col globo (prop `onInteracting`).
NOTA: pinch-zoom e dettagli-su-zoom si testano al meglio su dispositivo reale (il preview web non emula il pinch a due dita).

### Profilo utente + Account Developer blindato
- **Account developer/founder** `fandrex1@gmail.com` (nickname NeoMorpheus): flag lato server `role=developer, protected=true, verified_badge="Creator"` via `ensure_developer_account()` in auth.py (idempotente, allo startup). Email + nickname IMMUTABILI (PATCH /users/me rifiuta con 403 se protected). Password cambiabile sempre dal proprietario. Badge "Creator" mostrato nel profilo (non falsificabile, solo server).
- **Cambio password**: `POST /api/auth/change-password` (verifica password attuale, deve differire, bcrypt). 
- **Anti brute-force login**: `failed_login_attempts` + `lockout_until` sul doc utente; 5 tentativi → blocco 15 min (429); reset al login corretto. Verificato via curl.
- **Avatar**: `POST /api/users/me/avatar` (base64 → moderazione anti-nudità `moderate_image_safe` → salvato in media `avatar_{uid}`), servito da `/api/media/{id}`. Frontend: expo-image-picker (galleria + fotocamera) con flusso permessi contestuale.
- **Schermata `app/edit-profile.tsx`**: avatar (galleria/fotocamera), nickname (bloccato+lucchetto per account protetti), bio, cambio password. `profile.tsx` mostra avatar+badge e "Modifica profilo" → edit-profile (reload al focus).
- Utenti normali: profilo modificabile liberamente (avatar/nickname/bio/password). Nessuna modifica email per nessuno.
- app.json: aggiunti NSPhotoLibraryUsageDescription + plugin expo-image-picker.
- Nota futura utente: creare ruoli "moderatori".

### Universe Explorer Fase 2 (P1) — COMPLETATA
`app/cosmic-object.tsx` + `src/lib/cosmos.ts`:
- **Snapshot con watermark**: già presente (SenseMark + nome/layer/distanza), condivisione + salvataggio.
- **Compare mode** (oggetto vs oggetto): picker orizzontale + tabella `comparableFields()` (tipo, distanza, diametro, gravità, temperatura, periodo orbitale). Verificato Sole vs Marte.
- **Object Timeline**: `OBJECT_EXTRAS[id].timeline` (scoperte/missioni reali) per Sole, Luna, Marte, Giove, Saturno, Plutone, ISS, Voyager1, Andromeda, Via Lattea.
- **Explore Around**: `OBJECT_EXTRAS[id].around` → chip navigabili verso oggetti correlati.
- **Community Observations**: `socialApi.feed({category})` → strip di osservazioni della community collegate all'oggetto, tap → observation-detail.
- **Journey/Travel Here**: già presente (tempi di viaggio a varie velocità).
Nessun dato inventato: timeline curate da eventi storici reali, confronti da valori astronomici reali.

STATO P1: tutti i punti completati (Verified Events, Live Earth interattivo, Observation Chains, Universe Explorer Fase 2).

### FIX login su build TestFlight/produzione (DB separato)
Causa: il build TestFlight usa il BACKEND DI PRODUZIONE, con MongoDB SEPARATO dal preview. Gli account creati via preview (founder + revisione Apple) non esistevano in produzione → login "email o password errati".
Fix (auth.py): `ensure_developer_account()` ora fa **seeding idempotente** all'avvio del backend in OGNI ambiente:
- Founder: `fandrex1@gmail.com` / `Overview.Sense76` / nick NeoMorpheus / badge Creator + protected.
- Revisione Apple: `apple@overview.app` / `Overview.Apple2026` / nick Apple (utente normale).
Helper `_seed_password_user()`: crea se mancante, altrimenti riapplica solo i flag; **non sovrascrive mai la password** (resta modificabile dal proprietario).
NB: è un fix SOLO BACKEND → basta un **Redeploy** perché il build TestFlight attuale possa loggarsi (non serve nuovo build iOS per questo).

### Universe Explorer — RIFATTO in 3D reale (Fase 1: Manual Exploration)
Stack: three@0.185 + @react-three/fiber@9.6 + expo-gl@16 + expo-three@8. NON installato drei (richiede Node 22).
- Wrapper Canvas cross-platform: `src/components/universe/r3f.web.ts` (THREE) e `r3f.native.ts` (expo-gl + expo-three TextureLoader). Metro risolve via estensioni piattaforma. Lint segnala "Unknown property" (falsi positivi r3f) e import non risolto (falso positivo: Metro risolve).
- Dataset reale `src/lib/universe.ts`: ~40 oggetti su 5 scale (Sistema Solare → stelle vicine → Via Lattea/nebulose → Gruppo Locale → universo osservabile). Ogni oggetto: kind, scale, pos 3D, size, colore, texture(equirettangolare), rep (photo/reconstruction/data-viz), source/licenza, cosmicId (link scheda completa).
- Scena `src/components/universe/UniverseScene.tsx`: starfield, sfere texturizzate (fallback colore imperativo — niente crash se la texture è bloccata), aloni glow, anelli Saturno, highlight selezione, camera rig orbitale con lerp fluido, proiezione 3D→2D per hit-test tap.
- Schermata `app/universe-explorer.tsx` (SOSTITUITA): gesti drag(ruota)+pinch(zoom)+doppio-tap(fly-to), idle drift, scala ladder 1-5 + Scala prec/succ + Terra(home), ricerca per nome, nascondi UI, card oggetto (tipo/distanza/blurb/rappresentazione+fonte) con "Avvicinati" e "Apri scheda"→cosmic-object.
- Verificato su web preview: rendering, navigazione, selezione, fly-to, cambio scala, ricerca. Texture equirettangolari bloccate nel sandbox (solarsystemscope) → fallback colore; caricheranno su device.
- Route test 3D: `app/r3f-test.tsx` (non collegata).
DA FARE (Fase 2): Guided Journey narrata, Snapshot-da-3D pulito, audio ambientale/sonificazione, modelli glTF, cataloghi live, bussola posizione.
NB: richiede un nuovo BUILD iOS per test performance/texture su device.


### Universe Explorer — FASE 2: Viaggi Guidati + Snapshot (COMPLETATA E VERIFICATA)
`app/universe-explorer.tsx` + `src/lib/universe.ts`:
- **Viaggi guidati narrati** (`JOURNEYS` in universe.ts): 5 tour reali con tappe multi-scala (Dalla Terra ai confini del Sistema Solare, Verso Proxima Centauri, Dentro la Via Lattea, Le galassie del Gruppo Locale, Dai pianeti all'Universo osservabile). Ogni step: {scale, objectId, text, dwell}.
- **UI narrazione** (`jCard`): barra in basso con titolo viaggio, progress (n/tot), testo dello step, controlli Prev/Play-Pausa/Next/Snapshot/Esci. Auto-advance con timer `dwell` (default 6s). La camera vola automaticamente all'oggetto di ogni tappa (cambio scala + target + rad).
- **Picker viaggi** (`journeyPicker` modal): bottom sheet con lista dei 5 viaggi (titolo, sottotitolo, n. tappe).
- **Snapshot pulito 3D** (`captureSnapshot`): cattura UI-free del canvas. Web → `renderer.domElement.toDataURL()` (Canvas creato con `preserveDrawingBuffer:true`); native → `GLView.takeSnapshotAsync(gl.getContext())` + `FileSystem.readAsStringAsync` base64. Renderer esposto via `ControlState.renderer` (settato in `Rig` useEffect da useThree `gl`).
- **Snapshot modal**: anteprima immagine, campo descrizione, **Pubblica come Observation** (`socialApi.createObservation` source="cosmos", passa dalla moderazione), Salva/Condividi (MediaLibrary/Sharing), apri Observation pubblicata.
- Verificato su web preview (NO test agent): scena 3D, apertura picker viaggi, avvio viaggio con barra narrazione + fly-to, cattura Snapshot (confermata da GL "ReadPixels" nei log, nessun crash), modale pubblicazione. Texture solarsystemscope bloccate da CORS nel sandbox → fallback colore (caricano su device). Rendering modali "sbiadito" sul preview = artefatto compositing RN-Web Modal su canvas WebGL; su device i modali sono nativi/opachi.
- **app.json**: aggiunto `ios.infoPlist.ITSAppUsesNonExemptEncryption = false` (bypass prompt conformità export Apple).
NB: performance/texture/snapshot nativo si validano su BUILD iOS reale.

DA FARE (prossimo, priorità utente): **1) Cataloghi live** (asteroidi/comete/pulsar/quasar/sonde via API esterne), **2) Modelli 3D glTF** (ISS, sonde). Poi: audio ambientale/sonificazione, ruoli moderatori.

### Universe Explorer — Cataloghi reali live/curati (COMPLETATO E VERIFICATO)
Backend `universe_live.py` (`universe_router`, registrato in server.py):
- `GET /api/universe/asteroids`: LIVE da **NASA NeoWs** (`api.nasa.gov`, oggetti near-Earth con passaggio ravvicinato oggi). Usa `NASA_API_KEY` da env (fallback `DEMO_KEY`). Cache in-memory 6h. Se l'API è irraggiungibile/rate-limited → fallback a un catalogo curato di asteroidi reali famosi (Apophis, Bennu, Ryugu, Eros, 1998 OR2) con `live:false`. NB: `ssd-api.jpl.nasa.gov` (comete SBDB) NON è raggiungibile dal sandbox → comete gestite come catalogo curato lato client.
Frontend `src/lib/liveCatalog.ts`:
- `fetchAsteroids()` → mappa la risposta backend in `UObject[]` (posizioni deterministiche via hash, scatter su shell), blurb con dati reali (Ø, km/s, ×distanza Luna, data passaggio).
- Cataloghi reali curati (valori misurati, fonti etichettate): **Comete** (Encke, Tempel-Tuttle, Swift-Tuttle, Hale-Bopp, NEOWISE, 67P — JPL), **Pulsar** (Crab, Vela, B1919+21, J0437-4715, B1257+12 — ATNF), **Quasar** (3C 273, TON 618, ULAS J1342+0928, APM 08279+5255 — SDSS/NASA), **Sonde** (New Horizons, Parker Solar Probe, JWST, Voyager 2, Juno — NASA/ESA).
- `catalogForScale(scale, asteroids, enabled)` unisce gli oggetti al layout statico per scala; `searchCatalog()` estende la ricerca.
- Aggiunti kind `pulsar`/`quasar` a `universe.ts` (UKind + KIND_LABEL).
Frontend `app/universe-explorer.tsx`:
- fetch asteroidi al mount; oggetti catalogo uniti alla scena per scala; ricerca estesa.
- Pulsante top-bar "layers" → **pannello "Cataloghi reali"** con toggle per Asteroidi(S1)/Comete(S1)/Sonde(S1)/Pulsar(S3)/Quasar(S5) + nota "Asteroidi live via NASA NeoWs".
- Verificato (screenshot, NO test agent): pannello toggle, oggetti scatterati in scena, ricerca+fly-to Apophis (dati reali), Crab Pulsar (S3, ATNF), scala 5 quasar senza crash.
DA FARE ANCORA: ottenere `NASA_API_KEY` reale dall'utente (ora fallback curato). Poi modelli 3D glTF (ISS/sonde) — solo su build nativa.

### Universe Explorer — NASA API key + Modelli 3D glTF (COMPLETATO)
- **NASA_API_KEY** reale aggiunta in `backend/.env` (fornita dall'utente). `/api/universe/asteroids` ora restituisce dati **LIVE** (`live:true`, es. "2015 NG3" passaggio odierno reale). Fallback curato resta se l'API fallisce.
- **Modelli 3D glTF reali NASA** (dominio pubblico, da `raw.githubusercontent.com/nasa/NASA-3D-Resources/master/...`, CORS-enabled):
  - `universe.ts`: campo `model?` su UObject + costante `MODELS` (iss, voyager, jwst, parker, juno, hubble). ISS e Voyager 1 statici ora hanno `model` + `rep:"model"`.
  - `liveCatalog.ts`: sonde Parker/JWST/Voyager2/Juno hanno `model`.
  - `UniverseScene.tsx`: `useGltf(url)` carica il .glb imperativamente (GLTFLoader esportato da r3f.web/native), normalizza scala (bounding box → targetMax) e centra; `ModelBody` renderizza `<primitive>` con rotazione lenta, **fallback difensivo a `SphereBody` se il modello non carica** (nessun crash). `Body` usa ModelBody quando `o.model` è presente.
- Verificato su web preview: ISS caricata senza errori CORS/crash (raw.githubusercontent CORS-ok). NB: su NATIVE (expo-gl) i modelli con texture embedded potrebbero non decodificare le texture → fallback sfera; la geometria carica. Validazione piena solo su BUILD nativa.
GLTFLoader importato da `three/examples/jsm/loaders/GLTFLoader.js` (three 0.185).

### SESSIONE 6 — Sense review, motore Snapshot condiviso, fix deploy
- **Sense Vision — Scarta/Salva**: dopo lo scatto (`makeSense`) ora si apre un'anteprima; l'utente sceglie **Scarta** (torna alla fotocamera, nulla salvato) o **Salva** (salva in galleria locale → apre il viewer per migliorare/pubblicare). Aggiunto pulsante Galleria (📷→/observations) nella HUD di sense-vision.
- **Galleria "I miei Sense"** (`/observations`): testo aggiornato a Sense Vision + hint "tocca per migliorare/pubblicare, 🗑 per eliminare" (elimina/migliora/pubblica già supportati via viewer).
- **Home**: la card "Overview Sense Universe" ora usa il logo **SenseMark** (come lo shortcut in alto a sinistra) al posto del globo blu.
- **Fix deploy (bug reale)**: `app/universe-explorer.tsx` referenziava ~28 chiavi di stile MAI definite (jCard/jSheet/snapSheet…): rompeva il rendering dei modali Fase 2 e faceva fallire `tsc`. Aggiunti tutti gli stili. Rimosso route morto `app/r3f-test.tsx`. Verificato: `expo export --platform web` OK (anche con heap 2GB), backend importa, `pip install jq` ha wheel. NB: gli errori Cloud Build generici non riconducibili a un problema di codice riproducibile localmente → probabile infra/retry.
- **MOTORE CONDIVISO — `src/components/SnapshotStudio.tsx`** (richiesta utente: ogni Layer → esperienza → contenuto → social): componente riusabile che prende un'immagine catturata da QUALSIASI schermata + metadati e produce una card brandizzata (watermark OVERVIEW/SenseMark, layer, dati reali, fonte, data) con titolo+descrizione editabili, **hashtag automatici**, e azioni **Pubblica come Observation** (`socialApi.createObservation`, ricompone via `captureRef`→base64, fallback al base64 grezzo) + **Salva/Condividi**. Integrato nell'Universe Explorer (sostituisce il vecchio snap modal). Verificato end-to-end su web.
- **DEFERRED nel motore**: annotazioni/disegno/evidenziatore (prossimo incremento, Skia — testabile su device).
- **ROADMAP concordata (sequenza)**: motore Snapshot ✅ → **Satellite Observation (Terra esplorabile, layer multipli, divider confronto, Then/Now continuo, NASA GIBS)** → Meteo Spaziale vivo → Realtà Invisibile immersiva 3D → Timeline viaggio nel tempo (Play). AR = step futuro (build nativa).

### SESSIONE 6b — FASE A: il feed diventa la Home (social al centro)
Richiesta utente: l'app deve aprirsi sul social, non sulla Home tecnica. La Home (griglia strumenti) resta invariata, cambia solo la pagina iniziale + un tasto Home nel feed.
- **Entry point → `/feed`**: `index.tsx` (splash), `login.tsx`, `register.tsx`, `welcome.tsx` (utente + guest), `profile.tsx` (logout) ora vanno a `/feed`.
- **`app/feed.tsx` ristrutturato come Home**: top bar con logo SenseMark + titolo "Overview Sense Universe™" (sinistra), tasti **Home (icona apps → /home griglia strumenti)** + profilo (destra). Rimosso il tasto "back".
- **Live Earth compatta fissa in alto** (`LiveEarth variant="compact" size=132`): sempre in rotazione automatica, solo il globo + hint "Doppio tap per esplorare". Non scorre con il feed.
- **Doppio tap sul globo (o tap sul logo) → Modal Live Earth a tutto schermo** (`variant="full"`) con TUTTI i filtri spostati qui: scope chips (Tutte/Chi seguo/Vicinanze/Oggi/Settimana/…) + categorie/fenomeni + globo interattivo (pan/pinch/lista). La Terra = mappa di navigazione del mondo.
- **FAB "+" Sense Vision** (in basso a destra) → `/sense-vision` (crea → Scarta/Salva/Pubblica).
- `src/components/LiveEarth.tsx`: aggiunta prop `variant: "full"|"compact"` + `onExpand`. In compact: pan/pinch disabilitati, doppio tap → onExpand, chrome nascosto (solo globo + hint).
- Verificato su web (screenshot): feed-Home con Terra viva + eventi verificati + card Sense + FAB; modal Live Earth full con filtri e globo interattivo. Tutto ok.

PROSSIMO (concordato con utente): **FASE B — SnapSense™** (Storie 24h: barra storie con foto profilo, viewer, pubblicazione rapida temporanea; richiede backend nuovo). Poi FASE C personalizzazione feed. Da NON dimenticare (utente: "completare il vecchio, tenere insieme Satellite"): annotazioni/disegno in SnapshotStudio, Satellite Observation (Terra esplorabile NASA GIBS), Meteo Spaziale vivo, Realtà Invisibile 3D, Timeline con Play, AR (futuro).

### SESSIONE 6c — FASE B: SnapSense™ (Storie 24h)
Backend `snapsense.py` (`snapsense_router`, registrato + `ensure_snapsense_indexes` in startup):
- Collezione `snapsenses` {id,user_id,nickname,kind,media_type,has_image,caption,bg_color,source,created_at,expires_at(+24h)}. Immagini in `db.media` (riuso `/api/media/{id}`).
- `POST /api/snapsenses` (auth): image_base64 o testo, kind∈photo/sense/satellite/universe/timeline/invisible/spaceweather/audio/text; moderazione immagini utente (salta per satellite/dati). `GET /api/snapsenses` (pubblico): gruppi attivi per autore (con avatar, propria ring per prima). `DELETE /api/snapsenses/{id}` (owner).
- Campo utente avatar = `avatar` (NON avatar_url) — corretto.
Frontend `src/components/SnapSenseBar.tsx` (nel feed, tra Terra fissa e contenuti):
- Barra ring orizzontale: ring "SnapSense +" (crea) + ring per autore (avatar o iniziale, bordo oro).
- **Viewer** full-screen: progress bar per item, auto-advance 5s, tap sinistra/destra per navigare tra item e autori, header autore+tempo+chiudi, elimina (se proprio).
- **Creazione**: Fotocamera / Galleria (expo-image-picker + manipulate→base64) / Testo (con swatch colori sfondo) + scorciatoia Sense Vision. Gestione permessi contestuale.
- API in `backend.ts`: `snapSenseApi.list/create/remove` + tipi SnapItem/SnapGroup.
- Verificato: backend curl (login→create testo→list OK); web screenshot (barra ring nel feed + viewer che mostra la storia testo "Sto osservando il cielo stellato da Milano"). Creazione foto (camera/galleria) richiede auth+device per test pieno; testo verificato e2e.

FATTO in questa sessione: Fase A (feed=Home) + Fase B (SnapSense). PROSSIMO: Fase C (personalizzazione feed) e le voci "vecchie" (SnapshotStudio annotazioni/disegno, Satellite Observation NASA GIBS, Meteo Spaziale vivo, Realtà Invisibile 3D, Timeline Play, AR futuro).

### SESSIONE 6d — autonomia: Studio→SnapSense, personalizzazione feed, layer satellitari
- **SnapshotStudio → SnapSense**: aggiunto pulsante "SnapSense 24h" nello SnapshotStudio (pubblica lo snapshot brandizzato come Storia via `snapSenseApi.create`). Nuovo campo `snapKind` in SnapshotInput (Universe Explorer passa "universe"). Ogni esperienza → contenuto → social/storia in un tap.
- **FASE C — personalizzazione feed** (`social.py /feed`, sort smart): costruito profilo interessi del viewer da ciò che PUBBLICA (peso 2×), salva e con cui interagisce (categorie), normalizzato; nuovo termine `aff` (affinità) nello smart_score (pesi ribilanciati: sv .34, aff .22, rare .16, recency .16, pop .10, prox .02). Non tocca il feed anonimo. Verificato (nessun crash, items OK).
- **Satellite Observation +3 layer reali** (verificati via GetSnapshot): Aerosol (MODIS_Terra_Aerosol), Nuvole (MODIS_Terra_Cloud_Fraction_Day), Temperatura mare (GHRSST_L4_MUR_SST). Overlay compositi (incendi/pioggia su base) NON affidabili via endpoint snapshot → rimandati alla fase Satellite dedicata.
- Smoke test feed-Home OK: logo+Home/profilo, Terra fissa che ruota, barra SnapSense, eventi verificati, card, FAB.

RIMANE (fase Satellite dedicata + altro): Terra satellitare esplorabile/zoomabile con divider di confronto e Then/Now continuo; SnapshotStudio annotazioni/disegno (Skia); Meteo Spaziale vivo; Realtà Invisibile 3D immersiva; Timeline con Play; AR (futuro, build nativa).

### SESSIONE 6e — Satellite Observation ESPLORABILE (nuova schermata)
`app/satellite-explore.tsx` (Home card "satellite" ora punta qui; link alla vecchia `satellite-observe` per Analisi AI):
- **Terra esplorabile** su immagini NASA GIBS (GetSnapshot): pan (trascina), pinch, doppio-tap zoom, pulsanti +/-/locate. Gesti via react-native-gesture-handler + runOnJS→state (come LiveEarth). 8 livelli di zoom (DELTAS 60°→0.5°): a ogni cambio ricarica l'immagine più dettagliata per la nuova bbox/centro. Readout coordinate+zoom.
- **Layer multipli** (chips): True Color, HD, False Color, Notte, + Aerosol/Nuvole/Temperatura mare (verificati). Descrizione per layer.
- **Confronto con DIVISORE MOBILE**: toggle "Confronta due layer" → seconda immagine (secondo layer) clippata a sinistra del divisore, handle trascinabile (Gesture.Pan) per spostare lo split, tag per lato. VERIFICATO (Termico ↔ True Color).
- **Then / Now**: slider temporale custom (Gesture.Pan) 0→60 giorni fa, label data live, commit al rilascio → ricarica.
- **Snapshot → SnapshotStudio**: scarica l'immagine corrente in base64 (FileSystem.downloadAsync) e apre lo Studio (snapKind "satellite", socialSource "satellite") → Pubblica Observation / SnapSense / Salva.
- Verificato su web (screenshot): esplorazione, cambio layer, confronto con divisore, Then/Now, tutto ok.

RIMANE: SnapshotStudio annotazioni/disegno (Skia); Meteo Spaziale vivo; Realtà Invisibile 3D immersiva; Timeline con Play; AR (futuro). Nota: tile compositi (fires/rain su base) non affidabili via endpoint snapshot → eventuali overlay in futuro con approccio WMTS/tile.

### BACKLOG (richiesta utente, da pianificare) — 🎵 COLONNA SONORA ai Sense (audio multisensoriale)
Obiettivo: ogni Overview Sense (pubblicazione) e ogni SnapSense può avere musica/suono/audio associato. L'audio è parte integrante dell'esperienza, non accompagnamento. Overview = primo social di esperienze reali multisensoriali (immagini + dati reali + posizione + descrizione + suono).
Schermata selezione audio (riusabile in SnapshotStudio, feed publish e SnapSense), sezioni in ordine:
- **🎵 Sense Match™ (prima sezione)**: l'AI suggerisce tracce coerenti col Sense creato (mappa categoria/scena→mood): cielo stellato→ambient/cinematografico; aurora→elettronica rilassante; temporale→intenso; tramonto→chill/acustica; universo→orchestrale/ambient/sci-fi; mare→onde/piano/lo-fi. Utente sempre libero di scegliere altro.
- Consigliati · Tendenze · Più utilizzati · Nuove uscite · In evidenza · Preferiti · Brani salvati · **Ricerca** (titolo/artista/album/genere).
- **Trim**: scelta del punto d'inizio esatto e durata del segmento (come i social principali).
Sorgenti audio supportate oltre alla musica:
- registrazioni audio personali; **SoundSense** (paesaggi sonori registrati dall'utente); suoni ambientali reali; **sonificazioni dei dati** generate da Overview (quando disponibili).
Stesso sistema per Overview Sense e SnapSense.
DECISIONE NECESSARIA PRIMA DI COSTRUIRE: fonte musicale. La musica commerciale (tipo IG/TikTok) richiede licensing costoso/complesso; alternative realistiche = librerie royalty-free/Creative Commons (es. Free Music Archive, Jamendo, Pixabay Music) + audio utente + SoundSense + sonificazione dati. Da confermare con l'utente al momento della build.
Note tecniche: usare `expo-audio` (playback) e `expo-audio`/recording per SoundSense; storage audio come i media (base64/GridFS) con durata/trim (start,dur) salvati sull'Observation/SnapSense; player nelle card del feed e nel viewer SnapSense; autoplay muto+tap per audio come i social. Testabile a pieno su build nativa.

### BACKLOG/IN CORSO — Satellite Intelligence come ESPERIENZA DI VIAGGIO (richiesta utente)
Visione: non consultare mappe, ma "avere la sensazione di esserci". Esplorazione libera (muovi/zoom progressivo al max dettaglio reale/trascina/ruota/cambia layer/dati/crea).
- **Senshot™** (non screenshot): scatto generato da Overview, immagine pulita senza UI, pronta a condividere, con: nome luogo, coordinate, data/ora, satellite usato, layer applicati, dati scientifici, watermark Overview, eventuali Sense Layers + descrizione emozionale. (Implementato come evoluzione dello Snapshot in satellite-explore → SnapshotStudio con metadati arricchiti + reverse-geocode nome luogo + nome satellite.)
- **Satellite Journey™**: l'utente sceglie un punto del pianeta; Overview anima un volo cinematografico fino alla destinazione (zoom-out → pan → zoom-in). All'arrivo: esplora, zoom, cambia layer, Sense Vision, Senshot, pubblica.
- **Onestà del dettaglio**: mai inventare dettagli. Mostrare la risoluzione realmente disponibile + fonte + satellite + data acquisizione + limitazioni.
- **Futuro**: architettura predisposta ad aggiornare le immagini automaticamente quando nuovi passaggi satellitari rendono disponibili acquisizioni più recenti (auto-refresh su nuova disponibilità GIBS).

### VINCOLO GLOBALE (utente): tutte le fonti dati/media/servizi devono essere SEMPRE GRATUITE (si possono usare più fonti free combinate). No servizi a pagamento/licenze commerciali. Es. ok: NASA GIBS, Open-Meteo, NOAA, expo-location OS geocoder, OSM/Nominatim (rispettando policy), musica royalty-free/CC (FMA/Jamendo/Pixabay). Musica commerciale (IG/TikTok-style) = NO.

### SESSIONE 6f — Satellite: Senshot™ + Satellite Journey™ (IMPLEMENTATO E VERIFICATO)
`app/satellite-explore.tsx`:
- **Senshot™** (ex Snapshot): scatto pulito via SnapshotStudio con metadati arricchiti — **nome luogo** (reverse-geocode gratis via expo-location, fallback coordinate), **satellite** (derivato da layer: MODIS Terra/Aqua, VIIRS Suomi NPP, GHRSST), coordinate, data acquisizione, zoom, watermark Overview. snapKind "satellite". Hashtag #Senshot.
- **Satellite Journey™**: modale con ricerca (expo-location geocodeAsync gratis, fallback lista) + 10 destinazioni iconiche reali. `journeyTo()` = volo cinematografico: zoom-out al mondo → pan interpolato (easeInOut, 9 step) → discesa progressiva zoom 1→5, overlay "volo in corso". Verificato: Journey→Venezia (mondo z1 → z6 dettaglio).
- Onestà risoluzione: nota su fonte/satellite/data, nessun dettaglio inventato. Tutte fonti GRATUITE (NASA GIBS, OS geocoder).
- Cleanup timer su unmount. Lint/tsc clean. Home card "satellite" → questa schermata; link ad Analisi AI classica.
FUTURO (predisposto): auto-refresh immagini su nuovi passaggi satellitari; rotazione (non significativa su imagery 2D piatta, valutare globo 3D).

### SESSIONE 7 (fork) — Sense: gesture universali Pure/Reality + Layer contestuali + ritocchi card

Richiesta utente: la foto deve restare protagonista; ogni Sense deve avere due anime raggiungibili con un gesto.

**Standard gesture universale — `src/components/SenseSurface.tsx` (NUOVO, riutilizzabile):**
- Doppio tap -> Pure Sense(TM): il Senshot a schermo intero (Modal nero, contentFit:contain), nessuna UI/dato/layer; secondo doppio tap torna. Flash brandizzato ~650ms (SenseMark + "Pure Sense") con ZoomIn/FadeOut (reanimated).
- Tap singolo -> Reality Sense(TM): mostra/nasconde TUTTI i Sense Layer (overlay dati/watermark) con transizione fluida FadeIn/FadeOut. Flash "Reality Sense" quando si attivano.
- Gesti via react-native-gesture-handler Gesture.Exclusive(doubleTap, singleTap) (callback su JS thread). layersVisible controllato dal parent.
- Integrato in app/observation.tsx (viewer Sense principale, dentro il ViewShot per l'export) e app/observation-detail.tsx (viewer feed remoto). Verificato su web: badge dati HUD, hint gesture, tap singolo nasconde i dati (Pure).

**Sense Layer dinamici e contestuali (AI):**
- Backend ai_features.RECOGNIZE_SYSTEM: aggiunte categorie soggetto mountain, forest, city (+ water=mare/lago).
- src/lib/senseLayers.ts: SUBJECT_LAYERS riscritto per persona/cielo/mare/montagna/foresta/citta. Nuovi DATA_LAYERS onesti: Altitudine (d.altitude), Posizione (d.lat/lon). orderedDataLayers(d, recData) ordina i layer disponibili secondo il soggetto: primi 2-3 mostrati diretti, gli altri sotto "Mostra tutti i Sense Layer (N)".
- observation.tsx: auto-attiva solo i primi 3 layer consigliati disponibili; sezione chips con espansione showAll.

**Ritocchi grafici card Senshot (observation.tsx):**
- Fascia watermark inferiore piu sottile (gradient trasparente->nero, padding ridotto, font piu piccoli).
- QR ridotto 44->30px. Badge dati stile HUD/AR (sfondo translucido, bordo oro + accento oro a sinistra, valore monospace).

NOTA onesta: i data-layer compaiono solo se il valore reale esiste (maree/UV/vegetazione non presenti -> non mostrati).

RIMANE: standard gesture sulla card scrollabile del feed (ObservationCard) se desiderato; SnapshotStudio annotazioni/disegno (Skia); Meteo Spaziale vivo; Realta Invisibile 3D; Timeline con Play; Colonna sonora (Sense Match, royalty-free); AR (build nativa).

### SESSIONE 7b (fork) — Pure Sense immersive gallery + REGOLA "LOOK UP / GO INSIDE"

**FATTO — Immersive swipe in Pure Sense (SenseSurface):** props gallery[] + initialIndex. In Pure Sense, swipe verticale (Gesture.Pan) naviga tra i Senshot recenti della community (translateY + opacity, reanimated); contatore "n / N"; doppio tap chiude. observation-detail costruisce la gallery da socialApi.feed(sort=recent) con l'obs corrente come indice iniziale. Verificato su web (Pure Sense + counter 3/3 + swipe hint).

**NUOVA REGOLA FONDAMENTALE UTENTE (da implementare, in coda):**
"Cambia cio che possiamo vedere, non cio che possiamo fare." Overview non deve solo dire DOVE guardare, deve permettere di ANDARCI.
Ogni oggetto / fenomeno / luogo indicato dall'app deve SEMPRE offrire una struttura di scheda coerente in tutta l'app:
- LOOK UP: osserva dalla tua posizione ora (fotocamera + cielo reale + bussola + GPS + sensori + costellazioni/satelliti/pianeti). = sense-vision / invisible-observe attuale (resta come UNA delle opzioni, non l'unica).
- GO INSIDE: esperienza immersiva dedicata all'oggetto (muoversi, ruotare, pinch-zoom, avvicinarsi/allontanarsi, selezionare oggetti, schede, immagini reali, distinguere foto/mosaici/ricostruzioni/arte, Sense Layers, Manual Explore o Guided Journey, Senshot, descrizione, publish). Per la Via Lattea: entrare nella galassia ricostruita (universe-explorer scala Via Lattea) con trasparenza scientifica (non fingere una foto esterna della nostra galassia). Fonti: cataloghi stellari, coordinate reali, NASA/ESA/Gaia/SIMBAD, mappe cielo, modelli 3D, ricostruzioni dichiarate.
- Guided Journey, Senshot, Add Description, Publish to Overview Sense Universe.
Vale ovunque: stella/pianeta/luna/nebulosa/galassia/satellite/luogo terrestre/evento atmosferico/fenomeno invisibile.
Piano suggerito: componente riusabile SenseActionBar (LOOK UP / GO INSIDE / Guided Journey / Senshot / Add Description / Publish) da inserire in opportunity.tsx, cosmic-object.tsx, e schede oggetto; routing: LOOK UP -> sense-vision; GO INSIDE cosmico -> universe-explorer con fly-to alla scala/oggetto; GO INSIDE terrestre -> satellite-explore Journey; Senshot -> SnapshotStudio. Trasparenza rappresentazione (photo/mosaic/reconstruction/art) sempre etichettata.

### CODA — Principio "DOCUMENTED REALITY" (utente, da fare)
Ovunque l'umanita sia arrivata e ne esista una testimonianza reale/attendibile (foto, video, audio, scansioni 3D, ricostruzioni scientifiche, dati certificati) Overview deve renderla esplorabile: fondo oceano, Everest, interno piramidi, ISS, Marte, Luna, Via Lattea, Foresta Amazzonica, citta da satellite, relitti profondi. L'utente puo esplorare/muoversi/osservare/imparare/fermarsi/Senshot/raccontare/condividere. Missione: "Se l'umanita ci e arrivata, tu puoi viverlo. Se puoi viverlo, puoi Senshottarlo." Il Senshot = ricordo di un luogo realmente esplorato anche senza esserci stati fisicamente.

### CODA — Principio "SENSHOT = PUNTO DI VISTA" + azione "Go There" (utente, da fare)
Due persone che osservano lo stesso oggetto creano Senshot DIVERSI: il Senshot rappresenta il punto di vista dell'osservatore, non solo l'oggetto. Ogni Senshot deve SALVARE automaticamente il viewpoint: coordinate luogo/oggetto, posizione camera, orientamento, zoom, FOV, layer attivi, data/ora, dati scientifici. Aprendo un Senshot altrui: 
- View Senshot: mostra solo l'immagine.
- Go There: Overview ricrea ESATTAMENTE il punto di osservazione originale e porta l'utente li (virtualmente) per osservare/esplorare/cambiare inquadratura/continuare il viaggio/creare un nuovo Senshot diverso. 
"Instagram salva immagini. Overview salva luoghi, prospettive ed esperienze." Ogni Senshot e un invito: "Vieni a vedere cio che ho visto io... oppure continua il viaggio da qui."
NOTA IMPL: universe-explorer deve accettare deep-link con viewpoint completo (scale, focus/objectId, az, pol, rad/zoom); il Senshot dell'universe salva gia questi valori in data{} -> "Go There" diventa fattibile. In corso di predisposizione durante LOOK UP/GO INSIDE.

### SESSIONE 8 (fork) — LOOK UP / GO INSIDE (Fase 1-3, FATTO e verificato)
- Nuovo componente riusabile src/components/SenseActionBar.tsx: "VIVI QUESTA REALTA" con 2 azioni principali LOOK UP (osserva da qui, ora) + GO INSIDE (entra ed esplora) + chip Guided Journey / Senshot (render solo se handler passato). Nota: dati spiegano, camera osserva, esplorazione fa vivere, Senshot conserva.
- universe-explorer.tsx: aggiunto deep-link useLocalSearchParams { focus, scale, journey, az, pol, rad }. focus matcha per id o cosmicId su tutte le scale e imposta scale+target+viewpoint; journey avvia il Guided Journey; ripristina az/pol/rad se forniti (base per "Go There").
- universe Senshot: data.viewpoint { focus, scale, az, pol, rad } salvato -> predisposto per "Go There".
- opportunity.tsx: sostituito "Crea Observation" con SenseActionBar. Routing: LOOK UP->/cielo; GO INSIDE cosmico->/universe-explorer?focus=<cosmicId> (milkyway/moon/iss/pianeti IT->id, sky/universe->milkyway), terrestre (earth/solar)->/satellite-explore; Guided Journey per Via Lattea->journey=inside-milkyway.
- cosmic-object.tsx: SenseActionBar dopo la descrizione; GO INSIDE->universe-explorer?focus=obj.id; journeyForObject() mappa oggetto->viaggio guidato.
- Verificato (screenshot, NO test agent): /universe-explorer?focus=milkyway apre Scala 3 Via Lattea con label trasparenza "Ricostruzione scientifica"; SenseActionBar visibile su cosmic-object Via Lattea (LOOK UP + GO INSIDE + Guided Journey).

RIMANE (coda aggiornata): estendere SenseActionBar a satellite-explore/oggetti terrestri e schede satellite; azione "Go There" completa (View Senshot vs Go There nel viewer, ricrea viewpoint da data.viewpoint); principio DOCUMENTED REALITY (luoghi documentati: oceano/Everest/piramidi/ISS/Marte/Amazzonia/relitti); Senshot=punto di vista ovunque (salvare viewpoint anche in sense-vision/satellite); Meteo Spaziale vivo; Realta Invisibile 3D; Timeline Play; annotazioni Skia; colonna sonora Sense Match; AR.

### SESSIONE 9 (fork) — "Go There" (Senshot = punto di vista) FATTO e verificato
- observation-detail.tsx: nuova sezione "Questo Senshot e un punto di vista" con View Senshot (immagine, gia mostrata) + Go There (ricrea il viewpoint originale). goThereRoute(d) costruisce la rotta da obs.data: universe -> /universe-explorer?focus&scale&az&pol&rad; satellite -> /satellite-explore?lat&lon&zoom&layer. Frase invito utente inclusa.
- satellite-explore.tsx: deep-link useLocalSearchParams { lat, lon, zoom, layer } applicato al mount (centro/zoom/layer). Aggiunto zoom nei data del Senshot satellitare.
- universe-explorer gia salvava data.viewpoint (sessione 8) e accetta az/pol/rad.
- Verificato (screenshot): /universe-explorer?focus=milkyway -> Scala 3 Via Lattea; /satellite-explore?lat=27.99&lon=86.93&zoom=5&layer=VIIRS... -> Everest z6 True Color HD. Il bottone Go There compare solo per Senshot con viewpoint (universe/satellite nuovi); onesto per i vecchi senza dati.

RIMANE: DOCUMENTED REALITY (luoghi documentati esplorabili); estendere SenseActionBar a satellite/luoghi terrestri + salvare viewpoint anche in sense-vision; Meteo Spaziale vivo; Realta Invisibile 3D; Timeline Play; annotazioni Skia; colonna sonora Sense Match; AR.

### SESSIONE 10 (fork) — Crash fix + P1/P2/P3 (FATTO)
- FIX P0 crash iOS: universe-explorer.tsx gesti Pan/Pinch/Tap con .runOnJS(true) (i callback mutavano ref JS sul thread UI). Da verificare su build TestFlight.
- sense-vision.tsx: riga LOOK UP/GO INSIDE (GO INSIDE -> /satellite-explore su lat/lon attuali, zoom 6). Senshot salva from:"sense-vision" -> goThereRoute apre il luogo dall'alto.
- Meteo Spaziale vivo: nuovo SpaceWeatherLive.tsx (Sole pulsante+flare, vento solare animato dai km/s reali NOAA, magnetosfera colorata dal Bz, aurore da Kp). In cima a meteo-spaziale.tsx.
- Naming: "OverView" ovunque (O e V maiuscole). Linguaggio icone: anello "O" (icon-ring.png) = social feed "OverView Sense Universe" (OverviewShortcut in ogni sezione via ScreenHeader + universe/sense-vision; icona feed in home e header feed); SenseMark (occhio) = Sense Vision (top-left home -> /sense-vision, icona card Sense Vision). Galleria Senshot in home (icona images -> /observations).
- Realta Invisibile 3D: nuova route app/invisible-3d.tsx — campo magnetico (anelli animati, azimuth+intensita reali), vettore gravita, particelle, griglia prospettica che si inclina coi sensori, bussola; toggle Magnetico/Gravita/Particelle; Senshot (captureRef) via SnapshotStudio; from:"invisible-3d" per Go There. Ingresso da realta-invisibile.tsx.
- Timeline con Play: app/timeline.tsx modalita Play (time-lapse) con velocita 1min/15min/1ora/6ore per secondo + cupola celeste (SkyDome) che anima gli oggetti nel cielo.
- Annotazioni Skia: SnapshotStudio.tsx overlay Skia Canvas (Gesture.Pan runOnJS) — penna 5 colori, undo, clear; disegno incluso nell'immagine catturata; SOLO native (web nascosto), bundle web sicuro.
- Colonna sonora Sense Match: 6 loop bundlati (48s) royalty-free — NASA Voyager (pubblico dominio: cosmos/rings/magnetic/deepfield) + Calm Pills CC0 (calm/meditation) in assets/audio/. src/lib/senseMatch.ts (match per keyword) + src/components/SenseMatchBar.tsx (play/pausa loop, licenza mostrata, cambio traccia). Integrato in observation-detail (usa data.senseTrack dell'autore) e SnapshotStudio (salva senseTrack). expo-audio; playback background solo su build nativa.
- Verificato via screenshot (NO test agent, per volere utente): universe render, meteo vivo, home (OverView + O + galleria), header sezioni con O, invisible-3d, timeline Play, SnapshotStudio con Sense Match.

RIMANE: DOCUMENTED REALITY (Marte/ISS/oceano/Everest esplorabili con Go Inside+Senshot); AR per Realta Invisibile (build nativa); FFT audio reale (modulo nativo); QR deep-link post-deploy.

### SESSIONE 11 (fork) — Filosofia "Beyond View" + Sense Vision Pro + Satellite fluido
- FILOSOFIA UFFICIALE: OverView non inventa mai dettagli inesistenti; massimizza i dati reali e, quando mancano, usa la migliore ricostruzione scientifica CHIARAMENTE indicata; transizioni invisibili; mondo unico continuo; obiettivo finale = UN solo Explorer (Terra, Sistema Solare, Luna, pianeti, galassie…) con un solo sistema di movimento/zoom/Senshot. "OverView non deve inventare di più, deve permettere di vedere di più".
- SENSE VISION PRO (FATTO, testabile solo su BUILD NATIVA): migrato da expo-camera a react-native-vision-camera v4.7.2. Nuovo src/components/CameraPro.native.tsx: tap-to-focus (focus ring), esposizione trascinando in verticale, blocco AF/AE (long-press o pulsante), zoom fluido/ottico (device.min/neutral/maxZoom, pinch runOnJS), cattura alla MASSIMA risoluzione (useCameraFormat photoResolution max + photoQualityBalance quality). Enhancement REALE via Skia (unsharp mask RuntimeEffect + contrasto locale) con supersampling da full-res a long-edge 2600 → nessun dettaglio inventato; toggle "Osserva meglio". CameraPro.web.tsx = placeholder (VisionCamera non gira su web/Expo Go). app.json: aggiunto config plugin react-native-vision-camera. Stacking multi-frame = FASE 2.
- SATELLITE (FASE 1 FATTO): eliminati i frame neri durante pan/zoom. Causa: <Image key={nowUrl}> ri-montava l'immagine ad ogni movimento. Fix: rimosso key + doppio buffer (strato readyUrl persistente sotto + nuovo nowUrl in crossfade transition 260ms, onLoad aggiorna readyUrl) → esplorazione continua senza schermate nere.
- La Terra 3D texturizzata ESISTE GIÀ in universe-explorer (src/lib/universe.ts, id "earth", texture Solar System Scope CC BY). FASE 2 Satellite: riusare QUESTO globo come Explorer unico continuo (stilizzato → ricostruzione NASA Blue Marble/nuvole/luci notturne/atmosfera → transizione invisibile ai tile reali NASA GIBS in zoom alto), Senshot ovunque (ricostruzione etichettata vs dato reale). Stesso principio per tutte le sezioni.

RIMANE: Satellite FASE 2 (globo unico continuo + morph invisibile a GIBS); camera stacking multi-frame + HDR; Documented Reality (Marte/ISS/oceano/Everest); estendere "mondo continuo" a Universo/Luna/pianeti/galassie; AR; FFT audio reale.

### SESSIONE 11b — Satellite Fase 2 (Explorer unico) + Camera HDR
- SATELLITE FASE 2 (FATTO): nuovo app/earth-explorer.tsx + src/components/EarthGlobe.tsx che RIUSA il motore r3f/expo-gl dell'Universo. Globo Terra continuo: texture NASA/Solar System Scope Blue Marble (CC BY) + nuvole + atmosfera fresnel, rotazione auto (idleSpin), pan/pinch/double-tap fluidi (runOnJS true), etichetta livello (Orbita→Ricostruzione 3D→Regione→Superficie). Senshot via GL snapshot (from:"earth-explorer", ricostruzione etichettata). Handoff: zoom alto (rad<=1.34) o pulsante "Immagini satellitari reali" → crossfade veil → push a /satellite-explore su lat/lon del punto sub-satellite (calibrazione lon approssimata, da rifinire). Home card "Satellite Observation" e Go There ripuntati a /earth-explorer.
- NB: su web la texture Solar System Scope a volte carica lenta (fallback blu); su device carica sempre.
- CAMERA (FATTO parziale): abilitati photoHdr (se format.supportsPhotoHdr) e lowLightBoost (se device lo supporta) su CameraPro.native — fotografia computazionale nativa REALE. Stacking multi-frame con allineamento = RINVIATO (rischioso senza test su device; farlo quando testabile).

RIMANE: Satellite calibrazione lon sub-point + (ideale) morph GIBS on-sphere realmente inline; camera stacking multi-frame allineato; estendere Explorer continuo a Luna/pianeti/galassie con stesso paradigma; Documented Reality (Marte/ISS).

### SESSIONE 11c — Fix Terra 3D + effetto sole
- FIX CRITICO: la Terra appariva sfera vuota (texture remote solarsystemscope bloccate da CORS in WebView). Ora texture NASA Blue Marble BUNDLATE localmente in assets/textures/ (earth_day.jpg 2048x1024 da NASA eoimages world.topo.bathy pubblico dominio; earth_night.jpg luci città NASA). Caricate via expo-asset (downloadAsync→localUri, corretto per device) con fallback resolveAssetSource. TRUCCO CHIAVE: <mesh key={day?...}> remount al caricamento texture → risolve texture "piatta" in r3f su web.
- EFFETTO SOLE REALISTICO: directionalLight sul punto SUBSOLARE reale (sunDirection da data/ora UTC: declinazione + ora) + luci notturne (emissiveMap) sul lato buio + atmosfera → terminatore giorno/notte realistico. Verificato su web: continenti+oceani+terminatore+luci città visibili.
- earth-explorer resta la schermata Satellite fullscreen (manovrabile/zoomabile, → GIBS reale a zoom alto, Senshot sempre).

RIMANE (richieste utente non ancora fatte): (1) schermata Satellite principale con layout "card" (foto 3: controlli+layer+Then/Now) col globo dentro, doppio-tap→fullscreen; (2) effetto sole/terminatore anche nel globo SOCIAL (LiveEarth, SVG); (3) calibrazione fine longitudine sub-point handoff; (4) morph GIBS inline sulla sfera; (5) camera stacking multi-frame; (6) Explorer continuo per Luna/pianeti/galassie; Documented Reality Marte/ISS.

### SESSIONE (fork) — Sense Vision Pro camera + Assistente Visivo (P0, 2026-07-14)
- **CameraPro Pro** (`src/components/CameraPro.native.tsx`, VisionCamera v4.7.2): device virtuale multi-lente (ultra-wide→wide→tele via `physicalDevices`) per range ottico reale ultra-grandangolo→Super Macro (macro automatica su lente ultra-wide). Preset zoom pill (.5×/1×/2×/3×/5× costruiti dalle lenti reali, label onesta relativa al 1× wide), indicatore MACRO, reset del punto di fuoco quando lo zoom cambia molto (AF/AE continuo riprende), tap-to-focus, blocco AF/AE. maxZoom cappato a 32 (no zoom digitale che "inventa" dettaglio). Sharpen/local-contrast Skia reali invariati.
- **Assistente Visivo** (`app/visual-assistant.tsx` NUOVO): flusso Inquadra → Comprendo → Senshot. Camera live → "COMPRENDO" cattura frame + costruisce fatti REALI (bussola, inclinazione, magnetico, posizione, meteo, Sole/Luna, Kp, ISS) → `POST /api/ai/see` (gpt-5.4 vision) spiega la scena SOLO con dati reali/visibili (mai inventa) → "Crea Senshot" salva l'Observation con `aiNote` allegata. Entry point in `assistant.tsx` (card dorata + icona occhio nella input bar).
- Backend `ai_features.see` + `api.see`/`postJson` in `api.ts`; `ObsData.aiNote`; `observation.tsx` usa `aiNote` diretta (no re-fetch AI) se presente.
- Verificato: `/api/ai/see` via curl (JPEG reale → spiegazione rigorosa, rifiuta di inventare); lint pulito; screenshot assistant (CTA visibile) + visual-assistant (gate camera, no crash). Camera Pro (AF/AE/zoom/macro) verificabile SOLO su BUILD nativa TestFlight (non Expo Go/web).

### SESSIONE (fork) — Home ridisegnata "che respira" + barra navigazione fissa (2026-07-14)
Richiesta utente (con mockup ispirazione): Home meno invasiva, colpo d'occhio immediato, + tab bar iOS-style ovunque.
- **Home** (`app/home.tsx`): due card affiancate compatte in alto — **Sense Vision** (mostra l'ultima immagine galleria/pubblicata come sfondo, funzione invariata, → /sense-vision) + **OGGI/Today's Opportunities** (conteggio + top item + "Vedi tutte") via nuovo `src/components/HomeTopCards.tsx`. Griglia "ACCENDI UNO STRATO DELLA REALTÀ" ridisegnata a **card essenziali orizzontali** (icona/mini-viz a sinistra + overline + titolo + teaser breve statico, niente più caption dati-live). Rimossi dalla Home: SenseVisionCard grande, TodayCard, ObservationOfTheDay (decluttering). Rimossa card "Sense Vision" dalla griglia (è già hero + centro barra).
- **Barra di navigazione fissa** `src/components/BottomNav.tsx` (BlurView, galleggiante, evidenzia tab attiva via usePathname): 🏠 Home · 💬 Messaggi(DM) · ✨ Make a Sense (centro, SenseMark, elevato → /sense-vision) · 🪐 Universe(/feed) · 🔔 Attività(/activity). Inserita in home, feed, observations, profile, activity, messages. Feed: rimosso il FAB "+" (ridondante col centro Make a Sense).
- **Attività** (`app/activity.tsx` + backend `GET /api/activity`): mostra le interazioni REALI ricevute sulle proprie Observation (observed/discovery/learned), commenti e nuovi follower; avatar+nickname reali, tempo relativo, tap → observation-detail o profilo. Login-gate se non autenticato.
- **Messaggi** (`app/messages.tsx`): placeholder "Presto disponibile" (DM da implementare).
- FUTURO (richiesto dall'utente): "Centro di controllo" nel profilo per personalizzare le voci della barra; Direct Message reali.
- Verificato: lint pulito, `/api/activity` via curl (200, items), screenshot Home/Feed/Attività (render corretto, tab bar attiva, nessun crash). Backend `social.import` OK.

### SESSIONE (fork) — Social maturity: Profili, Observers/oViewers, Feedback, Creator Console, Direct Message (2026-07-14)
FASE 1 — Identità: profili con display_name + fino a 3 link (tappabili), stats rinominate **Observers**(chi segui)/**oViewers**(chi ti segue), tab profilo **Senshot / SnapSense / Salvati** (VideoSense = "presto"). Backend: `public_user`/`get_profile`/`ProfileUpdate` estesi (display_name, links). PRIVACY CREATOR: rimosso ogni badge Creator/Founder/Admin (`DEVELOPER_BADGE=None`, `verified_badge=None`); `role=developer`+`protected` restano SOLO server-side. get_profile non espone più role/verified_badge.
FASE 2 — `backend/feedback.py`: `POST /api/feedback`, `GET /api/feedback/mine`; Creator-only (guard `get_creator` → 404 per tutti gli altri): `GET /api/creator/feedback`, `PATCH /api/creator/feedback/{id}`, `GET /api/creator/stats`. Frontend: `app/feedback.tsx` (tutti), `app/creator.tsx` (solo NeoMorpheus, statistiche+gestione feedback/priorità/note/stato). Entry point in profilo (is_me): "Feedback" sempre, "Console" solo se role=developer.
FASE 3 — `backend/dm.py` (polling): conversations + dm_messages. `POST/GET /api/conversations`, `GET/POST /api/conversations/{id}/messages`, `/read`, `POST /api/messages/{mid}/compare`. **Senshot condiviso**: msg kind="compare" con snapshot self-contained (subject, immagine, ts, lat/lon, sun/moon, camera) di entrambi gli osservatori; l'altro utente aggiunge il proprio con "Aggiungi il tuo". Frontend: `app/messages.tsx` (lista conversazioni + unread), `app/chat.tsx` (polling 4s, testo, condivisione Senshot, Senshot condiviso a due colonne), pulsante "Messaggio" nei profili altrui. Tutto verificato via API (localhost, l'URL esterno è dietro Cloudflare che blocca urllib) + screenshot UI (profilo, Creator Console, chat con confronto Luna).

### PROSSIMO GRANDE BLOCCO (richiesto dall'utente, da fare DOPO le fasi) — Sense Vision "la miglior fotocamera" + OverView Guide™
Filosofia: "Oltre la Vista" — mai inventare, mostrare il massimo reale. Zoom con mini-radar >20x; stabilizzazione adattiva; focus affidabile (AF rapido, tap-to-focus, focus manuale, ritorno fuoco post-zoom); fotografia computazionale (multi-frame, denoise, sharpening, HDR, stacking); modalità specializzate auto (cielo/Luna/pianeti/macro/persone/documenti…); macro spinta ~"microscopio"; UI che cambia con lo zoom; identità visiva unica riconoscibile. OverView Guide™: prompt testo/microfono ("Portami su Giove", "Trova il Colosseo") → guida in tempo reale con messaggi trasparenti + indicatore circolare dorato che si restringe → passa il controllo a Sense Vision per il miglior Senshot. La maggior parte richiede build nativa (VisionCamera/ML) — non testabile su Expo Go/web.

### SESSIONE (fork) — OverView Guide™ + Sistema di guida Sense Vision (increment 1, 2026-07-14)
Approvato: partenza parallela Sense Vision Pro + OverView Guide; radar/anello progettati come SISTEMA DEFINITIVO di guida (non grafica temporanea); testo + microfono subito.
- **`src/lib/guidance.ts`** (motore, dati reali): azDelta, computeGuidance (dAz/dAlt, angularDist, proximity 0..1, stati searching/approaching/locked/tracking, hint IT, recommendedZoom per tipo), bearingTo/distanceKm/elevationTo per target terrestri.
- **`src/components/SenseStatusRing.tsx`**: anello dorato distintivo — reticolo convergente che riflette in tempo reale lo stato (ricerca/aggancio/tracking + label AF/AE/STABILIZZO). Reanimated+SVG. Architettato per crescere.
- **`src/components/SenseRadar.tsx`**: radar intelligente — modalità zoom (riquadro 1× + rettangolo dorato area osservata) e modalità guida (bussola con direzione del target relativa a dove punti). Integrato in `CameraPro.native` (compare automaticamente >20×).
- **OverView Guide** (`app/overview-guide.tsx`): input testo + **microfono** (registra→Whisper `POST /api/ai/guide/transcribe`); risoluzione target `POST /api/ai/guide/resolve` (gpt-5.4, JSON, domain sky/earth, mai inventa). Cielo: match su `computeSky` (sole/luna/pianeti/stelle/deep-sky) + ISS via satellites. Terra: bearing/elevazione great-circle. Guida live sopra CameraPro: SenseRadar + SenseStatusLoop dorato che si restringe + hint trasparenti ("Ruota verso destra · alza 8°", "✅ individuato") + zoom consigliato → allo sblocco "Scatta il Senshot" (salva con subject/senseLayer=OverView Guide). Entry: card Home "Guidami".
- Verificato: guide/resolve (Giove→jupiter, Colosseo→earth+coord, ISS→iss, Andromeda→deep-sky) via localhost; transcribe 503 graceful su input vuoto; lint pulito; screenshot Guide (gate camera su web, atteso). ⚠️ Guida live, radar, anello, macro/AF/AE e microfono richiedono BUILD NATIVA (TestFlight) — non visibili su web/Expo Go.
Rimane da fare (futuro): fotografia computazionale reale (multi-frame/denoise/HDR/stacking — modulo nativo), modalità specializzate auto (scene detection ML), stabilizzazione avanzata, macro "microscopio", handoff visivo raffinato Guide→camera, identità UI unica ulteriore.

### SESSIONE (fork) — Rifinitura UX & identità interfaccia (2026-07-14)
Focus utente: coerenza/pulizia, non nuove funzioni. Scelte: sezione Social rinominata "Observe"; barra fluida per ora (refactor a Tab persistenti rimandato dopo il deploy/test dell'utente, confermato).
- **BottomNav** ridisegnata: tab = Home · Messaggi · [Make a Sense centro] · **Observe**(/feed, icona anello OverView) · Attività. Sezione attiva evidente: glow dorato + anello luminoso + lieve scale + FadeIn morbido; icone coerenti (outline→filled gold). **Badge messaggi non letti** (somma unread da dmApi.list, polling 15s quando loggato).
- **Shortcut superiori rimossi**: Home mantiene SOLO l'icona Profilo in alto a destra (rimosso shortcut Sense Vision top-left); feed: rimossi i bottoni Home/Profilo, header ora "Observe" + sottotitolo. Navigazione affidata alla barra inferiore.
- **Rinomina "Universe" → "Observe"** in barra + card Home (overline OBSERVE) + header feed.
- **Avatar reali ovunque** (identità autore): backend denormalizza `avatar` su observation e comment alla creazione + `update-avatar` aggiorna in massa observations/comments; `obs_public` e comment serializer includono avatar; frontend: ObservationCard, commenti in observation-detail, chat (avatar per-messaggio via param), lista conversazioni e Attività già con avatar.
- **Terminologia**: nessun "Post" (label export "Post 1:1"→"Quadrato 1:1"); contenuti = Observation / SenseShot (da Sense Vision).
- Verificato: lint pulito, backend import OK, screenshot Home (solo Profilo in alto, barra con Observe+anello, sezione attiva dorata, card Guidami/Observe).
- IDENTITÀ Sense Vision (nota guida futura): "non una fotocamera, un nuovo modo di osservare" — la tecnologia deve sparire; priorità future = stabilità camera, AF/AE/zoom/qualità reali, animazioni/transizioni rifinite, coerenza visiva. + Centro di Controllo profilo per personalizzare le 5 voci barra (Sense Vision fissa al centro).

### SESSIONE (fork) — Pulse™ Fase 1 & 2 (2026-06)
Pulse™ = sfida osservativa curata per "osservare la realtà". Libreria OFFLINE (mai AI-generata) time-aware.
- **`src/lib/pulseTasks.ts`**: ~30 sfide curate con `windows` (dawn/day/golden/night/any). `pulseForNow(date,salt)` sceglie deterministicamente una sfida COERENTE con l'orario reale (niente "Luna" di mattina); `tasksForNow`, `getTimeWindow`, `WINDOW_LABEL`, `getPulseTask`.
- **Backend `social.py`**: `CreateObs` + doc + `obs_public` estesi con `is_pulse`/`pulse_task`; indice `is_pulse`; `GET /api/pulse/feed?task_id=` (feed delle Pulse); `POST /api/pulse/compare` (obs_id_a/b → fetch media+dati → Pulse Challenge AI).
- **Backend `ai_features.py`**: `compare_pulse()` (gpt-5.4 vision, 2 immagini) — struttura Oltre-la-Vista (Comune / A / B / Sguardo invisibile), mai inventa.
- **`app/pulse.tsx` (NUOVO)**: hero "Pulse di ora" (icona/tema/prompt/hint + Rispondi→sense-vision?pulse=id + shuffle + Pulse libera), feed griglia community, modalità **Confronta** (seleziona 2 → Pulse Challenge™ modal).
- **`app/sense-vision.tsx`**: legge `?pulse=` → allega `data.pulse` alla cattura + banner Pulse nella HUD. **`observation.tsx`**: pubblica con `is_pulse`/`pulse_task`.
- **`BottomNav.tsx`**: barra a 5 voci FISSE — Home · **Pulse**(pulse-icon.png) · Make a Sense(centro) · Observe · Messaggi. Attività RIMOSSA dalla barra → campanella in alto a destra su Home e Observe (feed).
- Verificato: backend curl (create pulse, feed, compare AI restituisce confronto strutturato); lint pulito; screenshot Pulse + Home (barra 5 voci, campanella, Pulse attiva).
RIMANE: Pulse Notifications (Fase 3, build nativa); aggiungere sfide periodiche; Centro di Controllo barra (4 slot personalizzabili).

### SESSIONE (fork) — Barra banner + Challenges™ + Pulse Globali + Branding ™ (2026-06)
- **BottomNav** ridisegnata: banner galleggiante arrotondato (90% larghezza, maxWidth 440, r=30), SOLO icone (label rimosse), pulsante Sense Vision centrale che emerge senza essere tagliato (centerHolder absolute su parent non-clippato; blur clippato in `blurClip`). Voci: Home · Challenges(⚡ pulse-icon) · Make a Sense · Observe · Messaggi.
- **Tab Pulse → hub `Challenges™`** (`app/challenges.tsx`, `app/pulse.tsx` ora Redirect→/challenges): Pulse Globale (se attivo), Pulse di ora, feed community + Pulse Challenge™ (Confronta), "Altre sfide" (Observe/amici/classifiche/eventi = Presto).
- **Pulse Globali** (backend `social.py`): `_GLOBAL_CALENDAR` (7 temi curati, uno per giorno) = fonte AUTO; override MANUALE dalla Creator Console. `GET /api/pulse/global/active`, `GET /api/pulse/global/{gid}/feed`, `POST/DELETE /api/creator/global-pulse` (guard get_creator). Collezione `global_pulses`. **Conteggio partecipanti/paesi SEMPRE REALE** (distinct user_id/country). `app/pulse-global.tsx`: missione + partecipanti reali + griglia mondiale.
- **Integrazione SnapSense** (`SnapSenseBar.tsx`): primo ring "⚡ Pulse" (bordo dorato + glow animato reanimated → /challenges); poi i Pulse pubblicati (PulseRing dorato animato) si alternano agli SnapSense; tap Pulse → observation-detail.
- **Feed unico**: `ObservationCard` mostra badge **⚡ PULSE / GLOBAL PULSE** se `is_pulse`. Observe resta il social principale.
- **sense-vision**: params estesi (`gTitle/gTheme/gPrompt`) per rispondere a Pulse globali/arbitrari non in libreria.
- **Branding ™** (`src/components/Brand.tsx`): `<BrandName name>` + `<Tm>` (apice ™ coerente). Applicato a Home wordmark "OverView™", header "Observe™", "Challenges™". Nomi ufficiali: OverView™, Sense Vision™, SnapSense™, Pulse™, Observe™, OverView Guide™.
- Verificato: backend curl (global auto+manual, participants reali=0); lint pulito; screenshot Challenges (card globale + ™), Observe (ring Pulse dorato animato + Observe™ + campanella), barra banner con Sense Vision integro.
RIMANE: reverse-geocode `data.country` alla cattura (per conteggio paesi Pulse globale); Creator Console UI per gestire Pulse globali; Pulse Notifications (Fase 3, build nativa); calendario "intelligente" (eventi astronomici/stagioni) per i Pulse globali auto.

### SESSIONE (fork) — Fix Sense Vision camera (build reale, 2026-06)
- **Zoom fino al massimo REALE** del device (es. 123.8×): rimosso il cap `Math.min(maxZoom,32)` → `maxZoom = device.maxZoom`. Label = z/neutral (onesto, reach reale del sensore, non dettaglio inventato).
- **Bug "buio dopo lo zoom" + AF/AE mancante**: rimossa la gesture Pan verticale di esposizione manuale (causava bias negativo bloccato → schermo scuro non recuperabile). Ora esposizione su AUTO continuo (`exposure` bias 0), tap-to-focus fa AF+AE sul punto (recupera scene scure), long-press blocca AF/AE.
- **Layout sense-vision**: LOOK UP/GO INSIDE spostati SOTTO il pulsante MAKE A SENSE (non più sovrapposti a zoom/AF-AE). HUD zoom della CameraPro reso configurabile via prop `hudBottom` (sense-vision passa insets.bottom+220 così sta sopra lo scatto). In alto: barra Sense Layer a top+52, pill "Osserva meglio" spostata a top+104 (niente più sovrapposizione con i filtri).
- ⚠️ Validabile SOLO su BUILD nativa (VisionCamera) — non su Expo Go/web.

### SESSIONE (fork) — Fix OverView Guide™ & Visual Assistant (build reale, 2026-06)
- **OverView Guide zoom non visibile**: la HUD zoom di CameraPro (etichetta zoom + preset + AF/AE) era coperta dal pannello input → passato `hudBottom={insets.bottom+236}` così l'etichetta "x.x×" è sempre visibile sopra il pannello.
- **Tastiera non chiudibile**: aggiunti listener Keyboard (kbOpen/kbHeight); overlay Pressable su tutta l'area (tranne pannello) che fa `Keyboard.dismiss()` al tocco; il pannello input si solleva sopra la tastiera (paddingBottom += kbHeight su iOS) così si vede ciò che si scrive.
- **Visual Assistant descrizione senza chiusura**: aggiunta **X** in alto a destra (`va-close`) che chiude la descrizione e torna al live (oltre a Riprova/Crea Senshot).
- ⚠️ Validabile SOLO su BUILD nativa (CameraPro.native/VisionCamera).

### SESSIONE (fork) — Fix "frammento dorato fuori schermo" in observation.tsx (2026-06)
- CAUSA: lo stile `layerHint` era `flexDirection: "row"` e conteneva 2 figli affiancati: il banner "Soggetto rilevato" + la `SenseLayerBar`. Quando l'AI riconosce un soggetto, il banner spinge la SenseLayerBar fuori dallo schermo a destra → si vedeva solo il bordo sinistro (SenseMark dorato + testo reveals "L'immagine reale…" = "L'i…").
- FIX: `layerHint` ora in colonna (`{ marginTop: spacing.xs, gap: spacing.sm }`) → banner sopra a tutta larghezza, SenseLayerBar sotto a tutta larghezza. La sezione resta (come richiesto) e ora è interamente visibile. Fix di solo layout, valido anche su web.

### SESSIONE (fork) — Zoom Sense Vision: chiarimento + ghiera mezzaluna (2026-06)
- CHIARIMENTO: la portata dello zoom è GIÀ al 100% dell'hardware (`maxZoom = device.maxZoom`, nessun clamp). Il "16×" era un vecchio clamp `Math.min(maxZoom,32)` (rimosso). L'etichetta = `zoom/neutralZoom`: 61,9× = ingrandimento rispetto al 1× (neutral≈2); il vecchio 123,8× era il fattore grezzo rispetto all'ultra-wide 0,5×. Stessa immagine finale. Scelta utente: mantenere **61,9×** (standard rispetto a 1×). Niente super-res (fedeli a Oltre la Vista).
- PRESET ALTI: preset ora 0.5× · 1× · 2× · 5× · 10× · 25× · Max (Max = `device.maxZoom/neutral`, filtrati per device). Pill compatte.
- GHIERA MEZZALUNA (stile iPhone): Pan orizzontale sulla riga dei preset (`wheelPan`, activeOffsetX ±10) → i preset lasciano il posto a un arco/mezzaluna (`ZoomCrescent`, SVG con tacche + tacca centrale dorata) e un readout live dello zoom; scorrendo dx/sx lo zoom cambia in modo fluido (scala log, `dispStart*1.35^(dx/45)`). Rilascio → torna ai preset. Il tap sui preset resta attivo (activeOffsetX). Solo build nativa.

### SESSIONE (fork) — Home raggruppata Earth/Explore/Discover (2026-06)
- Home alleggerita: la griglia "strati" (12 card) ora mostra 5 card: **Earth (5)**, **Explore (3)**, **Discover (2)** = card-gruppo che aprono un **bottom-sheet menu** con le sottosezioni; **Observe** e **Galleria** restano card indipendenti. Nessuna funzione rimossa: ogni voce apre la sua route esistente.
  - EARTH: /qui-e-ora, /realta-invisibile, /meteo-spaziale, /audio, /timeline
  - EXPLORE: /cielo, /universo, /earth-explorer(Satelliti)
  - DISCOVER: /overview-guide(Guidami), /assistant(Assistente)
- `app/home.tsx`: sostituito `LAYERS` con `GROUPS` + item-list; stato `menu`; Modal bottom-sheet (handle, header con icona/X, item con MiniViz/icona + teaser + chevron). MiniSun/MiniOrrery/MiniField riusati nel menu. Verificato via screenshot (Home 5 card, menu Earth/Explore aperti). Solo frontend.

### SESSIONE (fork) — Rinomina Pulse™ + Sky Fase A (2026-06)
- RINOMINA: sezione "Challenges" → **Pulse™** (titolo hub in `challenges.tsx`, route /challenges invariata). "Pulse Challenge™" → "Confronto Pulse™". Aggiunta card **Pulse™** in Home grid (⚡ flash) → /challenges. Home ora 6 card: Earth·Explore·Discover·Pulse·Observe·Galleria.
- SKY FASE A (`cielo.tsx`): marker AR ridisegnati stile "fotografia aumentata" — alone morbido (glow) + anello sottile + core preciso + **linea di collegamento (leader)** al nome. Nuovo toggle **"Nomi"** (default ON) per mostrare/nascondere le etichette (legenda minimale sovrapposta). Vale per stelle/pianeti e satelliti (variante blu). Vecchi stili dot/label lasciati inutilizzati.
- ⚠️ Sky è fotocamera+sensori: validabile solo su BUILD nativa.
- PROSSIME FASI Sky: B) legenda oggetti editabile pre/post pubblicazione; C) pubblicazione come SenseShot/Observe/Pulse; D) zoom con miglioramento computazionale. + INVISIBLE REALITY 3D esplicativo.

### SESSIONE (fork) — Invisible Reality 3D esplicativo (2026-06)
- `invisible-3d.tsx`: da "bella animazione" a lettura scientifica comprensibile. Aggiunto pannello esplicativo (fuori dal ViewShot, così il Senshot resta pulito): valore grande µT + riga sintetica (direzione bussola, **inclinazione/dip** calcolata da atan2(|z|,hypot(x,y)), gravità g), **frase in linguaggio semplice** ("Il campo magnetico qui è di X µT, orientato verso … e inclinato di ~Y°…"), e **legenda "Cosa stai osservando"** con pallini colore→significato (Anelli=linee di campo, Ago=Nord magnetico, Freccia gialla=direzione basso/gravità, Puntini=particelle STIMATE). Pannello comprimibile (chevron/info), default aperto. Rimosso il readout in-scene (scena catturata più pulita). Verificato via screenshot (web: valori 0, atteso; su iPhone reali).

### SESSIONE (fork) — Sky Fase B (legenda editabile) + Fase C (pubblicazione multipla) (2026-06)
- `observation.tsx` (schermata dopo lo scatto):
  - FASE B: reveal "What You Couldn't See" ridisegnato elegante (glow + core + leader line + nome) al posto di pallini/quadratini colorati; pianeti oro, satelliti blu, ISS anello. Nuova **card "Oggetti riconosciuti"**: chip per ogni oggetto (pianeti/ISS/satelliti/Luna) con toggle occhio per mostrarlo/nasconderlo nel SenseShot, + toggle **"Nomi"** (default ON) per le etichette. Selezione salvata in `data.legendHidden` + `data.legendOn` (ObsData esteso). Editabile PRIMA della pubblicazione.
  - FASE C: pulsante "Pubblica questo SenseShot" → **bottom-sheet scelta**: SnapSense™ (già in Galleria), **Observe** (is_pulse=false), **Pulse™** (is_pulse=true, attacca `pulseForNow()` se non già presente). `publish(asPulse)` include i campi legenda.
- Verificato: lint pulito, home smoke test OK (nessuna regressione bundle). observation.tsx richiede uno scatto reale per test end-to-end (build).
- RESTA: editing legenda DOPO la pubblicazione (serve endpoint PATCH `/api/observations/{id}` owner-only + UI su observation-detail). Sky Fase D (zoom computazionale). Invisible Reality 3D già fatto.

### SESSIONE (fork) — Sky Fase B (chiusura) + Sky Fase D (zoom computazionale)
- **Sky Fase B — editing legenda DOPO la pubblicazione (COMPLETATO)**: `PATCH /api/observations/{id}` (owner-only, campi `caption`/`legend_hidden`/`legend_on`, aggiorna `data`) già presente in `social.py` e verificato end-to-end via python requests (create → patch → legendHidden=['ISS'], legendOn=False). `app/observation-detail.tsx`: proietta ora il cielo salvato (Svg: costellazioni/pianeti/satelliti/ISS/Luna/Via Lattea via `project` + `CONSTELLATION_LINES`, rispettando `hiddenObj`/`legendOn`); card di modifica legenda visibile SOLO all'autore (`user.id === obs.user_id`) con chip mostra/nascondi per oggetto + toggle "Nomi"; ogni tocco salva subito via `socialApi.updateObservation` (indicatore ActivityIndicator). Beyond View: cielo ricalcolato dai dati reali, nessun dato inventato.
- **Sky Fase D — zoom computazionale per il cielo (COMPLETATO, native-only)**: `src/components/CameraPro.native.tsx`. `enhanceImage(path, zoomFactor)` ora sceglie il profilo in base allo zoom. A zoom estremo (≥5×) applica lo shader Skia `CELESTIAL`: **denoise** reale (blend verso media locale 3×3) + **unsharp mask più forte** + **contrasto locale maggiore** (gain 1.16, offset -0.055) per far emergere stelle deboli reali dal fondo scuro. Beyond View rigoroso: solo riponderazione dei pixel realmente catturati — nessuna super-risoluzione, nessuna stella inventata, nessuna AI. Zoom letto da `zoom.value/neutral` alla cattura. HUD: pill "SKY BOOST" (sparkles) mostrata quando zoom ≥5×. Testabile solo su build TestFlight nativa (Skia/VisionCamera non attivi su web/Expo Go).
- Verifica: lint pulito su entrambi i file, `tsc` clean su observation-detail, smoke test home OK.
- RESTA (backlog P1): UI Creator Console Global Pulse; reverse-geocode `data.country` alla cattura; personalizzazione slot Bottom Nav; Documented Reality Marte & ISS ("Go Inside").

### SESSIONE (fork) — Go There™ Privacy posizione (4 livelli) + Elimina contenuti + Dettaglio ravvicinato
- **Privacy posizione a 4 livelli (COMPLETATO, verificato)**: ogni Senshot ha `geoPrecision` scelto dall'autore. 📍 Nessuna (niente Go There) · 🌍 Area ampia (~5-10 km, snap griglia 0.05°) · 📌 Approssimata (~100-500 m) · 🎯 Precisa. **Privacy lato server** (`social.py` `_fuzz_coords`/`_public_geo`): le coordinate reali NON escono mai; `obs_public` restituisce coord sfumate in modo deterministico (seed=md5(id)) secondo il livello; `none` rimuove anche viewpoint (cameraAz/Alt) → Go There non disponibile. Filtro "vicinanze" resta preciso ma solo server-side. Verificato via feed+PATCH per tutti i livelli.
- **Selettore + auto-protezione** (`observation.tsx` publish sheet + `observation-detail.tsx` card owner-only, componente riusabile `GeoPrivacyPicker`): default modificabile alla pubblicazione e anche dopo (PATCH `geo_precision`). **Auto-protezione on-device** (`src/lib/placeHistory.ts`, AsyncStorage, nessun tracciamento server): se il punto è entro ~180 m da ≥3 catture passate (casa/lavoro) → suggerisce "Approssimata" con spiegazione.
- **Eliminazione contenuti (COMPLETATO)**: `DELETE /api/observations/{id}` owner-only (rimuove obs+media+interazioni+commenti+saves+reposts). Frontend: pulsante Elimina owner-only in `observation-detail.tsx` (Senshot o Pulse™) + dialog di conferma in stile OverView (`src/components/ConfirmSheet.tsx`, distruttivo rosso). Verificato (delete→404).
- **Dettaglio ravvicinato "tipo Google" (COMPLETATO, 1a+1b, tutto gratuito)**: `satelliteImagery.ts` + `satellite-explore.tsx`. Nuovi layer via WMS GetMap gratuiti: **Satellite HD = Sentinel-2 (~10 m/px, EOX cloudless CC-BY)** e **Mappa = OpenStreetMap (terrestris OSM-WMS)**. `layerImageUrl()` unifica GIBS/Sentinel-2/OSM. DELTAS estesi con livelli fini (0.2→0.012°). Go There terrestre atterra "vicino" (zoom 9 + Sentinel-2 di default). URL WMS verificati (HTTP 200, immagini reali). `satelliteName()` mappa Sentinel-2/OSM per il Senshot.
- Verifica: lint pulito su tutti i file toccati, tsc pulito sui file modificati (restano falsi positivi pre-esistenti su three/CameraPro/r3f risolti da Metro), backend e2e ok, smoke test home ok.
- RESTA (backlog P1): UI Creator Console Global Pulse; reverse-geocode `data.country` alla cattura; personalizzazione slot Bottom Nav; Documented Reality Marte & ISS.

### SESSIONE (fork) — Live Sense™ FASE 1 (Live Sky Sense, dati reali) + Centro di Controllo
- **Principio architetturale "UN SOLO MOTORE"**: Live Sense™ è il motore di riconoscimento universale incorporato dentro `CameraPro.native.tsx` → attivo automaticamente OVUNQUE si apra Sense Vision™ (sense-vision, overview-guide, visual-assistant, ecc.). Ogni sezione aggiunge solo i propri overlay/strumenti, il motore di osservazione è unico. Distinto da OverView Guide™ (che accompagna verso un obiettivo); Live Sense scopre spontaneamente ciò che entra nell'inquadratura. Le due coesistono.
- **Fase 1 — Live Sky Sense™ (`src/components/LiveSense.native.tsx`, dati reali, ZERO AI, Beyond View puro)**: riconosce in tempo reale gli oggetti celesti nel campo visivo (Sole, Luna, pianeti, ISS/satelliti, stelle, deep-sky, centro galattico) da bussola (`useHeading`) + inclinazione (`useAccelerometer`) + GPS (`useObserver`) + astronomia (`computeSky`) + proiezione FOV (`project`, FOV scalato con lo zoom). Marker discreti trasparenti (alone + nome) + **animazione di scoperta elegante**: "Analizzo…" (0.5s) → ✔ Nome + **miniatura reale Wikimedia** (`src/lib/liveThumbs.ts`, Special:FilePath) in dissolvenza (reanimated). **Analisi intelligente**: rivela solo a inquadratura stabile (soglia velocità angolare deg/s), attende durante il movimento, non ricalcola sullo stesso oggetto. Web stub `LiveSense.tsx` (null; feature native-only). Permessi GPS/sensori attivati SOLO quando Live Sky Sense è abilitato (gate prima degli hook).
- **Affidabilità**: gli oggetti celesti sono calcolati → sempre "✔ Riconosciuto" (alta affidabilità). Il livello "≈ Probabile"/nessun risultato è previsto per la Fase 2 (AI).
- **Centro di Controllo (`app/live-sense.tsx` + `src/lib/liveSense.ts`)**: store esterno persistente (AsyncStorage, `useSyncExternalStore`). Master on/off + **preset Solo WOW · Bilanciato · Completo · Personalizzato** + 12 categorie toggle (Astronomia, Monumenti, Geologia, Animali, Arte, Natura, Botanica, Architettura, Mare, Tecnologia, Veicoli, Oggetti). Toggle rapido "Live Sense" in-camera (tap on/off, long-press → Centro di Controllo). Verificato su web (schermata Control Center renderizza: preset + categorie).
- Verifica: lint pulito su tutti i file nuovi/toccati, tsc pulito sui file nuovi (restano falsi positivi pre-esistenti su CameraPro/three risolti da Metro), Control Center testato su web, smoke test ok.
- **PROSSIMO — Fase 2 (Live Sense universale via AI)**: riconoscimento terrestre/generale (piante/animali/monumenti/veicoli/arte/oggetti…) con analisi frame intelligente (nuova scena/stabilità/zoom → analizza; stessa scena → mantiene) e soglia di confidenza (✔/≈/niente); nuovo endpoint AI vision + miniature Wikimedia. Per l'utente resta UNA sola funzione (l'AI è invisibile). Modello AI da confermare (gpt-5.4 già integrato vs Gemini). ⚠️ Tutto Live Sense è testabile solo su build TestFlight nativa.

### SESSIONE (fork) — Live Sense™ FASE 2 (riconoscimento universale AI) — COMPLETATA
- **Un'unica esperienza**: per l'utente esiste solo Live Sense™; l'AI è uno strumento invisibile. Il motore vive dentro `CameraPro` (universale). Due sorgenti oneste sotto un'unica UX: Live Sky Sense™ (dati reali, zero AI, Fase 1) + riconoscimento AI terrestre/generale (Fase 2).
- **Backend** (`ai_features.py` → `POST /api/ai/live-recognize`, modello **openai gpt-5.4** via emergentintegrations): riceve frame base64 + categorie attive; identifica UN solo soggetto principale SOLO tra le categorie abilitate; **onestà Beyond View** — non inventa, ignora gli oggetti celesti (gestiti dal motore reale: cielo → recognized=false). Ritorna `{recognized,label,category,subtitle,emoji,confidence,reliability,wiki}`. **Soglia di affidabilità**: conf≥0.82 → `confirmed` (✔), 0.55-0.82 → `probable` (≈), <0.55 → niente. Fallisce sempre a recognized=false. Verificato via curl: Lavanda 0.97 ✔, Colosseo 0.99 ✔, cielo → recognized=false.
- **Frontend**: `CameraPro.native.tsx` fornisce `snapshotBase64()` (VisionCamera `takeSnapshot` → downscale Skia 640px JPEG q78 → base64) passato a `<LiveSense>`. `LiveSense.native.tsx` ristrutturato: outer + `LiveSkyEngine` (cielo, Fase 1) + `LiveAIEngine` (AI). **Analisi intelligente** in LiveAIEngine: analizza solo a inquadratura stabile + scena cambiata (`dirty` da movimento accelerometro) + throttle 2.6s; stessa scena → mantiene il risultato; movimento → attende. Card AI in basso-centro con animazione "Analizzo…" → ✔/≈ label + **miniatura reale Wikimedia** (`wikiThumb` REST search, UA header, 240px) o emoji fallback; bordo oro (confirmed) / grigio + tag "Probabile" (probable).
- **Client/Tipi**: `aiApi.liveRecognize(image_base64, categories)` + `LiveRecognition` in `backend.ts`; `wikiThumb(query)` in `liveThumbs.ts`. Centro di Controllo (`live-sense.tsx`) copy aggiornata (categorie non-astro ora riconosciute in tempo reale con soglia ✔/≈).
- Verifica: lint/tsc puliti sui file nuovi/toccati, backend e2e ok (3 casi), Wikipedia thumb ok (UA richiesto), Control Center testato su web (preset Personalizzato + toggle categorie). ⚠️ Motore live (camera+sensori+snapshot) testabile solo su **build TestFlight nativa**.
- **Nessuna nuova dipendenza** (emergentintegrations, reanimated, expo-image, fetch già presenti).
- RESTA (backlog P1): Creator Console Global Pulse UI; reverse-geocode `data.country`; Bottom Nav Control Center; Documented Reality Marte & ISS. Possibili rifiniture Live Sense: cache miniature, throttle adattivo per costo, micro-invito "Crea un Senshot di questo" sulla scoperta.

### SESSIONE (fork) — Condivisione Observe, Fotocamera frontale, Presence Match™ (C1) + Discover People™
- **A · Condividi Observe come SenseShot/Pulse (`observation-detail.tsx`, owner-only)**: sheet "Condividi anche come SenseShot™ o Pulse™" → riusa media esistente (ImageManipulator dal `mediaUrl`) e crea uno SnapSense (`snapSenseApi.create`) o una nuova Observation Pulse (`socialApi.createObservation` is_pulse + pulseForNow). Testato flusso.
- **B · Fotocamera frontale (`CameraPro.native.tsx`)**: `useCameraDevice("front")` + stato `facing`, pulsante flip nell'HUD, reset zoom al cambio. Tutte le funzioni identiche. Live Sense™ passato `facing`: proiezione cielo adattata (azimut +180°, mirror X sul frontale). Nativo.
- **C1 · Presence Match™ / Privacy & Consensi (backend `community.py`, router `/api/community`, indici + registrato in server.py)**:
  - Consensi utente: `presence_level` (1-4), `face_scanned`, `identity_pref` (name/nickname/none) su doc utente. `GET/PATCH /community/privacy`.
  - **Richieste di menzione consenso-based**: `POST /community/mentions` (autore, owner del Senshot; NON conosce mai l'identità finché l'altro non accetta). Livello 1 → silenzioso (unavailable). Livelli 2/3 → richiesta pending. Livello 4 → auto-accetta con identità scelta. `POST /community/mentions/{id}/respond` (name/nickname/none/reject) → allega `data.mentions` al Senshot solo dopo consenso. `GET /community/mentions/incoming` (Match History) + `/summary` (counts). Flusso verificato e2e via curl (pending→accepted_nickname→mention allegata).
  - Frontend: `app/privacy-consent.tsx` (Centro di Controllo → Privacy & Consensi™: scan proprietario opt-in, preferenza identità, 4 livelli), `app/match-history.tsx` ("Sei comparso in N Senshot™" + accetta/rifiuta/revoca), link da `live-sense.tsx`. Client `src/lib/community.ts`. Testati su web (render + tap livelli ok; privacy-consent resiliente con stato default).
- **Discover People™ (`app/discover-people.tsx` + backend `/community/discover`, `/community/invite`)**: suggerimenti da segnali REALI (Pulse™ in comune, luoghi osservati vicini ~15km, amici in comune/friends-of-friends, iscritti di recente, cold-start attivi) con motivo mostrato; follow inline. **Invita amici**: link personale + QR (`react-native-qrcode-svg`) + Copia link (`expo-clipboard`, installato) + Condividi (RN Share). Entry point: header Observe (`feed.tsx`, icona people) + profilo (Discover/Privacy). Verificato su web.
- Verifica: lint/tsc puliti sui file nuovi/toccati; backend e2e (privacy, mentions full flow, discover, invite) ok; screenshot Discover + Privacy ok. **Nuova dip**: `expo-clipboard`.
- **RESTA C2 (nativo, complesso, non testabile qui)**: motore rilevamento/embedding volti in fotocamera (VisionCamera + modello ML) che rileva un volto → scatena `communityApi.requestMention(obs_id, target_id)`; filtro anti-riconoscibilità Livello 3; **push notifications** ("Qualcuno vorrebbe menzionarti") — ora c'è solo inbox in-app (Match History), le push richiedono Firebase google-services.json + build. Inoltre: notifiche-riepilogo intelligenti ("Hai N persone che potresti conoscere") da cablare nella schermata Activity usando `/community/discover` + `/community/mentions/summary`. "Rubrica" invito richiede expo-contacts (nativo).

### SESSIONE (fork) — C2 fondamenta: Face engine backend, Push, Riepiloghi Activity, Rubrica
- **Face engine — BACKEND pronto (testabile, biometria = solo vettori)** (`community.py`): `POST /community/face/enroll` (proprietario, embedding ≥64-d, nessuna foto), `DELETE /community/face`, `POST /community/face/match` (confronto coseno contro utenti consenzienti level≥2; ritorna `target_id`+confidence SENZA rivelare identità; soglia 0.62). Verificato che `face_embedding` NON trapela in `/auth/me` né `/users/{id}`. Test e2e ok.
- **Push notifications (backend + client cablati; attivi solo dopo build+chiavi)**: nuovo `backend/push.py` (relay Emergent, `POST /api/register-push` + `send_push()`), registrato in server.py, `EMERGENT_PUSH_KEY=placeholder` in backend/.env. `create_mention` (livelli 2/3) invia push "Qualcuno vorrebbe menzionarti in un Senshot™" con `action_url=/match-history` (idempotency=req id, non blocca mai la richiesta). Client: `src/lib/push.ts` (`registerForPush`, handler foreground) + `src/components/PushBridge.tsx` (registra su login + routing al tap) montato in `_layout.tsx`. `expo-notifications`+`expo-device` installati; `app.json`: plugin expo-notifications + `android.googleServicesFile`. ⚠️ RICHIEDE: `google-services.json` dall'utente + deploy/build; `EMERGENT_PUSH_KEY` impostato in pipeline.
- **Riepiloghi intelligenti in Activity (`activity.tsx`, testato)**: card "Hai N persone che potresti conoscere" (→ Discover) e "Hai N richieste di menzione in attesa" (→ Match History), da `/community/discover` + `/community/mentions/summary`. Mostrati sia in lista sia in empty state. **Bugfix**: crash latente per `kind` attività non mappato → fallback meta.
- **Invito Rubrica (`discover-people.tsx`)**: pulsante "Invita dalla rubrica" con gestione permessi contestuale (`expo-contacts` installato, fallback `Linking.openSettings`), poi Share nativo. `app.json`: `READ_CONTACTS` + `NSContactsUsageDescription`. Nativo.
- Verifica: lint/tsc puliti, backend e2e (face enroll/match/delete, no-leak, register-push route), Activity testato su web (riepilogo + item). Nuove dip: `expo-notifications`, `expo-device`, `expo-contacts`.
- **RESTA C2 NATIVO (non installato/testabile qui, dev build)**: motore rilevamento volti in fotocamera — installare `react-native-vision-camera-face-detector` (MLKit) + `@rdnf-magiba/expo-face-recognition` (embedding FaceNet 512-d) + `react-native-worklets-core`; frame processor → embedding → `communityApi` enroll (owner 1:1) / `face/match` (Presence) → scatena `requestMention(obs_id, target_id)`; **filtro Livello 3** = blur/pixelate Skia della regione volto alla cattura in `CameraPro.native.tsx`. Push testabili solo dopo build+google-services.json.

### SESSIONE (fork) — Sense Vision UX: controlli intelligenti, contesto cielo, fix "Analizzo…"
Richiesta utente (6 punti). Contesto cielo scelto: SOLO SENSORI (opzione A).
- **Controlli intelligenti** (`CameraPro.native.tsx` + `sense-vision.tsx`): tutti i comandi si attenuano (opacity 0.32) dopo 4s di inattività; tap singolo = tornano pieni (+ mette a fuoco); doppio tap = modalità cinema (opacity 0.05); altro doppio tap = ritornano. Gestione via shared value `chromeOpacity` in CameraPro (wake/applyChrome/toggleCinema) + callback `onChromeChange` che pilota le overlay superiori/inferiori di sense-vision. Risveglio anche su preset/pinch/lock/flip.
- **Fix "Analizzo…" bloccato** (`LiveSense.native.tsx`): LiveSkyEngine — riscritta la logica di phase (ora rischedula sempre → mai stuck). LiveAIEngine — timeout hard 7s su `liveRecognize` (Promise.race) + stato "none" ("Nessun oggetto identificato · continua a osservare") per 2.6s poi idle.
- **Contesto osservazione (solo sensori)**: `skyVisible = cameraAlt >= 18°`. Indicatore discreto **🌌 Sky Visible / 🌌 Sky Hidden** (top-center) + messaggio guida ("Fotocamera verso il basso · punta verso il cielo" / "Cielo vicino all'orizzonte · alza la fotocamera"). Gli oggetti astronomici restano SEMPRE calcolati; se il cielo non è visibile la card mostra "In questa direzione, ma il cielo non è visibile ora." NB: con soli sensori non si distingue "indoor" reale → usato "Sky Hidden" (onesto). AI-scene detection = opzione B/C futura.
- Verifica: lint pulito, app carica (web mostra gate permessi). Funzioni NATIVE (VisionCamera+sensori) → validazione solo su BUILD.

### SESSIONE (fork) — Composer di pubblicazione + Musica (Jamendo) + Filtri Sense Vision
- **Composer** (`app/publish-composer.tsx`): flusso standard PRIMA della pubblicazione — Foto → Titolo(opz) → Descrizione(+#hashtag) → 🎵 Musica → 📍 Posizione (GeoPrivacyPicker 4 livelli + reverse-geocode) → 🏷 Tag persone (da community/discover) → 🔥 Pulse toggle → Pubblica. Il pulsante Pubblica in `observation.tsx` ora apre il composer (il vecchio modal resta ma è irraggiungibile). Su publish → `router.replace(/observation-detail)`.
- **Musica modulare** (`backend/music.py`): provider abstraction (`MusicProvider` + `JamendoProvider`), `/api/music/search` (q/artist/genre/mood) + `/api/music/track/{provider}/{id}` (availability), schema Track normalizzato → nuovi provider (Apple/Spotify futuri) senza toccare API/client. `JAMENDO_CLIENT_ID=14a80ed1` in backend/.env (solo server, mai frontend). `MusicPicker.tsx`: ricerca + chip genere/mood + anteprima (expo-audio, clip trimmata) + trim (inizio+durata 10/15/30s) + conferma. Si salva SOLO il riferimento (provider_track_id/audio_url/start/duration), non il file.
- **No auto-musica**: rimosso `SenseMatchBar` (auto-match) dal post pubblicato; ora `PublishedMusic.tsx` riproduce SOLO il brano scelto dall'autore (clip trimmata, gestione brano non disponibile, link licenza CC). Se nessuna musica scelta → niente.
- **Observation estesa** (`social.py` CreateObs + obs_public): `title, description→caption, hashtags[], music{}, tagged_users[]`. `FeedObservation` (frontend) esteso; `observation-detail.tsx` mostra titolo, hashtag, tag persone, player musica.
- **Filtri #3** (`SenseCanvas.tsx` + `senseLayers.ts`): l'ex "Dettaglio" (B/N alto contrasto) rinominato **"Silhouette"** (identico); nuovo vero **"Dettaglio"** = sharpening reale (unsharp mask RuntimeEffect Skia, lazy+native-only per non crashare il web). Legacy "Micro-dettaglio" → mappa a Silhouette.
- Verifica: lint pulito, backend testato via python (create con tutti i campi + Jamendo search OK), app carica senza crash su web (fix guardia Skia web). Composer/musica/filtri Skia = validazione piena su BUILD (expo-audio background/native).
- TODO next: audio originale registrato dall'utente (architettura `audio_id` già pronta); upload audio endpoint.

### SESSIONE (fork) — "Riconosciuti" vs "Nella tua direzione" (framing reale del cielo)
- Bug: la legenda "Oggetti riconosciuti" elencava TUTTI gli oggetti calcolati (7/7) anche se solo quelli in campo (es. NOAA 19) erano proiettati sulla foto.
- Modulo condiviso `src/lib/skyFraming.ts`: `frameObjects()` classifica ogni oggetto (pianeti/ISS/satelliti/Luna/Sole/CentroGalattico) in **in-frame** (`project()` non-null E alt≥0 sopra l'orizzonte) vs **nearby** (fuori campo o sotto orizzonte). Helper `directionPhrase/statusPhrase/guidanceLine/arrowRotation`.
- Componente condiviso `src/components/SenseRecognized.tsx` usato in `observation-detail.tsx` (visibile a TUTTI, edit solo autore) e `observation.tsx`:
  - **"Riconosciuti · V/T"** (V=visibili in legenda, T=realmente in campo). Rinominato da "Oggetti riconosciuti".
  - **"Nella tua direzione · N/N"** collassabile, CHIUSA di default: oggetti reali vicini al punto di vista ma fuori dalla foto, con freccia OverView™ (rotazione da az/alt), frase direzionale ("40° a destra e 15° più in alto", "dietro il tuo punto di vista", "sotto l'orizzonte") + distanza angolare.
  - **Scheda tecnica** (tap su qualsiasi elemento): miniatura (celestialThumb), categoria, stato (dentro/fuori inquadratura), freccia+direzione+stato, griglia dati (azimut/elevazione/dist. angolare), fonte dati, nota Beyond View (nessuna distanza inventata — ObsPoint non contiene distanze reali → omesse), pulsanti **Guidami** (→ `/overview-guide?q=` con auto-resolve aggiunto) e **Cielo/Satellite** (universe-explorer/satellite-explore).
- Overlay foto aggiornato: NON disegna oggetti sotto l'orizzonte (coerenza con Riconosciuti). Default: solo in-frame sulla foto, sezione direzione chiusa, nessuna freccia fuori campo.
- Verificato via screenshot: Riconosciuti 3/3 (ISS, NOAA 19, Luna), Nella tua direzione 3/3 (Venere sotto orizzonte, Marte, Giove) + scheda tecnica Giove corretta. Lint pulito.
- Coerenza (#7): detail + local viewer coperti; feed/profilo/Pulse/SnapSense/Go There aprono il detail → coerenti. Discovery Card (immagine esportata) non toccata.

### SESSIONE (fork) — Qualità fotocamera "Originale" = Apple (CameraPro.native.tsx)
Problema: preview morbida/rumorosa + foto inferiori alla Camera Apple (soprattutto front).
Cause individuate e corrette:
1. `useCameraFormat` massimizzava solo `photoResolution:"max"` → la preview usava un formato VIDEO a bassa risoluzione, scalato (morbido). FIX: `[{photoResolution:"max"},{videoResolution:"max"}]` → preview alla massima risoluzione.
2. `enhanceImage` girava su OGNI scatto (default enhance=true) e RIDIMENSIONAVA a MAX_EDGE=2600 + sharpen + JPEG 94 → degradava la foto Apple. VIOLAVA "Originale=Apple". FIX: capture ora salva il RAW Apple UNTOUCHED a piena risoluzione ("Originale" indistinguibile da Apple). L'unico pass in cattura è lo **Sky Boost** (denoise+sharpen su segnale reale debole) SOLO a zoom≥5 e SENZA downscale (piena risoluzione, JPEG 98). Rimosso `MAX_EDGE`.
- Ordine corretto rispettato: Hardware → pipeline Apple (Smart HDR/Deep Fusion/denoise/sharpen, mantenuti: photoHdr, lowLightBoost, photoQualityBalance="quality") → immagine full-quality → Sense Vision (layer nel viewer, non distruttivi) → overlay.
- "Osserva meglio" (enhance) ora influenza SOLO lo Sky Boost a zoom≥5; gli scatti normali sono sempre pristini. L'enhancement di dettaglio reale resta il layer "Dettaglio" (SenseCanvas, viewer, non distruttivo).
- ⚠️ NATIVO: preview/format/takePhoto validabili SOLO su build (non Expo Go/Web). Lint pulito, bundle OK. Benchmark (#13) da fare su device confrontando con Camera Apple.

### SESSIONE (fork) — Viewer immersivo Pulse/SenseShot + fix front camera
- **#6 Front camera 90° (FIX)**: `CameraPro.native.tsx` capture — per la front camera l'orientamento veniva perso nel file salvato (preview corretta). Ora si fa il bake dell'EXIF via `ImageManipulator.manipulateAsync([], compress:1)` SOLO per front → i pixel salvati corrispondono all'anteprima. Back camera resta raw pristino. Import `expo-image-manipulator`. Da validare su BUILD.
- **#1+#2 Viewer immersivo (FATTO)**: nuovo `app/pulse-view.tsx` — foto fullscreen in Pure Sense (nessun pannello scientifico), chevron chiudi, autore minimale + apprezzamenti (animazione trasparente) in alto a sinistra, **pulsante floating trasparente in basso a destra** che apre un menu: Apri Observe™, Condividi (Share), RePost, Apprezza (interact observed + cuore animato), Audio ON/OFF (solo se `music.audio_url`), Salva. Routing: `PulseRing` (SnapSenseBar) e `ObservationCard` con `is_pulse` → `/pulse-view` invece di observation-detail. Verificato via screenshot (menu ok).
- **#5**: già rispettato — post-pubblicazione si modificano solo legenda Sense/privacy/tag/posizione, non il contenuto creativo.
- DA FARE (grandi, da pianificare): **#3 editor creativo stile Stories** (testi/font/colori/resize/rotazione/sticker/emoji/ora/data/posizione/GIF/disegno/audio/musica/countdown/tag) — feature molto ampia, da fasare; **#4 messaggi vocali** (registrazione+upload+playback su Observe/Pulse/SenseShot).

### SESSIONE (fork) — #4 Messaggi vocali (FATTO)
- Backend (`social.py`): `POST /api/media/audio` (base64→media doc uuid, max ~8MB, auth) servito da `GET /api/media/{id}`. CreateObs + obs_public: campo `voice {media_id, duration, url}`. Testato via python.
- Frontend: `src/components/Voice.tsx` → `VoiceRecorder` (composer: expo-audio `useAudioRecorder`, permesso mic contestuale con fallback Impostazioni, max 60s, upload → media_id, preview) + `VoicePlayer` (viewer). Integrato in `publish-composer` (sezione "Messaggio vocale"), `observation-detail` (player sotto caption/musica) e `pulse-view` (player compatto sopra il FAB). `RECORD_AUDIO` aggiunto ad app.json (mic già in infoPlist). Lint pulito, bundle OK.
- ⚠️ Registrazione = NATIVA (mic) → validare su BUILD; il player si può testare su web con un media audio reale.

### ROADMAP feature grandi richieste (da costruire a fasi)
- **#3 Editor creativo stile Stories** (PROSSIMO): Fase A = testi multi-font/colori/resize/rotazione (drag con gesture-handler+reanimated) + tag/ora/data/posizione, cattura composita via react-native-view-shot. Fase B = disegno a mano + sticker/emoji. Fase C = GIF + countdown + audio/musica nell'editor.
- **The Sense Collection™**: SenseShot/Pulse temporanei (24h) → entrano in Collection permanenti (manuali o automatiche/dinamiche per regola es. "tutti i tramonti"), con copertina/nome/descrizione/#Sense/#views/#observers/ultimo aggiornamento, privacy (privata/amici/pubblica), collaborative, mostrate anche sotto gli Observe ("Fa parte della Collection: …").
- **Observe World™**: archivio mondiale curato da OverView (non feed, griglia 5 Discovery Card/riga), promozione automatica per rarità/valore scientifico/verifiche ecc. (algoritmo non svelato), badge permanente 🌍 Observe World, niente like (solo indicatori di valore: Scientific Value, Reality Score, Verified, Rare, Historic, First, Confirmed…). Pulse/SenseShot selezionati diventano permanenti.

### SESSIONE (fork) — #3 Fase A: editor creativo testi (FATTO)
- `src/components/SenseEditor.tsx`: editor full-screen sulla foto. Aggiungi testo (multi-font: Bold/Regular/Mono/Medium, 8 colori), ogni testo è **draggabile/scalabile/ruotabile** (gesture-handler Pan+Pinch+Rotation + reanimated). Chip rapidi **Ora/Data/Posizione** (inseriti come testo). Doppio tap = modifica testo, selezione = bordo + elimino. "Fatto" → `captureRef` (react-native-view-shot) dell'immagine composta → torna al composer.
- Integrato in `publish-composer`: pulsante "Aggiungi testo/Modifica creatività" sulla foto; l'immagine composta (`editedUri`) sostituisce la base per la pubblicazione. `RECORD_AUDIO` già aggiunto.
- ⚠️ Editor (gesture + captureRef) e cattura = validare su BUILD. Lint pulito, bundle OK.
- RESTA di #3: Fase B (disegno a mano + sticker/emoji), Fase C (GIF + countdown + audio/musica nell'editor). Poi: The Sense Collection™, Observe World™ (vedi roadmap sopra).

### SESSIONE (fork) — Fase 3B editor + The Sense Collection™ + Observe World™ (FATTO)
- **SenseEditor Fase 3B** (`src/components/SenseEditor.tsx`): completati **adesivi/emoji** (pannello 22 emoji, sticker draggabili/scalabili/ruotabili come i testi, inclusi nel `captureRef`) oltre al **disegno a mano libera** (SVG `Path` + undo, già presente). Lint pulito. ⚠️ Editor completo da validare su BUILD nativa.
- **The Sense Collection™** (backend `sense_world.py` + `app/collections.tsx` + `app/collection.tsx` + `src/components/AddToCollection.tsx`):
  - Cartelle di Senshot **manuali** o **dinamiche** (auto_rule per categoria → raccoglie in automatico i propri Senshot). Visibilità: private/friends(mutual-follow)/public/collaborative.
  - Endpoint: POST `/collections`, GET `/collections/mine`, GET `/users/{id}/collections`, GET `/collections/{id}`, PATCH, DELETE, POST/DELETE `/collections/{id}/items`.
  - UI: lista con cover+badge (Auto/visibilità), modale creazione (visibilità + toggle dinamico + chip categoria), dettaglio con griglia + rimozione item + elimina collezione.
  - Ingressi: profilo "Collezioni" (mio) + "Collezioni" (altri utenti), observation-detail "Aggiungi a una collezione".
- **Observe World™** (backend `sense_world.py` + `app/observe-world.tsx`):
  - Museo curato dal sistema. **NIENTE like/popolarità**: ranking `reality_score` = 0.48·scientific + 0.34·rarity + 0.12·verified + 0.06·ai. Badge onesti: Reality Score, Valore Scientifico, Verificata, Rara.
  - Endpoint: GET `/observe-world` (hero + sezioni orizzontali per categoria), GET `/observe-world/section/{key}` (griglia completa). Soglia ammissione `reality_score>=25`.
  - UI: hero "Opera in evidenza", sezioni orizzontali (In evidenza/Aurore/ISS/Via Lattea/Pianeti/Cielo Profondo/Osservazione Terra), banner d'ingresso in cima al feed.
- Verifica: backend curl (CRUD collezioni + add item + observe-world sezioni OK); screenshot web (Observe World hero+badge+sezioni, Collezioni lista+modale creazione). Lint pulito su tutti i file. NO test agent (per volere utente).

### SESSIONE (fork) — Share Hub™ + Control Center™ + i18n (FATTO)
- **Share Hub™** (`src/components/ShareHub.tsx`): il tasto "Share" NON apre più il menu nativo. Apre un pannello interno OverView con: ⚡ Publish as Pulse™ (conversione), ✨ Publish as SenseShot™ (apre l'editor Stories `SenseEditor` → SnapSense 24h), 🔁 Repost, 💬 Direct Message (lista OViewers/Observers via nuovo `GET /api/users/me/connections`, selezione multipla, invio DM kind=observation), 🌍 Share externally (UNICA voce che apre il menu nativo iOS/Android via expo-sharing, fallback RN Share). Integrato in `observation-detail` (share ora per tutti gli utenti loggati, non solo autore) e `pulse-view` (rimosso `Share.share` nativo diretto). Rimosso il vecchio share modal snapsense/pulse.
- **Control Center™** (`app/control-center.tsx` + `src/components/ControlCenterMark.tsx`): hub impostazioni con **icona esclusiva** (radar/cabina di comando SVG, non ingranaggio). Sezioni raggruppate (Tu/Esperienza/Sistema/Supporto): Account→edit-profile, Language→cc-language, Discover→cc-discover, Audio→cc-audio, Sense Vision→cc-sensevision, Notifications→notification-settings, Privacy→privacy-consent, Security(soon), Memory→cc-memory, Data(soon), Feedback→feedback, Information→about, Console→creator (solo developer). Nuove sotto-schermate: `cc-language`, `cc-audio` (autoplay/muted/voice toggle, storage locale), `cc-sensevision` (quality/autolayer/AI toggle + Sense DNA soon), `cc-memory` (dimensione cache reale + pulizia via expo-file-system), `cc-discover` (chip interessi/categorie, storage locale).
- **Profilo ripulito**: rimossi Discover/Privacy/Notifiche/Feedback/Console dal profilo. Restano identità + **Control Center** + **Collezioni** (+ Modifica profilo). Profilo = "Chi sono", Control Center = "Come funziona OverView".
- **i18n** (`src/context/LangContext.tsx` + `src/i18n/translations.ts`, `LangProvider` montato in `_layout`): regola utente — UI base e termini proprietari (Home/Profile/Save/Share/Publish/Discover/Privacy/Audio/Control Center/Observe/Pulse/SenseShot/SnapSense/Live Sense/Pure Sense/Reality Sense/Go There/Sense Vision/OverView Guide) restano in **inglese universale in entrambe le lingue**; solo testi descrittivi/informativi/legali/AI cambiano IT/EN. Switch istantaneo via `useLang().t(key)`, persistito in storage. Dizionario iniziale copre Control Center + esempio "Sky Hidden". Estendibile progressivamente ad altre schermate e lingue.
- Verifica: backend curl (connections OK), lint pulito su tutti i file, screenshot web (Share Hub wired, Control Center con icona+gruppi, cambio lingua IT↔EN istantaneo su "Sky Hidden"). NO test agent (per volere utente). NOTA: editor/DM/share esterno si validano appieno su build nativa.

### SESSIONE (fork) — Sky Visibility™ + Sense Auto Mode™ (FATTO)
- **Problema**: `cielo.tsx` (AR cielo) proiettava stelle/pianeti/costellazioni/satelliti anche puntando la fotocamera a terra/muri, come semplice overlay non contestuale.
- **Sky Visibility™** (`src/lib/skyVisibility.ts`): prima di mostrare qualsiasi oggetto astronomico si calcola quanto cielo è realmente visibile.
  - Segnale real-time offline **autoritativo = pitch/elevazione fotocamera** (`cameraAlt` da accelerometro): `pitchVisibility()` → 0% guardando in basso (~-15°), 100% verso l'alto (~+25°). Risolve subito il caso "punto a terra".
  - Raffinamento **AI di scena** (`POST /api/ai/scene`, gpt-5.4 vision, fails-open): distingue muri/soffitti/interni/terra dal cielo aperto che il solo pitch non può. Cattura periodica (ogni 9s, best-effort; su web/Expo Go degrada al solo pitch). `combineVisibility()` fa il veto se la scena non è cielo.
  - Score → bucket 0/25/50/75/100. Sotto soglia (`SKY_THRESHOLD=35`) TUTTI gli oggetti astronomici (stelle, pianeti, costellazioni, satelliti) sono **nascosti**.
- **Sky Hidden™ card**: quando il cielo non è visibile compare una card elegante con messaggio ("Punta la fotocamera verso il cielo per attivare Sky Vision") + barra **Sky Visibility™ %**. La % appare anche nella pill bussola (Sky N%).
- **Sense Auto Mode™**: chip in alto che mostra il "Sense" attivo dedotto dalla scena — Sky Vision ☁️ / Surface Sense 🧱 / Ground Sense 🪨 / Bio Sense 👤 / Nature Sense 🌳 / Object Sense 🚗 / Water Sense 🌊 (+ Thermal/Energy manuali). Cambio **automatico ma sovrascrivibile** dall'utente (menu Auto + 7 modalità, badge AUTO/MANUAL).
- Verifica: lint pulito, backend `/api/ai/scene` OK (fails-open su input non valido; chiave+modello validi), bundle cielo.tsx compila e rende (web mostra prompt fotocamera). ⚠️ **Validazione completa solo su BUILD NATIVA** (fotocamera + accelerometro + AI su frame reali; non su Expo Go/web).

### SESSIONE (fork) — Sky Vision™ Costellazioni WOW + fix coerenza (FATTO)
- **Bug coerenza rilevamento↔visualizzazione**: le righe dati in `observation.tsx` e `observation-detail.tsx` ora mostrano "Costellazioni nell'inquadratura" (solo in-frame, via `activeConstellations` sulle stelle proiettate) vs "nel cielo"; "Pianeti nel cielo" invece di "visibili". `SenseRecognized` già separa "Riconosciuti · X/Y" (in-frame) da "Nella tua direzione" (fuori inquadratura). Niente più "N rilevati" con foto vuota.
- **Dataset scientifico** (`src/lib/constellations.ts`): 15 costellazioni prominenti (Orione, Orsa Maggiore/Minore, Cassiopea, Cigno, Leone, Gemelli, Toro, Scorpione, Lira, Aquila, Boote, Cane Maggiore, Perseo, Andromeda) con membership stelle, **linee ufficiali stile IAU**, ordine `figure` per la figura di luce, `summary` IT/EN e `info` completa (storia, mitologia, periodo migliore, curiosità). `STARS` esteso con ~52 stelle reali (RA/Dec/mag/distanza/spettro) per i pattern. `CONSTELLATION_LINES` ora derivato dal dataset (rimosso da stars.ts; import aggiornati in cielo/observation/observation-detail).
- **Componente `SkyVision.tsx`** (`ConstellationLayer`): rileva le costellazioni con abbastanza stelle in frame e disegna 4 layer indipendenti — ⭐ Stelle · ✨ Linee · 🌌 Figura di luce (poligono semi-trasparente generato DALLE stelle reali, opzione A) · 📖 Nome. **Animazione WOW ~1s**: nome → stelle si accendono in sequenza → linee rivelate progressivamente (impulso) → figura di luce. Stelle solo realmente in frame; linee si interrompono dove mancano stelle.
- **Layer toggle** in `cielo` (bottone "Layers": Nome/Stelle/Linee/Figura di luce/Info).
- **Interazione**: tap stella → ObjectSheet (nome, magnitudine, distanza, tipo spettrale). Tap nome costellazione → **`ConstellationSheet`**: Sense Summary™ (lettura breve) + pulsante **Explore** → scheda completa (storia, mitologia, stelle principali con mag/distanza/spettro, curiosità, periodo migliore). IT/EN via useLang.
- **First Discovery** ✨: badge discreto la prima volta che si riconosce una costellazione (persistito in storage `discovered_constellations`).
- **AI di scena** (`/api/ai/scene`) già usato per Sky Visibility resta attivo.
- Verifica: lint pulito su tutti i file, bundle `cielo.tsx`/`observation*.tsx` compilano e rendono. ⚠️ **WOW animation, figura di luce, tap e riconoscimento live si validano SOLO su BUILD NATIVA** (fotocamera + accelerometro); su web/Expo Go si vede il prompt fotocamera.

### SESSIONE (fork) — Costellazioni in Observe + SnapSense/Pulse Viewer Fase 1 (FATTO)
- **Costellazioni nello snapshot Observe** (`observation.tsx`): oltre alle linee ufficiali, ora disegna la **figura di luce** (Polygon semi-trasparente dalle stelle reali) e mostra il **nome tap→ConstellationSheet** (Sense Summary™ + Explore). Conteggi coerenti "Costellazioni nell'inquadratura" (via activeConstellations sulle stelle proiettate).
- **SnapSense™/Pulse™ Immersive Viewer — FASE 1** (`SnapSenseBar.tsx` + backend `snapsense.py`):
  - Barra segmenti in alto con **avanzamento animato** (~10s foto / 7s testo, tick 50ms), completato/in-corso/vuoto.
  - Navigazione: **tap dx→successivo, tap sx→precedente, hold→pausa** (rilevamento durata <260ms = tap), **swipe giù→chiudi, swipe orizzontale→utente prec/succ** (PanResponder).
  - **Anello visto/non visto** (backend `snapsense_views` + `POST /api/snapsenses/{id}/seen`; list include `seen`/`has_unseen`), apertura dal **primo non visto**.
  - **Badge proprietario** SnapSense™/Pulse™ nell'header del viewer.
  - **Comandi in sovraimpressione** minimali: campo "Invia un messaggio…", reactions (heart), audio ON/OFF (icona OverView), menu.
  - Il proprio anello resta primo; delete del proprio contenuto nel viewer.
- Verifica: lint pulito, backend `/api/snapsenses` (+seen) OK, feed+barra rendono su web. ⚠️ Gesti/hold/progresso e viewer completo si validano meglio su **device**.
- **DEFERITO (Fase 2/3, come da piano concordato)**: consegna reale reply→DM con miniatura, reactions con notifica autore, notifiche per commento/reaction/share/repost/sfida/salvataggio, unificazione dei Pulse™ recenti nella stessa sequenza, privacy per-contenuto, scadenza→archivio automatico.


---
## Session Update — SnapSense™/Pulse™ Fase 2 & 3 (completata)
- **Rendering risposta SnapSense nei DM** (`app/chat.tsx`): card dedicata `kind === "snapsense"` con header "Risposta a SnapSense™/Pulse™", anteprima immagine + caption, bolla di testo della risposta, tap-to-preview a schermo intero (disabilitato se scaduto → placeholder "scaduto"). Verificato via screenshot.
- **Privacy SnapSense** (`snapsense.py` + `SnapshotStudio.tsx`): campo `visibility` = public/followers/private. `GET /api/snapsenses` filtra in base al follow del viewer. Selettore segmentato "Tutti/Follower/Solo tu" nel composer. Verificato E2E (public visibile, followers nascosto fino al follow).
- **Auto-archiviazione**: gli SnapSense scaduti restano in DB (nessun delete). Nuovo `GET /api/snapsenses/mine/archive` + sezione "Archivio SnapSense · scaduti" nel tab SnapSense del proprio profilo (immagini dimmed + badge orologio).
- **Notifiche autore**: reazioni (`/react`) e risposte DM (`snapsense` message) notificano già l'autore.



---

## ⭐ PRINCIPIO FONDANTE — "Content First" / Uguaglianza Osservativa (20/07/2026)
**REGOLA INVIOLABILE per OGNI lavoro futuro su feed, ranking, distribuzione, Observe World, Pulse, SnapSense.**
OverView NON è un social di creator/influencer/VIP. Vince il CONTENUTO, mai la popolarità dell'autore.
Il ranking NON deve MAI usare: numero di follower/Observer™/oViewers™, anzianità account, frequenza di
pubblicazione, notorietà, verifiche account, collaborazioni, o qualsiasi metrica legata alla persona.
Ogni nuovo Observe™/Pulse™/SenseShot™ parte con lo STESSO identico peso. Sarà il contenuto a guadagnarsi
più diffusione. Fattori di ranking AMMESSI (solo contenuto/community): valore scientifico, rarità, qualità,
originalità, rilevanza geografica, momento di pubblicazione, qualità delle interazioni ricevute sul contenuto,
conferme della community, validazione automatica OverView. Observe World™ = vittoria dell'osservazione, non
della persona (autore sempre riconosciuto, ma protagonista = ciò che è stato osservato).

**STATO ATTUALE (verificato, già CONFORME):**
- `social.py` → `smart_score`: `sv*0.34 + aff*0.22 + rare*0.16 + recency*0.16 + pop*0.10 + prox*0.02`.
  Nessun segnale legato a follower/Observer/oViewers/età account/notorietà. `aff`=affinità di CATEGORIA del
  viewer (personalizzazione lato osservatore, non fama autore); `pop`=interazioni SUL contenuto (conferme community, ammesso).
- Observe World™ `sense_world.py` → `reality_score`: `sv*0.48 + rarity*0.34 + verified*0.12 + ai*0.06`.
  Ignora deliberatamente popolarità (osservato/saves/repost). 100% contenuto.
- Nessun endpoint di ranking legge `follows`/conteggi autore per ordinare i contenuti.

**ENHANCEMENT PROPOSTO (da confermare):** "fresh-start fairness boost" → garantire a ogni contenuto nuovissimo
(0 interazioni) una finestra di esposizione iniziale equa nelle prime ore, così il primo Observe di un
principiante parte davvero alla pari. Aggiungere anche commento/guardia nel codice che vieta esplicitamente
qualunque segnale author-popularity nel ranking.

## 📌 BACKLOG PRIORITIZZATO — richieste utente in memoria (17/07/2026)

### 🔴 P0 — Share Hub™ unificato (OBBLIGATORIO, no dipendenze native)
**QR CODE (20/07/2026):** ✅ FATTO lato-app.
- Toggle "Includi QR code" al salvataggio/export in `observation.tsx` (DEFAULT OFF). Governa sia il watermark della cattura live sia la `DiscoveryCard` (prop `showQr`).
- QR ora punta alla landing smart backend `GET /api/go/{id}` (`src/lib/deeplink.ts` → `observationLandingUrl`). La landing prova `overview://observation-detail?id=<id>` (schema app aggiunto in app.json: `["overview","frontend"]`); se l'app non è installata reindirizza allo Store (env `APPSTORE_URL`/`PLAYSTORE_URL`, oggi placeholder), su desktop apre la pagina web.
- RESIDUO POST-DEPLOY: sostituire `app-id`/`APPSTORE_URL` con l'ID reale App Store dopo l'approvazione; `PLAYSTORE_URL` già usa il package `sense.invisible.overview`. Universal/App Links (AASA/assetlinks) opzionali per apertura diretta da link tappati fuori dal QR. Il deep-link in-app è testabile solo su build nativa/TestFlight.
- UNIVERSAL LINKS (opzione A = dominio Emergent, 20/07): creati `frontend/public/.well-known/apple-app-site-association` (Team ID `853F5S8843.sense.invisible.overview`) e `assetlinks.json` (placeholder SHA256). Aggiunti in app.json: iOS `associatedDomains: applinks:invisible-sense.preview.emergentagent.com` + Android `intentFilters` (host preview, pathPrefix /api/go). **AL DEPLOY:** sostituire il dominio preview con il dominio di PRODUZIONE Emergent in `associatedDomains` + `intentFilters`; per Android inserire lo SHA256 reale del certificato di build in `assetlinks.json`. App Store ID numerico ancora mancante (si genera creando la scheda app in App Store Connect → Informazioni generali → "Apple ID").

**STATO (parziale, 20/07/2026):** ✅ FATTO — Observe feed + tutti i contenuti resi via `ObservationCard`/`ActionBar` e `observation-detail`/`pulse-view` ora aprono lo Share Hub™ (mai il menu nativo). ShareHub aggiornato con le 6 voci in inglese: Publish as Pulse™ · Publish as SenseShot™ · Repost · Send via Direct Message · Copy Link · Share Externally (unica che apre l'OS). Verificato via screenshot.
**RESIDUO da decidere con l'utente:** superfici che condividono un'immagine/export SENZA una FeedObservation pubblicata → oggi usano ancora share nativo: `observation.tsx` (export cattura/card), `cosmic-object.tsx` (snapshot oggetto), `opportunity.tsx` (share testo), `SnapshotStudio.saveOrShare` (Salva/Condividi). `discover-people` = invito referral (non è share di contenuto). Serve una variante ShareHub "obs-less" (Copy Link + Share Externally + eventuale Publish) per queste.

Regola unica e assoluta: da QUALSIASI pulsante Share dell'app (Observe, Pulse, SenseShot,
Pure Vision™, Gallery, Saved, Profile, Observe World™ e ogni contenuto condivisibile futuro),
il PRIMO tap deve SEMPRE aprire lo Share Hub™ interno di OverView. MAI il menu nativo iOS/Android direttamente.
- Bug attuale: da Pure Vision™ (menu ⋯) apre correttamente Share Hub™, ma da Observe e altre schermate
  il pulsante Share apre direttamente il menu nativo. Da eliminare.
- Voci Share Hub™ (SEMPRE in inglese):
  • Publish as Pulse™
  • Publish as SenseShot™
  • Repost
  • Send via Direct Message
  • Copy Link
  • Share Externally  ← UNICA voce che apre il menu nativo (AirDrop/WhatsApp/Telegram/IG/Email…)
- Coerenza assoluta: stesso identico Share Hub™ ovunque. "Tap su Share = Share Hub™. Sempre. Mai eccezioni."
- Obiettivo UX: trattenere l'utente nell'ecosistema OverView. Prima COME condividere dentro OverView,
  poi (se vuole) DOVE via OS. Il sistema operativo è sempre l'ultima scelta, mai la prima.
- File: `src/components/ShareHub.tsx` (già esiste) + audit di tutti i punti che chiamano `Sharing.shareAsync`/share nativo
  in Observe, Gallery, Saved, Profile, Observe World, feed cards, ecc. → sostituire con apertura ShareHub.

### 🟠 P1 — Sense Vision™: Night Vision / Low Light (RICHIEDE BUILD NATIVA — non testabile su Expo Go/web)
Obiettivo: ottenere SEMPRE la massima qualità possibile dall'hardware, mai dettagli inventati.
Filosofia: "la migliore interpretazione della realtà che l'iPhone è realmente in grado di acquisire,
mai una ricostruzione artificiale della scena" (coerente con Beyond View).
- Migliorare qualità fotocamera in scarsa illuminazione (anteriore E posteriore), oggi inferiore alla Camera nativa iOS.
- **Night Vision™ (modalità OPZIONALE)**: quando ON, usa automaticamente tutte le tecnologie del device:
  Night Mode, esposizione più lunga, multi-frame, Deep Fusion, Smart HDR, riduzione rumore, stabilizzazione,
  massima qualità sensore. Non una semplice schiaritura, ma vera acquisizione ottimizzata.
- **Fotocamera anteriore**: sfruttare il massimo delle capacità iPhone; se il volto è rilevato ma migliorabile,
  continuare l'elaborazione automatica finché possibile.
- **Comportamento intelligente**: se Night Vision™ OFF → comportamento normale. Se ON → Sense Vision™ decide
  automaticamente quando applicare le elaborazioni avanzate, mostrando indicatore leggero:
  "Optimizing…" / "Night Vision™" / "Enhancing…" finché raggiunge la migliore qualità.
- Nota tecnica: dipende da `react-native-vision-camera` + formati/HDR nativi; molte capacità non emulabili su web.
  Valutare API camera (photoQualityBalance, enableHdr, low-light-boost, formato con exposure range più ampio).


---

## Sense Vision™ — WYSIWYG Overlay Engine + Geographic Layer (2026-07)

### Motore overlay unificato (WYSIWYG)
- `src/lib/senseFrame.buildOverlay` + `src/components/SenseSkyOverlay` = UNICO motore/renderer condiviso
  tra anteprima live (`sense-vision.tsx`) e foto finale (`observation.tsx`). Nessun secondo calcolo astronomico.
- Anteprima mostra un riquadro **4:5 reale** (uguale alla card salvata) con stessa proiezione (camAz/camAlt + FOV/zoom).
- **Freeze** allo scatto: `ObsData.zoom` (FOV) + posizioni astronomiche già congelate + `ObsData.places`.
- Fix pitch: `project.cameraAltFromAccel` (segno corretto; alzando la fotocamera gli oggetti scendono).
- Stelle riconosciute = veri marker (alone + punto + nome), rispettano toggle Overlay/Nomi/occhio.
- Toggle indipendenti: **Overlay** (grafica) e **Nomi** (etichette).
- **WOW reveal**: stelle→impulso→linee→nomi; pianeti/luoghi→impulso→alone→nome (~600ms).

### Layer Geografico "Luoghi" (rivela ciò che esiste, non AI immagine)
- Backend `GET /api/geo/places` (`backend/geo_places.py`): OpenStreetMap/Overpass. Calcola azimut + angolo di
  elevazione REALE (curvatura terrestre + rifrazione) da GPS+coordinate. Categorie: città, montagne, vulcani,
  monumenti, castelli, torri, fari, isole, acqua, aeroporti, stadi, cattedrali. Cache 2 livelli (memoria + Mongo `geo_cache` 30g).
- Frontend: `src/lib/places.ts`, `src/components/SenseGeoOverlay.tsx` (identità teal), toggle "Luoghi" + raggio (15/60/200km)
  in `sense-vision.tsx`; render in `observation.tsx`; incluso in `frameObjects`/Riconosciuti (kind "Luogo", no occlusione orizzonte).
- CAVEAT: Overpass pubblico è rate-limited/variabile da IP datacenter; la cache mitiga in produzione. Overlay = device-only.
- FUTURO: fonte dati keyed (Mapbox/GeoNames) se serve maggiore affidabilità; elevazione terreno via DEM per profili montani.

---

## SESSIONE (fork) — Revisione completa Observe: pipeline blindata + viewer unificato + Pulse storie

Richiesta utente: stop ai fix isolati, revisione architetturale di Observe. Galleria = archivio personale; Observe = stessa identica scheda in versione social (cambiano solo le azioni finali). Zero data-loss.

### Fase 1 — Pipeline di pubblicazione blindata (FATTO, verificato curl)
- `src/lib/pendingPublish.ts`: la coda ora salva la URI locale dell'immagine e la RILEGGE ad ogni flush → una Sense-immagine non viene MAI pubblicata senza media né persa.
- `publish-composer.tsx` + `observation.tsx`: se `image_base64` non è pronto → NON si invia; si accoda con `imageUri` e retry automatico. (Fix anche route errata `/(tabs)/feed` → `/feed`.)
- Backend `social.create_observation`: rete di sicurezza → `media_type=="image"` senza media valido ⇒ HTTP 400 (niente post/Pulse vuoti). Verificato: imageless→400, con img→200.

### Fase 2 — Viewer UNIFICATO (FATTO)
- NUOVO `src/components/SenseDetail.tsx`: motore condiviso (immagine+overlay Sky/Geo+Nomi+Riconosciuti+Sense Layer+Explain+Dati+watermark+gesture Pure/Reality). Usato SIA da Galleria SIA da Observe.
- `observation.tsx` (Galleria) = wrapper con azioni PERSONALI (Condividi, Salva in Foto, Esporta Discovery Card, Pubblica, QR toggle).
- `observation-detail.tsx` (Observe) = stesso `SenseDetail` con SOLO azioni social (InteractionBar reazioni, ActionBar commenti/repost/save/share ShareHub, Collezione, Invia/Condividi). Rimosse Salva in Foto / Esporta Discovery Card / Pubblica.
- Config del proprietario (Overlay/Nomi/Sense Layer attivi) salvata: Galleria→`updateObservationConfig` (locale), Observe autore→PATCH `sense_layers/legend_*`; diventa stato iniziale per tutti, ogni osservatore la modifica senza toccare l'originale.
- Nuovo campo `ObsData.senseLayers`; backend `UpdateObs.sense_layers`. Verificato: PATCH persiste `data.senseLayers`.

### Fase 3 — Toggle generale Sense Layer (FATTO, dentro SenseDetail)
- Pulsante "Mostra tutti / Nascondi tutti" oltre ai singoli toggle.

### Fase 4 — Pulse come Storie Instagram (FATTO)
- `SnapSenseBar.tsx`: `mergeGroups()` unisce SnapSense + Pulse in UN solo gruppo per utente (un cerchio, riproduzione in sequenza, progress bar per item, nessun duplicato). Guardie per item Pulse: seen skip, delete via `socialApi.deleteObservation`, react via `socialApi.interact`.

Principio modulare confermato: ogni nuova funzione va in `SenseDetail` → disponibile in Galleria e Observe senza duplicare codice.

Device-only: cattura Sense Vision + Galleria (file locali). Da testare col testing_agent: backend pipeline + rendering Observe unificato.

---

## SESSIONE (fork) — Fix critici pubblicazione + Pulse (iter 6)

Problema reale: la pubblicazione su Observe finiva SEMPRE in coda ("In preparazione") perché `senseImageBase64` restituiva null sul device.
- **Fix pubblicazione immediata:** `imageUpload.ts` ora legge l'immagine con 3 strategie robuste: (1) manipulate resize+compress, (2) **fetch(file://)->FileReader base64** (funziona ogni volta che l'immagine è visibile), (3) FileSystem raw. La coda resta SOLO fallback per rete/server assenti. La coda esistente si auto-svuota al foreground con il nuovo reader.
- **Pulse effimeri (24h) end-to-end:** `create_observation` salva `pulse_expires_at=+24h`; `pulse_feed` filtra `created_at>=now-24h` e `has_image=True` → niente Pulse scaduti né vuoti. Cleanup all'avvio elimina i Pulse senza immagine.
- **Menu tre puntini** nel viewer Pulse: menu contestuale funzionante (owner: Elimina/Copia link/Info; altri: Copia link/Segnala/Non mi interessa). Copia link reale via expo-clipboard.
- **Conferma eliminazione** Pulse: overlay inline "Eliminare questo Pulse?" con Annulla/Elimina + stato loading, anti doppio-tap.
Verificato testing_agent iter6: backend 6/6, frontend menu+conferma+one-ring OK.
NOTA: la pubblicazione end-to-end (cattura reale) è device-only → validare su build TestFlight.

---

## SESSIONE (fork) — Identità autore + Search/Explore (iter8)

Ordine utente rispettato (1 pubblicazione già risolta lato codice → 2-5 qui).
2. **Nickname univoci**: indice unico `nickname_lower` (già presente) + endpoint `GET /api/auth/nickname-available` (case-insensitive, valida lunghezza/caratteri) + componente `NicknameField` (check real-time con debounce, "disponibile/già usato", suggerimenti) in register.tsx e edit-profile.tsx. Validazione formato anche nel PATCH /users/me.
3. **Codice autore univoco/immutabile (3 char)**: `author_code` generato alla registrazione (derivato dal nickname, reso univoco via indice unico + retry su DuplicateKeyError), immutabile anche al cambio nickname, mai riusato. Backfill idempotente all'avvio (NeoMorpheus→NEO, explorer→EXP). Esposto in public_user / profilo / obs_public. Confermato dall'integration_expert: nessuna modifica a bcrypt/JWT.
4. **Nuovo formato ID SenseShot** `#NEO-000000021`: `observationCode(seq, authorCode)`; salvato in `data.senseCode` alla pubblicazione così Observe mostra lo stesso ID della Galleria.
5. **Search/Explore**: `GET /api/search?q=&offset=&limit=` (match su titolo/descrizione/hashtag/autore/luogo/oggetti/costellazioni/pianeti/senseLayer/categoria + hint linguistici: finestra temporale, "vicino a <luogo>"; ranking per valore scientifico, NON per popolarità). Nuova schermata `app/search.tsx`: barra fissa, chip suggerimenti, griglia 5 colonne, scroll infinito, pull-to-refresh, quick-view (`SenseQuickView`: foto + overlay/nomi con config del proprietario, swipe tra risultati, azioni social, "Apri scheda completa" / doppio tap → observation-detail). Bottom nav ora a **7 slot** (Home, Search, Pulse, Sense Vision centro, Observe, Messaggi, Galleria).

Riuso totale: Search usa lo stesso modello dati, stessa anteprima e la stessa scheda completa (observation-detail = SenseDetail) di Observe.

---

## SESSIONE (fork) — Explore™ + hashtag intelligenti (iter10)

- **#5 Hashtag intelligenti**: nel Composer ogni parola digitata nel campo hashtag diventa automaticamente #parola (anteprima chip live sotto il campo, nessun doppio #). `parseTags()` già normalizzava lato dati.
- **#6 OverView Explore™**: rinominata la sezione lente (BottomNav "Explore" + titolo "OverView Explore™"). Chip dinamiche/trending da `GET /api/search/trending` (top hashtag ultimi 30gg, fallback statico). Visualizzazione rapida ora a **scroll verticale continuo** tra tutte le Sense (SenseQuickView), secondo tap → scheda completa Observe. Griglia 5 colonne invariata.
- **#4 Codice Autore**: già implementato in iter8 (nickname univoco + prefisso 3 char immutabile + ID #NEO-000000021). Nessuna azione ulteriore necessaria.

RIMASTI DA FARE (confermati con l'utente):
- **#1 Creator Console operativa**: rendere ogni riquadro cliccabile → sezioni di dettaglio (Utenti: elenco+ricerca+sospendi/riattiva+contatori; Nuovi iscritti: elenco cronologico con piattaforma/ultimo accesso; SenseShot: elenco+filtri+apri; Feedback apribili; Bug con stati Nuovo/In lavorazione/Risolto/Chiuso; **System Health**: backend/db/storage/spazio/immagini/upload falliti/pubblicazioni fallite/code/errori/versione build).
- **#2/#3 Storage esterno Cloudflare R2** (S3-compatibile): media fuori dal DB, con varianti Master/Detail/Feed/Thumbnail; Mongo conserva solo metadati/URL. RICHIEDE credenziali R2 dall'utente + integration_expert.

---

## SESSIONE (fork) — Creator Console operativa + Sospensione read-only (COMPLETATO E VERIFICATO)

### Creator Console frontend (`app/creator.tsx` riscritto a pannelli)
Tab navigabili: **Panoramica · Utenti · Iscrizioni · Contenuti · Feedback** (guard: solo `role=developer`, gestito anche lo stato `loading` per non lampeggiare "Pagina non disponibile").
- **Panoramica**: griglia statistiche (utenti/Senshot/SnapSense/feedback aperti/bug attivi/nuovi mese) + **Salute del sistema** (backend/database online, build, immagini archiviate, spazio media, dati DB, utenti sospesi, pubblicazioni fallite, pulse vuoti, bug aperti).
- **Utenti**: ricerca (nickname/email/codice), lista con author_code + contatori (senshot/pulse/feedback) + dot rosso se sospeso. Tap → **modale dettaglio** con azione **Sospendi (sola lettura)** [motivazione + durata: Indefinita/1g/7g/30g] o **Riattiva account**. Account protetti (`protected`) non sospendibili.
- **Iscrizioni**: lista signups recenti con badge "Sospeso".
- **Contenuti**: griglia 3-col Senshot/Pulse con filtro + ricerca.
- **Feedback**: invariato (status cycle, priorità, note del Creator).
Binding API aggiunti in `backend.ts` (`creatorApi.users/userDetail/suspend/unsuspend/signups/observations/systemHealth` + tipi). Backend `feedback.py` era già pronto.

### Sospensione read-only (utente sospeso)
- `AuthUser.suspension` aggiunto; `/api/auth/me` e login già lo restituiscono.
- **`src/components/SuspensionBanner.tsx`** (montato globalmente in `_layout.tsx`): banner rosso persistente "Account in sola lettura" con **motivazione + durata** + "Puoi navigare ma non pubblicare o interagire" + pulsante **Richiedi chiarimenti**. Collassabile in pill "Sola lettura". Non blocca la navigazione.
- Le write API (`create_observation`, `interact`, `add_comment`) usano già `get_active_user` → 403 `{code:"suspended", reason, until, message}`. `client.ts` ora estrae `code`/`message` dai detail strutturati; `publishError.ts` mostra il messaggio di sospensione.

### "Support" — identità Creator mascherata (richiesta utente)
- Gli utenti NON vedono mai il nick/nome di NeoMorpheus nelle DM: `dm.py._user_public()` maschera l'account `role=developer` come **"OverView Support"** (`is_support:true`) per chiunque non sia developer. NeoMorpheus vede invece i nick reali.
- **`POST /api/support/clarification`**: apre/riusa una DM con il Creator e semina un messaggio che **specifica sempre il motivo** ("📋 Richiesta di chiarimento sulla sospensione. Motivo indicato: …"). Il banner "Richiedi chiarimenti" apre `/chat` mascherato come "OverView Support". Notifica push al Creator.

### Verifica
- Backend curl: tutti gli endpoint creator 200; suspend→/me suspension→comment 403 suspended→unsuspend→cleared; support/clarification 200; masking apple↔developer = "Support".
- Frontend screenshot: Panoramica, Utenti, modale Sospendi (motivazione+durata), banner sola-lettura, chat "OverView Support" con motivo seminato. Tutto OK.
- Account revisione Apple riattivato dopo il test.

### PROSSIMO (ordine concordato con l'utente)
- **Cloudflare R2** (l'utente ha detto "pronto per R2"): migrazione storage immagini da base64 Mongo a R2 (Master/Detail/Feed/Thumbnail).
- Poi: persistenza testo editor (P2), QR deep link (attende profilo Apple), Night Vision (build nativa), Documented Reality (Marte/ISS).


---

## SESSIONE (fork) — Migrazione storage immagini a Cloudflare R2 (COMPLETATO E VERIFICATO)

Integrazione via `integration_playbook_expert` (R2 S3-compatible, boto3). Credenziali SOLO in `backend/.env` (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT) — mai nel codice.

### Modulo `backend/r2_storage.py` (nuovo, condiviso)
- boto3 client (region "auto", s3v4); chiamate bloccanti in `asyncio.to_thread`.
- `db.media` conserva SOLO metadati (key/variants, bucket, prefix, content_type, size, storage:"r2") — NESSUN binario in Mongo (`data` rimosso).
- `db.media.id` resta = id entità → tutti gli URL `/api/media/{id}` invariati (compatibilità totale). Serve legge R2 o, se presente, il vecchio base64 (retrocompatibile).
- Nomi file UUID; prefissi whitelisted.

### Layout bucket (prefissi creati automaticamente all'avvio via `ensure_folders`)
`users/avatars/` · `observe/originals/` · `observe/master/` · `observe/detail/` · `observe/feed/` · `observe/thumbnails/` · `pulse/` · `snapsense/` · `chat/` · `system/` · `temp/`

### Multi-size per immagini Observe (`put_observation_image`, Pillow)
Ogni foto Observe genera: **originals** (intatta) + **master** 2048px q90 · **detail** 1440px q86 · **feed** 800px q82 · **thumbnails** 320px q74 (solo downscale, EXIF-transpose). Verificato: thumb 2.9KB→feed 12KB→detail 35KB→master 78KB→original 140KB.
- Serve: `GET /api/media/{id}?size=thumb|feed|detail|master|original` (default = detail → fallback catena). Frontend `mediaUrl(url, size?)`: griglie Explore/creator/LiveEarth/VerifiedEvents → `thumb`; card feed / QuickView / ObservationOfTheDay → `feed`.
- Pulse/SnapSense/avatar/audio/chat = oggetto singolo (no varianti) nei rispettivi prefissi. Avatar → `users/avatars/`. Audio → `system/`.

### Wiring
- `social.py`: create_observation (pulse→`pulse/` singolo, altrimenti multi-size), serve `/media/{id}` (+size), upload_audio→`system/`, avatar→`users/avatars/`, delete→`r2_storage.delete` (rimuove tutte le varianti), pulse_compare usa `fetch_base64`.
- `snapsense.py`: create→`snapsense/`, delete→`r2_storage.delete`.
- `server.py` startup: `ensure_folders()` + `cleanup_temp(24h)` (auto-elimina upload temporanei inutilizzati).

### Migrazione dati esistenti (`backend/migrate_media_to_r2.py`, idempotente)
Eseguita sul DB preview: 21 doc media → R2; 15 Observe con varianti generate, resto in prefissi corretti; **0 doc con base64 residuo**. Rimosso placeholder legacy `avatars/.keep`.

### Verifica
- R2 connectivity put/get/delete OK; upload→metadati-only in Mongo→serve (Cache-Control immutable)→delete rimuove oggetto R2; tutte le size servono; moderazione nudità invariata; feed carica (immagini seed sono 1×1 di test → placeholder atteso, non è un bug).
- `requirements.txt` aggiornato (boto3 1.43.44 via pip freeze).

NOTA: `pip install` in questo pod non persiste ai redeploy salvo requirements.txt (fatto). Le vecchie immagini seed sono minuscole (test) → in app appaiono come placeholder; le foto reali da device generano varianti corrette.


---

## SESSIONE (fork) — ECOES™ FASE 1 (COMPLETATA E VERIFICATA)

Nuovo secondo pilastro Ecoes™ — Fase 1 (fondamenta). Observe resta la Home iniziale. Modello AI scelto dall'utente per tutto Ecoes: **GPT-5.4** (chiave Emergent).

### 1. Barra inferiore a 8 sezioni equilibrate (`src/components/BottomNav.tsx`, riscritto)
Home · Explore · Challenges(Pulse) · Observe · **Sense (centrale, PIATTO)** · **Ecoes** · Messaggi · Galleria. Rimosso il pulsante Sense rialzato/floating: stessa dimensione/luminosità/allineamento per tutte; unica differenza = stato selezionato (activeRing dorato + opacità). Icone immagine: ring(observe), pulse, sense-mark, ecoes-icon.

### 2. Ecoes World in Home + scaffold (`app/home.tsx`, nuovo `app/ecoes-world.tsx`)
- Banner "Ecoes World™" (testID `home-ecoes-world`, icona `ecoes-icon.png`) → `/ecoes-world`.
- `ecoes-world.tsx`: pianeta pulsante SENZA confini/stati/città, toggle Ecoes Globe / My Ecoes, testo filosofia, stato "in arrivo". La logica completa (connessioni/room/risonanza) è FASE 2.

### 3. Pensieri in Observe (testo, max 3000, niente immagine)
- Backend `social.py`: `CreateObs.kind`; se `kind=='thought'` o `media_type=='text'` senza immagine → salva `kind:'thought'`, caption fino a 3000 (vuoto→400). `obs_public` espone `kind`. Il feed li mostra insieme ai Sense (nessun filtro has_image).
- Frontend: FAB "Pensiero" nel feed → `/compose-thought` (contatore 3000, gestione sospensione read-only). `ObservationCard` rende i Pensieri text-forward con tag "PENSIERO" (niente blocco immagine).

### 4. Multilingua (testo originale SEMPRE visibile + Traduci)
- Backend `ai_features.py`: `POST /api/ai/translate {text, target}` (GPT-5.4) → `{source_lang, target, translation}`; cache in `db.translations` (sha256(target+text)); fail-soft ritorna l'originale.
- Frontend `src/components/TranslatableText.tsx`: mostra originale + "Traduci" → blocco traduzione sotto (toggle nascondi); se già nella lingua utente mostra "Già nella tua lingua". Chiave i18n "translate" aggiunta. Integrato in: Observe (caption card + Pensiero), observation-detail (caption + commenti), chat/DM (bolle messaggi). `client.mediaUrl(url,size?)` già supporta le taglie.

### Verifica
- Backend: 13/13 pytest PASS (iteration_8.json). Smoke curl: thought create 200 (kind=thought, no image), translate it→en OK + cache, media size variants OK.
- Frontend (screenshot main agent): nav 8 slot equilibrata, composer Pensiero (97/3000), Pensiero pubblicato nel feed con tag PENSIERO + Traduci, banner Home Ecoes, schermata Ecoes World scaffold. Tutto OK.
- NB: `testing_agent` NON va più usato finché l'utente non lo richiede esplicitamente (istruzione utente).

### PROSSIMO — ECOES FASE 2 (MVP)
Ecoes Globe (stessa Terra senza confini) con Connection = pulsazioni vive (intensità da qualità/continuità, mai numeri); AI (GPT-5.4) propone Connection su risonanza Sense/Pensieri/commenti → accetta/rifiuta; Connection anonime; Ecoes Connection Room privata (≥2 accettano); My Ecoes (esci/rientra; eliminata quando l'ultimo esce). FASE 3: contenuti stanze/thread, inviti, evoluzione titolo+cronologia, DM, Segnala→moderazione, moderazione AI continua, pulsazioni che rallentano/riprendono.


---

## SESSIONE (fork) — ECOES™ FASE 2 (MVP) (COMPLETATA E VERIFICATA)

Motore di risonanza + Ecoes World operativi. NON modificata la Fase 1.

### Backend — nuovo modulo `backend/ecoes.py` (router `/api/ecoes`, registrato in server.py)
- **Rilevamento risonanza automatico a intervalli** (nessun pulsante utente): `resonance_loop()` avviato allo startup, ciclo ogni ora; batch di ~40 contenuti non ancora analizzati (`ecoes_scanned`). Confronta **Pensieri + didascalie Sense + commenti**. Prompt GPT-5.4 cerca risonanze PROFONDE (significato/prospettiva/stato d'animo/complementarità), NON per argomento; **max 3 gruppi**, qualità > quantità, zero se nulla di significativo; ogni gruppo ≥2 utenti distinti.
- **Proposte individuali anonime**: per ogni gruppo crea una `ecoes_connections` (status `proposed`) con titolo+descrizione+reason generati dall'AI, e `ecoes_proposals` per utente (+notifica "È stata rilevata una possibile Connection Ecoes").
- **Room nasce solo con ≥2 accettazioni**: `accept` attiva la Connection e rende visibili i partecipanti tra loro; con 1 sola accettazione resta in attesa; altri possono accettare dopo. `decline` disponibile.
- **Origine geografica reale offuscata**: `origin` (lat/lon del contenuto sorgente) resta interno; `display` = offset deterministico ~90km stabile per id (`_display_coords`); niente città/Stato/coordinate; Terra senza confini.
- **Intensità = vita della Connection** (`_intensity`: recency + post/autori recenti, mai numeri esposti); `dormant` se inattiva ma resta sul Globe; **eliminata solo quando l'ultimo membro esce** (`leave`).
- **Room**: `GET /rooms/{id}` (titolo, descrizione, participants, posts), `POST /rooms/{id}/posts` (Pensieri/commenti nella stanza, aggiorna attività), `POST /rooms/{id}/leave`.
- Endpoint dev-only `POST /ecoes/admin/run-cycle` (solo per test/seed, NON user-facing). Indici `ensure_ecoes_indexes`.
- Collezioni: `ecoes_connections`, `ecoes_proposals`, `ecoes_members`, `ecoes_posts`, `ecoes_scanned`.

### Frontend
- `src/lib/backend.ts`: `ecoesApi` (globe/proposals/accept/decline/my/room/post/leave) + tipi.
- `src/components/EcoesGlobe.tsx`: pianeta ortografico SENZA confini, auto-rotazione calma, pulsazioni per Connection (dimensione/colore per intensità; oro se forte, blu altrimenti), tap→seleziona. Solo lato frontale visibile.
- `app/ecoes-world.tsx` (riscritto): toggle **Ecoes Globe / My Ecoes**, banner **proposte** con Accetta/Non ora, selezione pulsazione → titolo+descrizione ("Ecoes non rivela chi né dove"), lista My Ecoes → Room.
- `app/ecoes-room.tsx` (nuovo): titolo+pulsazione, dettagli/participants (tap header), feed post con `TranslatableText`, composer Pensiero, Esci (conferma). Nessun numero mostrato.

### Verifica (curl + screenshot)
- Ciclo dev: 2 Pensieri topicamente diversi ma profondamente complementari → 1 Connection "La domanda come cammino", 2 proposte. Apple accetta→attesa; Explorer accetta→Room nata; room detail mostra i 2 partecipanti; post OK; Globe 1 pulsazione (display offuscato 14.94,-71.56, intensità 0.8); My Ecoes 1.
- Screenshot: Globe borderless con pulsazione, My Ecoes, Room con post+Traduci. Tutto OK.

### PROSSIMO — ECOES FASE 3
Thread/risposte nelle stanze, inviti "per prospettiva", **evoluzione automatica del titolo** (AI propone nuovo titolo + notifica pubblica con motivo + cronologia già salvata in `title_history`), DM tra partecipanti, **Segnala→moderazione**, moderazione AI continua (spam/safety/hate), pulsazioni che rallentano/riprendono, pubblicare un Sense scattato direttamente in una Room e opzionalmente anche in Observe. A regime: rilevamento near-real-time con pre-selezione semantica prima del modello costoso.


---

## SESSIONE (fork) — ECOES ROOM: BOT DI SISTEMA + MODERAZIONE (COMPLETATO E VERIFICATO)
Aggiunta strutturale alla Fase 2 (resto invariato).
- `ecoes.py` `SYSTEM_BOTS`: **OverView Safety Bot** (safety) + **OverView Moderation Bot** (moderation), `is_bot:true`. Presenti in OGNI Room dalla nascita; esposti in `GET /ecoes/rooms/{id}` nel campo `system_bots`, SEPARATI da `participants`. Non sono membri (`ecoes_members`) → non contati, non influenzano pulsazione, non rimovibili, nessun DM.
- **Moderazione continua** `_moderate_text` (GPT-5.4, fail-open): ogni `POST /rooms/{id}/posts` viene classificato (hate/harassment/spam/dangerous). Contenuti abusivi → **bloccati** (422 `{code:'moderated', message:'<bot>: …'}`) e registrati in `ecoes_flags` (`status:auto_blocked`, `escalate_human` se severity high). Espressione riflessiva/emotiva NON penalizzata. Intervento discreto: solo l'autore vede il blocco, nessun rumore nella Room.
- Frontend `app/ecoes-room.tsx`: pannello dettagli con **PARTECIPANTI** poi divisore e **BOT DI SISTEMA** (icona scudo/martello, tag "SISTEMA", `pointerEvents=none` → non cliccabili) + nota "Presenza silenziosa di OverView… intervengono solo quando necessario". Il 422 di moderazione mostra un Alert col messaggio del bot.
- Verifica: room detail ritorna i 2 bot separati dai partecipanti; post riflessivo normale 200; post minaccioso 422 (Safety Bot) + flag loggato. Screenshot UI confermato.


---

## SESSIONE (fork) — ECOES GLOBE evoluto: Terra reale, Sole, senza confini (COMPLETATO)
Riscritto `src/components/EcoesGlobe.tsx` come vero globo ortografico SVG (stessa tecnica di `LiveEarth` + dati `src/lib/continents` CONTINENTS), senza toccare la logica Fase 1/2.
- **Rotazione lenta continua** (0.12°/tick @60ms) quando idle; ripresa automatica ~2.5s dopo l'interazione.
- **Illuminazione solare reale**: `subsolarPoint(UTC)` (declinazione + ora) → gradiente giorno/notte `ec_day` centrato sul punto subsolare proiettato; terminatore si muove nel tempo; se il Sole è sul lato opposto la notte domina. La posizione utente NON influisce sull'illuminazione (eventualmente solo punto di vista iniziale, non implementato ora → funziona senza geoloc).
- **Nessun confine/etichetta/città**: solo landmass fisici riempiti (CONTINENTS), niente stroke di confini/nomi/graticule.
- **Interattivo**: Pan (ruota), Pinch (zoom 1..**12**), Tap (seleziona). GestureDetector; `onInteracting` disabilita lo ScrollView di `ecoes-world` durante l'uso.
- **Fusione densità SENZA numeri**: clustering per distanza schermo (~26px) → un unico bagliore (dimensione cresce col numero, MAI cifre). Tap su bagliore multiplo → zoom verso il centroide (lon0/lat0) così le pulsazioni si separano; a zoom sufficiente ogni Connection torna singola e selezionabile.
- **Pulsazioni ancorate alla sfera**: proiettate ad ogni frame con rotazione/tilt/zoom; seguono la Terra, spariscono sul lato posteriore.
- Verifica screenshot: Terra riconoscibile (Africa/Europa/Asia) senza confini, alone atmosferico, illuminazione solare visibile, hint drag/pinch/tap. Fase 1/2 invariate.
NB tecnico: implementazione SVG (nessuna nuova dipendenza), funziona su web preview + Expo Go. Una futura versione con texture fotorealistica/3D (three/expo-gl già in progetto) è possibile ma richiederebbe build nativo.

