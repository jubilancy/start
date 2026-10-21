// Entry point: register widgets, then boot the app.
import './widgets/greeting.js';
import './widgets/weather.js';
import './widgets/rss.js';
import './widgets/calendar.js';
import './widgets/search.js';
import './widgets/links.js';
import { start } from './core/app.js';
import { initPalette } from './core/palette.js';

start().then(initPalette).catch(e => {
  console.error(e);
  document.body.insertAdjacentHTML('afterbegin', `<pre style="padding:1rem;color:#b3261e">Start page failed to load: ${String(e.message).replace(/[<&]/g, '')}</pre>`);
});
