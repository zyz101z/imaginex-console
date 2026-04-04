// Lightweight profanity filter for nicknames
// Checks against a list of common offensive words/slurs
// Uses substring matching to catch variations

const BLOCKED_WORDS = [
  // Slurs and hate speech
  "nigger", "nigga", "nigg", "n1gg", "faggot", "fagg", "f4gg", "tranny",
  "retard", "retrd", "r3tard", "spic", "sp1c", "chink", "ch1nk", "kike",
  "k1ke", "wetback", "beaner", "gook", "coon", "darkie", "honky",
  "cracker", "gringo",
  // Sexual / vulgar
  "fuck", "fuk", "fck", "f_ck", "fuq", "phuck", "phuk",
  "shit", "sh1t", "sht", "b1tch", "bitch", "btch",
  "cock", "c0ck", "dick", "d1ck", "pussy", "puss1",
  "penis", "pen1s", "vagina", "vag1na", "cunt", "cnt",
  "cum", "jizz", "whore", "wh0re", "slut", "sl_t",
  "dildo", "d1ldo", "blowjob", "handjob", "porn", "p0rn",
  "tits", "t1ts", "boob", "b00b", "anus", "anal",
  // Violence / other
  "nazi", "naz1", "hitler", "h1tler", "kkk", "rape", "r4pe",
  "kill", "murder", "suicide", "terrorist",
  // Common gaming toxicity
  "ass", "a$$", "a55", "damn", "stfu", "gtfo", "lmfao",
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
  return false;
}
