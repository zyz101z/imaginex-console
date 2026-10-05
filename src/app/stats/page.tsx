"use client";
import { useEffect, useState } from "react";
import { games } from "@/lib/games";

type Stats = { total: Record<string, number>; days: { day: string; plays: Record<string, number> }[]; countries: Record<string, number>; places: Record<string, number>; gameCountry: Record<string, number>; generatedAt: number };

const fmtDay = (d: string) => `${d.slice(4, 6)}/${d.slice(6, 8)}`;

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/play", { cache: "no-store" })
      .then((r) => r.json())
      .then(setStats)
      .catch((e) => setErr(String(e)));
  }, []);

  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
  const name = (id: string) => games.find((g) => g.id === id)?.title ?? id;
  const ids = stats ? Object.keys(stats.total).sort((a, b) => stats.total[b] - stats.total[a]) : [];
  const last7 = stats ? stats.days.slice(0, 7).reduce((a, d) => a + sum(d.plays), 0) : 0;
  const last30 = stats ? stats.days.reduce((a, d) => a + sum(d.plays), 0) : 0;
  const maxDay = stats ? Math.max(1, ...stats.days.map((d) => sum(d.plays))) : 1;
  const flag = (cc: string) => (/^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "🌐");
  const regionName = (() => { try { return new Intl.DisplayNames(["en"], { type: "region" }); } catch { return null; } })();
  const cname = (cc: string) => { try { return (/^[A-Z]{2}$/.test(cc) && regionName?.of(cc)) || cc; } catch { return cc; } };
  const byDesc = (o: Record<string, number>) => Object.entries(o || {}).sort((a, b) => b[1] - a[1]);
  const topCountries = stats ? byDesc(stats.countries).slice(0, 15) : [];
  const topPlaces = stats ? byDesc(stats.places).slice(0, 20) : [];
  const countryIds = topCountries.map(([cc]) => cc).slice(0, 6);

  return (
    <main className="h-full overflow-auto bg-[#0b0f1a] text-gray-100 p-6 md:p-10 font-sans">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-1">ImagineX — plays</h1>
        <p className="text-gray-400 mb-6 text-sm">Counts one play each time a cartridge is inserted. Counting started 2026-10-05. Page views, visitors and referrers live in Vercel Analytics.</p>
        {err && <p className="text-red-400">Could not load stats: {err}</p>}
        {!stats && !err && <p className="text-gray-400">Loading…</p>}
        {stats && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[["Last 7 days", last7], ["Last 30 days", last30], ["All time", sum(stats.total)]].map(([k, v]) => (
                <div key={String(k)} className="rounded-xl bg-white/5 p-4">
                  <div className="text-3xl font-bold text-emerald-300">{v}</div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">{k}</div>
                </div>
              ))}
            </div>
            <h2 className="font-semibold mb-2">Plays per day (30 days)</h2>
            <div className="flex items-end gap-[3px] h-28 mb-8 bg-white/5 rounded-xl p-3">
              {[...stats.days].reverse().map((d) => {
                const n = sum(d.plays);
                return (
                  <div key={d.day} className="flex-1 flex flex-col justify-end items-center" title={`${fmtDay(d.day)}: ${n}`}>
                    <div className="w-full rounded-sm bg-emerald-400/80" style={{ height: `${(n / maxDay) * 100}%`, minHeight: n ? 2 : 0 }} />
                  </div>
                );
              })}
            </div>
            <h2 className="font-semibold mb-2">Where plays come from</h2>
            <p className="text-gray-400 text-xs mb-2">Country, region and city from the visitor&apos;s IP at the edge. Tracked from 2026-10-05.</p>
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Countries</div>
                {topCountries.length === 0 && <div className="text-gray-400 text-sm">No plays recorded yet.</div>}
                {topCountries.map(([cc, n]) => (
                  <div key={cc} className="flex justify-between py-1 border-t border-white/10 text-sm"><span>{flag(cc)} {cname(cc)}</span><b>{n}</b></div>
                ))}
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Cities</div>
                {topPlaces.length === 0 && <div className="text-gray-400 text-sm">No plays recorded yet.</div>}
                {topPlaces.map(([pl, n]) => { const [cc, reg, city] = pl.split("/"); return (
                  <div key={pl} className="flex justify-between py-1 border-t border-white/10 text-sm"><span>{flag(cc)} {[city, reg].filter(Boolean).join(", ") || cname(cc)}</span><b>{n}</b></div>
                ); })}
              </div>
            </div>
            <h2 className="font-semibold mb-2">By game</h2>
            <table className="w-full text-sm">
              <thead className="text-gray-400 text-left">
                <tr><th className="py-1">Game</th><th className="text-right">7 days</th><th className="text-right">30 days</th><th className="text-right">All time</th>{countryIds.map((cc) => <th key={cc} className="text-right" title={cname(cc)}>{flag(cc)}</th>)}</tr>
              </thead>
              <tbody>
                {ids.length === 0 && <tr><td colSpan={4 + countryIds.length} className="py-3 text-gray-400">No plays recorded yet.</td></tr>}
                {ids.map((id) => {
                  const d7 = stats.days.slice(0, 7).reduce((a, d) => a + (d.plays[id] || 0), 0);
                  const d30 = stats.days.reduce((a, d) => a + (d.plays[id] || 0), 0);
                  return (
                    <tr key={id} className="border-t border-white/10">
                      <td className="py-2">{name(id)}</td>
                      <td className="text-right">{d7}</td>
                      <td className="text-right">{d30}</td>
                      <td className="text-right font-semibold">{stats.total[id]}</td>
                      {countryIds.map((cc) => <td key={cc} className="text-right text-gray-300">{stats.gameCountry[`${id}|${cc}`] || 0}</td>)}
                    </tr>
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
