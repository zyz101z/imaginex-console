"use client";
import { useEffect, useState } from "react";
import { games } from "@/lib/games";

type Player = { pid: string; nickname: string; avatarColor: string; createdAt: number; firstSeen: number; lastSeen: number; country: string; place: string; games: Record<string, { playTime: number; lastPlayed: number }>; best: Record<string, number> };

const name = (id: string) => games.find((g) => g.id === id)?.title ?? id;
const flag = (cc: string) => (/^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "");
const fmtTime = (s: number) => (s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${(s / 3600).toFixed(1)}h`);
const ago = (t: number) => { if (!t) return "never"; const d = Date.now() - t; const h = d / 3600000; return h < 1 ? `${Math.max(1, Math.round(d / 60000))}m ago` : h < 48 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`; };

export default function PlayersPage() {
  const [data, setData] = useState<{ players: Player[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { fetch("/api/players", { cache: "no-store" }).then((r) => r.json()).then(setData).catch((e) => setErr(String(e))); }, []);
  const players = data?.players ?? [];
  const totalTime = (p: Player) => Object.values(p.games).reduce((a, g) => a + g.playTime, 0);
  const active7 = players.filter((p) => Date.now() - p.lastSeen < 7 * 86400000).length;

  return (
    <main className="h-full overflow-auto bg-[#0b0f1a] text-gray-100 p-6 md:p-10 font-sans">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-1">ImagineX — players</h1>
        <p className="text-gray-400 mb-6 text-sm">Everyone who made a profile and opened the site since 2026-10-05. Profiles are nicknames only. Players without a profile appear in <a className="underline" href="/stats">/stats</a> play counts but not here. Click a row for per-game detail.</p>
        {err && <p className="text-red-400">Could not load: {err}</p>}
        {!data && !err && <p className="text-gray-400">Loading…</p>}
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-8 max-w-md">
              <div className="rounded-xl bg-white/5 p-4"><div className="text-3xl font-bold text-emerald-300">{players.length}</div><div className="text-xs text-gray-400 uppercase tracking-wide">Profiles</div></div>
              <div className="rounded-xl bg-white/5 p-4"><div className="text-3xl font-bold text-emerald-300">{active7}</div><div className="text-xs text-gray-400 uppercase tracking-wide">Seen in last 7 days</div></div>
            </div>
            <table className="w-full text-sm">
              <thead className="text-gray-400 text-left"><tr><th className="py-1">Player</th><th>Where</th><th>Member since</th><th>Last seen</th><th className="text-right">Play time</th><th className="text-right">Games</th><th className="text-right">Boards</th></tr></thead>
              <tbody>
                {players.length === 0 && <tr><td colSpan={7} className="py-3 text-gray-400">No profiles synced yet. They appear the next time a player with a profile opens the site.</td></tr>}
                {players.map((p) => {
                  const isOpen = open === p.pid; const [, reg, city] = p.place.split("/");
                  return (
                    <>
                      <tr key={p.pid} className="border-t border-white/10 cursor-pointer hover:bg-white/5" onClick={() => setOpen(isOpen ? null : p.pid)}>
                        <td className="py-2 flex items-center gap-2"><span className="w-6 h-6 rounded-full inline-flex items-center justify-center text-black font-black text-xs" style={{ background: p.avatarColor }}>{p.nickname.charAt(0).toUpperCase()}</span>{p.nickname}</td>
                        <td>{flag(p.country)} {[city, reg].filter(Boolean).join(", ") || p.country || "—"}</td>
                        <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                        <td title={new Date(p.lastSeen).toLocaleString()}>{ago(p.lastSeen)}</td>
                        <td className="text-right">{fmtTime(totalTime(p))}</td>
                        <td className="text-right">{Object.keys(p.games).length}</td>
                        <td className="text-right">{Object.keys(p.best).length}</td>
                      </tr>
                      {isOpen && (
                        <tr key={p.pid + "-d"} className="bg-white/5"><td colSpan={7} className="p-3">
                          <div className="grid md:grid-cols-2 gap-x-8 gap-y-1 text-xs">
                            {Array.from(new Set([...Object.keys(p.games), ...Object.keys(p.best)])).map((id) => (
                              <div key={id} className="flex justify-between border-b border-white/10 py-1"><span>{name(id)}</span><span className="text-gray-300">{p.games[id] ? `${fmtTime(p.games[id].playTime)} · ${ago(p.games[id].lastPlayed)}` : "—"}{p.best[id] != null && <b className="ml-3 text-amber-300">best {p.best[id].toLocaleString()}</b>}</span></div>
                            ))}
                          </div>
                        </td></tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </main>
  );
}
