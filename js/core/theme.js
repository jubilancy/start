// Applies appearance settings: theme vars, fonts, background, tab title and favicon.
import { emojiFavicon } from './icons.js';

export const THEME_VARS = [
  ['--bg', 'Background'], ['--text', 'Text'], ['--accent', 'Accent'],
  ['--light-accent', 'Highlight'], ['--border', 'Border'], ['--card', 'Card'],
];

const defaultIcon = document.querySelector('link[rel~="icon"]')?.href || '';
const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
let current = null;

export function applyAppearance(s) {
  current = s;
  const root = document.documentElement;

  // theme mode
  const mode = s.theme.mode;
  root.dataset.theme = mode === 'dark' ? 'dark' : mode === 'auto' ? (mq?.matches ? 'dark' : 'light') : 'light';
  for (const [v] of THEME_VARS) root.style.removeProperty(v);
  for (const [k, v] of Object.entries(s.theme.vars || {})) if (v) root.style.setProperty(k, v);
  setStyle('sp-custom-css', s.theme.customCss || '');

  // font
  const f = s.font || {};
  let css = '';
  let family = f.family || '';
  if (f.googleFont) {
    setLink('sp-gfont', `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.googleFont).replace(/%20/g, '+')}:wght@400;600&display=swap`);
    family = `"${f.googleFont}", ${family || 'sans-serif'}`;
  } else setLink('sp-gfont', '');
  if (f.dataUrl) {
    css += `@font-face{font-family:"StartCustom";src:url("${f.dataUrl}");font-display:swap}`;
    family = `"StartCustom", ${family || 'sans-serif'}`;
  }
  setStyle('sp-font', css);
  if (family) root.style.setProperty('--font', family); else root.style.removeProperty('--font');

  // background
  const b = s.background || {};
  const body = document.body;
  body.style.background = '';
  body.style.backgroundSize = '';
  if (b.type === 'color' && b.value) body.style.background = b.value;
  else if (b.type === 'gradient' && b.value) body.style.background = b.value;
  else if ((b.type === 'image' || b.type === 'upload') && b.value) {
    body.style.background = `center / cover fixed no-repeat url("${b.value.replace(/"/g, '%22')}") var(--bg)`;
  }
  body.classList.toggle('has-bg', !!(b.type !== 'none' && b.value));

  // title + favicon
  document.title = s.title || 'startpage';
  const fav = s.favicon || {};
  let href = defaultIcon;
  if (fav.type === 'emoji' && fav.value) href = emojiFavicon(fav.value);
  else if ((fav.type === 'url' || fav.type === 'upload') && fav.value) href = fav.value;
  setFavicon(href);
}

mq?.addEventListener?.('change', () => { if (current?.theme.mode === 'auto') applyAppearance(current); });

function setStyle(id, css) {
  let el = document.getElementById(id);
  if (!css) { el?.remove(); return; }
  if (!el) { el = document.createElement('style'); el.id = id; document.head.append(el); }
  if (el.textContent !== css) el.textContent = css;
}

function setLink(id, href) {
  let el = document.getElementById(id);
  if (!href) { el?.remove(); return; }
  if (!el) { el = document.createElement('link'); el.id = id; el.rel = 'stylesheet'; document.head.append(el); }
  if (el.href !== href) el.href = href;
}

function setFavicon(href) {
  if (!href) return;
  const old = document.querySelector('link[rel~="icon"]');
  if (old && old.href === href) return;
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = href;
  if (href.startsWith('data:image/svg')) link.type = 'image/svg+xml';
  old?.remove();
  document.head.append(link);
}
