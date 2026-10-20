"use client";
import { useEffect } from "react";
import { captureArrival } from "@/lib/arrival";

// One "visit" ping per tab session, recording where the visitor came from (see lib/arrival.ts).
// Skipped on the unlisted admin pages so checking the stats doesn't count as a visit.
export default function ArrivalTracker() {
  useEffect(() => {
    if (/^\/(stats|players)(\/|$)/.test(location.pathname)) return;
    const a = captureArrival();
    if (!a) return;
    try {
      void fetch("/api/play", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visit: a }), keepalive: true }).catch(() => {});
    } catch {}
  }, []);
  return null;
}
