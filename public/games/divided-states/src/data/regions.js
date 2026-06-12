// Regions (the "continent" analog). Holding every state in a region at the start
// of your turn grants its bonus reinforcements. Bonuses are tunable in playtest.

export const REGIONS = {
  northeast: {
    name: "Northeast",
    bonus: 5,
    states: ["ME", "NH", "VT", "MA", "RI", "CT", "NY", "NJ", "PA"],
  },
  south_atlantic: {
    name: "South Atlantic",
    bonus: 4,
    states: ["DE", "MD", "VA", "WV", "NC", "SC", "GA", "FL"],
  },
  great_lakes: {
    name: "Great Lakes",
    bonus: 4,
    states: ["OH", "IN", "MI", "IL", "WI", "MN", "IA"],
  },
  south_central: {
    name: "South Central",
    bonus: 4,
    states: ["KY", "TN", "AL", "MS", "AR", "LA", "MO"],
  },
  great_plains: {
    name: "Great Plains",
    bonus: 3,
    states: ["ND", "SD", "NE", "KS", "OK", "TX"],
  },
  mountain_west: {
    name: "Mountain West",
    bonus: 5,
    states: ["MT", "ID", "WY", "CO", "UT", "NV", "AZ", "NM"],
  },
  pacific: {
    name: "Pacific",
    bonus: 3,
    states: ["WA", "OR", "CA", "AK"],
  },
};

export const REGION_KEYS = Object.keys(REGIONS);
