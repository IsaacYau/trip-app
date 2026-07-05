# Design Document: OpenRouteService & CORS Routing Fix

We are replacing the Mapbox API key requirement (which requires a billing account/credit card) with a combination of **OpenRouteService (ORS)** and **BRouter / OSRM fallbacks** to ensure reliable, zero-config walking routes on both localhost and deployed static sites.

## Proposed Changes

### 1. Update Routing Logics in `scheduler.js`
* Replace `ROAMREADY_MAPBOX_KEY` with `ROAMREADY_ORS_KEY`.
* Update the UI inputs in `scheduler.html` to reference **OpenRouteService Token** and point the instructions link to ORS dashboard/signup.
* Modify the `queryUrl` timeout from `2500` ms to `10000` ms (10 seconds) to prevent premature aborts of slow public servers.
* Implement OpenRouteService routing request formatting for walking (`foot-walking`) and cycling (`cycling-regular`).
* Implement cascading fallbacks in the client-side router function:
  1. **OpenRouteService**: If an ORS token is provided.
  2. **BRouter**: Keyless, CORS-enabled routing (with increased timeout).
  3. **OpenStreetMap DE**: Keyless walking/cycling routing.
  4. **OSRM (Driving)**: As a safe fallback, overriding walking/cycling durations.

### 2. Update Node.js Backend Proxy `server.js`
* Configure `/api/route` in the backend proxy to use OpenRouteService if the ORS token is configured in the backend environment, or fall back to BRouter/OSRM.
* Handle ORS routing responses on the backend.

---

## Verification Plan
1. Test route calculations with the provided ORS key.
2. Test route calculations without any keys (making sure BRouter/OSRM fallbacks take over gracefully).
3. Validate there are no CORS errors in the browser console.
