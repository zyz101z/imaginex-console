// All 32 NFL teams — real structure (conference/division), colors for UI chips.
export const TEAMS = [
  // NFC North
  { id: "MIN", city: "Minnesota", name: "Vikings", conf: "NFC", div: "North", color: "#4F2683", color2: "#FFC62F" },
  { id: "GB",  city: "Green Bay", name: "Packers", conf: "NFC", div: "North", color: "#203731", color2: "#FFB612" },
  { id: "DET", city: "Detroit", name: "Lions", conf: "NFC", div: "North", color: "#0076B6", color2: "#B0B7BC" },
  { id: "CHI", city: "Chicago", name: "Bears", conf: "NFC", div: "North", color: "#0B162A", color2: "#C83803" },
  // NFC East
  { id: "PHI", city: "Philadelphia", name: "Eagles", conf: "NFC", div: "East", color: "#004C54", color2: "#A5ACAF" },
  { id: "DAL", city: "Dallas", name: "Cowboys", conf: "NFC", div: "East", color: "#003594", color2: "#869397" },
  { id: "WAS", city: "Washington", name: "Commanders", conf: "NFC", div: "East", color: "#5A1414", color2: "#FFB612" },
  { id: "NYG", city: "New York", name: "Giants", conf: "NFC", div: "East", color: "#0B2265", color2: "#A71930" },
  // NFC South
  { id: "TB",  city: "Tampa Bay", name: "Buccaneers", conf: "NFC", div: "South", color: "#D50A0A", color2: "#34302B" },
  { id: "ATL", city: "Atlanta", name: "Falcons", conf: "NFC", div: "South", color: "#A71930", color2: "#000000" },
  { id: "NO",  city: "New Orleans", name: "Saints", conf: "NFC", div: "South", color: "#D3BC8D", color2: "#101820" },
  { id: "CAR", city: "Carolina", name: "Panthers", conf: "NFC", div: "South", color: "#0085CA", color2: "#101820" },
  // NFC West
  { id: "SF",  city: "San Francisco", name: "49ers", conf: "NFC", div: "West", color: "#AA0000", color2: "#B3995D" },
  { id: "SEA", city: "Seattle", name: "Seahawks", conf: "NFC", div: "West", color: "#002244", color2: "#69BE28" },
  { id: "LAR", city: "Los Angeles", name: "Rams", conf: "NFC", div: "West", color: "#003594", color2: "#FFA300" },
  { id: "ARI", city: "Arizona", name: "Cardinals", conf: "NFC", div: "West", color: "#97233F", color2: "#FFB612" },
  // AFC North
  { id: "BAL", city: "Baltimore", name: "Ravens", conf: "AFC", div: "North", color: "#241773", color2: "#9E7C0C" },
  { id: "PIT", city: "Pittsburgh", name: "Steelers", conf: "AFC", div: "North", color: "#FFB612", color2: "#101820" },
  { id: "CIN", city: "Cincinnati", name: "Bengals", conf: "AFC", div: "North", color: "#FB4F14", color2: "#000000" },
  { id: "CLE", city: "Cleveland", name: "Browns", conf: "AFC", div: "North", color: "#311D00", color2: "#FF3C00" },
  // AFC East
  { id: "BUF", city: "Buffalo", name: "Bills", conf: "AFC", div: "East", color: "#00338D", color2: "#C60C30" },
  { id: "MIA", city: "Miami", name: "Dolphins", conf: "AFC", div: "East", color: "#008E97", color2: "#FC4C02" },
  { id: "NYJ", city: "New York", name: "Jets", conf: "AFC", div: "East", color: "#125740", color2: "#FFFFFF" },
  { id: "NE",  city: "New England", name: "Patriots", conf: "AFC", div: "East", color: "#002244", color2: "#C60C30" },
  // AFC South
  { id: "HOU", city: "Houston", name: "Texans", conf: "AFC", div: "South", color: "#03202F", color2: "#A71930" },
  { id: "IND", city: "Indianapolis", name: "Colts", conf: "AFC", div: "South", color: "#002C5F", color2: "#A2AAAD" },
  { id: "JAX", city: "Jacksonville", name: "Jaguars", conf: "AFC", div: "South", color: "#101820", color2: "#D7A22A" },
  { id: "TEN", city: "Tennessee", name: "Titans", conf: "AFC", div: "South", color: "#0C2340", color2: "#4B92DB" },
  // AFC West
  { id: "KC",  city: "Kansas City", name: "Chiefs", conf: "AFC", div: "West", color: "#E31837", color2: "#FFB81C" },
  { id: "LAC", city: "Los Angeles", name: "Chargers", conf: "AFC", div: "West", color: "#0080C6", color2: "#FFC20E" },
  { id: "DEN", city: "Denver", name: "Broncos", conf: "AFC", div: "West", color: "#FB4F14", color2: "#002244" },
  { id: "LV",  city: "Las Vegas", name: "Raiders", conf: "AFC", div: "West", color: "#000000", color2: "#A5ACAF" },
];

export const TEAM_BY_ID = Object.fromEntries(TEAMS.map(t => [t.id, t]));

// Rough team strength tiers (~2025-26 season baseline) used to calibrate GENERATED
// depth players on teams whose full real roster isn't authored yet. 1=elite..5=rebuilding.
export const TEAM_TIER = {
  MIN: 2, GB: 2, DET: 1, CHI: 3,
  PHI: 1, DAL: 3, WAS: 2, NYG: 4,
  TB: 2, ATL: 3, NO: 4, CAR: 4,
  SF: 2, SEA: 2, LAR: 2, ARI: 3,
  BAL: 1, PIT: 3, CIN: 2, CLE: 5,
  BUF: 1, MIA: 3, NYJ: 4, NE: 3,
  HOU: 2, IND: 3, JAX: 3, TEN: 5,
  KC: 1, LAC: 2, DEN: 2, LV: 4,
};
