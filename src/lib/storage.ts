// Local storage based save system for ImagineX
// Can be upgraded to a backend DB later

const STORAGE_PREFIX = "imaginex_";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export interface PlayerProfile {
  nickname: string;
  avatarColor: string;
  createdAt: number;
}

export interface GameSaveData {
  gameId: string;
  lastPlayed: number;
  totalPlayTime: number; // seconds
  data: Record<string, unknown>; // game-specific save data
}

export interface LeaderboardEntry {
  nickname: string;
  gameId: string;
  score: number;
  date: number;
}

// Profile
export function getProfile(): PlayerProfile | null {
  return safeParse(localStorage.getItem(`${STORAGE_PREFIX}profile`), null);
}

export function saveProfile(profile: PlayerProfile): void {
  localStorage.setItem(`${STORAGE_PREFIX}profile`, JSON.stringify(profile));
}

// Game saves
export function getGameSave(gameId: string): GameSaveData | null {
  return safeParse(localStorage.getItem(`${STORAGE_PREFIX}save_${gameId}`), null);
}

export function saveGameData(gameId: string, data: GameSaveData): void {
  localStorage.setItem(`${STORAGE_PREFIX}save_${gameId}`, JSON.stringify(data));
}

// Play time tracking
export function updatePlayTime(gameId: string, seconds: number): void {
  const save = getGameSave(gameId) || {
    gameId,
    lastPlayed: Date.now(),
    totalPlayTime: 0,
    data: {},
  };
  save.totalPlayTime += seconds;
  save.lastPlayed = Date.now();
  saveGameData(gameId, save);
}

// Leaderboard (remote via /api/leaderboard — shared across all players)
export async function getLeaderboard(gameId?: string): Promise<LeaderboardEntry[]> {
  try {
    const url = gameId
      ? `/api/leaderboard?gameId=${encodeURIComponent(gameId)}`
      : `/api/leaderboard`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function addLeaderboardEntry(entry: LeaderboardEntry): Promise<void> {
  try {
    await fetch(`/api/leaderboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
  } catch {
    // Swallow: leaderboard is best-effort, don't break gameplay.
  }
}

// Stats
export async function getStats() {
  const profile = getProfile();
  const allKeys = Object.keys(localStorage).filter((k) =>
    k.startsWith(`${STORAGE_PREFIX}save_`)
  );
  let totalPlayTime = 0;
  let gamesPlayed = 0;
  let lastPlayed = 0;

  for (const key of allKeys) {
    const save = safeParse<GameSaveData | null>(localStorage.getItem(key), null);
    if (save) {
      totalPlayTime += save.totalPlayTime;
      if (save.totalPlayTime > 0) gamesPlayed++;
      if (save.lastPlayed > lastPlayed) lastPlayed = save.lastPlayed;
    }
  }

  const nickname = profile?.nickname;
  let myEntries = 0;
  if (nickname) {
    const all = await getLeaderboard();
    myEntries = all.filter((e) => e.nickname === nickname).length;
  }

  return {
    profile,
    totalPlayTime,
    gamesPlayed,
    lastPlayed,
    leaderboardEntries: myEntries,
  };
}

// ---- Profile sync (nickname + play stats → /api/players, so /players can list everyone) ----
// A random per-browser id keeps two players with the same nickname apart. No personal data leaves the browser:
// nickname, avatar colour, created date and per-game play time / last played only.
export function getPlayerId(): string {
  let id = localStorage.getItem(`${STORAGE_PREFIX}pid`);
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(`${STORAGE_PREFIX}pid`, id);
  }
  return id;
}

export function collectGameStats(): Record<string, { playTime: number; lastPlayed: number }> {
  const out: Record<string, { playTime: number; lastPlayed: number }> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) || "";
    if (!k.startsWith(`${STORAGE_PREFIX}save_`)) continue;
    const save = safeParse<GameSaveData | null>(localStorage.getItem(k), null);
    if (save && typeof save.totalPlayTime === "number") out[k.slice(`${STORAGE_PREFIX}save_`.length)] = { playTime: Math.round(save.totalPlayTime), lastPlayed: save.lastPlayed || 0 };
  }
  return out;
}

let lastSync = 0;
export function syncProfile(force = false): void {
  try {
    const profile = getProfile();
    if (!profile || !profile.nickname) return;
    if (!force && Date.now() - lastSync < 60_000) return; // at most once a minute unless forced
    lastSync = Date.now();
    void fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ pid: getPlayerId(), nickname: profile.nickname, avatarColor: profile.avatarColor, createdAt: profile.createdAt, games: collectGameStats() }),
    }).catch(() => {});
  } catch {}
}
