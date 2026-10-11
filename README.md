# PATCHWORK

> **Instant, non-invasive visual remediation & live website patching platform.**

PATCHWORK enables engineering and QA teams to scan live websites, detect accessibility defects and visual layout bugs, propose hotfixes, visually test DOM modifications in real time, collaborate via peer review, resolve selector collisions, bundle patches into immutable versioned releases, and inject live fixes into production websites with zero downtime and automated regression rollbacks.

---

## Table of Contents

- [Core Architecture & Lifecycle](#core-architecture--lifecycle)
- [Feature Overview](#feature-overview)
  - [1. Automated Web Scanner & Overlay Exploration](#1-automated-web-scanner--overlay-exploration)
  - [2. Issue Management & Remediation](#2-issue-management--remediation)
  - [3. Interactive Visual Editor](#3-interactive-visual-editor)
  - [4. Patch Lifecycle & Peer Review](#4-patch-lifecycle--peer-review)
  - [5. Conflict Detection & Resolution](#5-conflict-detection--resolution)
  - [6. Patch Health & Selector Drift Tracking](#6-patch-health--selector-drift-tracking)
  - [7. Automated Visual Test Runs & Diff Gates](#7-automated-visual-test-runs--diff-gates)
  - [8. Release Management & Live Injection](#8-release-management--live-injection)
  - [9. Audit Trail & Compliance](#9-audit-trail--compliance)
  - [10. Settings & Global System Reset](#10-settings--global-system-reset)
- [User Roles & Collaboration Model](#user-roles--collaboration-model)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Running the Project](#running-the-project)
- [Setup & Maintenance Scripts](#setup--maintenance-scripts)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Comprehensive REST API Reference](#comprehensive-rest-api-reference)
- [Project Directory Structure](#project-directory-structure)

---

## Core Architecture & Lifecycle

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   Playwright    │ ───>  │  Detected Issue │ ───>  │  Candidate      │
│   Web Scanner   │       │  & Evidence     │       │  Patch (Draft)  │
└─────────────────┘       └─────────────────┘       └────────┬────────┘
                                                             │ submit
                                                             ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   Live Client   │ <───  │    Immutable    │ <───  │   Peer Review   │
│   patchwork.js  │       │ Release Bundle  │       │(Reviewer/Admin) │
└────────┬────────┘       └─────────────────┘       └────────┬────────┘
         │                                                   │ approve
         ▼                                                   ▼
┌─────────────────┐                                 ┌─────────────────┐
│ Automated Drift │                                 │ Conflict Check  │
│ & Auto-Rollback │                                 │ & Pre-deploy Run│
└─────────────────┘                                 └─────────────────┘
```

1. **Scan**: Playwright launches headless browser, audits DOM using Axe-Core, inspects interactive overlays, and detects runtime/contrast issues.
2. **Draft**: Issues generate proposed patches, or developers draft custom style/attribute operations using the Visual Editor.
3. **Review**: Developers submit patches for review. Reviewers (`Ravi`) and Admins inspect operation diffs, check conflicts, and approve.
4. **Bundle & Verify**: Approved patches are bundled into an immutable release candidate with a canonical SHA-256 hash.
5. **Inject**: The target website loads `<script src=".../runtime/patchwork.js">`, fetching the live release bundle and applying non-invasive DOM patches in `<1ms`.
6. **Guard**: If visual drift or post-deploy anomalies occur, automated rollback gates restore the previous known-good release.

---

## Feature Overview

### 1. Automated Web Scanner & Overlay Exploration
- **Headless Browser Execution**: Powered by Playwright with fallback support for system Chromium/Edge on Windows.
- **Accessibility & Contrast Engine**: Audits against WCAG rules (missing labels, low contrast, landmark violations).
- **Deep Overlay Exploration**: Automatically triggers modals, dropdowns, and submenus to surface hidden issues.
- **Backend Symptom Detection**: Captures network 500 errors and console anomalies during page execution.
- **Evidence Screenshots**: Full-page viewports and element crops saved with precise bounding boxes.
- **1-Click Remediation**: Automatically generates candidate patches from scan rules (e.g., adding `role="main"` or `aria-label`).

### 2. Issue Management & Remediation
- Filter issues by **Severity** (`CRITICAL`, `SERIOUS`, `MODERATE`, `MINOR`) and **Category** (`ACCESSIBILITY`, `CONTRAST`, `SEMANTICS`, `OVERLAY_TRAP`, `BACKEND_SYMPTOM`).
- Review DOM selector, selector fingerprint, and visual crop evidence.
- Accept an issue to spawn an editable candidate patch, or dismiss with an audited reason.

### 3. Interactive Visual Editor
- Input any live URL to load an interactive iframe canvas.
- Element picker tool inspects tags, classes, and computed styles.
- Visual style controls: `background-color`, `color`, `font-size`, `display`.
- Attribute controls: Add/edit `aria-label`, remove `disabled`, and replace text content.
- Real-time safety validation prevents unsafe attributes (`onclick`, `<script>`, `onerror`).

### 4. Patch Lifecycle & Peer Review
- **Patch Status Machine**: `DRAFT` ➔ `IN_REVIEW` ➔ `APPROVED` ➔ `VERIFIED` ➔ `DEPLOYED` (or `REVERTED` / `REJECTED`).
- **Risk Scoring**: Calculates risk score (`LOW`, `MEDIUM`, `HIGH`) based on operation count, selector specificity, and interactive element targets.
- **Flexible Peer Review**:
  - Developers can submit draft patches for peer review.
  - Reviewers (`Ravi`) and Admins can approve patches directly from `DRAFT` or `IN_REVIEW`.
  - Reviewers can request changes with feedback notes, resetting the patch to `DRAFT`.
  - Batch approval toolbar on the Patches List page for fast multi-patch approval.
- **Live Preview Generation**: Generates isolated shareable preview URLs (`?pw_preview=<token>`) without touching production.

### 5. Conflict Detection & Resolution
- Automated collision detection identifies when multiple candidate patches target overlapping DOM selectors and style properties.
- Blocks approval or release bundling until collisions are cleared.
- Side-by-side conflict resolver interface: Choose **Keep Patch A** or **Keep Patch B**.

### 6. Patch Health & Selector Drift Tracking
- Tracks patch DOM targets across target website redeployments.
- Multi-vector fingerprinting uses Jaccard similarity across attributes, tag hierarchy, and surrounding text context.
- Statuses: `HEALTHY`, `DRIFTED` (target moved), or `BROKEN` (target missing).
- One-click relocation acceptance: updates the patch to the relocated selector seamlessly.

### 7. Automated Visual Test Runs & Diff Gates
- Baseline and candidate screenshot capture using Playwright.
- Multi-viewport visual diffing via `pixelmatch` (flags regressions if diff > 0.5%).
- Triggered automatically during release candidate verification (`PRE_DEPLOY` and `POST_DEPLOY`).
- Dedicated report inspector displays baseline, current, and diff visual layers.

### 8. Release Management & Live Injection
- Group approved and verified patches into immutable Release Candidates (`v1`, `v2`, ...).
- Canonical SHA-256 bundle hash ensures deterministic execution.
- Single-transaction live deployment: updates active release and marks patches as `DEPLOYED`.
- Live rollback: instantly revert to previous release version.
- Admin deploy override: bypass failing checks with mandatory audit justification.
- Lightweight client injection script (`patchwork.js`) runs in `<1ms`, listening for mutations and applying hotfixes.

### 9. Audit Trail & Compliance
- Comprehensive chronological event log tracking every system action.
- Action categories: `Scans`, `Patches`, `Reviews`, `Releases`, `Health`, and `System`.
- Records timestamp, actor ID, actor display name, target entity, and human-readable summaries.

### 10. Settings & Global System Reset
- Configure site identity, primary base URL, and unique `siteKey`.
- Copy-paste client injection snippet tag.
- Toggle **Automatic Post-Deploy Rollback**: automatically rolls back live releases if post-deploy checks detect 500s or runtime exceptions.
- **Global System Reset** (Danger Zone): Two-step confirmation button to wipe database tables and restore clean factory defaults.

---

## User Roles & Collaboration Model

PATCHWORK includes a built-in role switcher in the top navigation bar. Every API request transmits the active user via the `x-user-id` header:

| User | ID | Role | Permissions |
|---|---|---|---|
| **Asha** | `asha` | `DEVELOPER` | Can scan sites, create/edit patches in Visual Editor, submit patches for review, and dismiss issues. Cannot approve patches or force deploy. |
| **Kiran**| `kiran` | `DEVELOPER` | Second developer: create/edit patches, simulate DOM fixes, submit for review, collaborate on tickets. |
| **Ravi** | `ravi` | `REVIEWER` | Can review candidate patches, approve patches (from Draft or In-Review), request changes, and resolve selector collisions. |
| **Admin**| `admin` | `ADMIN` | Full administrative privileges: approve patches, deploy releases, trigger deploy overrides, configure site settings, and perform Global System Reset. |

---

## Tech Stack

| Domain | Technologies |
|---|---|
| **Monorepo** | NPM Workspaces (`server`, `web`) |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, `@tanstack/react-query`, React Router 6, Lucide React |
| **Backend** | Node.js, Express, TypeScript, Playwright, `@axe-core/playwright`, SQLite (`sql.js`), `pixelmatch`, `pngjs` |
| **Shared** | TypeScript interfaces, Zod schemas, operation safety validator, risk scoring algorithm |
| **Testing** | Vitest |

---

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **NPM**: v9.0.0 or higher
- **Playwright Chromium**:
  ```bash
  npx playwright install chromium
  ```
  *(On Windows machines, the scanner automatically falls back to installed Microsoft Edge if Chromium is not downloaded).*

---

## Installation & Setup

1. **Clone the repository and install dependencies**:
   ```bash
   git clone https://github.com/ojasm18/localdost-3000_college_round.git patchwork
   cd patchwork
   npm install
   ```

2. **Environment Configuration**:
   Create or verify `.env` in the root directory:
   ```env
   PORT=4000
   DASHBOARD_ORIGIN=http://localhost:5173
   ARTIFACTS_DIR=./artifacts
   ```

3. **Initialize & Seed Database**:
   Populate baseline records (default users Asha, Ravi, Admin; site configuration; smoke check flow):
   ```bash
   npm run seed
   ```

---

## Running the Project

### Start Both Frontend and Backend Concurrently (Recommended)
```bash
npm run dev
```

- **Web Dashboard**: [http://localhost:5173](http://localhost:5173)
- **API Server**: [http://localhost:4000](http://localhost:4000)

### Start Services Individually
```bash
# Terminal 1: Backend Server (runs on port 4000 with auto-reload)
npm run dev:server
# or: npm run dev -w server

# Terminal 2: Web Dashboard (runs on port 5173)
npm run dev:web
# or: npm run dev -w web
```

---

## Setup & Maintenance Scripts

Defined in root `package.json`:

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `concurrently ...` | Starts server (4000) and web (5173) in parallel. |
| `npm run dev:server` | `npm run dev -w server` | Starts Express server with `tsx watch` auto-reloading. |
| `npm run dev:web` | `npm run dev -w web` | Starts Vite development server. |
| `npm run seed` | `tsx server/src/seed.ts` | Populates default users, site record, and baseline test flows. |
| `npm run reset` | `node -e ... && npm run seed` | Deletes `patchwork.db` from disk and re-seeds cleanly. |
| `npm run build -w web`| `tsc && vite build` | Typechecks and creates optimized production bundle in `web/dist`. |
| `npm test` | `vitest run` | Runs unit tests for operation safety and risk scoring. |

---

## Testing & Quality Assurance

### 1. Vitest Unit Test Suite
Validates operation sanitization, dangerous attribute blocking (event handlers, script injection), and risk scoring:
```bash
npm test
```

### 2. Frontend Build & Type Validation
```bash
npm run build -w web
```

### 3. Server Type Validation
```bash
npx -w server tsc --noEmit
```

### 4. API Endpoints Testing via PowerShell or cURL

#### Query System Overview
```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/overview"
```

#### Approve Patch as Reviewer (Ravi)
```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/patches/<PATCH_ID>/approve" `
  -Method POST `
  -Headers @{ "x-user-id" = "ravi" } `
  -ContentType "application/json" `
  -Body '{"comment":"Verified contrast ratio. Approved."}'
```

#### Global System Reset
```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/system/reset" `
  -Method POST `
  -Headers @{ "x-user-id" = "admin" }
```

---

## Comprehensive REST API Reference

All API routes are prefixed with `/api`. Requests accept and return JSON. The calling identity is set via `x-user-id` header (`asha`, `ravi`, or `admin`).

### Authentication & Users
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/me` | Returns active user profile based on `x-user-id`. |
| `GET` | `/api/users` | Lists all seeded users for role switching. |

### System & Overview
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/overview` | Dashboard metrics: issues, pending reviews, collisions, live release info. |
| `GET` | `/api/site` | Fetches active site settings and live release ID. |
| `POST` | `/api/site/settings` | Updates site name, target base URL, siteKey, or autoRollback toggle. |
| `POST` | `/api/system/reset` | Global Reset: drops all runtime tables, restores factory defaults, saves DB. |
| `POST` | `/api/reset` | Alias for `/api/system/reset`. |

### Scans & Detection
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/scans` | Lists previous website scans ordered by creation date. |
| `POST` | `/api/scans` | Initiates new scan (`{ url: string }`). |
| `GET` | `/api/scans/:id` | Detailed scan report including status, summary, and screenshot paths. |
| `DELETE`| `/api/scans/:id` | Deletes scan record and cleans up associated screenshot image. |
| `POST` | `/api/scans/delete-batch` | Bulk deletion of scans (`{ ids?: string[], url?: string }`). |

### Issues
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/issues` | Lists detected issues (supports `?scanId`, `?severity`, `?category`, `?status`). |
| `GET` | `/api/issues/:id` | Retrieves issue metadata, evidence image, selector, and suggested patch. |
| `POST` | `/api/issues/:id/dismiss` | Dismisses an issue (`{ reason: string }`). |
| `POST` | `/api/issues/:id/reopen` | Reopens a previously dismissed issue. |

### Patches Lifecycle & Review
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/patches` | Lists patches (supports `?status`, `?search`). |
| `POST` | `/api/patches` | Creates a new patch from Visual Editor or Scanner (`title`, `operations`, etc.). |
| `GET` | `/api/patches/:id` | Full patch detail with operations, risk score, fingerprint, and comments. |
| `PATCH`| `/api/patches/:id` | Updates patch title, description, or operation list. |
| `POST` | `/api/patches/:id/submit` | Transitions patch status from `DRAFT` ➔ `IN_REVIEW`. |
| `POST` | `/api/patches/:id/approve` | **Approve Patch**: Accessible to `REVIEWER` and `ADMIN`. Verifies zero open conflicts, updates status to `APPROVED`, records review note, logs audit trail. |
| `POST` | `/api/patches/:id/request-changes` | **Request Changes**: Accessible to `REVIEWER` and `ADMIN`. Resets status to `DRAFT`. |
| `POST` | `/api/patches/:id/review` | Generic review submission (`{ decision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED', comment }`). |
| `POST` | `/api/patches/batch-approve` | **Batch Approve**: Approves array of patch IDs (`{ patchIds: string[], comment? }`). |
| `POST` | `/api/patches/:id/reject` | Rejects/closes a patch. |
| `POST` | `/api/patches/:id/accept-location`| Accepts relocated selector when DOM drift is detected. |
| `POST` | `/api/patches/:id/disable` | Disables a broken patch. |

### Comments & Collaboration
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/patches/:id/comments` | Fetches discussion thread comments for a patch. |
| `POST` | `/api/patches/:id/comments` | Posts a new comment (`{ body: string }`). |

### Conflicts
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/conflicts` | Lists all detected patch collisions. |
| `GET` | `/api/conflicts/:id` | Retrieves collision details (conflicting selectors and properties). |
| `POST` | `/api/conflicts/:id/resolve` | Resolves collision via `{ winnerPatchId, loserAction: 'REMOVE_CONFLICTING_OP' | 'DROP_PATCH' }`. |

### Previews
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/previews` | Generates a shareable preview token (`{ patchIds: string[] }`). |
| `GET` | `/api/previews/:token` | Resolves preview token to patch bundle for isolated verification. |

### Releases & Deployment
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/releases` | Lists release history, version numbers, bundles, and status. |
| `POST` | `/api/releases` | Creates new release candidate bundling specified approved patches. |
| `GET` | `/api/releases/:id` | Retrieves release candidate bundle and verification test run info. |
| `POST` | `/api/releases/:id/deploy` | Deploys release to live production (`{ override?: boolean, reason?: string }`). |
| `POST` | `/api/releases/:id/rollback` | Rolls back live site to parent release version. |

### Test Runs
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/test-runs` | Lists automated regression test runs. |
| `POST`| `/api/test-runs` | Triggers a new visual test suite run using Playwright and Pixelmatch (`{ trigger?: 'MANUAL' | 'PRE_DEPLOY', releaseId?, previewId? }`). |
| `POST`| `/api/test-runs/:id/rerun` | Reruns an existing test run and generates fresh baseline, candidate, and diff screenshots. |
| `GET` | `/api/test-runs/:id` | Detailed step-by-step report with baseline, current, and pixelmatch diff images. |

### Audit & Runtime
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/audit` | Chronological audit trail (filterable by `?actor`, `?group`). |
| `GET` | `/runtime/patchwork.js` | Client-side injection script injected into `<head>` of target website. |
| `GET` | `/api/runtime/bundle` | Delivers active live patch bundle to `patchwork.js` based on `siteKey`. |
| `GET` | `/artifacts/:filename` | Serves static viewport screenshots and diff images. |

---

## Project Directory Structure

```
patchwork/
├── .env                          # Server & client environment variables
├── .gitignore                    # Git tracking ignore rules
├── package.json                  # Monorepo configuration, workspace definitions, scripts
├── patchwork.db                  # Local SQLite database (sql.js binary file)
├── tsconfig.json                 # Root TypeScript compiler options
│
├── server/                       # Backend Application
│   ├── package.json              # Server dependencies & execution scripts
│   ├── artifacts/                # Generated viewport screenshots & visual diffs
│   └── src/
│       ├── audit.ts              # Centralized audit trail emitter
│       ├── db.ts                 # SQLite schema, sql.js wrapper, saveDb, resetDatabase
│       ├── index.ts              # Express server setup & port binding
│       ├── scanner.ts            # Playwright + Axe-Core accessibility scanner engine
│       ├── seed.ts               # Database initialization seeder
│       └── routes/
│           └── index.ts          # Express REST API routes implementation
│
├── shared/                       # Shared Domain Logic
│   ├── types.ts                  # TypeScript types: Patch, Issue, Release, Audit, User
│   ├── validation.ts             # Zod schemas, risk scoring engine, operation safety rules
│   └── validation.test.ts         # Vitest unit test suite
│
└── web/                          # Frontend Dashboard (Vite + React)
    ├── index.html                # HTML document template
    ├── package.json              # Web dependencies & build scripts
    ├── vite.config.ts            # Vite bundler configuration
    ├── tailwind.config.js        # Design tokens, color palette, custom styling
    └── src/
        ├── App.tsx               # Route layout and navigation shell
        ├── api.ts                # Fetch client with typed wrappers & x-user-id header
        ├── main.tsx              # React DOM mounting
        ├── theme.css             # Theme variables & typography
        ├── components/
        │   ├── Layout.tsx        # Responsive navigation sidebar, header, role switcher
        │   ├── chips.tsx         # Status chips (PatchStatus, Risk, Health, Severity)
        │   ├── EmptyState.tsx    # Styled empty state placeholders
        │   ├── Modal.tsx         # Accessible dialog overlays
        │   └── Skeleton.tsx      # Loading state placeholders
        ├── context/
        │   └── UserContext.tsx   # Role switcher context (Asha, Ravi, Admin)
        └── pages/
            ├── Overview.tsx      # System health metrics & live release pill
            ├── NewScan.tsx       # Scanner launcher & scan history
            ├── IssuesList.tsx    # Categorized issue table & dismissal
            ├── VisualEditor.tsx  # Interactive DOM element picker & CSS editor
            ├── PatchesList.tsx   # Patch list with batch & row approval
            ├── PatchDetail.tsx   # Peer review actions, conflict banner, live preview
            ├── Conflicts.tsx     # Side-by-side collision resolver
            ├── Health.tsx        # Selector drift detection & relocation proposals
            ├── TestRuns.tsx      # Visual regression suite with Coming Soon badge
            ├── Releases.tsx      # Release candidate builder & live deploy controls
            ├── Activity.tsx      # Filterable audit log feed
            └── Settings.tsx      # Target site settings & Global System Reset
```

---

## License

Private & proprietary workspace for PATCHWORK. All rights reserved.
