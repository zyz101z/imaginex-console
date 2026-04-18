import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { containsProfanity } from "@/lib/profanity";

export const runtime = "edge";

const redis = Redis.fromEnv();

const KNOWN_GAMES = new Set(["tennis-world", "bloot"]);
const MAX_SCORE = 1_000_000;
const KEEP_TOP = 100;

type Entry = {
  nickname: string;
  gameId: string;
  score: number;
  date: number;
};

function key(gameId: string) {
  return `imaginex:leaderboard:${gameId}`;
}

export async function GET(req: NextRequest) {
  const gameId = req.nextUrl.searchParams.get("gameId");

  async function readGame(id: string): Promise<Entry[]> {
    const rows = await redis.zrange<string[]>(key(id), 0, KEEP_TOP - 1, {
      rev: true,
      withScores: false,
    });
    if (!rows || rows.length === 0) return [];
    const entries: Entry[] = [];
    for (const raw of rows) {
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (parsed && typeof parsed.score === "number") entries.push(parsed);
      } catch {}
    }
    return entries;
  }

  if (gameId) {
    if (!KNOWN_GAMES.has(gameId)) return NextResponse.json([]);
    return NextResponse.json(await readGame(gameId));
  }

  const all: Entry[] = [];
  for (const id of KNOWN_GAMES) all.push(...(await readGame(id)));
  all.sort((a, b) => b.score - a.score);
  return NextResponse.json(all.slice(0, KEEP_TOP));
}

export async function POST(req: NextRequest) {
  let body: Partial<Entry>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const nickname = String(body.nickname ?? "").trim().slice(0, 20);
  const gameId = String(body.gameId ?? "");
  const score = Number(body.score);

  if (!nickname) return NextResponse.json({ error: "nickname required" }, { status: 400 });
  if (containsProfanity(nickname))
    return NextResponse.json({ error: "nickname rejected" }, { status: 400 });
  if (!KNOWN_GAMES.has(gameId))
    return NextResponse.json({ error: "unknown gameId" }, { status: 400 });
  if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE)
    return NextResponse.json({ error: "invalid score" }, { status: 400 });

  const k = key(gameId);

  // Dedupe by nickname: keep only the highest score per player per game.
  // Fetch all current members, find this player's existing entry, keep higher.
  const existing = await redis.zrange<string[]>(k, 0, -1, { withScores: false });
  let keepExistingHigher = false;
  if (existing) {
    for (const raw of existing) {
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (parsed?.nickname === nickname) {
          if (parsed.score >= score) {
            keepExistingHigher = true;
          } else {
            await redis.zrem(k, raw as string);
          }
          break;
        }
      } catch {}
    }
  }

  if (!keepExistingHigher) {
    const entry: Entry = { nickname, gameId, score, date: Date.now() };
    await redis.zadd(k, { score, member: JSON.stringify(entry) });
    // Trim to top KEEP_TOP by removing the lowest-ranked extras.
    await redis.zremrangebyrank(k, 0, -KEEP_TOP - 1);
  }

  return NextResponse.json({ ok: true });
}
