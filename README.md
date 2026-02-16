# No Shorts YT

A lightweight, high-performance browser extension that hides YouTube Shorts from the user interface without breaking the site's functionality.

## Features

- **Performance-First Design**: Uses a non-destructive CSS-based approach (`display: none`) instead of DOM removal. This ensures YouTube's virtual scrolling and search rendering logic remains intact, preventing "infinite loading" loops or empty search results.
- **Modern YouTube Support**: Specifically targets and hides modern YouTube components like `grid-shelf-view-model` and `ytm-shorts-lockup-view-model`.
- **Search Fix**: intelligently scopes hiding rules to the search page (`ytd-search`) to prevent collateral damage (like hiding the entire sidebar on Watch pages).
- **Navigation Cleanup**: Removes Shorts from:
    - Homepage (Shelves and grid items)
    - Search Results (Shelves and individual videos)
    - Sidebar / Suggested Videos
    - Subscriptions Feed
    - Navigation Menu (Desktop and Mobile/Mini guide)
    - Channel Pages
    - Notifications
- **Redirects**: Automatically redirects any `/shorts/` URL to the standard `/watch?v=` player interface.

## Installation

### Chrome / Edge / Brave

1.  Clone or download this repository.
2.  Open your browser and navigate to `chrome://extensions`.
3.  Enable **Developer mode** (toggle in the top right corner).
4.  Click **Load unpacked**.
5.  Select the directory containing `manifest.json`.

### Firefox

1.  Clone or download this repository.
2.  Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3.  Click **Load Temporary Add-on...**.
4.  Select the `manifest.json` file.

## Technical Details

### The "Empty Sidebar" & "Loading Circle" Fix
Older ad-blockers or Shorts-hiders often use `element.remove()` to delete Shorts from the DOM. On modern YouTube, this breaks the "Virtual Scroller"—the mechanism that reuses DOM nodes to display long lists of content. When nodes are deleted, YouTube waits for them to render, resulting in infinite spinners or the engine serving very old cached videos.

**No Shorts YT** solves this by:
1.  **Marking** elements with a custom attribute: `is-hidden-short`.
2.  **Hiding** them with CSS: `[is-hidden-short] { display: none !important; }`.
3.  **Preserving** the DOM structure so YouTube's engine continues to function normally.

### Scoped Selectors
To avoid hiding legitimate content (like the entire "Related Videos" list on a Watch page), this extension uses scoped CSS selectors. For example, aggressive shelf hiding is restricted to the search page:
```css
/* Only hides the container if we are on the Search page */
ytd-search ytd-item-section-renderer:has(ytd-reel-shelf-renderer) {
  display: none !important;
}
```

## Privacy

This extension runs locally on your browser. It does not collect, store, or transmit any user data. It only interacts with `youtube.com`.

## License

MIT
