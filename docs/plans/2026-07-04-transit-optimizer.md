# Transit Optimizer with Map Integration Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Build a schedule-aware offline-first Transit Optimizer using Leaflet.js maps, Nominatim geocoding, and a Dijkstra graph pre-compiled from Malaysia GTFS railway and commuter data.

**Architecture:** A Python pre-processing script (`build_transit_graph.py`) unzips and parses Malaysia GTFS data into a compact JSON graph. The browser loads this graph, geocodes queries via Nominatim, calls public OSRM for walking access paths, Dijkstra-routes between subway/KTM stop coordinates, and visualizes the legs on a Leaflet map.

**Tech Stack:** HTML5, CSS3, Vanilla JS, Leaflet.js, OSRM API, Nominatim API, Python (for pre-processing).

---

### Task 1: GTFS Preprocessing Parser Script

**Files:**
- Create: `C:\Users\user\trip-app\build_transit_graph.py`

**Step 1: Write Python GTFS parser**
Create `build_transit_graph.py` to extract coordinates, links, line names, colors, travel times, and repeating weekday/weekend frequency schedules from `rapid_rail.zip` and `ktm_komuter.zip`.

```python
import zipfile
import json
import csv
import os

def build_graph():
    # 1. Unzip rapid_rail.zip and ktm_komuter.zip to temp directories
    # 2. Parse stops.txt to map stop_id -> (name, lat, lon)
    # 3. Parse routes.txt, trips.txt, stop_times.txt to find adjacent links and calculate times
    # 4. Parse calendar.txt to separate weekday and weekend schedules
    # 5. Output a unified json file: malaysia_transit_db.json
    pass

if __name__ == '__main__':
    build_graph()
```

**Step 2: Run script to verify database creation**
Run: `python build_transit_graph.py`
Expected: File `malaysia_transit_db.json` is created with valid JSON nodes and links.

**Step 3: Commit**
```bash
git add build_transit_graph.py
git commit -m "feat: add Python GTFS preprocessing parser script"
```

---

### Task 2: Re-architect Tab 2 HTML Map & Nominatim Inputs

**Files:**
- Modify: `C:\Users\user\trip-app\scheduler.html`
- Modify: `C:\Users\user\trip-app\scheduler.css`

**Step 1: Inject Leaflet CSS/JS CDNs**
Inject Leaflet stylesheet and scripts inside `<head>` of `scheduler.html`.

**Step 2: Rebuild Tab 2 Layout**
Replace old Subway routing tab fields with a split map container (`#transit-map`) and a route query sidebar with Nominatim inputs.

**Step 3: Commit**
```bash
git add scheduler.html scheduler.css
git commit -m "feat: integrate Leaflet map container and geocoder inputs"
```

---

### Task 4: Implement OSRM routing and Dijkstra Schedule-Aware Pathfinding

**Files:**
- Modify: `C:\Users\user\trip-app\scheduler.js`

**Step 1: Fetch and load malaysia_transit_db.json**
Load the pre-processed GTFS database on app startup and merge it into `TRANSIT_NETWORKS`.

**Step 2: Dijkstra Schedule-Aware Upgrades**
Refactor `findDijkstraRoute` to dynamically inspect the selected trip day (weekday vs. weekend) and add line interval waiting penalties at stations.

**Step 3: Commit**
```bash
git add scheduler.js
git commit -m "feat: implement Dijkstra schedule-aware Dijkstra routing"
```
