// Widget registry. Every widget module calls register() with this shape:
//
// {
//   type: 'weather',                 // unique id
//   name: 'Weather',                 // shown in the "add widget" picker
//   icon: '☁️',
//   description: 'one line',
//   card: false,                     // draw a bordered card by default
//   needsWorker: false,              // shows a hint when no Worker URL is configured
//   refreshEvery: 600,               // seconds; optional, paused while the tab is hidden
//   defaults: { ...config },         // default per-instance config
//   schema: [ {key,label,type,...} ],// auto-generated settings form (see settings.js)
//   settings(container, ctx),        // optional: extra custom settings UI appended to the form
//   render(el, ctx),                 // build the DOM (may be async)
//   refresh(el, ctx),                // re-fetch + update; defaults to render()
//   destroy(el, ctx),                // optional cleanup
// }
//
// ctx = { id, config, settings, save(patch), rerender(), worker(path, opts), bus }
const registry = new Map();

export function register(def) {
  if (!def.type) throw new Error('widget needs a type');
  registry.set(def.type, def);
  return def;
}
export const getDef = type => registry.get(type);
export const allDefs = () => [...registry.values()];
