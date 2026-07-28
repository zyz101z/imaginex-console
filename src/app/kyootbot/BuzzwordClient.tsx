"use client";

import { useCallback, useEffect, useState } from "react";

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

export default function BuzzwordClient() {
  const [channel, setChannel] = useState("kyootbot");
  const [minutes, setMinutes] = useState(10);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async (ch: string, min: number) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/kyootbot?channel=${encodeURIComponent(ch)}&minutes=${min}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run("kyootbot", 10);
  }, [run]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Kick Chat Buzzword</h1>

        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(channel, minutes);
          }}
        >
          <label className="flex flex-col text-sm text-zinc-400">
            Channel
            <input
              className="mt-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            />
          </label>
          <label className="flex flex-col text-sm text-zinc-400">
            Minutes
            <input
              type="number"
              min={1}
              max={30}
              className="mt-1 w-24 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? "Scanning…" : "Scan"}
          </button>
        </form>

        {error && <p className="rounded-md bg-red-950 border border-red-800 p-3 text-red-300">{error}</p>}

        {result && !error && (
          <div className="space-y-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-sm text-zinc-400">
                {result.messageCount} messages in the last {result.minutes} min of{" "}
                <span className="text-zinc-200">{result.channel}</span>
              </p>
              {result.topWord ? (
                <p className="mt-2 text-3xl font-bold text-emerald-400">
                  “{result.topWord}”
                  <span className="ml-2 align-middle text-base font-normal text-zinc-400">
                    {result.topWordCount} messages · {result.users.length} users
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-zinc-400">No words found in that window.</p>
              )}
            </div>

            {result.users.length > 0 && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                  Users who said it
                </h2>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                  {result.users.map((u) => (
                    <li key={u} className="truncate">{u}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.runnersUp.length > 0 && (
              <p className="text-sm text-zinc-500">
                Runners-up: {result.runnersUp.map((r) => `${r.word} (${r.count})`).join(", ")}
              </p>
            )}
            <p className="text-xs text-zinc-600">Generated {new Date(result.generatedAt).toLocaleTimeString()}</p>
          </div>
        )}
      </div>
    </main>
  );
}
