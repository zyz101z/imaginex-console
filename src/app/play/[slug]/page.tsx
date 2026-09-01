// Server-rendered SEO landing pages: /play/<game-id>. The console itself is a
// client SPA (one crawlable URL), so these pages are what search engines index —
// one per launched game, with real copy, structured data, and a Play button that
// deep-links into the console (/?play=<id>). Invisible to normal site visitors.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { games } from "@/lib/games";
import { gameSeo, gameSeoById } from "@/lib/gameSeo";

export function generateStaticParams() {
  // gameSeo (not games.ts) is the source of truth: only launched, public games
  return gameSeo.map((g) => ({ slug: g.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const seo = gameSeoById(slug);
  const game = games.find((g) => g.id === slug);
  if (!seo || !game) return {};
  return {
    title: seo.seoTitle,
    description: seo.metaDescription,
    keywords: seo.keywords,
    alternates: { canonical: `https://www.imaginex.games/play/${slug}` },
    openGraph: {
      type: "website",
      url: `https://www.imaginex.games/play/${slug}`,
      siteName: "ImagineX",
      title: seo.seoTitle,
      description: seo.metaDescription,
      images: [{ url: game.cover, width: 401, height: 660, alt: `${game.title} cover art` }],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.seoTitle,
      description: seo.metaDescription,
      images: [game.cover],
    },
  };
}

export default async function PlayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const seo = gameSeoById(slug);
  const game = games.find((g) => g.id === slug);
  if (!seo || !game) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.title,
    description: seo.metaDescription,
    url: `https://www.imaginex.games/play/${slug}`,
    image: `https://www.imaginex.games${game.cover}`,
    genre: game.genre,
    gamePlatform: "Web browser",
    applicationCategory: "Game",
    playMode: "SinglePlayer",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@type": "Organization", name: "ImagineX", url: "https://www.imaginex.games" },
  };

  const others = gameSeo.filter((g) => g.id !== slug).slice(0, 6);

  return (
    <div className="min-h-screen bg-[#0b0e14] text-gray-200">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-3xl mx-auto px-5 py-10">
        <Link href="/" className="text-sm text-gray-400 hover:text-white">← ImagineX — free browser games</Link>

        <div className="mt-6 flex flex-col sm:flex-row gap-8 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={game.cover}
            alt={`${game.title} cover art`}
            className="w-48 rounded-xl shadow-2xl shrink-0"
            style={{ boxShadow: `0 10px 40px ${game.color}33` }}
          />
          <div>
            <h1 className="text-4xl font-bold" style={{ color: game.color }}>{game.title}</h1>
            <p className="mt-1 text-lg text-gray-400 italic">{seo.tagline}</p>
            <p className="mt-2 text-sm text-gray-500">{game.genre} · Free · Plays in your browser — no download, no install</p>
            <Link
              href={`/?play=${game.id}`}
              className="inline-block mt-5 px-8 py-3 rounded-xl font-bold text-black text-lg transition-transform hover:scale-105"
              style={{ background: game.color }}
            >
              ▶ PLAY FREE NOW
            </Link>
          </div>
        </div>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-white">About {game.title}</h2>
          {seo.about.map((p, i) => (
            <p key={i} className="mt-4 leading-relaxed text-gray-300">{p}</p>
          ))}
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-white">Features</h2>
          <ul className="mt-4 space-y-2">
            {seo.features.map((f, i) => (
              <li key={i} className="flex gap-2 text-gray-300"><span style={{ color: game.color }}>◆</span>{f}</li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-white">How to play</h2>
          <ol className="mt-4 space-y-2 list-decimal list-inside text-gray-300">
            {seo.howToPlay.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <Link
            href={`/?play=${game.id}`}
            className="inline-block mt-6 px-6 py-2.5 rounded-lg font-bold text-black"
            style={{ background: game.color }}
          >
            ▶ Play {game.title} free
          </Link>
        </section>

        <section className="mt-12 border-t border-gray-800 pt-8">
          <h2 className="text-xl font-bold text-white">More free games on ImagineX</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {others.map((o) => {
              const og = games.find((g) => g.id === o.id);
              return (
                <Link key={o.id} href={`/play/${o.id}`}
                  className="px-4 py-2 rounded-lg bg-gray-800/60 hover:bg-gray-700 text-sm font-semibold"
                  style={{ color: og?.color || "#fff" }}>
                  {og?.title || o.id}
                </Link>
              );
            })}
          </div>
          <p className="mt-6 text-sm text-gray-500">
            ImagineX is a free web gaming console — every game plays instantly in your browser with
            no downloads, no ads between you and the fun, and leaderboards to fight over.
          </p>
        </section>
      </div>
    </div>
  );
}
