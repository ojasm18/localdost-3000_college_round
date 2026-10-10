# PATCHWORK Demo Guide: The "MediCare+" Healthcare Portal Scenario

This document details a serious, enterprise-grade demo scenario for PATCHWORK based on the team member's research. It simulates a real-world B2B healthcare deployment where hotfixes carry regulatory weight, compliance mandates, and patient safety implications—making PATCHWORK's value immediately apparent to judges evaluating real-world viability.

---

## 1. The Scenario: "The Patient Care Emergency"

The most practical and enterprise-appropriate case scenario is a **B2B Healthcare Patient Portal** called **"MediCare+"**. Healthcare software has the longest deployment cycles in the industry due to HIPAA compliance, FDA Class I medical device regulations (for certain health-tracking features), and strict change management processes. When a bug breaks this portal, there is no "quick deploy"—the fix might take days or weeks to get approved through the compliance pipeline.

**The Setup:**
MediCare+ is a patient-facing portal used by a regional hospital network serving 50,000+ patients. Patients use it to:
- View lab results and medical records
- Book, reschedule, or cancel appointments
- Message their physicians directly
- Request prescription refills
- Make co-pay payments

It is a critical piece of healthcare infrastructure. However, a recent "routine security update" pushed by the IT team has introduced three critical bugs that are actively preventing patients from accessing care.

**The Three Production Bugs (Designed to Showcase PATCHWORK's Core Features):**

### Bug #1: The "Invisible Submit Button" (Visual/UX Failure)
- **What Breaks:** The "Request Appointment" form contains a critical hidden bug. The submit button exists in the DOM, but a CSS `z-index` stacking context issue pushes it behind a semi-transparent modal overlay. Patients fill out the entire form, click submit, and nothing happens. They assume the system is broken and call the helpline instead.
- **PATCHWORK Solution:** Use **Visual Patching** to inject a CSS override (`z-index: 9999`) that brings the button above the modal.
- **Feature Demonstrated:** Visual Patching + Isolated Preview

### Bug #2: The "Lab Results Timeout" (JavaScript Logic Failure)
- **What Breaks:** The "View Lab Results" feature relies on a JavaScript `Promise.race()` pattern that waits for both the patient data to load AND a session validation check. However, the session validation endpoint is returning a 401 (Unauthorized) after exactly 60 seconds due to a misconfigured token refresh. Every single patient trying to view their lab results gets an error after one minute, regardless of whether they are legitimately logged in.
- **PATCHWORK Solution:** Inject a JavaScript patch that overrides the `Promise.race()` behavior, removes the broken session check for lab results specifically, and directly fetches the data using a fresh token from `localStorage`.
- **Feature Demonstrated:** Behavior Patching + Collaborative Editing (two developers can work on different areas of the same module)

### Bug #3: The "Payment Gateway Blackout" (Network/API Failure)
- **What Breaks:** The portal uses a third-party payment processor (mocked as `payment-gateway.local`) for co-pays. The payment processor's API has suffered a widespread outage. When patients try to pay their bills, the page hangs on "Connecting to payment gateway..." for 30 seconds before timing out with a generic error. No one can pay their bills.
- **PATCHWORK Solution:** Inject a **Network Interception Patch** that intercepts all requests to the payment API, detects the outage (5xx status), and automatically renders a fallback UI: "Our payment system is temporarily unavailable. Your services will not be interrupted. Please call 1-800-MEDICARE to pay by phone."
- **Feature Demonstrated:** Network Interception + Automated Verification

---

## 2. Why This Scenario is Perfect for a Hackathon Demo

### Real-World Enterprise Authenticity
Judges at hackathons love consumer apps, but they get exponentially more interested when you show them something that solves an actual B2B pain point. Healthcare is the gold standard because:
- Everyone has interacted with a broken healthcare portal
- The stakes are immediately understood (patient care, not just convenience)
- The compliance/procurement cycle is a real, documented problem that companies pay millions to solve

### Shows All Key Features (Without Being Too Complex)
Each bug maps cleanly to a specific PATCHWORK capability:
| Bug | PATCHWORK Feature | Why It Matters |
|-----|------------------|----------------|
| Invisible Button | Visual Patching | Non-technical staff can fix UI bugs |
| Lab Results | JS Behavior Patching | Override broken logic without backend access |
| Payment Outage | Network Interception | Graceful degradation during third-party failures |

### The "Compliance Delay" Hook
You can explicitly call out in your demo: *"In a real healthcare environment, getting approval for this deployment would take 5-7 business days through the change control board. With PATCHWORK, I can fix this in 30 seconds while my compliance team reviews the patch audit trail."*

This single line demonstrates that you understand the actual enterprise constraints, not just the technical ones.

---

## 3. In-Detail Contents of the Demo Website

The demo website is a **React-based Single Page Application** (or a realistic HTML/JS mock) that closely mirrors a real patient portal. It is intentionally built with modern frontend patterns so that the "element tracking" and "smart healing" features of PATCHWORK can be meaningfully demonstrated.

### File Structure:
```text
demo-site/
├── index.html              # Main entry point
├── css/
│   ├── main.css            # Core portal styling
│   └── patches.css         # The buggy z-index layer causing the modal issue
├── js/
│   ├── app.jsx             # Main React app (or vanilla JS equivalent)
│   ├── components/
│   │   ├── AppointmentForm.jsx   # Contains the broken submit button
│   │   ├── LabResults.jsx        # Contains the broken Promise.race() logic
│   │   └── PaymentModal.jsx      # Contains the failing payment gateway fetch
│   ├── services/
│   │   ├── api.js          # Central API client with fetch wrappers
│   │   └── auth.js         # Session management (contains the 401 bug)
│   └── utils/
│       └── validation.js   # Form validation helpers
└── assets/
    └── logo.svg
```

### Detailed Component Breakdown:

#### A. The Header (`<header class="portal-header">`)
- **Logo:** "MediCare+" with a medical cross icon
- **Navigation:** Dashboard | Appointments | Lab Results | Messages | Billing
- **User Info:** Displays "Welcome, [Patient Name]" with a logout button

#### B. Appointment Booking Section (`<section id="appointments">`)
- **Form Fields:** Date picker, Time slot dropdown, Doctor specialty, Reason for visit
- **The Bug:** The "Request Appointment" button has `z-index: 1` while the parent modal overlay has `z-index: 100` with `pointer-events: auto`. The button is technically "behind" the modal.
- **Expected Behavior:** Clicking should submit the form and show a confirmation.
- **Actual Behavior:** Clicking does nothing. The user sees the modal but cannot interact with anything under it.

#### C. Lab Results Viewer (`<section id="lab-results">`)
- **Display:** A table showing recent lab tests (Blood Work, MRI, CT Scan) with date, status, and "View Details" buttons
- **The Bug:** In `services/auth.js`, the session token is set to expire after 60 seconds. The `LabResults.jsx` component uses:
  ```javascript
  Promise.race([
    fetchLabResults(patientId),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Session expired")), 60000))
  ])
  ```
  Since the token refresh endpoint is misconfigured, it returns 401 after 60 seconds, causing the race to always fail.
- **Expected Behavior:** Patient sees their lab results within a few seconds.
- **Actual Behavior:** After 60 seconds, the UI shows "Session Expired. Please log in again."

#### D. Billing & Payments (`<section id="billing">`)
- **Display:** List of outstanding balances with a "Pay Now" button
- **Payment Modal:** Opens when "Pay Now" is clicked, shows credit card form
- **The Bug:** The `api.js` service attempts to POST to `https://payment-gateway.local/process`. This mock endpoint is configured to always return `500 Internal Server Error` after a 30-second timeout.
- **Expected Behavior:** Payment form loads, user enters card, payment processes.
- **Actual Behavior:** Spinner spins for 30 seconds, then displays "Payment failed. Please try again."

---

## 4. How PATCHWORK Interacts with the Demo Website

### The Connection (Script Injection)
The integration is identical to a real enterprise deployment—a single `<script>` tag in the `<head>` of the application:

```html
<head>
  <!-- PATCHWORK Runtime: Connects to PATCHWORK Cloud -->
  <script src="https://api.patchwork.dev/runtime/patchwork.js" 
          data-site="medicare_plus_prod" 
          data-api-key="pk_live_xxxxxxxxxxxx">
  </script>
</head>
```

When `index.html` loads, `patchwork.js` performs a handshake:
1. It reads the `data-site` and `data-api-key` attributes
2. It calls `GET https://api.patchwork.dev/api/sites/medicare_plus_prod/active-patches`
3. The backend responds with the current "Release" (list of active patches)
4. The runtime applies each patch sequentially to the live DOM

### The Demo Walkthrough (Step-by-Step)

#### Phase 1: The Emergency (Setting the Stage)
*"MediCare+ serves 50,000 patients. A routine Tuesday deployment has broken three critical features. The hospital IT team is flooded with calls. The CEO is asking why patients can't book appointments or view their test results. The deployment team is on vacation. The fix is in Git, but the change control board won't approve it until next week. We don't have a week. We have now."*

**Presenter Action:** Open the broken MediCare+ portal. Demonstrate each bug live:
1. Try to book an appointment → Click submit → Nothing happens
2. Try to view lab results → Wait 60 seconds → "Session Expired" error
3. Try to pay a bill → Spinner spins → Timeout error

---

#### Phase 2: The Fix (Visual Patching - 2 Minutes)
*"Let's start with the easiest fix—the invisible submit button. I don't need to touch the codebase. I open the PATCHWORK Dashboard, load the MediCare+ site, and use the visual selector to find the broken button."*

**Presenter Action:**
1. Open PATCHWORK Dashboard (or Chrome Extension in visual mode)
2. Hover over the appointment form → The button highlights
3. Click the button → Side panel opens: "Edit Element"
4. Select "CSS Override" → Enter: `z-index: 9999`
5. Click "Preview" → The modal visually shifts, the button is now clickable!
6. Click "Deploy Patch" → Patch goes live

**What Happens Behind the Scenes:**
- `PATCHWORK` saves a `PatchOp` to the database with:
  ```json
  {
    "change_type": "style",
    "target_signature": {
      "text_snippet": "Request Appointment",
      "parent_chain": ["form", "modal-content", "modal"],
      "tag": "button"
    },
    "new_value": "z-index: 9999 !important;"
  }
  ```
- The runtime fetches this patch and injects a `<style>` tag:
  ```css
  button.submit-appointment { z-index: 9999 !important; }
  ```
- The button is instantly fixable without touching the original CSS!

---

#### Phase 3: The Logic Fix (JavaScript Patching - 3 Minutes)
*"Now for the lab results timeout. This is a JavaScript logic error. The code is waiting for a session validation that will never succeed. I need to inject a behavioral patch."*

**Presenter Action:**
1. In PATCHWORK Dashboard, navigate to the Lab Results component
2. Select "Inject JavaScript Patch"
3. Write the override:
  ```javascript
  // Override the broken Promise.race behavior
  window.patchLabResults = async function(patientId) {
    // Bypass the broken session check entirely
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`/api/lab-results/${patientId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
  };
  
  // Replace the component's fetch call
  document.querySelectorAll('.view-results-btn').forEach(btn => {
    btn.onclick = () => window.patchLabResults(btn.dataset.patientId);
  });
  ```
4. Deploy the patch

**What Happens Behind the Scenes:**
- PATCHWORK saves the JS as a `behaviour` type patch
- The runtime injects the code into the page
- When patients click "View Results," the new function bypasses the broken `Promise.race()` and fetches directly
- Lab results now load instantly!

---

#### Phase 4: The Network Interception (Graceful Degradation - 2 Minutes)
*"Finally, the payment outage. I can't fix the third-party API, but I can intercept the request and show patients a graceful fallback instead of a spinning loader."*

**Presenter Action:**
1. In PATCHWORK, create a new "Network Interception" patch
2. Configure the interception rule:
   ```javascript
   {
     "match_pattern": "*://payment-gateway.local/*",
     "on_intercept": "fallback",
     "fallback_response": {
       "status": 503,
       "body": {
         "error": "temporary_unavailable",
         "message": "Payment system under maintenance",
         "fallback_ui": "<div class='payment-fallback'><h3>Payment Unavailable</h3><p>Please call 1-800-MEDICARE to pay by phone.</p></div>"
       }
     }
   }
   ```
3. Deploy

**What Happens Behind the Scenes:**
- The runtime wraps `window.fetch` to intercept payment requests
- When the payment API fails, it returns the fallback response
- A custom handler renders the fallback UI in the modal
- Patients see a helpful message instead of a timeout!

---

#### Phase 5: The Smart Healing (Auto-Recovery - 2 Minutes)
*"Here's where PATCHWORK becomes indispensable. A week later, MediCare+ pushes a real code fix that changes the class names and DOM structure. In a traditional hotfix tool, my patches would break. But PATCHWORK's Smart Element Tracking has my back."*

**Presenter Action:**
1. Manually edit the demo site's HTML to change `<button class="submit-appointment">` to `<button class="btn-primary appointment-submit">`
2. Also change `<div class="modal">` to `<div class="overlay-modal">`
3. Refresh the page
4. Show that PATCHWORK has automatically "healed" the patch:
   - The runtime tried the original CSS selector → Failed
   - It ran the Smart Element Tracker → Found a button with text "Request Appointment" inside a modal structure → 92% match confidence
   - It automatically reapplied the z-index fix to the new element

**What Happens Behind the Scenes:**
- The patch's `target_signature` includes multiple fallback strategies:
  ```json
  {
    "primary_selector": "button.submit-appointment",
    "fallback_strategies": [
      { "type": "text", "value": "Request Appointment" },
      { "type": "parent_text", "value": "Book Appointment" },
      { "type": "semantic", "value": "submit_button" }
    ]
  }
  ```
- The Smart Tracker scores potential matches and auto-applies when confidence > 85%

---

#### Phase 6: The Rollback (Safety Net - 1 Minute)
*"Two weeks later, MediCare+ pushes their official fix through the compliance pipeline. I no longer need my patches. With one click, I can roll back all changes—and PATCHWORK keeps a full audit trail for compliance."*

**Presenter Action:**
1. Open the PATCHWORK Dashboard → Releases tab
2. Show the timeline: v1 (initial) → v2 (PATCHWORK hotfixes) → v3 (official fix)
3. Click "Rollback to v1"
4. Refresh the demo site → All patches are removed, original bugs return
5. Open the Audit Log tab → Show a complete record:
   - Who created each patch
   - When it was deployed
   - When it was disabled
   - What elements were affected

---

## 5. The Pitch: Why This Wins

When you present this demo to judges, frame it with this narrative:

> **"PATCHWORK is Git for live websites. In enterprise environments, deploying code takes days or weeks due to compliance, change control, and testing pipelines. But when a critical bug hits production—blocking patients from booking appointments or processing payments—you don't have days. You have now. PATCHWORK lets you surgically hotfix any website in seconds, with full version control, automated testing, and an audit trail that satisfies compliance officers. We demonstrated this by fixing a live healthcare portal's three critical failures without touching a single line of their production codebase."**

This scenario wins because it:
1. **Speaks enterprise language** (compliance, audit trails, change control)
2. **Demonstrates all 7 core features** in a single cohesive narrative
3. **Shows technical depth** (CSS overrides, JS injection, network interception, smart healing)
4. **Has emotional resonance** (healthcare, patient care, real stakes)