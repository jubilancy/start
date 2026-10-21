// Minimal pub/sub so widgets can talk (e.g. palette → widget focus, rss → greeting).
const map = new Map();
export const bus = {
  on(ev, fn) { (map.get(ev) || map.set(ev, new Set()).get(ev)).add(fn); return () => map.get(ev)?.delete(fn); },
  emit(ev, data) { map.get(ev)?.forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); },
};
