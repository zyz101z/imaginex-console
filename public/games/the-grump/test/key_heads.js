// Green-screen key + despill + trim + normalize to a 400x520 canvas, bottom-center aligned.
const sharp = require('/mnt/d/ImagineX/imaginex-console/node_modules/sharp');
const OUT_W = +(process.env.OUT_W || 400), OUT_H = +(process.env.OUT_H || 520), HEAD_H = +(process.env.FIT_H || 500);
async function key(inp, out) {
  const { data, info } = await sharp(inp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const m = Math.max(r, b);
    // greenness: how much g exceeds the other channels
    const gn = (g - m) / 255;
    let a = 1;
    if (g > 90 && gn > 0.35) a = 0; else if (g > 90 && gn > 0.12) a = 1 - (gn - 0.12) / 0.23;
    if (a < 1) { // despill: pull green down to the max of r/b on edge pixels
      data[i * 4 + 1] = Math.min(g, Math.round(m + (g - m) * a * 0.3));
    }
    data[i * 4 + 3] = Math.round(a * 255);
    if (a > 0.5) { const x = i % w, y = (i / w) | 0; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  const cut = await sharp(data, { raw: { width: w, height: h, channels: 4 } }).extract({ left: minX, top: minY, width: bw, height: bh }).png().toBuffer();
  const scale = Math.min(HEAD_H / bh, (OUT_W - 10) / bw), tw = Math.round(bw * scale), th = Math.round(bh * scale);
  const resized = await sharp(cut).resize(tw, th).png().toBuffer();
  await sharp({ create: { width: OUT_W, height: OUT_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left: Math.round((OUT_W - tw) / 2), top: OUT_H - th - 8 }]).png().toFile(out);
  console.log(out, 'bbox', bw, bh, '->', tw, th);
}
(async () => { for (const [i, o] of process.argv.slice(2).reduce((a, v, k, arr) => (k % 2 ? a : [...a, [v, arr[k + 1]]]), [])) await key(i, o); })();
