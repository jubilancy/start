// Small shared helpers: DOM builder, formatting, fetch wrappers.

/** h('div.class#id', {attr: v, onclick: fn}, ...children) */
export function h(tag, attrs, ...kids) {
  const m = /^([a-z0-9-]+)((?:[.#][\w-]+)*)$/i.exec(tag);
  const el = document.createElement(m ? m[1] : tag);
  if (m && m[2]) {
    for (const part of m[2].match(/[.#][\w-]+/g)) {
      if (part[0] === '.') el.classList.add(part.slice(1));
      else el.id = part.slice(1);
    }
  }
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs) || typeof attrs === 'string')) {
    kids.unshift(attrs);
    attrs = null;
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') { for (const [p, val] of Object.entries(v)) { if (p.startsWith('--')) el.style.setProperty(p, val); else el.style[p] = val; } }
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const uid = (p = 'w') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);

export function debounce(fn, ms = 300) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); fn(...a); };
  return d;
}

export const clone = o => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

export function deepMerge(base, over) {
  if (Array.isArray(over) || typeof over !== 'object' || over === null) return over === undefined ? base : over;
  const out = { ...(base && typeof base === 'object' && !Array.isArray(base) ? base : {}) };
  for (const [k, v] of Object.entries(over)) out[k] = deepMerge(out[k], v);
  return out;
}

/** Only allow http(s)/mailto/relative links; blocks javascript: and data: in hrefs. */
export function safeUrl(u) {
  try {
    const x = new URL(u, location.href);
    return ['http:', 'https:', 'mailto:'].includes(x.protocol) ? x.href : '#';
  } catch { return '#'; }
}

export function hostOf(u) {
  try { return new URL(u).hostname; } catch { return ''; }
}

export function timeAgo(d) {
  const t = new Date(d);
  if (isNaN(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return t.toLocaleDateString();
}

export const pad = n => String(n).padStart(2, '0');
export const isoDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** fetch with timeout + status check. */
export async function fetchRaw(url, opts = {}, ms = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r;
  } finally { clearTimeout(t); }
}
export const fetchJSON = async (url, opts, ms) => (await fetchRaw(url, opts, ms)).json();
export const fetchText = async (url, opts, ms) => (await fetchRaw(url, opts, ms)).text();

/** Tiny TTL cache in sessionStorage so widgets don't refetch on every tab switch. */
const inflight = new Map();
export async function cached(key, ttlMs, loader) {
  const k = 'sp.cache.' + key;
  try {
    const hit = JSON.parse(sessionStorage.getItem(k) || 'null');
    if (hit && Date.now() - hit.t < ttlMs) return hit.v;
  } catch { /* ignore */ }
  if (inflight.has(k)) return inflight.get(k);
  const p = (async () => {
    const v = await loader();
    try { sessionStorage.setItem(k, JSON.stringify({ t: Date.now(), v })); } catch { /* quota */ }
    return v;
  })().finally(() => inflight.delete(k));
  inflight.set(k, p);
  return p;
}

export function download(name, text, type = 'application/json') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function pickFile(accept = '', asText = true) {
  return new Promise(res => {
    const i = h('input', { type: 'file', accept });
    i.onchange = async () => {
      const f = i.files[0];
      if (!f) return res(null);
      res({ name: f.name, type: f.type, data: asText ? await f.text() : f });
    };
    i.click();
  });
}

/** Downscale an image File to a data URL (keeps localStorage small). */
export function imageToDataURL(file, max = 256, type = 'image/png', q = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = h('canvas', { width: Math.round(img.width * r), height: Math.round(img.height * r) });
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL(type, q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });
}

export function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
