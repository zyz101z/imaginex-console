import { NextRequest, NextResponse } from "next/server";
import initCycleTLS from "cycletls";

// Spawns the cycletls Go binary — must run on the Node runtime, not edge.
export const runtime = "nodejs";
export const maxDuration = 60;

const JA3 =
  "771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,45-13-43-0-16-65281-51-18-11-27-35-23-10-5-17513-21,29-23-24,0";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const MAX_MINUTES = 30;
const MAX_PAGES = 60;
const CACHE_TTL_MS = 30_000;

const STOPWORDS = new Set(
  (
    "the a an and or but if so of to in on at for with is are was were be been " +
    "it its this that these those i im me my you your u ur he she they them we us our his her " +
    "what who when where why how not no yes do does did done can cant cannot will would should could " +
    "just like get got go going gonna lol lmao omg wtf tbh has have had as from by too very really " +
    "up down out about all some any more most much than then there here now one two dont didnt isnt thats"
  ).split(/\s+/)
);

type KickMessage = {
  content: string;
  created_at: string;
  sender?: { username?: string };
};

type Result = {
  channel: string;
  minutes: number;
  messageCount: number;
  topWord: string | null;
  topWordCount: number;
  users: string[];
  runnersUp: { word: string; count: number }[];
  generatedAt: string;
};

// The cycletls child process survives across warm invocations — never .exit() it.
let cycleTLSPromise: ReturnType<typeof initCycleTLS> | null = null;
function getCycleTLS() {
  if (!cycleTLSPromise) cycleTLSPromise = initCycleTLS();
  return cycleTLSPromise;
}

async function kickGet(url: string): Promise<unknown> {
  // Vercel egress sometimes passes Kick's Cloudflare check with a plain fetch;
  // try that first and only fall back to the TLS-impersonating binary.
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store",
    });
    if (r.ok) return await r.json();
  } catch {
    /* fall through to cycletls */
  }
  const cycleTLS = await getCycleTLS();
  const r = await cycleTLS(url, { ja3: JA3, userAgent: UA, headers: { Accept: "application/json" } }, "get");
  if (r.status !== 200) throw new Error(`Kick returned HTTP ${r.status}`);
  return r.json();
}

function wordsOf(content: string): string[] {
  const text = content.replace(/\[emote:\d+:[^\]]*\]/g, " ").toLowerCase();
  return text.match(/[a-z0-9']{3,}/g) ?? [];
}

async function analyze(channel: string, minutes: number): Promise<Result> {
  const ch = (await kickGet(`https://kick.com/api/v2/channels/${channel}`)) as { id: number };
  const cutoff = Date.now() - minutes * 60 * 1000;

  const all: KickMessage[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url =
      `https://kick.com/api/v2/channels/${ch.id}/messages` + (cursor ? `?cursor=${cursor}` : "");
    const body = (await kickGet(url)) as { data?: { messages?: KickMessage[]; cursor?: string } };
    const msgs = body.data?.messages ?? [];
    if (msgs.length === 0) break;
    all.push(...msgs);
    const oldest = new Date(msgs[msgs.length - 1].created_at).getTime();
    cursor = body.data?.cursor ?? null;
    if (oldest < cutoff || !cursor) break;
  }

  const inWindow = all.filter((m) => new Date(m.created_at).getTime() >= cutoff);

  // Each word counts once per message so one pasted wall of the same word can't skew it.
  const counts = new Map<string, number>();
  for (const m of inWindow) {
    for (const w of new Set(wordsOf(m.content))) {
      if (!STOPWORDS.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  let topWord: string | null = null;
  let topWordCount = 0;
  const users = new Set<string>();
  if (ranked.length > 0) {
    [topWord, topWordCount] = ranked[0];
    for (const m of inWindow) {
      if (wordsOf(m.content).includes(topWord) && m.sender?.username) users.add(m.sender.username);
    }
  }

  return {
    channel,
    minutes,
    messageCount: inWindow.length,
    topWord,
    topWordCount,
    users: [...users].sort((a, b) => a.localeCompare(b)),
    runnersUp: ranked.slice(1, 6).map(([word, count]) => ({ word, count })),
    generatedAt: new Date().toISOString(),
  };
}

const cache = new Map<string, { at: number; result: Result }>();

export async function GET(req: NextRequest) {
  const channel = (req.nextUrl.searchParams.get("channel") ?? "kyootbot")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  const minutes = Math.min(
    MAX_MINUTES,
    Math.max(1, Number(req.nextUrl.searchParams.get("minutes")) || 10)
  );

  const cacheKey = `${channel}:${minutes}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.result, { headers: { "X-Cache": "hit" } });
  }

  try {
    const result = await analyze(channel, minutes);
    cache.set(cacheKey, { at: Date.now(), result });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch Kick chat" },
      { status: 502 }
    );
  }
}
