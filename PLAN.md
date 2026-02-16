# No Shorts YT - Remove YouTube Shorts Completely

## Goal

Eliminate YouTube Shorts from the YouTube experience entirely (browser-based).
Shorts are an addictive, brain-rotting infinite scroll mechanic that degrades attention span.

---

## Strategy Overview

We will build a **lightweight browser extension** (Manifest V3, Chrome/Edge compatible)
that uses CSS injection + DOM mutation observers to hide every trace of Shorts on YouTube.

### What gets removed

- Shorts shelf on the homepage
- Shorts tab in channel pages
- Shorts entries in search results
- Shorts in the sidebar/navigation
- Shorts suggestions in the video player recommendations
- The "Shorts" link in the left sidebar menu
- Shorts badges/labels anywhere on the page
- Redirect any `/shorts/` URL to a normal `/watch?v=` URL so if you accidentally click one, it plays as a regular video

---

## Architecture

```
no_shorts_yt/
  manifest.json        -- Extension manifest (MV3)
  content.css          -- CSS rules that hide Shorts elements (display:none)
  content.js           -- MutationObserver to catch dynamically loaded Shorts + URL redirect
  background.js        -- Service worker for URL redirect interception (webRequest)
  icons/               -- Extension icons (16, 48, 128)
```

### Phase 1 - CSS Hiding (immediate, covers ~80%)

Use aggressive CSS selectors to hide known Shorts containers:

```css
/* Shorts shelf on home */
ytd-rich-shelf-renderer[is-shorts],
ytd-reel-shelf-renderer,
/* Shorts tab on channels */
tp-yt-paper-tab:has(> .tab-content > yt-formatted-string[title="Shorts"]),
/* Shorts in sidebar nav */
ytd-mini-guide-entry-renderer[aria-label="Shorts"],
ytd-guide-entry-renderer:has(a[title="Shorts"]),
/* Shorts in search results */
ytd-reel-shelf-renderer,
/* Shorts badges */
ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"] {
  display: none !important;
}
```

### Phase 2 - DOM MutationObserver (catches dynamic loads)

YouTube is an SPA - content loads dynamically. A `MutationObserver` watches for new nodes
and removes/hides any Shorts elements that CSS alone might miss.

### Phase 3 - URL Redirect

Intercept any navigation to `youtube.com/shorts/VIDEO_ID` and redirect to
`youtube.com/watch?v=VIDEO_ID` so the video plays in the normal player.

---

## Implementation Steps (TODO)

1. [ ] Create `manifest.json` with permissions: `activeTab`, `declarativeNetRequest`, host `*://www.youtube.com/*`
2. [ ] Write `content.css` with all known Shorts selectors
3. [ ] Write `content.js` with MutationObserver logic
4. [ ] Write `background.js` with declarativeNetRequest rules for `/shorts/` redirect
5. [ ] Add basic icons
6. [ ] Test on YouTube homepage, search, channel pages, direct shorts links
7. [ ] Package and load as unpacked extension in Chrome/Edge

---

## Instructions for Gemini (Data Mining Role)

Gemini - your job is to **research and provide up-to-date CSS selectors and DOM structure**.

### Tasks

1. **Audit current YouTube DOM structure** (as of 2025-2026):
   - Go to youtube.com, open DevTools, and document the exact tag names, classes,
     and attributes used for Shorts components.
   - Check: homepage shelves, search results, channel tabs, sidebar, recommendations.

2. **Find every Shorts-related selector**:
   - Look for `ytd-reel-shelf-renderer`, `ytd-rich-shelf-renderer[is-shorts]`,
     `ytd-reel-item-renderer`, and any new components YouTube may have added.
   - Check for `overlay-style="SHORTS"` on thumbnail overlays.
   - Document the sidebar entry: `ytd-guide-entry-renderer` with Shorts link.

3. **Track YouTube updates**:
   - YouTube frequently changes their DOM. If the extension stops working,
     re-audit the DOM and provide updated selectors.

4. **Check for Shorts indicators in API responses** (optional, advanced):
   - If visible in network tab, identify JSON keys that flag a video as Shorts
     (e.g., `reelShelfRenderer`, `reelItemRenderer`).

### Output format

Provide findings as a structured list:

```
COMPONENT: [description]
LOCATION: [where it appears on YouTube]
SELECTOR: [CSS selector to target it]
NOTES: [any caveats, e.g. "only appears when logged in"]
```

---

## Instructions for GPT (Coding Role)

GPT - your job is to **write and debug the extension code**.

### Tasks

1. **Create `manifest.json`**:
   - Manifest V3 format
   - Permissions: `activeTab`, `declarativeNetRequest`, `declarativeNetRequestWithHostAccess`
   - Host permissions: `*://www.youtube.com/*`
   - Content scripts: inject `content.css` and `content.js` on YouTube pages
   - Background service worker: `background.js`
   - `declarative_net_request` rules file for URL redirects

2. **Write `content.css`**:
   - Use selectors from Gemini's research (or the defaults listed above)
   - All rules must use `display: none !important`
   - Be aggressive but avoid false positives (don't hide regular videos)

3. **Write `content.js`**:
   ```javascript
   // Pseudocode
   const SHORTS_SELECTORS = [/* all known selectors */];

   function removeShorts() {
     SHORTS_SELECTORS.forEach(sel => {
       document.querySelectorAll(sel).forEach(el => el.remove());
     });
   }

   // Initial pass
   removeShorts();

   // Watch for SPA navigation and dynamic content
   const observer = new MutationObserver(() => removeShorts());
   observer.observe(document.body, { childList: true, subtree: true });

   // Also handle SPA URL changes
   // yt-navigate-finish event fires on YouTube SPA navigation
   window.addEventListener('yt-navigate-finish', removeShorts);
   ```

4. **Write `background.js`** (or `rules.json` for declarativeNetRequest):
   - Redirect rule: `youtube.com/shorts/{id}` -> `youtube.com/watch?v={id}`
   - Use `declarativeNetRequest` API (MV3 compliant, no deprecated webRequest)

5. **Write `redirect_rules.json`**:
   ```json
   [{
     "id": 1,
     "priority": 1,
     "action": {
       "type": "redirect",
       "redirect": {
         "regexSubstitution": "https://www.youtube.com/watch?v=\\1"
       }
     },
     "condition": {
       "regexFilter": "https://www\\.youtube\\.com/shorts/([a-zA-Z0-9_-]+)",
       "resourceTypes": ["main_frame"]
     }
   }]
   ```

6. **Test and debug**:
   - Load unpacked in `chrome://extensions`
   - Verify on: homepage, search, channels, direct `/shorts/` URLs
   - Check console for errors
   - If something still shows, inspect the element and add the selector

### Coding guidelines

- Keep it minimal. No frameworks, no build step, no npm.
- Pure vanilla JS, CSS, and JSON.
- The extension should be <10KB total.
- Prioritize reliability over elegance.
- Use `el.remove()` in JS and `display:none!important` in CSS (belt and suspenders).

---

## Quick Start (for the human)

1. After the code is written, open Chrome/Edge
2. Go to `chrome://extensions` (or `edge://extensions`)
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the `no_shorts_yt/` folder
6. Open YouTube - Shorts should be gone

---

## Alternative / Supplementary Approaches

If you don't want to build a custom extension:

| Method | Pros | Cons |
|--------|------|------|
| **uBlock Origin filters** | No coding, just add filter rules | Less control, no URL redirect |
| **Tampermonkey userscript** | Easy to share, auto-updates | Slightly slower than extension |
| **Existing extensions** (e.g., "Unhook") | Zero effort | May break, tracks you, bloated |

### uBlock Origin quick filters (paste into My Filters):

```
! Hide Shorts shelf on homepage
youtube.com##ytd-rich-shelf-renderer[is-shorts]
youtube.com##ytd-reel-shelf-renderer

! Hide Shorts tab on channels
youtube.com##tp-yt-paper-tab:has(yt-formatted-string[title="Shorts"])

! Hide Shorts in sidebar
youtube.com##ytd-guide-entry-renderer:has(a[title="Shorts"])
youtube.com##ytd-mini-guide-entry-renderer[aria-label="Shorts"]

! Hide Shorts in search
youtube.com##ytd-reel-shelf-renderer

! Hide Shorts badge on thumbnails
youtube.com##ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]
```

---

## Notes

- YouTube changes their DOM frequently. Selectors may need updating every few months.
- The `/shorts/` URL redirect is the most stable part since it's URL-based, not DOM-based.
- This does NOT block Shorts on the YouTube mobile app (use a DNS-based approach or modified app for that).
