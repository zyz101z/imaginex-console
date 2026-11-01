// Admin gate for the private dashboards. /players and /stats (and their read APIs) list
// player nicknames with city-level location — owner-only. The token lives in Redis
// (imaginex:admin:token, set once out of band); no env var needed. First visit with
// ?key=<token> sets a year-long httpOnly cookie and redirects to the clean URL. Writes
// (POST /api/players profile sync, POST /api/play counters) are NOT gated.
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const config = { matcher: ["/players", "/stats", "/api/players", "/api/play"] };

const COOKIE = "ix_admin";
const KEY = "imaginex:admin:token";
let cached: { at: number; token: string | null } | null = null;

async function adminToken(): Promise<string | null> {
  if (cached && Date.now() - cached.at < 60_000) return cached.token;
  let token: string | null = null;
  try {
    const v = await Redis.fromEnv({ automaticDeserialization: false }).get<string>(KEY);
    token = typeof v === "string" && v.length >= 20 ? v : null;
  } catch {}
  cached = { at: Date.now(), token };
  return token;
}

function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function middleware(req: NextRequest) {
  if (req.method !== "GET" && req.method !== "HEAD") return NextResponse.next();
  const token = await adminToken();
  const isApi = req.nextUrl.pathname.startsWith("/api/");
  const deny = () =>
    isApi
      ? NextResponse.json({ error: "not found" }, { status: 404 })
      : NextResponse.rewrite(new URL("/__not_found__", req.url), { status: 404 });
  if (!token) return deny();   // no token provisioned → nothing is reachable
  const key = req.nextUrl.searchParams.get("key");
  if (key && same(key, token)) {
    const clean = req.nextUrl.clone();
    clean.searchParams.delete("key");
    const res = NextResponse.redirect(clean);
    res.cookies.set(COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 365 * 86400 });
    return res;
  }
  const c = req.cookies.get(COOKIE)?.value;
  if (c && same(c, token)) return NextResponse.next();
  return deny();
}
