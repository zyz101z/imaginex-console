import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { games } from "@/lib/games";

export const runtime = "edge";

const redis = Redis.fromEnv();
const IDS = new Set(games.map((g) => g.id));
const DAYS = 30;

function day(offset = 0) {
  const d = new Date(Date.now() - offset * 86400000);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

// POST { gameId } — one increment per game launch (called by the console when a cartridge is inserted).
export async function POST(req: NextRequest) {
  let body: { gameId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const gameId = String(body.gameId ?? "");
  if (!IDS.has(gameId)) return NextResponse.json({ error: "unknown gameId" }, { status: 400 });
  const d = day();
  const p = redis.pipeline();
  p.hincrby(`imaginex:plays:total`, gameId, 1);
  p.hincrby(`imaginex:plays:day:${d}`, gameId, 1);
  p.expire(`imaginex:plays:day:${d}`, 400 * 86400);
  await p.exec();
  return NextResponse.json({ ok: true });
}

// GET — totals per game plus the last 30 days, per game per day. Public, read-only.
export async function GET() {
  const dayKeys = Array.from({ length: DAYS }, (_, i) => day(i));
  const p = redis.pipeline();
  p.hgetall(`imaginex:plays:total`);
  for (const d of dayKeys) p.hgetall(`imaginex:plays:day:${d}`);
  const res = (await p.exec()) as (Record<string, string | number> | null)[];
  const num = (o: Record<string, string | number> | null) =>
    Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, Number(v)]));
  const total = num(res[0]);
  const days = dayKeys.map((d, i) => ({ day: d, plays: num(res[i + 1]) }));
  return NextResponse.json({ total, days, generatedAt: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
