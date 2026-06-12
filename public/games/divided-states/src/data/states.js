// The 49 territories (all US states except Hawaii). SVG paths / label anchors are
// added later by the UI phase; the engine only needs code, name, and region.

export const STATES = [
  // Northeast
  { code: "ME", name: "Maine", region: "northeast" },
  { code: "NH", name: "New Hampshire", region: "northeast" },
  { code: "VT", name: "Vermont", region: "northeast" },
  { code: "MA", name: "Massachusetts", region: "northeast" },
  { code: "RI", name: "Rhode Island", region: "northeast" },
  { code: "CT", name: "Connecticut", region: "northeast" },
  { code: "NY", name: "New York", region: "northeast" },
  { code: "NJ", name: "New Jersey", region: "northeast" },
  { code: "PA", name: "Pennsylvania", region: "northeast" },
  // South Atlantic
  { code: "DE", name: "Delaware", region: "south_atlantic" },
  { code: "MD", name: "Maryland", region: "south_atlantic" },
  { code: "VA", name: "Virginia", region: "south_atlantic" },
  { code: "WV", name: "West Virginia", region: "south_atlantic" },
  { code: "NC", name: "North Carolina", region: "south_atlantic" },
  { code: "SC", name: "South Carolina", region: "south_atlantic" },
  { code: "GA", name: "Georgia", region: "south_atlantic" },
  { code: "FL", name: "Florida", region: "south_atlantic" },
  // Great Lakes
  { code: "OH", name: "Ohio", region: "great_lakes" },
  { code: "IN", name: "Indiana", region: "great_lakes" },
  { code: "MI", name: "Michigan", region: "great_lakes" },
  { code: "IL", name: "Illinois", region: "great_lakes" },
  { code: "WI", name: "Wisconsin", region: "great_lakes" },
  { code: "MN", name: "Minnesota", region: "great_lakes" },
  { code: "IA", name: "Iowa", region: "great_lakes" },
  // South Central
  { code: "KY", name: "Kentucky", region: "south_central" },
  { code: "TN", name: "Tennessee", region: "south_central" },
  { code: "AL", name: "Alabama", region: "south_central" },
  { code: "MS", name: "Mississippi", region: "south_central" },
  { code: "AR", name: "Arkansas", region: "south_central" },
  { code: "LA", name: "Louisiana", region: "south_central" },
  { code: "MO", name: "Missouri", region: "south_central" },
  // Great Plains
  { code: "ND", name: "North Dakota", region: "great_plains" },
  { code: "SD", name: "South Dakota", region: "great_plains" },
  { code: "NE", name: "Nebraska", region: "great_plains" },
  { code: "KS", name: "Kansas", region: "great_plains" },
  { code: "OK", name: "Oklahoma", region: "great_plains" },
  { code: "TX", name: "Texas", region: "great_plains" },
  // Mountain West
  { code: "MT", name: "Montana", region: "mountain_west" },
  { code: "ID", name: "Idaho", region: "mountain_west" },
  { code: "WY", name: "Wyoming", region: "mountain_west" },
  { code: "CO", name: "Colorado", region: "mountain_west" },
  { code: "UT", name: "Utah", region: "mountain_west" },
  { code: "NV", name: "Nevada", region: "mountain_west" },
  { code: "AZ", name: "Arizona", region: "mountain_west" },
  { code: "NM", name: "New Mexico", region: "mountain_west" },
  // Pacific
  { code: "WA", name: "Washington", region: "pacific" },
  { code: "OR", name: "Oregon", region: "pacific" },
  { code: "CA", name: "California", region: "pacific" },
  { code: "AK", name: "Alaska", region: "pacific" },
];

export const STATE_CODES = STATES.map((s) => s.code);
export const STATE_BY_CODE = Object.fromEntries(STATES.map((s) => [s.code, s]));
