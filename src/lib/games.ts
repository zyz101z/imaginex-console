export interface Game {
  id: string;
  title: string;
  description: string;
  genre: string;
  cover: string; // SVG cover art for cartridge label
  url: string;
  color: string;
  cartridgeColor: string;
  cartridgeLabelColor: string;
  status: "available" | "coming_soon";
}

export const games: Game[] = [
  {
    id: "bloot",
    title: "Bloot",
    description:
      "A fast-paced mountain racing adventure! Race through treacherous peaks and prove you're the fastest on the mountain!",
    genre: "Racing / Adventure",
    cover: "/games/bloot/cover.png",
    url: "/games/bloot/index.html",
    color: "#f44336",
    cartridgeColor: "#b71c1c",
    cartridgeLabelColor: "#ff8a65",
    status: "available",
  },
  {
    id: "tennis-world",
    title: "Tennis World",
    description:
      "An epic pixel-art tennis RPG. Explore elemental zones, battle opponents, collect gear, and become the ultimate tennis champion!",
    genre: "RPG / Sports",
    cover: "/games/tennis-world/cover.png",
    url: "/games/tennis-world/index.html",
    color: "#4fc3f7",
    cartridgeColor: "#1a237e",
    cartridgeLabelColor: "#4fc3f7",
    status: "available",
  },
  {
    id: "froggo-adventure",
    title: "Froggo Adventure",
    description:
      "A 16-bit-style swamp platformer! Run, jump, and roll as Froggo, collect golden droplets, smash Bugbots, and stop Dr. Slither.",
    genre: "Platformer / Action",
    cover: "/games/froggo-adventure/cover.png",
    url: "/games/froggo-adventure/index.html",
    color: "#4ebf68",
    cartridgeColor: "#1e6e3a",
    cartridgeLabelColor: "#ffe066",
    status: "available",
  },
  {
    id: "divided-states",
    title: "Divided States",
    description:
      "A Risk-style war of conquest across the real US map. Reinforce, attack with dice, and fortify your way to controlling all 49 states. Battle 2-6 commanders, human or AI.",
    genre: "Strategy / War",
    cover: "/games/divided-states/cover.png",
    url: "/games/divided-states/index.html",
    color: "#6aa9ff",
    cartridgeColor: "#16233a",
    cartridgeLabelColor: "#8af3ff",
    status: "available",
  },
  {
    id: "tank-wars",
    title: "Tank Wars",
    description:
      "Classic maze-tank battle! Shells bounce off walls — dodge, trap, and outsmart your rival. Earn scrap, unlock 5 tanks with wildly different weapons, and climb the 10-battle campaign.",
    genre: "Arcade / Action",
    cover: "/games/tank-wars/cover.jpg",
    url: "/games/tank-wars/index.html",
    color: "#ffb347",
    cartridgeColor: "#241505",
    cartridgeLabelColor: "#ffd166",
    status: "available",
  },
  {
    id: "creature-cove",
    title: "Creature Cove",
    description:
      "Breed fantasy creatures and grow a magical cove! Combine elements to discover all 15 species — from Gnomes to the legendary Dragon — hunt shimmering Rare and Epic variants, and build your gold-earning lair.",
    genre: "Breeding / Idle Sim",
    cover: "/games/creature-cove/cover.jpg",
    url: "/games/creature-cove/index.html",
    color: "#7fd8c8",
    cartridgeColor: "#0a2233",
    cartridgeLabelColor: "#7fd8c8",
    status: "available",
  },
  {
    id: "pig-merge-tycoon",
    title: "Pig Merge Tycoon",
    description:
      "Buy piglets, let them dig up truffles for coins, and drag matching pigs together to merge them into ever-fancier hogs — 20 tiers deep, from Piglet through knights, emperors and galaxies to the COSMIC PIG. Peek inside mystery crates, upgrade the farm, and sell it all to rebirth with double profits.",
    genre: "Idle / Merge Tycoon",
    cover: "/games/pig-merge-tycoon/cover.png",
    url: "/games/pig-merge-tycoon/index.html",
    color: "#ff9ec4",
    cartridgeColor: "#3a2415",
    cartridgeLabelColor: "#ffb8d4",
    status: "available",
  },
  {
    id: "gridiron-gm",
    title: "Gridiron GM",
    description:
      "Run a pro football franchise: sim games drive by drive, call the gameplan, work the draft, swing trades, sign extensions, hire coaches, and chase the Gridiron Bowl through weather, injuries and a living league of news, awards and rivals.",
    genre: "Sports / Management",
    cover: "/games/gridiron-gm/cover.jpg",
    url: "/games/gridiron-gm/index.html",
    color: "#8bc34a",
    cartridgeColor: "#14320f",
    cartridgeLabelColor: "#ffd54f",
    status: "available",
  },
  {
    id: "freight-nation",
    title: "Freight Nation",
    description:
      "You dispatch, you don't drive. Run a freight company from the map: plan routes on real highways, dodge rush hour, wildfires and wrecks, keep drivers rested and tanks full, and collect a passport of freeway shields as you go. Grow one rusty van into a whole fleet.",
    genre: "Logistics / Strategy Sim",
    cover: "/games/freight-nation/cover.png",
    url: "/games/freight-nation/index.html",
    color: "#ffd75e",
    cartridgeColor: "#101c2b",
    cartridgeLabelColor: "#ffd75e",
    status: "available",
  },
  {
    id: "wilson",
    title: "Wilson's Spray World",
    description:
      "Wilson's a zombie skater kid with a spray can. Roll up to a wall, paint what it asks for — skulls, cats, his signature drip-smiley tag — and stack coins for wild fills. Unlock neon paint, fat caps, and fresh tag colors. Never fail a wall, just get fresher.",
    genre: "Creative / Arcade",
    cover: "/games/wilson/cover.png",
    url: "/games/wilson/index.html",
    color: "#a25bff",
    cartridgeColor: "#140f1e",
    cartridgeLabelColor: "#c89bff",
    status: "available",
  },
  {
    id: "x-bros",
    title: "X-Bros",
    description:
      "ImagineX Smash! A 2D platform fighter starring heroes from across the ImagineX universe — knock your friends off the stage to win.",
    genre: "Fighter / Party",
    cover: "/games/x-bros/cover.png",
    url: "/games/x-bros/index.html",
    color: "#9ad6ff",
    cartridgeColor: "#10254a",
    cartridgeLabelColor: "#ffe066",
    status: "available",
  },
];
