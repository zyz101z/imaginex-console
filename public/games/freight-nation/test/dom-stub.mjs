// Minimal fake DOM + MapLibre + fetch, just rich enough to boot src/ui.mjs headlessly.
// Not a browser: element queries are regex-driven over innerHTML, which is plenty for
// smoke-testing that the UI renders, wires and dispatches without throwing.

class El {
  constructor(tag = "div", attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.attrs = attrs;
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.title = "";
    this.disabled = false;
    this.checked = false;
    this.value = attrs.value || "";
    this._html = "";
    this._text = "";
    this._classes = new Set((attrs.class || "").split(/\s+/).filter(Boolean));
    this._listeners = {};
    this.classList = {
      add: (...c) => c.forEach(x => this._classes.add(x)),
      remove: (...c) => c.forEach(x => this._classes.delete(x)),
      toggle: (c, on) => {
        const want = on === undefined ? !this._classes.has(c) : !!on;
        want ? this._classes.add(c) : this._classes.delete(c);
        return want;
      },
      contains: c => this._classes.has(c),
    };
  }
  get className() { return [...this._classes].join(" "); }
  set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); this.children = parseStubs(this._html); }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
  addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); }
  removeEventListener() {}
  dispatch(type, ev = {}) {
    for (const fn of this._listeners[type] || []) fn({ preventDefault() {}, target: this, ...ev });
    const direct = this["on" + type];
    if (direct) direct({ preventDefault() {}, target: this, ...ev });
  }
  click() { this.dispatch("click"); }
  matches() { return false; }
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 900, height: 700 }; }
  appendChild(c) { this.children.push(c); return c; }
  remove() {}
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) {
    return this.children.filter(c => c._matchesSelector(sel));
  }
  _matchesSelector(sel) {
    for (const part of sel.split(",").map(s => s.trim())) {
      const attr = part.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
      if (attr) {
        const key = camel(attr[1].replace(/^data-/, ""));
        if (attr[1].startsWith("data-") && key in this.dataset) return true;
        continue;
      }
      if (part.startsWith(".") && this._classes.has(part.slice(1))) return true;
      if (part.startsWith("#") && this.attrs.id === part.slice(1)) return true;
      if (/^[a-z]+$/i.test(part) && this.tagName === part.toUpperCase()) return true;
    }
    return false;
  }
}
const camel = s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// Pull every tag that carries an id, class or data-* attribute into a flat stub list.
function parseStubs(html) {
  const out = [];
  const tagRe = /<([a-z]+)\b([^>]*)>/gi;
  let m;
  while ((m = tagRe.exec(html))) {
    const [, tag, rawAttrs] = m;
    const attrs = {};
    const dataset = {};
    const attrRe = /([\w-]+)(?:="([^"]*)")?/g;
    let a;
    while ((a = attrRe.exec(rawAttrs))) {
      const [, name, value = ""] = a;
      if (name.startsWith("data-")) dataset[camel(name.slice(5))] = value;
      else attrs[name] = value;
    }
    const el = new El(tag, attrs);
    Object.assign(el.dataset, dataset);
    out.push(el);
  }
  return out;
}

export function installDom() {
  const byId = new Map();
  const ensure = id => {
    if (!byId.has(id)) byId.set(id, new El("div", { id }));
    return byId.get(id);
  };
  for (const id of ["map", "mapCanvas", "side", "cash", "rep", "clock", "territory", "truckBar", "ticker",
    "tickerLine", "modal", "modalBody", "toast", "dev", "speedCtl", "helpBtn", "resetBtn",
    "zoomIn", "zoomOut", "findTruck", "followTruck", "inspectRoad", "mapWrap", "mapKey"]) ensure(id);

  const speedButtons = [0, 1, 4, 16].map(s => {
    const b = new El("button", {});
    b.dataset.s = String(s);
    return b;
  });

  const document = {
    querySelector(sel) {
      if (sel.startsWith("#")) return byId.get(sel.slice(1)) || null;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === "#speedCtl button") return speedButtons;
      return [];
    },
    createElement: tag => new El(tag),
    addEventListener() {},
    getElementById: id => byId.get(id) || null,
    body: new El("body"),
  };
  const store = new Map();
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  };

  globalThis.document = document;
  globalThis.localStorage = localStorage;
  globalThis.devicePixelRatio = 1;
  globalThis.performance = globalThis.performance || { now: () => 0 };
  globalThis.requestAnimationFrame = () => 0; // the harness pumps frames by hand
  globalThis.confirm = () => true;
  globalThis.alert = () => {};
  const windowListeners = {};
  globalThis.addEventListener = (t, fn) => { (windowListeners[t] ||= []).push(fn); };
  globalThis.removeEventListener = () => {};
  globalThis.window = globalThis;
  return { byId, speedButtons, El, windowListeners };
}

// --- MapLibre stub -----------------------------------------------------------
export function installMapLibre() {
  class Marker {
    constructor(o = {}) { this.opts = o; this._ll = [0, 0]; }
    setLngLat(ll) { this._ll = ll; return this; }
    getLngLat() { return { lng: this._ll[0], lat: this._ll[1] }; }
    addTo() { return this; }
    on() { return this; }
    remove() {}
    getElement() { return this.opts.element || new El("div"); }
  }
  class LngLatBounds {
    constructor(a, b) { this.a = a; this.b = b; }
    extend() { return this; }
  }
  const sources = new Map();
  const map = {
    _handlers: {},
    on(type, layerOrFn, maybeFn) {
      const fn = maybeFn || layerOrFn;
      (this._handlers[type] ||= []).push(fn);
    },
    fire(type, ev) { for (const fn of this._handlers[type] || []) fn(ev); },
    addControl() {}, addSource(id, s) { sources.set(id, { ...s, setData(d) { this.data = d; } }); },
    addLayer() {}, getSource: id => sources.get(id),
    setCenter() {}, easeTo() {}, fitBounds() {}, zoomIn() {}, zoomOut() {},
    getZoom: () => 8, getCanvas: () => ({ style: {} }),
    queryRenderedFeatures: () => [],
    dragPan: { enable() {}, disable() {} },
  };
  globalThis.maplibregl = { Map: function () {
    // Real MapLibre fires "load" once the style resolves; without this the UI would sit
    // in its not-ready state and the online path would never actually be exercised.
    setTimeout(() => map.fire("load"), 0);
    return map;
  }, Marker, LngLatBounds, NavigationControl: function () {} };
  return { map, sources };
}

// --- fetch stub --------------------------------------------------------------
// Returns a plausible OSRM response so the real-route path is exercised.
export function installFetch({ fail = false, delay = 0 } = {}) {
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(url);
    if (delay) await new Promise(r => setTimeout(r, delay));
    if (fail) throw new Error("network down");
    const coordPart = String(url).split("/driving/")[1].split("?")[0];
    const pts = coordPart.split(";").map(p => p.split(",").map(Number));
    const route = n => ({
      distance: 100000 + n * 5000,
      duration: 5400 + n * 300,
      geometry: { type: "LineString", coordinates: pts },
      legs: [{ steps: [{ ref: "I-5", name: "Golden State Freeway" },
        { ref: n ? "CA-99" : "I-405", name: "San Diego Freeway" }] }],
    });
    const alternatives = String(url).includes("alternatives=true");
    return { ok: true, json: async () => ({ code: "Ok",
      routes: alternatives ? [route(0), route(1), route(2)] : [route(0)] }) };
  };
  return calls;
}
export { El };
