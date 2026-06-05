# Wallet Refinements Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Refine the wallet features to improve mobile responsiveness, display the cash tracker at the top, add payment method options for global splits, auto-split dynamically, allow exact amount inputs on split rows, integrate cash tracking into debt settlement, and display expense breakdowns.

**Architecture:** All changes will be in `scheduler.html`, `scheduler.js`, and `scheduler.css`. State adjustments for cash balances and splits will be updated reactively when values change.

**Tech Stack:** Vanilla HTML, CSS, JavaScript.

---

### Task 1: Reposition Cash Balance Tracker and Improve CSS Mobile Responsiveness

**Files:**
- Modify: [scheduler.html](file:///C:/Users/user/trip-app/scheduler.html)
- Modify: [scheduler.css](file:///C:/Users/user/trip-app/scheduler.css)

**Step 1: Move Cash Balance Tracker Card to the top of `#wallet-section`**
Cut the `.cash-tracker-card` element from the bottom of `#wallet-section` (lines 503-513) and insert it immediately after `<section id="wallet-section" class="tab-content">` (line 242) and its `.section-header` (line 249).

**Step 2: Update CSS to ensure mobile responsiveness**
Adjust `.wallet-grid`, `.form-row`, `.form-row-three`, and split configurations in CSS.
- Ensure `.form-row` and `.form-row-three` use responsive layout grids or flex layouts (e.g. `@media (max-width: 768px)` rather than just `480px`).
- Change `.split-member-row` to use flexbox with alignment wrap and sensible spacing.

**Step 3: Verify style updates on screen**
Verify pages load cleanly.

**Step 4: Commit**
```bash
git add scheduler.html scheduler.css
git commit -m "feat: position cash tracker at top and improve mobile responsiveness"
```

---

### Task 2: Enable Payment Method Panel for Global Split Expenses

**Files:**
- Modify: [scheduler.js](file:///C:/Users/user/trip-app/scheduler.js)

**Step 1: Update `updateExpenseTypePanels` in JS**
Modify `updateExpenseTypePanels` so that the payment method panel (`#payment-method-panel`) is shown for BOTH `global` and `local` expenses:
```javascript
function updateExpenseTypePanels(type) {
    const splitPanel = document.getElementById("split-config-panel");
    const payPanel = document.getElementById("payment-method-panel");
    if (type === "global") {
        if (splitPanel) splitPanel.style.display = "block";
    } else {
        if (splitPanel) splitPanel.style.display = "none";
    }
    // Always show payment panel for both local and global expenses
    if (payPanel) payPanel.style.display = "block";
}
```

**Step 2: Save payment method on global expense submit**
Modify `expenseForm` submit handler to read and attach `paymentMethod` for `global` expenses too (just like for local).

**Step 3: Commit**
```bash
git add scheduler.js
git commit -m "feat: enable payment methods for global split expenses"
```

---

### Task 3: Implement Auto-redistribution and Exact Amount Splits

**Files:**
- Modify: [scheduler.js](file:///C:/Users/user/trip-app/scheduler.js)
- Modify: [scheduler.css](file:///C:/Users/user/trip-app/scheduler.css)

**Step 1: Render Split Panel with Amount/Percentage inputs**
Modify `renderSplitPanel(members)` in JS to display:
- Checkbox + name.
- Range slider.
- Number input for percent.
- Number input or read-only/editable indicator for exact currency amount.
- Redirection/re-split logic when checked/unchecked so it always totals 100%.

**Step 2: Connect Slider and Input Elements for Redistribution**
Connect input/change event listeners so that adjusting one slider or typing a specific split amount/percentage will redistribute the difference equally among the other checked members.

**Step 3: Commit**
```bash
git add scheduler.js scheduler.css
git commit -m "feat: implement split input redistribution and exact split amounts"
```

---

### Task 4: Settle Up with Cash & Expense Breakdown Widget

**Files:**
- Modify: [scheduler.js](file:///C:/Users/user/trip-app/scheduler.js)
- Modify: [scheduler.html](file:///C:/Users/user/trip-app/scheduler.html)

**Step 1: Settle Up Cash Balances Adjustment**
In JS `settleDebt` / action handler, check if the payment method for settlement is Cash. If so:
- Deduct the settled amount from the debtor's cash balance.
- Add the settled amount to the creditor's cash balance.
- Re-render the Cash Balance Tracker.

**Step 2: Total Expenses by Payment Method**
Add a summary block showing the user's total expenses split across Cash, ePayment, Transit, and theoretical expenses.

**Step 3: Commit**
```bash
git add scheduler.js scheduler.html
git commit -m "feat: settle up cash balance adjustment and expense breakdown summary"
```
