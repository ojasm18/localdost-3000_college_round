# PATCHWORK — MVP Implementation Plan (Deadline: Sunday 9:00 AM)

> **This document supersedes `PATCHWORK_IMPLEMENTATION_PLAN.md` for scope.** The earlier plan remains a reference for naming and ideas, but where the two differ, **this one wins**.
> Read the whole document before writing code. Follow names exactly. If something is unspecified, choose the simplest option and write one line in `DECISIONS.md`.

---

## 0. Ground rules for the agent

1. **Time is the main constraint.** About 16 hours remain, and the last 2 are reserved for polish and demo rehearsal. Stay on the schedule in Section 12. If a task overruns its time box by 50%, apply its **cut-line** (Section 12) and move on.
2. **Demo-first.** Everything must support the 8-step demo script (Section 13), run against the bundled demo site. Real-world URLs only need to work for **scan and before/after screenshots**.
3. **Real core, fake periphery.** These must be genuinely functional, not mocked: scan → issues → suggested patch → before/after → accept → review/conflict → verify → deploy → drift relocation → rollback → audit. Seed data is allowed only for history (past releases, audit events).
4. **Contract first.** Write `shared/types.ts` (Section 5) in the first 30 minutes. Backend, runtime, and frontend all import it.
5. **No yak-shaving.** No auth system, no Prisma, no monorepo tooling, no WebSockets/SSE, no light theme, no real multi-user realtime, no LLM. These are explicitly cut.
6. Keep commits small. Commit after every phase: `phase-N: <summary>`.

---

## 1. Product in one paragraph

PATCHWORK is a dashboard plus a tiny injected script (`patchwork.js`) that lets a developer fix a live website **without rebuilding it**. The developer enters a **URL**; PATCHWORK scans it in a headless browser, lists frontend issues and **backend symptoms** (it cannot modify servers; it detects failed requests and mitigates on the frontend or reports them), proposes **small, low-risk patches** with **before/after screenshots**, and lets the developer accept them. Accepted patches go through **review** (with **conflict detection**), **automated verification** (browser flow + visual diff), and **versioned deployment** with **one-click rollback**. After a site update moves elements, PATCHWORK **relocates** patched elements using structural and text context and flags **drifted/broken** patches. Everything lands in an **audit trail**.

### Problem statement coverage (all seven must be demonstrable)

| PS feature | MVP implementation |
|---|---|
| Visual Patching | Suggested-patch before/after + a lightweight click-to-edit Editor (demo site) |
| Smart Element Tracking | Runtime matcher (3 layers) + Patch Health page |
| Collaborative Editing | Role switcher (Developer / Reviewer), review, comments, conflict detection + resolve |
| Isolated Preview | Preview token: draft patches apply only with `?pw_preview=TOKEN` |
| Automated Verification | Playwright flows + pixelmatch diff, pass/fail with failing step |
| Versioned Deployment and Rollback | Immutable releases, live pointer, manual rollback, auto-rollback |
| Audit Trail | Single `audit.emit()`, Activity page with filters |

---

## 2. Scope: what is IN and what is CUT

| Area | IN (build) | CUT (do not build) |
|---|---|---|
| Auth | Fake "current user" switcher in the top bar (Asha = Developer, Ravi = Reviewer, Admin). Sent as header `x-user-id`. Role checks on server | Login, passwords, JWT, signup |
| DB | `better-sqlite3`, plain SQL, JSON columns (Section 4) | Prisma, migrations tooling |
| Realtime | Frontend **polling** every 2 s on active scan/test run | SSE, WebSockets |
| Scanner | Playwright + `@axe-core/playwright` + 5 custom rules, 1 page + up to 3 same-origin links | Perf/CLS/SEO rules, mobile pass, deep crawl |
| Patch gen | Rule-based only | LLM suggestions |
| Ops | `SET_STYLE`, `SET_ATTRIBUTE`, `REMOVE_ATTRIBUTE`, `SET_TEXT`, `HIDE`, `RUN_SCRIPT_TEMPLATE` (2 templates) | `INSERT_ELEMENT`, `SET_HTML_SAFE`, `REORDER`, `REMOVE_ELEMENT`, other templates |
| Preview | Preview token for snippet mode (demo site) and **server-side screenshots** for before/after on any URL | HTTP proxy mode, SSRF hardening beyond a basic private-IP block |
| Editor | Demo site in iframe, pick element, edit style/attribute/text, save draft | Undo/redo, device toggle, fingerprint inspector, behaviour tab |
| Collaboration | Submit, approve, request changes, comment, conflict detect + resolve (Keep A / Keep B) | Merge editor, revisions history UI, required-approval config |
| Verification | 2 seeded flows + auto smoke flow, pixelmatch, outside-region diff gate | Flow builder UI, baseline caching, ignore regions |
| Releases | Create, verify, deploy, rollback, auto-rollback on failed post-deploy smoke check | Per-release diff viewer, scheduled health job |
| Health | Matcher runs in runtime on page load, reports to server | Health history, confirm-relocation UI (single "Accept new location" button only) |
| Theme | Dark only, exact tokens in Section 10 | Light theme, theme toggle |
| Misc | Activity filters (action group, actor) | CSV export, command palette, keyboard shortcuts |

---

## 3. Tech stack (fixed)

- **Repo:** single folder, three packages via simple npm workspaces: `server/`, `web/`, `demo-site/`, plus `shared/` and `runtime/` as plain folders imported by relative path. Use `tsx` to run TypeScript. One root `npm run dev` using `concurrently`.
- **Server:** Node 20, Express, `zod`, `better-sqlite3`, `playwright`, `@axe-core/playwright`, `pixelmatch`, `pngjs`, `nanoid`.
- **Web:** React 18, Vite, TypeScript, Tailwind CSS, `lucide-react`, `react-router-dom`, `@tanstack/react-query`, `@fontsource/inter`, `@fontsource/jetbrains-mono`. Hand-write simple components; do **not** spend time installing/configuring shadcn.
- **Runtime:** TypeScript compiled with `esbuild` to one IIFE `patchwork.js`, no dependencies.
- **Ports:** web `5173`, server `4000`, demo-site `4100`.

---

## 4. Database (better-sqlite3, created on boot if missing)

Use `JSON` columns stored as TEXT. Create with `CREATE TABLE IF NOT EXISTS`. IDs are `nanoid(10)`. Timestamps are ISO strings.

```sql
users(id, name, role)                       -- seeded: asha DEVELOPER, ravi REVIEWER, admin ADMIN
site(id, name, baseUrl, siteKey, liveReleaseId, autoRollback INTEGER DEFAULT 1)
scans(id, siteId, url, status, progress, summary JSON, screenshotPath, createdAt)
issues(id, scanId, ruleId, category, severity, status, title, description, pageUrl,
       selector, fingerprint JSON, evidence JSON, suggestedPatchId, createdAt)
patches(id, title, description, status, source, riskLevel, riskScore, riskReasons JSON,
        issueId, authorId, targetPageUrlPattern, targetSelector, fingerprint JSON,
        operations JSON, health, healthDetail JSON, createdAt, updatedAt)
comments(id, patchId, authorId, body, createdAt)
reviews(id, patchId, reviewerId, decision, comment, createdAt)
conflicts(id, patchAId, patchBId, type, status, detail JSON, resolution JSON, createdAt)
previews(id, token, patchIds JSON, createdById, expiresAt, createdAt)
releases(id, version INTEGER, status, note, bundle JSON, bundleHash, parentReleaseId,
         deployedById, testRunId, deployedAt, createdAt)
testruns(id, trigger, status, releaseId, previewId, summary JSON, startedAt, finishedAt)
teststeps(id, testRunId, flowName, stepIndex, action, status, error,
          baselineShot, currentShot, diffShot, diffPercent)
flows(id, name, steps JSON)
audit(id, actorId, actorName, action, targetType, targetId, summary, metadata JSON, createdAt)
```

Single-site MVP: there is exactly one `site` row (Loomwear). Do not build site CRUD UI. The Scan page accepts **any URL**; scans of non-demo URLs are stored against the same site record.

### Enums (in `shared/types.ts`; use these exact strings)

```ts
Role           = 'ADMIN' | 'DEVELOPER' | 'REVIEWER'
IssueCategory  = 'ACCESSIBILITY' | 'LAYOUT' | 'CONTENT' | 'INTERACTION' | 'BACKEND_SYMPTOM'
IssueSeverity  = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
IssueStatus    = 'OPEN' | 'PATCH_SUGGESTED' | 'PATCH_ACCEPTED' | 'DISMISSED' | 'REPORT_ONLY'
PatchStatus    = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'VERIFIED' | 'DEPLOYED' | 'REVERTED' | 'REJECTED'
PatchSource    = 'SCANNER_RULE' | 'MANUAL_EDITOR'
RiskLevel      = 'LOW' | 'MEDIUM' | 'HIGH'
HealthStatus   = 'HEALTHY' | 'DRIFTED' | 'BROKEN' | 'UNKNOWN'
ReleaseStatus  = 'BUILDING' | 'LIVE' | 'SUPERSEDED' | 'FAILED' | 'ROLLED_BACK'
TestRunStatus  = 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR'
ConflictStatus = 'OPEN' | 'RESOLVED'
```

---

## 5. Shared contracts (`shared/types.ts`, write first)

```ts
export interface ElementFingerprint {
  cssSelector: string;       // shortest unique selector at capture
  domPath: string;           // "html>body>main>div.cart>button:nth-child(2)"
  tag: string;
  id?: string;
  classes: string[];
  attributes: Record<string,string>;   // exclude style/class/id; include name,type,href,aria-*,data-testid,role
  textContent: string;       // trimmed, whitespace-collapsed, max 200 chars
  nearbyText: string[];      // up to 3 snippets (parent heading, prev/next sibling text)
  ancestors: { tag: string; id?: string; classes: string[] }[]; // up to 4 levels
  rect: { x:number; y:number; width:number; height:number };
}

export type PatchOperation =
  | { op: 'SET_STYLE';        properties: Record<string,string>; important?: boolean }
  | { op: 'SET_ATTRIBUTE';    name: string; value: string }
  | { op: 'REMOVE_ATTRIBUTE'; name: string }
  | { op: 'SET_TEXT';         value: string }
  | { op: 'HIDE' }
  | { op: 'RUN_SCRIPT_TEMPLATE'; template: 'RETRY_FETCH_ON_FAIL' | 'FALLBACK_MESSAGE_ON_FAIL';
      params: Record<string,string|number> };
```

All operations act on the patch's own `targetSelector`/fingerprint-resolved element (no per-op selector in the MVP), **except** `RUN_SCRIPT_TEMPLATE`, which is page-level and may ignore the element.

Template definitions:

| Template | Params | Effect |
|---|---|---|
| `RETRY_FETCH_ON_FAIL` | `urlPattern` (substring), `retries` (≤3), `delayMs` | Wraps `window.fetch`; retries matching requests on network error or 5xx |
| `FALLBACK_MESSAGE_ON_FAIL` | `urlPattern`, `containerSelector`, `message` | If matching request fails, writes `message` (as **textContent**) into the container |

Also define zod schemas mirroring these types and a `scoreRisk(ops, ctx)` function (Section 7.3) in `shared/`.

---

## 6. Scanner (`server/src/scanner`)

### 6.1 Flow
`POST /api/scans {url}` → insert scan (`RUNNING`), return id immediately → background async function:

1. Launch Chromium (headless), viewport 1366×768, fresh context.
2. Attach listeners: `requestfailed`, `response` (status ≥ 500 or ≥ 400 for same-origin API/asset), `pageerror`, `console` errors.
3. `goto(url, waitUntil: 'networkidle', timeout 20s)`; allow the demo's CTA to render (`waitForTimeout(500)`).
4. Take full-page screenshot → `artifacts/scans/<scanId>/page.png`.
5. Run **axe-core** and map findings (6.2). Run **custom rules** (6.3).
6. For each finding with an element: capture fingerprint via `page.evaluate`, and an element screenshot crop (`element.screenshot`, padded if possible, skip on error).
7. Dedupe by `ruleId + selector + pageUrl`.
8. For each finding call `generatePatch(issue)`. If a patch is returned, insert it as `DRAFT` / `SCANNER_RULE`, set `issue.suggestedPatchId`, `issue.status='PATCH_SUGGESTED'`. Otherwise `REPORT_ONLY`.
9. Crawl up to 3 additional same-origin links found on the page (breadth-first, depth 1) and repeat steps 3–8 per page.
10. Update `progress` after each step (0–100); set `status='COMPLETED'` and `summary` (counts by severity/category). Emit audit events `SCAN_STARTED` / `SCAN_COMPLETED` (or `SCAN_FAILED` with error).

Basic URL safety: reject non-http(s) URLs; block `169.254.*`, `10.*`, `192.168.*`, `172.16-31.*`, `127.*`, `localhost` **unless** the host:port equals `DEMO_SITE_URL`'s host (demo is on localhost).

### 6.2 Axe mapping (run axe with these rules only)

| axe rule id | Our `ruleId` | Category | Severity | Patch? |
|---|---|---|---|---|
| `image-alt` | `a11y.img-alt` | ACCESSIBILITY | MEDIUM | `SET_ATTRIBUTE alt` = humanized filename (e.g. `hero-jacket.jpg` → "hero jacket"); description notes "review wording" |
| `button-name` | `a11y.button-name` | ACCESSIBILITY | HIGH | `SET_ATTRIBUTE aria-label` from `title`, icon class name, or `"Button"`; flag review |
| `label` | `a11y.input-label` | ACCESSIBILITY | HIGH | `SET_ATTRIBUTE aria-label` from `placeholder`/`name` |
| `html-has-lang` | `a11y.html-lang` | ACCESSIBILITY | LOW | `SET_ATTRIBUTE lang=en` on `html`, URL pattern `*` |
| `color-contrast` | `a11y.contrast` | ACCESSIBILITY | MEDIUM | `SET_STYLE color` = darkened/lightened version (same hue) that reaches ≥ 4.5:1 against the reported background; compute with a small contrast helper |
| `link-name` | `a11y.link-name` | ACCESSIBILITY | MEDIUM | `SET_ATTRIBUTE aria-label` from `href` last segment |

### 6.3 Custom rules (one file each: `{ id, run(page, ctx) → Finding[] }`)

| Rule ID | Detection | Category | Severity | Patch |
|---|---|---|---|---|
| `interaction.disabled-cta` | Button/input[type=submit]/a.btn whose text matches `/buy|checkout|pay|order|submit|sign up|add to cart/i` and has `disabled` attribute or `aria-disabled="true"` | INTERACTION | CRITICAL | `REMOVE_ATTRIBUTE disabled` (description: "verify the form state before deploying") |
| `layout.overlap-clickable` | For each interactive element (button, a, input) visible in viewport: `document.elementFromPoint(center)` is not the element or its descendant → overlay found | LAYOUT | HIGH | `SET_STYLE pointer-events:none` **on the overlay element** (the patch target is the overlay; fingerprint the overlay) |
| `layout.hidden-cta` | CTA (same text regex) exists but is `display:none`, `visibility:hidden`, `opacity:0`, or has zero size | LAYOUT | CRITICAL | `SET_STYLE` restoring `display:inline-block; visibility:visible; opacity:1` (only the offending property) |
| `layout.horizontal-overflow` | `document.documentElement.scrollWidth > clientWidth` — find the widest offender element | LAYOUT | MEDIUM | `SET_STYLE max-width:100%; overflow-wrap:anywhere` on that element |
| `net.failed-request` | Same-origin request with status ≥ 500 or network failure (excluding aborted) | BACKEND_SYMPTOM | HIGH | `RUN_SCRIPT_TEMPLATE RETRY_FETCH_ON_FAIL` (`urlPattern` = path, `retries=2`, `delayMs=500`). Evidence includes URL, status, timing. Description clearly says "Server-side root cause must be fixed by the backend team; this patch only mitigates" |
| `content.broken-image` | `img` with `complete && naturalWidth===0` | CONTENT | MEDIUM | **Report-only** |
| `net.client-error` | Same-origin 4xx on a non-image asset/API | BACKEND_SYMPTOM | MEDIUM | **Report-only** |

**Requirements:** every finding has evidence (HTML snippet or log line; screenshot crop when element-based). Rules must be deterministic. Do not invent patches for report-only issues.

---

## 7. Patches, risk, safety

### 7.1 Patch generator
`generatePatch(issue)` → `{ title, description, operations, targetSelector, targetPageUrlPattern, fingerprint }` or `null`. Titles are action phrases: `Remove disabled state from "Checkout" button`. Descriptions are one or two sentences: what changes and why it's low-risk. `targetPageUrlPattern` is the pathname where it was found (e.g. `/checkout.html`), except `html-lang` which is `*`.

### 7.2 Safety validation (server-side, on every create/update, returns 422 on failure)
- zod validation of operations.
- `SET_STYLE` allow-list of properties: `color, background-color, background, font-size, font-weight, text-decoration, display, visibility, opacity, pointer-events, z-index, position, top, right, bottom, left, width, height, min-width, min-height, max-width, max-height, margin*, padding*, overflow, overflow-wrap, border*, cursor`. Reject values containing `url(`, `expression(`, `javascript:`.
- `SET_ATTRIBUTE` rejects names starting with `on` and values starting with `javascript:`.
- `SET_TEXT` is applied as `textContent` only (never HTML).
- Template params are validated (number ranges, string length ≤ 200); the runtime never evals anything.

### 7.3 Risk score (`scoreRisk`)
Start 0, add:

| Factor | Points |
|---|---|
| each SET_STYLE | +3 |
| each SET_ATTRIBUTE / REMOVE_ATTRIBUTE | +5 (+10 if attribute is `href`, `src`, `type`, `disabled`) |
| SET_TEXT | +6 |
| HIDE | +12 |
| RUN_SCRIPT_TEMPLATE | +40 |
| URL pattern `*` | +10 |
| `important` used | +5 |
| target is interactive (button, a, input, form) | +8 |
| more than 3 operations | +5 per extra |

`LOW` 0–25, `MEDIUM` 26–55, `HIGH` 56–100. Store human-readable `riskReasons[]`. **Show score and reasons wherever a patch appears.**

---

## 8. Runtime (`runtime/src`, built to `server/public/patchwork.js`)

Served at `GET /runtime/:siteKey.js`. Demo site includes `<script src="http://localhost:4000/runtime/demo-loomwear.js" defer></script>`.

### 8.1 Boot
1. If `?pw_off=1` → do nothing.
2. If URL has `pw_preview=TOKEN` (stored to `sessionStorage` on first sight): fetch `/api/runtime/preview/:token` → draft patches. **Else** fetch `/api/runtime/bundle/:siteKey` → live release patches. Never mix them. Cache last good live bundle in `localStorage`; if fetch fails use the cache; if none, do nothing.
3. `POST /api/runtime/ping` once per session.
4. Filter patches by `targetPageUrlPattern` against `location.pathname` (glob: `*` wildcard).
5. For each patch: resolve element (8.2), apply operations (8.3), collect a health result. Install a `MutationObserver` (debounced 150 ms, stop after 8 s) to retry unresolved patches.
6. `POST /api/runtime/health` with the batch `[{patchId, status, method, confidence, oldLocation, newLocation, pageUrl}]` once.

### 8.2 Matcher (3 layers, return best candidate + confidence)

1. **Selector** (`fingerprint.cssSelector`): if found, **sanity check**: same tag and (text similarity ≥ 0.5 OR ≥ 1 identifying attribute equal). Pass → confidence **1.0** (method `SELECTOR`). Fail → treat as miss.
2. **Attribute match**: candidates = same tag; score by equality of `id`, `name`, `data-testid`, `aria-label`, `href`, `type`, `role` (Jaccard over key=value pairs). Method `ATTRIBUTES`.
3. **Text/context match**: candidates = same tag (plus elements with the same `role`); score:
   ```
   score = 0.35*textSim + 0.20*attrSim + 0.20*ancestorSim + 0.15*nearbyTextSim + 0.10*classSim
   ```
   `textSim` = max(normalized Levenshtein similarity, token Jaccard) on `textContent`; `ancestorSim` = fraction of stored ancestors matched in order by tag/id/classes; `nearbyTextSim` = token overlap with stored `nearbyText`. Method `TEXT_SEMANTIC`.

**Decision**
- Take the best candidate across layers 2–3 (layer 1 wins automatically if it passes).
- If top two candidates are within 0.05 of each other → `ambiguous`: subtract 0.15 from confidence.
- Confidence ≥ 0.70 (layer 2/3) → status `DRIFTED`, **apply** patch to the relocated element.
- 0.55–0.69 → `DRIFTED`, report but **do not apply**.
- < 0.55 or none → `BROKEN`, do not apply.
- Layer 1 pass → `HEALTHY`.

The server writes the latest result to `patches.health` and `patches.healthDetail` (`{method, confidence, oldLocation: fingerprint.cssSelector/domPath/rect, newLocation: {selector, domPath, rect}}`) and emits `PATCH_HEALTH_CHANGED` / `PATCH_RELOCATED` / `PATCH_BROKEN` **only when status changes**.

### 8.3 Apply
- Stamp the target with `data-pw-patches="id1,id2"` and `data-pw-id`. Style ops go into one `<style data-pw>` element using `[data-pw-id="<id>"]{...}` rules (add `!important` when `important`).
- Each op in try/catch. **The runtime must never throw into the host page.**
- Templates implemented in the runtime as fixed functions (`RETRY_FETCH_ON_FAIL` wraps `fetch` once, idempotent).
- Idempotent re-application.

### 8.4 Editor bridge (only when `window.parent !== window` and URL has `pw_editor=1`)
`postMessage` with origin check against `http://localhost:5173`:
- from dashboard: `pw:pick-mode {on}`, `pw:apply-draft {operations, fingerprint}`, `pw:clear-draft`
- from runtime: `pw:element-picked {fingerprint, computedStyle: {color, backgroundColor, fontSize, display, visibility}}`

---

## 9. Review, conflicts, verification, releases

### 9.1 Patch lifecycle (enforce server-side; 409 on illegal transitions)

```
DRAFT ─submit→ IN_REVIEW ─approve→ APPROVED ─verify pass→ VERIFIED ─deploy→ DEPLOYED ─rollback→ REVERTED
IN_REVIEW ─request changes→ DRAFT        DRAFT|IN_REVIEW ─reject→ REJECTED
```
- Roles: DEVELOPER/ADMIN create, edit, submit. REVIEWER/ADMIN approve/request changes. The author cannot approve their own patch (**ADMIN may**, audited).
- Editing a patch resets it to `DRAFT`.
- Creating a patch from an issue happens when the dev clicks **Accept patch** (issue → `PATCH_ACCEPTED`; patch stays `DRAFT`, now visible in Patches).

### 9.2 Conflict detection (run on create, edit, submit; also when building a release set)
Compare against all other patches in `DRAFT`, `IN_REVIEW`, `APPROVED`, `VERIFIED`, `DEPLOYED` with overlapping URL patterns (`*` overlaps everything).

- **`SAME_TARGET_SAME_PROPERTY`**: same element (identical `cssSelector`, or fingerprint text+tag+attributes similarity ≥ 0.9) and the same slot (a CSS property, an attribute name, or `text`) with **different** values. Same value → no conflict.
- **`TARGET_HIDDEN`**: one patch uses `HIDE` on an element another patch modifies.

Store `detail: {selector, slot, aValue, bValue}`. A patch with an `OPEN` conflict cannot be approved, verified, or released. Resolution: **Keep A** or **Keep B** — the loser patch's conflicting operation(s) are removed (creating an edit that resets it to `DRAFT`) and the conflict becomes `RESOLVED`.

### 9.3 Preview
`POST /api/previews {patchIds}` → `{token, previewUrl}` with `previewUrl = DEMO_SITE_URL + path + '?pw_preview=' + token`; expires in 2 h. The live bundle endpoint **ignores** preview tokens. Dashboard shows "Open preview" (new tab).

**Before/after screenshots (any URL)**: `POST /api/patches/:id/screenshots` → server opens the patch's `pageUrl` twice in Playwright (1) untouched (2) with the patch applied by injecting the runtime script in `page.addInitScript` along with a window variable `__PW_INJECT__ = {patches:[patch]}` that makes the runtime skip fetching and use that set. Returns `{before, after}` file paths (cached under `artifacts/patch-shots/<patchId>/`; recompute when the patch changes). Both screenshots are clipped to the **element rect ± 120 px** (or full viewport if no element) to make changes obvious; draw a 2 px accent outline on the target in the **after** image via injected CSS `[data-pw-id]{outline:2px solid #2DD4A8}` only for screenshot mode.

### 9.4 Verification (`server/src/verification`)
Flows are rows in `flows` (seeded, steps JSON):

```ts
type FlowStep =
 | {action:'goto', url:string} | {action:'click', selector:string} | {action:'fill', selector:string, value:string}
 | {action:'expectVisible', selector:string} | {action:'expectUrlContains', value:string}
 | {action:'expectText', selector:string, contains:string} | {action:'screenshot', name:string}
```
Seeded flows (demo site v1): `Browse → product`, `Add to cart → cart`, `Checkout → confirmation`. Plus an automatic **smoke flow**: visit home, product, cart, checkout; assert no `pageerror`, no ≥500 same-origin responses; screenshot each.

**Run procedure for a patch set** (preview or release candidate):
1. **Baseline pass**: all flows with no patches (runtime disabled via `pw_off=1`). Save screenshots.
2. **Candidate pass**: all flows with patch set injected via `__PW_INJECT__`. Save screenshots.
3. Per screenshot step and smoke page: pixelmatch (threshold 0.1) → `diffPercent`; write a diff PNG.
4. **Intent-aware gate**: for each patch whose page matches, expected region = target rect ± 16 px (from the candidate pass, element's bounding box). Diff pixels **outside** all expected regions must be ≤ **0.5%** of the page area; otherwise FAIL with reason `UNEXPECTED_VISUAL_CHANGE`. (If a patch is page-level, e.g. template or `html lang`, expected region is empty and any diff > 0.5% fails.)
5. **Behaviour gate**: any failed flow step → FAIL. New `pageerror`s or new ≥500 responses vs baseline → FAIL. Every patch must be applied (`[data-pw-patches~="<id>"]` exists) on its target page unless it's a template/page-level patch → else FAIL `PATCH_NOT_APPLIED`.
6. Save `testruns` + `teststeps`. Emit `TEST_RUN_STARTED` / `TEST_RUN_COMPLETED`.

On PASS: included patches `APPROVED → VERIFIED`. On FAIL: they stay `APPROVED`; the UI shows the failing step and diff image.

### 9.5 Releases
- **Create candidate** `POST /api/releases {patchIds, note}`: allowed statuses `APPROVED|VERIFIED`; conflict check across the set; build `bundle` (frozen array of `{patchId, operations, targetPageUrlPattern, targetSelector, fingerprint, title}`) and `bundleHash` (sha256 of canonical JSON); `status='BUILDING'`; start verification (`trigger='PRE_DEPLOY'`); link `testRunId`.
  - **Important**: the new release's bundle must be **cumulative**: it includes all patches currently `DEPLOYED` (from the live release) **plus** the newly selected ones. Deploys do not silently drop earlier fixes.
- **Deploy** `POST /api/releases/:id/deploy {override?, reason?}`: requires test run `PASSED`, or `override=true` + non-empty `reason` + ADMIN role (audit `DEPLOY_OVERRIDE`). In one SQLite transaction: set release `LIVE` + `deployedAt`; previous live → `SUPERSEDED`; `site.liveReleaseId` = this id; included patches → `DEPLOYED`. Emit `RELEASE_DEPLOYED`. Then asynchronously run the **post-deploy smoke flow** against the live demo site (`trigger='POST_DEPLOY'`); if it fails and `site.autoRollback=1` → auto-rollback to `parentReleaseId`, actor `SYSTEM`, emit `AUTO_ROLLBACK_TRIGGERED`.
- **Rollback** `POST /api/releases/:id/rollback {reason}` (target = any earlier non-FAILED release, default parent): transaction sets live pointer to the target, current → `ROLLED_BACK`, patches unique to rolled-back release → `REVERTED`, emits `RELEASE_ROLLED_BACK`. Must complete within one request.
- Releases are immutable once `LIVE`. A new fix = a new release.

### 9.6 Audit
One function: `audit.emit({actor, action, targetType, targetId, summary, metadata})`. **Routes/services must never insert into `audit` directly.** Summaries are readable sentences (`Asha deployed Release v4 (3 patches)`).

Actions (use exactly these): `SCAN_STARTED, SCAN_COMPLETED, SCAN_FAILED, PATCH_SUGGESTED, PATCH_CREATED, PATCH_EDITED, PATCH_ACCEPTED, PATCH_REJECTED, PATCH_SUBMITTED, PATCH_APPROVED, PATCH_CHANGES_REQUESTED, COMMENT_ADDED, CONFLICT_DETECTED, CONFLICT_RESOLVED, PREVIEW_CREATED, TEST_RUN_STARTED, TEST_RUN_COMPLETED, RELEASE_CREATED, RELEASE_DEPLOYED, DEPLOY_OVERRIDE, RELEASE_ROLLED_BACK, AUTO_ROLLBACK_TRIGGERED, PATCH_HEALTH_CHANGED, PATCH_RELOCATED, PATCH_BROKEN, ISSUE_DISMISSED`.

---

## 10. Dashboard UI and theme

### 10.1 Theme: "Mission-control for code" (dark only)
Dark-first developer-tool look (Linear / Vercel style): calm, precise, high contrast, patch-green accent. 1 px borders, no heavy shadows, no gradients except a very subtle top-of-page glow optional. 150 ms ease transitions; respect `prefers-reduced-motion`. Icons: `lucide-react` only. No emoji icons.

Put in `web/src/theme.css` and map to Tailwind `theme.extend.colors`:

```css
:root {
  --bg:#0A0E14; --surface-1:#10151D; --surface-2:#161C26; --surface-3:#1D2531;
  --border:#232C3A; --border-strong:#2F3B4D;
  --text:#E6EDF5; --text-muted:#9AA7B8; --text-faint:#6B7788;
  --accent:#2DD4A8; --accent-hover:#4BE3BB; --accent-fg:#04130E;
  --info:#5AA9FF; --warning:#F5B84B; --danger:#FF6B6B; --violet:#A78BFA; --neutral:#8896A9;
  --accent-soft:rgba(45,212,168,.12); --info-soft:rgba(90,169,255,.12);
  --warning-soft:rgba(245,184,75,.12); --danger-soft:rgba(255,107,107,.12); --violet-soft:rgba(167,139,250,.12);
  --focus-ring:#5AA9FF; --radius-sm:6px; --radius-md:10px; --radius-lg:14px;
}
```
Fonts: Inter for UI, JetBrains Mono for selectors, versions, hashes, diffs and numeric tables (`font-variant-numeric: tabular-nums`). Base size 14 px.

### 10.2 Semantic color map (centralise in `web/src/components/chips.tsx`; use everywhere)

| Concept | Mapping (always include icon + label, never colour only) |
|---|---|
| Severity | CRITICAL danger solid · HIGH danger soft · MEDIUM warning · LOW info |
| Patch status | DRAFT neutral · IN_REVIEW info · APPROVED accent-soft · VERIFIED violet · DEPLOYED accent solid · REVERTED warning · REJECTED danger-soft |
| Health | HEALTHY accent + check-circle · DRIFTED warning + compass · BROKEN danger + unlink · UNKNOWN neutral + help-circle |
| Risk | LOW accent · MEDIUM warning · HIGH danger |
| Release | LIVE accent with slow pulsing dot (only animated element) · SUPERSEDED neutral · ROLLED_BACK warning · FAILED danger · BUILDING info + spinner |

Components: cards (`surface-1`, 1 px border, radius-lg, 20 px padding); primary button (`accent` bg, `accent-fg` text); secondary (`surface-2` + border); destructive (`danger-soft` + `danger` text); chips 22 px high, full radius, soft bg; tables dense (44 px rows, sticky header, hover `surface-2`); diff additions `accent-soft` with accent left border, removals `danger-soft`.

### 10.3 Layout
- Left sidebar (fixed): logo "PATCHWORK" wordmark with a small patch-shaped glyph, nav items with count badges (danger for broken patches/open conflicts/failed runs, warning for awaiting review/drifted, info for new issues).
- Top bar: breadcrumb · **LivePill** (`● LIVE v4 · Healthy|Drifted`) · **User switcher** (Asha/Ravi/Admin dropdown, sets `x-user-id`, shows a role chip) · "New scan" primary button.
- Every list: **empty state**, **skeleton loading**, **error state with retry**. Every Deploy/Rollback/Override has a **confirm dialog** stating the effect (e.g. "Live moves from v4 to v3; 2 patches will be reverted").

### 10.4 Pages (routes)

| Route | Page | Contents |
|---|---|---|
| `/` | **Overview** | KPI cards (Live release + health, Open issues with severity mini-bar, Awaiting review, Open conflicts, Broken/Drifted patches, Last verification). *Release timeline* (last 5), *Health donut* (Recharts not required; simple CSS bar is fine), *Recent activity* (8), *Needs attention* list, and a red/amber **auto-rollback banner** if an auto-rollback happened in the last 24 h |
| `/scan` | **New scan** | Big URL input prefilled with demo URL, "Start scan". Active scan shows progress bar (poll 2 s) and log lines; recent scans list |
| `/issues` | **Issues** | Table: severity, category icon, title, page, status, patch? (risk chip), filters (severity, category, status, "backend symptoms"). Row click → detail |
| `/issues/:id` | **Issue detail** | Evidence (crop with highlight, HTML snippet, network/console log), explanation. If patch: **Before/After** (two images with a draggable slider; fallback tabs) generated via `/patches/:id/screenshots`, operation list, **risk meter + reasons**. Buttons: **Accept patch**, **Edit in editor**, **Dismiss**. Report-only issues show "Root cause suspected" text and no patch |
| `/editor` | **Editor** | Iframe of demo page (`?pw_editor=1`), "Pick element" toggle. Right panel after pick: element summary, **Style** controls (color, background, font size, display, visibility), **Attributes** (alt, aria-label, disabled, type, href) and **Text**. Live preview through `pw:apply-draft`. Footer: risk meter, **Save as draft patch** |
| `/patches` | **Patches** | Table with status filter tabs, health badge, risk chip, source chip. Multi-select → **Create release** |
| `/patches/:id` | **Patch detail** | Stepper `Draft → Review → Verified → Live`; **Changes** (operation list as property: old → new); risk; Before/After; **Conversation** (comments + review decisions); **Conflict banner** with **Resolve** link; actions by role/state: Submit, Approve, Request changes, Reject, **Preview** |
| `/conflicts/:id` | **Conflict** | Side-by-side A vs B with differing slot highlighted; buttons **Keep A**, **Keep B** |
| `/health` | **Patch Health** | Table: patch, page, status, method, confidence bar, last seen. Row expand: **old vs new** location (selectors, DOM paths, confidence). Buttons: **Accept new location** (overwrites patch fingerprint with the new one, sets `HEALTHY`), **Disable patch** (→ `REVERTED`, removed from next release) |
| `/test-runs` and `/test-runs/:id` | **Test runs** | List; detail shows flows with ✓/✗ steps and error text; screenshot steps show **baseline / current / diff** side by side; failure reason badge |
| `/releases` | **Releases** | Pinned **Live** card with big **Rollback…** button and a "Rollback to" dropdown; vertical timeline below. **Create release** panel: choose patches → conflict check result → verification progress → **Deploy** (stepper) |
| `/activity` | **Activity** | Feed with filters (actor, action group: Scans/Patches/Reviews/Releases/Health) and expandable metadata |
| `/settings` | **Settings** | Snippet with copy button, **Auto-rollback toggle**, **Demo controls** (switch demo site v1/v2, toggle "broken backend") |

UX rules: broken-to-fixed path ≤ 6 clicks from Overview; keyboard focus rings visible; dashboard text/background pairs ≥ 4.5:1.

---

## 11. Demo site and seed data

### 11.1 Demo site "Loomwear" (`demo-site/`, static HTML/CSS/vanilla JS served by a tiny Express on 4100)
Pages: `/index.html`, `/product.html`, `/cart.html`, `/checkout.html`. Fake API on the same server: `/api/products` (ok), `/api/cart` (ok), `/api/pay` (**returns 500** when `brokenBackend=true`, else 200 JSON). The checkout page calls `/api/pay` on "Pay now" and navigates to `/confirmation.html` on success.

Control endpoints (CORS enabled): `POST /__switch {version:'v1'|'v2'}`, `POST /__backend {broken:boolean}`, `GET /__state`.

**v1 seeded defects (scanner must find them):**
1. Checkout button `disabled` (`interaction.disabled-cta`, CRITICAL).
2. A sticky promo banner overlay covers "Pay now" (`layout.overlap-clickable`).
3. Two product images without `alt`; icon-only cart button without accessible name.
4. Newsletter input without label.
5. Low-contrast grey price text.
6. Footer element causes horizontal overflow.
7. `/api/pay` returns 500 on first try then succeeds on retry (`net.failed-request`, makes the retry template visibly useful).
8. One image 404s (`content.broken-image`, report-only).
9. `<html>` has no `lang`.

**v2 (simulated redeploy):**
- Checkout button: `id` `checkout-btn` → `cta-checkout`, new wrapper div, renamed classes (`.btn-primary` → `.cta cta--primary`), text "Checkout" → "Proceed to checkout".
- Cart icon button moves to another header region.
- One element that has a patch (e.g. the newsletter input) is **removed** (→ `BROKEN` demo).

### 11.2 Seed script (`npm run seed`)
Users (Asha DEVELOPER, Ravi REVIEWER, Admin ADMIN); site (`siteKey = demo-loomwear`, baseUrl demo); three flows; **history only**: releases v1–v3 (v1 SUPERSEDED, v2 ROLLED_BACK, v3 LIVE, empty/small bundles of harmless patches such as `html lang`), ~25 audit events, 1 resolved conflict, 2 past test runs. **The demo script's scan, patches, preview, verification, deploy, drift and rollback must be real.** Seed must be idempotent and `npm run reset` wipes the DB and re-seeds.

---

## 12. Schedule and cut-lines (≈16 h; adjust start time, keep the order)

Times are budgets per phase. Check acceptance criteria at the end of each phase.

| Phase | Budget | Build | Acceptance | Cut-line if behind |
|---|---|---|---|---|
| **P0 Setup** | 0:45 | Folders, deps, `shared/types.ts`, SQLite init + seed, Express skeleton, `audit.emit`, Vite app with theme, layout, user switcher, route stubs | `npm run dev` starts all 3; Overview shows seeded timeline and activity | none |
| **P1 Demo site** | 0:45 | Loomwear v1/v2 + control endpoints + all 9 defects | Each defect visible manually; `/__switch` flips markup | Skip defect 6 and 8 |
| **P2 Scanner + Issues UI** | 2:30 | Playwright scan, axe mapping, 5 custom rules, fingerprint + crops, polling UI, Issues list/detail (evidence) | Scanning v1 yields ≥ 8 issues incl. disabled CTA, overlay, backend 500; each has evidence and fingerprint | Drop crawl (single page), drop `horizontal-overflow` |
| **P3 Patches + runtime + before/after** | 3:00 | Generator, `scoreRisk`, validation, runtime apply engine, Playwright before/after screenshots, issue detail slider, accept/dismiss | Each patchable defect's before/after visibly fixes the issue; unsafe ops return 422 | Drop `contrast` patch generation (report-only) |
| **P4 Patch list + review + conflicts** | 2:00 | Patches page + detail, state machine, review/comment, conflict detect + resolve UI | Two patches with different values for the same property create an OPEN conflict that blocks approval; Keep A/B clears it | Drop comments (keep approve/reject) |
| **P5 Preview + verification** | 2:30 | Preview tokens, flows runner, pixelmatch, intent-aware gate, Test run UI | Good set passes; a deliberately bad patch (HIDE on Pay button) **fails** with failing step/diff; preview token never affects live bundle | Skip outside-region logic: use a plain `diffPercent ≤ 2%` gate with expected-region ignored |
| **P6 Releases + rollback** | 2:00 | Candidate, cumulative bundle, deploy, rollback, post-deploy smoke, auto-rollback, Releases UI | Deploy v4 → demo site (reload) shows fix; rollback restores previous; broken deploy auto-rolls back with banner + audit | Drop auto-rollback UI banner (keep audit) |
| **P7 Health / drift** | 1:30 | Runtime matcher 3 layers, `/api/runtime/health`, Health page, Accept new location | Switch to v2: checkout patch DRIFTED + applied (≥ 0.70) with explanation; removed-element patch BROKEN and not applied | Drop `ambiguous` handling |
| **P8 Editor** | 1:30 | Iframe editor, pick mode, style/attribute/text panel, save draft | Pick checkout button, change colour, save → appears in Patches with risk | **First thing to cut** if behind; demo step 4 can instead use a seeded manual-patch conflict partner |
| **P9 Polish + rehearsal** | 2:00 | Empty/loading/error states, confirm dialogs, activity filters, README + demo script, `npm run reset`, run the full demo twice | Full demo script passes twice in a row from `npm run reset` | none (do not skip) |

**If the clock is behind at the halfway mark:** cut P8 entirely, then trim P4 comments, then simplify P5's gate. Never cut P6, P7, or audit: they are the heart of the PS.

---

## 13. Demo script (must work exactly like this)

1. **Overview** shows live v3 and healthy status. (Seed history.)
2. **New scan** → Loomwear v1 URL → issues appear (≥ 8, including a CRITICAL disabled checkout CTA and a backend-symptom 500).
3. Open the checkout issue → evidence → **before/after** shows the fixed button → **Accept patch**. Accept 2 more (alt text, overlay).
4. Switch to **Ravi**; **submit** (as Asha) then **approve** (as Ravi) the patches. Show a **conflict**: a second patch (manual via Editor, or seeded conflict partner) edits the same property of the checkout button → conflict banner blocks approval → **Keep A** resolves it.
5. Select patches → **Create release** → verification runs → **PASSED** → **Deploy v4** → reload the demo site: the button works.
6. Settings → switch demo to **v2** → reload demo → **Patch Health**: checkout patch **DRIFTED → relocated (≈0.9 confidence)** with old/new locations; the newsletter patch **BROKEN**.
7. Create a deliberately bad patch (HIDE on Pay button) → verification **FAILS** with the diff → admin force-deploy with reason → post-deploy smoke fails → **auto-rollback** to v4 with banner.
8. **Activity** log shows every step above, filterable.

---

## 14. API summary (base `/api`; JSON; header `x-user-id`)

```
GET  /me                       GET  /users
GET  /overview
POST /scans {url}              GET  /scans   GET /scans/:id   GET /scans/:id/issues
GET  /issues?severity&category&status&hasPatch   GET /issues/:id
POST /issues/:id/accept-patch  POST /issues/:id/dismiss
GET  /patches?status           POST /patches   GET /patches/:id   PATCH /patches/:id
POST /patches/:id/submit       POST /patches/:id/review {decision, comment}
POST /patches/:id/reject       POST /patches/:id/screenshots
POST /patches/:id/comments     GET  /patches/:id/comments
POST /patches/:id/accept-location   POST /patches/:id/disable
GET  /conflicts  GET /conflicts/:id  POST /conflicts/:id/resolve {strategy:'KEEP_A'|'KEEP_B'}
POST /previews {patchIds}
POST /test-runs {previewId? | releaseId? | trigger:'MANUAL'}   GET /test-runs   GET /test-runs/:id
GET  /releases  POST /releases {patchIds, note}  GET /releases/:id
POST /releases/:id/deploy {override?, reason?}   POST /releases/:id/rollback {reason}
GET  /audit?actor&group&cursor
GET  /health
POST /site/settings {autoRollback}      GET /site
POST /demo/switch {version}  POST /demo/backend {broken}     (proxy to demo control endpoints)
GET  /artifacts/*   (static screenshots)

Runtime (public, CORS *, no cookies):
GET  /runtime/:siteKey.js   GET /api/runtime/bundle/:siteKey   GET /api/runtime/preview/:token
POST /api/runtime/ping      POST /api/runtime/health
```
Errors: `{error:{code,message}}`. 422 validation, 403 role, 409 illegal state.

---

## 15. Tests (only what protects the demo)

Vitest, written alongside the code, ≈ 30 minutes total:
- `scoreRisk` (one case per factor).
- Safety validators (reject `url()`, `on*` attrs, `javascript:`).
- Matcher on fixture DOMs: v1→v2 relocation succeeds with confidence ≥ 0.70; removed element yields BROKEN; two near-identical candidates → ambiguous.
- Conflict detector: same property different value → conflict; same value → none.
- State machine: allowed and forbidden transitions.
- Release `bundleHash` determinism and cumulative bundle contents.

No E2E framework. Instead, run the demo script manually twice in P9.

---

## 16. Environment and scripts

`.env`: `PORT=4000`, `DEMO_SITE_URL=http://localhost:4100`, `DASHBOARD_ORIGIN=http://localhost:5173`, `ARTIFACTS_DIR=./artifacts`, `DB_PATH=./patchwork.db`.

Scripts: `npm run dev` (server + web + demo-site + runtime watch), `npm run seed`, `npm run reset`, `npm run build:runtime`, `npm test`. First-run note in README: `npx playwright install chromium`.

---

## 17. Rules for the agent (common failure modes)

1. Do **not** build a dashboard that only lists issues; all seven PS features must work (Section 1).
2. Do **not** claim to patch servers. Backend issues are symptoms: mitigated on the frontend or report-only.
3. Do **not** let anything reach the live bundle without the state machine and a passing test run (admin override with reason is the only exception).
4. Do **not** add free-form JS execution. Template ops only.
5. Do **not** hard-code scanner/matcher/verification results. Seeding is for history only.
6. Do **not** rename enums, routes, ops, or color tokens from this document. Record unavoidable deviations in `DECISIONS.md`.
7. Every state change goes through `audit.emit`.
8. The runtime must be dependency-free and never throw into the host page.
9. Build in the Section 12 order; apply cut-lines instead of overrunning.
10. Keep the dashboard in the specified dark theme; do not substitute a default template look.
11. Finish with a README: setup, `npx playwright install chromium`, `npm run dev`, the snippet, and the Section 13 demo script.

---

## 18. Definition of done (9:00 AM)

- Demo script (Section 13) passes twice in a row after `npm run reset`.
- Seven PS features demonstrably work, plus the URL scanner with before/after.
- Dark theme applied with the specified tokens.
- README and `DECISIONS.md` present; `npm test` green.
- A 2-minute screen recording of the demo script (record after the second clean run) saved as backup in case live demo fails.
