// textentry.js — a canvas text box with an on-screen QWERTY keyboard (touch) that also takes real key presses.
// Used for the leaderboard nickname and the coworker names.
import { txt, fillR } from '../draw.js';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
export class TextEntry {
  constructor(o = {}) { this.value = o.value || ''; this.max = o.max || 12; this.label = o.label || 'NAME'; this.x = o.x ?? 640; this.y = o.y ?? 300; this.done = false; this.cancel = !!o.cancel; this.t = 0; this.allowSpace = !!o.allowSpace; }
  get keys() {
    const kw = 58, kh = 52, gap = 7, out = [];
    ROWS.forEach((row, r) => { const w = row.length * (kw + gap) - gap, x0 = this.x - w / 2, y = this.y + 90 + r * (kh + gap); [...row].forEach((ch, i) => out.push({ ch, x: x0 + i * (kw + gap), y, w: kw, h: kh })); });
    const y3 = this.y + 90 + 3 * (kh + gap);
    out.push({ ch: '⌫', x: this.x - 250, y: y3, w: 120, h: kh, action: 'back' });
    if (this.allowSpace) out.push({ ch: 'SPACE', x: this.x - 110, y: y3, w: 200, h: kh, action: 'space' });
    out.push({ ch: 'OK', x: this.x + 110, y: y3, w: 140, h: kh, action: 'ok', color: '#22c55e' });
    if (this.cancel) out.push({ ch: 'CANCEL', x: this.x - 250, y: y3 + kh + gap, w: 500, h: 40, action: 'cancel', color: '#374151' });
    return out;
  }
  add(ch) { if (this.value.length < this.max) this.value += ch; }
  press(k) {
    if (k.action === 'back') this.value = this.value.slice(0, -1);
    else if (k.action === 'space') { if (this.value.length && !this.value.endsWith(' ')) this.add(' '); }
    else if (k.action === 'ok') { if (this.value.trim()) this.done = 'ok'; }
    else if (k.action === 'cancel') this.done = 'cancel';
    else this.add(k.ch);
    return this.done;
  }
  pointerDown(p) { for (const k of this.keys) if (p.x >= k.x && p.x <= k.x + k.w && p.y >= k.y && p.y <= k.y + k.h) return this.press(k); return false; }
  keyDown(code) {
    if (code === 'Enter') return this.press({ action: 'ok' });
    if (code === 'Escape' && this.cancel) return this.press({ action: 'cancel' });
    if (code === 'Backspace') return this.press({ action: 'back' });
    if (code === 'Space') return this.press({ action: 'space' });
    const m = /^Key([A-Z])$/.exec(code); if (m) this.add(m[1]);
    const d = /^Digit(\d)$/.exec(code); if (d) this.add(d[1]);
    return false;
  }
  draw(ctx, dt = 1 / 60) {
    this.t += dt;
    txt(ctx, this.label, this.x, this.y - 6, { size: 22, color: '#ffe600', stroke: '#111', strokeW: 4 });
    fillR(ctx, this.x - 220, this.y + 14, 440, 58, 12, '#fff', '#111', 4);
    const caret = Math.floor(this.t * 2) % 2 === 0 ? '|' : ' ';
    txt(ctx, (this.value || '') + caret, this.x, this.y + 44, { size: 32, color: '#111', font: "'Courier New', monospace" });
    for (const k of this.keys) { fillR(ctx, k.x, k.y, k.w, k.h, 8, k.color || '#1f2937', '#111', 2); txt(ctx, k.ch, k.x + k.w / 2, k.y + k.h / 2 + 1, { size: k.ch.length > 2 ? 18 : 24, color: '#fff' }); }
  }
}
