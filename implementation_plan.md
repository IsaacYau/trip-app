# Implementation Plan - RoamReady Multi-Destination, HKD-based & Collaborative Travel Assistant

Implement the premium features of the RoamReady travel assistant web application: Subway Graph Node Optimizer & Didi Taxi Fare Estimator, Nearby Popular Places Search with GPS Proximity Search, and Shared Wallet & Transit Estimator. All features are built to support dynamic destination swapping (Mainland China, Japan, Malaysia) with localized platforms (Dianping, Tabelog, TripAdvisor/OpenRice), a base HKD shared wallet with precise automated currency conversions, and multi-tab collaboration synchronization.

All features are integrated into the existing Single Page Application (SPA) structure, using modern vanilla JS, HTML, and CSS with rich animations, dark/light theme compatibility, and deep feature integration.

---

## Technical Feasibility & Architectural Decisions

### 1. Data Normalization & Cleaning Script (`build_database.py`)
- **Challenge:** Directly scraping or hitting external APIs (like TripAdvisor, Tabelog, or Dianping) from a client-side browser is blocked by CORS policies, security checks, and CAPTCHAs. Official APIs are cost-prohibitive.
- **Solution:** 
  - We write a Python script called `build_database.py` that reads the Apify raw files `japan_raw.json` and `malaysia_raw.json`.
  - The script extracts, cleans, and normalizes the fields: Name, City, Rating, Reviews Count, Coordinates, Local Price, Base HKD Price, Price Level, Category, and Street.
  - Keeps only the records belonging to the active cities:
    - **Japan:** Nagoya, Osaka, Kobe, Tateyama Kurobe, Kuwana, Suzuka.
    - **Malaysia:** Kuala Lumpur, George Town (Penang).
  - Outputs a clean, unified database file called `final_places_db.json` containing **802 normalized records** (Japan: 379 items, Malaysia: 423 items).
  - **Dynamic Coordinates & Price Generation:**
    - Since coordinates and price levels are not in the raw files, the script generates deterministic coordinates spread around Nagoya, Osaka, Kobe, Tateyama Kurobe, Kuwana, and Suzuka centers to avoid overlapping pins.
    - Local budgets and ticket prices are calculated and automatically converted to **HKD** using your exact FX rates:
      - `1 CNY = 1.15 HKD`
      - `100 JPY = 5.0 HKD` (i.e. `1 JPY = 0.05 HKD`)
      - `1 MYR = 2.0 HKD`
  - In `scheduler.js`, we load this `final_places_db.json` via fetch. If the page is loaded locally under the `file://` protocol where browser CORS security blocks direct fetches, it automatically falls back to an embedded high-fidelity curated fallback dataset so the app is bulletproof and works offline out-of-the-box.

### 2. Destination Swapping & Local Guide Branding
- **Dynamic Swapping:** Switching destinations in the top bar dropdown adaptively updates the entire application:
  - **Subway/Transit Networks:** Switches between Japan, Malaysia, and Shenzhen.
  - **Curated Places Guides:** Reloads place cards for the active country, filtered by category (Food, Sights, Shopping, All).
  - **Local guide branding:** Place cards are themed after popular local platforms:
    - **Japan:** **Tabelog (食べログ)** style orange theme showing 5.0 score (exceptional for 3.5+), night/day budgets in JPY, and reviews.
    - **Malaysia:** **OpenRice & TripAdvisor** style green bubble theme in MYR.
    - **Mainland China:** Shenzhen is focused on Didi taxi estimators (ignored for places raw data extraction as requested).
  - **Card skins:** Visual credit card mockups represent Suica/ICOCA for Japan, Touch 'n Go for Malaysia, and Didi Wallet/Shenzhen Tong for China.

### 3. Base HKD Shared Wallet & Settle Up Ledger
- The ledger and debt settlement calculator are configured with **HKD** as the base currency.
- Expense entries in HKD, JPY, CNY, or MYR are automatically converted to HKD on input using the designated exchange rates.
- **Double-Pointer Greedy Debt-Minimization:** Calculates who owes who in the Alice, Bob, and Charlie group, generating optimal direct settlements in HKD.
- Logs transit fares from the Subway Router or Shenzhen Didi Estimator directly into passenger balances.

### 4. Interactive Collaborative Editing (HTML5 Multi-Tab Sync)
- **Real-Time Collaboration:** To support a zero-install static app, we implement a multi-user online sync simulator directly in the client.
- **Storage Event Loop:** Listening to browser `storage` event updates. If you open `scheduler.html` in **two separate browser windows side-by-side**, adding an expense, recharging a card, or logging a transit route in window 1 **instantly updates** window 2 in real-time with zero server latency.
- **Simulate Friend Edit:** A dedicated button mimics Bob or Charlie adding a transaction, triggering a syncing glow badge and a toast notification.

---

## Proposed Changes

We modify the existing files:
- [scheduler.html](file:///C:/Users/user/trip-app/scheduler.html)
- [scheduler.css](file:///C:/Users/user/trip-app/scheduler.css)
- [scheduler.js](file:///C:/Users/user/trip-app/scheduler.js)

### [Component 1] UI Layout & Structure: `scheduler.html`
- **Header selector:** Adds destination selection dropdown, active user picker (Alice, Bob, Charlie), and Live Sync status badge.
- **Tab 2 (Subway Node Optimizer / Didi Estimator):** Grid displaying Start/End stations, Optimization Criteria (Fastest Time vs. Fewest Transfers), or Didi ride class selectors, with a visual transit timeline matching local metro styles.
- **Tab 3 (Nearby Places):** Integrates search inputs, city dropdowns, category filter chips, GPS discovery buttons, and place cards.
- **Tab 4 (Shared Wallet & IC Card):** Left column shows multi-currency expense forms, ledger list, and debt settlement tables. Right column shows passenger IC Card balance, recharge simulators, and transit trip logs.

### [Component 2] Styling & Animations: `scheduler.css`
- Modern layout selectors for top bar picks and sync indicators.
- CSS cards for Tabelog (orange/gold), Dianping (curry-red), and TripAdvisor (green bubble).
- Credit card visual skins for ICOCA/Suica (green/black), Touch 'n Go (blue/yellow), and Didi Wallet (orange/black).
- Subway line badges and route timeline layout.
- Neobrutalist airport ticket boarding pass visual elements.

### [Component 3] JavaScript Logic & Integration: `scheduler.js`
- **Dijkstra Router Algorithm:** Adjacency-list graphs representing Japan (Nagoya, Osaka, Kobe) and Malaysia (KL, Penang) transit networks. Calculates optimal paths with line-changing transfer penalties.
- **Didi Shenzhen Estimator:** Taxi fare estimator for Futian check-ins, calculating prices for Didi Express, Premier, or Luxe.
- **GPS Discovery Haversine Proximity Search:** Calculates coordinates distance-ranking using the Haversine formula, displaying the closest 3 places from `final_places_db.json`.
- **Multi-Tab Sync Engine:** LocalStorage storage event listeners to sync ledger logs, IC cards, and activities.

---

## Verification Plan

### Automated & Manual Verification
1. **Dijkstra Subway Optimizer:**
   - Choose Osaka Umeda to Sannomiya in Japan. Compare results under "Fastest Travel Time" and "Fewest Line Transfers".
   - Click "Add Transit Fare". Verify that the JPY fare is deducted from Bob's ICOCA card balance.
2. **Didi Shenzhen Estimator:**
   - Swap destination to China (Shenzhen). Note the optimizer converts to Didi Ride Fare Estimator.
   - Calculate Futian Checkpoint to Bao'an Airport. Click "Add Taxi Fare" and verify it is logged in HKD in the wallet at `1 CNY = 1.15 HKD`.
3. **GPS Proximity Search:**
   - Go to Tab 3. Select Japan. Click "Find Nearby Gems (GPS)". Verify the closest three Osaka attractions are sorted and displayed with proximity indicators (e.g. *1.20 km away*).
4. **Cooperative Multi-Tab sync:**
   - Open `scheduler.html` in two browser tabs side-by-side. Add an expense in tab 1, and confirm it instantly updates the ledger list in tab 2.
