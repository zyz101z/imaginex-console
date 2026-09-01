// Per-game SEO landing-page copy for /play/[slug]. Server-rendered so search
// engines see real text (the console itself is a client-side SPA — one URL).
// Keyed by game id; ONLY publicly launched games belong here (this list, not
// games.ts, drives generateStaticParams — local/unreleased registry entries
// never leak into the sitemap or the built pages).

export interface GameSeo {
  id: string;
  seoTitle: string; // <title> — long-tail search phrase
  metaDescription: string; // ~155 chars for the SERP snippet
  tagline: string; // h1 subtitle on the page
  about: string[]; // body paragraphs (real content, not fluff)
  features: string[];
  howToPlay: string[];
  keywords: string[];
}

export const gameSeo: GameSeo[] = [
  {
    id: "gridiron-gm",
    seoTitle: "Gridiron GM — Free NFL-Style Football Franchise Simulator Game",
    metaDescription:
      "Run a pro football franchise free in your browser: draft, trade, sign free agents, call clutch plays, and chase the Gridiron Bowl. No download needed.",
    tagline: "The front office is yours. Build a dynasty.",
    about: [
      "Gridiron GM is a free browser-based football general manager simulator. You take over one of 32 teams and run the whole franchise: set the gameplan, watch games unfold drive by drive on a live ticker, and make the calls that swing a season — go for it on 4th down, try the 2-point conversion, ice the opposing kicker with the game on the line.",
      "The offseason is the deep end: scout a fog-of-war draft class full of sleepers and busts, work the trade deadline against rival GMs with real personalities, survive holdouts, hand out extensions, hire coaches whose schemes reshape your identity, and keep an impatient owner happy. Every season ends with awards night, All-Pro teams, a record book, and a Hall of Fame that remembers.",
      "Weather changes games, injuries test your depth chart, and a living news feed turns every league into its own story. Saves live in your browser — pick your team and start building.",
    ],
    features: [
      "Full franchise loop: 18-week season, playoffs, draft, free agency, trades, training camp",
      "Live Coach's Calls — 4th downs, 2-point tries, onside kicks, icing the kicker",
      "Scouting with sleepers and busts, draft-day pick trades, rival GM archetypes",
      "Player personalities, holdouts, franchise tags, retirements and a Hall of Fame",
      "Weather, injuries, awards, records, yearbooks — a league that feels alive",
    ],
    howToPlay: [
      "Pick a franchise and a salary-cap mode, then advance week by week.",
      "Your game plays on a drive ticker — pause moments let you make the big calls.",
      "Between weeks: adjust the gameplan sliders, work trades, and manage the roster.",
      "In the offseason, re-sign your stars, shop free agency, and draft the future.",
    ],
    keywords: ["football gm game", "free nfl franchise simulator", "browser football manager game", "football general manager sim"],
  },
  {
    id: "divided-states",
    seoTitle: "Divided States — Free Risk-Style Strategy Game on the US Map",
    metaDescription:
      "Conquer all 49 states in this free Risk-style browser war game. Dice battles, team mode, and 2-6 players — humans or AI. Play instantly, no download.",
    tagline: "One nation. Six armies. Zero mercy.",
    about: [
      "Divided States is a free Risk-style conquest game played on the real map of the continental United States. Reinforce your borders, attack neighboring states with dice, and fortify your lines until one commander controls all 49 states.",
      "Play solo against cunning AI commanders, pass-and-play with up to six players, or split into teams and coordinate a coast-to-coast war. Region bonuses reward holding the West, the South, New England and more — stretch too thin and your empire cracks.",
      "Alternate win modes keep matches fresh: Region Rush races to control key regions, and Blitz mode delivers a fast, aggressive war for shorter sessions. Save mid-match and resume any time.",
    ],
    features: [
      "The real US map — 49 states, region bonuses, choke points that matter",
      "2-6 commanders: any mix of humans and AI, plus full Team Mode",
      "Classic conquest rules plus Region Rush and Blitz win variants",
      "Dice-battle combat with visible odds, match stats, and elimination drama",
      "Save and resume; plays great with mouse or touch",
    ],
    howToPlay: [
      "Each turn: place reinforcements, attack neighboring states, then fortify.",
      "Attacks roll dice — bigger armies help, but luck writes headlines.",
      "Hold whole regions for bonus troops each turn.",
      "Eliminate every rival (or complete your win variant's goal) to take the map.",
    ],
    keywords: ["risk style game free", "usa map strategy game", "free browser war game", "states conquest game online"],
  },
  {
    id: "pig-merge-tycoon",
    seoTitle: "Pig Merge Tycoon — Free Merge & Idle Farm Game Online",
    metaDescription:
      "Merge pigs, dig truffles, and build a farm empire in this free idle merge game. 30 pig tiers, mystery crates, rebirths and ribbons. Play in your browser.",
    tagline: "Merge two pigs. Discover something fancier.",
    about: [
      "Pig Merge Tycoon is a free merge-and-idle farm game. Buy piglets, let them snuffle up truffles that sell for coins at the market stand, then drag two matching pigs together to merge them into something bigger, stranger, and far more profitable.",
      "The ladder runs 30 tiers deep, and every new pig is a surprise — first-time discoveries get a full celebration. Mystery crates surface from the mud with the odds shown before you pay, upgrades speed the farm up, and when you reach the deep tiers you can sell the whole thing to rebirth with permanently doubled profits.",
      "Earn Blue Ribbons for farm milestones, dress the farm in winter, night, and beach styles, name your favorite pigs, and collect while you're away — your herd keeps digging even when the tab is closed.",
    ],
    features: [
      "Drag-to-merge pigs across 30 discoverable tiers",
      "Mystery crates with the pull odds shown up front",
      "Rebirth system: trade the farm for permanent double profits",
      "41 Blue Ribbon milestones, farm themes, pig naming and tricks",
      "Offline earnings — the pigs work while you're gone",
    ],
    howToPlay: [
      "Tap BUY PIGLET and let your pigs dig truffles for coins.",
      "Drag one pig onto a matching pig to merge them up a tier.",
      "Spend coins on upgrades, pen expansions, and Prize Breeds stock.",
      "Reach the deep tiers, then SELL THE FARM to rebirth stronger.",
    ],
    keywords: ["merge game free", "idle tycoon game browser", "pig farm game online", "free merge idle game"],
  },
  {
    id: "tank-wars",
    seoTitle: "Tank Wars — Free Online Tank Battle Game with Co-op",
    metaDescription:
      "Bouncing-shell tank battles in your browser: campaign, daily challenges, boss rush, and online co-op survival with a friend. Free, no download.",
    tagline: "Every wall is a weapon.",
    about: [
      "Tank Wars is a free arcade tank battle game built around one delicious rule: shells bounce off walls. Every arena is a geometry puzzle — line up bank shots, set traps, and dodge your own ricochets in duels where the smarter tank wins.",
      "Battle through a 20-mission campaign with scripted boss fights, then take on Tank Storm survival waves, a shared Daily Storm seeded fresh every day, all-boss Boss Rush runs, and weekly rule twists that reshape the meta. Earn scrap to unlock a garage of tanks with wildly different weapons — from spread shots to shells that phase through walls.",
      "Grab a friend for online co-op storm survival or head-to-head versus over a direct connection, or share one keyboard for local duels. Streaks, medals, quests, and a real daily leaderboard keep the scrap flowing.",
    ],
    features: [
      "Ricochet combat across 10 arenas with hazards like crusher pads",
      "11-tank garage — every tank changes how you fight",
      "Campaign with boss fights, survival storms, Daily Storm and Boss Rush",
      "Online co-op and versus plus local same-keyboard duels",
      "Daily leaderboards, medals, play streaks and weekly twists",
    ],
    howToPlay: [
      "Drive with WASD or arrows; aim and fire with the mouse.",
      "Shells bounce — use walls for trick shots, and respect your own rebounds.",
      "Earn scrap from every mode to unlock new tanks and upgrades.",
      "In co-op, revive your partner between waves and split the perk drafts.",
    ],
    keywords: ["free tank game online", "tank battle browser game", "co-op tank game", "ricochet tank arcade game"],
  },
  {
    id: "freight-nation",
    seoTitle: "Freight Nation — Free Trucking & Logistics Strategy Game",
    metaDescription:
      "Build a trucking empire on a real US highway map: plan routes, manage drivers and fuel, dodge wildfires, and collect freeway shields. Free browser game.",
    tagline: "You dispatch. They drive. The map is real.",
    about: [
      "Freight Nation is a free logistics strategy game where you run a trucking company across a real map of the United States — 66 cities connected by genuine interstates, with routes planned on actual highway geometry.",
      "You never touch a steering wheel. Your job is the dispatch board: pick contracts, route trucks around rush hour, wildfires, and wrecks, keep drivers inside their legal hours, and make sure nobody runs the tank dry in the desert. Every decision compounds as one rusty van grows into a national fleet.",
      "Reputation unlocks eight regions of the country, drivers level up and develop traits, depots extend your reach, and a passport fills with 51 freeway shields as your trucks cross the map. Emergencies hit about once a day — a good dispatcher turns chaos into profit.",
    ],
    features: [
      "Real US highway map: 66 cities, 8 unlockable regions, time zones",
      "Route planning with traffic, weather, wildfires and lane premiums",
      "Driver management: hours-of-service, fatigue, XP and traits",
      "Company building — depots, fleet upgrades, emergency calls",
      "Freeway Passport: collect all 51 interstate shields",
    ],
    howToPlay: [
      "Accept contracts and assign them to trucks and drivers.",
      "Plot routes on the highway map — fastest isn't always safest.",
      "Refuel and rest drivers before the law (or the desert) does it for you.",
      "Reinvest profits in trucks, drivers, and depots to reach new regions.",
    ],
    keywords: ["trucking game free", "logistics game browser", "dispatch simulator game", "free strategy trucking game"],
  },
  {
    id: "creature-cove",
    seoTitle: "Creature Cove — Free Creature Breeding & Collection Game",
    metaDescription:
      "Breed and collect 15 fantasy creatures, hunt rare variants, and grow a magical gold-earning cove. A free monster-breeding browser game, no download.",
    tagline: "Two creatures walk in. Something new walks out.",
    about: [
      "Creature Cove is a free creature-breeding idle game. Combine creatures across four elements to discover all 15 species — from humble Gnomes up to the legendary Dragon — while your cove hums along earning gold day and night.",
      "Every species hides shimmering Rare and Epic variants for collectors to chase. Send teams on timed expeditions, complete quests, crack open the reward chest, and expand a cove that shifts between day and night as you build it out.",
      "Breeding combos are the puzzle at the heart of it: some pairings are obvious, some are secrets the wiki-minded will love hunting down. Your progress saves in the browser, so the cove is always waiting.",
    ],
    features: [
      "15 breedable species across 4 elements, with hidden combo recipes",
      "Rare and Epic variants of every creature",
      "Expeditions, quests, and a daily reward chest",
      "Idle gold economy with shrines and upgrades",
      "Day/night cove that grows with your collection",
    ],
    howToPlay: [
      "Place two creatures in the breeding den and see what emerges.",
      "Sell or house the results — housed creatures earn gold over time.",
      "Experiment with element pairings to uncover every species.",
      "Spend gold on habitats, shrines, and expedition gear.",
    ],
    keywords: ["creature breeding game free", "monster collecting browser game", "free breeding idle game", "creature collector online"],
  },
  {
    id: "x-bros",
    seoTitle: "X-Bros — Free 2-Player Platform Fighter Game in Your Browser",
    metaDescription:
      "A free Smash-style platform fighter: 8 fighters, 5 stages, items, and local 2-player battles. Knock your friends off the stage — right in the browser.",
    tagline: "Knock 'em off the stage. Style points optional.",
    about: [
      "X-Bros is a free Smash-style platform fighter starring heroes from across the ImagineX universe. Rack up damage, then send opponents flying off the stage — the higher their percent, the farther they fly.",
      "Eight fighters each bring their own weight, speed, and special moves, and five themed stages change how every match flows. Items rain down mid-fight — grab a star for invincibility, a taco for healing, or a bomb for regrettable decisions.",
      "Play solo against AI or share one keyboard for local two-player showdowns — it's a couch fighter that lives in a browser tab.",
    ],
    features: [
      "8 fighters with distinct movesets and stats",
      "5 stages with platforms, hazards and personality",
      "Items: stars, tacos, bombs and chaos",
      "Local 2-player on one keyboard, plus AI opponents",
      "Percent-based knockback — survive high, punish harder",
    ],
    howToPlay: [
      "Move and jump to control the platforms; attack to build damage percent.",
      "Higher percent means bigger knockback — finish foes near the edges.",
      "Grab items as they drop to swing the match.",
      "Last fighter standing on the stage wins.",
    ],
    keywords: ["platform fighter browser", "free smash style game", "2 player fighting game online", "local multiplayer browser game"],
  },
  {
    id: "froggo-adventure",
    seoTitle: "Froggo Adventure — Free Retro Platformer Game Online",
    metaDescription:
      "A 16-bit style swamp platformer: run, jump and roll as Froggo, smash Bugbots, beat bosses and stop Dr. Slither. Free to play in your browser.",
    tagline: "One small frog. One giant swamp. Zero fear.",
    about: [
      "Froggo Adventure is a free retro platformer with proper 16-bit soul. Run, jump, and roll through a hand-crafted swamp as Froggo, collecting golden droplets, bouncing off Bugbots, and building momentum toward a showdown with the serpentine Dr. Slither.",
      "The controls are tight and old-school: every jump matters, stomps need timing, and the boss fights ask you to learn patterns the way the classics did. It's beatable — but it makes you earn it.",
      "No downloads, no accounts: the whole adventure runs in the browser with keyboard controls and saves your progress as you go.",
    ],
    features: [
      "Classic 16-bit look and feel with modern-smooth controls",
      "Run, jump, roll and stomp through hand-built levels",
      "Pattern-based boss fights, including the Slithertron",
      "Golden droplets to collect and secrets to find",
      "Instant play in any browser",
    ],
    howToPlay: [
      "Arrow keys or WASD to move; jump to hop, jump again for extra height.",
      "Stomp enemies from above — some need more than one hit.",
      "Collect golden droplets for points and extra lives.",
      "Watch boss patterns and strike when the opening comes.",
    ],
    keywords: ["free platformer browser game", "retro platform game online", "16 bit style game free", "frog platformer game"],
  },
  {
    id: "tennis-world",
    seoTitle: "Tennis World — Free Tennis RPG Adventure Game Online",
    metaDescription:
      "A pixel-art tennis RPG: explore elemental zones, battle rival players, collect gear and become champion. Free to play in your browser, no download.",
    tagline: "Serve. Rally. Level up.",
    about: [
      "Tennis World is a free pixel-art tennis RPG that crosses arcade tennis rallies with adventure-game progression. Explore elemental zones, challenge the locals to matches, and climb from nobody to world champion.",
      "Every opponent plays differently, and the gear you collect changes your game — rackets, shoes and boosts that shape your power, speed and spin. Win matches to earn your way into tougher zones with stranger courts.",
      "It's easy to pick up (the rallies are pure arcade fun) and surprisingly deep to master, with a full progression arc that rewards exploring every corner of the map.",
    ],
    features: [
      "Arcade tennis rallies with RPG progression",
      "Elemental zones, each with its own courts and rivals",
      "Collectible gear that changes how you play",
      "A championship arc from rookie to legend",
      "Charming pixel-art world to explore",
    ],
    howToPlay: [
      "Move with the arrows or WASD; swing to return the ball.",
      "Position beats power — get to the ball early for stronger shots.",
      "Win matches to earn gear and unlock new zones.",
      "Explore between matches: the map hides upgrades.",
    ],
    keywords: ["tennis game free online", "tennis rpg game", "pixel art sports game", "free browser tennis game"],
  },
  {
    id: "bloot",
    seoTitle: "Bloot — Free Mountain Racing Game in Your Browser",
    metaDescription:
      "Fast-paced mountain racing: bomb down treacherous peaks, chain speed, and prove you're the fastest on the mountain. Free browser game, no download.",
    tagline: "The mountain doesn't slow down. Neither should you.",
    about: [
      "Bloot is a free arcade mountain racing game about pure speed. Bomb down treacherous peaks, thread hazards at full tilt, and shave seconds with clean lines — the mountain rewards nerve and punishes hesitation.",
      "The handling is tuned for flow: a smooth 60-frames-per-second run where every input matters and a perfect descent feels like music. Simple to start, brutal to master, built for one-more-run sessions.",
      "It runs instantly in the browser and posts your best to the ImagineX leaderboard — set a time your friends have to answer.",
    ],
    features: [
      "High-speed downhill racing tuned to 60fps",
      "Treacherous peaks where line choice is everything",
      "One-more-run arcade structure with leaderboard times",
      "Instant browser play, keyboard controls",
    ],
    howToPlay: [
      "Steer with the arrow keys or WASD.",
      "Hold your line through hazards — clean runs are fast runs.",
      "Learn each peak; the seconds hide in the corners.",
      "Chase the leaderboard when the mountain feels like home.",
    ],
    keywords: ["free racing browser game", "mountain racing game online", "downhill racing game free", "arcade racing no download"],
  },
  {
    id: "wilson",
    seoTitle: "Wilson's Spray World — Free Drawing & Graffiti Game Online",
    metaDescription:
      "Skate the streets as Wilson the zombie kid and spray real freehand graffiti on every wall. Draw, earn coins, unlock paints. Free creative browser game.",
    tagline: "Every wall is a canvas. Every tag is yours.",
    about: [
      "Wilson's Spray World is a free creative game about actually drawing. Wilson — a zombie skater kid with a spray can — rolls through the streets looking for walls, and every wall asks for something: a skull, a cat, his signature drip-smiley tag. Then you paint it, freehand, with your mouse or finger.",
      "There's no fail state and no art judge with a clipboard. Wilder fills earn more coins, coins unlock neon paints, fat caps, and fresh tag colors — but mostly it's the joy of leaving your mark on a whole city, one wall at a time.",
      "It's a lovely fit for kids, doodlers, and anyone who thinks in sketches — pure creative play that runs instantly in the browser.",
    ],
    features: [
      "Real freehand drawing on every wall — mouse or touch",
      "Wall prompts to riff on, from skulls to signature tags",
      "Coins for creative fills; unlock paints, caps and colors",
      "No failure, no timer — just style",
      "A skateable street world to roam",
    ],
    howToPlay: [
      "Skate to a wall and roll up close to start painting.",
      "Draw the prompt (or your own take) with mouse or finger.",
      "Earn coins for coverage and flair; spend them in the shop.",
      "Roll on — the next wall is already waiting.",
    ],
    keywords: ["drawing game free online", "graffiti game browser", "creative game for kids free", "free painting game no download"],
  },
];

export const gameSeoById = (id: string) => gameSeo.find((g) => g.id === id);
