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
