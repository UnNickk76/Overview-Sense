export const nf = (n: number, digits = 0): string =>
  typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : "—";

export const compassPoint = (deg: number): string => {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
};

export const fmtTime = (d: Date | null): string => {
  if (!d) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const lightYearsToStr = (ly: number): string => {
  if (ly >= 1000) return `${nf(ly / 1000, 1)}k light-years`;
  if (ly >= 1) return `${nf(ly, 1)} light-years`;
  return `${nf(ly * 365, 0)} light-days`;
};

// Age of the light we observe, expressed naturally.
export const lightAgeStr = (ly: number): string => {
  if (ly < 1 / 365) return `${nf(ly * 365 * 24 * 60, 0)} minutes ago`;
  if (ly < 1) return `${nf(ly * 365, 0)} days ago`;
  if (ly < 1000) return `${nf(ly, 1)} years ago`;
  return `${nf(ly, 0)} years ago`;
};
