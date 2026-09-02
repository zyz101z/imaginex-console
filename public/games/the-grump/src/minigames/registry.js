// registry.js — mini-game registration + the base class every mini-game extends.
// A mini-game definition: { id, title, tagline, pat, special?, create(api) }.
//   special: 'lunch' fires once when the clock passes noon; 'boss' fires at 4:58 PM.
// The WorkdayScene builds `api` (see scenes/workday.js) and calls
// update(dt)/draw(ctx)/pointerDown(p)/pointerMove(p)/keyDown(code) until `done`.
export const MINIGAMES = [];
export function registerMinigame(def) { if (!MINIGAMES.find(m => m.id === def.id)) MINIGAMES.push(def); return def; }
export function regularMinigames() { return MINIGAMES.filter(m => !m.special); }
export function specialMinigame(kind) { return MINIGAMES.find(m => m.special === kind); }

export class MiniGame {
  constructor(api, def) { this.api = api; this.def = def; this.t = 0; this.done = false; this.result = null; this.mood = 'annoyed'; }
  finish(success, msg, o = {}) { if (this.done) return; this.done = true; this.result = { success, msg, ...o }; }
  update(dt) { this.t += dt; }
  draw(ctx) {}
  pointerDown(p) {} pointerMove(p) {} pointerUp() {} keyDown(code) {}
  get diff() { return this.api.S.difficulty; }
}

// Draw a countdown pill (top-right under the HUD).
export function drawTimer(ctx, left, total, txtFn, fillFn) {
  const w = 220, x = 1030, y = 104, k = Math.max(0, left / total);
  fillFn(ctx, x, y, w, 26, 13, '#0b1220', '#374151', 2);
  fillFn(ctx, x + 3, y + 3, (w - 6) * k, 20, 10, k < 0.3 ? '#ef4444' : '#38bdf8');
  txtFn(ctx, `${Math.ceil(Math.max(0, left))}s`, x + w / 2, y + 13, { size: 16, color: '#fff', stroke: '#111', strokeW: 3 });
}
