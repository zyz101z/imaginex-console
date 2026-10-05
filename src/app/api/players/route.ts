import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { games } from "@/lib/games";
import { containsProfanity } from "@/lib/profanity";

export const runtime = "edge";

const redis = Redis.fromEnv();
const KEY = "imaginex:players";
const IDS = new Set(games.map((g) => g.id));

type GameStat = { playTime: number; lastPlayed: number };
export type PlayerRecord = {
  pid: string;
  nickname: string;
  avatarColor: string;
  createdAt: number;
  firstSeen: number;
  lastSeen: number;
  country: string;
  place: string;
  games: Record<string, GameStat>;
};

// POST — the console syncs the local profile here (on load, after a game, on profile save).
export async function POST(req: NextRequest) {
  let body: Partial<PlayerRecord>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const pid = String(body.pid ?? "");
  const nickname = String(body.nickname ?? "").trim().slice(0, 20);
  if (!/^[0-9a-f]{24}$/.test(pid)) return NextResponse.json({ error: "bad pid" }, { status: 400 });
  if (!nickname || containsProfanity(nickname)) return NextResponse.json({ error: "nickname rejected" }, { status: 400 });
  const avatarColor = /^#[0-9a-fA-F]{3,8}$/.test(String(body.avatarColor ?? "")) ? String(body.avatarColor) : "#4fc3f7";
  const createdAt = Number(body.createdAt) > 0 ? Number(body.createdAt) : Date.now();
  const gamesIn = (body.games && typeof body.games === "object" ? body.games : {}) as Record<string, Partial<GameStat>>;
  const gamesOut: Record<string, GameStat> = {};
  for (const [id, g] of Object.entries(gamesIn)) {
    if (!IDS.has(id) || !g) continue;
    const playTime = Math.max(0, Math.min(10_000_000, Number(g.playTime) || 0));
    const lastPlayed = Math.max(0, Number(g.lastPlayed) || 0);
    gamesOut[id] = { playTime, lastPlayed };
  }
  const country = (req.headers.get("x-vercel-ip-country") || "").toUpperCase().slice(0, 2);
  const region = decodeURIComponent(req.headers.get("x-vercel-ip-country-region") || "").slice(0, 24);
  const city = decodeURIComponent(req.headers.get("x-vercel-ip-city") || "").slice(0, 32);
  const prevRaw = await redis.hget<PlayerRecord | string>(KEY, pid);
  const prev: PlayerRecord | null = prevRaw ? (typeof prevRaw === "string" ? JSON.parse(prevRaw) : prevRaw) : null;
  // play time only ever grows: keep the max per game so a cleared browser can't shrink the record
  const merged: Record<string, GameStat> = { ...(prev?.games || {}) };
  for (const [id, g] of Object.entries(gamesOut)) {
    const p = merged[id];
    merged[id] = { playTime: Math.max(g.playTime, p?.playTime || 0), lastPlayed: Math.max(g.lastPlayed, p?.lastPlayed || 0) };
  }
  const rec: PlayerRecord = {
    pid, nickname, avatarColor, createdAt: Math.min(createdAt, prev?.createdAt || createdAt),
    firstSeen: prev?.firstSeen || Date.now(), lastSeen: Date.now(),
    country: country || prev?.country || "", place: [country, region, city].filter(Boolean).join("/") || prev?.place || "",
    games: merged,
  };
  await redis.hset(KEY, { [pid]: JSON.stringify(rec) });
  return NextResponse.json({ ok: true });
}

// GET — every synced profile plus each player's best leaderboard score per game (matched by nickname).
export async function GET() {
  const all = (await redis.hgetall<Record<string, PlayerRecord | string>>(KEY)) || {};
  const players: PlayerRecord[] = Object.values(all).map((v) => (typeof v === "string" ? JSON.parse(v) : v));
  players.sort((a, b) => b.lastSeen - a.lastSeen);
  // best score per nickname per game from the leaderboards (top 100 each)
  const p = redis.pipeline();
  const ids = games.map((g) => g.id);
  for (const id of ids) p.zrange(`imaginex:leaderboard:${id}`, 0, 99, { rev: true });
  const boards = (await p.exec()) as (string[] | null)[];
  const best: Record<string, Record<string, number>> = {};
  boards.forEach((rows, i) => {
    for (const raw of rows || []) {
      try {
        const e = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!e?.nickname) continue;
        const b = (best[e.nickname] ||= {});
        if (!(ids[i] in b) || e.score > b[ids[i]]) b[ids[i]] = e.score;
      } catch {}
    }
  });
  return NextResponse.json(
    { players: players.map((pl) => ({ ...pl, best: best[pl.nickname] || {} })), generatedAt: Date.now() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
