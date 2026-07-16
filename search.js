// Handle search or direct URL navigation
function handleSearchOrURL() {
  const searchInput = document.getElementById('searchbar').value.trim();
  
  if (!searchInput) return false;
  
  // URLs
  if (searchInput.startsWith('http://') || searchInput.startsWith('https://')) {
    window.location.href = searchInput;
    return false;
  }
  
  // Check for domain-like patterns (domain.extension)
  const domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/.*)?$/;
  if (domainPattern.test(searchInput)) {
    window.location.href = `https://${searchInput}`;
    return false;
  }
  
  // Short commands like "go/"
  if (searchInput.startsWith('go/')) {
    window.location.href = `https://${searchInput.substring(3)}`;
    return false;
  }
  
  // Search via Kagi (or replace with your preferred search engine)
  window.location.href = `https://kagi.com/search?q=${encodeURIComponent(searchInput)}`;
  return false;
}

// Focus searchbar on load
document.addEventListener('DOMContentLoaded', function() {
  const searchbar = document.getElementById('searchbar');
  if (searchbar) {
    searchbar.focus();
  }
  
  // Allow Enter to submit
  const searchForm = document.querySelector('.search form');
  if (searchForm) {
    searchForm.addEventListener('submit', handleSearchOrURL);
  }
});
