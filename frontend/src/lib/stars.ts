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
  // --- Constellation pattern stars (real values, for Sky Vision™ line/figure drawing) ---
  { name: "Mintaka", ra: 83.001, dec: -0.299, mag: 2.25, constellation: "Orion", distanceLy: 1200, spectralType: "O9.5II" },
  { name: "Saiph", ra: 86.939, dec: -9.670, mag: 2.07, constellation: "Orion", distanceLy: 650, spectralType: "B0.5Ia" },
  { name: "Meissa", ra: 83.784, dec: 9.934, mag: 3.39, constellation: "Orion", distanceLy: 1100, spectralType: "O8III" },
  { name: "Merak", ra: 165.460, dec: 56.383, mag: 2.37, constellation: "Ursa Major", distanceLy: 79, spectralType: "A1IV" },
  { name: "Phecda", ra: 178.458, dec: 53.695, mag: 2.44, constellation: "Ursa Major", distanceLy: 84, spectralType: "A0V" },
  { name: "Megrez", ra: 183.857, dec: 57.033, mag: 3.31, constellation: "Ursa Major", distanceLy: 58, spectralType: "A3V" },
  { name: "Alioth", ra: 193.507, dec: 55.960, mag: 1.77, constellation: "Ursa Major", distanceLy: 81, spectralType: "A1III" },
  { name: "Mizar", ra: 200.981, dec: 54.925, mag: 2.04, constellation: "Ursa Major", distanceLy: 83, spectralType: "A2V" },
  { name: "Alkaid", ra: 206.885, dec: 49.313, mag: 1.86, constellation: "Ursa Major", distanceLy: 101, spectralType: "B3V" },
  { name: "Kochab", ra: 222.676, dec: 74.156, mag: 2.08, constellation: "Ursa Minor", distanceLy: 131, spectralType: "K4III" },
  { name: "Pherkad", ra: 230.182, dec: 71.834, mag: 3.05, constellation: "Ursa Minor", distanceLy: 487, spectralType: "A3II" },
  { name: "Schedar", ra: 10.127, dec: 56.537, mag: 2.24, constellation: "Cassiopeia", distanceLy: 228, spectralType: "K0III" },
  { name: "Caph", ra: 2.295, dec: 59.150, mag: 2.28, constellation: "Cassiopeia", distanceLy: 54, spectralType: "F2III" },
  { name: "Gamma Cas", ra: 14.177, dec: 60.717, mag: 2.15, constellation: "Cassiopeia", distanceLy: 550, spectralType: "B0.5IV" },
  { name: "Ruchbah", ra: 21.454, dec: 60.235, mag: 2.68, constellation: "Cassiopeia", distanceLy: 99, spectralType: "A5III" },
  { name: "Segin", ra: 28.599, dec: 63.670, mag: 3.35, constellation: "Cassiopeia", distanceLy: 410, spectralType: "B3III" },
  { name: "Sadr", ra: 305.557, dec: 40.257, mag: 2.23, constellation: "Cygnus", distanceLy: 1800, spectralType: "F8Ib" },
  { name: "Gienah Cygni", ra: 311.553, dec: 33.970, mag: 2.48, constellation: "Cygnus", distanceLy: 72, spectralType: "K0III" },
  { name: "Delta Cygni", ra: 296.243, dec: 45.131, mag: 2.87, constellation: "Cygnus", distanceLy: 165, spectralType: "B9III" },
  { name: "Albireo", ra: 292.680, dec: 27.960, mag: 3.05, constellation: "Cygnus", distanceLy: 430, spectralType: "K3II" },
  { name: "Algieba", ra: 154.993, dec: 19.842, mag: 2.28, constellation: "Leo", distanceLy: 130, spectralType: "K1III" },
  { name: "Zosma", ra: 168.527, dec: 20.524, mag: 2.56, constellation: "Leo", distanceLy: 58, spectralType: "A4V" },
  { name: "Chort", ra: 168.560, dec: 15.430, mag: 3.34, constellation: "Leo", distanceLy: 165, spectralType: "A2V" },
  { name: "Adhafera", ra: 154.173, dec: 23.417, mag: 3.43, constellation: "Leo", distanceLy: 260, spectralType: "F0III" },
  { name: "Rasalas", ra: 146.463, dec: 23.774, mag: 2.98, constellation: "Leo", distanceLy: 251, spectralType: "G1II" },
  { name: "Alhena", ra: 99.428, dec: 16.399, mag: 1.93, constellation: "Gemini", distanceLy: 109, spectralType: "A1IV" },
  { name: "Wasat", ra: 110.031, dec: 21.982, mag: 3.53, constellation: "Gemini", distanceLy: 59, spectralType: "F0IV" },
  { name: "Mebsuta", ra: 100.983, dec: 25.131, mag: 3.06, constellation: "Gemini", distanceLy: 900, spectralType: "G8Ib" },
  { name: "Tejat", ra: 95.740, dec: 22.514, mag: 2.87, constellation: "Gemini", distanceLy: 230, spectralType: "M3III" },
  { name: "Alcyone", ra: 56.871, dec: 24.105, mag: 2.87, constellation: "Taurus", distanceLy: 440, spectralType: "B7III" },
  { name: "Shaula", ra: 263.402, dec: -37.104, mag: 1.62, constellation: "Scorpius", distanceLy: 570, spectralType: "B2IV" },
  { name: "Sargas", ra: 264.330, dec: -42.998, mag: 1.87, constellation: "Scorpius", distanceLy: 270, spectralType: "F1II" },
  { name: "Dschubba", ra: 240.083, dec: -22.622, mag: 2.29, constellation: "Scorpius", distanceLy: 400, spectralType: "B0.3IV" },
  { name: "Sheliak", ra: 282.520, dec: 33.363, mag: 3.52, constellation: "Lyra", distanceLy: 960, spectralType: "B7II" },
  { name: "Sulafat", ra: 284.736, dec: 32.690, mag: 3.25, constellation: "Lyra", distanceLy: 620, spectralType: "B9III" },
  { name: "Tarazed", ra: 296.565, dec: 10.613, mag: 2.72, constellation: "Aquila", distanceLy: 395, spectralType: "K3II" },
  { name: "Alshain", ra: 298.828, dec: 6.407, mag: 3.71, constellation: "Aquila", distanceLy: 45, spectralType: "G8IV" },
  { name: "Izar", ra: 221.247, dec: 27.074, mag: 2.35, constellation: "Boötes", distanceLy: 203, spectralType: "K0II" },
  { name: "Muphrid", ra: 218.020, dec: 18.398, mag: 2.68, constellation: "Boötes", distanceLy: 37, spectralType: "G0IV" },
  { name: "Seginus", ra: 218.019, dec: 38.308, mag: 3.03, constellation: "Boötes", distanceLy: 85, spectralType: "A7III" },
  { name: "Nekkar", ra: 225.487, dec: 40.390, mag: 3.49, constellation: "Boötes", distanceLy: 225, spectralType: "G8III" },
  { name: "Adhara", ra: 104.656, dec: -28.972, mag: 1.50, constellation: "Canis Major", distanceLy: 430, spectralType: "B2II" },
  { name: "Wezen", ra: 107.098, dec: -26.393, mag: 1.83, constellation: "Canis Major", distanceLy: 1600, spectralType: "F8Ia" },
  { name: "Mirzam", ra: 95.675, dec: -17.956, mag: 1.98, constellation: "Canis Major", distanceLy: 500, spectralType: "B1II" },
  { name: "Aludra", ra: 111.024, dec: -29.303, mag: 2.45, constellation: "Canis Major", distanceLy: 2000, spectralType: "B5Ia" },
  { name: "Algol", ra: 47.042, dec: 40.956, mag: 2.12, constellation: "Perseus", distanceLy: 90, spectralType: "B8V" },
  { name: "Atik", ra: 56.080, dec: 32.288, mag: 2.85, constellation: "Perseus", distanceLy: 750, spectralType: "B1III" },
  { name: "Alpheratz", ra: 2.097, dec: 29.090, mag: 2.06, constellation: "Andromeda", distanceLy: 97, spectralType: "B8IV" },
  { name: "Mirach", ra: 17.433, dec: 35.621, mag: 2.05, constellation: "Andromeda", distanceLy: 197, spectralType: "M0III" },
  { name: "Almach", ra: 30.975, dec: 42.330, mag: 2.10, constellation: "Andromeda", distanceLy: 350, spectralType: "K3II" },
  { name: "Gomeisa", ra: 111.788, dec: 8.289, mag: 2.89, constellation: "Canis Minor", distanceLy: 160, spectralType: "B8V" },
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

