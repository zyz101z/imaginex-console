// main.js — boot: load fonts + sprites, wire scenes, start the loop.
import { Engine } from './engine.js';
import { loadSprites } from './characters.js';
import { TitleScene, HowToScene } from './scenes/title.js';
import { WorkdayScene } from './scenes/workday.js';
import { IntroScene } from './scenes/intro.js';
import { CoworkersScene, LeaderboardScene } from './scenes/extras.js';
import { GameOverScene, WinScene } from './scenes/end.js';
import { introSeen } from './state.js';

export class Game {
  constructor(canvas) { this.engine = new Engine(canvas); }
  showTitle() { this.engine.go(new TitleScene(this)); }
  showHowTo() { this.engine.go(new HowToScene(this)); }
  showCoworkers() { this.engine.go(new CoworkersScene(this)); }
  showLeaderboard() { this.engine.go(new LeaderboardScene(this)); }
  // replay = true from the ▶ INTRO button (skippable). A first-ever player must watch it through (no skip).
  showIntro(replay = false) { this.engine.go(new IntroScene(this, { mandatory: !replay && !introSeen() })); }
  play() { if (introSeen()) this.startWorkday(); else this.showIntro(); }
  startWorkday() { this.engine.go(new WorkdayScene(this)); }
  gameOver(S) { this.engine.go(new GameOverScene(this, S)); }
  win(S) { this.engine.go(new WinScene(this, S)); }
}

export async function boot(canvas) {
  const game = new Game(canvas);
  try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch {}
  await loadSprites('');
  game.showTitle(); game.engine.start();
  window.__grump = game; // debug handle
  return game;
}
