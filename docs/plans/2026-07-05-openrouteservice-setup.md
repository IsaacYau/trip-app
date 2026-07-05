# OpenRouteService & CORS Routing Integration Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Replace Mapbox API key requirement with OpenRouteService (ORS) integration, increase route fetch timeouts to 10s, and implement robust CORS fallbacks for walking/cycling routing.

**Architecture:** Update browser routing logic in `scheduler.js` to query ORS if a token is present, increase timeout from 2.5s to 10s to support BRouter, and update `server.js` proxy route to fetch via ORS or BRouter.

**Tech Stack:** HTML/CSS/Vanilla Javascript, Node.js server, OpenRouteService API, BRouter API, OSRM API.

---

### Task 1: Add Routing unit tests in `test.js`

**Files:**
- Modify: `test.js`

**Step 1: Write the failing test**
Create a test case checking the `fetchRoute` function in `scheduler.js` (or mock-based equivalent function) to ensure it correctly supports the ORS endpoint when the token is provided, and falls back to BRouter and OSM driving correctly when timeout occurs or token is missing.

**Step 2: Run test to verify it fails**
Run: `node test.js`
Expected: Fail

**Step 3: Write minimal implementation in `test.js`**
Ensure tests mock the ORS API endpoint (`https://api.openrouteservice.org/v2/directions/`) and verify mapping works.

**Step 4: Run test to verify it passes**
Run: `node test.js`
Expected: Pass

**Step 5: Commit**
```bash
git add test.js
git commit -m "test: add tests for OpenRouteService mock and routing logic"
```

---

### Task 2: Implement OpenRouteService and Timeout Adjustments in `scheduler.js`

**Files:**
- Modify: `scheduler.js`

**Step 1: Write code changes**
* Change the default timeout in `queryUrl` function in `scheduler.js` from `2500` ms to `10000` ms.
* Replace Mapbox key retrieval with `ROAMREADY_ORS_KEY` local storage check.
* Implement OpenRouteService URL queries when `ROAMREADY_ORS_KEY` is present.
* Define correct profiles (`foot-walking` for walking, `cycling-regular` for cycling).
* Map ORS JSON structure (geometry coordinates, distance, duration) inside the routing method.

**Step 2: Verify code**
Run: `node test.js`
Expected: Pass

**Step 3: Commit**
```bash
git add scheduler.js
git commit -m "feat: implement OpenRouteService client-side client and bump fetch timeout to 10s"
```

---

### Task 3: Update UI in `scheduler.html`

**Files:**
- Modify: `scheduler.html`

**Step 1: Write code changes**
* Replace the `mapbox-api-key` field with an `ors-api-key` input field.
* Update label to "OpenRouteService Token (Optional)".
* Update link to open the OpenRouteService Dev Dashboard (`https://openrouteservice.org/dev/#/signup`).
* Change password placeholder to guide the user to paste their ORS token.
* Modify the corresponding JS listener initialization inside `scheduler.js` to look for the new ID and save it as `ROAMREADY_ORS_KEY` in local storage.

**Step 2: Verify code**
Run: `node test.js`
Expected: Pass

**Step 3: Commit**
```bash
git add scheduler.html scheduler.js
git commit -m "ui: replace Mapbox API key field with OpenRouteService token field"
```

---

### Task 4: Integrate ORS in Server Proxy `server.js`

**Files:**
- Modify: `server.js`

**Step 1: Write code changes**
* Update Node.js proxy `/api/route` in `server.js` to inspect query parameters for ORS tokens, or read a fallback ORS token from environment variable if present.
* Support forwarding calls to ORS API (`https://api.openrouteservice.org/v2/directions/`) when needed, or fallback to BRouter and OSRM.

**Step 2: Verify code**
Run: `node test.js`
Expected: Pass

**Step 3: Commit**
```bash
git add server.js
git commit -m "feat: add ORS forwarding support to server proxy"
```
