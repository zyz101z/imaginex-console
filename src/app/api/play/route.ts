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

const SRC_RE = /^[a-z0-9._:-]{1,48}$/;
const LANDING_RE = /^\/[\w\-/?=]{0,60}$/;

// POST { gameId, src? } — one increment per game launch (called by the console when a cartridge is inserted).
// POST { visit: { src, landing } } — one per tab session: where the visitor came from (see lib/arrival.ts).
export async function POST(req: NextRequest) {
  let body: { gameId?: string; src?: string; visit?: { src?: string; landing?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (body.visit) {
    const src = String(body.visit.src ?? "");
    const landing = String(body.visit.landing ?? "");
    if (!SRC_RE.test(src) || !LANDING_RE.test(landing)) return NextResponse.json({ error: "bad visit" }, { status: 400 });
    const d = day();
    const p = redis.pipeline();
    p.hincrby(`imaginex:visits:source`, src, 1);
    p.hincrby(`imaginex:visits:landing`, landing, 1);
    p.hincrby(`imaginex:visits:day:${d}`, src, 1);
    p.expire(`imaginex:visits:day:${d}`, 400 * 86400);
    await p.exec();
    return NextResponse.json({ ok: true });
  }
  const gameId = String(body.gameId ?? "");
  if (!IDS.has(gameId)) return NextResponse.json({ error: "unknown gameId" }, { status: 400 });
  const d = day();
  // Vercel stamps the visitor's geo on every request at the edge (no extra service needed).
  const country = (req.headers.get("x-vercel-ip-country") || "??").toUpperCase().slice(0, 2);
  const region = decodeURIComponent(req.headers.get("x-vercel-ip-country-region") || "").slice(0, 24);
  const city = decodeURIComponent(req.headers.get("x-vercel-ip-city") || "").slice(0, 32);
  const place = [country, region, city].filter(Boolean).join("/");
  const p = redis.pipeline();
  p.hincrby(`imaginex:plays:total`, gameId, 1);
  p.hincrby(`imaginex:plays:day:${d}`, gameId, 1);
  p.expire(`imaginex:plays:day:${d}`, 400 * 86400);
  p.hincrby(`imaginex:plays:country`, country, 1);
  p.hincrby(`imaginex:plays:place`, place, 1);
  p.hincrby(`imaginex:plays:gamecountry`, `${gameId}|${country}`, 1);
  const src = String(body.src ?? "");
  if (SRC_RE.test(src)) p.hincrby(`imaginex:plays:source`, `${src}|${gameId}`, 1);
  await p.exec();
  return NextResponse.json({ ok: true });
}

// GET — totals per game plus the last 30 days, per game per day. Public, read-only.
export async function GET() {
  const dayKeys = Array.from({ length: DAYS }, (_, i) => day(i));
  const p = redis.pipeline();
  p.hgetall(`imaginex:plays:total`);
  p.hgetall(`imaginex:plays:country`);
  p.hgetall(`imaginex:plays:place`);
  p.hgetall(`imaginex:plays:gamecountry`);
  p.hgetall(`imaginex:visits:source`);
  p.hgetall(`imaginex:visits:landing`);
  p.hgetall(`imaginex:plays:source`);
  for (const d of dayKeys) p.hgetall(`imaginex:plays:day:${d}`);
  for (const d of dayKeys) p.hgetall(`imaginex:visits:day:${d}`);
  const res = (await p.exec()) as (Record<string, string | number> | null)[];
  const num = (o: Record<string, string | number> | null) =>
    Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, Number(v)]));
  const total = num(res[0]);
  const countries = num(res[1]);
  const places = num(res[2]);
  const gameCountry = num(res[3]);
  const visitSources = num(res[4]);
  const landings = num(res[5]);
  const playSources = num(res[6]);
  const days = dayKeys.map((d, i) => ({ day: d, plays: num(res[i + 7]), visits: num(res[i + 7 + DAYS]) }));
  return NextResponse.json({ total, days, countries, places, gameCountry, visitSources, landings, playSources, generatedAt: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
