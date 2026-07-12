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

## Next tasks
- Testare su iPhone reale i moduli dipendenti da sensori/fotocamera.
- Estendere sorgenti dati satelliti (TLE) e linee costellazioni.
