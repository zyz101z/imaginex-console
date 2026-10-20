// Where a visitor came from (search engine, Reddit, a shared link...) and which page they
// landed on. Captured once per browser tab session on the first page view, then attached
// to the play counter and the profile sync so /stats can show how players arrive.
// Only the referring site's NAME is kept, never the full referrer URL.

export type Arrival = { src: string; landing: string };

const KEY = "imaginex_arrival";

const NAMED: [RegExp, string][] = [
  [/(^|\.)google\./, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)yahoo\./, "yahoo"],
  [/(^|\.)reddit\.com$|^redd\.it$/, "reddit"],
  [/(^|\.)(twitter|x)\.com$|^t\.co$/, "x"],
  [/(^|\.)facebook\.com$|^fb\.me$/, "facebook"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "youtube"],
  [/(^|\.)discord(app)?\.com$/, "discord"],
  [/(^|\.)itch\.io$/, "itch.io"],
  [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$/, "chatgpt"],
];

export function classifySource(referrer: string, ownHost: string, utm: string | null): string | null {
  if (utm) return ("utm:" + utm.toLowerCase().replace(/[^a-z0-9._-]/g, "")).slice(0, 40);
  if (!referrer) return "direct";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "direct";
  }
  if (host === ownHost.toLowerCase().replace(/^www\./, "")) return null; // internal navigation
  for (const [re, name] of NAMED) if (re.test(host)) return name;
  return host.slice(0, 40);
}

export function getArrival(): Arrival | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Arrival) : null;
  } catch {
    return null;
  }
}

/** Records the arrival on the first page view of a tab session. Returns it only when newly captured. */
export function captureArrival(): Arrival | null {
  try {
    if (sessionStorage.getItem(KEY)) return null;
    const qs = new URLSearchParams(location.search);
    const src = classifySource(document.referrer, location.hostname, qs.get("utm_source")) ?? "internal";
    const play = qs.get("play");
    const landing = (location.pathname + (play ? `?play=${play}` : "")).replace(/[^\w\-/?=]/g, "").slice(0, 60);
    const a: Arrival = { src, landing };
    sessionStorage.setItem(KEY, JSON.stringify(a));
    return a;
  } catch {
    return null;
  }
}
