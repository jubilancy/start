# Custom Start Page Inspired by Lagomor.ph's [Start Page](https://lagomor.ph/start/).

A lightweight, customizable start page with live weather, RSS feeds, calendar, and quick links. Designed for GitHub Pages.

## Features

- **Live Weather** – Auto-detects location (or uses default), displays current conditions via Open-Meteo API
- **RSS Feeds** – Toggle between Hacker News and your own feed sources
- **Calendar** – Interactive month view with navigation
- **Search** – Smart URL detection, domain shortcuts, or search via Kagi
- **Quick Links** – 8 customizable icon shortcuts
- **Responsive Design** – Works on mobile, tablet, and desktop
- **No Backend Required** – Static site, pure JavaScript + CSS

## File Structure

```
start-page/
├── index.html          # Main HTML
├── style.css           # Stylesheet (cream/sage green aesthetic)
├── currenttime.js      # Time of day greeting
├── calendar.js         # Calendar generation & navigation
├── weather.js          # Weather API (Open-Meteo)
├── rss.js              # RSS feed fetching & switching
├── search.js           # Search & URL navigation
└── README.md           # This file
```

## Setup

### Option 1: GitHub Pages (Recommended)

1. Create a new repo: `{username}.github.io` or any name
2. Clone it or create via GitHub
3. Unzip this folder into the repo root
4. Push to GitHub
5. Your site is live at `https://{username}.github.io/` or `https://{username}.github.io/start-page/`

### Option 2: Local Testing

```bash
# Navigate to the folder
cd start-page

# Simple HTTP server (Python 3)
python -m http.server 8000

# Then visit: http://localhost:8000
```

## Customization

### Change Quick Links

Edit `index.html` and modify the `<a>` tags in the icon rows:

```html
<a href="https://your-url.com" title="Label">
  <img src="https://icongr.am/simple/icon-name.svg?size=18&color=currentColor" alt="Label">
</a>
```

**Icon sources:**
- [Feather Icons](https://icongr.am/feather/) – general icons
- [Simple Icons](https://icongr.am/simple/) – brand/platform logos
- Or use your own SVG/PNG

### Add RSS Feeds

In `rss.js`, add your feed to the `feedSources` object:

```javascript
const feedSources = {
  'Hacker News': 'https://news.ycombinator.com/rss',
  'Feed.Eliana': 'https://feed.eliana.lol/feed.json',
  'Your Feed': 'https://your-feed-url.com/feed.xml',  // Add here
};
```

**Note:** JSON feeds (like feed.eliana.lol) work too. The script auto-detects format.

### Change Weather Location

In `weather.js`, replace the default lat/lon:

```javascript
// Default: Alexandria, Virginia
let lat = 38.8048;
let lon = -77.0469;
```

Or let users allow geolocation (already enabled – just ask for permission).

### Customize Colors

Edit the CSS variables in `style.css`:

```css
:root {
  --bg: #fafaf8;           /* Background */
  --text: #1a1a1a;         /* Text */
  --border: #d4d4ce;       /* Borders */
  --accent: #2d5016;       /* Sage green */
  --light-accent: #e8eee3; /* Light green */
}
```

### Change Search Engine

In `search.js`, replace `kagi.com` with your preferred engine:

```javascript
// Options: kagi.com, duckduckgo.com, startpage.com, google.com
window.location.href = `https://kagi.com/search?q=${encodeURIComponent(searchInput)}`;
```

## APIs & Data Sources

- **Weather**: [Open-Meteo](https://open-meteo.com/) – Free, no API key, no rate limits
- **RSS Feeds**: Public feeds (Hacker News, your own feeds)
- **Calendar**: Native JavaScript `Date` API
- **Icons**: [Icongr.am](https://icongr.am/) – Free SVG icons

**Important**: All requests are browser-side. No backend needed. Feeds are fetched directly by your browser.

## Troubleshooting

### Weather not showing
- Check browser console for errors (F12)
- Ensure geolocation permission is granted (or uses default coords)
- Open-Meteo API should always work (it's a public endpoint)

### Feeds not loading
- RSS feeds must have CORS headers or be proxied
- If a feed fails, the script falls back gracefully
- Test feed URLs directly in browser

### Search not working
- Clear browser cache (Ctrl+Shift+Del)
- Ensure searchbar has focus (`handleSearchOrURL()` fires on form submit)

## Deployment Checklist

- [ ] Customize quick links (index.html)
- [ ] Update RSS feed sources (rss.js) or remove custom feeds
- [ ] Verify weather location (weather.js)
- [ ] Change color scheme if desired (style.css)
- [ ] Test in Firefox, Chrome, Safari
- [ ] Push to GitHub Pages
- [ ] Set as browser homepage (most browsers allow custom start page URL)

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (responsive CSS included)

## License

Public domain. Use, modify, fork, host as you like.

## Notes

- No tracking, no analytics, no external dependencies (besides APIs)
- All data stays on your device
- Works offline except for weather & feeds
- Geolocation is optional (uses default if denied)

Here are 10 topic tags for your start page repo:

start-page – Core functionality
github-pages – Deployment platform
weather-api – Live weather feature
rss-feed – Feed aggregation
calendar – Interactive calendar component
vanilla-javascript – No frameworks/dependencies
responsive-design – Mobile-friendly
open-meteo – Weather data source
quick-links – Bookmark/shortcut feature
static-site – No backend required

Enjoy your custom start page!
