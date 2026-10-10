# PATCHWORK

> Instant, non-invasive visual remediation & live website patching platform.

PATCHWORK enables teams to scan live websites, detect frontend issues and accessibility defects, inspect suggested patches with before/after visual feedback, test patches in a real-time Visual Editor, and manage versioned releases with conflict detection and automated risk scoring.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Running the Project](#running-the-project)
- [Testing & Quality Assurance](#testing--quality-assurance)
  - [Unit Tests (Vitest)](#unit-tests-vitest)
  - [Frontend Typecheck & Build](#frontend-typecheck--build)
  - [Backend TypeScript Check](#backend-typescript-check)
  - [Manual API Testing](#manual-api-testing)
  - [Database Seeding & Reset](#database-seeding--reset)
- [Project Structure](#project-structure)
- [API Endpoints Reference](#api-endpoints-reference)

---

## Features

- **Automated Web Scanner**: Uses headless Playwright and Axe-Core to scan target URLs for accessibility, layout, and contrast issues.
- **Visual Editor**: Interactive element picker and CSS style editor to create patches on any scanned website without rebuilding the site.
- **Risk Scoring Engine**: Evaluates patches across risk dimensions (operation count, dangerous attributes, interactive tags, script templates) and assigns risk levels (`LOW`, `MEDIUM`, `HIGH`).
- **Conflict Detection & Review**: Detects conflicting property modifications across patches before approval and deployment.
- **Audit Trail**: Every action (scan, patch creation, status changes, deletions) is tracked with timestamped actor metadata.

---

## Tech Stack

- **Monorepo / Workspace**: NPM Workspaces (`server`, `web`)
- **Backend (`server`)**: Node.js, Express, TypeScript, Playwright, `@axe-core/playwright`, SQLite (`sql.js`)
- **Frontend (`web`)**: React 18, Vite, TypeScript, Tailwind CSS, `@tanstack/react-query`, Lucide React
- **Shared (`shared`)**: TypeScript types and Zod schemas for validation and risk scoring
- **Testing**: Vitest

---

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **NPM**: v9.0.0 or higher
- **Playwright Browsers**: Required for the scanner engine. Run:
  ```bash
  npx playwright install chromium
  ```
  *(Note: On Windows, the scanner automatically falls back to system Microsoft Edge if Chromium is not downloaded).*

---

## Installation & Setup

1. **Clone and install dependencies**:
   ```bash
   git clone <repo-url>
   cd workpatch
   npm install
   ```

2. **Environment Configuration**:
   A default `.env` file is present in the project root:
   ```env
   PORT=4000
   DASHBOARD_ORIGIN=http://localhost:5173
   ARTIFACTS_DIR=./artifacts
   ```

3. **Initialize & Seed the Database**:
   Seed initial users (`Asha` as Developer, `Ravi` as Reviewer, `Admin`), default site, and smoke flows:
   ```bash
   npm run seed
   ```

---

## Running the Project

### Start Both Services (Recommended)

To start both the Express backend and the Vite frontend concurrently in a single terminal:

```bash
npm run dev
```

- **Frontend Dashboard**: [http://localhost:5173](http://localhost:5173)
- **Backend API Server**: [http://localhost:4000](http://localhost:4000)

### Start Services Individually

If you prefer separate terminals:

```bash
# Terminal 1: Backend Server (runs on port 4000 with auto-reload)
npm run dev:server
# or: npm run dev -w server

# Terminal 2: Web Dashboard (runs on port 5173)
npm run dev:web
# or: npm run dev -w web
```

---

## Testing & Quality Assurance

### Unit Tests (Vitest)

Unit tests validate patch operation safety (disallowed properties, event handlers, XSS vectors) and the risk scoring engine.

```bash
# Run unit test suite
npm test

# Run tests in watch mode
npx vitest

# Run tests with coverage
npx vitest run --coverage
```

### Frontend Typecheck & Build

Ensure TypeScript compilation passes and production build bundles cleanly:

```bash
# Typecheck and build the Vite frontend
npm run build -w web
```

### Backend TypeScript Check

Verify backend TypeScript types without emitting files:

```bash
npx -w server tsc --noEmit
```

### Manual API Testing

You can test the backend API directly using `curl` or PowerShell `Invoke-RestMethod`:

#### 1. Check System Overview
```bash
# PowerShell
Invoke-RestMethod -Uri "http://localhost:4000/api/overview"

# cURL
curl http://localhost:4000/api/overview
```

#### 2. Trigger a Live Scan
```bash
# PowerShell
Invoke-RestMethod -Method POST -Uri "http://localhost:4000/api/scans" `
  -ContentType "application/json" `
  -Body '{"url":"https://example.com"}'

# cURL
curl -X POST http://localhost:4000/api/scans \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

#### 3. List Scans
```bash
curl http://localhost:4000/api/scans
```

#### 4. Delete a Scan (including screenshot cleanup)
```bash
curl -X DELETE http://localhost:4000/api/scans/<SCAN_ID>
```

#### 5. Dismiss an Issue
```bash
curl -X POST http://localhost:4000/api/issues/<ISSUE_ID>/dismiss \
  -H "Content-Type: application/json" \
  -d '{"reason":"False positive in test environment"}'
```

### Database Seeding & Reset

To reset the database to a clean initial state (deletes `patchwork.db` and re-seeds baseline records):

```bash
npm run reset
```

---

## Project Structure

```
workpatch/
├── .env                  # Environment variables
├── .gitignore            # Git ignore rules
├── package.json          # Root workspace configuration and scripts
├── patchwork.db          # Active SQLite database file
├── tsconfig.json         # Base TypeScript configuration
├── server/
│   ├── package.json      # Server dependencies and scripts
│   ├── artifacts/        # Viewport screenshots captured by scanner
│   └── src/
│       ├── audit.ts      # Audit event logging
│       ├── db.ts         # SQLite schema initialization & persistence
│       ├── index.ts      # Express server entry point
│       ├── scanner.ts    # Playwright & Axe-Core scanner engine
│       ├── seed.ts       # Database seeder script
│       └── routes/
│           └── index.ts  # REST API route handlers
├── shared/
│   ├── types.ts          # Shared TypeScript interfaces & types
│   ├── validation.ts     # Zod schemas, risk scoring & safety checks
│   └── validation.test.ts # Vitest unit test suite
└── web/
    ├── index.html        # Frontend HTML template
    ├── package.json      # Frontend dependencies & scripts
    ├── vite.config.ts    # Vite configuration
    ├── tailwind.config.js# Tailwind CSS configuration
    └── src/
        ├── App.tsx       # Main routing layout
        ├── api.ts        # Typed API client
        ├── main.tsx      # React root render
        ├── theme.css     # CSS styling tokens
        ├── components/   # Reusable UI components (modals, chips, skeletons)
        ├── context/      # User role switcher context
        └── pages/        # Dashboard views (Scanner, Editor, Patches, Releases, etc.)
```

---

## API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/me` | Current user profile |
| `GET` | `/api/users` | List available users (role switching) |
| `GET` | `/api/overview` | Dashboard summary and active site stats |
| `GET` | `/api/scans` | List all previous scans |
| `POST` | `/api/scans` | Trigger a new website scan (`{ url }`) |
| `DELETE`| `/api/scans/:id` | Delete a scan and its stored screenshot |
| `POST` | `/api/scans/delete-batch` | Batch delete scans by IDs or target URL |
| `GET` | `/api/issues` | List issues (filterable by severity, category, status) |
| `GET` | `/api/issues/:id` | Issue detail with evidence and suggested patch |
| `POST` | `/api/issues/:id/dismiss` | Dismiss an issue with audit reason |
| `GET` | `/api/patches` | List draft, submitted, and approved patches |
| `POST` | `/api/patches` | Create a new patch |
| `POST` | `/api/patches/:id/submit`| Submit patch for review |
| `POST` | `/api/patches/:id/approve`| Approve patch (performs conflict check) |
| `GET` | `/api/conflicts/:id` | View conflict details between patches |
| `GET` | `/api/releases` | List releases and rollback states |
| `GET` | `/api/activity` | System audit trail log |
| `GET` | `/artifacts/:filename` | View captured scan screenshots |
