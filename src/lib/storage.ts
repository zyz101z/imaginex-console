// Local storage based save system for ImagineX
// Can be upgraded to a backend DB later

const STORAGE_PREFIX = "imaginex_";

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
  const raw = localStorage.getItem(`${STORAGE_PREFIX}profile`);
  return raw ? JSON.parse(raw) : null;
}

export function saveProfile(profile: PlayerProfile): void {
  localStorage.setItem(`${STORAGE_PREFIX}profile`, JSON.stringify(profile));
}

// Game saves
export function getGameSave(gameId: string): GameSaveData | null {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}save_${gameId}`);
  return raw ? JSON.parse(raw) : null;
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

// Leaderboard (local for now)
export function getLeaderboard(gameId?: string): LeaderboardEntry[] {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}leaderboard`);
  const entries: LeaderboardEntry[] = raw ? JSON.parse(raw) : [];
  if (gameId) {
    return entries
      .filter((e) => e.gameId === gameId)
      .sort((a, b) => b.score - a.score);
  }
  return entries.sort((a, b) => b.score - a.score);
}

export function addLeaderboardEntry(entry: LeaderboardEntry): void {
  const entries = getLeaderboard();
  entries.push(entry);
  // Keep top 100
  entries.sort((a, b) => b.score - a.score);
  const trimmed = entries.slice(0, 100);
  localStorage.setItem(
    `${STORAGE_PREFIX}leaderboard`,
    JSON.stringify(trimmed)
  );
}

// Stats
export function getStats() {
  const profile = getProfile();
  const allKeys = Object.keys(localStorage).filter((k) =>
    k.startsWith(`${STORAGE_PREFIX}save_`)
  );
  let totalPlayTime = 0;
  let gamesPlayed = 0;
  let lastPlayed = 0;

  for (const key of allKeys) {
    const raw = localStorage.getItem(key);
    if (raw) {
      const save: GameSaveData = JSON.parse(raw);
      totalPlayTime += save.totalPlayTime;
      if (save.totalPlayTime > 0) gamesPlayed++;
      if (save.lastPlayed > lastPlayed) lastPlayed = save.lastPlayed;
    }
  }

  return {
    profile,
    totalPlayTime,
    gamesPlayed,
    lastPlayed,
    leaderboardEntries: getLeaderboard().length,
  };
}
