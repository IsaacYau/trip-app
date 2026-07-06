# Design Document: OpenTripPlanner Integration

We are replacing OpenRouteService / BRouter with our dedicated cloud **OpenTripPlanner (OTP)** instance running on Oracle Cloud. OTP provides absolute pedestrian, cycling, and driving route accuracy by compiling the exact road network and GTFS timetables together.

## Proposed Changes

### 1. Client-Side updates in `scheduler.js`
* Define a `decodePolyline(str)` helper function in `scheduler.js` to decode OTP's Google encoded polyline format into Leaflet coordinate arrays.
* Modify the `queryUrl` handler to detect and parse the OpenTripPlanner routing format:
  * Extract itinerary duration (`itin.duration` in seconds -> convert to minutes).
  * Accumulate leg distances to get total distance (`leg.distance` in meters -> convert to km).
  * Concatenate decoded leg coordinates into a single unified path geometry.
* Update `fetchOsrmRoute(startCoord, endCoord, mode)`:
  * Since we have our cloud OTP server, we will direct Malaysia routing requests there:
    * Map modes to OTP modes: `foot` -> `WALK`, `bicycle` -> `BICYCLE`, `driving` -> `CAR`.
    * Construct the URL: `http://150.230.3.107:8080/otp/routers/default/plan?fromPlace=${startLat},${startLon}&toPlace=${endLat},${endLon}&mode=${otpMode}`.
  * Keep the robust local CORS-enabled cascading fallbacks (BRouter/OSRM) in case the cloud server goes offline.

### 2. Proxy Server updates in `server.js`
* Update `/api/route` in the backend proxy `server.js` to fetch directly from the cloud OTP server when requests are made:
  * For mode `foot`: query OTP with `mode=WALK`.
  * For mode `bicycle`: query OTP with `mode=BICYCLE`.
  * For mode `driving`: query OTP with `mode=CAR`.
  * URL: `http://150.230.3.107:8080/otp/routers/default/plan?fromPlace=${startLat},${startLon}&toPlace=${endLat},${endLon}&mode=${otpMode}`.
  * In case of connection failure, fall back to keyless BRouter and OSRM.

---

## Verification Plan
1. Add a unit test in `test.js` to assert that OTP JSON responses are decoded and parsed correctly.
2. Run automated tests to check for regressions.
3. Test locally by running `node server.js` and calculating routes, ensuring distinct walking, cycling, and driving geometries are rendered.
