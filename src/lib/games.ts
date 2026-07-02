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
      "Classic maze-tank battle! Shells bounce off walls — dodge, trap, and outsmart your rival. Grab power-ups, survive sudden death, first to 5 wins. Play a friend on one keyboard or take on the AI.",
    genre: "Arcade / Versus",
    cover: "/games/tank-wars/cover.jpg",
    url: "/games/tank-wars/index.html",
    color: "#ffb347",
    cartridgeColor: "#241505",
    cartridgeLabelColor: "#ffd166",
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
    status: "coming_soon",
  },
];
