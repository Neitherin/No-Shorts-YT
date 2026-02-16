// No Shorts YT - Content Script
// Belt-and-suspenders: CSS hides known elements, JS catches anything dynamic.

const SHORTS_SELECTORS = [
  // Homepage shorts shelf
  'ytd-rich-shelf-renderer[is-shorts]',
  'ytd-reel-shelf-renderer',
  'grid-shelf-view-model:has(a[href*="/shorts/"])',
  'yt-horizontal-list-renderer:has(a[href*="/shorts/"])',
  // Any link-based shorts items
  'ytd-rich-item-renderer:has(a[href*="/shorts/"])',
  'ytd-grid-video-renderer:has(a[href*="/shorts/"])',
  'ytd-video-renderer:has(a[href*="/shorts/"])',
  'ytd-compact-video-renderer:has(a[href*="/shorts/"])',
  'ytm-shorts-lockup-view-model-v2',
  'ytm-shorts-lockup-view-model',
  // Sidebar
  'ytd-guide-entry-renderer:has(a[title="Shorts"])',
  'ytd-mini-guide-entry-renderer[aria-label="Shorts"]',
  'ytd-mini-guide-entry-renderer:has(a[title="Shorts"])',
  // Channel tabs
  'tp-yt-paper-tab:has(yt-formatted-string[title="Shorts"])',
  'yt-tab-shape[tab-title="Shorts"]',
  // Channel sections with shorts
  'ytd-shelf-renderer:has(a[href*="/shorts/"])',
  // Notifications
  'ytd-notification-renderer:has(a[href*="/shorts/"])',
  // Shorts player page
  'ytd-shorts',
  '#shorts-container',
];

function hideShorts() {
  for (const selector of SHORTS_SELECTORS) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      if (!el.hasAttribute('is-hidden-short')) {
        // console.log('No Shorts YT: Hiding', selector); // Debug
        el.setAttribute('is-hidden-short', '');
      }
    }
  }
}

// Redirect /shorts/ URLs to /watch?v= (client-side fallback)
function redirectShortsUrl() {
  const match = location.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]+)/);
  if (match) {
    location.replace('https://www.youtube.com/watch?v=' + match[1]);
  }
}

// Run immediately
redirectShortsUrl();
hideShorts();

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hideShorts);
} else {
  hideShorts();
}

// Watch for dynamic content (YouTube is an SPA)
let debounceTimer = null;
const observer = new MutationObserver((mutations) => {
  if (debounceTimer) return;
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    hideShorts();
  }, 100);
});

// Start observing once body exists
function startObserver() {
  if (document.body) {
    // Observe childList and subtree to catch new elements
    // We do NOT need to observe attributes if we are only reacting to new nodes
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    requestAnimationFrame(startObserver);
  }
}
startObserver();

// YouTube SPA navigation events
window.addEventListener('yt-navigate-finish', () => {
  redirectShortsUrl();
  hideShorts();
});

window.addEventListener('yt-navigate-start', hideShorts);
