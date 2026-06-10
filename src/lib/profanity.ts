// Lightweight profanity filter for nicknames
// Checks against a list of common offensive words/slurs
// Uses substring matching to catch variations

// Matched anywhere in the name — unambiguous, never part of innocent words.
const BLOCKED_WORDS = [
  // Slurs and hate speech
  "nigger", "nigga", "nigg", "n1gg", "faggot", "fagg", "f4gg", "tranny",
  "retard", "retrd", "r3tard", "spic", "sp1c", "chink", "ch1nk", "kike",
  "k1ke", "wetback", "beaner", "gook", "darkie", "honky",
  "gringo",
  // Sexual / vulgar
  "fuck", "fuk", "fck", "f_ck", "fuq", "phuck", "phuk",
  "shit", "sh1t", "b1tch", "bitch", "btch",
  "pussy", "puss1",
  "penis", "pen1s", "vagina", "vag1na", "cunt",
  "jizz", "whore", "wh0re", "slut", "sl_t",
  "dildo", "d1ldo", "blowjob", "handjob", "porn", "p0rn",
  "boob", "b00b", "anus",
  // Violence / other
  "nazi", "naz1", "hitler", "h1tler", "kkk",
  "murder", "suicide", "terrorist",
  // Common gaming toxicity
  "stfu", "gtfo", "lmfao",
];

// Words that appear inside innocent names (Cassie, Killian, Cucumber, Analyse,
// Peacock, Grape...) — blocked only at the start/end of a name, where they're
// clearly intentional (e.g. "asslord", "dumbass").
const BLOCKED_EDGE_WORDS = [
  "ass", "a55", "anal", "cum", "kill", "rape", "r4pe", "cock", "c0ck",
  "dick", "d1ck", "tits", "t1ts", "sht", "cnt", "damn", "coon", "cracker",
];

// Innocent names that would otherwise trip the edge-word check (exact match,
// post-normalization).
const SAFE_NAMES = [
  "peacock", "hancock", "grape", "drape", "analyse", "analyst", "killian",
  "dickson", "ashton", "firecracker",
];

export function containsProfanity(name: string): boolean {
  const normalized = name
    .toLowerCase()
    .replace(/[_\-.\s]/g, "")   // strip separators
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/\$/g, "s")
    .replace(/@/g, "a")
    .replace(/!/g, "i");

  for (const word of BLOCKED_WORDS) {
    if (normalized.includes(word)) return true;
  }
  if (SAFE_NAMES.includes(normalized)) return false;
  for (const word of BLOCKED_EDGE_WORDS) {
    if (normalized.startsWith(word) || normalized.endsWith(word)) return true;
  }
  return false;
}
