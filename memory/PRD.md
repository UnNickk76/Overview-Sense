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

