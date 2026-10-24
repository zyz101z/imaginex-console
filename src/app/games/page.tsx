// Server-rendered catalog: /games. The console home page is a client SPA whose
// first HTML is just the boot screen, so crawlers and AI assistants that read the
// site as text never saw the shelf. This page lists every launched game with real
// copy and links to its /play/<id> landing page. Linked from the boot screen,
// every /play page, and the sitemap.
import type { Metadata } from "next";
import Link from "next/link";
import { games } from "@/lib/games";
import { gameSeo } from "@/lib/gameSeo";

const catalog = gameSeo
  .map((seo) => ({ seo, game: games.find((g) => g.id === seo.id) }))
  .filter((x): x is { seo: (typeof gameSeo)[number]; game: (typeof games)[number] } => Boolean(x.game));

const titles = catalog.map((c) => c.game.title);

export const metadata: Metadata = {
  title: `All Free Browser Games on ImagineX — ${titles.length} Games, No Download`,
  description: `Every free game on ImagineX in one place: ${titles.join(", ")}. Play instantly in your browser — no download, no install, no account needed.`,
  alternates: { canonical: "https://www.imaginex.games/games" },
  openGraph: {
    type: "website",
    url: "https://www.imaginex.games/games",
    siteName: "ImagineX",
    title: `All Free Browser Games on ImagineX`,
    description: `${titles.length} free browser games: ${titles.join(", ")}.`,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "ImagineX — web gaming console" }],
  },
};

export default function GamesIndex() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Free browser games on ImagineX",
    numberOfItems: catalog.length,
    itemListElement: catalog.map(({ seo, game }, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://www.imaginex.games/play/${game.id}`,
      item: {
        "@type": "VideoGame",
        name: game.title,
        description: seo.metaDescription,
        genre: game.genre,
        image: `https://www.imaginex.games${game.cover}`,
        gamePlatform: "Web browser",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
    })),
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-gray-200">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-4xl mx-auto px-5 py-10">
        <Link href="/" className="text-sm text-gray-400 hover:text-white">← ImagineX — free browser games</Link>
        <h1 className="mt-6 text-4xl font-bold text-white">Every game on ImagineX</h1>
        <p className="mt-3 text-lg text-gray-400">
          {catalog.length} free games that play instantly in your browser — no download, no install, no account
          needed. Sports sims, strategy, idle tycoons, platformers, racing and party fighters, all made by one
          small studio.
        </p>

        <ul className="mt-10 space-y-8">
          {catalog.map(({ seo, game }) => (
            <li key={game.id} className="flex gap-5 items-start border-t border-gray-800 pt-8">
              <Link href={`/play/${game.id}`} className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={game.cover}
                  alt={`${game.title} cover art`}
                  loading="lazy"
                  className="w-28 sm:w-36 rounded-lg shadow-xl"
                  style={{ boxShadow: `0 8px 30px ${game.color}33` }}
                />
              </Link>
              <div className="min-w-0">
                <h2 className="text-2xl font-bold">
                  <Link href={`/play/${game.id}`} style={{ color: game.color }} className="hover:underline">
                    {game.title}
                  </Link>
                </h2>
                <p className="text-sm text-gray-500">{game.genre} · Free · Browser</p>
                <p className="mt-1 italic text-gray-400">{seo.tagline}</p>
                <p className="mt-2 leading-relaxed text-gray-300">{game.description}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  <Link
                    href={`/?play=${game.id}`}
                    className="px-4 py-1.5 rounded-lg font-bold text-black"
                    style={{ background: game.color }}
                  >
                    ▶ Play free
                  </Link>
                  <Link href={`/play/${game.id}`} className="px-4 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:text-white">
                    About {game.title}
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-12 border-t border-gray-800 pt-8 text-sm text-gray-500">
          ImagineX is a free web gaming console. Saves live in your browser, leaderboards are shared, and new games
          land regularly.
        </p>
      </div>
    </div>
  );
}
