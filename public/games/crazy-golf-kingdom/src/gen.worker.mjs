// CRAZY GOLF KINGDOM — hole generation off the main thread (the ghost golfer proof is CPU-heavy).
import { generateHole, generateAceHole } from './coursegen.mjs';
self.onmessage = (e) => {
  const { id, kind, args } = e.data;
  try {
    const hole = kind === 'ace' ? generateAceHole(new Date(args.date)) : generateHole(args);
    self.postMessage({ id, hole });
  } catch (err) { self.postMessage({ id, error: String(err) }); }
};
