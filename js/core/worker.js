// Client for the optional Cloudflare Worker (see /worker). Browser-only features keep working without it.
import { settings } from './store.js';
import { fetchRaw } from './util.js';

export const workerBase = () => (settings().workerUrl || '').replace(/\/+$/, '');
export const hasWorker = () => !!workerBase();

function headers(extra = {}) {
  const t = settings().workerToken;
  return { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...extra };
}

export async function workerFetch(path, opts = {}, ms) {
  if (!hasWorker()) throw new Error('Worker URL not set (Settings → Integrations)');
  return fetchRaw(workerBase() + path, { ...opts, headers: headers(opts.headers) }, ms);
}
export const workerJSON = async (path, opts, ms) => (await workerFetch(path, opts, ms)).json();

export const proxyUrl = url => `${workerBase()}/proxy?url=${encodeURIComponent(url)}`;

/** Fetch text directly; if blocked (CORS/network) fall back to the Worker proxy when configured. */
export async function fetchViaProxy(url, ms = 15000) {
  try {
    return await (await fetchRaw(url, {}, ms)).text();
  } catch (direct) {
    if (!hasWorker()) {
      const e = new Error('Blocked by CORS — set a Worker URL in Settings → Integrations to proxy this URL');
      e.cause = direct;
      throw e;
    }
    return (await workerFetch(`/proxy?url=${encodeURIComponent(url)}`, {}, ms)).text();
  }
}
