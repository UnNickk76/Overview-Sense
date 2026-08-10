# Sense Vision 2.0 — Progetto di evoluzione (comprensione della scena)

Stato: PROPOSTA — nessun codice scritto, Sense Vision NON modificato. In attesa di approvazione di Fabio.

## 0. Principi invariati
- **No Invention**: ogni elemento ha una confidence propria; sotto soglia → "non determinabile" o nessuna etichetta. Mai identità specifica senza conferma reale.
- **Motore astronomico deterministico** (cielo: Sole/Luna/pianeti/stelle/satelliti) resta separato e autoritativo. L'AI non tocca il cielo.
- **La foto resta foto**: il riconoscimento è un LAYER opzionale sopra il contenuto, mai una modifica dell'immagine.

## 1. Da "un soggetto" a "scena"
Oggi `POST /api/ai/live-recognize` sceglie UN solo soggetto (categorie abilitate + soglia + snapshot 640px).
Nuovo modello dei risultati = **Scene Graph gerarchico**:
- SCENA/contesto (es. "Ambiente fluviale", "Roma")
- SOGGETTI principali (1–2, i più salienti)
- ELEMENTI secondari (vegetazione, rocce, sentiero, persone, veicoli…)
- ogni nodo ha: label generica + eventuale label specifica, `tier`, `confidence`, `region` (punto/box), `source`.

## 2. Tassonomia gerarchica (requisiti 4–5)
Ogni elemento vive su una scala di specificità e si usa **il livello più specifico sostenibile con affidabilità sufficiente**:
```
Acqua → Fiume → (Tevere)
Natura → Vegetazione → Albero → Quercia → (specie)
Luogo → Città → (Roma)
Architettura → Monumento → (Colosseo)
```
Tier di affidabilità per nodo:
- `confirmed` → mostra identità specifica ("Tevere", "Colosseo")
- `probable` → "Probabile: Tevere" con indicazione di incertezza
- `generic` → "Fiume" / "Monumento"
- `undetermined` → non mostrato (o solo la categoria superiore)

## 3. Le tre fonti di conoscenza + FUSIONE (cuore dell'architettura)
- **A) Motore astronomico** (deterministico) — cielo. INVARIATO.
- **B) Motore geografico/contestuale** (deterministico) — GIÀ ESISTE: `geo_places.py` (`GET /api/geo/places`) usa GPS + bussola + FOV + orientamento + curvatura/rifrazione su dati OSM per sapere COSA c'è nella direzione osservata (città, monti, monumenti, torri, castelli, fari…). Da estendere: fornire "candidati identità" con bearing/elevazione/distanza.
- **C) Motore AI di scena** (GPT-5.x Vision via Emergent) — comprensione olistica multi-elemento + regioni + confidence, output JSON strutturato.

**Fusione** (la vera leva di affidabilità):
- L'AI propone elementi generici + regione + confidence.
- Il motore geografico/astronomico ELEVA a identità specifica quando concorda:
  es. AI = "anfiteatro romano" (0.7) + geo = "Colosseo a ~120 m nella direzione osservata" ⇒ identità **Colosseo** `confirmed`.
  es. AI = "fiume" + geo = "Tevere attraversa la direzione a breve distanza" ⇒ **Probabile: Tevere** o `confirmed` secondo distanza/allineamento.
- Regole: concordanza image+context ⇒ confidence alta; solo AI generica ⇒ resta generico; solo geo ⇒ etichetta luogo; disaccordo ⇒ si scende al livello comune (No Invention).

## 4. Anti-clutter (requisiti 8–9)
- **Budget elementi visibili** (proposta: max 5–6), ranking = salienza × confidence × interesse.
- **Raggruppamento**: "Vegetazione" invece di 12 alberi; deduplica.
- Priorità: SCENA + soggetti principali sempre; secondari on-demand ("mostra di più").
- Nessuna etichetta sotto soglia. Schermo pulito di default se l'utente lo sceglie.

## 5. Controllo overlay: riconoscimento SEMPRE disponibile, visualizzazione OPZIONALE (requisiti 1–3)
- **Durante la ripresa**: toggle "Riconoscimento ON/OFF" = mostra/nascondi overlay. OFF ⇒ scena pulita.
  - Decisione aperta (D1): con overlay OFF l'analisi può continuare in background (per avere il layer pronto dopo lo scatto) oppure fermarsi per risparmiare. Proposta: analisi al momento dello scatto sempre; preview live solo se overlay ON.
- **Dopo lo scatto**: le info riconosciute restano disponibili. Default di visualizzazione = **stato scelto allo scatto** (ON→ON, OFF→OFF), ma l'utente può attivare/disattivare liberamente.
- **In Observe (dopo pubblicazione)**: layer opzionale per il proprietario E per gli altri utenti. Default iniziale = scelta del creatore; ogni viewer decide localmente se vederlo. **Il Sense originale non cambia**; la preferenza di visualizzazione è per-utente e non altera il contenuto.

## 6. Flusso completo CAMERA → ANALISI → RISULTATI → SENSE VISION
1. **Preview live** (opzionale, throttled, bassa risoluzione ≈640–768px): solo scena globale + elementi principali; economica. Attiva solo se overlay ON.
2. **Cattura**: scatto full-res; si congela il CONTESTO (GPS, bussola, FOV, zoom, data/ora) come già fa `ObsData`.
3. **Analisi post-scatto** (vedi §7 risoluzione adattiva): Pass 1 scena → fusione con geo/astro → eventuale Pass 2 mirato → Scene Graph finale.
4. **Persistenza**: il "recognition layer" (Scene Graph + `overlay_default`) viene salvato come DATI STRUTTURATI accanto al Sense (nuovo campo `recognition` nell'observation), senza toccare l'immagine.
5. **Visualizzazione**: overlay opzionale, riapribile dopo lo scatto e in Observe; preferenza per-viewer locale.

## 7. Risoluzione & strategia adattiva (analisi tecnica richiesta)
- **Limiti dei 640px**: elementi piccoli/lontani (fiumiciattolo, insegne, uccelli, texture geologiche) occupano pochi pixel ⇒ dettaglio insufficiente per identità specifica; testo/toponimi illeggibili. Va bene solo per scena globale/preview.
- **Risoluzione ragionevole**: 1024–1536px sul lato lungo per l'analisi principale (buon compromesso qualità/costo). 640px per preview live.
- **Impatto latenza/costo**: il costo dei modelli vision cresce ~ con l'area in pixel (token/tiles). Indicativo: 640→1024 ≈ +150% pixel; 640→1536 ≈ ~5.7× pixel. Anche la latenza sale con dimensione e numero di tile.
- **Strategia adattiva consigliata (2 pass)**:
  - **Pass 1 – Scene pass** (≈768–1024px): scene graph + regioni + confidence. Economico.
  - **Fusione contestuale** (geo/astro): spesso RISOLVE l'identità senza altri pixel (il contesto è "gratis" e deterministico).
  - **Pass 2 – Zoom pass SOLO se serve**: per elementi sotto soglia ma importanti, si RITAGLIA la regione dall'immagine full-res (crop ROI) e si rianalizza quel crop ad alta risoluzione (OCR insegne/toponimi, specie, identità monumento). Dà alta risoluzione EFFETTIVA dove conta, senza spedire l'intera immagine gigante.
- **Meglio del semplice aumento permanente**: crop mirati/tiling; usare geo/astro per confermare identità senza più pixel; caching per scene simili; escalation on-demand su tap ("approfondisci questo elemento").
- Decisione aperta (D2): Pass 2 automatico (se elemento saliente sotto soglia) oppure solo su richiesta utente? (trade-off costo/latenza vs. completezza).

## 8. Scelta del modello (analisi richiesta)
- **GPT-5.4/5.x Vision via Emergent resta il cuore** del ragionamento di scena: eccellente per comprensione olistica, multi-elemento, ragionamento con contesto e output JSON strutturato. Nessun bisogno di cambiarlo per la scene understanding.
- **La leva vera per l'IDENTITÀ SPECIFICA non è il modello ma la FUSIONE** con i motori deterministici GIÀ nel progetto (geo OSM + astro). L'immagine da sola raramente "sa" che quel fiume è il Tevere; posizione+direzione+immagine sì.
- **Complementi possibili (dentro gli asset già disponibili)**: un secondo giro Vision per lo "zoom pass" (OCR toponimi/insegne; classificazione specie botanica/animali). Tutto entro l'Emergent LLM Key (GPT-5.x vision / OpenAI), senza nuove integrazioni.
- **Integrazioni nuove NON necessarie ora**: servizi esterni di landmark/reverse-image sarebbero un'aggiunta separata; da valutare solo in futuro e solo se approvato. Per l'MVP dell'evoluzione bastano: GPT Vision (scena) + geo OSM (identità luoghi) + astro (cielo).

## 9. Cosa CONSERVO / cosa CAMBIO
CONSERVO:
- Motore astronomico deterministico e i suoi overlay (`SenseSkyOverlay`).
- Layer geografico `geo_places.py` + `SenseGeoOverlay` + `places.ts` (base per identità specifica).
- `ObsData` congelato allo scatto (planets/stars/places/zoom/legend-hidden) — ottima base per il layer per-viewer.
- Principio No Invention e i tier di affidabilità (confirmed/probable/generic).
- R2/observations, toggle esistenti ("Luoghi", "Overlay/Nomi").

CAMBIO:
- `live-recognize` da single-subject → endpoint di SCENA multi-elemento (nuovo schema Scene Graph).
- Fusione multi-fonte (image ⊕ geo ⊕ astro) con regole di elevazione a identità specifica.
- Risoluzione ADATTIVA a 2 pass con crop ROI (al posto del solo 640px permanente).
- Persistenza del `recognition` layer nell'observation + toggle overlay per-viewer in Observe (senza alterare l'immagine).
- Budget anti-clutter + raggruppamento + ranking salienza.

## 10. Modello dati proposto (concettuale, non codice)
```
SceneRecognition {
  version,
  scene:   { label_generic, label_specific?, confidence, source },
  subjects:[ Element ... ],      // principali
  elements:[ Element ... ],      // secondari
  overlay_default: "on" | "off", // scelta al momento dello scatto
}
Element {
  id, kind,                      // natura/acqua/architettura/luogo/persona/veicolo…
  label_generic, label_specific?,
  tier: confirmed|probable|generic|undetermined,
  confidence,                    // 0..1 indipendente per elemento
  region,                        // box normalizzato {x,y,w,h} (per overlay)
  az?, alt?, distance_km?,       // posizione assoluta quando determinabile (fusione geo/astro o stima da heading+region) → base per la Memoria Spaziale
  salience,                      // 0..1 importanza (ranking anti-clutter)
  notable,                       // eleggibile per la Memoria Spaziale (solo elementi degni di nota)
  source: image|geo|astro|fused
}
```
- Salvato in `observations.recognition`. La preferenza di visualizzazione (mostra/nascondi) è per-viewer (client-side), non modifica il Sense.
- Astro NON entra qui: resta gestito dal motore deterministico e dai suoi dati (`ObsData.planets/stars`).

## 13. Memoria Spaziale di Sessione (LIVE, mai nella foto)
Aiuto SOLO live: se Sense Vision riconosce un elemento DEGNO DI NOTA e poi l'utente ruota via, un promemoria discreto sul bordo indica dove si trova ("Colosseo →"), seguendo la bussola; quando l'elemento rientra nell'inquadratura il promemoria sparisce e torna l'overlay normale.
- **Solo elementi notable** (`notable=true`): monumenti, POI/luoghi importanti, monti/fiumi/elementi geografici specifici, fenomeni astronomici, elementi naturali rilevanti, animali/specie particolari, oggetti insoliti. MAI per albero/auto/strada/marciapiede/oggetti comuni.
- **Sorgente direzione**: `az`/`alt` assoluti dell'elemento (fusione geo/astro) oppure stima da heading camera + posizione nel frame al momento del riconoscimento. Aggiornamento continuo con bussola/orientamento.
- **No Invention**: la memoria NON è una nuova fonte di verità. Se la direzione stimata non è più affidabile → il promemoria SPARISCE invece di indicare male.
- **Decadimento/reset**: tempo trascorso, spostamento GPS significativo, cambio contesto, chiusura Sense Vision, elemento non più affidabile.
- **Impostazione** (controlli Sense Vision): `OFF` / `Solo elementi rilevanti` (default) / `Tutti i riconoscimenti memorizzati`.
- **UI**: chip piccolo, semitrasparente, vicino al bordo, con freccia direzionale; non copre la scena; stile OverView.
- **Scatto**: se l'elemento memorizzato NON è nell'inquadratura al momento dello scatto → NON entra nel recognition layer della foto, nessuna freccia nel Sense pubblicato, non fa parte della scena fotografata. Il promemoria appartiene solo alla sessione LIVE.
- **Architettura**: la memoria vive nel client (store di sessione), separata dal Scene Graph persistito. Nessun impatto sul backend Fase A (che però fornisce `az`/`alt`/`salience`/`notable` necessari).

## 14. Stato implementazione
- **Fase A (backend) — FATTA e testata** (modulo `backend/sense_vision.py`, router `/api/sv`): `POST /analyze` (Scene Graph + fusione geo), `POST /refine` (Pass 2 crop), `POST /observations/{id}/recognition` (persistenza owner-only), `GET /observations/{id}/recognition`, `POST /observations/{id}/reanalyze` (re-analisi versionata). `recognition`+`recognition_version` esposti nel feed/detail (`obs_public`). No Invention verificato (immagine vuota/scura → 0 elementi). Nessuna regressione su geo/places, live-recognize, scene.
- **Fase B (frontend) — DA FARE**: overlay elegante/anti-clutter, toggle Riconoscimento ON/OFF (analisi in background), default post-scatto = scelta allo scatto, layer opzionale in Observe per-viewer, Memoria Spaziale di Sessione, Pass 2 automatico + "Approfondisci".

## 11. Decisioni aperte per Fabio (prima di implementare)
- D1: con overlay OFF durante la ripresa, l'analisi gira comunque in background o solo allo scatto? (impatto costi)
- D2: Pass 2 "zoom" automatico o solo su richiesta ("approfondisci")? (costi/latenza)
- D3: budget massimo di elementi visibili (proposta 5–6) e soglie confidence per i tier.
- D4: il layer `recognition` in Observe si salva una volta oppure è rigenerabile on-demand?
- D5: consenso geolocalizzazione per l'identità specifica (privacy): default e messaggistica.
- D6: quali categorie "specifiche" attivare per prima (luoghi/monumenti/fiumi/monti via OSM sono i più solidi; specie botaniche/animali sono più incerte).
