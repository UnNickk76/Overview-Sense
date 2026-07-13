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
