// RSS feed sources
const feedSources = {
  'Hacker News': 'https://news.ycombinator.com/rss',
  'Feed.Eliana': 'https://feed.eliana.lol/feed.json',
};

let currentFeedProvider = 'Hacker News';
let feedCache = {};

// Parse RSS to JSON
async function parseRSSFeed(feedUrl) {
  try {
    const response = await fetch(feedUrl);
    const text = await response.text();
    
    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, 'text/xml');
    
    // Check for errors
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      console.error('RSS parse error');
      return [];
    }
    
    const items = [];
    const entries = xmlDoc.getElementsByTagName('item');
    
    for (let i = 0; i < Math.min(entries.length, 6); i++) {
      const entry = entries[i];
      const title = entry.querySelector('title')?.textContent || 'No title';
      const link = entry.querySelector('link')?.textContent || '#';
      const pubDate = entry.querySelector('pubDate')?.textContent || '';
      const description = entry.querySelector('description')?.textContent || '';
      
      items.push({ title, link, pubDate, description });
    }
    
    return items;
  } catch (error) {
    console.error('RSS fetch error:', error);
    return [];
  }
}

// Fetch JSON-based feeds (like feed.eliana.lol)
async function parseJSONFeed(feedUrl) {
  try {
    const response = await fetch(feedUrl);
    const data = await response.json();
    
    const items = [];
    
    // Handle feed format
    const entries = data.items || data.entries || [];
    
    for (let i = 0; i < Math.min(entries.length, 6); i++) {
      const entry = entries[i];
      const title = entry.title || entry.name || 'No title';
      const link = entry.link || entry.url || '#';
      const pubDate = entry.pubDate || entry.published || '';
      
      items.push({ title, link, pubDate, description: '' });
    }
    
    return items;
  } catch (error) {
    console.error('JSON feed error:', error);
    return [];
  }
}

// Display feed
async function displayFeed(provider) {
  const newsfeedDiv = document.getElementById('newsfeed');
  newsfeedDiv.innerHTML = '<img src="https://icongr.am/feather/loader.svg?size=24&color=black" class="loader" alt="Loading">';
  
  try {
    let items = [];
    const feedUrl = feedSources[provider];
    
    if (provider === 'Feed.Eliana') {
      items = await parseJSONFeed(feedUrl);
    } else {
      items = await parseRSSFeed(feedUrl);
    }
    
    if (items.length === 0) {
      newsfeedDiv.innerHTML = '<p>No articles available.</p>';
      return;
    }
    
    let html = '';
    items.forEach(item => {
      const displayTitle = item.title.length > 100 ? item.title.substring(0, 100) + '...' : item.title;
      html += `
        <div class="news-item">
          <a href="${item.link}" target="_blank" rel="noopener noreferrer">
            ${displayTitle}
          </a>
          ${item.pubDate ? `<div class="news-source">${formatDate(item.pubDate)}</div>` : ''}
        </div>
      `;
    });
    
    newsfeedDiv.innerHTML = html;
    
  } catch (error) {
    console.error('Display feed error:', error);
    newsfeedDiv.innerHTML = '<p>Error loading feed.</p>';
  }
}

// Format date
function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  } catch {
    return dateString;
  }
}

// Toggle between feeds
function toggleProvider() {
  const providers = Object.keys(feedSources);
  const currentIndex = providers.indexOf(currentFeedProvider);
  const nextIndex = (currentIndex + 1) % providers.length;
  currentFeedProvider = providers[nextIndex];
  
  document.getElementById('provider').textContent = currentFeedProvider;
  displayFeed(currentFeedProvider);
}

// Load on page load
document.addEventListener('DOMContentLoaded', function() {
  displayFeed(currentFeedProvider);
  
  // Refresh every 30 minutes
  setInterval(() => {
    displayFeed(currentFeedProvider);
  }, 1800000);
});
