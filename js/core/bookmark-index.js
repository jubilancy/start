// Flat list of every link the user has configured (links widgets in all tabs) for search + the command palette.
import { get } from './store.js';

export function allLinks() {
  const out = [];
  for (const t of get().tabs) for (const c of t.columns) for (const w of c.widgets) {
    if (w.type !== 'links') continue;
    for (const g of w.config?.groups || []) for (const i of g.items) out.push({ ...i, group: g.name, tab: t.name });
  }
  return out;
}

export function matchLinks(q, limit = 6) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return allLinks()
    .map(l => {
      const hay = `${l.title} ${l.url} ${l.group || ''}`.toLowerCase();
      if (!words.every(w => hay.includes(w))) return null;
      return { l, score: (l.title.toLowerCase().startsWith(words[0]) ? 0 : 1) };
    })
    .filter(Boolean).sort((a, b) => a.score - b.score).slice(0, limit).map(x => x.l);
}
