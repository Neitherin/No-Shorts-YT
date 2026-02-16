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
  'ytd-guide-entry-renderer:has(a[href^="/shorts"])',
  'ytd-guide-entry-renderer:has(path[d^="m13.467 1.19-8 4.7"])',
  'ytd-mini-guide-entry-renderer:has(a[href^="/shorts"])',
  // Channel tabs
  'tp-yt-paper-tab:has(a[href*="/shorts/"])',
  'yt-tab-shape:has(a[href*="/shorts/"])',
  // Channel sections with shorts
  'ytd-shelf-renderer:has(a[href*="/shorts/"])',
  // Notifications
  'ytd-notification-renderer:has(a[href*="/shorts/"])',
  // Shorts player page
  'ytd-shorts',
  '#shorts-container',
];

function isSelectorSupported(selector) {
  try {
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

const SUPPORTED_SHORTS_SELECTORS = SHORTS_SELECTORS.filter(isSelectorSupported);
const SHORTS_SELECTOR = SUPPORTED_SHORTS_SELECTORS.join(',');

function markAsHidden(el) {
  if (!el.hasAttribute('is-hidden-short')) {
    el.setAttribute('is-hidden-short', '');
  }
}

function hideShorts(root = document) {
  if (!SHORTS_SELECTOR) return;

  if (root instanceof Element && root.matches(SHORTS_SELECTOR)) {
    markAsHidden(root);
  }

  const elements = root.querySelectorAll ? root.querySelectorAll(SHORTS_SELECTOR) : [];
  for (const el of elements) {
    markAsHidden(el);
  }
}

function shouldProcessMutations(mutations) {
  for (const mutation of mutations) {
    if (mutation.type === 'attributes') {
      return true;
    }
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        return true;
      }
    }
  }
  return false;
}

// Redirect /shorts/ URLs to /watch?v= (client-side fallback)
function redirectShortsUrl() {
  const match = location.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})(?:\/)?$/);
  if (match) {
    const params = new URLSearchParams(location.search);
    params.set('v', match[1]);
    location.replace('https://www.youtube.com/watch?' + params.toString());
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
  if (!shouldProcessMutations(mutations)) return;
  if (debounceTimer) return;
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    hideShorts();
  }, 120);
});

// Start observing once body exists
function startObserver() {
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'is-shorts', 'tab-title', 'title', 'aria-label'],
    });
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
