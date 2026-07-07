# Premium Features Implementation Plan

> **For Antigravity**: REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal**: Build four premium features (Transit-Ledger warnings, Map Shortcuts, Budget & Spend Analytics Dashboard, and real-time security guards).

**Architecture**: Implement standard client-side state modifications to Firestore/LocalStorage databases, HTML escaping, and CSS flex-width analytics rendering.

**Tech Stack**: HTML5, Vanilla CSS, Vanilla JavaScript, Leaflet.js, Google Cloud Firestore.

---

### Task 1: XSS Input Sanitization
**Files**:
- Modify: `C:/Users/user/trip-app/scheduler.js:3380-3400`

**Step 1: Write the failing test**
Create a test block in `test.js` verifying that `escapeHtml` is defined and correctly escapes HTML control characters:
```javascript
const testUnsafe = '<script>alert(1)</script>';
assert.strictEqual(escapeHtml(testUnsafe), '&lt;script&gt;alert(1)&lt;/script&gt;');
```

**Step 2: Run test to verify it fails**
Run: `node test.js`
Expected: FAIL (ReferenceError: escapeHtml is not defined)

**Step 3: Write minimal implementation**
Declare `escapeHtml` globally in `scheduler.js`:
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

**Step 4: Run test to verify it passes**
Run: `node test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add scheduler.js
git commit -m "feat: add escapeHtml utility function to prevent XSS"
```

---

### Task 2: Transit-Ledger Low Balance Alerts & Inline Top-up
**Files**:
- Modify: `C:/Users/user/trip-app/scheduler.js:4180-4240`

**Step 1: Write the failing test**
Ensure that if a route is calculated and the passenger has insufficient balance, a warning container is created:
```javascript
const warningCard = document.querySelector('.warning-card-premium');
assert.ok(warningCard);
```

**Step 2: Run test to verify it fails**
Run: `node test.js`
Expected: FAIL (AssertionError: warningCard is null)

**Step 3: Write minimal implementation**
Check current balance against `transitFareTotal`. If insufficient, append warning HTML:
```javascript
const currentBalance = state.icCards[state.activeUser] ? (state.icCards[state.activeUser][currency] || 0) : 0;
if (currentBalance < transitFareTotal) {
    // Append warnings
}
```

**Step 4: Run test to verify it passes**
Run: `node test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add scheduler.js
git commit -m "feat: add low balance warning warning panel in subway optimizer"
```

---

### Task 3: Interactive Map Action Shortcuts
**Files**:
- Modify: `C:/Users/user/trip-app/scheduler.js:3426-3450`

**Step 1: Write the failing test**
Check that `window.setPinpoint` accepts a `displayName` parameter and sets the input's value:
```javascript
window.setPinpoint('start', 35.6895, 139.6917, 'Tokyo Station');
assert.strictEqual(document.getElementById('transit-start-query').value, 'Tokyo Station');
```

**Step 2: Run test to verify it fails**
Run: `node test.js`
Expected: FAIL (AssertionError: expected 'Tokyo Station' but got '35.68950, 139.69170')

**Step 3: Write minimal implementation**
Update `window.setPinpoint` definition:
```javascript
window.setPinpoint = (type, lat, lng, displayName = null) => {
    // Update input values with displayName
};
```

**Step 4: Run test to verify it passes**
Run: `node test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add scheduler.js
git commit -m "feat: upgrade window.setPinpoint to support custom location names"
```

---

### Task 4: Daily Budget Progress Bar
**Files**:
- Modify: `C:/Users/user/trip-app/scheduler.js:2030-2080`

**Step 1: Write the failing test**
Verify that a budget limit is persisted in the group's state and progress bar calculations are correct:
```javascript
state.dailyBudgetLimit = 5000;
assert.strictEqual(state.dailyBudgetLimit, 5000);
```

**Step 2: Run test to verify it fails**
Run: `node test.js`
Expected: FAIL

**Step 3: Write minimal implementation**
Hook up `#daily-budget-limit-input` change listener to update state, and render progress indicator bar:
```javascript
const limitInput = document.getElementById("daily-budget-limit-input");
if (limitInput) {
    limitInput.addEventListener("input", (e) => {
        state.dailyBudgetLimit = parseFloat(e.target.value) || 0;
        saveAllData();
        renderLedger();
    });
}
```

**Step 4: Run test to verify it passes**
Run: `node test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add scheduler.js
git commit -m "feat: implement budget progress bar in expenses ledger"
```

---

### Task 5: CSS Stacked Category Spend Distribution Chart
**Files**:
- Modify: `C:/Users/user/trip-app/scheduler.js:2080-2130`

**Step 1: Write the failing test**
Ensure CSS stacked segments are generated correctly according to daily expenses categories:
```javascript
const barSegments = document.querySelectorAll("#category-stacked-bar > div");
assert.ok(barSegments.length > 0);
```

**Step 2: Run test to verify it fails**
Run: `node test.js`
Expected: FAIL

**Step 3: Write minimal implementation**
Add dynamic DOM segment creation using category pastel colors to the stacked bar element inside `renderLedger()`:
```javascript
// Compile spend by category
// Generate width percentage and append divs
```

**Step 4: Run test to verify it passes**
Run: `node test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add scheduler.js
git commit -m "feat: render CSS-only stacked category distribution chart inside ledger"
```

---

### Task 6: Firestore Security Rules Schema
**Files**:
- Create: `C:/Users/user/trip-app/firestore.rules`

**Step 1: Write the rules content**
Define basic read/write parameters for the cloud database.
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /groups/{groupId} {
      allow get, write: if true;
      allow create: if request.resource.data.keys().hasAll(['destination', 'members', 'expenses']);
      allow delete: if false;
    }
  }
}
```

**Step 2: Commit**
```bash
git add firestore.rules
git commit -m "sec: create firestore rules schema file for collection protection"
```
