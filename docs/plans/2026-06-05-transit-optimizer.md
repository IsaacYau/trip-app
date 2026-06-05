# Transit Optimizer Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Build a 100% free offline-first transit optimizer in the trip-app scheduler with Leaflet map visualization, Nominatim geocoding, OSRM route calculations, and Dijkstra-based subway/bus graph routing for Japan (June 10-19) and Malaysia (June 21-July 1).

**Architecture:** Hybrid Dijkstra + OSRM Leaflet Routing (Approach A).
*   Leaflet map displays stations and lines.
*   Nominatim resolves text queries.
*   Dijkstra routes through the local transit network.
*   OSRM calculates walking/cycling connections.

**Tech Stack:** HTML5, CSS3, Vanilla JS, Leaflet.js, OpenStreetMap, OSRM API, Nominatim API.

---

### Task 1: Incorporate Leaflet.js Assets and Geocoding Elements

**Files:**
*   Modify: `C:\Users\user\trip-app\scheduler.html`
*   Modify: `C:\Users\user\trip-app\scheduler.css`

**Step 1: Write HTML modifications**
Inject Leaflet stylesheet and JS library in `<head>`, and build inputs for place name geocoding.

**Step 2: Add CSS rules**
Add a style block for `#transit-map` to make it occupy the left half of the grid on desktop.

**Step 3: Commit**
```bash
git add scheduler.html scheduler.css
git commit -m "feat: integrate Leaflet map container and styles"
```

---

### Task 2: Implement Nominatim and OSRM Services in JS

**Files:**
*   Modify: `C:\Users\user\trip-app\scheduler.js`

**Step 1: Add Nominatim Geocoder**
Implement a utility function `fetchCoordinates(query)` calling OSM Nominatim.

**Step 2: Add OSRM Router**
Implement a utility function `fetchOsrmRoute(startCoord, endCoord, mode)` supporting `foot` and `bicycle`.

**Step 3: Commit**
```bash
git add scheduler.js
git commit -m "feat: add Nominatim geocoding and OSRM routing client functions"
```

---

### Task 3: Revise Dijkstra Graph to Support Coordinates & Dates

**Files:**
*   Modify: `C:\Users\user\trip-app\scheduler.js`

**Step 1: Update TRANSIT_NETWORKS Data**
Enrich nodes with coordinates, links with weekend/weekday timetables and transit types (subway, bus).

**Step 2: Refactor findDijkstraRoute Engine**
Modify Dijkstra algorithm to compute route based on travel time, connection frequencies, and calendar date schedules.

**Step 3: Commit**
```bash
git add scheduler.js
git commit -m "feat: update transit network schema with coordinates and timetables"
```

---

### Task 4: Complete Controller Logic, Options Cards, and Map Rendering

**Files:**
*   Modify: `C:\Users\user\trip-app\scheduler.js`
*   Modify: `C:\Users\user\trip-app\scheduler.html`

**Step 1: Map Rendering Logic**
Write function to plot markers, connect walking paths, draw transit lines.

**Step 2: Add Choice Selection UI**
Render choice cards for Fastest, Cheapest, and Optimized routes.

**Step 3: Commit**
```bash
git add scheduler.js scheduler.html
git commit -m "feat: finalize mapping display and route options UI"
```
