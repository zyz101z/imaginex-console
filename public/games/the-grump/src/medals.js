// medals.js — achievements with Pat-flavored titles. Earned set lives in localStorage; award() returns true the
// first time so scenes can toast it. Checks are wired in WorkdayScene.startResult / rage end / the end screens.
export const MEDALS = [
  { id: 'survivor', title: 'Survivor', desc: 'Survive a whole workday.', icon: '🏁' },
  { id: 'inbox_zero', title: 'Inbox Zero', desc: 'Slack Attack with zero hits.', icon: '💬' },
  { id: 'never_found', title: 'Never Found', desc: 'Hide and Seek without being spotted.', icon: '🔦' },
  { id: 'calendar_cleared', title: 'Calendar Cleared', desc: 'Invite Storm with nothing slipping through.', icon: '📅' },
  { id: 'flawless_sprint', title: 'Flawless Sprint', desc: 'Make the elevator without tripping.', icon: '🛗' },
  { id: 'sandwich_intact', title: 'Sandwich Intact', desc: 'Lunch Defense with zero bites lost.', icon: '🥪' },
  { id: 'bitcoin_denier', title: 'Bitcoin Denier', desc: 'Bonk a Bitcoin Pat.', icon: '₿' },
  { id: 'nothing_but_bin', title: 'Nothing But Bin', desc: 'Three baskets in a row in Paper Toss.', icon: '🗑' },
  { id: 'rkt_ninja', title: 'RKT Ninja', desc: 'Reach the treats without being caught once.', icon: '🍚' },
  { id: 'return_to_sender', title: 'Return to Sender', desc: 'Fire a paper ball back at Pat.', icon: '↩' },
  { id: 'five_whole_minutes', title: 'Five Whole Minutes', desc: 'Win five mini-games in a row.', icon: '⏱' },
  { id: 'cooled_off', title: 'Cooled Off', desc: 'Smash your way out of Full Soung Mode.', icon: '🧊' },
  { id: 'still_fuming', title: 'Still Fuming', desc: 'Let a Full Soung Mode run out of time.', icon: '🔥' },
  { id: 'hr_complaint', title: 'HR Complaint', desc: 'Bonk someone who was not Pat.', icon: '📋' },
  { id: 'employee_of_the_month', title: 'Employee of the Month', desc: 'Earn an S grade. Reluctantly.', icon: '🏆' },
  { id: 'had_enough', title: 'Had Enough', desc: 'Get sent home early.', icon: '🚪' },
];
const KEY = 'grump_medals';
export function loadMedals() { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return new Set(Array.isArray(a) ? a : []); } catch { return new Set(); } }
export function award(id) {
  if (!MEDALS.some(m => m.id === id)) return false;
  const have = loadMedals(); if (have.has(id)) return false;
  have.add(id); try { localStorage.setItem(KEY, JSON.stringify([...have])); } catch {}
  toasts.push({ id, t: 0 }); return true;
}
export const toasts = [];   // drawn by whichever scene is up
export function medal(id) { return MEDALS.find(m => m.id === id); }
export function updateToasts(dt) { for (const t of toasts) t.t += dt; while (toasts.length && toasts[0].t > 3.2) toasts.shift(); }
export function drawToasts(ctx, txt, fillR, y = 100) {
  const t = toasts[0]; if (!t) return; const m = medal(t.id);
  const k = t.t < 0.3 ? t.t / 0.3 : t.t > 2.8 ? Math.max(0, 1 - (t.t - 2.8) / 0.4) : 1;
  ctx.save(); ctx.globalAlpha = k; ctx.translate(640, y - (1 - k) * 40);
  fillR(ctx, -260, -30, 520, 60, 14, '#111827', '#ffe600', 4); fillR(ctx, -260, -30, 8, 60, 4, '#ffe600');
  txt(ctx, m.icon, -220, 1, { size: 28 }); txt(ctx, 'MEDAL EARNED', -180, -10, { size: 13, color: '#ffe600', align: 'left' }); txt(ctx, m.title, -180, 12, { size: 22, color: '#fff', align: 'left' });
  ctx.restore();
}
