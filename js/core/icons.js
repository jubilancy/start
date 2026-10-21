// Icon resolver. Spec formats:
//   ''                → auto favicon with fallback chain (DuckDuckGo → Google → /favicon.ico → letter tile)
//   'si:github'       → Simple Icons (monochrome, takes currentColor)
//   'lucide:search'   → Lucide (monochrome)
//   '🔥' / 'emoji:🔥' → emoji
//   'https://…' | 'data:…' | '/path.svg' → image
import { h, hostOf } from './util.js';

export const SI_VERSION = '13.0.0';
export const LUCIDE_VERSION = '0.468.0';
const CDN = 'https://cdn.jsdelivr.net/npm';

export const siUrl = slug => `${CDN}/simple-icons@${SI_VERSION}/icons/${slug}.svg`;
export const lucideUrl = name => `${CDN}/lucide-static@${LUCIDE_VERSION}/icons/${name}.svg`;

export function faviconChain(url) {
  const host = hostOf(url);
  if (!host) return [];
  return [
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
    `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
    `${new URL(url).origin}/favicon.ico`,
  ];
}

function mask(src, label) {
  return h('span', { class: 'ico mask', role: 'img', 'aria-label': label || '', style: { '--ico': `url("${src}")` } });
}

export function iconNode(spec, { url = '', title = '' } = {}) {
  spec = (spec || '').trim();
  if (spec.startsWith('si:')) return mask(siUrl(spec.slice(3)), title);
  if (spec.startsWith('lucide:')) return mask(lucideUrl(spec.slice(7)), title);
  if (spec.startsWith('emoji:')) return h('span.ico.emoji', { 'aria-hidden': true }, spec.slice(6));
  if (/^(https?:|data:|\/|\.\/)/.test(spec)) return h('img.ico', { src: spec, alt: title, loading: 'lazy' });
  if (spec) return h('span.ico.emoji', { 'aria-hidden': true }, spec);

  const chain = faviconChain(url);
  const letter = () => h('span.ico.letter', { 'aria-hidden': true }, (title || hostOf(url) || '?').trim()[0]?.toUpperCase() || '?');
  if (!chain.length) return letter();
  let i = 0;
  const img = h('img.ico.fav', { src: chain[0], alt: title, loading: 'lazy', referrerpolicy: 'no-referrer' });
  img.addEventListener('error', () => {
    i += 1;
    if (i < chain.length) img.src = chain[i];
    else img.replaceWith(letter());
  });
  // DuckDuckGo/Google serve a tiny placeholder instead of a 404 for unknown hosts.
  img.addEventListener('load', () => {
    if (img.naturalWidth && img.naturalWidth < 9 && i < chain.length - 1) { i += 1; img.src = chain[i]; }
  });
  return img;
}

/** Emoji / image → favicon href for the browser tab. */
export function emojiFavicon(emoji) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${emoji}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
