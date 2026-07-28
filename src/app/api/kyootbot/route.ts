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
    "up down out about all some any more most much than then there here now one two dont didnt isnt thats " +
    // Channel-specific noise: chat says "kyoot" constantly, so it never makes
    // an interesting top word. An explicit ?word=kyoot still bypasses this.
    "kyoot"
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
  topWordVariants: string[];
  topWordCount: number;
  users: string[];
  runnersUp: { word: string; count: number }[];
  generatedAt: string;
};

// Edit distance capped at `max` — bails early once the distance can't stay under it.
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

// Group near-identical spellings (ukulele/ukelele/ukalele, plurals) into one
// bucket. Short words merge only exactly — "code"/"core" must stay separate.
function sameWordish(a: string, b: string): boolean {
  const len = Math.min(a.length, b.length);
  if (len < 5) return false;
  // Distinct words one substitution apart (words/cords) almost never share a
  // prefix, while typo/spelling variants nearly always do.
  if (a.slice(0, 2) !== b.slice(0, 2)) return false;
  const max = len >= 8 ? 2 : 1;
  if (a.length === b.length) {
    // Same-length: only vowel↔vowel swaps count as spelling variants
    // (ukulele/ukelele yes, stake/stare no).
    let diffs = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        if (!VOWELS.has(a[i]) || !VOWELS.has(b[i])) return false;
        if (++diffs > max) return false;
      }
    }
    return diffs > 0;
  }
  return editDistance(a, b, max) <= max;
}

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

async function analyze(channel: string, minutes: number, target: string | null): Promise<Result> {
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
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  // Stopwords only shape the automatic pick — an explicit target bypasses them.
  const ranked = [...counts.entries()]
    .filter(([w]) => !STOPWORDS.has(w))
    .sort((a, b) => b[1] - a[1]);

  // Greedy clustering: walk words highest-count first, folding each into the
  // first cluster whose representative it's a near-spelling of.
  type Cluster = { rep: string; words: string[]; count: number };
  const clusters: Cluster[] = [];
  for (const [w, c] of ranked) {
    const cl = clusters.find((cl) => sameWordish(cl.rep, w));
    if (cl) {
      cl.words.push(w);
      cl.count += c;
    } else {
      clusters.push({ rep: w, words: [w], count: c });
    }
  }
  clusters.sort((a, b) => b.count - a.count);

  let topWord: string | null = null;
  let topWordVariants: string[] = [];
  let topWordCount = 0;
  const users = new Set<string>();
  let variantSet = new Set<string>();

  if (target) {
    // Caller picked the word: gather its near-spellings from everything seen.
    topWord = target;
    topWordVariants = [...counts.keys()].filter((w) => w === target || sameWordish(target, w));
    if (!topWordVariants.includes(target)) topWordVariants.unshift(target);
    variantSet = new Set(topWordVariants);
  } else if (clusters.length > 0) {
    topWord = clusters[0].rep;
    topWordVariants = clusters[0].words;
    variantSet = new Set(topWordVariants);
  }

  if (topWord) {
    // Recount properly: a message with two variants should count once.
    for (const m of inWindow) {
      if (wordsOf(m.content).some((w) => variantSet.has(w))) {
        topWordCount++;
        if (m.sender?.username) users.add(m.sender.username);
      }
    }
  }

  return {
    channel,
    minutes,
    messageCount: inWindow.length,
    topWord,
    topWordVariants,
    topWordCount,
    users: [...users].sort((a, b) => a.localeCompare(b)),
    runnersUp: clusters
      .filter((cl) => !cl.words.some((w) => variantSet.has(w)))
      .slice(0, 5)
      .map((cl) => ({ word: cl.words.join("/"), count: cl.count })),
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
  const word =
    (req.nextUrl.searchParams.get("word") ?? "").toLowerCase().replace(/[^a-z0-9']/g, "") || null;

  const cacheKey = `${channel}:${minutes}:${word ?? ""}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.result, { headers: { "X-Cache": "hit" } });
  }

  try {
    const result = await analyze(channel, minutes, word);
    cache.set(cacheKey, { at: Date.now(), result });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch Kick chat" },
      { status: 502 }
    );
  }
}
