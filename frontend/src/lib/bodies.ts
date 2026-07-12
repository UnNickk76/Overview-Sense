// Scientific facts for solar-system bodies. Real data.
export interface BodyFact {
  key: string;
  name: string;
  type: string;
  a_au: number; // semi-major axis (AU) for orrery ring
  diameter_km: number;
  distanceNote: string;
  facts: string[];
  color: string;
}

export const BODIES: Record<string, BodyFact> = {
  Sun: {
    key: "Sun", name: "Sun", type: "G2V Star", a_au: 0, diameter_km: 1392700,
    distanceNote: "~1 AU (149.6 million km) from Earth",
    color: "#FFB800",
    facts: [
      "The Sun contains 99.86% of the Solar System's mass.",
      "Its light takes about 8 minutes 20 seconds to reach Earth.",
      "Core temperature ~15 million °C; surface ~5,500 °C.",
      "Every second it fuses ~600 million tonnes of hydrogen into helium.",
    ],
  },
  Mercury: {
    key: "Mercury", name: "Mercury", type: "Terrestrial planet", a_au: 0.387,
    diameter_km: 4879, distanceNote: "0.31–0.47 AU from the Sun",
    color: "#A6A6A6",
    facts: [
      "Smallest planet, only slightly larger than Earth's Moon.",
      "A day on Mercury (sunrise to sunrise) lasts 176 Earth days.",
      "Surface swings from +430 °C in daylight to −180 °C at night.",
    ],
  },
  Venus: {
    key: "Venus", name: "Venus", type: "Terrestrial planet", a_au: 0.723,
    diameter_km: 12104, distanceNote: "~0.72 AU from the Sun",
    color: "#E8Cda2",
    facts: [
      "Hottest planet: a runaway greenhouse keeps it near 465 °C.",
      "It rotates backwards and slower than it orbits.",
      "Often the brightest 'star' at dawn or dusk.",
    ],
  },
  Mars: {
    key: "Mars", name: "Mars", type: "Terrestrial planet", a_au: 1.524,
    diameter_km: 6779, distanceNote: "1.38–1.67 AU from the Sun",
    color: "#C1440E",
    facts: [
      "Home to Olympus Mons, the tallest volcano in the Solar System (~22 km).",
      "Its reddish colour comes from iron oxide (rust) dust.",
      "A Martian day (sol) is 24 h 37 min.",
    ],
  },
  Jupiter: {
    key: "Jupiter", name: "Jupiter", type: "Gas giant", a_au: 5.203,
    diameter_km: 139820, distanceNote: "~5.2 AU from the Sun",
    color: "#D8CA9D",
    facts: [
      "Most massive planet — 2.5× all other planets combined.",
      "The Great Red Spot is a storm wider than Earth.",
      "Has at least 95 known moons.",
    ],
  },
  Saturn: {
    key: "Saturn", name: "Saturn", type: "Gas giant", a_au: 9.555,
    diameter_km: 116460, distanceNote: "~9.5 AU from the Sun",
    color: "#E3E0C0",
    facts: [
      "Its rings are made of billions of ice and rock chunks.",
      "Least dense planet — it would float in water.",
      "A year on Saturn lasts about 29 Earth years.",
    ],
  },
  Uranus: {
    key: "Uranus", name: "Uranus", type: "Ice giant", a_au: 19.182,
    diameter_km: 50724, distanceNote: "~19.2 AU from the Sun",
    color: "#9EE3E0",
    facts: [
      "Rotates on its side — its axis is tilted 98°.",
      "Coldest planetary atmosphere, down to −224 °C.",
      "First planet discovered with a telescope (1781).",
    ],
  },
  Neptune: {
    key: "Neptune", name: "Neptune", type: "Ice giant", a_au: 30.058,
    diameter_km: 49244, distanceNote: "~30 AU from the Sun",
    color: "#3E66F0",
    facts: [
      "Winds reach 2,100 km/h — the fastest in the Solar System.",
      "Discovered by mathematics before being seen (1846).",
      "One orbit takes about 165 Earth years.",
    ],
  },
};

export const PLANET_ORDER = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"];
