# Crazy Golf Kingdom — tests

Syntax check (⚠️ `node --check file.js` treats .js as CommonJS and can pass BROKEN ESM — use this instead):
    for f in src/*.mjs src/main.js; do node --input-type=module --check < $f || echo BAD $f; done

Pure logic (no browser):
    node test/physics.test.mjs          # 35 checks: rolling, walls, cup, lip-out, sand/ice, ramps, bumpers, water, blocks, windmill, mover, boost, teleport, cannon
    node test/coursegen.test.mjs [N]    # ~670 checks over seeded holes in all 5 kingdoms; ghost golfer proves every hole completable

Browser (real three.js scene, headless Chrome via puppeteer-core):
    cd public/games/crazy-golf-kingdom && python3 -m http.server 8093 --bind 127.0.0.1 &
    # puppeteer-core + chrome from ~/.cache/puppeteer; WSL lacks libasound so point LD_LIBRARY_PATH at a dir holding
    # libasound.so.2 (copied from /snap/gnome-42-2204/*/usr/lib/x86_64-linux-gnu/libasound.so.2.0.0)
    LD_LIBRARY_PATH=<dir-with-libasound> node test/browser.play.js meadow   # full 9-hole career + 2P + daily through the real game loop
    LD_LIBRARY_PATH=<dir-with-libasound> node test/browser.shot.js candy 6 out   # screenshots title/hole/after-shot for a kingdom + hole index
    LD_LIBRARY_PATH=<dir-with-libasound> node test/browser.drag.js   # real mouse drags: aim from anywhere, power scaling, cancel, orbit, push mode, keyboard
    LD_LIBRARY_PATH=<dir-with-libasound> node test/browser.ipad.js   # iPad emulation: touch drag, pinch, layout, HUD sizes
    LD_LIBRARY_PATH=<dir-with-libasound> node test/browser.ace.js    # Shot of the Day flow (API stubbed), skin particles, jump/turntable render
    LD_LIBRARY_PATH=<dir-with-libasound> node test/browser.flicker.js   # burst-screenshots hole transitions; fails on any near-black frame (needs sharp)
    LD_LIBRARY_PATH=<dir-with-libasound> node test/browser.progression.js   # XP/levels, quests, mulligan, profile, finale crown
    LD_LIBRARY_PATH=<dir-with-libasound> node test/browser.tutorial.js   # tutorial flow, putter, peek flyover, cannon preview
    LD_LIBRARY_PATH=<dir-with-libasound> node test/browser.leaderboards.js   # boards screen, per-day daily posting, rank (API stubbed)
All scripts need `puppeteer-core` resolvable (npm i puppeteer-core in the cwd).
    LD_LIBRARY_PATH=<dir-with-libasound> node test/browser.pirate.js   # Pirate Cove: full bot round, Kraken finale, model loads
