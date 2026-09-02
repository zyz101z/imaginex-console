// Clear an ellipse around a body sprite's head so the overlay expression head is the only head visible.
// usage: node clear_head.js <png> <cx> <chin> <headH>
const sharp = require('/mnt/d/ImagineX/imaginex-console/node_modules/sharp');
const [src, cx, chin, headH] = [process.argv[2], +process.argv[3], +process.argv[4], +process.argv[5]];
(async () => {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, cy = chin - headH * 0.52, rx = headH * 0.37, ry = headH * 0.55;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < w; x++) {
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    if (d < 1) { const k = (y * w + x) * 4; data[k + 3] = d > 0.93 ? Math.round(data[k + 3] * (d - 0.93) / 0.07) : 0; }
  }
  await sharp(data, { raw: { width: w, height: info.height, channels: 4 } }).png().toFile(src);
  console.log('cleared', src);
})();
