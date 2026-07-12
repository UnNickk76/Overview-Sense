// Bright-star catalogue (subset, J2000). RA/Dec in degrees, real values.
export interface Star {
  name: string;
  ra: number;
  dec: number;
  mag: number;
  constellation: string;
  distanceLy: number; // light-years
  spectralType: string;
}

export const STARS: Star[] = [
  { name: "Sirius", ra: 101.287, dec: -16.716, mag: -1.46, constellation: "Canis Major", distanceLy: 8.6, spectralType: "A1V" },
  { name: "Canopus", ra: 95.988, dec: -52.696, mag: -0.74, constellation: "Carina", distanceLy: 310, spectralType: "A9II" },
  { name: "Arcturus", ra: 213.915, dec: 19.182, mag: -0.05, constellation: "Boötes", distanceLy: 37, spectralType: "K1.5III" },
  { name: "Vega", ra: 279.234, dec: 38.784, mag: 0.03, constellation: "Lyra", distanceLy: 25, spectralType: "A0V" },
  { name: "Capella", ra: 79.172, dec: 45.998, mag: 0.08, constellation: "Auriga", distanceLy: 43, spectralType: "G3III" },
  { name: "Rigel", ra: 78.634, dec: -8.202, mag: 0.13, constellation: "Orion", distanceLy: 860, spectralType: "B8Ia" },
  { name: "Procyon", ra: 114.825, dec: 5.225, mag: 0.34, constellation: "Canis Minor", distanceLy: 11.5, spectralType: "F5IV" },
  { name: "Betelgeuse", ra: 88.793, dec: 7.407, mag: 0.42, constellation: "Orion", distanceLy: 640, spectralType: "M1Ia" },
  { name: "Achernar", ra: 24.429, dec: -57.237, mag: 0.46, constellation: "Eridanus", distanceLy: 139, spectralType: "B6V" },
  { name: "Hadar", ra: 210.956, dec: -60.373, mag: 0.61, constellation: "Centaurus", distanceLy: 390, spectralType: "B1III" },
  { name: "Altair", ra: 297.696, dec: 8.868, mag: 0.77, constellation: "Aquila", distanceLy: 16.7, spectralType: "A7V" },
  { name: "Aldebaran", ra: 68.980, dec: 16.509, mag: 0.85, constellation: "Taurus", distanceLy: 65, spectralType: "K5III" },
  { name: "Antares", ra: 247.352, dec: -26.432, mag: 0.96, constellation: "Scorpius", distanceLy: 550, spectralType: "M1.5Iab" },
  { name: "Spica", ra: 201.298, dec: -11.161, mag: 0.98, constellation: "Virgo", distanceLy: 250, spectralType: "B1III" },
  { name: "Pollux", ra: 116.329, dec: 28.026, mag: 1.14, constellation: "Gemini", distanceLy: 34, spectralType: "K0III" },
  { name: "Fomalhaut", ra: 344.413, dec: -29.622, mag: 1.16, constellation: "Piscis Austrinus", distanceLy: 25, spectralType: "A3V" },
  { name: "Deneb", ra: 310.358, dec: 45.280, mag: 1.25, constellation: "Cygnus", distanceLy: 2600, spectralType: "A2Ia" },
  { name: "Regulus", ra: 152.093, dec: 11.967, mag: 1.35, constellation: "Leo", distanceLy: 79, spectralType: "B8IV" },
  { name: "Castor", ra: 113.650, dec: 31.888, mag: 1.57, constellation: "Gemini", distanceLy: 51, spectralType: "A1V" },
  { name: "Bellatrix", ra: 81.283, dec: 6.350, mag: 1.64, constellation: "Orion", distanceLy: 250, spectralType: "B2III" },
  { name: "Elnath", ra: 81.573, dec: 28.608, mag: 1.65, constellation: "Taurus", distanceLy: 134, spectralType: "B7III" },
  { name: "Alnilam", ra: 84.053, dec: -1.202, mag: 1.69, constellation: "Orion", distanceLy: 2000, spectralType: "B0Ia" },
  { name: "Alnitak", ra: 85.190, dec: -1.943, mag: 1.77, constellation: "Orion", distanceLy: 1260, spectralType: "O9.5Ib" },
  { name: "Dubhe", ra: 165.932, dec: 61.751, mag: 1.79, constellation: "Ursa Major", distanceLy: 123, spectralType: "K0III" },
  { name: "Mirfak", ra: 51.081, dec: 49.861, mag: 1.79, constellation: "Perseus", distanceLy: 510, spectralType: "F5Ib" },
  { name: "Polaris", ra: 37.954, dec: 89.264, mag: 1.98, constellation: "Ursa Minor", distanceLy: 433, spectralType: "F7Ib" },
  { name: "Alphard", ra: 141.897, dec: -8.659, mag: 1.98, constellation: "Hydra", distanceLy: 177, spectralType: "K3II" },
  { name: "Denebola", ra: 177.265, dec: 14.572, mag: 2.11, constellation: "Leo", distanceLy: 36, spectralType: "A3V" },
];

export interface DeepSky {
  name: string;
  ra: number;
  dec: number;
  type: string;
  distanceLy: number;
  constellation: string;
}

export const DEEP_SKY: DeepSky[] = [
  { name: "Andromeda Galaxy (M31)", ra: 10.685, dec: 41.269, type: "Spiral galaxy", distanceLy: 2537000, constellation: "Andromeda" },
  { name: "Orion Nebula (M42)", ra: 83.822, dec: -5.391, type: "Emission nebula", distanceLy: 1344, constellation: "Orion" },
  { name: "Pleiades (M45)", ra: 56.75, dec: 24.117, type: "Open cluster", distanceLy: 444, constellation: "Taurus" },
  { name: "Galactic Center (Sgr A*)", ra: 266.417, dec: -29.008, type: "Supermassive black hole", distanceLy: 26670, constellation: "Sagittarius" },
];


// Constellation lines: pairs of star names present in STARS (drawn when both visible).
export const CONSTELLATION_LINES: [string, string][] = [
  // Orion
  ["Betelgeuse", "Alnilam"],
  ["Bellatrix", "Alnilam"],
  ["Alnilam", "Alnitak"],
  ["Alnilam", "Rigel"],
  ["Betelgeuse", "Bellatrix"],
  // Gemini
  ["Castor", "Pollux"],
];
