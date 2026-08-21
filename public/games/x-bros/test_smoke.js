// X-Bros headless smoke test — stubs Phaser + WebAudio, evals the game script,
// then exercises music scheduling, CPU controller (incl. new defense), and data tables.
const fs = require("fs");
const vm = require("vm");

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.log("FAIL: " + name); }
}

// ---- Stubs ------------------------------------------------------------------
class FakeGain { constructor(){ this.gain={value:1, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){}}; } connect(n){return n;} disconnect(){} }
class FakeOsc { constructor(){ this.frequency={setValueAtTime(){}, exponentialRampToValueAtTime(){}}; } connect(n){return n;} start(){} stop(){} }
class FakeFilter { constructor(){ this.frequency={value:0}; this.Q={value:0}; } connect(n){return n;} }
class FakeSrc { connect(n){return n;} start(){} stop(){} }
class FakeAudioContext {
  constructor(){ this.currentTime = 0; this.state = "running"; this.sampleRate = 44100; this.destination = {}; }
  createGain(){ return new FakeGain(); }
  createOscillator(){ return new FakeOsc(); }
  createBiquadFilter(){ return new FakeFilter(); }
  createBuffer(ch, len){ return { getChannelData(){ return new Float32Array(len); } }; }
  createBufferSource(){ return new FakeSrc(); }
  resume(){}
}

const PhaserStub = {
  AUTO: 0,
  Scale: { FIT: 0, CENTER_BOTH: 0 },
  Scene: class { constructor(){} },
  Game: class { constructor(){} },
  Input: { Keyboard: { JustDown: () => false, JustUp: () => false } },
};

const sandbox = {
  window: { AudioContext: FakeAudioContext },
  document: { createElement: () => ({ getContext: () => null, width: 0, height: 0 }) },
  Phaser: PhaserStub,
  setInterval: (fn, ms) => ({ fn, ms }),
  clearInterval: () => {},
  console, Math, JSON, Float32Array,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// Self-extracting: pull the game script straight out of index.html
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const src = scripts[scripts.length - 1];
// Script consts are top-level (no IIFE), so an appended shim in the same script
// scope can see them and export what we need.
vm.runInContext(src + "\n;globalThis.__X = { ROSTER, DIFFICULTY, STAGES, SFX, CpuController, zeroInput, W };", sandbox);
check("script evaluates", true);

const { ROSTER, DIFFICULTY, STAGES, SFX, W, CpuController, zeroInput } = sandbox.__X;

// ---- Data tables ------------------------------------------------------------
check("8 fighters", ROSTER.length === 8);
const wilson = ROSTER.find(c => c.id === "wilson");
const bigfoot = ROSTER.find(c => c.id === "bigfoot");
check("Wilson exists with projectile special", wilson && wilson.special.type === "projectile");
check("Bigfoot exists with blur lunge", bigfoot && bigfoot.special.type === "lunge" && bigfoot.special.blur === true);
check("Bigfoot is the heaviest", ROSTER.every(c => c.stats.weight <= bigfoot.stats.weight));
check("Wilson sprite config (560x724)", wilson.sprite && wilson.sprite.frameW === 560 && wilson.sprite.frameH === 724);
check("Bigfoot sprite config (560x724)", bigfoot.sprite && bigfoot.sprite.frameW === 560 && bigfoot.sprite.frameH === 724);
check("all 8 fighters have sprite sheets", ROSTER.every(c => c.sprite && c.sprite.sheet));
check("select grid fits 8 cards in 1280", 8 * 130 + 7 * 14 <= 1280);
check("5 stages", STAGES.length === 5);
check("stage ids unique", new Set(STAGES.map(s => s.id)).size === STAGES.length);
check("platforms stay on-screen", STAGES.every(s => s.platforms.every(p => p.x - p.w / 2 > 0 && p.x + p.w / 2 < 1280)));
for (const st of STAGES) {
  check(`stage ${st.id} has palette`, [st.bgTop, st.bgBot, st.mtn, st.floor, st.plat].every(c => typeof c === "number"));
  check(`stage ${st.id} platforms array`, Array.isArray(st.platforms));
  check(`stage ${st.id} has bg art path`, typeof st.bg === "string" && st.bg.startsWith("bg/"));
}
for (const d of ["Easy", "Normal", "Hard"]) {
  check(`${d} has shieldChance`, typeof DIFFICULTY[d].shieldChance === "number");
  check(`${d} has rollChance`, typeof DIFFICULTY[d].rollChance === "number");
  check(`${d} defense chances sane`, DIFFICULTY[d].shieldChance + DIFFICULTY[d].rollChance <= 1);
}
check("Hard defends more than Easy", DIFFICULTY.Hard.shieldChance > DIFFICULTY.Easy.shieldChance);

// ---- zeroInput shape --------------------------------------------------------
const zi = zeroInput();
for (const f of ["shield", "attackDown", "attackReleased", "attackPressed", "jumpPressed"]) {
  check(`zeroInput has ${f}`, f in zi);
}

// ---- Music engine -----------------------------------------------------------
SFX.startMusic();
check("music timer created", !!SFX.musicTimer);
check("music gain created", !!SFX.musicGain);
// Run every step of the 64-step loop twice — catches bad pattern indexing
for (let i = 0; i < 128; i++) SFX.playMusicStep(i % 64, i * 0.1);
check("all 128 music steps play without throwing", true);
// Scheduler advances
SFX.ctx.currentTime = 0;
SFX.nextNoteTime = 0;
SFX.musicStep = 0;
SFX.scheduleMusic();
check("scheduler advances steps", SFX.musicStep > 0);
SFX.stopMusic();
check("music stops", SFX.musicTimer === null && SFX.musicGain === null);
// New SFX cases don't throw
for (const s of ["shieldOn", "shieldHit", "shieldBreak", "roll", "chargeFull", "smashHit"]) SFX.play(s);
check("new SFX cases play", true);

// ---- CPU controller with defense --------------------------------------------
function mockFighter(x, char) {
  return {
    character: char, stats: char.stats, stocks: 3, facing: 1, airJumps: 1,
    hitstunUntil: 0, attackUntil: 0, attackCooldownUntil: 0, specialCooldownUntil: 0,
    sprite: { x, y: 600, body: { blocked: { down: true }, touching: { down: false }, velocity: { x: 0, y: 0 } } },
    scene: { time: { now: 10000 } },
  };
}
const me = mockFighter(600, ROSTER[0]);
const them = mockFighter(700, ROSTER[1]);

// Opponent mid-swing + rollChance forced to 1 => CPU must react with shield input
const cfgRoll = Object.assign({}, DIFFICULTY.Hard, { rollChance: 1, shieldChance: 0 });
let cpu = new CpuController(me, them, cfgRoll);
them.attackUntil = 10.5;      // "swinging now" (scene time 10s)
let inp = cpu.poll(0.016);
check("CPU rolls vs swing (shield flag)", inp.shield === true);
check("CPU rolls AWAY from opponent", inp.left === true && inp.right === false);

// Shield branch
const cfgShield = Object.assign({}, DIFFICULTY.Hard, { rollChance: 0, shieldChance: 1 });
cpu = new CpuController(me, them, cfgShield);
inp = cpu.poll(0.016);
check("CPU shields vs swing", inp.shield === true && !inp.left && !inp.right);
// One dice-roll per swing: same swing, no re-trigger after action expires
cpu.defAction = null;
cpu.lastSwingSeen = them.attackUntil;
inp = cpu.poll(0.016);
check("no double dice-roll on same swing", inp.shield === false);

// No swing => no defense, normal input shape
const cfgNone = Object.assign({}, DIFFICULTY.Easy, { rollChance: 0, shieldChance: 0 });
cpu = new CpuController(me, them, cfgNone);
them.attackUntil = 0;
inp = cpu.poll(0.016);
check("no defense without a swing", inp.shield === false);
check("CPU input has attackDown field", inp.attackDown === false);

// Dead CPU returns zero input with new fields
me.stocks = 0;
inp = cpu.poll(0.016);
check("dead CPU zero input incl. shield", inp.shield === false && inp.attackPressed === false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
