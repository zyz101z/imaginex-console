// FREIGHT NATION — data layer (the lower 48; California is the home region you start in).
// Everything here is editable data: regions, cities, road graph, trucks, cargo, events, stops.
// Fictional customer companies only — real city/highway names are fine (GDD §10).

// ---------------------------------------------------------------- regions (progression)
// You start in California and earn the rest of the country with reputation. Order is
// geographic: the map grows outward from home, so every unlock connects to what you know.
// repReq is the ONLY gate — see sim.unlockedRegions().
export const REGIONS = {
  west:      { name: "California",        short: "CA",  repReq: 0,
               blurb: "Home turf. Ports, produce and the busiest freeway web in the country." },
  // repReq is tuned against the contract-distance gates: the shortest road INTO the
  // Southwest is 195 mi (SBD→LV), which only generates freight once REGIONAL contracts
  // exist at rep 12 — unlocking it earlier read as "new territory!" with an empty board.
  southwest: { name: "The Southwest",     short: "SW",  repReq: 12,
               blurb: "Desert running — long empty miles, cheap fuel, brutal summer heat." },
  northwest: { name: "The Northwest",     short: "NW",  repReq: 18,
               blurb: "Rain, timber and mountain passes from Reno up to Seattle." },
  mountain:  { name: "The Rockies",       short: "MTN", repReq: 25,
               blurb: "Thin air and hard grades. Snow closes passes without asking." },
  texas:     { name: "Texas & the Gulf",  short: "TX",  repReq: 30,
               blurb: "Cheapest diesel in the nation and freight moving in every direction." },
  midwest:   { name: "The Midwest",       short: "MW",  repReq: 42,
               blurb: "The freight crossroads. Chicago never sleeps and neither will you." },
  southeast: { name: "The Southeast",     short: "SE",  repReq: 55,
               blurb: "Humid, storm-prone, and every lane runs to a Florida port." },
  northeast: { name: "The Northeast",     short: "NE",  repReq: 68,
               blurb: "Toll country. Short hops, big money, and drivers who don't yield." },
};
export const REGION_ORDER = ["west", "southwest", "northwest", "mountain", "texas",
  "midwest", "southeast", "northeast"];
export const HOME_REGION = "west";

// Every lower-48 state belongs to one region so the MAP can show the territory ladder —
// tinted when unlocked, grayed with a 🔒 when not. Corridor states without a game city are
// assigned to the region whose freight actually crosses them.
export const STATE_REGIONS = {
  west: ["California"],
  southwest: ["Nevada", "Arizona", "New Mexico"],
  northwest: ["Washington", "Oregon", "Idaho"],
  mountain: ["Montana", "Wyoming", "Colorado", "Utah"],
  texas: ["Texas", "Oklahoma", "Louisiana", "Arkansas"],
  midwest: ["North Dakota", "South Dakota", "Nebraska", "Kansas", "Minnesota", "Iowa",
    "Missouri", "Illinois", "Indiana", "Ohio", "Michigan", "Wisconsin"],
  southeast: ["Tennessee", "Kentucky", "Mississippi", "Alabama", "Georgia", "Florida",
    "North Carolina", "South Carolina"],
  northeast: ["Pennsylvania", "New York", "New Jersey", "Connecticut", "Rhode Island",
    "Massachusetts", "Vermont", "New Hampshire", "Maine", "Delaware", "Maryland",
    "District of Columbia", "West Virginia", "Virginia"],
};
// one tint per region (used on both maps; keep them pastel — they sit under the roads)
export const REGION_COLORS = {
  west: "#3f9b57", southwest: "#e08f2f", northwest: "#2e9e8f", mountain: "#8a63c9",
  texas: "#c95555", midwest: "#d4b12e", southeast: "#e0699a", northeast: "#3f7ac9",
};
// where each region's name sits on the map [lon, lat]
export const REGION_LABELS = {
  west: [-119.8, 37.6], southwest: [-110.8, 34.3], northwest: [-120.8, 44.6],
  mountain: [-108.5, 42.2], texas: [-98.5, 31.8], midwest: [-93.5, 42.6],
  southeast: [-84.3, 33.0], northeast: [-76.2, 42.4],
};

// ---------------------------------------------------------------- cities & junctions
// region: unlock group · zone: weather region · safety: overnight parking 1-5
// fuel: $/gal diesel base (state tax & haul distance make this a real strategy layer)
// tz: hours ahead of Pacific (0 PT · 1 MT · 2 CT · 3 ET) — rush hour and night are LOCAL
// urban: has rush hour + city traffic
export const NODES = {
  // ============================================================ CALIFORNIA (home)
  SD:  { name: "San Diego",      st: "CA", lat: 32.72, lon: -117.16, region: "west", zone: "south",  tz: 0, urban: true,  fuel: 5.15, safety: 3, tier: 2 },
  LKW: { name: "Lakewood",       st: "CA", lat: 33.85, lon: -118.13, region: "west", zone: "south",  tz: 0, urban: true,  fuel: 5.05, safety: 4, tier: 1, yard: true },
  LGB: { name: "Long Beach",     st: "CA", lat: 33.77, lon: -118.19, region: "west", zone: "south",  tz: 0, urban: true,  fuel: 4.95, safety: 2, tier: 2, port: true },
  LA:  { name: "Los Angeles",    st: "CA", lat: 34.05, lon: -118.24, region: "west", zone: "south",  tz: 0, urban: true,  fuel: 5.25, safety: 2, tier: 3 },
  ANA: { name: "Anaheim",        st: "CA", lat: 33.84, lon: -117.91, region: "west", zone: "south",  tz: 0, urban: true,  fuel: 5.05, safety: 3, tier: 2 },
  SNA: { name: "Santa Ana",      st: "CA", lat: 33.75, lon: -117.87, region: "west", zone: "south",  tz: 0, urban: true,  fuel: 5.00, safety: 2, tier: 1 },
  RIV: { name: "Riverside",      st: "CA", lat: 33.95, lon: -117.40, region: "west", zone: "south",  tz: 0, urban: true,  fuel: 4.85, safety: 3, tier: 1 },
  SBD: { name: "San Bernardino", st: "CA", lat: 34.11, lon: -117.29, region: "west", zone: "south",  tz: 0, urban: true,  fuel: 4.75, safety: 2, tier: 1 },
  SB:  { name: "Santa Barbara",  st: "CA", lat: 34.42, lon: -119.70, region: "west", zone: "coast",  tz: 0, urban: false, fuel: 5.45, safety: 4, tier: 1 },
  SLO: { name: "San Luis Obispo",st: "CA", lat: 35.28, lon: -120.66, region: "west", zone: "coast",  tz: 0, urban: false, fuel: 5.35, safety: 4, tier: 1 },
  BAK: { name: "Bakersfield",    st: "CA", lat: 35.37, lon: -119.02, region: "west", zone: "valley", tz: 0, urban: false, fuel: 4.65, safety: 3, tier: 1 },
  FRS: { name: "Fresno",         st: "CA", lat: 36.75, lon: -119.77, region: "west", zone: "valley", tz: 0, urban: false, fuel: 4.55, safety: 3, tier: 2 },
  SAL: { name: "Salinas",        st: "CA", lat: 36.68, lon: -121.66, region: "west", zone: "coast",  tz: 0, urban: false, fuel: 5.10, safety: 4, tier: 1 },
  SJ:  { name: "San Jose",       st: "CA", lat: 37.34, lon: -121.89, region: "west", zone: "north",  tz: 0, urban: true,  fuel: 5.35, safety: 3, tier: 2 },
  OAK: { name: "Oakland",        st: "CA", lat: 37.80, lon: -122.27, region: "west", zone: "north",  tz: 0, urban: true,  fuel: 5.20, safety: 1, tier: 2, port: true },
  STK: { name: "Stockton",       st: "CA", lat: 37.96, lon: -121.29, region: "west", zone: "north",  tz: 0, urban: false, fuel: 4.70, safety: 2, tier: 1 },
  SAC: { name: "Sacramento",     st: "CA", lat: 38.58, lon: -121.49, region: "west", zone: "north",  tz: 0, urban: true,  fuel: 4.80, safety: 3, tier: 2 },
  RED: { name: "Redding",        st: "CA", lat: 40.59, lon: -122.39, region: "west", zone: "north",  tz: 0, urban: false, fuel: 4.85, safety: 4, tier: 1 },
  SF:  { name: "San Francisco",  st: "CA", lat: 37.77, lon: -122.42, region: "west", zone: "north",  tz: 0, urban: true,  fuel: 5.55, safety: 2, tier: 3 },

  // ============================================================ SOUTHWEST
  LV:  { name: "Las Vegas",      st: "NV", lat: 36.17, lon: -115.14, region: "southwest", zone: "desert", tz: 0, urban: true,  fuel: 4.60, safety: 3, tier: 2 },
  PHX: { name: "Phoenix",        st: "AZ", lat: 33.45, lon: -112.07, region: "southwest", zone: "desert", tz: 1, urban: true,  fuel: 4.35, safety: 3, tier: 3 },
  TUS: { name: "Tucson",         st: "AZ", lat: 32.22, lon: -110.97, region: "southwest", zone: "desert", tz: 1, urban: true,  fuel: 4.30, safety: 3, tier: 1 },
  FLG: { name: "Flagstaff",      st: "AZ", lat: 35.20, lon: -111.65, region: "southwest", zone: "rockies",tz: 1, urban: false, fuel: 4.55, safety: 4, tier: 1 },
  ABQ: { name: "Albuquerque",    st: "NM", lat: 35.08, lon: -106.65, region: "southwest", zone: "desert", tz: 1, urban: true,  fuel: 4.20, safety: 3, tier: 2 },
  ELP: { name: "El Paso",        st: "TX", lat: 31.76, lon: -106.49, region: "southwest", zone: "desert", tz: 1, urban: true,  fuel: 3.95, safety: 2, tier: 2 },

  // ============================================================ NORTHWEST
  RNO: { name: "Reno",           st: "NV", lat: 39.53, lon: -119.81, region: "northwest", zone: "rockies", tz: 0, urban: false, fuel: 4.70, safety: 4, tier: 1 },
  MED: { name: "Medford",        st: "OR", lat: 42.33, lon: -122.87, region: "northwest", zone: "cascadia",tz: 0, urban: false, fuel: 4.65, safety: 4, tier: 1 },
  POR: { name: "Portland",       st: "OR", lat: 45.52, lon: -122.68, region: "northwest", zone: "cascadia",tz: 0, urban: true,  fuel: 4.70, safety: 3, tier: 2, port: true },
  SEA: { name: "Seattle",        st: "WA", lat: 47.61, lon: -122.33, region: "northwest", zone: "cascadia",tz: 0, urban: true,  fuel: 4.95, safety: 2, tier: 3, port: true },
  SPK: { name: "Spokane",        st: "WA", lat: 47.66, lon: -117.43, region: "northwest", zone: "cascadia",tz: 0, urban: false, fuel: 4.60, safety: 4, tier: 1 },
  BOI: { name: "Boise",          st: "ID", lat: 43.62, lon: -116.20, region: "northwest", zone: "rockies", tz: 1, urban: false, fuel: 4.40, safety: 4, tier: 1 },

  // ============================================================ THE ROCKIES
  SLC: { name: "Salt Lake City", st: "UT", lat: 40.76, lon: -111.89, region: "mountain", zone: "rockies", tz: 1, urban: true,  fuel: 4.35, safety: 4, tier: 2 },
  GJT: { name: "Grand Junction", st: "CO", lat: 39.06, lon: -108.55, region: "mountain", zone: "rockies", tz: 1, urban: false, fuel: 4.30, safety: 4, tier: 1 },
  DEN: { name: "Denver",         st: "CO", lat: 39.74, lon: -104.99, region: "mountain", zone: "rockies", tz: 1, urban: true,  fuel: 4.20, safety: 3, tier: 3 },
  CHY: { name: "Cheyenne",       st: "WY", lat: 41.14, lon: -104.82, region: "mountain", zone: "plains",  tz: 1, urban: false, fuel: 4.10, safety: 4, tier: 1 },
  BIL: { name: "Billings",       st: "MT", lat: 45.78, lon: -108.50, region: "mountain", zone: "rockies", tz: 1, urban: false, fuel: 4.15, safety: 4, tier: 1 },

  // ============================================================ TEXAS & THE GULF
  AMA: { name: "Amarillo",       st: "TX", lat: 35.22, lon: -101.83, region: "texas", zone: "plains", tz: 2, urban: false, fuel: 3.75, safety: 4, tier: 1 },
  OKC: { name: "Oklahoma City",  st: "OK", lat: 35.47, lon:  -97.52, region: "texas", zone: "plains", tz: 2, urban: true,  fuel: 3.60, safety: 3, tier: 2 },
  DAL: { name: "Dallas",         st: "TX", lat: 32.78, lon:  -96.80, region: "texas", zone: "gulf",   tz: 2, urban: true,  fuel: 3.70, safety: 3, tier: 3 },
  HOU: { name: "Houston",        st: "TX", lat: 29.76, lon:  -95.37, region: "texas", zone: "gulf",   tz: 2, urban: true,  fuel: 3.65, safety: 2, tier: 3, port: true },
  SAT: { name: "San Antonio",    st: "TX", lat: 29.42, lon:  -98.49, region: "texas", zone: "gulf",   tz: 2, urban: true,  fuel: 3.70, safety: 3, tier: 2 },
  NOL: { name: "New Orleans",    st: "LA", lat: 29.95, lon:  -90.07, region: "texas", zone: "gulf",   tz: 2, urban: true,  fuel: 3.85, safety: 2, tier: 2, port: true },

  // ============================================================ THE MIDWEST
  KC:  { name: "Kansas City",    st: "MO", lat: 39.10, lon:  -94.58, region: "midwest", zone: "plains",     tz: 2, urban: true,  fuel: 3.75, safety: 3, tier: 2 },
  OMA: { name: "Omaha",          st: "NE", lat: 41.26, lon:  -95.93, region: "midwest", zone: "plains",     tz: 2, urban: false, fuel: 3.80, safety: 4, tier: 1 },
  MSP: { name: "Minneapolis",    st: "MN", lat: 44.98, lon:  -93.27, region: "midwest", zone: "greatlakes", tz: 2, urban: true,  fuel: 3.95, safety: 3, tier: 2 },
  CHI: { name: "Chicago",        st: "IL", lat: 41.88, lon:  -87.63, region: "midwest", zone: "greatlakes", tz: 2, urban: true,  fuel: 4.55, safety: 2, tier: 3 },
  BIS: { name: "Bismarck",       st: "ND", lat: 46.81, lon: -100.78, region: "midwest", zone: "plains",     tz: 2, urban: false, fuel: 3.85, safety: 4, tier: 1 },
  STL: { name: "St. Louis",      st: "MO", lat: 38.63, lon:  -90.20, region: "midwest", zone: "midwest",    tz: 2, urban: true,  fuel: 3.75, safety: 2, tier: 2 },
  IND: { name: "Indianapolis",   st: "IN", lat: 39.77, lon:  -86.16, region: "midwest", zone: "midwest",    tz: 3, urban: true,  fuel: 3.90, safety: 3, tier: 2 },
  CMH: { name: "Columbus",       st: "OH", lat: 39.96, lon:  -83.00, region: "midwest", zone: "midwest",    tz: 3, urban: true,  fuel: 3.90, safety: 3, tier: 2 },
  DET: { name: "Detroit",        st: "MI", lat: 42.33, lon:  -83.05, region: "midwest", zone: "greatlakes", tz: 3, urban: true,  fuel: 4.00, safety: 2, tier: 2 },

  // ============================================================ THE SOUTHEAST
  MEM: { name: "Memphis",        st: "TN", lat: 35.15, lon:  -90.05, region: "southeast", zone: "dixie",   tz: 2, urban: true,  fuel: 3.70, safety: 2, tier: 3 },
  NSH: { name: "Nashville",      st: "TN", lat: 36.16, lon:  -86.78, region: "southeast", zone: "dixie",   tz: 2, urban: true,  fuel: 3.70, safety: 3, tier: 2 },
  ATL: { name: "Atlanta",        st: "GA", lat: 33.75, lon:  -84.39, region: "southeast", zone: "dixie",   tz: 3, urban: true,  fuel: 3.70, safety: 2, tier: 3 },
  CLT: { name: "Charlotte",      st: "NC", lat: 35.23, lon:  -80.84, region: "southeast", zone: "dixie",   tz: 3, urban: true,  fuel: 3.90, safety: 3, tier: 2 },
  JAX: { name: "Jacksonville",   st: "FL", lat: 30.33, lon:  -81.66, region: "southeast", zone: "florida", tz: 3, urban: true,  fuel: 3.90, safety: 3, tier: 2, port: true },
  ORL: { name: "Orlando",        st: "FL", lat: 28.54, lon:  -81.38, region: "southeast", zone: "florida", tz: 3, urban: true,  fuel: 3.95, safety: 3, tier: 2 },
  MIA: { name: "Miami",          st: "FL", lat: 25.77, lon:  -80.19, region: "southeast", zone: "florida", tz: 3, urban: true,  fuel: 4.05, safety: 2, tier: 3, port: true },

  // ============================================================ THE NORTHEAST
  PIT: { name: "Pittsburgh",     st: "PA", lat: 40.44, lon:  -79.99, region: "northeast", zone: "atlantic",   tz: 3, urban: true,  fuel: 4.40, safety: 3, tier: 2 },
  CLE: { name: "Cleveland",      st: "OH", lat: 41.50, lon:  -81.69, region: "northeast", zone: "greatlakes", tz: 3, urban: true,  fuel: 3.95, safety: 2, tier: 2 },
  BUF: { name: "Buffalo",        st: "NY", lat: 42.89, lon:  -78.88, region: "northeast", zone: "greatlakes", tz: 3, urban: false, fuel: 4.45, safety: 3, tier: 1 },
  PHL: { name: "Philadelphia",   st: "PA", lat: 39.95, lon:  -75.17, region: "northeast", zone: "atlantic",   tz: 3, urban: true,  fuel: 4.45, safety: 2, tier: 3, port: true },
  NYC: { name: "New York",       st: "NY", lat: 40.71, lon:  -74.01, region: "northeast", zone: "atlantic",   tz: 3, urban: true,  fuel: 4.65, safety: 1, tier: 3, port: true },
  BOS: { name: "Boston",         st: "MA", lat: 42.36, lon:  -71.06, region: "northeast", zone: "atlantic",   tz: 3, urban: true,  fuel: 4.55, safety: 2, tier: 3, port: true },
  WDC: { name: "Washington",     st: "DC", lat: 38.91, lon:  -77.04, region: "northeast", zone: "atlantic",   tz: 3, urban: true,  fuel: 4.15, safety: 2, tier: 3 },
  RIC: { name: "Richmond",       st: "VA", lat: 37.54, lon:  -77.44, region: "northeast", zone: "atlantic",   tz: 3, urban: false, fuel: 3.90, safety: 3, tier: 1 },
};

// ---------------------------------------------------------------- road graph (edges)
// mi: distance · mph: posted speed · toll $ · q: road quality 1-5 (5 = glass smooth)
// urban: rush hour + stop-and-go apply · rail: at-grade crossings · mtn: grade/fuel penalty
// sparse: long gaps between services — running dry out here really hurts
// via: [lon,lat] waypoints for RENDERING the real road path (sim uses `mi`).
// Corridors that use two freeways are labeled honestly ("I-605/I-5" = 605 north, then the 5 in).
export const EDGES = [
  // ================================================================ CALIFORNIA
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

  // ================================================================ CA → SOUTHWEST
  { a: "SBD", b: "LV",  hwy: "I-15",   mi: 195, mph: 70, toll: 0, q: 4, sparse: true, mtn: true,
    via: [[-116.85, 34.45], [-115.90, 35.30]] }, // Cajon Pass, Barstow, Baker
  { a: "SBD", b: "PHX", hwy: "I-10",   mi: 330, mph: 70, toll: 0, q: 4, sparse: true,
    via: [[-116.20, 33.72], [-114.60, 33.61]] }, // Coachella, Blythe, Quartzsite
  { a: "SD",  b: "PHX", hwy: "I-8",    mi: 355, mph: 70, toll: 0, q: 4, sparse: true,
    via: [[-115.55, 32.79], [-114.62, 32.69]] }, // El Centro, Yuma, up AZ-85
  { a: "LV",  b: "FLG", hwy: "US-93/I-40", mi: 250, mph: 65, toll: 0, q: 3, sparse: true, mtn: true,
    via: [[-114.57, 35.15], [-113.30, 35.22]] }, // Hoover Dam bypass, Kingman, Seligman
  { a: "PHX", b: "FLG", hwy: "I-17",   mi: 145, mph: 65, toll: 0, q: 3, mtn: true,
    via: [[-112.13, 34.55]] }, // up the Verde Valley grade
  { a: "PHX", b: "TUS", hwy: "I-10",   mi: 115, mph: 70, toll: 0, q: 4 },
  { a: "TUS", b: "ELP", hwy: "I-10",   mi: 320, mph: 70, toll: 0, q: 4, sparse: true,
    via: [[-109.55, 32.20], [-108.70, 32.35]] }, // Willcox, Lordsburg, Deming
  { a: "FLG", b: "ABQ", hwy: "I-40",   mi: 325, mph: 70, toll: 0, q: 4, sparse: true, rail: true,
    via: [[-109.05, 35.02], [-108.74, 35.53]] }, // Holbrook, Gallup
  { a: "ELP", b: "ABQ", hwy: "I-25",   mi: 265, mph: 70, toll: 0, q: 4, sparse: true,
    via: [[-106.78, 32.31], [-106.89, 34.06]] }, // Las Cruces, Socorro
  { a: "LV",  b: "SLC", hwy: "I-15",   mi: 420, mph: 70, toll: 0, q: 4, sparse: true, mtn: true,
    via: [[-113.58, 37.10], [-112.35, 38.73]] }, // St. George, Beaver, Nephi

  // ================================================================ CA → NORTHWEST
  { a: "SAC", b: "RNO", hwy: "I-80",   mi: 132, mph: 65, toll: 0, q: 4, mtn: true,
    via: [[-120.83, 39.19], [-120.24, 39.32]] }, // Auburn, Donner Pass
  { a: "RED", b: "MED", hwy: "I-5",    mi: 195, mph: 65, toll: 0, q: 4, sparse: true, mtn: true,
    via: [[-122.31, 41.31], [-122.60, 41.93]] }, // Mount Shasta, Siskiyou Summit
  { a: "MED", b: "POR", hwy: "I-5",    mi: 275, mph: 65, toll: 0, q: 4, mtn: true,
    via: [[-123.09, 44.05], [-123.03, 44.94]] }, // Eugene, Salem
  { a: "POR", b: "SEA", hwy: "I-5",    mi: 175, mph: 65, toll: 0, q: 3, urban: true,
    via: [[-122.90, 46.14], [-122.44, 47.24]] }, // Kelso, Olympia, Tacoma
  { a: "SEA", b: "SPK", hwy: "I-90",   mi: 280, mph: 70, toll: 0, q: 4, mtn: true,
    via: [[-121.40, 47.42], [-119.28, 47.13]] }, // Snoqualmie Pass, Moses Lake
  { a: "POR", b: "BOI", hwy: "I-84",   mi: 430, mph: 70, toll: 0, q: 4, sparse: true, mtn: true,
    via: [[-121.18, 45.61], [-118.35, 45.67]] }, // Columbia Gorge, Pendleton, Baker City
  { a: "SPK", b: "BOI", hwy: "US-95",  mi: 425, mph: 60, toll: 0, q: 3, sparse: true, mtn: true,
    via: [[-117.00, 46.42], [-116.79, 45.33]] }, // Lewiston, White Bird grade
  { a: "RNO", b: "BOI", hwy: "US-95",  mi: 425, mph: 60, toll: 0, q: 3, sparse: true,
    via: [[-117.73, 40.97], [-117.02, 42.98]] }, // Winnemucca, Jordan Valley
  { a: "RNO", b: "SLC", hwy: "I-80",   mi: 520, mph: 75, toll: 0, q: 4, sparse: true,
    via: [[-116.93, 40.79], [-114.03, 40.74]] }, // Battle Mountain, Wendover, the salt flats
  { a: "BOI", b: "SLC", hwy: "I-84/I-15", mi: 340, mph: 70, toll: 0, q: 4, sparse: true,
    via: [[-114.46, 42.56], [-112.45, 41.72]] }, // Twin Falls, Tremonton

  // ================================================================ THE ROCKIES
  { a: "SLC", b: "GJT", hwy: "US-6/I-70", mi: 285, mph: 60, toll: 0, q: 3, sparse: true, mtn: true,
    via: [[-110.81, 39.60], [-109.55, 38.99]] }, // Price, Soldier Summit, Green River
  { a: "GJT", b: "DEN", hwy: "I-70",   mi: 245, mph: 65, toll: 0, q: 4, mtn: true,
    via: [[-107.32, 39.55], [-106.10, 39.63]] }, // Glenwood Canyon, Vail Pass, Eisenhower Tunnel
  { a: "SLC", b: "CHY", hwy: "I-80",   mi: 435, mph: 75, toll: 0, q: 4, sparse: true, mtn: true,
    via: [[-109.23, 41.59], [-106.31, 41.31]] }, // Rock Springs, Rawlins, Elk Mountain
  { a: "CHY", b: "DEN", hwy: "I-25",   mi: 100, mph: 70, toll: 0, q: 4 },
  { a: "CHY", b: "BIL", hwy: "I-25/I-90", mi: 455, mph: 70, toll: 0, q: 4, sparse: true,
    via: [[-106.31, 42.85], [-106.96, 44.80]] }, // Casper, Buffalo WY, Sheridan
  { a: "BIL", b: "SPK", hwy: "I-90",   mi: 500, mph: 70, toll: 0, q: 4, sparse: true, mtn: true,
    via: [[-111.03, 45.68], [-113.99, 46.87]] }, // Bozeman Pass, Butte, Missoula, Lookout Pass
  { a: "DEN", b: "ABQ", hwy: "I-25",   mi: 445, mph: 70, toll: 0, q: 4, sparse: true, mtn: true,
    via: [[-104.82, 38.83], [-104.44, 36.90]] }, // Colorado Springs, Raton Pass
  { a: "DEN", b: "AMA", hwy: "I-25/US-87", mi: 425, mph: 65, toll: 0, q: 3, sparse: true,
    via: [[-104.51, 37.17], [-103.20, 36.06]] }, // Trinidad, Raton, Dalhart
  { a: "CHY", b: "OMA", hwy: "I-80",   mi: 495, mph: 75, toll: 0, q: 4, sparse: true,
    via: [[-100.77, 41.12], [-98.39, 40.92]] }, // North Platte, Kearney, Grand Island
  { a: "DEN", b: "KC",  hwy: "I-70",   mi: 600, mph: 75, toll: 0, q: 4, sparse: true,
    via: [[-102.62, 39.30], [-97.61, 38.84]] }, // Burlington, Colby, Salina

  // ================================================================ TEXAS & THE GULF
  { a: "ABQ", b: "AMA", hwy: "I-40",   mi: 290, mph: 75, toll: 0, q: 4, sparse: true, rail: true,
    via: [[-104.52, 35.17], [-103.20, 35.18]] }, // Santa Rosa, Tucumcari
  { a: "AMA", b: "OKC", hwy: "I-40",   mi: 260, mph: 75, toll: 0, q: 4, sparse: true, rail: true,
    via: [[-100.52, 35.23], [-98.97, 35.51]] }, // Shamrock, Elk City, Weatherford
  { a: "AMA", b: "DAL", hwy: "US-287", mi: 360, mph: 70, toll: 0, q: 3, sparse: true, rail: true,
    via: [[-100.41, 34.44], [-98.49, 33.91]] }, // Childress, Vernon, Wichita Falls
  { a: "OKC", b: "DAL", hwy: "I-35",   mi: 205, mph: 70, toll: 0, q: 4,
    via: [[-97.14, 34.17]] }, // Ardmore
  { a: "OKC", b: "KC",  hwy: "I-35",   mi: 350, mph: 70, toll: 8, q: 4,
    via: [[-97.34, 37.69], [-96.68, 38.36]] }, // Wichita, Emporia (Kansas Turnpike)
  { a: "DAL", b: "HOU", hwy: "I-45",   mi: 240, mph: 70, toll: 0, q: 4,
    via: [[-96.09, 31.63]] }, // Madisonville
  { a: "DAL", b: "SAT", hwy: "I-35",   mi: 275, mph: 70, toll: 0, q: 3, urban: true,
    via: [[-97.13, 31.55], [-97.74, 30.27]] }, // Waco, Austin
  { a: "SAT", b: "HOU", hwy: "I-10",   mi: 200, mph: 75, toll: 0, q: 4,
    via: [[-96.98, 29.71]] }, // Columbus TX
  { a: "SAT", b: "ELP", hwy: "I-10",   mi: 550, mph: 80, toll: 0, q: 4, sparse: true,
    via: [[-100.60, 30.31], [-102.88, 30.89]] }, // Sonora, Fort Stockton, Van Horn
  { a: "HOU", b: "NOL", hwy: "I-10",   mi: 350, mph: 70, toll: 0, q: 3,
    via: [[-94.10, 30.08], [-92.02, 30.22]] }, // Beaumont, Lake Charles, Lafayette
  { a: "DAL", b: "MEM", hwy: "I-30/I-40", mi: 450, mph: 70, toll: 0, q: 3, rail: true,
    via: [[-94.05, 33.44], [-92.29, 34.75]] }, // Texarkana, Little Rock
  { a: "NOL", b: "ATL", hwy: "I-59/I-20", mi: 470, mph: 70, toll: 0, q: 3,
    via: [[-89.10, 30.42], [-86.80, 33.52]] }, // Slidell, Meridian, Birmingham

  // ================================================================ THE MIDWEST
  { a: "KC",  b: "OMA", hwy: "I-29",   mi: 185, mph: 70, toll: 0, q: 4,
    via: [[-95.68, 40.09]] }, // St. Joseph
  { a: "KC",  b: "STL", hwy: "I-70",   mi: 250, mph: 70, toll: 0, q: 4,
    via: [[-92.33, 38.95]] }, // Columbia MO
  { a: "OMA", b: "MSP", hwy: "I-29/I-90", mi: 380, mph: 70, toll: 0, q: 4, sparse: true,
    via: [[-96.40, 42.50], [-96.73, 43.55]] }, // Sioux City, Sioux Falls, Albert Lea
  { a: "MSP", b: "CHI", hwy: "I-94",   mi: 410, mph: 70, toll: 0, q: 3,
    via: [[-91.50, 44.80], [-89.63, 43.07]] }, // Eau Claire, Madison
  // the northern spine, split at Bismarck — no single leg may outrun a full fuel tank
  { a: "MSP", b: "BIS", hwy: "I-94",   mi: 425, mph: 75, toll: 0, q: 4, sparse: true,
    via: [[-95.05, 45.87], [-96.79, 46.88]] }, // Alexandria, Fargo, Jamestown
  { a: "BIS", b: "BIL", hwy: "I-94",   mi: 410, mph: 75, toll: 0, q: 4, sparse: true,
    via: [[-103.62, 46.90], [-105.84, 46.41]] }, // Dickinson, Glendive, Miles City
  { a: "CHI", b: "STL", hwy: "I-55",   mi: 300, mph: 70, toll: 0, q: 3, rail: true,
    via: [[-88.99, 40.48], [-89.65, 39.80]] }, // Bloomington, Springfield IL
  { a: "CHI", b: "IND", hwy: "I-65",   mi: 185, mph: 65, toll: 0, q: 3, urban: true, rail: true,
    via: [[-87.35, 41.58]] }, // Gary, Lafayette
  { a: "CHI", b: "DET", hwy: "I-94",   mi: 285, mph: 70, toll: 0, q: 3, urban: true,
    via: [[-86.25, 41.68], [-84.40, 42.25]] }, // South Bend, Kalamazoo, Jackson MI
  { a: "IND", b: "DET", hwy: "I-69",   mi: 290, mph: 70, toll: 0, q: 4,
    via: [[-85.14, 41.08], [-84.55, 42.73]] }, // Fort Wayne, Lansing
  { a: "IND", b: "CMH", hwy: "I-70",   mi: 175, mph: 70, toll: 0, q: 4,
    via: [[-84.83, 39.79]] }, // Richmond IN, Dayton
  { a: "IND", b: "NSH", hwy: "I-65",   mi: 290, mph: 70, toll: 0, q: 4,
    via: [[-85.76, 38.25], [-86.44, 37.09]] }, // Louisville, Bowling Green
  { a: "STL", b: "MEM", hwy: "I-55",   mi: 285, mph: 70, toll: 0, q: 3, rail: true,
    via: [[-89.53, 37.30], [-89.70, 36.10]] }, // Cape Girardeau, Sikeston
  { a: "STL", b: "NSH", hwy: "I-24/I-57", mi: 310, mph: 70, toll: 0, q: 3,
    via: [[-88.55, 37.30], [-87.49, 36.53]] }, // Marion IL, Paducah, Clarksville
  { a: "CMH", b: "CLE", hwy: "I-71",   mi: 145, mph: 70, toll: 0, q: 4,
    via: [[-82.31, 40.79]] }, // Mansfield
  { a: "DET", b: "CLE", hwy: "I-75/I-80", mi: 170, mph: 70, toll: 6, q: 3,
    via: [[-83.55, 41.65]] }, // Toledo, Ohio Turnpike east

  // ================================================================ THE SOUTHEAST
  { a: "MEM", b: "NSH", hwy: "I-40",   mi: 210, mph: 70, toll: 0, q: 4,
    via: [[-88.83, 35.61]] }, // Jackson TN
  { a: "MEM", b: "NOL", hwy: "I-55",   mi: 395, mph: 70, toll: 0, q: 3,
    via: [[-90.18, 32.30], [-90.45, 30.50]] }, // Jackson MS, Hammond
  { a: "NSH", b: "ATL", hwy: "I-24/I-75", mi: 250, mph: 70, toll: 0, q: 4, mtn: true,
    via: [[-85.31, 35.05], [-84.87, 34.51]] }, // Monteagle grade, Chattanooga, Dalton
  { a: "ATL", b: "CLT", hwy: "I-85",   mi: 245, mph: 70, toll: 0, q: 4,
    via: [[-83.38, 34.30], [-82.39, 34.85]] }, // Gainesville, Greenville SC
  { a: "ATL", b: "JAX", hwy: "I-75/I-10", mi: 345, mph: 70, toll: 0, q: 4,
    via: [[-83.63, 32.84], [-83.28, 30.83]] }, // Macon, Valdosta, Lake City
  { a: "JAX", b: "ORL", hwy: "I-95/I-4", mi: 140, mph: 70, toll: 0, q: 4,
    via: [[-81.05, 29.21]] }, // Daytona Beach, then the 4 inland
  { a: "JAX", b: "MIA", hwy: "I-95",   mi: 345, mph: 70, toll: 0, q: 4,
    via: [[-80.61, 28.08], [-80.06, 26.71]] }, // Melbourne, Fort Pierce, West Palm
  { a: "ORL", b: "MIA", hwy: "FL-91 (Turnpike)", mi: 235, mph: 70, toll: 28, q: 5,
    via: [[-80.86, 27.44], [-80.40, 26.32]] }, // Yeehaw Junction, the Turnpike run south
  { a: "CLT", b: "RIC", hwy: "I-85/I-95", mi: 290, mph: 70, toll: 0, q: 4,
    via: [[-78.90, 36.00], [-77.98, 36.42]] }, // Durham, Petersburg

  // ================================================================ THE NORTHEAST
  { a: "CMH", b: "PIT", hwy: "I-70/I-76", mi: 185, mph: 65, toll: 12, q: 3, mtn: true,
    via: [[-81.52, 40.10], [-80.19, 40.06]] }, // Zanesville, Wheeling, PA Turnpike
  { a: "CLE", b: "PIT", hwy: "I-76",   mi: 135, mph: 65, toll: 6, q: 3,
    via: [[-81.34, 41.08]] }, // Akron
  { a: "CLE", b: "BUF", hwy: "I-90",   mi: 190, mph: 65, toll: 10, q: 3,
    via: [[-80.15, 42.13]] }, // Erie PA
  { a: "BUF", b: "NYC", hwy: "I-90/I-87", mi: 375, mph: 65, toll: 22, q: 4, mtn: true,
    via: [[-76.15, 43.05], [-73.76, 42.65]] }, // Syracuse, Albany, down the Thruway
  { a: "PIT", b: "PHL", hwy: "I-76 (PA Turnpike)", mi: 305, mph: 65, toll: 30, q: 3, mtn: true,
    via: [[-78.92, 40.28], [-76.88, 40.27]] }, // Allegheny tunnels, Harrisburg
  { a: "PIT", b: "WDC", hwy: "I-70/I-68", mi: 240, mph: 60, toll: 6, q: 3, mtn: true,
    via: [[-79.40, 39.65], [-77.72, 39.64]] }, // Cumberland, Hagerstown
  { a: "PHL", b: "NYC", hwy: "I-95",   mi: 95,  mph: 60, toll: 16, q: 3, urban: true, rail: true,
    via: [[-74.76, 40.22]] }, // Trenton
  { a: "PHL", b: "WDC", hwy: "I-95",   mi: 140, mph: 60, toll: 12, q: 3, urban: true,
    via: [[-75.55, 39.74], [-76.61, 39.29]] }, // Wilmington, Baltimore
  { a: "NYC", b: "BOS", hwy: "I-95",   mi: 215, mph: 60, toll: 12, q: 3, urban: true,
    via: [[-72.93, 41.31], [-71.41, 41.82]] }, // New Haven, Providence
  { a: "WDC", b: "RIC", hwy: "I-95",   mi: 110, mph: 65, toll: 0, q: 3, urban: true,
    via: [[-77.46, 38.30]] }, // Fredericksburg
];

export const edgeKey = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;

// ---------------------------------------------------------------- highway shields / passport
// Parse the honest multi-freeway labels ("I-605/I-5", "I-70/I-76", "FL-91 (Turnpike)").
export function parseHighways(hwy) {
  const out = [];
  for (const m of String(hwy).matchAll(/\b([A-Z]{1,2})-(\d+)\b/g)) {
    const ref = `${m[1].toUpperCase()}-${m[2]}`;
    if (!out.includes(ref)) out.push(ref);
  }
  return out;
}
// The Freeway Passport is DERIVED from the graph, so it can never drift out of sync with
// the map and is always 100% completable — every shield sits on a road you can actually drive.
const shieldRank = ref => (ref.startsWith("I-") ? 0 : ref.startsWith("US-") ? 1 : 2);
export const PASSPORT_ROADS = (() => {
  const set = new Set();
  for (const e of EDGES) for (const r of parseHighways(e.hwy)) set.add(r);
  return [...set].sort((a, b) => {
    const ra = shieldRank(a), rb = shieldRank(b);
    if (ra !== rb) return ra - rb;
    const pa = a.split("-")[0], pb = b.split("-")[0];
    if (pa !== pb) return pa < pb ? -1 : 1;
    return +a.split("-")[1] - +b.split("-")[1];
  });
})();
// which region(s) each shield can be earned in — drives the grouped passport UI
export const SHIELD_REGIONS = (() => {
  const m = {};
  for (const e of EDGES) {
    for (const r of parseHighways(e.hwy)) {
      (m[r] = m[r] || new Set()).add(NODES[e.a].region).add(NODES[e.b].region);
    }
  }
  return Object.fromEntries(Object.entries(m).map(([k, v]) =>
    [k, REGION_ORDER.filter(rg => v.has(rg))]));
})();

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
             blurb: "Cross-country freight. Big tank, big loads.", wear: 0.9, sleeper: true },
  reefer:  { name: "Frostline Reefer", icon: "🚛", cap: 18, tank: 140, mpg: 6.2, top: 65, cost: 62000, repReq: 40,
             blurb: "Refrigerated trailer — perishables stay fresh.", wear: 0.9, reefer: true, sleeper: true },
  secure:  { name: "Guardian Rig",     icon: "🚛", cap: 16, tank: 130, mpg: 6.2, top: 65, cost: 75000, repReq: 55,
             blurb: "Hardened + air-ride: laughs at thieves and potholes.", wear: 0.8, secure: true, softride: true, sleeper: true },
};

// per-truck upgrades (bought once each)
export const UPGRADES = {
  tires: { name: "Premium Tires",  cost: 1500, blurb: "-40% rough-road cargo damage & wear" },
  tank:  { name: "Aux Fuel Tank",  cost: 1800, blurb: "+40% fuel capacity" },
  aero:  { name: "Aero Kit",       cost: 2200, blurb: "+12% fuel economy" },
  alarm: { name: "Alarm + Locks",  cost: 1600, blurb: "-65% theft risk" },
  chains:{ name: "Snow Chains",    cost: 1200, blurb: "Halves snow & ice speed loss on mountain roads" },
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

// ---------------------------------------------------------------- special deliveries
// Rare jackpot loads. Physics still comes from a normal cargoType underneath — a dinosaur
// skeleton IS fragile, a shark tank IS perishable — the special just changes the story,
// the pay and the celebration. Keep these silly; they exist to make a kid yell "DAD LOOK".
export const SPECIAL_LOADS = [
  { name: "Museum Dinosaur Bones",     icon: "🦖", base: "fragile",    blurb: "A full T-rex skeleton. 66 million years old — don't add any cracks." },
  { name: "Carnival Ferris Wheel",     icon: "🎡", base: "furniture",  blurb: "The whole fair is stuck until this wheel shows up." },
  { name: "20,000 Rubber Ducks",       icon: "🦆", base: "general",    blurb: "The world's biggest duck race can't start without them." },
  { name: "Giant Birthday Cake",       icon: "🎂", base: "perishable", blurb: "Twelve layers tall. The party starts at the deadline — literally." },
  { name: "Aquarium Shark",            icon: "🦈", base: "perishable", blurb: "One very grumpy passenger in a very big tank of water." },
  { name: "Rocket Engine Parts",       icon: "🚀", base: "fragile",    blurb: "The launch window won't wait. No pressure." },
  { name: "Movie Monster Props",       icon: "👾", base: "furniture",  blurb: "A 30-foot alien for the biggest movie of the summer." },
  { name: "Championship Trophy",       icon: "🏆", base: "fragile",    blurb: "The final is this weekend and the cup is in YOUR truck." },
  { name: "Zoo Penguin Transfer",      icon: "🐧", base: "perishable", blurb: "Keep it cold and keep it quick — they have opinions." },
  { name: "Arcade Machines",           icon: "🕹️", base: "electronics",blurb: "A whole arcade's worth of cabinets. High scores included." },
  { name: "Giant Pumpkin",             icon: "🎃", base: "fragile",    blurb: "2,100 pounds of state-fair champion. One pothole from pie." },
  { name: "Robot Convention Exhibits", icon: "🤖", base: "electronics",blurb: "Forty robots, none of which agreed to be turned off." },
  { name: "Ice Sculpture Collection",  icon: "🧊", base: "perishable", blurb: "A frozen swan armada for a fancy wedding. Drive like it's July." },
  { name: "Hot Air Balloon Fleet",     icon: "🎈", base: "furniture",  blurb: "The festival needs all nine balloons, baskets and all." },
];

// ---------------------------------------------------------------- paint shop
// Trucks are characters here (the first one is literally named Rusty) — let players make
// them THEIRS. Color rides on the truck object and shows on both maps.
export const PAINT_COLORS = [
  { id: "blue",    name: "Dispatch Blue",   hex: "#2b6fb8" },
  { id: "red",     name: "Fire Red",        hex: "#d23c2e" },
  { id: "green",   name: "Cactus Green",    hex: "#2f8b4d" },
  { id: "orange",  name: "Sunset Orange",   hex: "#ef7d1a" },
  { id: "purple",  name: "Galaxy Purple",   hex: "#7a4fbf" },
  { id: "pink",    name: "Bubblegum Pink",  hex: "#e969a8" },
  { id: "teal",    name: "Sea Teal",        hex: "#1d9e94" },
  { id: "yellow",  name: "Taxi Yellow",     hex: "#e8b715" },
  { id: "black",   name: "Midnight Black",  hex: "#33383f" },
  { id: "white",   name: "Cloud White",     hex: "#f3f5f7" },
];

// fictional shippers (GDD: no real brands)
export const SHIPPERS = ["Pallet Pals", "Golden Bear Freight", "SunCoast Traders", "ValleyFresh Co-op",
  "Bayline Imports", "Redwood Retail Group", "Cactus Flower Foods", "Sierra Peak Outfitters",
  "Harbor & Hearth", "Comet Electronics", "MissionCare Medical", "PoppyMart",
  "Great Plains Dry Goods", "Rustbelt Machine Works", "Bayou Bottling", "Liberty Bell Supply",
  "Twin Pines Lumber", "Gulfstream Chemical", "Copper State Provisions", "Northstar Outfitters"];

// ---------------------------------------------------------------- driver careers
// Drivers grow with every delivery: XP by contract tier, levels raise skill (and wage —
// good people cost money), and at levels 2 and 4 they earn a TRAIT that changes how they
// drive. This is what turns "a driver" into "MY driver".
export const DRIVER_TRAITS = {
  nightowl:    { name: "Night Owl",     icon: "🦉", blurb: "Half the extra risk of night driving." },
  hypermiler:  { name: "Hypermiler",    icon: "🍃", blurb: "+8% fuel economy in any truck." },
  ironback:    { name: "Iron Back",     icon: "🪨", blurb: "Tires 25% slower behind the wheel." },
  smoothhands: { name: "Smooth Hands",  icon: "🤲", blurb: "Fragile cargo takes 30% less damage." },
  stormrider:  { name: "Storm Rider",   icon: "🌩️", blurb: "Half the speed lost to bad weather." },
};
export const TRAIT_ORDER = ["nightowl", "hypermiler", "ironback", "smoothhands", "stormrider"];
// XP needed to REACH each level (level 1 = hired). Tier XP: LOCAL 1 · REGIONAL 2 · LONG-HAUL 3 · TRANSCON 5.
export const DRIVER_LEVELS = [0, 6, 15, 30, 50];   // L1..L5
export const XP_PER_TIER = { "LOCAL": 1, "REGIONAL": 2, "LONG-HAUL": 3, "TRANSCON": 5 };

// ---------------------------------------------------------------- depots
// Company bases you BUY in hub cities once their region is unlocked. Benefits:
// repairs cost half there, overnight rest is free and always safe, and new trucks are
// delivered to your HOME depot. Lakewood is the free starter depot (it's the yard).
export const DEPOT_COST_BY_TIER = { 1: 6000, 2: 10000, 3: 16000 };

export const DRIVER_NAMES = ["Dana Ortiz", "Sam Whitfield", "Rosa Delgado", "Chuck Petersen", "Maya Chen",
  "Big Al Kowalski", "Frankie Rivers", "June Nakamura", "Otis Bell", "Priya Raman",
  "Hank Morrow", "Lupe Fuentes", "Dee Callahan", "Marcus Webb", "Sky Tanaka",
  "Bobby Jean Fontenot", "Ida Halvorsen", "Ray Okafor", "Charlene Boyd", "Tito Marchetti"];

// ---------------------------------------------------------------- tunables (GDD §18: all balance configurable)
export const CFG = {
  START_CASH: 3000,
  START_HOUR: 8 * 60,           // day starts 8:00 AM Pacific (the home region's clock)
  RUSH_START: 16.5 * 60,        // 4:30 PM LOCAL time at the road you're on
  RUSH_END: 19 * 60,            // 7:00 PM local
  RUSH_SPEED: 0.45,             // urban edge speed multiplier during rush
  RUSH_RISK: 2.0,
  NIGHT_RISK: 1.6,              // 10 PM - 5 AM local
  FATIGUE_PER_HR: 8,            // driving
  FATIGUE_TIRED: 60, FATIGUE_VERY: 80, FATIGUE_CRIT: 95,
  REST_MIN: 8 * 60,             // full sleep
  REST_COST_SAFE: 45,           // secure truck stop
  BASE_INCIDENT_PER_MI: 0.00012, // baseline accident chance per mile
  TOW_COST: 500, TOW_DELAY_MIN: 240,
  BREAKDOWN_COND: 40,           // below this condition, breakdowns start
  WAGE_BASE: 110,               // per game day, + skill * 35
  DEADLINE_SLACK: 1.55,         // deadline = fastest-ETA * slack + 2h
  LONGHAUL_BUFFER_PER_HR: 0.02, // ...and slack grows 2% per driving hour, because a long
  LONGHAUL_BUFFER_MAX: 1.5,     //    haul meets weather the quote could never forecast
  CONTRACT_BOARD: 8,
  PAY_PER_MI: 1.6,
  PAY_BASE: 55,
  // lane premium: grades/empty country/rough pavement/hard weather pay more (see lanePremium)
  LANE_PREMIUM_BASE: 0.06,      // ~California's baseline severity; you're paid the EXCESS
  LANE_PREMIUM_WEATHER: 1.6,    // how hard weather severity converts into money
  LANE_PREMIUM_MAX: 0.4,        // cap: no lane pays more than +40% for being nasty
  DEADHEAD_OVERHEAD_PER_MI: 0.45, // driver time + wear for miles driven empty to pickup
  PASSPORT_BONUS: 25,             // explorer payout per newly stamped freeway shield
  PASSPORT_COMPLETE_BONUS: 25000, // "Grand Tour": every shield in the country — pays like a truck
  PASSPORT_COMPLETE_REP: 10,      // ...and the whole industry hears about it
  HWY_FLASH_MIN: 25,              // game-minutes the freeway badge stays highlighted after a change
  // ---- special deliveries (rare jackpot loads)
  SPECIAL_CHANCE: 0.08,           // roll per generated contract; only one on the board at a time
  SPECIAL_PAY_MULT: 2.2,          // they pay like the event they are
  SPECIAL_REP_BONUS: 2,           // extra rep on top of the normal delivery gain
  SPECIAL_EXPIRE_MULT: 2,         // stays on the board longer so it can actually be spotted
  PAINT_COST: 150,                // repaint a truck at any shop; renaming is free
  // ---- emergency dispatches (the world calls YOU)
  EMERGENCY_CHANCE: 0.15,         // roll per event-check while a crisis zone exists (one at a time)
  EMERGENCY_COOLDOWN_MIN: 720,    // quiet hours after the last siren — scarcity is the point
  EMERGENCY_PAY_MULT: 2.6,        // danger pay — you're driving INTO the storm
  EMERGENCY_REP_BONUS: 3,         // the whole region remembers who showed up
  EMERGENCY_SLACK: 1.18,          // tight: an emergency that can wait isn't one
  // ---- driver careers
  WAGE_PER_LEVEL: 20,             // each level raises the daily wage — talent isn't free
  REGION: "the United States",    // the whole play area — UI copy reads this instead of a state
  HOME_REGION_NAME: "California", // where you start (see REGIONS.west)
  LATE_GRACE_MIN: 20,
  REROUTE_DELAY_MIN: 4,         // GDD §7: small decision delay on reroute
  FUEL_STOP_MIN: 20, TOLL_BOOTH: 0,
  EVENT_CHECK_MIN: 30,          // spawn roll cadence
  WEATHER_SHIFT_MIN: 200,       // regional weather persistence
  SAVE_KEY: "route_dispatcher_adventure_save_v2",
  // stars (reputation) earned per ON-TIME delivery, by distance tier. Bigger jobs, bigger
  // stars — a 12-mile hop can't build a national reputation the way a transcon run does.
  REP_TIER: { "LOCAL": 1, "REGIONAL": 2, "LONG-HAUL": 3, "TRANSCON": 4 },
  // rep gates for contract distance tiers
  REP_REGIONAL: 12, REP_LONGHAUL: 25,
  LOCAL_MI: 80, REGIONAL_MI: 260, LONGHAUL_MI: 1500,  // above LONGHAUL_MI it's a TRANSCON run
  // how often the board offers each distance tier once you can run them all — without this
  // a 65-city map buys you nothing but 3,000-mile monsters, because most cities are far away
  TIER_MIX: [["LOCAL", 30], ["REGIONAL", 34], ["LONG-HAUL", 26], ["TRANSCON", 10]],
  // ---- multi-day hauling (hours-of-service)
  HOS_ENABLED: true,
  ROADSIDE_REST_MIN: 7 * 60,    // forced sleep when a driver redlines between towns
  ROADSIDE_REST_SAFETY: 2,      // a shoulder or a rest area — not a secure lot
  RANGE_SAFETY: 0.85,           // a leg longer than range*this is refused as unplannable
};

// weather types and their effects (speed multiplier, risk multiplier)
// `chainable` weather is what Snow Chains help with; `breakdown` multiplies mechanical failure.
export const WEATHER = {
  clear: { name: "Clear",  icon: "",   speed: 1,    risk: 1 },
  rain:  { name: "Rain",   icon: "🌧️", speed: 0.85, risk: 1.6 },
  storm: { name: "Storm",  icon: "⛈️", speed: 0.68, risk: 2.6 },
  fog:   { name: "Fog",    icon: "🌫️", speed: 0.78, risk: 2.0 },
  heat:  { name: "Heatwave", icon: "🥵", speed: 0.95, risk: 1.2, breakdown: 2.0 },
  snow:  { name: "Snow",   icon: "🌨️", speed: 0.58, risk: 2.8, chainable: true, cold: true },
  ice:   { name: "Ice",    icon: "🧊", speed: 0.48, risk: 3.4, chainable: true, cold: true },
  wind:  { name: "High Wind", icon: "💨", speed: 0.88, risk: 1.7, crosswind: true },
};
// zone → weighted weather picks (GDD §15: events should fit region)
export const ZONE_WEATHER = {
  // California
  south:  [["clear", 62], ["rain", 12], ["storm", 4], ["fog", 8], ["heat", 14]],
  coast:  [["clear", 55], ["rain", 14], ["storm", 6], ["fog", 25]],
  valley: [["clear", 60], ["rain", 10], ["storm", 5], ["fog", 7], ["heat", 18]],
  north:  [["clear", 56], ["rain", 18], ["storm", 8], ["fog", 14], ["heat", 4]],
  // the rest of the country
  desert:    [["clear", 72], ["heat", 20], ["storm", 4], ["rain", 3], ["wind", 1]],
  cascadia:  [["clear", 38], ["rain", 34], ["fog", 14], ["storm", 8], ["snow", 6]],
  rockies:   [["clear", 46], ["snow", 20], ["rain", 9], ["storm", 8], ["fog", 6], ["wind", 6], ["ice", 5]],
  plains:    [["clear", 50], ["wind", 16], ["storm", 12], ["snow", 10], ["rain", 8], ["ice", 4]],
  greatlakes:[["clear", 44], ["snow", 18], ["rain", 14], ["storm", 8], ["fog", 8], ["ice", 8]],
  midwest:   [["clear", 52], ["rain", 16], ["storm", 12], ["snow", 12], ["fog", 4], ["ice", 4]],
  gulf:      [["clear", 52], ["storm", 20], ["rain", 16], ["heat", 10], ["fog", 2]],
  dixie:     [["clear", 54], ["rain", 18], ["storm", 16], ["heat", 8], ["fog", 4]],
  florida:   [["clear", 50], ["storm", 26], ["rain", 14], ["heat", 10]],
  atlantic:  [["clear", 50], ["rain", 18], ["snow", 10], ["storm", 8], ["fog", 8], ["ice", 6]],
};

// dynamic road events (GDD §9)
export const EVENT_DEFS = {
  accident_minor: { name: "Minor Accident", icon: "💥", durMin: [25, 80],  speed: 0.55 },
  accident_major: { name: "Major Accident", icon: "🚨", durMin: [60, 180], closed: true },
  construction:   { name: "Construction",   icon: "🚧", durMin: [600, 2000], speed: 0.72, qPenalty: 1 },
  closure:        { name: "Road Closure",   icon: "⛔", durMin: [120, 360], closed: true },
  wildfire:       { name: "Wildfire",       icon: "🔥", durMin: [240, 600], closed: true, smoke: true },
  blizzard:       { name: "Pass Closed (Snow)", icon: "❄️", durMin: [180, 540], closed: true },
  flood:          { name: "Flooding",       icon: "🌊", durMin: [150, 480], closed: true },
  tornado:        { name: "Tornado Warning",icon: "🌪️", durMin: [45, 150],  closed: true },
};
