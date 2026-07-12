import { computeSky } from "./skyObjects";
import { dayNumber, moonPhase, sunTimes, GALACTIC_CENTER, toHorizontal } from "./astronomy";
import { nextPass } from "./satellites";
import { activeShowers } from "./events";
import { Weather, SpaceWeather } from "./api";
import { compassPoint, fmtTime, nf } from "./format";

export type LayerKey =
  | "earth" | "sky" | "universe" | "magnetic" | "solar" | "signal" | "time" | "observation";

export type Rarity = "common" | "notable" | "rare" | "exceptional";

export interface Opportunity {
  id: string;
  layer: LayerKey;
  layerLabel: string;
  emoji: string;
  icon: string;         // Ionicons name
  title: string;
  summary: string;
  facts: string[];      // verified data (feeds AI + detail)
  tips: string[];
  rarity: Rarity;
  interest: number;     // 0..100 (sorting)
  bestTime?: string;
  direction?: string;
  whenTs?: number;
  createObservation?: boolean;
}

export interface OppContext {
  now: Date;
  lat: number;
  lon: number;
  altitude: number | null;
  hasLoc: boolean;
  weather: Weather | null;
  space: SpaceWeather | null;
  satsReady: boolean;
}

const LAYER_LABEL: Record<LayerKey, string> = {
  earth: "EARTH LAYER", sky: "SKY LAYER", universe: "UNIVERSE LAYER",
  magnetic: "MAGNETIC LAYER", solar: "SOLAR LAYER", signal: "LISTENING LAYER",
  time: "TIME LAYER", observation: "OBSERVATION",
};

const rarityRank: Record<Rarity, number> = { common: 0, notable: 1, rare: 2, exceptional: 3 };
export function sortOpportunities(list: Opportunity[]): Opportunity[] {
  return [...list].sort((a, b) => {
    if (rarityRank[b.rarity] !== rarityRank[a.rarity]) return rarityRank[b.rarity] - rarityRank[a.rarity];
    return b.interest - a.interest;
  });
}

function minutesBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 60000;
}

export function computeOpportunities(ctx: OppContext): Opportunity[] {
  const out: Opportunity[] = [];
  const { now, lat, lon, hasLoc, weather, space, satsReady } = ctx;
  const d = dayNumber(now);
  const ph = moonPhase(d);
  const objs = hasLoc ? computeSky(now, lat, lon) : [];
  const sunO = objs.find((o) => o.kind === "sun");
  const sunAlt = sunO?.alt ?? null;
  const isDark = sunAlt != null && sunAlt < -6;

  // ---- SUNSET / GOLDEN HOUR (Atmosphere/Earth) ----
  if (hasLoc) {
    const st = sunTimes(now, lat, lon);
    if (st.sunset && st.sunset.getTime() > now.getTime() - 20 * 60000) {
      const toSunset = minutesBetween(now, st.sunset);
      const goldenStart = new Date(st.sunset.getTime() - 30 * 60000);
      const goldenEnd = new Date(st.sunset.getTime() + 8 * 60000);
      const cloud = weather?.cloud_cover_pct;
      let rarity: Rarity = "common";
      let quality = "buone";
      if (cloud != null && cloud >= 20 && cloud <= 70) { rarity = "notable"; quality = "particolarmente spettacolari"; }
      if (cloud != null && cloud >= 30 && cloud <= 55) { rarity = "rare"; quality = "eccezionali"; }
      const when = toSunset > 1 ? `tra ${Math.round(toSunset)} min` : "ora";
      out.push({
        id: "sunset", layer: "earth", layerLabel: LAYER_LABEL.earth, emoji: "🌅", icon: "partly-sunny",
        title: toSunset > 1 ? `Tramonto ${when}` : "Tramonto in corso",
        summary: `Condizioni ${quality} per il tramonto. Golden hour ${fmtTime(goldenStart)}–${fmtTime(goldenEnd)}.`,
        facts: [
          `Tramonto previsto alle ${fmtTime(st.sunset)}.`,
          `Finestra golden hour: ${fmtTime(goldenStart)}–${fmtTime(goldenEnd)}.`,
          cloud != null ? `Copertura nuvolosa: ${nf(cloud, 0)}%.` : "Copertura nuvolosa non disponibile.",
          weather?.temperature_c != null ? `Temperatura: ${nf(weather.temperature_c, 0)}°C.` : "",
        ].filter(Boolean),
        tips: ["Cerca un orizzonte libero verso Ovest.", "Per la foto: esponi per il cielo, non per il primo piano."],
        rarity, interest: 60 + (rarity === "rare" ? 20 : rarity === "notable" ? 10 : 0),
        bestTime: `${fmtTime(goldenStart)}–${fmtTime(goldenEnd)}`,
        direction: st.sunset ? "Ovest" : undefined,
        whenTs: st.sunset.getTime(), createObservation: true,
      });
    }
  }

  // ---- ISS PASS (Sky) ----
  if (hasLoc && satsReady) {
    const pass = nextPass(/ISS|ZARYA/i, now, lat, lon, 10, 120);
    if (pass) {
      const toStart = Math.max(0, Math.round(minutesBetween(now, pass.start)));
      const visible = isDark; // sunlit sat + dark observer ≈ visible
      out.push({
        id: "iss-pass", layer: "sky", layerLabel: LAYER_LABEL.sky, emoji: "🛰️", icon: "rocket",
        title: toStart <= 1 ? "ISS in transito ora" : `ISS tra ${toStart} min`,
        summary: `La Stazione Spaziale attraversa il cielo verso ${compassPoint(pass.peakAz)}, fino a ${nf(pass.peakAlt, 0)}° di altezza.`,
        facts: [
          `Inizio passaggio: ${fmtTime(pass.start)}.`,
          `Culmine: ${fmtTime(pass.peak)} a ${nf(pass.peakAlt, 0)}° di elevazione, direzione ${compassPoint(pass.peakAz)}.`,
          `Fine: ${fmtTime(pass.end)}.`,
          visible ? "Il cielo è abbastanza buio: il passaggio dovrebbe essere visibile a occhio nudo." : "Il Sole è ancora alto: la visibilità a occhio nudo è improbabile ora.",
        ],
        tips: ["Guarda verso " + compassPoint(pass.peakAz) + " qualche minuto prima.", "È un punto luminoso e fisso che si muove regolare, senza lampeggiare."],
        rarity: visible ? "rare" : "notable",
        interest: 85 - Math.min(toStart, 60),
        bestTime: fmtTime(pass.peak), direction: `${compassPoint(pass.peakAz)} ${nf(pass.peakAz, 0)}°`,
        whenTs: pass.start.getTime(), createObservation: true,
      });
    }
  }

  // ---- MOON (Lunar) ----
  {
    const moonUp = objs.find((o) => o.kind === "moon");
    const illum = ph.illumination;
    const goodForCraters = illum >= 0.15 && illum <= 0.88;
    const rarity: Rarity = goodForCraters ? "notable" : "common";
    out.push({
      id: "moon", layer: "universe", layerLabel: "LUNAR LAYER", emoji: "🌙", icon: "moon",
      title: goodForCraters ? "Luna ideale per l'osservazione" : `Luna: ${ph.name}`,
      summary: goodForCraters
        ? `Illuminata al ${nf(illum * 100, 0)}%: le ombre lungo il terminatore esaltano i crateri.`
        : `Fase ${ph.name}, illuminazione ${nf(illum * 100, 0)}%.`,
      facts: [
        `Fase attuale: ${ph.name}.`,
        `Illuminazione: ${nf(illum * 100, 0)}%.`,
        moonUp ? (moonUp.alt > 0 ? `La Luna è sopra l'orizzonte a ${nf(moonUp.alt, 0)}° (${compassPoint(moonUp.az)}).` : "La Luna è sotto l'orizzonte in questo momento.") : "",
      ].filter(Boolean),
      tips: goodForCraters
        ? ["Osserva lungo il terminatore, il confine luce/ombra.", "Anche un piccolo binocolo rivela molti crateri."]
        : ["Con la Luna piena la luce è intensa: meglio per paesaggi lunari che per crateri."],
      rarity, interest: goodForCraters ? 55 : 30,
      direction: moonUp && moonUp.alt > 0 ? compassPoint(moonUp.az) : undefined,
      createObservation: !!(moonUp && moonUp.alt > 5),
    });
  }

  // ---- PLANETS (Universe) ----
  if (hasLoc) {
    const planets = objs.filter((o) => o.kind === "planet" && o.alt > 12)
      .sort((a, b) => b.alt - a.alt);
    const best = planets.find((p) => ["Giove", "Saturno", "Venere", "Marte", "Jupiter", "Saturn", "Venus", "Mars"].includes(p.name)) || planets[0];
    if (best) {
      const observableNow = isDark || best.name === "Venere" || best.name === "Venus";
      out.push({
        id: `planet-${best.name}`, layer: "universe", layerLabel: LAYER_LABEL.universe, emoji: "🪐", icon: "planet",
        title: `${best.name} ${observableNow ? "osservabile ora" : "osservabile stanotte"}`,
        summary: `${best.name} è a ${nf(best.alt, 0)}° sopra l'orizzonte, verso ${compassPoint(best.az)}.`,
        facts: [
          `${best.name}: elevazione ${nf(best.alt, 0)}°, direzione ${compassPoint(best.az)} (${nf(best.az, 0)}°).`,
          best.distanceStr ? `Distanza: ${best.distanceStr}.` : "",
          observableNow ? "Il cielo è sufficientemente buio per l'osservazione." : "Migliora dopo il tramonto, quando il cielo è più scuro.",
        ].filter(Boolean),
        tips: ["Cerca un punto luminoso che non scintilla come le stelle.", "Con un piccolo telescopio Saturno mostra gli anelli, Giove le sue lune."],
        rarity: "notable", interest: 50 + Math.min(best.alt, 40) / 2,
        direction: `${compassPoint(best.az)} ${nf(best.az, 0)}°`, createObservation: observableNow,
      });
    }
  }

  // ---- MILKY WAY (Universe) ----
  if (hasLoc && isDark) {
    const gc = toHorizontal(GALACTIC_CENTER.ra, GALACTIC_CENTER.dec, lat, lon, d);
    if (gc.alt > 10 && ph.illumination < 0.5) {
      out.push({
        id: "milkyway", layer: "sky", layerLabel: "SKY LAYER", emoji: "🌌", icon: "sparkles",
        title: "Via Lattea osservabile",
        summary: `Il centro galattico è a ${nf(gc.alt, 0)}° verso ${compassPoint(gc.az)}, con Luna poco luminosa.`,
        facts: [
          `Centro galattico (Sgr A*): elevazione ${nf(gc.alt, 0)}°, direzione ${compassPoint(gc.az)}.`,
          `Illuminazione lunare: ${nf(ph.illumination * 100, 0)}% (bassa = cielo più scuro).`,
          "Serve un cielo buio, lontano dalle luci cittadine.",
        ],
        tips: ["Allontanati dall'inquinamento luminoso.", "Per la foto: 15-20s di esposizione, ISO alto, cavalletto."],
        rarity: "rare", interest: 78,
        direction: `${compassPoint(gc.az)} ${nf(gc.az, 0)}°`, createObservation: true,
      });
    }
  }

  // ---- METEOR SHOWERS (Time/Sky) ----
  {
    const showers = activeShowers(now);
    const s = showers[0];
    if (s) {
      const near = Math.abs(s.daysToPeak) <= 2;
      const moonOk = ph.illumination < 0.6;
      out.push({
        id: `shower-${s.name}`, layer: "time", layerLabel: "TIME LAYER", emoji: "🌠", icon: "star",
        title: s.isPeak ? `${s.itName}: picco stanotte` : `${s.itName} attive`,
        summary: `Sciame ${s.itName} attivo${s.isPeak ? " al picco" : s.daysToPeak > 0 ? `, picco tra ${s.daysToPeak} giorni` : ""}. Fino a ~${s.zhr} meteore/h in condizioni ideali.`,
        facts: [
          `Sciame: ${s.itName} (${s.name}).`,
          `Tasso orario zenitale tipico al picco: ~${s.zhr} meteore/h.`,
          `Corpo progenitore: ${s.parent}.`,
          s.isPeak ? "Questa notte è vicina al picco di attività." : `Giorni al picco: ${s.daysToPeak}.`,
          moonOk ? "La Luna interferisce poco: buone condizioni." : "La luce lunare ridurrà il numero di meteore visibili.",
        ],
        tips: ["L'orario migliore è dopo mezzanotte, verso le prime ore.", "Sdraiati e osserva un'ampia porzione di cielo, senza telescopio."],
        rarity: near && moonOk ? "exceptional" : near ? "rare" : "notable",
        interest: (near ? 82 : 55) + (moonOk ? 5 : 0),
        bestTime: "Dopo mezzanotte", createObservation: true,
      });
    }
  }

  // ---- SOLAR ACTIVITY / AURORA (Solar) ----
  if (space?.kp_index?.available && space.kp_index.value != null) {
    const kp = space.kp_index.value;
    if (kp >= 4) {
      const aurora = kp >= 5;
      out.push({
        id: "solar-kp", layer: "solar", layerLabel: LAYER_LABEL.solar, emoji: "☀️", icon: "sunny",
        title: aurora ? "Possibilità di aurore" : "Attività solare interessante",
        summary: `Indice Kp ${nf(kp, 1)} · ${space.kp_index.level ?? ""}. ${aurora ? "Aurore possibili alle latitudini compatibili." : "Campo geomagnetico attivo."}`,
        facts: [
          `Indice Kp attuale: ${nf(kp, 1)} (${space.kp_index.level ?? "n/d"}).`,
          space.kp_index.aurora_chance ? `Probabilità aurore: ${space.kp_index.aurora_chance}.` : "",
          space.solar_wind?.available ? `Vento solare: ${nf(space.solar_wind.speed_kms ?? 0, 0)} km/s.` : "",
          space.solar_flare?.available && space.solar_flare.class ? `Ultimo brillamento: classe ${space.solar_flare.class}.` : "",
        ].filter(Boolean),
        tips: aurora ? ["Cerca un orizzonte scuro verso Nord.", "Le fotocamere colgono l'aurora meglio dell'occhio: prova 5-10s di esposizione."] : ["Segui l'evoluzione nel Solar Layer."],
        rarity: kp >= 6 ? "exceptional" : aurora ? "rare" : "notable",
        interest: 50 + kp * 6, direction: aurora ? "Nord" : undefined, createObservation: aurora,
      });
    }
  }

  // ---- LISTENING (Signal) ----
  {
    const hour = now.getHours();
    const quietHours = hour >= 22 || hour <= 6;
    out.push({
      id: "listening", layer: "signal", layerLabel: LAYER_LABEL.signal, emoji: "🎧", icon: "musical-notes",
      title: quietHours ? "Ottimo momento per un Listening Layer" : "Registra il paesaggio sonoro",
      summary: quietHours
        ? "L'ambiente notturno è tipicamente più silenzioso: ideale per catturare suoni sottili."
        : "Cattura l'impronta sonora del momento e amplificala.",
      facts: [
        `Ora locale: ${fmtTime(now)}.`,
        quietHours ? "Fascia oraria a basso rumore ambientale." : "Fascia oraria con attività ambientale.",
      ],
      tips: ["Registra almeno 30 secondi.", "Allontana il microfono da fonti di vento."],
      rarity: quietHours ? "notable" : "common", interest: quietHours ? 45 : 25,
      createObservation: false,
    });
  }

  // ---- OBSERVATION (light conditions) ----
  if (hasLoc) {
    const twilight = sunAlt != null && sunAlt > -12 && sunAlt < 2;
    const clearish = weather?.cloud_cover_pct == null || weather.cloud_cover_pct < 60;
    if ((isDark || twilight) && clearish) {
      out.push({
        id: "observation-light", layer: "observation", layerLabel: LAYER_LABEL.observation, emoji: "📸", icon: "camera",
        title: "Condizioni di luce ottimali",
        summary: twilight ? "Luce del crepuscolo: colori morbidi e cielo in transizione." : "Cielo scuro: ideale per un'Observation astronomica.",
        facts: [
          sunAlt != null ? `Altezza del Sole: ${nf(sunAlt, 0)}°.` : "",
          weather?.cloud_cover_pct != null ? `Copertura nuvolosa: ${nf(weather.cloud_cover_pct, 0)}%.` : "",
        ].filter(Boolean),
        tips: ["Apri la fotocamera Visione e cattura una nuova Observation.", "Tieni fermo il telefono per ridurre il mosso."],
        rarity: "notable", interest: isDark ? 48 : 40, createObservation: true,
      });
    }
  }

  return sortOpportunities(out);
}
