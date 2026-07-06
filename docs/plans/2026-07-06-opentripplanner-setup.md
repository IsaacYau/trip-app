# OpenTripPlanner Integration Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Route walking, cycling, and driving requests to our Oracle Cloud OpenTripPlanner (OTP) instance, decode polyline geometry coordinates, and extract accurate durations/distances.

**Architecture:** Define `decodePolyline` in `scheduler.js` to decode encoded polyline strings. Update browser client and Node proxy to route requests to the cloud OTP server, with robust fallbacks.

**Tech Stack:** HTML/CSS/Vanilla Javascript, Node.js server, OpenTripPlanner API (v2).

---

### Task 1: Add OpenTripPlanner parsing unit tests in `test.js`

**Files:**
- Modify: `test.js`

**Step 1: Write the failing test**
Create a test case (Test 21) checking that `fetchOsrmRoute` correctly processes the OpenTripPlanner response format, decodes the polyline points into coordinates, and aggregates duration/distance.

**Step 2: Run test to verify it fails**
Run: `node test.js`
Expected: Fail

**Step 3: Write mock and parsing updates**
Implement mock fetch in `test.js` to return a mock OTP JSON structure.

**Step 4: Run test to verify it passes**
Run: `node test.js`
Expected: Pass

**Step 5: Commit**
```bash
git add test.js
git commit -m "test: add Test 21 for OpenTripPlanner response parsing"
```

---

### Task 2: Implement decodePolyline and OTP parser in `scheduler.js`

**Files:**
- Modify: `scheduler.js`

**Step 1: Write code changes**
* Add `decodePolyline(str)` helper function.
* Update `queryUrl(url)` to detect OTP responses containing `plan.itineraries` and correctly decode, parse, and return them.
* Update client-side router in `scheduler.js` to format and query the cloud OTP server: `http://150.230.3.107:8080/otp/routers/default/plan`.

**Step 2: Verify code**
Run: `node test.js`
Expected: Pass

**Step 3: Commit**
```bash
git add scheduler.js
git commit -m "feat: implement polyline decoder and OTP client-side router in scheduler.js"
```

---

### Task 3: Integrate OTP routing in Server Proxy `server.js`

**Files:**
- Modify: `server.js`

**Step 1: Write code changes**
* Update `/api/route` in `server.js` to construct OTP requests when querying walking (`mode=WALK`), cycling (`mode=BICYCLE`), and driving (`mode=CAR`) routes.
* Target URL: `http://150.230.3.107:8080/otp/routers/default/plan?fromPlace=${startLat},${startLon}&toPlace=${endLat},${endLon}&mode=${otpMode}`.
* Keep BRouter / OSRM driving fallbacks in the proxy error handler block.

**Step 2: Verify code**
Run: `node test.js`
Expected: Pass

**Step 3: Commit**
```bash
git add server.js
git commit -m "feat: add OTP routing integration to server proxy"
```
