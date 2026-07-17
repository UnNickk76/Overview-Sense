// Scientific constellation dataset for Sky Vision™.
// Lines follow the conventional IAU/atlas stick figures. Every star name here
// exists in STARS (stars.ts) with real RA/Dec, so positions are never invented.
// `figure` is an ordered loop used to draw the elegant "light figure" that is
// generated FROM the real stars (Beyond View: no imported artwork).

export interface ConstellationInfo {
  history: string;
  mythology: string;
  bestPeriod: string;      // best months to observe (IT)
  bestPeriodEn: string;
  curiosities: string[];
  curiositiesEn: string[];
}

export interface Constellation {
  key: string;
  name: string;            // proprietary/proper noun — kept the same in both languages
  it: string;              // Italian common name
  stars: string[];         // member star names (must exist in STARS)
  lines: [string, string][];
  figure: string[];        // ordered star loop for the light figure (may be open)
  summary: string;         // Sense Summary™ (Italian, 10-20s read)
  summaryEn: string;
  info: ConstellationInfo;
}

export const CONSTELLATIONS: Constellation[] = [
  {
    key: "Orion", name: "Orion", it: "Orione",
    stars: ["Betelgeuse", "Rigel", "Bellatrix", "Alnilam", "Alnitak", "Mintaka", "Saiph", "Meissa"],
    lines: [
      ["Meissa", "Betelgeuse"], ["Meissa", "Bellatrix"],
      ["Betelgeuse", "Alnitak"], ["Bellatrix", "Mintaka"],
      ["Mintaka", "Alnilam"], ["Alnilam", "Alnitak"],
      ["Saiph", "Alnitak"], ["Rigel", "Mintaka"],
    ],
    figure: ["Betelgeuse", "Bellatrix", "Mintaka", "Rigel", "Saiph", "Alnitak", "Betelgeuse"],
    summary: "Orione è probabilmente la costellazione più famosa del cielo invernale. Rappresenta il cacciatore della mitologia greca ed è facilmente riconoscibile grazie alle tre stelle della sua cintura.",
    summaryEn: "Orion is probably the most famous constellation of the winter sky. It represents the hunter of Greek mythology and is easy to spot thanks to the three stars of its belt.",
    info: {
      history: "Riconosciuta da tutte le grandi civiltà antiche, da Babilonia all'Egitto. Le tre stelle della Cintura sono un riferimento usato per orientarsi nel cielo.",
      mythology: "Orione era un gigantesco cacciatore. Secondo il mito fu ucciso da uno scorpione (Scorpius): per questo le due costellazioni non appaiono mai insieme nel cielo.",
      bestPeriod: "Da dicembre a marzo, alta nel cielo serale.",
      bestPeriodEn: "December to March, high in the evening sky.",
      curiosities: [
        "Betelgeuse è una supergigante rossa così grande che, al posto del Sole, ingloberebbe l'orbita di Giove.",
        "La Nebulosa di Orione (M42), nella Spada, è una vera fabbrica di stelle visibile a occhio nudo.",
        "Rigel, blu e caldissima, è circa 120.000 volte più luminosa del Sole.",
      ],
      curiositiesEn: [
        "Betelgeuse is a red supergiant so large it would swallow Jupiter's orbit if placed at the Sun.",
        "The Orion Nebula (M42), in the Sword, is a real star factory visible to the naked eye.",
        "Rigel, blue and scorching, is about 120,000 times more luminous than the Sun.",
      ],
    },
  },
  {
    key: "Ursa Major", name: "Ursa Major", it: "Orsa Maggiore",
    stars: ["Dubhe", "Merak", "Phecda", "Megrez", "Alioth", "Mizar", "Alkaid"],
    lines: [
      ["Dubhe", "Merak"], ["Merak", "Phecda"], ["Phecda", "Megrez"], ["Megrez", "Dubhe"],
      ["Megrez", "Alioth"], ["Alioth", "Mizar"], ["Mizar", "Alkaid"],
    ],
    figure: ["Dubhe", "Merak", "Phecda", "Megrez", "Dubhe"],
    summary: "L'Orsa Maggiore ospita il celebre Grande Carro, sette stelle luminose che quasi tutti sanno riconoscere. Dubhe e Merak puntano dritte verso la Stella Polare.",
    summaryEn: "Ursa Major hosts the famous Big Dipper, seven bright stars almost everyone can recognize. Dubhe and Merak point straight to the Pole Star.",
    info: {
      history: "Una delle costellazioni più antiche e universali. Nell'emisfero nord è visibile tutto l'anno perché circumpolare.",
      mythology: "Nella mitologia greca è la ninfa Callisto, trasformata in orsa da Era e posta in cielo da Zeus.",
      bestPeriod: "Visibile tutto l'anno dall'emisfero nord; più alta in primavera.",
      bestPeriodEn: "Visible all year from the northern hemisphere; highest in spring.",
      curiosities: [
        "Le due 'stelle puntatrici' Dubhe e Merak indicano la Stella Polare: prolunga la loro linea di 5 volte.",
        "Mizar ha una compagna, Alcor: distinguerle era un antico test della vista.",
        "Non è la stessa cosa dell'Orsa: il Grande Carro è solo la parte più brillante.",
      ],
      curiositiesEn: [
        "The two 'pointer stars' Dubhe and Merak indicate Polaris: extend their line five times.",
        "Mizar has a companion, Alcor: telling them apart was an ancient eyesight test.",
        "The Big Dipper is only the brightest part of the larger bear figure.",
      ],
    },
  },
  {
    key: "Ursa Minor", name: "Ursa Minor", it: "Orsa Minore",
    stars: ["Polaris", "Kochab", "Pherkad"],
    lines: [["Kochab", "Pherkad"], ["Kochab", "Polaris"]],
    figure: ["Polaris", "Kochab", "Pherkad"],
    summary: "L'Orsa Minore è la casa della Stella Polare, il punto quasi fisso attorno a cui ruota tutto il cielo del nord.",
    summaryEn: "Ursa Minor is home to Polaris, the near-fixed point around which the entire northern sky rotates.",
    info: {
      history: "Usata da millenni per la navigazione: la Polare indica il nord con grande precisione.",
      mythology: "Rappresenta Arcade, figlio di Callisto, anch'egli posto in cielo da Zeus.",
      bestPeriod: "Sempre visibile dall'emisfero nord (circumpolare).",
      bestPeriodEn: "Always visible from the northern hemisphere (circumpolar).",
      curiosities: [
        "La Polare non è particolarmente brillante: la sua fama viene dalla posizione, non dalla luce.",
        "Tra 12.000 anni la 'stella polare' sarà Vega, per via della precessione terrestre.",
      ],
      curiositiesEn: [
        "Polaris isn't especially bright: its fame comes from its position, not its light.",
        "In 12,000 years the 'pole star' will be Vega, due to Earth's precession.",
      ],
    },
  },
  {
    key: "Cassiopeia", name: "Cassiopeia", it: "Cassiopea",
    stars: ["Schedar", "Caph", "Gamma Cas", "Ruchbah", "Segin"],
    lines: [["Caph", "Schedar"], ["Schedar", "Gamma Cas"], ["Gamma Cas", "Ruchbah"], ["Ruchbah", "Segin"]],
    figure: ["Caph", "Schedar", "Gamma Cas", "Ruchbah", "Segin"],
    summary: "Cassiopea si riconosce subito per la sua inconfondibile forma a W (o M). È circumpolare e sembra ruotare per sempre attorno alla Polare.",
    summaryEn: "Cassiopeia is instantly recognizable by its unmistakable W (or M) shape. It is circumpolar and seems to rotate forever around Polaris.",
    info: {
      history: "Opposta all'Orsa Maggiore rispetto alla Polare: quando una è alta, l'altra è bassa.",
      mythology: "Cassiopea era una regina vanitosa, condannata a girare a testa in giù nel cielo per la sua arroganza.",
      bestPeriod: "Autunno e inverno, alta nel cielo del nord.",
      bestPeriodEn: "Autumn and winter, high in the northern sky.",
      curiosities: [
        "La sua W attraversa la Via Lattea: con un binocolo si vedono ricchi campi stellari.",
        "Ospitò una famosa supernova osservata da Tycho Brahe nel 1572.",
      ],
      curiositiesEn: [
        "Its W lies across the Milky Way: binoculars reveal rich star fields.",
        "It hosted a famous supernova observed by Tycho Brahe in 1572.",
      ],
    },
  },
  {
    key: "Cygnus", name: "Cygnus", it: "Cigno",
    stars: ["Deneb", "Sadr", "Albireo", "Gienah Cygni", "Delta Cygni"],
    lines: [["Deneb", "Sadr"], ["Sadr", "Albireo"], ["Gienah Cygni", "Sadr"], ["Sadr", "Delta Cygni"]],
    figure: ["Deneb", "Sadr", "Albireo"],
    summary: "Il Cigno vola lungo la Via Lattea con la sua grande forma a croce, detta Croce del Nord. Deneb, in coda, è una delle stelle più luminose che conosciamo.",
    summaryEn: "Cygnus flies along the Milky Way with its large cross shape, the Northern Cross. Deneb, at the tail, is one of the most luminous stars we know.",
    info: {
      history: "La 'Croce del Nord' domina i cieli estivi ed è un riferimento della Via Lattea.",
      mythology: "Rappresenta Zeus trasformato in cigno, o l'amico di Fetonte che ne cercò i resti nel fiume.",
      bestPeriod: "Estate e inizio autunno, allo zenit serale.",
      bestPeriodEn: "Summer and early autumn, near the evening zenith.",
      curiosities: [
        "Deneb è così lontana (~2.600 anni luce) eppure brillante: è decine di migliaia di volte più luminosa del Sole.",
        "Albireo, alla testa, è una splendida doppia: una stella dorata e una blu.",
        "Qui si trova Cygnus X-1, uno dei primi buchi neri mai identificati.",
      ],
      curiositiesEn: [
        "Deneb is so distant (~2,600 ly) yet bright: it is tens of thousands of times more luminous than the Sun.",
        "Albireo, at the head, is a beautiful double: a golden and a blue star.",
        "It contains Cygnus X-1, one of the first black holes ever identified.",
      ],
    },
  },
  {
    key: "Leo", name: "Leo", it: "Leone",
    stars: ["Regulus", "Denebola", "Algieba", "Zosma", "Chort", "Adhafera", "Rasalas"],
    lines: [
      ["Regulus", "Algieba"], ["Algieba", "Adhafera"], ["Adhafera", "Rasalas"],
      ["Algieba", "Zosma"], ["Zosma", "Denebola"], ["Denebola", "Chort"], ["Chort", "Regulus"],
    ],
    figure: ["Regulus", "Algieba", "Zosma", "Denebola", "Chort", "Regulus"],
    summary: "Il Leone è una delle poche costellazioni che ricorda davvero la sua figura: un felino sdraiato. La testa forma un punto interrogativo rovesciato, la Falce.",
    summaryEn: "Leo is one of the few constellations that truly resembles its figure: a reclining lion. Its head forms a backwards question mark, the Sickle.",
    info: {
      history: "Costellazione dello zodiaco, attraversata dal Sole in estate.",
      mythology: "È il leone di Nemea ucciso da Eracle nella prima delle sue dodici fatiche.",
      bestPeriod: "Primavera, alto nel cielo serale.",
      bestPeriodEn: "Spring, high in the evening sky.",
      curiosities: [
        "Regulus, il 'piccolo re', giace quasi esattamente sull'eclittica: spesso vicino a Luna e pianeti.",
        "Ogni novembre irradia le Leonidi, uno sciame meteorico a volte spettacolare.",
      ],
      curiositiesEn: [
        "Regulus, the 'little king', lies almost exactly on the ecliptic: often near the Moon and planets.",
        "Every November it radiates the Leonids, a sometimes spectacular meteor shower.",
      ],
    },
  },
  {
    key: "Gemini", name: "Gemini", it: "Gemelli",
    stars: ["Castor", "Pollux", "Alhena", "Wasat", "Mebsuta", "Tejat"],
    lines: [["Castor", "Pollux"], ["Pollux", "Wasat"], ["Wasat", "Alhena"], ["Castor", "Mebsuta"], ["Mebsuta", "Tejat"]],
    figure: ["Castor", "Mebsuta", "Tejat", "Alhena", "Wasat", "Pollux"],
    summary: "I Gemelli sono guidati da due stelle vicine e luminose, Castore e Polluce, che rappresentano le teste dei due fratelli mitologici.",
    summaryEn: "Gemini is led by two close, bright stars, Castor and Pollux, representing the heads of the two mythological brothers.",
    info: {
      history: "Costellazione zodiacale invernale, facile da individuare vicino a Orione.",
      mythology: "Castore e Polluce, i Dioscuri: quando Castore morì, Polluce chiese a Zeus di condividere l'immortalità.",
      bestPeriod: "Inverno, da gennaio a marzo.",
      bestPeriodEn: "Winter, from January to March.",
      curiosities: [
        "Polluce ha un pianeta confermato, Pollux b, un gigante gassoso.",
        "Castore in realtà è un sistema di sei stelle legate gravitazionalmente.",
      ],
      curiositiesEn: [
        "Pollux hosts a confirmed planet, Pollux b, a gas giant.",
        "Castor is actually a system of six gravitationally bound stars.",
      ],
    },
  },
  {
    key: "Taurus", name: "Taurus", it: "Toro",
    stars: ["Aldebaran", "Elnath", "Alcyone"],
    lines: [["Aldebaran", "Elnath"], ["Aldebaran", "Alcyone"]],
    figure: ["Elnath", "Aldebaran", "Alcyone"],
    summary: "Il Toro è dominato da Aldebaran, l'occhio rosso dell'animale, e ospita le Pleiadi, il piccolo ammasso di stelle azzurre più celebre del cielo.",
    summaryEn: "Taurus is dominated by Aldebaran, the red eye of the bull, and hosts the Pleiades, the sky's most famous little cluster of blue stars.",
    info: {
      history: "Una delle costellazioni più antiche, forse rappresentata già nelle pitture rupestri.",
      mythology: "È Zeus trasformato in toro bianco per rapire la principessa Europa.",
      bestPeriod: "Inverno, da novembre a febbraio.",
      bestPeriodEn: "Winter, from November to February.",
      curiosities: [
        "Aldebaran sembra parte delle Iadi ma è molto più vicina: è solo un allineamento prospettico.",
        "Le Pleiadi (M45) sono giovanissime: appena ~100 milioni di anni.",
      ],
      curiositiesEn: [
        "Aldebaran appears part of the Hyades but is much closer: just a line-of-sight alignment.",
        "The Pleiades (M45) are very young: only ~100 million years old.",
      ],
    },
  },
  {
    key: "Scorpius", name: "Scorpius", it: "Scorpione",
    stars: ["Antares", "Shaula", "Sargas", "Dschubba"],
    lines: [["Dschubba", "Antares"], ["Antares", "Sargas"], ["Sargas", "Shaula"]],
    figure: ["Dschubba", "Antares", "Sargas", "Shaula"],
    summary: "Lo Scorpione è una delle rare costellazioni che somiglia davvero al suo nome, con la coda ricurva e il cuore rosso Antares che pulsa nel cielo estivo.",
    summaryEn: "Scorpius is one of the rare constellations that truly looks like its name, with a curved tail and the red heart Antares pulsing in the summer sky.",
    info: {
      history: "Bassa sull'orizzonte per l'Europa, spettacolare dai cieli del sud.",
      mythology: "È lo scorpione che uccise Orione: posti agli antipodi del cielo, non si incontrano mai.",
      bestPeriod: "Estate, da giugno ad agosto (bassa a sud).",
      bestPeriodEn: "Summer, June to August (low in the south).",
      curiosities: [
        "Antares, 'rivale di Marte', è una supergigante rossa 700 volte più grande del Sole.",
        "La coda punta verso il centro della Via Lattea, ricchissimo di stelle.",
      ],
      curiositiesEn: [
        "Antares, 'rival of Mars', is a red supergiant 700 times larger than the Sun.",
        "The tail points toward the star-rich center of the Milky Way.",
      ],
    },
  },
  {
    key: "Lyra", name: "Lyra", it: "Lira",
    stars: ["Vega", "Sheliak", "Sulafat"],
    lines: [["Vega", "Sheliak"], ["Sheliak", "Sulafat"], ["Sulafat", "Vega"]],
    figure: ["Vega", "Sheliak", "Sulafat", "Vega"],
    summary: "Piccola ma preziosa, la Lira è guidata da Vega, una delle stelle più brillanti e azzurre del cielo estivo.",
    summaryEn: "Small but precious, Lyra is led by Vega, one of the brightest and bluest stars of the summer sky.",
    info: {
      history: "Vega fu la prima stella (dopo il Sole) a essere fotografata, nel 1850.",
      mythology: "Rappresenta la lira di Orfeo, capace di incantare persino le pietre.",
      bestPeriod: "Estate, allo zenit serale.",
      bestPeriodEn: "Summer, near the evening zenith.",
      curiosities: [
        "Vega sarà la nostra stella polare tra circa 12.000 anni.",
        "Tra Sheliak e Sulafat si nasconde la Nebulosa Anello (M57), un anello di gas espulso da una stella morente.",
      ],
      curiositiesEn: [
        "Vega will be our pole star in about 12,000 years.",
        "Between Sheliak and Sulafat hides the Ring Nebula (M57), a ring of gas from a dying star.",
      ],
    },
  },
  {
    key: "Aquila", name: "Aquila", it: "Aquila",
    stars: ["Altair", "Tarazed", "Alshain"],
    lines: [["Tarazed", "Altair"], ["Altair", "Alshain"]],
    figure: ["Tarazed", "Altair", "Alshain"],
    summary: "L'Aquila vola lungo la Via Lattea guidata da Altair, una delle stelle più vicine visibili a occhio nudo, affiancata da due stelle minori.",
    summaryEn: "Aquila flies along the Milky Way led by Altair, one of the nearest naked-eye stars, flanked by two fainter stars.",
    info: {
      history: "Altair forma con Vega e Deneb il grande Triangolo Estivo.",
      mythology: "È l'aquila di Zeus, che portava i suoi fulmini.",
      bestPeriod: "Estate, alta nel cielo serale.",
      bestPeriodEn: "Summer, high in the evening sky.",
      curiosities: [
        "Altair ruota così velocemente su sé stessa da essere schiacciata ai poli.",
        "Dista solo ~16,7 anni luce: la sua luce è partita meno di 17 anni fa.",
      ],
      curiositiesEn: [
        "Altair spins so fast it is flattened at the poles.",
        "It is only ~16.7 light-years away: its light left less than 17 years ago.",
      ],
    },
  },
  {
    key: "Boötes", name: "Boötes", it: "Boote",
    stars: ["Arcturus", "Izar", "Seginus", "Nekkar", "Muphrid"],
    lines: [["Arcturus", "Izar"], ["Izar", "Seginus"], ["Seginus", "Nekkar"], ["Arcturus", "Muphrid"]],
    figure: ["Muphrid", "Arcturus", "Izar", "Seginus", "Nekkar"],
    summary: "Boote, il mandriano, ha la forma di un grande aquilone. È guidato da Arcturus, la stella più brillante dell'emisfero nord.",
    summaryEn: "Boötes, the herdsman, is shaped like a large kite. It is led by Arcturus, the brightest star of the northern hemisphere.",
    info: {
      history: "Per trovare Arcturus si 'segue l'arco' del manico del Grande Carro.",
      mythology: "Rappresenta un pastore o cacciatore che insegue le orse attorno al polo.",
      bestPeriod: "Primavera ed estate.",
      bestPeriodEn: "Spring and summer.",
      curiosities: [
        "Arcturus è una gigante arancione che si muove velocemente rispetto alle altre stelle.",
        "La sua luce fu usata per inaugurare l'Esposizione di Chicago del 1933.",
      ],
      curiositiesEn: [
        "Arcturus is an orange giant moving fast relative to other stars.",
        "Its light was used to open the 1933 Chicago World's Fair.",
      ],
    },
  },
  {
    key: "Canis Major", name: "Canis Major", it: "Cane Maggiore",
    stars: ["Sirius", "Adhara", "Wezen", "Mirzam", "Aludra"],
    lines: [["Mirzam", "Sirius"], ["Sirius", "Adhara"], ["Adhara", "Wezen"], ["Wezen", "Aludra"]],
    figure: ["Sirius", "Mirzam", "Adhara", "Wezen", "Aludra"],
    summary: "Il Cane Maggiore contiene Sirio, la stella più brillante di tutto il cielo notturno. Segue Orione come il suo cane da caccia.",
    summaryEn: "Canis Major contains Sirius, the brightest star in the entire night sky. It follows Orion like his hunting dog.",
    info: {
      history: "Il sorgere eliaco di Sirio segnava per gli Egizi la piena del Nilo.",
      mythology: "È uno dei cani da caccia di Orione, fedele ai suoi piedi.",
      bestPeriod: "Inverno, da dicembre a marzo.",
      bestPeriodEn: "Winter, December to March.",
      curiosities: [
        "Sirio brilla tanto perché è vicina (8,6 anni luce) e intrinsecamente luminosa.",
        "Ha una piccola compagna, Sirio B, una densissima nana bianca.",
      ],
      curiositiesEn: [
        "Sirius shines so brightly because it is close (8.6 ly) and intrinsically luminous.",
        "It has a tiny companion, Sirius B, an extremely dense white dwarf.",
      ],
    },
  },
  {
    key: "Perseus", name: "Perseus", it: "Perseo",
    stars: ["Mirfak", "Algol", "Atik"],
    lines: [["Mirfak", "Algol"], ["Mirfak", "Atik"]],
    figure: ["Atik", "Mirfak", "Algol"],
    summary: "Perseo giace nella Via Lattea invernale e contiene Algol, la 'stella demone', famosa per cambiare luminosità ogni pochi giorni.",
    summaryEn: "Perseus lies in the winter Milky Way and contains Algol, the 'demon star', famous for changing brightness every few days.",
    info: {
      history: "Ospita il celebre Doppio Ammasso, splendido al binocolo.",
      mythology: "È l'eroe che decapitò Medusa: Algol rappresenta l'occhio della Gorgone.",
      bestPeriod: "Autunno e inverno.",
      bestPeriodEn: "Autumn and winter.",
      curiosities: [
        "Algol è una binaria a eclisse: cala di luminosità ogni 2,87 giorni quando la compagna la copre.",
        "Da qui irradiano le Perseidi, lo sciame meteorico d'agosto.",
      ],
      curiositiesEn: [
        "Algol is an eclipsing binary: it dims every 2.87 days when its companion covers it.",
        "The August Perseid meteor shower radiates from here.",
      ],
    },
  },
  {
    key: "Andromeda", name: "Andromeda", it: "Andromeda",
    stars: ["Alpheratz", "Mirach", "Almach"],
    lines: [["Alpheratz", "Mirach"], ["Mirach", "Almach"]],
    figure: ["Alpheratz", "Mirach", "Almach"],
    summary: "Andromeda è famosa perché ospita la Galassia di Andromeda, l'oggetto più lontano visibile a occhio nudo e la nostra grande vicina cosmica.",
    summaryEn: "Andromeda is famous for hosting the Andromeda Galaxy, the most distant object visible to the naked eye and our great cosmic neighbour.",
    info: {
      history: "Da Mirach si 'salta' facilmente alla galassia M31.",
      mythology: "Andromeda, principessa incatenata a una roccia, fu salvata da Perseo dal mostro marino Ceto.",
      bestPeriod: "Autunno, alta nel cielo serale.",
      bestPeriodEn: "Autumn, high in the evening sky.",
      curiosities: [
        "La Galassia di Andromeda (M31) dista ~2,5 milioni di anni luce: la vedi com'era prima dell'uomo moderno.",
        "Tra ~4 miliardi di anni si fonderà con la Via Lattea.",
      ],
      curiositiesEn: [
        "The Andromeda Galaxy (M31) is ~2.5 million ly away: you see it as it was before modern humans.",
        "In ~4 billion years it will merge with the Milky Way.",
      ],
    },
  },
];

export const CONSTELLATION_BY_KEY: Record<string, Constellation> =
  Object.fromEntries(CONSTELLATIONS.map((c) => [c.key, c]));

// Backward-compatible aggregate of all line segments (used by legacy overlays).
export const CONSTELLATION_LINES: [string, string][] =
  CONSTELLATIONS.flatMap((c) => c.lines);

// Every star that belongs to any drawn constellation.
export const CONSTELLATION_STAR_NAMES = new Set<string>(
  CONSTELLATIONS.flatMap((c) => c.stars),
);

// A constellation is "recognized" when enough of its member stars are actually
// projected within the current frame (never invented). Big patterns need >=3,
// small 3-star ones need all present.
export function activeConstellations(visible: Set<string>): Constellation[] {
  return CONSTELLATIONS.filter((c) => {
    const present = c.stars.filter((s) => visible.has(s)).length;
    const need = c.stars.length <= 3 ? c.stars.length : Math.max(3, Math.ceil(c.stars.length * 0.5));
    return present >= need;
  });
}
