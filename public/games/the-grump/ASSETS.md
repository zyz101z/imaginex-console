# Art & audio replacement guide

All character art is swappable without touching gameplay. Heads are PNG sprites; bodies are
drawn in code (`src/characters.js`). Register files in `SPRITES` and they load at boot.

## Head sprites (current)
All heads are Meshy image-to-image (nano-banana-pro) with the `D:\DontBeSoung` portraits as
reference, prompted "head and neck only" on a #00FF00 green screen, then keyed/despilled/trimmed
and normalized to **400×520 transparent PNG, chin at the bottom edge** (scratchpad `meshy/key.js`).
Soung: `soung_{annoyed,angry,rage,eyeroll,deadpan,smirk,cool,shocked}.png`. Pat: `pat_{happy,excited}.png`.
Cost: 9 credits each. Regenerate one mood with the same prompt pattern and re-key to swap it.

**Soung full body:** `assets/soung_body_{stand,walk,rage}.png` (520×800, feet at bottom) — same
recipe ("FULL BODY ... pose: arms crossed / mid-stride walking / both arms raised furious"). The
mood head is drawn OVER the pose's own head using per-pose anchors in `SPRITES.soung.bodies`:
`neck: { x, top, w, v }` = the shirt-collar opening in sprite px (center x, top edge y, width at the top, V-notch y)
and `faceW` = how wide the face should draw in sprite px (≈ shoulder width ⇒ Pat-like cartoon proportions; 200 for
stand/walk, 215 for rage). The head sprite's chin (row 0.72 of its height) sits 26 px above `neck.top`; its own
long neck is clipped to the collar's V so it reads as tucked into the shirt. Measure a regenerated pose on a 20px
grid crop of rows 140–360 (2026-09-02 fix — before this the sprite's BOTTOM sat on the chin line, so the head was
small and its whole neck showed). The body
PNGs have their own head CLEARED as a feathered ellipse so nothing peeks out around the overlay:
`node test/clear_head.js assets/soung_body_<pose>.png <cx> <chin> <headH>` — redo after regenerating a pose.
Pose pick: `arms:'up'` → rage, `walk` → walk, else stand (desk scenes hide the legs behind the desk).

**Pat from behind:** `assets/pat_back.png` (520×800, Meshy i2i from pat_body.png: "the EXACT same cartoon man … seen from BEHIND", keyed with the same script; `drawPat(..., { back: true })`). Used by RKT Run while he's busy at the coffee machine.

**Pat full body:** `assets/pat_body.png` (520×800, feet at the bottom) — same Meshy recipe, prompt
"FULL BODY, head to feet, waving". `drawPat` uses it as a one-piece figure (bob + lean for walking)
and falls back to the procedural body only if the file is missing. Key with
`OUT_W=520 OUT_H=800 FIT_H=790 node test/key_heads.js raw.png assets/pat_body.png`.

Anchors (in sprite pixels) live in `SPRITES.<name>`: `eyes` (two `[x,y]`), `mouth` `[x,y]`, `eyeR`,
`skin`. Expression overlays (eyebrows, eye-rolls, frowns, sunglasses) are drawn at those anchors,
so if you replace a head, update the anchors to the new eye/mouth positions.

## Per-expression heads (optional, preferred long-term)
Drop a full-head PNG per mood and list it; the overlay is skipped when a file exists:
```js
SPRITES.soung.moods.angry   = 'assets/soung_angry.png';
SPRITES.soung.moods.eyeroll = 'assets/soung_eyeroll.png';
```
Moods used by the game — Soung: `annoyed` (default), `angry`, `rage`, `eyeroll`, `deadpan`,
`smirk`, `cool` (sunglasses), `shocked`. Pat: `happy` (default), `excited`.
Recommended size 400×530, transparent background, head only (no neck/shoulders), same framing as the current crops.

## Cover
`cover.png` 800×1200 (console cartridge label).

## Audio
Everything is procedural (`src/audio.js`). To use real files, put them in `audio/` and map them in
`CUSTOM_FILES`, e.g. `slack: 'audio/slack.wav'`. Names: `slack, meeting, patAlarm, grumble, click,
wrong, good, decline, bam, whoosh, fullSoung, victory, lose, tick, pop, step, horn` and music loops
`musicTitle, musicWork, musicBoss, musicRage`.

## Pat voice lines
See GAME_DESIGN.md → "Voice lines" for the filename table. WAV or MP3 (the map lists .wav), mono is fine, ~1–2 s, trimmed tight, normalized to about -3 dB. Map lives in `src/audio.js` `VOICE_FILES`.
