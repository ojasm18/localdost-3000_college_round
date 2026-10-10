# PATCHWORK & MediCare+ Demo

## Overview
This repository contains the functional MVP of PATCHWORK, an enterprise-grade live hotfix management tool, and its primary demo scenario, the **MediCare+** patient portal. It demonstrates safe, controlled injection of visual, logical, and network mitigations without redeploying the core application. 

## Project Structure
- **/backend**: FastAPI server for managing patches, releases, and the PATCHWORK integration.
- **/dashboard**: React+Vite console for developers and reviewers to create, test, and deploy semantic patches.
- **/demo-site**: The simulated MediCare+ React application containing three intentional scenarios matching B2B healthcare compliance emergencies.
- **/runtime**: Unprivileged DOM integration snippet (`patchwork.js`) that safely parses, validates, and injects declared operations into the active application.

## Prerequisites
- Node.js (v18+)
- Python (3.10+)

## 🚀 Quick Setup & Run

### 1. Start the Backend API
```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```
*API will run on http://localhost:8000*

### 2. Start the Provider Dashboard
```bash
cd dashboard
npm install
npm run dev
```
*Dashboard will run on http://localhost:5173*

### 3. Start the MediCare+ Demo Site
```bash
cd demo-site
npm install
npm run dev
```
*Portal will run on http://localhost:5174*

## 🎬 The Demo Flow

1. Open **MediCare+** (http://localhost:5174). Attempt to book an appointment (click intercepted), load lab results (fails after delay), or pay a bill (hangs on network outage).
2. Open **PATCHWORK Dashboard** (http://localhost:5173). 
3. Click "Add Visual Patch" to inject a fix for the invisible Z-index bug.
4. Click "Add Logic Patch" to inject a behavior fix for the Lab Results race condition timeout.
5. Click "Add Network Patch" to deploy Graceful Degradation intercepting the mock Payment Gateway 503 outgate and rendering fallback UI.
6. Click **Publish Release** to activate the patches.
7. Return to **MediCare+** and refresh. The patches will automatically fetch and apply silently. You can now successfully book an appointment, load the labs instantly, and see a helpful fallback for the payment outage.
