import { register } from '../core/widgets.js';
import { h, fetchJSON, cached } from '../core/util.js';
import { workerJSON, hasWorker } from '../core/worker.js';

const money = (n, cur = 'USD') => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur.toUpperCase(), maximumFractionDigits: n < 1 ? 4 : 2 }).format(n); } catch { return String(n); } };
const list = s => (s || '').split(/[,\s]+/).map(x => x.trim()).filter(Boolean);

async function crypto(ids, vs) {
  if (!ids.length) return [];
  const d = await cached(`cg.${ids}.${vs}`, 60e3, () => fetchJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(','))}&vs_currencies=${vs}&include_24hr_change=true`));
  return ids.map(id => d[id] ? { sym: id, price: d[id][vs], pct: d[id][`${vs}_24h_change`], cur: vs } : { sym: id, error: 'unknown id' });
}

async function stocks(symbols) {
  if (!symbols.length) return [];
  if (!hasWorker()) return symbols.map(s => ({ sym: s, error: 'needs Worker' }));
  const d = await cached(`q.${symbols}`, 60e3, () => workerJSON(`/quote?symbols=${encodeURIComponent(symbols.join(','))}`));
  return d.quotes.map(q => q.error ? { sym: q.symbol, error: q.error } : { sym: q.symbol, name: q.name, price: q.price, pct: q.pct, cur: q.currency });
}

async function paint(el, ctx) {
  const c = ctx.config;
  const ul = h('ul.ticker');
  el.replaceChildren(ul);
  ul.append(h('li.muted', 'Loading…'));
  const [cr, st] = await Promise.allSettled([crypto(list(c.crypto), (c.vs || 'usd').toLowerCase()), stocks(list(c.stocks).map(s => s.toUpperCase()))]);
  const rows = [...(cr.status === 'fulfilled' ? cr.value : [{ sym: 'crypto', error: cr.reason.message }]), ...(st.status === 'fulfilled' ? st.value : [{ sym: 'stocks', error: st.reason.message }])];
  ul.replaceChildren(...rows.map(r => r.error
    ? h('li', h('span.tk-sym', r.sym), h('span.err', r.error))
    : h('li', h('span.tk-sym', r.sym), h('span.muted', r.name || ''), h('span.tk-price', money(r.price, r.cur)),
      h('span.tk-pct', { class: r.pct >= 0 ? 'up' : 'down' }, `${r.pct >= 0 ? '▲' : '▼'} ${Math.abs(r.pct ?? 0).toFixed(2)}%`))));
  if (!rows.length) ul.append(h('li.muted', 'Add coins/symbols in widget settings.'));
}

register({
  type: 'ticker',
  name: 'Stocks & crypto',
  icon: '📈',
  description: 'Crypto via CoinGecko (browser); stocks via the Worker /quote (Yahoo chart endpoint).',
  card: true,
  refreshEvery: 120,
  defaults: { crypto: 'bitcoin, ethereum', vs: 'usd', stocks: '' },
  schema: [
    { key: 'crypto', label: 'CoinGecko coin ids (comma separated)', type: 'text', help: 'e.g. bitcoin, ethereum, solana — ids from coingecko.com/en/coins/<id>' },
    { key: 'vs', label: 'Quote currency', type: 'text' },
    { key: 'stocks', label: 'Stock symbols (needs Worker)', type: 'text', help: 'e.g. AAPL, MSFT, ^GSPC. Unofficial Yahoo data — may break.' },
  ],
  render: paint,
  refresh: paint,
});
