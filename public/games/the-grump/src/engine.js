// engine.js — tiny canvas engine: fixed 1280x720 logical space, scene manager,
// pointer/keys input, screen shake, slow-mo, flash. No DOM access at import time
// so the game modules can be loaded headless for tests.
export const W = 1280, H = 720;

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.scene = null;
    this.time = 0;
    this.pointer = { x: W / 2, y: H / 2, down: false };
    this.keys = new Set();
    this.activity = 0;         // mouse-move distance + key presses (Appear Busy reads this)
    this.shakeT = 0; this.shakeD = 0; this.shakeAmt = 0;
    this.slowT = 0; this.slowF = 1;
    this.flashT = 0; this.flashD = 0; this.flashColor = '#fff';
    this._last = 0;
    this.running = false;
    if (canvas) this._bind();
  }

  _toLogical(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
  }

  _bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', e => {
      const p = this._toLogical(e);
      this.pointer.x = p.x; this.pointer.y = p.y; this.pointer.down = true;
      this.activity += 1;
      this.scene?.pointerDown?.(p);
      e.preventDefault();
    });
    c.addEventListener('pointermove', e => {
      const p = this._toLogical(e);
      this.activity += Math.hypot(p.x - this.pointer.x, p.y - this.pointer.y) / 40;
      this.pointer.x = p.x; this.pointer.y = p.y;
      this.scene?.pointerMove?.(p);
    });
    const up = e => { this.pointer.down = false; this.scene?.pointerUp?.(); };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      this.activity += 1;
      this.scene?.keyDown?.(e.code);
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  go(scene) {
    this.scene?.exit?.();
    this.scene = scene;
    scene.engine = this;
    scene.enter?.();
  }

  shake(amt = 8, dur = 0.3) { this.shakeAmt = Math.max(this.shakeAmt, amt); this.shakeD = this.shakeT = Math.max(this.shakeT, dur); }
  slowmo(factor = 0.3, dur = 0.4) { this.slowF = factor; this.slowT = dur; }
  flash(color = '#fff', dur = 0.15) { this.flashColor = color; this.flashD = this.flashT = dur; }

  // Advance simulation by real seconds. Public so tests can drive it.
  step(dtReal) {
    let dt = Math.min(0.05, dtReal);
    if (this.slowT > 0) { this.slowT -= dtReal; dt *= this.slowF; if (this.slowT <= 0) this.slowF = 1; }
    if (this.shakeT > 0) this.shakeT -= dtReal;
    if (this.flashT > 0) this.flashT -= dtReal;
    this.time += dt;
    this.scene?.update?.(dt);
  }

  render() {
    const ctx = this.ctx; if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (this.shakeT > 0) {
      const k = this.shakeAmt * (this.shakeT / this.shakeD);
      ctx.translate((Math.random() - 0.5) * 2 * k, (Math.random() - 0.5) * 2 * k);
    } else this.shakeAmt = 0;
    this.scene?.draw?.(ctx);
    ctx.restore();
    if (this.flashT > 0) {
      ctx.globalAlpha = Math.min(1, this.flashT / this.flashD) * 0.8;
      ctx.fillStyle = this.flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    }
  }

  start() {
    this.running = true;
    const tick = now => {
      if (!this.running) return;
      const dt = this._last ? (now - this._last) / 1000 : 0;
      this._last = now;
      this.step(dt);
      this.render();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const easeOut = t => 1 - Math.pow(1 - t, 3);
