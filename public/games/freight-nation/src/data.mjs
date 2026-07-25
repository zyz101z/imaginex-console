// FREIGHT NATION — data layer (California MVP per GDD §16; more states to come)
// Everything here is editable data: cities, road graph, trucks, cargo, events, stops.
// Fictional customer companies only — real city/highway names are fine (GDD §10).

// ---------------------------------------------------------------- cities & junctions
// zone: weather region (south / valley / coast / north) · safety: overnight parking 1-5
// fuel: $/gal diesel base · urban: has rush hour + city traffic
export const NODES = {
  SD:  { name: "San Diego",      lat: 32.72, lon: -117.16, zone: "south",  urban: true,  fuel: 5.15, safety: 3, tier: 2 },
  LKW: { name: "Lakewood",       lat: 33.85, lon: -118.13, zone: "south",  urban: true,  fuel: 5.05, safety: 4, tier: 1, yard: true },
  LGB: { name: "Long Beach",     lat: 33.77, lon: -118.19, zone: "south",  urban: true,  fuel: 4.95, safety: 2, tier: 2, port: true },
  LA:  { name: "Los Angeles",    lat: 34.05, lon: -118.24, zone: "south",  urban: true,  fuel: 5.25, safety: 2, tier: 3 },
  ANA: { name: "Anaheim",        lat: 33.84, lon: -117.91, zone: "south",  urban: true,  fuel: 5.05, safety: 3, tier: 2 },
  SNA: { name: "Santa Ana",      lat: 33.75, lon: -117.87, zone: "south",  urban: true,  fuel: 5.00, safety: 2, tier: 1 },
  RIV: { name: "Riverside",      lat: 33.95, lon: -117.40, zone: "south",  urban: true,  fuel: 4.85, safety: 3, tier: 1 },
  SBD: { name: "San Bernardino", lat: 34.11, lon: -117.29, zone: "south",  urban: true,  fuel: 4.75, safety: 2, tier: 1 },
  SB:  { name: "Santa Barbara",  lat: 34.42, lon: -119.70, zone: "coast",  urban: false, fuel: 5.45, safety: 4, tier: 1 },
  SLO: { name: "San Luis Obispo",lat: 35.28, lon: -120.66, zone: "coast",  urban: false, fuel: 5.35, safety: 4, tier: 1 },
  BAK: { name: "Bakersfield",    lat: 35.37, lon: -119.02, zone: "valley", urban: false, fuel: 4.65, safety: 3, tier: 1 },
  FRS: { name: "Fresno",         lat: 36.75, lon: -119.77, zone: "valley", urban: false, fuel: 4.55, safety: 3, tier: 2 },
  SAL: { name: "Salinas",        lat: 36.68, lon: -121.66, zone: "coast",  urban: false, fuel: 5.10, safety: 4, tier: 1 },
  SJ:  { name: "San Jose",       lat: 37.34, lon: -121.89, zone: "north",  urban: true,  fuel: 5.35, safety: 3, tier: 2 },
  OAK: { name: "Oakland",        lat: 37.80, lon: -122.27, zone: "north",  urban: true,  fuel: 5.20, safety: 1, tier: 2, port: true },
  STK: { name: "Stockton",       lat: 37.96, lon: -121.29, zone: "north",  urban: false, fuel: 4.70, safety: 2, tier: 1 },
  SAC: { name: "Sacramento",     lat: 38.58, lon: -121.49, zone: "north",  urban: true,  fuel: 4.80, safety: 3, tier: 2 },
  RED: { name: "Redding",        lat: 40.59, lon: -122.39, zone: "north",  urban: false, fuel: 4.85, safety: 4, tier: 1 },
  SF:  { name: "San Francisco",  lat: 37.77, lon: -122.42, zone: "north",  urban: true,  fuel: 5.55, safety: 2, tier: 3 },
};

// ---------------------------------------------------------------- road graph (edges)
// mi: distance · mph: posted speed · toll $ · q: road quality 1-5 (5 = glass smooth)
// urban: rush hour + stop-and-go apply · rail: at-grade crossings · mtn: grade/fuel penalty
// rural edges get wildlife at night and sparser fuel
// via: [lon,lat] waypoints for RENDERING the real road path (sim uses `mi`).
// Corridors that use two freeways are labeled honestly ("I-605/I-5" = 605 north, then the 5 in).
export const EDGES = [
  // --- LA basin / Orange County (the home turf web: 605, 710, 405, 22, 91, 57, 60, 10)
  { a: "LKW", b: "LGB", hwy: "I-405",  mi: 7,   mph: 55, toll: 0, q: 3, urban: true },
  { a: "LKW", b: "LA",  hwy: "I-605/I-5", mi: 22, mph: 60, toll: 0, q: 3, urban: true,
    via: [[-118.06, 33.96]] }, // 605 north to Santa Fe Springs, then the 5 into downtown
  { a: "LGB", b: "LA",  hwy: "I-710",  mi: 25,  mph: 55, toll: 0, q: 2, urban: true, rail: true },
  { a: "LKW", b: "ANA", hwy: "CA-91",  mi: 12,  mph: 60, toll: 0, q: 3, urban: true },
  { a: "LGB", b: "SNA", hwy: "CA-22",  mi: 13,  mph: 60, toll: 0, q: 3, urban: true },
  { a: "LA",  b: "ANA", hwy: "I-5",    mi: 26,  mph: 65, toll: 0, q: 3, urban: true },
  { a: "ANA", b: "SNA", hwy: "I-5",    mi: 8,   mph: 60, toll: 0, q: 3, urban: true },
  { a: "ANA", b: "RIV", hwy: "CA-91",  mi: 32,  mph: 65, toll: 0, q: 3, urban: true,
    via: [[-117.57, 33.88]] }, // through Corona
  { a: "ANA", b: "SBD", hwy: "CA-57/I-10", mi: 50, mph: 65, toll: 0, q: 3, urban: true,
    via: [[-117.79, 34.07]] }, // 57 north to Pomona, then I-10 east
  { a: "RIV", b: "LA",  hwy: "CA-60",  mi: 55,  mph: 65, toll: 0, q: 3, urban: true },
  { a: "RIV", b: "SBD", hwy: "I-215",  mi: 10,  mph: 65, toll: 0, q: 3, urban: true },
  { a: "LA",  b: "SBD", hwy: "I-10",   mi: 60,  mph: 65, toll: 0, q: 3, urban: true },
  // --- south
  { a: "SNA", b: "SD",  hwy: "I-5",    mi: 88,  mph: 70, toll: 0, q: 4,
    via: [[-117.60, 33.38], [-117.35, 33.19]] }, // hugging the coast through Oceanside
  { a: "SD",  b: "RIV", hwy: "I-15",   mi: 100, mph: 70, toll: 0, q: 4,
    via: [[-117.15, 33.50]] }, // inland through Temecula
  // --- coast (US-101 the long way)
  { a: "LA",  b: "SB",  hwy: "US-101", mi: 95,  mph: 65, toll: 0, q: 4,
    via: [[-119.18, 34.19]] }, // through Oxnard/Ventura
  { a: "SB",  b: "SLO", hwy: "US-101", mi: 105, mph: 65, toll: 0, q: 4,
    via: [[-120.44, 34.72]] }, // up through Santa Maria
  { a: "SLO", b: "SAL", hwy: "US-101", mi: 128, mph: 65, toll: 0, q: 4,
    via: [[-120.85, 35.63], [-121.13, 36.21]] }, // Paso Robles, King City
  { a: "SAL", b: "SJ",  hwy: "US-101", mi: 60,  mph: 65, toll: 0, q: 4 },
  { a: "SJ",  b: "SF",  hwy: "US-101", mi: 48,  mph: 65, toll: 0, q: 3, urban: true },
  // --- valley (I-5 fast & empty, CA-99 rough with trains)
  { a: "LA",  b: "BAK", hwy: "I-5 (Grapevine)", mi: 110, mph: 65, toll: 0, q: 3, mtn: true,
    via: [[-118.50, 34.40], [-118.88, 34.99]] }, // Santa Clarita, over the Grapevine
  { a: "BAK", b: "FRS", hwy: "CA-99",  mi: 110, mph: 65, toll: 0, q: 2, rail: true,
    via: [[-119.34, 36.06]] }, // Tulare/Visalia corridor
  { a: "FRS", b: "STK", hwy: "CA-99",  mi: 128, mph: 65, toll: 0, q: 2, rail: true,
    via: [[-120.48, 37.30]] }, // Merced/Modesto corridor
  { a: "BAK", b: "STK", hwy: "I-5",    mi: 230, mph: 70, toll: 0, q: 4, sparse: true,
    via: [[-120.10, 36.00], [-120.85, 36.98]] }, // lonely west side
  { a: "FRS", b: "SJ",  hwy: "CA-152/US-101", mi: 150, mph: 60, toll: 0, q: 3, mtn: true,
    via: [[-120.85, 37.06], [-121.45, 36.99]] }, // Los Banos, Pacheco Pass, Gilroy
  // --- bay area & north
  { a: "SJ",  b: "OAK", hwy: "I-880",  mi: 40,  mph: 62, toll: 0, q: 2, urban: true,
    via: [[-122.08, 37.60]] }, // east bay shoreline
  { a: "OAK", b: "SF",  hwy: "I-80 (Bay Bridge)", mi: 12, mph: 55, toll: 12, q: 3, urban: true },
  { a: "STK", b: "OAK", hwy: "I-205/I-580", mi: 70, mph: 65, toll: 0, q: 3,
    via: [[-121.60, 37.73], [-121.98, 37.70]] }, // Tracy, Altamont, Livermore
  { a: "OAK", b: "SAC", hwy: "I-80",   mi: 80,  mph: 65, toll: 0, q: 3,
    via: [[-122.20, 38.10], [-121.99, 38.25]] }, // Vallejo, Fairfield
  { a: "STK", b: "SAC", hwy: "I-5",    mi: 48,  mph: 70, toll: 0, q: 4 },
  { a: "SAC", b: "RED", hwy: "I-5",    mi: 160, mph: 70, toll: 0, q: 4, sparse: true,
    via: [[-122.10, 39.52]] }, // up the valley through Willows
];

export const edgeKey = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;

// ---------------------------------------------------------------- truck classes (PROGRESSION LADDER)
// The whole ladder: one rusty van → better vans → box truck → semis → specialty rigs → fleet.
// repReq gates the shop; cap in pallets; tank gal; mpg diesel; top mph.
export const TRUCK_TYPES = {
  rusty:   { name: "Rusty Box Van",    icon: "🚐", cap: 4,  tank: 30,  mpg: 10,  top: 55, cost: 0,     repReq: 0,
             blurb: "She starts... usually. Wears out fast.", wear: 1.3 },
  courier: { name: "Swift Courier",    icon: "🚐", cap: 6,  tank: 35,  mpg: 13,  top: 62, cost: 9000,  repReq: 5,
             blurb: "Nimble, efficient city runner.", wear: 1.0 },
  work:    { name: "Workhorse 16ft",   icon: "🚚", cap: 10, tank: 60,  mpg: 8.5, top: 62, cost: 20000, repReq: 15,
             blurb: "Regional box truck. Real payloads.", wear: 1.0 },
  semi:    { name: "Longhauler Semi",  icon: "🚛", cap: 22, tank: 140, mpg: 6.5, top: 65, cost: 48000, repReq: 30,
             blurb: "Cross-state freight. Big tank, big loads.", wear: 0.9 },
  reefer:  { name: "Frostline Reefer", icon: "🚛", cap: 18, tank: 140, mpg: 6.2, top: 65, cost: 62000, repReq: 40,
             blurb: "Refrigerated trailer — perishables stay fresh.", wear: 0.9, reefer: true },
  secure:  { name: "Guardian Rig",     icon: "🚛", cap: 16, tank: 130, mpg: 6.2, top: 65, cost: 75000, repReq: 55,
             blurb: "Hardened + air-ride: laughs at thieves and potholes.", wear: 0.8, secure: true, softride: true },
};

// per-truck upgrades (bought once each)
export const UPGRADES = {
  tires: { name: "Premium Tires",  cost: 1500, blurb: "-40% rough-road cargo damage & wear" },
  tank:  { name: "Aux Fuel Tank",  cost: 1800, blurb: "+40% fuel capacity" },
  aero:  { name: "Aero Kit",       cost: 2200, blurb: "+12% fuel economy" },
  alarm: { name: "Alarm + Locks",  cost: 1600, blurb: "-65% theft risk" },
};

// ---------------------------------------------------------------- cargo categories (GDD §10)
export const CARGO = {
  general:     { name: "General Retail",  icon: "📦", mult: 1.0,  repReq: 0 },
  grocery:     { name: "Grocery",         icon: "🛒", mult: 1.15, repReq: 0,  tightDeadline: true },
  furniture:   { name: "Furniture",       icon: "🛋️", mult: 1.2,  repReq: 5,  heavy: true },
  fragile:     { name: "Fragile Goods",   icon: "🏺", mult: 1.5,  repReq: 10, fragile: true },
  perishable:  { name: "Perishable Food", icon: "🥬", mult: 1.45, repReq: 25, perishable: true },
  electronics: { name: "Electronics",     icon: "📱", mult: 1.7,  repReq: 35, theft: true },
  medical:     { name: "Medical Supplies",icon: "⚕️", mult: 2.2,  repReq: 50, tightDeadline: true, medical: true },
};

// fictional shippers (GDD: no real brands)
export const SHIPPERS = ["Pallet Pals", "Golden Bear Freight", "SunCoast Traders", "ValleyFresh Co-op",
  "Bayline Imports", "Redwood Retail Group", "Cactus Flower Foods", "Sierra Peak Outfitters",
  "Harbor & Hearth", "Comet Electronics", "MissionCare Medical", "PoppyMart"];

export const DRIVER_NAMES = ["Dana Ortiz", "Sam Whitfield", "Rosa Delgado", "Chuck Petersen", "Maya Chen",
  "Big Al Kowalski", "Frankie Rivers", "June Nakamura", "Otis Bell", "Priya Raman",
  "Hank Morrow", "Lupe Fuentes", "Dee Callahan", "Marcus Webb", "Sky Tanaka"];

// ---------------------------------------------------------------- tunables (GDD §18: all balance configurable)
export const CFG = {
  START_CASH: 3000,
  START_HOUR: 8 * 60,           // day starts 8:00 AM
  RUSH_START: 16.5 * 60,        // 4:30 PM local (GDD §6 — all cities)
  RUSH_END: 19 * 60,            // 7:00 PM
  RUSH_SPEED: 0.45,             // urban edge speed multiplier during rush
  RUSH_RISK: 2.0,
  NIGHT_RISK: 1.6,              // 10 PM - 5 AM
  FATIGUE_PER_HR: 8,            // driving
  FATIGUE_TIRED: 60, FATIGUE_VERY: 80, FATIGUE_CRIT: 95,
  REST_MIN: 8 * 60,             // full sleep
  REST_COST_SAFE: 45,           // secure truck stop
  BASE_INCIDENT_PER_MI: 0.00012, // baseline accident chance per mile
  TOW_COST: 500, TOW_DELAY_MIN: 240,
  BREAKDOWN_COND: 40,           // below this condition, breakdowns start
  WAGE_BASE: 110,               // per game day, + skill * 35
  DEADLINE_SLACK: 1.55,         // deadline = fastest-ETA * slack + 2h
  CONTRACT_BOARD: 8,
  PAY_PER_MI: 1.6,
  PAY_BASE: 55,
  DEADHEAD_OVERHEAD_PER_MI: 0.45, // driver time + wear for miles driven empty to pickup
  PASSPORT_BONUS: 25,             // explorer payout per newly stamped freeway shield
  REGION: "California",           // the region currently in play — UI copy reads this
                                  // instead of hard-coding a state name (see README)
  LATE_GRACE_MIN: 20,
  REROUTE_DELAY_MIN: 4,         // GDD §7: small decision delay on reroute
  FUEL_STOP_MIN: 20, TOLL_BOOTH: 0,
  EVENT_CHECK_MIN: 30,          // spawn roll cadence
  WEATHER_SHIFT_MIN: 200,       // regional weather persistence
  SAVE_KEY: "route_dispatcher_adventure_save_v1",
  // rep gates for contract distance tiers
  REP_REGIONAL: 12, REP_LONGHAUL: 25,
  LOCAL_MI: 80, REGIONAL_MI: 260,
};

// weather types and their effects (speed multiplier, risk multiplier, chance weights per zone)
export const WEATHER = {
  clear: { name: "Clear",  icon: "",   speed: 1,    risk: 1 },
  rain:  { name: "Rain",   icon: "🌧️", speed: 0.85, risk: 1.6 },
  storm: { name: "Storm",  icon: "⛈️", speed: 0.68, risk: 2.6 },
  fog:   { name: "Fog",    icon: "🌫️", speed: 0.78, risk: 2.0 },
  heat:  { name: "Heatwave", icon: "🥵", speed: 0.95, risk: 1.2, breakdown: 2.0 },
};
// zone → weighted weather picks (GDD §15: events should fit region)
export const ZONE_WEATHER = {
  south:  [["clear", 62], ["rain", 12], ["storm", 4], ["fog", 8], ["heat", 14]],
  coast:  [["clear", 55], ["rain", 14], ["storm", 6], ["fog", 25]],
  valley: [["clear", 60], ["rain", 10], ["storm", 5], ["fog", 7], ["heat", 18]],
  north:  [["clear", 56], ["rain", 18], ["storm", 8], ["fog", 14], ["heat", 4]],
};

// dynamic road events (GDD §9)
export const EVENT_DEFS = {
  accident_minor: { name: "Minor Accident", icon: "💥", durMin: [25, 80],  speed: 0.55 },
  accident_major: { name: "Major Accident", icon: "🚨", durMin: [60, 180], closed: true },
  construction:   { name: "Construction",   icon: "🚧", durMin: [600, 2000], speed: 0.72, qPenalty: 1 },
  closure:        { name: "Road Closure",   icon: "⛔", durMin: [120, 360], closed: true },
  wildfire:       { name: "Wildfire",       icon: "🔥", durMin: [240, 600], closed: true, smoke: true },
};
