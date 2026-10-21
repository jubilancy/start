import { register } from '../core/widgets.js';
import { h, safeUrl } from '../core/util.js';

register({
  type: 'embed',
  name: 'Embed (iframe)',
  icon: '🪟',
  description: 'Embed any page that allows framing: calendars, docs, dashboards, maps, players.',
  defaults: { url: '', height: 320 },
  schema: [
    { key: 'url', label: 'URL', type: 'text', placeholder: 'https://…' },
    { key: 'height', label: 'Height (px)', type: 'number', min: 100, max: 2000 },
  ],
  render(el, ctx) {
    const u = ctx.config.url;
    if (!/^https:\/\//i.test(u || '')) { el.replaceChildren(h('p.muted', 'Set an https:// URL in widget settings. Sites that send X-Frame-Options/CSP frame-ancestors will refuse to load.')); return; }
    el.replaceChildren(h('iframe.embed', { src: safeUrl(u), title: ctx.config.title || 'Embedded page', loading: 'lazy', referrerpolicy: 'no-referrer', style: { height: ctx.config.height + 'px' },
      sandbox: 'allow-scripts allow-same-origin allow-popups allow-forms allow-presentation' }),
      h('div.muted', h('a', { href: safeUrl(u), target: '_blank', rel: 'noopener noreferrer' }, 'Open in new tab ↗')));
  },
});
