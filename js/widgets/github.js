import { register } from '../core/widgets.js';
import { h, safeUrl, timeAgo, fetchJSON, cached } from '../core/util.js';

const API = 'https://api.github.com';
function describe(e) {
  const p = e.payload || {};
  const repo = e.repo.name;
  switch (e.type) {
        case 'PushEvent': { const br = (p.ref || '').replace('refs/heads/', ''); const n = p.size ?? p.commits?.length; return { text: n != null ? `pushed ${n} commit${n === 1 ? '' : 's'} to ${br}` : `pushed to ${br}`, repo, url: `https://github.com/${repo}/commits/${br}` }; }
    case 'PullRequestEvent': return { text: `${p.action} PR ${p.pull_request?.title || '#' + (p.number ?? p.pull_request?.number)}`, repo, url: p.pull_request?.html_url || `https://github.com/${repo}/pull/${p.number}` };
    case 'IssuesEvent': return { text: `${p.action} issue ${p.issue?.title || '#' + p.issue?.number}`, repo, url: p.issue?.html_url };
    case 'IssueCommentEvent': return { text: `commented on ${p.issue?.title || '#' + p.issue?.number}`, repo, url: p.comment?.html_url };
    case 'WatchEvent': return { text: 'starred', repo, url: `https://github.com/${repo}` };
    case 'CreateEvent': return { text: `created ${p.ref_type}${p.ref ? ' ' + p.ref : ''}`, repo, url: `https://github.com/${repo}` };
    case 'ForkEvent': return { text: 'forked', repo, url: p.forkee?.html_url };
    case 'ReleaseEvent': return { text: `released ${p.release?.tag_name}`, repo, url: p.release?.html_url };
    default: return { text: e.type.replace(/Event$/, ''), repo, url: `https://github.com/${repo}` };
  }
}

async function paint(el, ctx) {
  const c = ctx.config;
  const hdr = c.token ? { Authorization: `Bearer ${c.token}` } : {};
  const get = path => cached('gh.' + path + (c.token ? '.t' : ''), 300e3, () => fetchJSON(API + path, { headers: { Accept: 'application/vnd.github+json', ...hdr } }));
  const root = h('div.newsfeed.gh');
  el.replaceChildren(root);
  root.append(h('div.muted', 'Loading…'));
  try {
    const repos = (c.repos || '').split(/[,\s]+/).filter(Boolean);
    const parts = [];
    if (c.user) {
      const raw = (await get(`/users/${encodeURIComponent(c.user)}/events/public?per_page=30`)).slice(0, c.limit || 8);
      parts.push(h('div.news-item', h('strong', `@${c.user} recent activity`)), ...raw.map(ev => {
        const e = describe(ev);
        return h('div.news-item', h('a', { href: safeUrl(e.url || '#'), target: '_blank', rel: 'noopener noreferrer' }, `${e.repo}: ${e.text}`), h('div.news-source', timeAgo(ev.created_at)));
      }));
    }
    for (const r of repos) {
      const commits = await get(`/repos/${r}/commits?per_page=3`);
      parts.push(h('div.news-item', h('strong', r), ...commits.map(k => h('div', h('a', { href: safeUrl(k.html_url), target: '_blank', rel: 'noopener noreferrer' }, (k.commit.message || '').split('\n')[0]), h('span.muted', ` · ${timeAgo(k.commit.author.date)}`)))));
    }
    root.replaceChildren(...(parts.length ? parts : [h('p.muted', 'Set a GitHub username and/or repos in widget settings.')]));
  } catch (e) { root.replaceChildren(h('div.err', 'GitHub: ' + e.message + (/403|429/.test(e.message) ? ' (rate limit: 60 req/h unauthenticated — add a token in settings)' : ''))); }
}

register({
  type: 'github',
  name: 'GitHub activity',
  icon: '🐙',
  description: 'Recent public activity for a user and latest commits for chosen repos.',
  refreshEvery: 600,
  defaults: { user: 'jubilancy', repos: 'jubilancy/start', limit: 8, token: '' },
  schema: [
    { key: 'user', label: 'GitHub username', type: 'text' },
    { key: 'repos', label: 'Repos for latest commits (owner/name, comma separated)', type: 'text' },
    { key: 'limit', label: 'Activity items', type: 'number', min: 1, max: 30 },
    { key: 'token', label: 'Personal access token (optional, stored in this browser only)', type: 'password', help: 'Raises the rate limit from 60 to 5,000 requests/hour. Use a fine-grained read-only token.' },
  ],
  render: paint,
  refresh: paint,
});
