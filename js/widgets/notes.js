import { register } from '../core/widgets.js';
import { h, debounce, download } from '../core/util.js';
import { renderMarkdown } from '../core/markdown.js';

const COLORS = { none: '', yellow: '#fff3b0', green: '#d8f0c8', blue: '#d3e6fb', pink: '#fbd5e3', purple: '#e4d9f7' };

function paint(el, ctx) {
  const c = ctx.config;
  let editing = !c.text;
  const box = h('div.note', { style: COLORS[c.color] ? { background: COLORS[c.color], color: '#1a1a1a' } : {} });
  const save = debounce(text => ctx.save({ text }), 400);
  const draw = () => {
    const bar = h('div.note-bar',
      h('button', { title: editing ? 'Preview' : 'Edit', 'aria-label': editing ? 'Preview' : 'Edit', onclick: () => { save.flush(c.text || ''); editing = !editing; draw(); } }, editing ? '👁' : '✎'),
      ...Object.entries(COLORS).map(([k, v]) => h('button.swatch', { title: k, 'aria-label': `Color ${k}`, 'aria-pressed': String(c.color === k), style: { background: v || 'var(--card)' }, onclick: () => { ctx.save({ color: k }); ctx.rerender(); } })),
      h('span.grow'),
      h('button', { title: 'Export as .md', 'aria-label': 'Export note', onclick: () => download('note.md', c.text || '', 'text/markdown') }, '⤓'));
    let body;
    if (editing) {
      body = h('textarea.note-text', { value: c.text || '', placeholder: 'Write markdown… (autosaves)', 'aria-label': 'Note', rows: c.rows || 8, oninput: e => { c.text = e.target.value; save(e.target.value); } });
    } else {
      body = h('div.note-view', { tabindex: 0, ondblclick: () => { editing = true; draw(); } }, renderMarkdown(c.text));
    }
    box.replaceChildren(bar, body);
    if (editing && !c.text) body.focus();
  };
  draw();
  el.replaceChildren(box);
}

register({
  type: 'notes',
  name: 'Sticky note',
  icon: '📝',
  description: 'Markdown note with colors, autosave and .md export. Add several for several notes.',
  defaults: { text: '', color: 'yellow', rows: 8 },
  schema: [
    { key: 'color', label: 'Color', type: 'select', options: Object.keys(COLORS).map(k => [k, k]) },
    { key: 'rows', label: 'Editor rows', type: 'number', min: 3, max: 40 },
    { key: 'text', label: 'Text (markdown)', type: 'textarea', rows: 8 },
  ],
  render: paint,
});
