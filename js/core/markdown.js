// Tiny safe Markdown → DOM (no innerHTML of user text). Supports headings, **bold**, *italic*, `code`, [links](url),
// - / * lists, - [ ] / - [x] task items, > quotes, ``` fences, --- rules.
import { h, safeUrl } from './util.js';

function inline(text) {
  const out = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))|(https?:\/\/[^\s<]+)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (m[1]) out.push(h('code', t.slice(1, -1)));
    else if (m[2]) out.push(h('strong', inline(t.slice(2, -2))));
    else if (m[3]) out.push(h('em', inline(t.slice(1, -1))));
    else if (m[4]) { const [, label, url] = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(t); out.push(h('a', { href: safeUrl(url), target: '_blank', rel: 'noopener noreferrer' }, label)); }
    else out.push(h('a', { href: safeUrl(t), target: '_blank', rel: 'noopener noreferrer' }, t));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function renderMarkdown(src) {
  const root = h('div.md');
  const lines = String(src || '').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; root.append(h('pre', h('code', buf.join('\n')))); continue;
    }
    let m;
    if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) { root.append(h('h' + (m[1].length + 1), inline(m[2]))); i++; continue; }
    if (/^---+\s*$/.test(line)) { root.append(h('hr')); i++; continue; }
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      root.append(h('blockquote', inline(buf.join(' ')))); continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const ul = h('ul');
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const t = lines[i++].replace(/^\s*[-*]\s+/, '');
        const task = /^\[([ xX])\]\s+(.*)$/.exec(t);
        ul.append(task ? h('li.task', h('input', { type: 'checkbox', checked: task[1] !== ' ', disabled: true, 'aria-label': 'task' }), ' ', inline(task[2])) : h('li', inline(t)));
      }
      root.append(ul); continue;
    }
    if (!line.trim()) { i++; continue; }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>\s?|\s*[-*]\s+|---+\s*$)/.test(lines[i])) buf.push(lines[i++]);
    root.append(h('p', buf.flatMap((l, n) => (n ? [h('br'), ...inline(l)] : inline(l)))));
  }
  return root;
}
