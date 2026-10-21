import { register } from '../core/widgets.js';
import { h, fetchJSON, cached } from '../core/util.js';
import { evaluate } from '../core/calc.js';

/* ---- calculator ---- */
register({
  type: 'calculator',
  name: 'Calculator',
  icon: '🧮',
  description: 'Type an expression (2*(3+4), sqrt(2), 20% of via 20/100*x, pi…); history kept.',
  card: true,
  defaults: { history: [] },
  schema: [],
  render(el, ctx) {
    let hist = [...(ctx.config.history || [])];
    const input = h('input', { type: 'text', placeholder: 'e.g. (12.5 + 7.5) * 3 ^ 2', 'aria-label': 'Expression', autocomplete: 'off', spellcheck: false });
    const out = h('div.calc-out', { role: 'status', 'aria-live': 'polite' }, ' ');
    const list = h('ul.calc-hist');
    const drawHist = () => list.replaceChildren(...hist.slice(-5).reverse().map(x => h('li', h('button.link', { onclick: () => { input.value = String(x.r); input.focus(); } }, `${x.e} = ${x.r}`))));
    input.addEventListener('input', () => { try { out.textContent = input.value.trim() ? '= ' + +evaluate(input.value).toPrecision(12) : ' '; out.classList.remove('err'); } catch (e) { out.textContent = input.value.trim() ? '…' : ' '; } });
    input.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      try {
        const r = +evaluate(input.value).toPrecision(12);
        hist.push({ e: input.value, r }); hist = hist.slice(-20); ctx.save({ history: hist });
        input.value = String(r); out.textContent = '= ' + r; drawHist();
      } catch (er) { out.textContent = '⚠ ' + er.message; out.classList.add('err'); }
    });
    el.replaceChildren(h('div.calc', input, out, list));
    drawHist();
  },
});

/* ---- converter ---- */
const UNITS = {
  Length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254 },
  Mass: { kg: 1, g: 0.001, mg: 1e-6, lb: 0.45359237, oz: 0.028349523125, st: 6.35029318 },
  Volume: { L: 1, mL: 0.001, 'gal (US)': 3.785411784, 'qt (US)': 0.946352946, 'pt (US)': 0.473176473, 'cup (US)': 0.2365882365, 'fl oz (US)': 0.0295735295625, tbsp: 0.01478676478125, tsp: 0.00492892159375 },
  Speed: { 'm/s': 1, 'km/h': 1 / 3.6, mph: 0.44704, kn: 0.514444 },
  Area: { 'm²': 1, 'km²': 1e6, ha: 1e4, acre: 4046.8564224, 'ft²': 0.09290304, 'mi²': 2589988.110336 },
  Time: { s: 1, min: 60, h: 3600, day: 86400, week: 604800 },
  Data: { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, KiB: 1024, MiB: 1048576, GiB: 1073741824 },
  Temperature: { '°C': 1, '°F': 1, K: 1 },
};
const toC = (v, u) => (u === '°F' ? (v - 32) * 5 / 9 : u === 'K' ? v - 273.15 : v);
const fromC = (v, u) => (u === '°F' ? v * 9 / 5 + 32 : u === 'K' ? v + 273.15 : v);
const fmt = n => (Math.abs(n) >= 1e9 || (Math.abs(n) < 1e-4 && n !== 0) ? n.toExponential(4) : +n.toPrecision(8)).toString();

register({
  type: 'converter',
  name: 'Currency & unit converter',
  icon: '💱',
  description: 'Units offline; currencies from Frankfurter (ECB reference rates, no key).',
  card: true,
  defaults: { category: 'Currency', from: 'USD', to: 'EUR', amount: 1 },
  schema: [],
  async render(el, ctx) {
    const c = { ...ctx.config };
    const cats = ['Currency', ...Object.keys(UNITS)];
    let currencies = null;
    const amount = h('input', { type: 'number', step: 'any', value: c.amount, 'aria-label': 'Amount' });
    const from = h('select', { 'aria-label': 'From' }), to = h('select', { 'aria-label': 'To' });
    const cat = h('select', { 'aria-label': 'Category' }, cats.map(k => h('option', { selected: k === c.category }, k)));
    const out = h('div.calc-out', { role: 'status', 'aria-live': 'polite' }, ' ');

    const fillUnits = async () => {
      let names;
      if (c.category === 'Currency') {
        try { currencies ||= await cached('fx.list', 86400e3, () => fetchJSON('https://api.frankfurter.dev/v1/currencies')); names = Object.keys(currencies).concat('EUR').filter((v, i, a) => a.indexOf(v) === i).sort(); }
        catch { names = ['USD', 'EUR', 'GBP', 'JPY']; out.textContent = 'Currency list unavailable'; }
      } else names = Object.keys(UNITS[c.category]);
      for (const [sel, key, dflt] of [[from, 'from', 0], [to, 'to', 1]]) {
        sel.replaceChildren(...names.map(n => h('option', { value: n, selected: n === c[key] }, n)));
        if (!names.includes(c[key])) { c[key] = names[dflt] || names[0]; sel.value = c[key]; }
      }
    };
    const calc = async () => {
      const v = parseFloat(amount.value);
      if (!Number.isFinite(v)) { out.textContent = ' '; return; }
      c.amount = v; c.from = from.value; c.to = to.value; c.category = cat.value;
      ctx.save({ category: c.category, from: c.from, to: c.to, amount: c.amount });
      try {
        if (c.category === 'Currency') {
          if (c.from === c.to) { out.textContent = `${fmt(v)} ${c.to}`; return; }
          const d = await cached(`fx.${c.from}.${c.to}`, 3600e3, () => fetchJSON(`https://api.frankfurter.dev/v1/latest?base=${c.from}&symbols=${c.to}`));
          out.textContent = `${fmt(v)} ${c.from} = ${fmt(v * d.rates[c.to])} ${c.to}  ·  ECB rates ${d.date}`;
        } else if (c.category === 'Temperature') out.textContent = `${fmt(v)} ${c.from} = ${fmt(fromC(toC(v, c.from), c.to))} ${c.to}`;
        else { const u = UNITS[c.category]; out.textContent = `${fmt(v)} ${c.from} = ${fmt(v * u[c.from] / u[c.to])} ${c.to}`; }
      } catch (e) { out.textContent = '⚠ ' + e.message; }
    };
    cat.addEventListener('change', async () => { c.category = cat.value; c.from = c.to = ''; await fillUnits(); calc(); });
    for (const x of [amount, from, to]) x.addEventListener('input', calc);
    el.replaceChildren(h('div.conv', cat, h('div.row', amount, from, h('span', { 'aria-hidden': true }, '→'), to), out));
    await fillUnits();
    calc();
  },
});
