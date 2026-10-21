// Bookmark import (browser Netscape HTML incl. Raindrop HTML export, Raindrop CSV) + text codec for link groups.

/** → [{name, items:[{title,url,icon}]}] */
export function parseBookmarkHTML(text) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const groups = new Map();
  for (const a of doc.querySelectorAll('a[href]')) {
    const url = a.getAttribute('href');
    if (!/^https?:/i.test(url)) continue;
    const path = [];
    let dl = a.closest('dl');
    while (dl) {
      const h3 = dl.previousElementSibling?.matches('h3') ? dl.previousElementSibling : dl.parentElement?.querySelector(':scope > h3');
      if (h3) path.unshift(h3.textContent.trim());
      dl = dl.parentElement?.closest('dl');
    }
    const name = path.join(' / ') || 'Imported';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push({ title: a.textContent.trim() || url, url, icon: '' });
  }
  return [...groups].map(([name, items]) => ({ name, items }));
}

export function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x));
}

/** Raindrop CSV (columns are matched by header name). */
export function parseBookmarkCSV(text) {
  const rows = parseCSV(text);
  const head = rows.shift().map(x => x.trim().toLowerCase());
  const col = n => head.indexOf(n);
  const iUrl = col('url'), iTitle = col('title'), iFolder = col('folder');
  if (iUrl < 0) throw new Error('CSV has no "url" column');
  const groups = new Map();
  for (const r of rows) {
    const url = r[iUrl];
    if (!/^https?:/i.test(url || '')) continue;
    const name = (iFolder >= 0 && r[iFolder]) || 'Imported';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push({ title: (iTitle >= 0 && r[iTitle]) || url, url, icon: '' });
  }
  return [...groups].map(([name, items]) => ({ name, items }));
}

export function parseBookmarkFile(file) {
  const looksCSV = /\.csv$/i.test(file.name) || /^\s*"?id"?,/i.test(file.data) || /(^|,)"?url"?(,|$)/i.test(file.data.split('\n')[0]);
  return looksCSV ? parseBookmarkCSV(file.data) : parseBookmarkHTML(file.data);
}

/* Text codec used by the links settings box:
 *   # Group name
 *   Title | https://url | optional icon (si:github, lucide:search, 🔥, https://…/icon.png)
 */
export function groupsToText(groups = []) {
  return groups.map(g => [g.name ? `# ${g.name}` : '#', ...g.items.map(i => [i.title, i.url, i.icon].filter((x, n) => n < 2 || x).join(' | '))].join('\n')).join('\n\n');
}

export function textToGroups(text) {
  const groups = [];
  let cur = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) { cur = { name: line.replace(/^#+\s*/, ''), items: [] }; groups.push(cur); continue; }
    if (!cur) { cur = { name: '', items: [] }; groups.push(cur); }
    const [title, url, icon = ''] = line.split('|').map(s => s.trim());
    if (url) cur.items.push({ title, url, icon });
    else if (/^https?:|^[\w.-]+\.\w{2,}/.test(title)) cur.items.push({ title: title.replace(/^https?:\/\//, ''), url: /^https?:/.test(title) ? title : 'https://' + title, icon });
  }
  return groups;
}
