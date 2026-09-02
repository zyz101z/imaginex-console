// draw.js — text, rounded rects, buttons, speech bubbles, impact text.
export const FONT = "'Fredoka', 'Nunito', 'Arial Rounded MT Bold', 'Segoe UI', sans-serif";
export const IMPACT = "'Bangers', 'Impact', 'Arial Black', sans-serif";

export function txt(ctx, s, x, y, o = {}) {
  const size = o.size || 24, weight = o.weight || 700;
  ctx.save();
  ctx.font = `${weight} ${size}px ${o.font || FONT}`;
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = o.base || 'middle';
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  if (o.stroke) { ctx.lineWidth = o.strokeW || Math.max(3, size / 8); ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = o.color || '#fff';
  ctx.fillText(s, x, y);
  ctx.restore();
}

export function measure(ctx, s, size = 24, font = FONT, weight = 700) {
  ctx.save(); ctx.font = `${weight} ${size}px ${font}`; const w = ctx.measureText(s).width; ctx.restore(); return w;
}

export function rrect(ctx, x, y, w, h, r = 12) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

export function fillR(ctx, x, y, w, h, r, color, stroke, sw = 3) {
  rrect(ctx, x, y, w, h, r); ctx.fillStyle = color; ctx.fill();
  if (stroke) { ctx.lineWidth = sw; ctx.strokeStyle = stroke; ctx.stroke(); }
}

export class Button {
  constructor(x, y, w, h, label, o = {}) {
    Object.assign(this, { x, y, w, h, label, color: o.color || '#3b82f6', text: o.text || '#fff', size: o.size || 26, r: o.r || 14, icon: o.icon || '', shadow: o.shadow ?? 6, disabled: false, hidden: false, id: o.id });
  }
  hit(p) { return !this.hidden && !this.disabled && p.x >= this.x && p.x <= this.x + this.w && p.y >= this.y && p.y <= this.y + this.h; }
  draw(ctx, hover = false, t = 0) {
    if (this.hidden) return;
    const dy = hover ? 2 : 0;
    ctx.save();
    if (this.shadow) fillR(ctx, this.x, this.y + this.shadow, this.w, this.h, this.r, 'rgba(0,0,0,0.35)');
    fillR(ctx, this.x, this.y + dy, this.w, this.h, this.r, hover ? lighten(this.color) : this.color, '#111', 3);
    txt(ctx, (this.icon ? this.icon + ' ' : '') + this.label, this.x + this.w / 2, this.y + dy + this.h / 2 + 1, { size: this.size, color: this.text });
    ctx.restore();
  }
}

export function lighten(hex, amt = 30) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16) + amt), g = Math.min(255, ((n >> 8) & 255) + amt), b = Math.min(255, (n & 255) + amt);
  return `rgb(${r},${g},${b})`;
}

// Speech bubble with a tail. tail: 'left' | 'right' | 'bottom'
export function bubble(ctx, x, y, w, h, text, o = {}) {
  const color = o.color || '#fff', tail = o.tail || 'bottom';
  ctx.save();
  rrect(ctx, x, y, w, h, 18); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#111'; ctx.stroke();
  ctx.beginPath();
  if (tail === 'bottom') { ctx.moveTo(x + w * 0.3, y + h - 2); ctx.lineTo(x + w * 0.22, y + h + 26); ctx.lineTo(x + w * 0.42, y + h - 2); }
  else if (tail === 'left') { ctx.moveTo(x + 2, y + h * 0.4); ctx.lineTo(x - 26, y + h * 0.55); ctx.lineTo(x + 2, y + h * 0.65); }
  else { ctx.moveTo(x + w - 2, y + h * 0.4); ctx.lineTo(x + w + 26, y + h * 0.55); ctx.lineTo(x + w - 2, y + h * 0.65); }
  ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.stroke();
  // cover the seam
  ctx.fillStyle = color;
  if (tail === 'bottom') ctx.fillRect(x + w * 0.3 + 2, y + h - 5, w * 0.12 - 4, 6);
  else if (tail === 'left') ctx.fillRect(x, y + h * 0.4 + 2, 6, h * 0.25 - 4);
  else ctx.fillRect(x + w - 6, y + h * 0.4 + 2, 6, h * 0.25 - 4);
  wrapText(ctx, text, x + w / 2, y + h / 2, w - 30, o.size || 24, o.textColor || '#111');
  ctx.restore();
}

export function wrapText(ctx, text, cx, cy, maxW, size, color, font = FONT) {
  ctx.save(); ctx.font = `700 ${size}px ${font}`;
  const words = text.split(' '), lines = []; let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  const lh = size * 1.15, y0 = cy - (lines.length - 1) * lh / 2;
  lines.forEach((l, i) => txt(ctx, l, cx, y0 + i * lh, { size, color, font }));
  ctx.restore();
}

// Comic impact word ("BAM!") with rotation + outline.
export function impact(ctx, s, x, y, size = 80, color = '#ffe600', rot = -0.15, alpha = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
  txt(ctx, s, 0, 0, { size, font: IMPACT, color, stroke: '#111', strokeW: size / 7, weight: 400 });
  ctx.restore();
}

// Big "title card" banner across the middle of the screen.
export function banner(ctx, W, H, title, sub, o = {}) {
  ctx.save();
  ctx.fillStyle = o.bg || 'rgba(15,20,40,0.82)';
  ctx.fillRect(0, H / 2 - 110, W, 220);
  ctx.fillStyle = o.accent || '#ffe600'; ctx.fillRect(0, H / 2 - 110, W, 8); ctx.fillRect(0, H / 2 + 102, W, 8);
  txt(ctx, title, W / 2, H / 2 - (sub ? 22 : 0), { size: o.size || 72, font: IMPACT, weight: 400, color: o.color || '#fff', stroke: '#111', strokeW: 8 });
  if (sub) txt(ctx, sub, W / 2, H / 2 + 48, { size: 30, color: o.subColor || '#ffe600' });
  ctx.restore();
}
