// WebRTC signaling broker for Tank Wars online multiplayer (Phase 1).
// Non-trickle ICE: each side sends ONE sdp blob. Rooms are 4-char codes with a 5-min TTL.
//   POST {action:"host",   sdp}        -> {code}          (stores the offer)
//   POST {action:"join",   code}       -> {sdp}           (fetches the offer)
//   POST {action:"answer", code, sdp}  -> {ok}            (stores the answer)
//   POST {action:"poll",   code}       -> {sdp|null}      (host polls for the answer)
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

export const runtime = "edge";

// automaticDeserialization MUST be off: SDP blobs are valid JSON strings, and the
// default auto-parse turned them into objects on read → the game's JSON.parse choked
// on "[object Object]" (found in the first real two-browser test).
const redis = Redis.fromEnv({ automaticDeserialization: false });
const TTL = 300; // seconds — rooms are ephemeral handshake state, not lobbies
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L confusables
const MAX_SDP = 25_000;

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request) {
  let body: { action?: string; code?: string; sdp?: string };
  try {
    body = await req.json();
  } catch {
    return bad("bad json");
  }
  const action = body?.action;
  const sdp =
    typeof body?.sdp === "string" && body.sdp.length > 0 && body.sdp.length <= MAX_SDP
      ? body.sdp
      : null;
  const code =
    typeof body?.code === "string" && /^[A-Z2-9]{4}$/.test(body.code) ? body.code : null;

  if (action === "host") {
    if (!sdp) return bad("missing sdp");
    for (let i = 0; i < 6; i++) {
      let c = "";
      for (let j = 0; j < 4; j++)
        c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      const ok = await redis.set(`rtc:${c}:offer`, sdp, { nx: true, ex: TTL });
      if (ok) return NextResponse.json({ code: c });
    }
    return bad("could not allocate a room code", 503);
  }
  if (action === "join") {
    if (!code) return bad("bad code");
    const offer = await redis.get<string>(`rtc:${code}:offer`);
    if (!offer) return bad("not_found", 404);
    return NextResponse.json({ sdp: offer });
  }
  if (action === "answer") {
    if (!code || !sdp) return bad("bad request");
    await redis.set(`rtc:${code}:answer`, sdp, { ex: TTL });
    return NextResponse.json({ ok: true });
  }
  if (action === "poll") {
    if (!code) return bad("bad code");
    const ans = await redis.get<string>(`rtc:${code}:answer`);
    return NextResponse.json({ sdp: ans ?? null });
  }
  return bad("unknown action");
}
