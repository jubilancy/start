# Start page

A fully customizable personal start page: vanilla HTML/CSS/JS, **no framework and no build step**, hosted on GitHub Pages at <https://start.glosse.me>. Everything is a widget you can add, drag, resize, restyle and configure from the UI. An optional Cloudflare Worker adds the few things a browser can't do alone.

## How it works

- `index.html` is an empty shell; `js/main.js` registers widgets and boots `js/core/app.js`.
- **Config**: `config.json` is the shipped default. Your edits live in `localStorage` (`startpage.config.v1`) on top of it. Export / import / reset from **Settings → Backup & data**. To make your layout the default on every device, use *Copy config for config.json* and commit it.
- **Layout**: tabs → columns → widgets. Click ✎ to edit: drag the ⠿ handle (or use ▲▼◀▶ buttons for keyboard use), drag the bottom bar to set a height, change column widths, add/remove columns.
- **Widgets** are self-contained modules in `js/widgets/` (see *Writing a widget*).
- **Appearance**: light / dark / follow system, per-variable color overrides, custom CSS, font (system presets, Google Font name, or uploaded font file), background (color, gradient, image URL or upload).
- **Tab title and favicon** are settable from **Settings → General** (emoji, image URL or uploaded image).
- **Command palette**: `Ctrl/Cmd+K` jumps to any link, tab or widget; `/` focuses search.

## Setup

1. Fork/clone this repo and enable GitHub Pages (deploy from `main`, root). Keep the `CNAME` file as is.
2. Edit `config.json` (or edit in the UI and export).
3. Local preview: any static server, e.g. `npx http-server -c-1 .` (ES modules need `http://`, not `file://`).
4. Tests: `npm test`.

## Worker (optional)

`worker/` is a Cloudflare Worker for what a browser can't do: CORS proxy for feeds/ICS, stock quotes, inbox, config sync, Raindrop, and a 5-minute cron for uptime checks and page-change watching. It uses one KV namespace (auto-provisioned on first deploy: [docs](https://developers.cloudflare.com/workers/wrangler/configuration/#automatic-provisioning)) and cron triggers ([docs](https://developers.cloudflare.com/workers/configuration/cron-triggers/)).

**Routes** (all except `/health` need `Authorization: Bearer <START_TOKEN>`; CORS is limited to `ALLOWED_ORIGINS` in `worker/wrangler.jsonc` plus localhost):

| Route | Purpose |
|---|---|
| `GET /health` | Capabilities check |
| `GET /proxy?url=` | Cached (5 min) CORS proxy for RSS/Atom/JSON/ICS; http(s) only, private hosts blocked, 5 MB cap |
| `GET /quote?symbols=AAPL,MSFT` | Stock quotes from Yahoo Finance's chart endpoint (**unofficial**; may break or rate-limit) |
| `POST/GET /inbox`, `DELETE /inbox/:id` | Quick-capture inbox in KV |
| `GET/PUT /sync` | Store/restore the start page config (token excluded) |
| `GET/PUT /uptime/sites`, `GET /uptime` | Sites to ping every 5 min + results |
| `GET/PUT /watch/sites`, `GET /watch` | Pages to hash every 5 min (optional CSS selector) + results |
| `GET /raindrop/collections`, `GET /raindrop/items?collection=ID` | Raindrop proxy ([API docs](https://developer.raindrop.io/v1/collections/methods)) |

### Deploy (GitHub Actions)

Add these **repository secrets** (GitHub → Settings → Secrets and variables → Actions → New repository secret):

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Account API token with the *Edit Cloudflare Workers* template ([guide](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)) |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `START_TOKEN` | Any long random string you invent; becomes the Worker's bearer token |
| `RAINDROP_TOKEN` | *(optional)* Raindrop API token for the Raindrop widgets |

Then run **Actions → Deploy Worker** (it also runs on pushes that touch `worker/`). Afterwards open **Settings → Integrations** on the page, paste the `https://start-worker.<your-subdomain>.workers.dev` URL and the same `START_TOKEN`, and press *Test connection*. To serve it on your domain, add a custom domain in the Cloudflare dashboard and update `ALLOWED_ORIGINS` if you host the page elsewhere.

Local dev: `cd worker && npx wrangler dev --var START_TOKEN:dev`.

### Feeds: why both a Worker and a scheduled Action

RSS defaults to the **Worker proxy**: it is live (5-min edge cache), needs no repo commits, and your private feed list never lands in a public repo. The **scheduled GitHub Action** (`.github/workflows/build-feeds.yml` → `data/feeds/<slug>.json`, referenced as `static:<slug>`) is the no-Cloudflare fallback; it's delayed (hourly cron, GitHub may skip runs) and adds commits, so it only covers feeds listed in `feeds.build.json`.

## Widgets

| Widget | Data source | Docs | Limits |
|---|---|---|---|
| Greeting | Open-Meteo (weather tokens) | [Open-Meteo docs](https://open-meteo.com/en/docs) | Free API: non-commercial, 10,000 calls/day, no uptime guarantee ([pricing](https://open-meteo.com/en/pricing)) |
| Weather (+ forecast strip, city search) | Open-Meteo forecast + geocoding | [forecast](https://open-meteo.com/en/docs) · [geocoding](https://open-meteo.com/en/docs/geocoding-api) | Same; 429 when shared IPs hammer it |
| RSS / News (multi-feed, unread, OPML) | Any RSS/Atom/JSON Feed; `hn:top|new|best` uses the Hacker News Firebase API | [HN Firebase endpoints](https://hacker-news.firebaseio.com/v0/topstories.json) (live-checked; the docs repo page was not reachable from my sandbox) | Most feeds lack CORS headers → need the Worker `/proxy` |
| Calendar (month, ICS agenda, Google embed) | ICS URL via browser/Worker; Google Calendar embed iframe | [Google embed help](https://support.google.com/calendar/answer/41207) | ICS usually needs Worker proxy; embed needs a public calendar or Google sign-in |
| Search | None (builds URLs) | — | — |
| Quick links | Favicon chain: DuckDuckGo → Google s2 → `/favicon.ico` → letter; [Simple Icons](https://simpleicons.org) and [Lucide](https://lucide.dev) via jsDelivr | [jsDelivr](https://www.jsdelivr.com/) | Favicon services are third-party image requests |

(More widgets are added in later milestones; this table is the source of truth for data sources.)

## Writing a widget

Create `js/widgets/mything.js`, import it in `js/main.js`, and call `register()`:

```js
import { register } from '../core/widgets.js';
import { h } from '../core/util.js';

register({
  type: 'mything',                 // unique id stored in config
  name: 'My thing', icon: '🧩', description: 'Shown in the add-widget picker',
  card: false,                     // bordered card by default?
  needsWorker: false,              // show a "set Worker URL" hint when unset
  refreshEvery: 600,               // seconds; paused while the tab is hidden
  defaults: { greeting: 'hi' },    // per-instance config defaults
  schema: [                        // the settings form is generated from this
    { key: 'greeting', label: 'Greeting', type: 'text' },
    // types: text textarea number checkbox select color password location
    //        lines (array of "a | b | c" objects, `fields:[…]`)   codec (custom encode/decode)
  ],
  settings(box, api) {},           // optional: extra settings UI; api.draft / api.set(patch)
  render(el, ctx) { el.replaceChildren(h('p', ctx.config.greeting)); },
  refresh(el, ctx) {},             // optional, defaults to render()
  destroy(el, ctx) {},             // optional cleanup
});
```

`ctx` gives `id`, `config` (defaults merged), `settings` (global), `save(patch)` to persist widget state, `rerender()`, `worker(path, opts)` and `bus`.

## Browser support

Current Chrome/Edge, Firefox and Safari (ES modules, `<dialog>`, CSS `:has()` and `color-mix()`).

## License

Public domain.
