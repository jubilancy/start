var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var MAX_BYTES = 5 * 1024 * 1024;
var UA = "Mozilla/5.0 (compatible; StartPageWorker/1.0)";
var src_default = {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      const res = await route(req, env, ctx, url);
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    } catch (e) {
      const status = e.status || 500;
      return json({ error: e.message || String(e) }, status, cors);
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(Promise.all([runUptime(env), runWatch(env)]));
  }
};
async function route(req, env, ctx, url) {
  const p = url.pathname.replace(/\/+$/, "") || "/";
  if (p === "/" || p === "/health") {
    return json({ ok: true, auth: !!env.START_TOKEN, kv: !!env.KV, raindrop: !!env.RAINDROP_TOKEN });
  }
  auth(req, env);
  if (p === "/proxy" && req.method === "GET") return proxy(req, ctx, url);
  if (p === "/quote" && req.method === "GET") return quote(ctx, url);
  if (p === "/inbox") {
    if (req.method === "POST") return inboxAdd(req, env);
    if (req.method === "GET") return inboxList(env, +url.searchParams.get("limit") || 50);
  }
  if (p.startsWith("/inbox/") && req.method === "DELETE") return inboxDelete(env, decodeURIComponent(p.slice(7)));
  if (p === "/sync") {
    requireKV(env);
    if (req.method === "GET") return new Response(await env.KV.get("sync:config") || "null", { headers: JSON_H });
    if (req.method === "PUT") {
      const body = await readLimited(req, 2 * 1024 * 1024);
      JSON.parse(body);
      await env.KV.put("sync:config", body);
      return json({ ok: true, bytes: body.length });
    }
  }
  if (p === "/uptime/sites" || p === "/watch/sites") {
    requireKV(env);
    const key = p === "/uptime/sites" ? "uptime:sites" : "watch:sites";
    if (req.method === "GET") return new Response(await env.KV.get(key) || "[]", { headers: JSON_H });
    if (req.method === "PUT") {
      const list = JSON.parse(await readLimited(req, 64 * 1024));
      if (!Array.isArray(list) || list.length > 50) throw httpErr(400, "Expected an array of at most 50 sites");
      for (const s of list) assertPublicUrl(s.url);
      await env.KV.put(key, JSON.stringify(list.map((s) => ({ name: String(s.name || s.url).slice(0, 80), url: s.url, selector: s.selector ? String(s.selector).slice(0, 200) : void 0 }))));
      return json({ ok: true });
    }
  }
  if (p === "/uptime" && req.method === "GET") {
    requireKV(env);
    return new Response(await env.KV.get("uptime:data") || "{}", { headers: JSON_H });
  }
  if (p === "/watch" && req.method === "GET") {
    requireKV(env);
    return new Response(await env.KV.get("watch:data") || "{}", { headers: JSON_H });
  }
  if (p === "/cron/run" && req.method === "POST") {
    await Promise.all([runUptime(env), runWatch(env)]);
    return json({ ok: true });
  }
  if (p.startsWith("/raindrop/")) return raindrop(env, p.slice(10), url);
  throw httpErr(404, "Not found");
}
__name(route, "route");
var JSON_H = { "content-type": "application/json; charset=utf-8" };
var json = /* @__PURE__ */ __name((obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { ...JSON_H, ...extra } }), "json");
var httpErr = /* @__PURE__ */ __name((status, message) => Object.assign(new Error(message), { status }), "httpErr");
var requireKV = /* @__PURE__ */ __name((env) => {
  if (!env.KV) throw httpErr(503, "KV binding missing");
}, "requireKV");
function corsHeaders(req, env) {
  const origin = req.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = origin && (allowed.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  return ok ? {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400"
  } : {};
}
__name(corsHeaders, "corsHeaders");
function auth(req, env) {
  if (!env.START_TOKEN) throw httpErr(503, "START_TOKEN secret is not set on the Worker");
  const got = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!timingSafeEqual(got, env.START_TOKEN)) throw httpErr(401, "Bad or missing token");
}
__name(auth, "auth");
function timingSafeEqual(a, b) {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let d = 0;
  for (let i = 0; i < ea.length; i++) d |= ea[i] ^ eb[i];
  return d === 0;
}
__name(timingSafeEqual, "timingSafeEqual");
function assertPublicUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw httpErr(400, "Invalid URL");
  }
  if (!["http:", "https:"].includes(u.protocol)) throw httpErr(400, "Only http(s) URLs");
  const h = u.hostname;
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(h) || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|\[?f[cd])/i.test(h)) throw httpErr(400, "Private addresses are not allowed");
  return u;
}
__name(assertPublicUrl, "assertPublicUrl");
async function readLimited(req, max) {
  const t = await req.text();
  if (t.length > max) throw httpErr(413, "Body too large");
  return t;
}
__name(readLimited, "readLimited");
async function limitedText(res, max = MAX_BYTES) {
  const reader = res.body.getReader();
  const chunks = [];
  let n = 0;
  for (; ; ) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > max) {
      reader.cancel();
      throw httpErr(413, "Upstream response too large");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) {
    all.set(c, o);
    o += c.length;
  }
  return { bytes: all, type: res.headers.get("content-type") || "application/octet-stream" };
}
__name(limitedText, "limitedText");
async function proxy(req, ctx, url) {
  const target = assertPublicUrl(url.searchParams.get("url") || "");
  const cache = caches.default;
  const key = new Request(`https://cache.invalid/proxy?u=${encodeURIComponent(target.href)}`);
  const hit = await cache.match(key);
  if (hit) return new Response(hit.body, hit);
  const up = await fetch(target.href, {
    headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, application/json, text/calendar, text/xml, */*;q=0.8" },
    redirect: "follow",
    cf: { cacheTtl: 300, cacheEverything: true }
  });
  if (!up.ok) throw httpErr(502, `Upstream HTTP ${up.status}`);
  const { bytes, type } = await limitedText(up);
  const res = new Response(bytes, { status: 200, headers: { "content-type": type, "cache-control": "public, max-age=300" } });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}
__name(proxy, "proxy");
async function quote(ctx, url) {
  const symbols = (url.searchParams.get("symbols") || "").split(",").map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z0-9.^=-]{1,12}$/.test(s)).slice(0, 20);
  if (!symbols.length) throw httpErr(400, "symbols required");
  const cache = caches.default;
  const key = new Request(`https://cache.invalid/quote?s=${symbols.join(",")}`);
  const hit = await cache.match(key);
  if (hit) return new Response(hit.body, hit);
  const out = await Promise.all(symbols.map(async (s) => {
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=1d&interval=1d`, { headers: { "User-Agent": UA } });
      if (!r.ok) return { symbol: s, error: `HTTP ${r.status}` };
      const m = (await r.json()).chart?.result?.[0]?.meta;
      if (!m) return { symbol: s, error: "no data" };
      const price = m.regularMarketPrice, prev = m.chartPreviousClose ?? m.previousClose;
      return { symbol: s, name: m.shortName || m.longName || s, price, prev, change: prev ? price - prev : null, pct: prev ? (price - prev) / prev * 100 : null, currency: m.currency };
    } catch (e) {
      return { symbol: s, error: e.message };
    }
  }));
  const res = json({ quotes: out, t: Date.now() }, 200, { "cache-control": "public, max-age=60" });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}
__name(quote, "quote");
async function inboxAdd(req, env) {
  requireKV(env);
  const b = JSON.parse(await readLimited(req, 32 * 1024));
  const text = String(b.text || "").trim().slice(0, 8e3);
  if (!text) throw httpErr(400, "text required");
  const now = Date.now();
  const id = `${String(9999999999999 - now).padStart(13, "0")}-${crypto.randomUUID().slice(0, 6)}`;
  const item = { id, text, url: b.url ? String(b.url).slice(0, 2e3) : void 0, tags: Array.isArray(b.tags) ? b.tags.slice(0, 10).map(String) : void 0, t: now };
  await env.KV.put("inbox:" + id, JSON.stringify(item));
  return json({ ok: true, item });
}
__name(inboxAdd, "inboxAdd");
async function inboxList(env, limit) {
  requireKV(env);
  const l = await env.KV.list({ prefix: "inbox:", limit: Math.min(200, Math.max(1, limit)) });
  const items = (await Promise.all(l.keys.map((k) => env.KV.get(k.name, "json")))).filter(Boolean);
  return json({ items, more: !l.list_complete });
}
__name(inboxList, "inboxList");
async function inboxDelete(env, id) {
  requireKV(env);
  await env.KV.delete("inbox:" + id);
  return json({ ok: true });
}
__name(inboxDelete, "inboxDelete");
async function raindrop(env, sub, url) {
  if (!env.RAINDROP_TOKEN) throw httpErr(503, "RAINDROP_TOKEN secret is not set on the Worker");
  let path;
  if (sub === "collections") path = "/collections";
  else if (sub === "items") {
    const c = parseInt(url.searchParams.get("collection") || "0", 10);
    const q = new URLSearchParams({ perpage: String(Math.min(50, +url.searchParams.get("perpage") || 50)), page: String(+url.searchParams.get("page") || 0), sort: url.searchParams.get("sort") || "-created" });
    if (url.searchParams.get("search")) q.set("search", url.searchParams.get("search"));
    path = `/raindrops/${Number.isFinite(c) ? c : 0}?${q}`;
  } else throw httpErr(404, "Unknown raindrop route");
  const r = await fetch("https://api.raindrop.io/rest/v1" + path, { headers: { Authorization: `Bearer ${env.RAINDROP_TOKEN}` }, cf: { cacheTtl: 120 } });
  return new Response(await r.text(), { status: r.status, headers: { ...JSON_H, "cache-control": "private, max-age=120" } });
}
__name(raindrop, "raindrop");
async function runUptime(env) {
  if (!env.KV) return;
  const sites = JSON.parse(await env.KV.get("uptime:sites") || "[]");
  if (!sites.length) return;
  const data = JSON.parse(await env.KV.get("uptime:data") || "{}");
  await Promise.all(sites.map(async (s) => {
    const t0 = Date.now();
    let ok = false, status = 0;
    try {
      const r = await fetch(s.url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(1e4) });
      status = r.status;
      ok = r.status < 500;
      r.body?.cancel();
    } catch {
    }
    const d = data[s.url] || (data[s.url] = { name: s.name, hist: [] });
    d.name = s.name;
    d.last = { t: t0, ok, status, ms: Date.now() - t0 };
    d.hist.push([t0, ok ? 1 : 0, d.last.ms]);
    if (d.hist.length > 288) d.hist.splice(0, d.hist.length - 288);
  }));
  for (const u of Object.keys(data)) if (!sites.some((s) => s.url === u)) delete data[u];
  await env.KV.put("uptime:data", JSON.stringify(data));
}
__name(runUptime, "runUptime");
async function sha256(text) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
__name(sha256, "sha256");
async function extractText(res, selector) {
  if (selector) {
    let text = "";
    await new HTMLRewriter().on(selector, { text(t) {
      text += t.text;
    } }).transform(res).text();
    return text.replace(/\s+/g, " ").trim();
  }
  const html = await res.text();
  return html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
__name(extractText, "extractText");
async function runWatch(env) {
  if (!env.KV) return;
  const sites = JSON.parse(await env.KV.get("watch:sites") || "[]");
  if (!sites.length) return;
  const data = JSON.parse(await env.KV.get("watch:data") || "{}");
  await Promise.all(sites.map(async (s) => {
    const now = Date.now();
    const d = data[s.url] || (data[s.url] = { name: s.name, since: now });
    d.name = s.name;
    try {
      const r = await fetch(s.url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(15e3) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const text = (await extractText(r, s.selector)).slice(0, 2e5);
      const hash = await sha256(text);
      if (d.hash && d.hash !== hash) d.changedAt = now;
      d.hash = hash;
      d.snippet = text.slice(0, 160);
      d.error = void 0;
    } catch (e) {
      d.error = e.message;
    }
    d.checkedAt = now;
  }));
  for (const u of Object.keys(data)) if (!sites.some((s) => s.url === u)) delete data[u];
  await env.KV.put("watch:data", JSON.stringify(data));
}
__name(runWatch, "runWatch");

// ../../../../tmp/claude-0/-home-user-start/4b176add-6e14-559e-86a3-21e95d89fb4a/scratchpad/wr/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../tmp/claude-0/-home-user-start/4b176add-6e14-559e-86a3-21e95d89fb4a/scratchpad/wr/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-KTmYF1/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../../tmp/claude-0/-home-user-start/4b176add-6e14-559e-86a3-21e95d89fb4a/scratchpad/wr/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-KTmYF1/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
