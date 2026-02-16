# Local AI Nexus → Unified Operations Assistant

## Upgrade Plan: From Knowledge Base to Live Tool Integration

**Goal:** Transform Local-AI-Nexus from a manual/document Q&A tool into a unified operations assistant that can read live data from company web tools (ServiceNow/GSN, AutomateNow, SBF, PAT, Decomm Report), cross-reference information, and answer operational questions like "how does RFC12345678 look?" or "list my problematic tickets."

---

## What Already Exists (Current State)

| Component | Status | Tech |
|-----------|--------|------|
| React + TypeScript frontend | Done | Vite, React 18, Framer Motion, Lucide icons |
| Node.js + Express backend | Done | TypeScript, port 3001 |
| AI chat with streaming | Done | Ollama (local models, Mistral/Qwen) |
| RAG knowledge base | Done | LanceDB vectors, Nomic Embed Text (768-dim) |
| Document upload (PDF, DOCX, XLSX, TXT, MD) | Done | pdf-parse, mammoth, xlsx |
| Chat history | Done | Better-SQLite3 |
| Command templates with variables | Done | localStorage-based |
| Manual auto-ingestion | Done | data/manuals/ folder |
| Dark theme UI with sidebar | Done | Custom CSS, Zinc palette |

**Key files:**
- Client entry: `client/src/App.tsx` (main state + routing)
- Server entry: `server/src/index.ts` (API routes)
- AI service: `server/src/services/ollamaService.ts`
- RAG service: `server/src/services/ragService.ts`
- Chat hook: `client/src/hooks/useChat.ts`
- Layout: `client/src/components/Layout/Sidebar.tsx`

---

## What Needs to Be Built (4 Phases)

---

### PHASE 1: Browser Extension — The Bridge

**What:** A Chrome/Edge MV3 extension that connects the Nexus app to company web tools.

**Why:** Company tools (GSN, SBF, PAT, etc.) are web apps behind corporate auth. We can't use their APIs (no keys, possible cost). Instead, the extension reads data directly from the pages the user is already logged into.

#### Files to create: `extension/`

```
extension/
  manifest.json
  background.js          -- Message router between Nexus app and content scripts
  content_bridge.js      -- Injected into Nexus app, receives commands from UI
  scrapers/
    gsn.js               -- Content script for ServiceNow/GSN pages
    sbf.js               -- Content script for SBF pages
    pat.js               -- Content script for PAT pages
    decomm.js            -- Content script for Decomm Report pages
    automatenow.js       -- Content script for AutomateNow pages
  rules/
    headers.json         -- declarativeNetRequest rules to strip X-Frame-Options
```

#### How it works:

```
Nexus UI (React app)
    │
    │ window.postMessage({ type: 'NEXUS_COMMAND', action: 'search_rfc', data: 'RFC123' })
    │
    ▼
content_bridge.js (injected into Nexus page)
    │
    │ chrome.runtime.sendMessage(...)
    │
    ▼
background.js (service worker, message router)
    │
    │ chrome.tabs.sendMessage(gsnTabId, ...)
    │
    ▼
scrapers/gsn.js (injected into ServiceNow tab)
    │
    │ Reads DOM, extracts data
    │ chrome.runtime.sendMessage({ type: 'SCRAPE_RESULT', data: {...} })
    │
    ▼
background.js → content_bridge.js → Nexus UI receives data
```

#### Extension manifest permissions needed:

```json
{
  "permissions": ["declarativeNetRequest", "tabs", "activeTab"],
  "host_permissions": [
    "*://*.service-now.com/*",
    "*://*.servicenow.com/*",
    "*://YOUR_SBF_DOMAIN/*",
    "*://YOUR_PAT_DOMAIN/*",
    "*://YOUR_DECOMM_DOMAIN/*",
    "*://YOUR_AUTOMATENOW_DOMAIN/*",
    "http://localhost:3001/*"
  ]
}
```

#### Header stripping rules (to enable iframes):

For each company tool domain, add a `declarativeNetRequest` rule that removes:
- `X-Frame-Options` response header
- `Content-Security-Policy` frame-ancestors directive

This allows Nexus to embed these tools in iframes (optional — the scraping works without iframes too, using separate tabs).

#### Tasks for Phase 1:

1. [ ] Create extension scaffold (`manifest.json`, `background.js`)
2. [ ] Build `content_bridge.js` — injects into Nexus page, relays messages
3. [ ] Build message routing in `background.js` — routes commands to correct tab/scraper
4. [ ] Add header-stripping rules for each tool domain
5. [ ] Test: send a message from Nexus UI → extension → back to Nexus UI (round trip)

---

### PHASE 2: Scrapers — Teaching the AI to See

**What:** Content scripts for each company tool that know how to extract structured data from the DOM.

**Why:** Each tool has a different page structure. The scraper for each tool knows where to find tickets, RFC numbers, hostnames, statuses, etc.

#### How to build each scraper:

**Step 1 — Human maps the DOM (no coding needed)**

For each tool, the human (you) opens the tool in Chrome, right-clicks on key data elements, clicks "Inspect", and documents:

```
TOOL: ServiceNow / GSN
PAGE: Ticket list view
─────────────────────────────────
ELEMENT: Ticket number (e.g. INC0012345)
SELECTOR: .list_row td.vt[name="number"] a
EXAMPLE HTML: <a href="...">INC0012345</a>

ELEMENT: Status
SELECTOR: .list_row td.vt[name="state"]
EXAMPLE HTML: <td>In Progress</td>

ELEMENT: Assignment group
SELECTOR: .list_row td.vt[name="assignment_group"]
EXAMPLE HTML: <td>Config Management</td>

ELEMENT: Short description
SELECTOR: .list_row td.vt[name="short_description"]
EXAMPLE HTML: <td>Create CI for server-xyz-01</td>
```

Repeat for:
- Ticket detail page (single ticket view)
- RFC/Change request page
- Implementation tasks (CTask list)
- Search results page

Do the same for SBF, PAT, Decomm Report, AutomateNow.

**Step 2 — AI builds the scraper from your map**

Once the DOM is mapped, give the document to any AI (Claude, GPT, Gemini) with this prompt:

```
Build a Chrome extension content script that extracts structured data
from [TOOL NAME] based on these DOM selectors. The script should:
1. Listen for messages from the extension background script
2. Support actions: search, read_ticket, read_rfc, list_tasks
3. Return structured JSON with the extracted data
4. Handle loading states (wait for DOM elements to appear)
```

#### Scraper output format (standard across all tools):

```json
{
  "source": "gsn",
  "action": "read_rfc",
  "data": {
    "rfcNumber": "RFC12345678",
    "type": "Decommission",
    "status": "In Progress",
    "tasks": [
      {
        "ctaskNumber": "CTASK0098765",
        "sequence": 4,
        "status": "In Progress",
        "assignmentGroup": "Config Management",
        "description": "Create CI for server-xyz-01",
        "dueDate": "2026-02-15"
      },
      {
        "ctaskNumber": "CTASK0098766",
        "sequence": 5,
        "status": "Pending",
        "assignmentGroup": "Network Team",
        "description": "Remove DNS entries"
      }
    ],
    "relatedIncidents": ["INC0054321"],
    "hostnames": ["server-xyz-01.company.com"]
  }
}
```

#### Tasks for Phase 2:

1. [ ] **Human task:** Map DOM selectors for GSN (ticket list, ticket detail, RFC, CTasks, search)
2. [ ] **Human task:** Map DOM selectors for SBF (main data fields — IP, VLAN, hostname, etc.)
3. [ ] **Human task:** Map DOM selectors for PAT (IP allocation, VLAN, subnet)
4. [ ] **Human task:** Map DOM selectors for Decomm Report (report fields)
5. [ ] **Human task:** Map DOM selectors for AutomateNow (workflow status, errors)
6. [ ] Build scraper: `scrapers/gsn.js`
7. [ ] Build scraper: `scrapers/sbf.js`
8. [ ] Build scraper: `scrapers/pat.js`
9. [ ] Build scraper: `scrapers/decomm.js`
10. [ ] Build scraper: `scrapers/automatenow.js`
11. [ ] Test each scraper independently — send command, verify JSON output

---

### PHASE 3: Nexus Integration — Connecting the Brain

**What:** Update Local-AI-Nexus to send commands to the extension and use scraped data in AI responses.

#### 3A. New server service: `ToolBridgeService`

Location: `server/src/services/toolBridgeService.ts`

This service manages communication between the AI and the extension via WebSocket.

```
Nexus Server (port 3001)
    │
    │ WebSocket server on /ws/tools
    │
    ▼
Extension background.js connects via WebSocket
    │
    │ Server sends: { action: "search_rfc", tool: "gsn", query: "RFC123" }
    │ Extension replies: { source: "gsn", data: {...} }
    │
    ▼
Server feeds scraped data into AI context
```

**Why WebSocket instead of HTTP?**
- Extension can push data proactively (e.g., "tab changed, here's new data")
- Bidirectional: server can ask extension to scrape, extension can send updates
- Stays connected — no repeated handshakes

#### 3B. New server service: `AgentService`

Location: `server/src/services/agentService.ts`

This is the "brain" that turns a user question into a multi-step tool interaction.

```
User: "How does RFC12345678 look?"

AgentService:
  1. Parse intent → RFC lookup
  2. Command: search RFC12345678 in GSN
  3. Wait for scrape result
  4. Command: read implementation tasks for this RFC
  5. Wait for scrape result
  6. Analyze: find active task (status = In Progress)
  7. Analyze: determine position (sequence 4 of 12)
  8. Build context string with all scraped data
  9. Send to Ollama with system prompt: "Answer based on this live data"
  10. Stream response to user
```

The AgentService defines **action chains** — sequences of scrape commands for common questions:

| User Intent | Action Chain |
|-------------|-------------|
| "How does RFC___ look?" | GSN: search RFC → read RFC → read tasks → find active task |
| "List problematic tickets" | GSN: list my tickets → filter past due → for each: check workflow status |
| "What's wrong with CTASK___?" | GSN: read CTask → get hostname → SBF: read hostname → PAT: read hostname → compare |
| "Check IP for hostname___" | GSN: search hostname → SBF: search hostname → PAT: search hostname → compare all |

#### 3C. Client UI updates

**New sidebar section: "Tools"**

```
Sidebar (existing):
  ├── Chat (existing)
  ├── Knowledge Base (existing)
  ├── Commands (existing)
  └── Tools (NEW)
       ├── Tool Status (green/red dots showing which tools are connected)
       ├── Quick Actions
       │    ├── Look up RFC
       │    ├── Check ticket
       │    ├── List my tickets
       │    └── Compare hostname
       └── Embedded Views (optional iframe tabs)
```

**Chat integration:**

The chat already works. The only change: when the AI needs live data, it shows a status indicator:

```
You: How does RFC12345678 look?

AI: 🔍 Searching GSN for RFC12345678...
    📋 Reading implementation tasks...
    ✓ Found active task

    RFC12345678 is a Decommission, currently on step 4 of 12.
    The active task is CTASK0098765 — Create CI (assigned to Config team).
    ...
```

#### Tasks for Phase 3:

1. [ ] Add WebSocket server to `server/src/index.ts` (e.g., using `ws` package)
2. [ ] Build `ToolBridgeService` — manages extension connection + command/response
3. [ ] Build `AgentService` — intent parsing + action chains + context building
4. [ ] Update `extension/background.js` — connect to Nexus WebSocket on startup
5. [ ] Update chat endpoint `/api/chat` — detect tool-related questions, invoke AgentService
6. [ ] Add tool status indicator to client sidebar
7. [ ] Add "searching..." / "reading..." status messages during multi-step flows
8. [ ] Test end-to-end: ask question → scrape → AI response

---

### PHASE 4: Smart Features — Cross-Tool Intelligence

**What:** The advanced features discussed — problem detection, cross-tool validation, proactive monitoring.

#### 4A. Cross-tool data comparison

When the AI has data from multiple tools for the same hostname/ticket, it automatically compares:

```javascript
// Pseudocode in AgentService
function compareHostData(hostname) {
  const gsnData = await scrape('gsn', 'read_hostname', hostname);
  const sbfData = await scrape('sbf', 'read_hostname', hostname);
  const patData = await scrape('pat', 'read_hostname', hostname);

  const mismatches = [];
  if (gsnData.ip !== sbfData.ip) mismatches.push({ field: 'IP', gsn: gsnData.ip, sbf: sbfData.ip });
  if (gsnData.vlan !== sbfData.vlan) mismatches.push({ field: 'VLAN', gsn: gsnData.vlan, sbf: sbfData.vlan });
  // ... etc

  return mismatches;
}
```

#### 4B. "List problematic tickets" workflow

```javascript
// Pseudocode
async function listProblematicTickets() {
  // 1. Get all my tickets
  const myTickets = await scrape('gsn', 'list_my_tickets');

  const problems = [];

  for (const ticket of myTickets) {
    // 2. Check due date
    if (ticket.dueDate < today) {
      problems.push({ ticket, issue: 'Past due' });
      continue;
    }

    // 3. Check workflow status
    if (ticket.relatedRFC) {
      const rfc = await scrape('gsn', 'read_rfc', ticket.relatedRFC);
      const activeTask = rfc.tasks.find(t => t.status === 'In Progress');

      if (!activeTask && rfc.status !== 'Closed') {
        problems.push({ ticket, issue: 'Workflow stopped', rfc: rfc.rfcNumber });
      }
    }

    // 4. Check for pending with notes
    if (ticket.status === 'Pending') {
      const detail = await scrape('gsn', 'read_ticket', ticket.number);
      problems.push({ ticket, issue: `Pending — ${detail.pendingNote}` });
    }
  }

  return problems;
}
```

#### 4C. Root cause investigation

When a CTask is stuck and assigned to your team:

```
1. Read the CTask → get hostname
2. Pull hostname data from GSN, SBF, PAT
3. Compare fields (IP, VLAN, subnet, DNS)
4. Flag mismatches
5. Check AutomateNow → look for failed automation runs
6. Compile: "The problem is X because tool A says Y but tool B says Z"
```

#### 4D. Knowledge-enhanced reasoning

Combine RAG (manuals) + live data:

```
System prompt:
"You are an operations assistant. You have access to:
1. Company manuals and procedures (RAG context below)
2. Live data from company tools (scraped data below)

Use both to answer questions. If a procedure says step X should happen
but the live data shows it hasn't, flag it."
```

This means the AI knows BOTH:
- How things SHOULD work (from manuals)
- How things ACTUALLY are (from live tools)

#### Tasks for Phase 4:

1. [ ] Build comparison logic in AgentService (multi-tool field matching)
2. [ ] Build "list problematic tickets" action chain
3. [ ] Build "investigate problem" action chain (cross-tool + mismatch detection)
4. [ ] Update AI system prompt to combine RAG context + live tool data
5. [ ] Add common problem patterns (workflow stopped, automation fail, data mismatch)
6. [ ] Test with real scenarios

---

## Dependency / Order Summary

```
Phase 1 (Extension scaffold)
    │
    ▼
Phase 2 (Scrapers) ← REQUIRES HUMAN INPUT (DOM mapping)
    │
    ▼
Phase 3 (Nexus integration)
    │
    ▼
Phase 4 (Smart features)
```

Phase 2 is the bottleneck — it requires you to manually inspect each tool's DOM and document the selectors. Everything else is pure coding that any AI can do from these specs.

---

## Tech Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Extension ↔ Server communication | WebSocket (`ws` npm package) | Bidirectional, persistent connection |
| Scraper ↔ Extension communication | `chrome.runtime.sendMessage` | Standard extension messaging |
| Multi-step orchestration | Custom AgentService | Simple, no framework overhead |
| Iframe embedding | Optional, not required | Scrapers work via separate tabs too |
| New dependencies | `ws` (WebSocket server) | Only 1 new package needed |

---

## Instructions for AI Assistants

### For Gemini (research/data mining):

Your job is DOM mapping. For each company tool:
1. The human will open the tool and share screenshots or HTML snippets
2. Identify the CSS selectors for every data field (ticket numbers, statuses, hostnames, IPs, VLANs, dates, assignment groups, notes)
3. Document them in the format shown in Phase 2
4. Test selectors in browser DevTools console: `document.querySelectorAll('YOUR_SELECTOR')`
5. Note any pages that load content dynamically (need to wait for elements)
6. Note any iframes within the tool (ServiceNow loves nested iframes)

### For GPT (coding):

Your job is writing the extension and Nexus integration code:
1. Read this entire plan first
2. Start with Phase 1 — extension scaffold and message routing
3. For Phase 2 — use the DOM maps from Gemini to build each scraper
4. For Phase 3 — add WebSocket + AgentService to the existing Nexus server
5. For Phase 4 — implement comparison logic and action chains

Key constraints:
- The existing Nexus app uses: React 18, Vite, TypeScript, Express, Ollama, LanceDB
- Server runs on port 3001, client proxies via Vite in dev
- Keep the extension vanilla JS (no build step, no TypeScript)
- The server side additions should be TypeScript, matching existing code style
- Do not break existing functionality (chat, RAG, commands, history)

### For Claude (architecture / debugging):

Your job is system design and troubleshooting:
1. Review code from GPT for security issues (no eval, no innerHTML with scraped data)
2. Help design the AgentService action chains for complex queries
3. Debug cross-origin and extension messaging issues
4. Optimize the multi-step scraping flow (parallel where possible)
5. Help write AI system prompts that effectively combine RAG + live data

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tool DOM changes | Scrapers break | Keep selectors in separate config, easy to update |
| Corporate CSP blocks extension | Can't inject scripts | Test early, may need IT exception |
| ServiceNow uses shadow DOM / iframes | Selectors don't reach nested content | Use `contentDocument` for iframes, `shadowRoot` for shadow DOM |
| Ollama too slow for multi-step | User waits too long | Cache scraped data (5-min TTL), parallelize scrapes |
| Too many tabs needed | Extension needs tools open | Add "headless" mode — extension opens tabs in background, scrapes, closes |

---

## Quick Win: Start Here

If you want to see results fast, do this today:

1. Open ServiceNow in Chrome
2. Right-click on a ticket number → Inspect
3. Write down the HTML tag and class/attribute
4. Do the same for: status, assignment group, short description
5. Share those selectors with any AI
6. Get a working GSN scraper in 30 minutes

That's your Phase 2 for one tool. The rest is just repeating the pattern.
