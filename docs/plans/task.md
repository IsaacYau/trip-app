| id | task | status | notes |
| --- | --- | --- | --- |
| task-01 | Re-architect glassmorphism WebGL rendering | completed | Use procedural gradient backdrops instead of slow html2canvas |
| task-02 | Redesign UI dashboard aesthetics | completed | Apply premium glassy layout, new background, and clean border styles |
| task-03 | Implement location fallback SVG images | completed | Replace empty/missing Google photo links with custom inline gradient SVGs |
| task-04 | Verify layout and responsiveness | completed | Test views in light/dark mode and check image rendering |
| task-05 | Implement GTFS parser script `build_transit_graph.py` | completed | Extracts stations, links, times, and schedules to JSON |
| task-06 | Integrate Leaflet map container and geocoder inputs | completed | Update scheduler.html and scheduler.css layouts |
| task-07 | Implement Dijkstra schedule-aware Dijkstra routing | completed | Refactor scheduler.js routing logic and OSRM walking path rendering |
| task-08 | Brainstorm and design walking route CORS/API fix | completed | Explore options to replace Mapbox/CORS-blocked endpoints with zero-config fallbacks |
| task-09-01 | Add Routing unit tests in `test.js` | completed | Write unit tests for ORS parsing, timeouts, and cascading fallbacks |
| task-09-02 | Implement OpenRouteService client-side and timeout adjustments in `scheduler.js` | completed | Extend timeout to 10s and implement ORS client with fallbacks |
| task-09-03 | Update UI in `scheduler.html` | completed | Replace Mapbox token UI fields with ORS API key fields |
| task-09-04 | Integrate ORS in Server Proxy `server.js` | completed | Enable ORS forwarding and fallback handling in Node proxy |
| task-10-01 | Add OpenTripPlanner parsing unit tests in `test.js` | completed | Write unit tests for decoding OTP response polyline geometries |
| task-10-02 | Implement decodePolyline and OTP parser in `scheduler.js` | completed | Create polyline decoder and OTP response parsing client-side |
| task-10-03 | Integrate OTP routing in Server Proxy `server.js` | in-progress | Add OTP forwarding requests and fallbacks to server proxy |
