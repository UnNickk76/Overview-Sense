// Curated calendar of recurring, factual astronomical events (meteor showers).
// These are well-documented annual events — not invented. Peak dates vary ±1 day
// year to year; we use canonical peaks. Real-time events (ISS, planets, Moon,
// Sun, aurora) are computed live elsewhere and merged in the opportunities engine.

export interface MeteorShower {
  name: string;
  itName: string;
  startMonth: number; startDay: number; // active window start
  endMonth: number; endDay: number;
  peakMonth: number; peakDay: number;
  zhr: number;            // typical peak rate (meteors/hour)
  parent: string;
}

export const METEOR_SHOWERS: MeteorShower[] = [
  { name: "Quadrantids", itName: "Quadrantidi", startMonth: 12, startDay: 28, endMonth: 1, endDay: 12, peakMonth: 1, peakDay: 3, zhr: 110, parent: "2003 EH1" },
  { name: "Lyrids", itName: "Liridi", startMonth: 4, startDay: 16, endMonth: 4, endDay: 25, peakMonth: 4, peakDay: 22, zhr: 18, parent: "Cometa Thatcher" },
  { name: "Eta Aquariids", itName: "Eta Aquaridi", startMonth: 4, startDay: 19, endMonth: 5, endDay: 28, peakMonth: 5, peakDay: 6, zhr: 50, parent: "Cometa di Halley" },
  { name: "Perseids", itName: "Perseidi", startMonth: 7, startDay: 17, endMonth: 8, endDay: 24, peakMonth: 8, peakDay: 12, zhr: 100, parent: "Cometa Swift-Tuttle" },
  { name: "Draconids", itName: "Draconidi", startMonth: 10, startDay: 6, endMonth: 10, endDay: 10, peakMonth: 10, peakDay: 8, zhr: 10, parent: "Cometa Giacobini-Zinner" },
  { name: "Orionids", itName: "Orionidi", startMonth: 10, startDay: 2, endMonth: 11, endDay: 7, peakMonth: 10, peakDay: 21, zhr: 20, parent: "Cometa di Halley" },
  { name: "Leonids", itName: "Leonidi", startMonth: 11, startDay: 6, endMonth: 11, endDay: 30, peakMonth: 11, peakDay: 17, zhr: 15, parent: "Cometa Tempel-Tuttle" },
  { name: "Geminids", itName: "Geminidi", startMonth: 12, startDay: 4, endMonth: 12, endDay: 20, peakMonth: 12, peakDay: 14, zhr: 150, parent: "3200 Phaethon" },
  { name: "Ursids", itName: "Ursidi", startMonth: 12, startDay: 17, endMonth: 12, endDay: 26, peakMonth: 12, peakDay: 22, zhr: 10, parent: "Cometa Tuttle" },
];

function inWindow(date: Date, sM: number, sD: number, eM: number, eD: number): boolean {
  const m = date.getMonth() + 1, d = date.getDate();
  const cur = m * 100 + d;
  const start = sM * 100 + sD;
  const end = eM * 100 + eD;
  if (start <= end) return cur >= start && cur <= end;
  return cur >= start || cur <= end; // wraps year end
}

export interface ActiveShower extends MeteorShower {
  daysToPeak: number;
  isPeak: boolean;
}

export function activeShowers(date: Date): ActiveShower[] {
  const out: ActiveShower[] = [];
  for (const s of METEOR_SHOWERS) {
    if (!inWindow(date, s.startMonth, s.startDay, s.endMonth, s.endDay)) continue;
    const year = date.getFullYear();
    let peak = new Date(year, s.peakMonth - 1, s.peakDay);
    // handle wrap (Quadrantids peak in Jan for a Dec window)
    if (s.startMonth === 12 && s.peakMonth === 1 && date.getMonth() === 11) {
      peak = new Date(year + 1, s.peakMonth - 1, s.peakDay);
    }
    const daysToPeak = Math.round((peak.getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86400000);
    out.push({ ...s, daysToPeak, isPeak: Math.abs(daysToPeak) <= 1 });
  }
  return out.sort((a, b) => Math.abs(a.daysToPeak) - Math.abs(b.daysToPeak));
}
