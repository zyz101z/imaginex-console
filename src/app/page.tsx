"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { games, Game } from "@/lib/games";
import {
  getProfile,
  saveProfile,
  PlayerProfile,
  updatePlayTime,
  getStats,
  getLeaderboard,
  addLeaderboardEntry,
} from "@/lib/storage";
import { containsProfanity } from "@/lib/profanity";

// --- Icons (inline SVGs) ---
function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function IconGames({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <line x1="6" y1="12" x2="6" y2="12.01" />
      <line x1="10" y1="12" x2="10" y2="12.01" />
      <path d="M15 9.4V14" />
      <path d="M17.5 11.5H12.5" />
    </svg>
  );
}
function IconProfile({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconTrophy({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
function IconBack({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function IconPlay({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}
function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// --- Helpers ---
function formatPlayTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// --- Boot Screen ---
function BootScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 bg-[#050510] flex flex-col items-center justify-center z-50 cursor-pointer"
      onClick={onDone}
    >
      <div className="boot-logo flex flex-col items-center gap-6">
        <img
          src="/Imaginex.png"
          alt="ImagineX"
          className="w-64 h-auto opacity-90"
        />
        <h1 className="text-4xl font-bold tracking-wider glow-text text-[var(--accent)]">
          imagineX
        </h1>
      </div>
      <div className="mt-12 boot-line h-[2px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent max-w-xs mx-auto" />
      <p className="mt-8 text-sm text-gray-500 animate-pulse">
        Press anywhere to continue
      </p>
    </div>
  );
}

// --- Profile Setup Modal ---
function ProfileSetup({ onSave }: { onSave: (profile: PlayerProfile) => void }) {
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const colors = ["#4fc3f7", "#f44336", "#66bb6a", "#ffa726", "#ab47bc", "#26c6da", "#ef5350", "#8d6e63"];
  const [selectedColor, setSelectedColor] = useState(colors[0]);

  const handleSubmit = () => {
    const name = nickname.trim();
    if (!name) return;
    if (containsProfanity(name)) {
      setError("That name isn't allowed. Please choose another.");
      return;
    }
    onSave({ nickname: name, avatarColor: selectedColor, createdAt: Date.now() });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-40 fade-in">
      <div className="bg-[var(--card-bg)] border border-[var(--accent)]/30 rounded-2xl p-8 max-w-md w-full mx-4 slide-up">
        <h2 className="text-2xl font-bold mb-2 glow-text text-[var(--accent)]">
          Welcome to ImagineX
        </h2>
        <p className="text-gray-400 mb-6 text-sm">Create your player profile</p>

        <label className="block text-sm text-gray-300 mb-2">Nickname</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => { setNickname(e.target.value.slice(0, 20)); setError(""); }}
          placeholder="Enter your name..."
          className={`w-full bg-[var(--background)] border rounded-lg px-4 py-3 text-white focus:outline-none transition ${error ? "border-red-500" : "border-gray-700 focus:border-[var(--accent)]"} mb-1`}
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
        />
        {error && <p className="text-red-400 text-xs mb-4">{error}</p>}
        {!error && <div className="mb-5" />}

        <label className="block text-sm text-gray-300 mb-3">Avatar Color</label>
        <div className="flex gap-3 mb-8">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedColor(c)}
              className={`w-10 h-10 rounded-full transition-transform ${selectedColor === c ? "scale-125 ring-2 ring-white ring-offset-2 ring-offset-[var(--card-bg)]" : "hover:scale-110"}`}
              style={{ background: c }}
            />
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!nickname.trim()}
          className="w-full py-3 rounded-xl font-bold text-black bg-[var(--accent)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Start Playing
        </button>
      </div>
    </div>
  );
}

// --- Cartridge with Cover Art ---
function Cartridge({ game, onClick }: { game: Game; onClick: () => void }) {
  return (
    <div
      className="cartridge shrink-0"
      style={{
        background: `linear-gradient(180deg, ${game.cartridgeColor}, ${game.cartridgeColor}dd)`,
        ["--cart-glow" as string]: `${game.color}60`,
      } as React.CSSProperties}
      onClick={game.status === "available" ? onClick : undefined}
    >
      {/* Label with cover art */}
      <div className="cartridge-label overflow-hidden" style={{ background: game.cartridgeLabelColor }}>
        <img
          src={game.cover}
          alt={game.title}
          className="w-full h-full object-cover"
          draggable={false}
        />
        {game.status === "coming_soon" && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-[8px] font-bold bg-black/60 text-white/80 px-2 py-1 rounded-full">
              Coming Soon
            </span>
          </div>
        )}
      </div>
      {/* Connector pins */}
      <div className="cartridge-pins">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="cartridge-pin" />
        ))}
      </div>
    </div>
  );
}

// --- Game Detail with Cartridge Insert ---
function GameDetail({
  game,
  onPlay,
  onBack,
}: {
  game: Game;
  onPlay: () => void;
  onBack: () => void;
}) {
  const [save, setSave] = useState<{ totalPlayTime: number } | null>(null);
  // Phases: idle -> lifting -> dropping -> seated -> glowing -> launching
  const [phase, setPhase] = useState<"idle" | "lifting" | "dropping" | "seated" | "glowing" | "launching">("idle");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`imaginex_save_${game.id}`);
      if (raw) setSave(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [game.id]);

  const playInsertSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const now = ctx.currentTime;

      // Mechanical slide sound (filtered noise burst)
      const noiseLen = 0.15;
      const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate);
      const noiseData = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseData.length; i++) noiseData[i] = (Math.random() * 2 - 1) * 0.3;
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.setValueAtTime(800, now);
      noiseFilter.frequency.linearRampToValueAtTime(200, now + noiseLen);
      noiseFilter.Q.value = 2;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.4, now);
      noiseGain.gain.linearRampToValueAtTime(0, now + noiseLen);
      noiseSrc.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);
      noiseSrc.start(now + 0.4);

      // Click/snap when cartridge seats
      const clickOsc = ctx.createOscillator();
      clickOsc.type = "square";
      clickOsc.frequency.setValueAtTime(150, now + 0.55);
      clickOsc.frequency.exponentialRampToValueAtTime(40, now + 0.62);
      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(0.5, now + 0.55);
      clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
      clickOsc.connect(clickGain).connect(ctx.destination);
      clickOsc.start(now + 0.55);
      clickOsc.stop(now + 0.65);

      // Power-on chime (ascending tones)
      [440, 554, 659].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        const t = now + 1.1 + i * 0.12;
        osc.frequency.setValueAtTime(freq, t);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.2, t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.connect(g).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
      });

      // Cleanup
      setTimeout(() => ctx.close(), 3000);
    } catch { /* audio not available */ }
  }, []);

  const handleInsert = () => {
    if (phase !== "idle") return;
    playInsertSound();
    setPhase("lifting");
    setTimeout(() => setPhase("dropping"), 400);
    setTimeout(() => setPhase("seated"), 900);
    setTimeout(() => setPhase("glowing"), 1100);
    setTimeout(() => setPhase("launching"), 2200);
    setTimeout(() => onPlay(), 2800);
  };

  useEffect(() => {
    setPhase("idle");
  }, [game.id]);

  return (
    <div className="fade-in h-full overflow-y-auto p-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition mb-6"
      >
        <IconBack /> Back to Library
      </button>

      <div className="max-w-3xl mx-auto">
        {/* Console + Cartridge area */}
        <div className="flex flex-col items-center mb-10">
          {/* Wrapper: console with cartridge layered on top */}
          <div className="relative inline-block" style={{ paddingTop: "160px" }}>

            {/* Cartridge - positioned above the console slot */}
            <div
              className="absolute left-1/2 z-20"
              style={{
                transform: "translateX(-50%)",
                top: "10px",
                transition: phase === "idle" ? "none" : undefined,
              }}
            >
              <div
                className={`cart-phase-${phase}`}
                style={{ filter: phase === "launching" ? `drop-shadow(0 0 20px ${game.color})` : undefined }}
              >
                <div
                  className={`cartridge w-[100px] h-[140px] mx-auto ${phase === "idle" ? "cursor-pointer hover:scale-105" : ""} transition-transform`}
                  style={{
                    background: `linear-gradient(180deg, ${game.cartridgeColor}, ${game.cartridgeColor}dd)`,
                    ["--cart-glow" as string]: `${game.color}60`,
                  } as React.CSSProperties}
                  onClick={handleInsert}
                >
                  <div className="cartridge-label overflow-hidden" style={{ background: game.cartridgeLabelColor }}>
                    <img
                      src={game.cover}
                      alt={game.title}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  </div>
                  <div className="cartridge-pins">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="cartridge-pin" />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Console image - z-index layers the top of console over the cartridge bottom */}
            <div className={`relative z-10 ${phase === "seated" ? "console-bump" : ""} ${phase === "glowing" || phase === "launching" ? "console-activated" : ""}`}>
              {/* Top portion of console overlaps cartridge for "inserting behind" effect */}
              <img
                src="/Imaginex.png"
                alt="ImagineX Console"
                className="w-[420px] h-auto drop-shadow-2xl"
                draggable={false}
              />

              {/* LED flash on insert */}
              {(phase === "glowing" || phase === "launching") && (
                <div className="absolute pointer-events-none led-flash-bar"
                  style={{ top: "42%", left: "8%", right: "8%", height: "3px" }}
                />
              )}

              {/* Screen glow when launching */}
              {phase === "launching" && (
                <div className="absolute inset-0 pointer-events-none screen-glow" style={{
                  background: `radial-gradient(ellipse at 50% 30%, ${game.color}30, transparent 60%)`,
                }} />
              )}

              {/* Pulsing slot indicator when idle */}
              {phase === "idle" && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 slot-waiting rounded"
                  style={{ top: "8%", width: "28%", height: "14%" }}
                />
              )}
            </div>
          </div>

          {/* Status text */}
          <div className="mt-6 h-6">
            {phase === "idle" && (
              <p className="text-sm text-gray-400 animate-pulse">
                Click the cartridge to insert
              </p>
            )}
            {(phase === "lifting" || phase === "dropping") && (
              <p className="text-sm text-[var(--accent)]">
                Inserting...
              </p>
            )}
            {(phase === "seated" || phase === "glowing") && (
              <p className="text-sm text-[var(--accent)] font-bold cart-text-pulse">
                Cartridge detected!
              </p>
            )}
            {phase === "launching" && (
              <p className="text-sm text-green-400 font-bold cart-text-pulse">
                Launching {game.title}...
              </p>
            )}
          </div>
        </div>

        {/* Game info */}
        <div className="flex items-center gap-6 mb-4">
          <h2 className="text-2xl font-bold" style={{ color: game.color }}>{game.title}</h2>
          <span className="text-sm text-gray-400 bg-gray-800 px-3 py-1 rounded-full">
            {game.genre}
          </span>
          {save && save.totalPlayTime > 0 && (
            <span className="text-sm text-gray-400 flex items-center gap-1">
              <IconClock /> {formatPlayTime(save.totalPlayTime)} played
            </span>
          )}
        </div>

        <p className="text-gray-400 mb-6">{game.description}</p>

        {/* Manual play button as fallback */}
        {phase === "idle" && (
          <button
            onClick={handleInsert}
            className="flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-black transition hover:brightness-110"
            style={{ background: game.color }}
          >
            <IconPlay />
            Insert & Play
          </button>
        )}
      </div>
    </div>
  );
}

// --- Game Player (iframe) ---
function GamePlayer({
  game,
  onExit,
}: {
  game: Game;
  onExit: () => void;
}) {
  const startTimeRef = useRef(Date.now());
  const [showExit, setShowExit] = useState(false);

  useEffect(() => {
    startTimeRef.current = Date.now();
    return () => {
      const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      if (seconds > 0) {
        updatePlayTime(game.id, seconds);
      }
    };
  }, [game.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowExit((prev) => !prev);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data && e.data.type === "imaginex-score") {
        const profile = getProfile();
        addLeaderboardEntry({
          nickname: profile?.nickname || e.data.nickname || "Player",
          gameId: e.data.gameId,
          score: e.data.score,
          date: Date.now(),
        });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div
        className={`absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/90 to-transparent transition-opacity duration-300 ${showExit ? "opacity-100" : "opacity-0 hover:opacity-100"}`}
        onMouseEnter={() => setShowExit(true)}
        onMouseLeave={() => setShowExit(false)}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onExit}
              className="flex items-center gap-2 bg-gray-800/80 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition"
            >
              <IconBack /> Exit Game
            </button>
            <span className="text-gray-400 text-sm">{game.title}</span>
          </div>
          <span className="text-gray-500 text-xs">Press ESC to toggle menu</span>
        </div>
        <div className="glow-line" />
      </div>
      <iframe
        ref={(el) => { if (el) setTimeout(() => el.focus(), 100); }}
        src={game.url}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-popups"
        allow="autoplay; fullscreen"
        title={game.title}
        tabIndex={0}
        onLoad={(e) => {
          const iframe = e.target as HTMLIFrameElement;
          iframe.focus();
          try { iframe.contentWindow?.focus(); } catch(_) {}
        }}
      />
    </div>
  );
}

// --- Leaderboard View ---
const GAME_SCORE_LABELS: Record<string, string> = {
  bloot: "Wins",
  "tennis-world": "REP",
};

function LeaderboardView() {
  const [activeTab, setActiveTab] = useState<string>("bloot");
  const [entries, setEntries] = useState<ReturnType<typeof getLeaderboard>>([]);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);

  useEffect(() => {
    setEntries(getLeaderboard(activeTab));
    setProfile(getProfile());
  }, [activeTab]);

  const scoreLabel = GAME_SCORE_LABELS[activeTab] || "Score";
  const gameTitle = games.find((g) => g.id === activeTab)?.title || activeTab;

  return (
    <div className="fade-in h-full overflow-y-auto p-6">
      <h2 className="text-2xl font-bold mb-6 glow-text text-[var(--accent)]">
        Leaderboard
      </h2>

      {/* Game tabs */}
      <div className="flex gap-2 mb-6">
        {games.filter((g) => g.status === "available").map((g) => (
          <button
            key={g.id}
            onClick={() => setActiveTab(g.id)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === g.id ? "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30" : "bg-gray-800/40 text-gray-400 hover:text-gray-200"}`}
          >
            {g.title}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">No {gameTitle} scores yet!</p>
          <p className="text-gray-600 text-sm mt-2">Play {gameTitle} to see {scoreLabel.toLowerCase()} here.</p>
        </div>
      ) : (
        <div className="max-w-2xl">
          <div className="grid grid-cols-[40px_1fr_100px] gap-2 text-sm text-gray-500 mb-3 px-4">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">{scoreLabel}</span>
          </div>
          {entries.slice(0, 50).map((entry, i) => (
            <div
              key={i}
              className={`grid grid-cols-[40px_1fr_100px] gap-2 items-center px-4 py-3 rounded-lg mb-1 ${entry.nickname === profile?.nickname ? "bg-[var(--accent)]/10 border border-[var(--accent)]/20" : "bg-gray-800/30"}`}
            >
              <span className={`font-bold ${i < 3 ? "text-[var(--accent)]" : "text-gray-500"}`}>
                {i + 1}
              </span>
              <span className="font-medium">{entry.nickname}</span>
              <span className="text-right font-mono font-bold">{entry.score.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Profile View ---
function ProfileView({ profile }: { profile: PlayerProfile }) {
  const [stats, setStats] = useState({ totalPlayTime: 0, gamesPlayed: 0, leaderboardEntries: 0, lastPlayed: 0 });

  useEffect(() => {
    const s = getStats();
    setStats(s);
  }, []);

  return (
    <div className="fade-in h-full overflow-y-auto p-6">
      <h2 className="text-2xl font-bold mb-8 glow-text text-[var(--accent)]">Profile</h2>

      <div className="flex items-center gap-6 mb-10">
        <div
          className="w-20 h-20 rounded-full avatar-ring flex items-center justify-center text-3xl font-black text-black"
          style={{ background: profile.avatarColor }}
        >
          {profile.nickname.charAt(0).toUpperCase()}
        </div>
        <div>
          <h3 className="text-2xl font-bold">{profile.nickname}</h3>
          <p className="text-gray-400 text-sm">
            Member since {new Date(profile.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl">
        <div className="stat-card">
          <p className="text-gray-400 text-xs mb-1">Total Play Time</p>
          <p className="text-xl font-bold text-[var(--accent)]">
            {formatPlayTime(stats.totalPlayTime)}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-gray-400 text-xs mb-1">Games Played</p>
          <p className="text-xl font-bold text-[var(--accent)]">
            {stats.gamesPlayed}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-gray-400 text-xs mb-1">Leaderboard Entries</p>
          <p className="text-xl font-bold text-[var(--accent)]">
            {stats.leaderboardEntries}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-gray-400 text-xs mb-1">Last Played</p>
          <p className="text-xl font-bold text-[var(--accent)]">
            {stats.lastPlayed ? new Date(stats.lastPlayed).toLocaleDateString() : "Never"}
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Home View ---
function HomeView({
  profile,
  onSelectGame,
}: {
  profile: PlayerProfile;
  onSelectGame: (game: Game) => void;
}) {
  const availableGames = games.filter((g) => g.status === "available");
  const comingSoon = games.filter((g) => g.status === "coming_soon");

  return (
    <div className="fade-in h-full overflow-y-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-1">
          Welcome back, <span className="glow-text text-[var(--accent)]">{profile.nickname}</span>
        </h2>
        <p className="text-gray-400">Pick a cartridge to play</p>
      </div>

      {/* Cartridge shelf */}
      {availableGames.length > 0 && (
        <div className="mb-10">
          <h3 className="text-lg font-bold mb-6 text-gray-300">Your Games</h3>
          <div className="flex gap-8 flex-wrap">
            {availableGames.map((game) => (
              <div key={game.id} className="flex flex-col items-center gap-3">
                <Cartridge game={game} onClick={() => onSelectGame(game)} />
                <span className="text-xs text-gray-400">{game.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {comingSoon.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-6 text-gray-300">Coming Soon</h3>
          <div className="flex gap-8 flex-wrap">
            {comingSoon.map((game) => (
              <div key={game.id} className="flex flex-col items-center gap-3 opacity-50">
                <Cartridge game={game} onClick={() => {}} />
                <span className="text-xs text-gray-500">{game.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Console App ---
type View = "home" | "games" | "profile" | "leaderboard" | "game-detail" | "playing";

export default function Console() {
  const [booted, setBooted] = useState(false);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [view, setView] = useState<View>("home");
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  useEffect(() => {
    setProfile(getProfile());
    setProfileLoaded(true);
  }, []);

  const handleBootDone = useCallback(() => setBooted(true), []);

  const handleProfileSave = useCallback((p: PlayerProfile) => {
    saveProfile(p);
    setProfile(p);
  }, []);

  const handleSelectGame = useCallback((game: Game) => {
    setSelectedGame(game);
    setView("game-detail");
  }, []);

  const handlePlayGame = useCallback(() => setView("playing"), []);
  const handleExitGame = useCallback(() => setView("game-detail"), []);
  const handleNavBack = useCallback(() => {
    setSelectedGame(null);
    setView("games");
  }, []);

  if (!booted) return <BootScreen onDone={handleBootDone} />;
  if (profileLoaded && !profile) return <ProfileSetup onSave={handleProfileSave} />;
  if (!profileLoaded || !profile) return null;
  if (view === "playing" && selectedGame) return <GamePlayer game={selectedGame} onExit={handleExitGame} />;

  const navItems: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: "Home", icon: <IconHome /> },
    { id: "games", label: "Games", icon: <IconGames /> },
    { id: "leaderboard", label: "Leaderboard", icon: <IconTrophy /> },
    { id: "profile", label: "Profile", icon: <IconProfile /> },
  ];

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 bg-[var(--sidebar-bg)] border-r border-gray-800/50 flex flex-col shrink-0">
        <div className="p-5 pb-2">
          <h1 className="text-xl font-bold glow-text text-[var(--accent)] tracking-wider">
            imagineX
          </h1>
          <div className="glow-line mt-3" />
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {navItems.map((item) => (
            <div
              key={item.id}
              className={`nav-item ${(view === item.id || (view === "game-detail" && item.id === "games")) ? "active" : ""}`}
              onClick={() => {
                setView(item.id);
                if (item.id !== "games") setSelectedGame(null);
              }}
            >
              {item.icon}
              {item.label}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800/50">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0"
              style={{ background: profile.avatarColor }}
            >
              {profile.nickname.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-gray-300 truncate">{profile.nickname}</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <div className="glow-line" />
        <div className="h-[calc(100%-2px)]">
          {view === "home" && <HomeView profile={profile} onSelectGame={handleSelectGame} />}
          {view === "games" && !selectedGame && <HomeView profile={profile} onSelectGame={handleSelectGame} />}
          {view === "game-detail" && selectedGame && (
            <GameDetail game={selectedGame} onPlay={handlePlayGame} onBack={handleNavBack} />
          )}
          {view === "leaderboard" && <LeaderboardView />}
          {view === "profile" && <ProfileView profile={profile} />}
        </div>
      </main>
    </div>
  );
}
