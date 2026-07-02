# TANK WARS — ONLINE MULTIPLAYER PLAN

_Created 2026-07-02. User greenlit; primary use case = dad & son on DIFFERENT networks
(son traveling), so internet play with 50-100ms RTT is the design target — which makes
CLIENT-SIDE PREDICTION (phase 3) mandatory, not optional._

## Architecture (decided)
- **WebRTC P2P DataChannel** between the two browsers. $0 infra; same-LAN play ~5ms,
  internet play direct peer-to-peer (usually beats a relay).
- **Signaling** through the existing Vercel + Upstash stack: `/api/rtc` edge route stores
  offer/answer blobs under a 4-char room code (TTL 5 min). **Non-trickle (vanilla) ICE** —
  wait for gathering to complete, exchange ONE offer and ONE answer. 2 messages total,
  no candidate streaming, dead simple.
- STUN: `stun:stun.l.google.com:19302`. No TURN in v1 (most home NATs fine; add a free-tier
  TURN later if some network combo fails).
- **Host-authoritative:** the room creator runs the real game engine (unchanged); the guest
  is a renderer + input-sender with a locally-predicted own-tank.

## Phases
1. ✅ **Connection (this phase):** ONLINE VS (BETA) menu → CREATE GAME CODE / JOIN.
   Full handshake → DataChannel open → live RTT readout on both ends (ping/pong 1/s).
   Ships as an honest "connection test" so the remote link can be validated this week.
   Signaling API: POST /api/rtc {action: host|join|answer|poll, code?, sdp?}.
2. **Playable sync (naive):** host streams full-state snapshots 20/s (tanks, shells,
   walls-diff, phase/banner); guest sends inputs 30/s; guest renders snapshots with
   ~100ms interpolation. Rounds/maze/power-ups all host-driven (maze sent as wall arrays
   at round start). Playable on LAN; guest's own tank will feel laggy over internet — known.
3. **Client-side prediction + reconciliation:** guest simulates own tank locally
   (instant feel), tags inputs with sequence numbers, host echoes last-processed seq +
   authoritative position, guest replays pending inputs on top; smooth small corrections.
   Local-predicted shell spawn on fire. THIS is what makes 50-100ms feel good.
4. **Polish/edges:** disconnect/rejoin flow, "opponent left" UX, RTT/quality indicator
   in-match, round-boundary resync, cross-device test protocol (dad+son), scrap award
   for online wins (+10/round +50 match, no campaign interaction).

## Netcode notes for phase 2/3
- Reuse the dormant seat-2 plumbing: guest = tanks[1] seat, host = tanks[0]; controlHuman
  scheme param already exists. Guest inputs = {seq, steer(angle|null), throttle, fire}.
- Channels: 'game' reliable-ordered for events (round start, maze, kills, chat later);
  add 'fast' unordered/maxRetransmits:0 for inputs+snapshots in phase 2.
- Snapshot size budget: 2 tanks (pos/angle/flags) + ≤20 shells (pos/vel) ≈ <1.5KB JSON;
  fine at 20/s. Binary later only if needed.
- Determinism NOT assumed anywhere — host state always wins.
- Latency math: shells cross a corridor in 300-700ms; opponent drawn 100ms in the past is
  imperceptible; own-tank prediction is the only critical path.

## Testing approach
- Signaling API: curl the live endpoint through the full host→join→answer→poll cycle.
- WebRTC glue: `?rtctest=1` in-page LOOPBACK (two RTCPeerConnections wired directly,
  mock signaling) → asserts DataChannel opens + ping round-trips; verifiable headlessly
  via --dump-dom.
- Final gate each phase: real two-device test (user + son remotely).
