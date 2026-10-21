import { register } from '../core/widgets.js';
import { h, uid, isoDay } from '../core/util.js';

function paint(el, ctx) {
  let items = [...(ctx.config.items || [])];
  const today = isoDay();
  const commit = () => { ctx.save({ items }); draw(); };
  const text = h('input', { type: 'text', placeholder: 'Add a task…', 'aria-label': 'New task' });
  const due = h('input', { type: 'date', 'aria-label': 'Due date' });
  const add = () => {
    const t = text.value.trim();
    if (!t) return;
    items.push({ id: uid('t'), text: t, done: false, due: due.value || '' });
    text.value = ''; due.value = '';
    commit(); el.querySelector('input[type=text]')?.focus();
  };
  const form = h('form.todo-add', { onsubmit: e => { e.preventDefault(); add(); } }, text, due, h('button', { type: 'submit', 'aria-label': 'Add task' }, '+'));
  const list = h('ul.todo-list');

  function draw() {
    const sorted = [...items].sort((a, b) => (a.done - b.done) || ((a.due || '9999') > (b.due || '9999') ? 1 : -1));
    const shown = ctx.config.hideDone ? sorted.filter(i => !i.done) : sorted;
    list.replaceChildren(...shown.map(i => {
      const status = !i.due || i.done ? '' : i.due < today ? 'overdue' : i.due === today ? 'today' : '';
      return h('li', { class: `${i.done ? 'done ' : ''}${status}` },
        h('input', { type: 'checkbox', checked: i.done, 'aria-label': i.text, onchange: e => { i.done = e.target.checked; commit(); } }),
        h('span.todo-text', i.text),
        i.due && h('span.todo-due', i.due === today ? 'today' : new Date(i.due + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
        h('button.x', { 'aria-label': `Delete ${i.text}`, onclick: () => { items = items.filter(x => x !== i); commit(); } }, '✕'));
    }));
    if (!shown.length) list.append(h('li.muted', 'Nothing to do 🎉'));
    const doneN = items.filter(i => i.done).length;
    foot.replaceChildren(...[h('span.muted', `${items.length - doneN} open`), doneN ? h('button.link', { onclick: () => { items = items.filter(i => !i.done); commit(); } }, `Clear ${doneN} done`) : null].filter(Boolean));
  }
  const foot = h('div.todo-foot');
  el.replaceChildren(h('div.todo', form, list, foot));
  draw();
}

register({
  type: 'todo',
  name: 'To-do list',
  icon: '✅',
  description: 'Tasks with optional due dates; overdue and due-today highlighted.',
  card: true,
  defaults: { items: [], hideDone: false },
  schema: [{ key: 'hideDone', label: 'Hide completed tasks', type: 'checkbox' }],
  render: paint,
});
