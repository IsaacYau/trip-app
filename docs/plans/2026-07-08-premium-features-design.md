# Design Document: Transit Integration, Map Shortcuts, Budget Dashboard, and Security Audits

**Author**: Antigravity & User
**Date**: 2026-07-08
**Status**: APPROVED

---

## 1. Executive Summary
This document specifies the architecture and designs for four premium upgrades to the RoamReady collaborative trip application:
1. **Transit-Ledger Integration**: Links passenger IC balances directly with route fare results to warn users when their card balance is low and allow a quick recharge inline.
2. **Interactive Map Shortcuts**: Allows users to tap station/pinpoint markers on the Leaflet map and click quick actions to set them directly as the start/end routing points.
3. **Daily Budget & Spend Analytics Dashboard**: Provides daily budget targets, progress alert bars, and CSS-only stacked category spending distributions inside the Expenses Ledger.
4. **Security & Testing Audits**: Restricts Firestore data structures through schema validation files and prevents Cross-Site Scripting (XSS) via sanitization wrappers around live Firestore elements.

---

## 2. Detailed Designs

### 2.1 Transit-Ledger Integration
- **Comparison Logic**: When routing finishes rendering in the Subway Optimizer, the app compares the calculated `transitFareTotal` with the selected passenger's `state.icCards[state.activeUser][currency]` balance.
- **UI Warning**: If the balance is insufficient, render a glassmorphic warning card inside the details:
  ```html
  <div class="card warning-card-premium" style="margin-top:0.8rem; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); padding:0.8rem; border-radius:var(--radius-sm);">
      <div style="display:flex; align-items:center; gap:0.5rem; color:var(--danger); font-size:0.75rem; font-weight:750;">
          <i data-lucide="alert-triangle"></i>
          <span>Insufficient IC Balance Warning</span>
      </div>
      <p style="font-size:0.7rem; margin:0.25rem 0 0.5rem 0; color:var(--text-secondary);">
          ${state.activeUser} has <strong>${symbol}${currentBalance}</strong>, but this route requires <strong>${symbol}${transitFareTotal}</strong>.
      </p>
      <div style="display:flex; gap:0.4rem; align-items:center;">
          <input type="number" id="inline-recharge-amount" placeholder="Recharge Amt" style="padding:0.25rem 0.55rem; font-size:0.8rem; width:110px; background:var(--bg-card-glass); border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text-primary); outline:none;">
          <button type="button" class="btn btn-accent btn-sm" id="inline-recharge-btn" style="padding:0.35rem 0.55rem; font-size:0.8rem;">⚡ Recharge</button>
      </div>
  </div>
  ```
- **Action**: When `⚡ Recharge` is clicked:
  1. Add recharge amount to `state.icCards[state.activeUser][currency]`.
  2. Log the recharge expense to cash ledger.
  3. Save state, run `updateIcEstimator()`, and re-render the transit details (hiding the warning).

---

### 2.2 Interactive Map Shortcuts
- **Leaflet Popup**: Clicking on a Leaflet marker displays:
  ```html
  <div style="font-family:var(--font-primary); padding: 0.2rem; min-width: 140px; text-align: center;">
      <div style="font-size: 0.8rem; font-weight: 750; margin-bottom: 0.6rem; color: var(--text-primary);">
          ${stationName}
      </div>
      <div style="display: flex; gap: 0.4rem; justify-content: center;">
          <button type="button" class="btn btn-primary btn-xs" onclick="window.setPinpoint('start', ${lat}, ${lng}, '${escapeHtml(stationName)}')">
              🚩 Start
          </button>
          <button type="button" class="btn btn-accent btn-xs" onclick="window.setPinpoint('end', ${lat}, ${lng}, '${escapeHtml(stationName)}')">
              🏁 End
          </button>
      </div>
  </div>
  ```
- **Handler**: Update global `window.setPinpoint` to receive `(type, lat, lng, displayName)`. It populates input boxes and hidden coordinate fields, then calls `transitMapObj.closePopup()`.

---

### 2.3 Daily Budget & Spend Analytics Dashboard
- **Layout**: Renders inside the Ledger card, under the header. Includes:
  - Daily Budget Input field (`daily-budget-limit-input`).
  - Budget Progress Bar (toggles from green ➔ yellow ➔ red with dynamic alerts).
  - Horizontal stacked category color bar (compiled using percentage calculations of Food, Drinks, Transport, Sights, Shopping, etc. for the selected day).
- **Data Persistence**: Saves `dailyBudgetLimit` inside the Firestore group object to sync across all members.

---

### 2.4 Security & Testing Audits
- **Input Sanitization**: Wrap all dynamic string elements (`member.name`, `expense.title`, `activity.title`, `activity.location`) in an `escapeHtml()` helper:
  ```javascript
  function escapeHtml(unsafe) {
      if (typeof unsafe !== 'string') return unsafe;
      return unsafe
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
  }
  ```
- **Firestore Schema Rules**: Write `firestore.rules` containing schema controls, get/write filters, and prevention of collection deletion from unauthorized clients.
