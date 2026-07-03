# Liquid Glass Dashboard UI Upgrade Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Upgrade the RoamReady trip planner into an immersive, premium, WebGL-powered liquid glass dashboard to impress potential recruiters.

**Architecture:** Integrate WebGL `Container` and `Button` classes to render dynamic, interactive glass canvases beneath main cards and buttons. Add vibrant backdrop gradients to enhance refraction effects, keeping fallback modes for non-WebGL/Node environments.

**Tech Stack:** Vanilla JavaScript, HTML5 Canvas, WebGL shaders, CSS3, `html2canvas` library.

---

### Task 1: Reference Libraries and Styles in HTML

**Files:**
- Modify: `scheduler.html:10-16` (add styles link)
- Modify: `scheduler.html:755-763` (add JS script tags)

**Step 1: Write verification test**
Check that script/link tags are referenced in `scheduler.html`.

**Step 2: Add CDN and local script references**
- Link [glass.css](file:///C:/Users/user/trip-app/glass.css) in the `<head>`.
- Add CDN script for `html2canvas` (`https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js`).
- Load `container.js` and `button.js` sequentially before `scheduler.js`.

Code addition to `<head>`:
```html
<link rel="stylesheet" href="glass.css">
```

Code addition to bottom scripts:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="container.js"></script>
<script src="button.js"></script>
<script type="module" src="scheduler.js"></script>
```

**Step 3: Run validation**
Verify that the files load successfully in a local browser (using `npm run dev` or by serving the folder).

**Step 4: Commit**
```bash
git add scheduler.html
git commit -m "feat: reference glass styles and scripts in HTML"
```

---

### Task 2: Implement Glass Backdrop and Colors in CSS

**Files:**
- Modify: `scheduler.css` (custom variables and backgrounds)

**Step 1: Define design system variables**
Update the CSS variables under `:root` and `[data-theme="dark"]` to support vibrant backgrounds and high-contrast styling.

Add new theme gradient values to body:
```css
body {
    background: radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
                linear-gradient(135deg, #070b19 0%, #111827 100%);
    color: #f8fafc;
}
```

Ensure cards have transparent base so the WebGL canvases are visible underneath:
```css
.card {
    background: rgba(255, 255, 255, 0.05) !important;
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
}
```

**Step 2: Commit**
```bash
git add scheduler.css
git commit -m "style: add glassmorphism CSS rules and vibrant background gradients"
```

---

### Task 3: Initialize Glass Containers in JS

**Files:**
- Modify: `scheduler.js` (initialize WebGL Container elements)

**Step 1: Check for browser context and initialize Containers**
Add a helper in `scheduler.js` to dynamically wrap targeted cards (`.calendar-card`, `.details-card`, etc.) in the new `Container` class:
```javascript
if (typeof window !== 'undefined' && window.Container) {
    document.querySelectorAll('.card').forEach(el => {
        // Instantiate Container mapping onto DOM elements
        const container = new window.Container();
        // Insert container canvas inside the element
        el.style.position = 'relative';
        el.insertBefore(container.element, el.firstChild);
    });
}
```

**Step 2: Verify mock tests still pass**
Run `node test.js` to ensure the Node-based tests do not throw errors when initializing the module.

**Step 3: Commit**
```bash
git add scheduler.js
git commit -m "feat: dynamically initialize glass WebGL containers for cards"
```

---

### Task 4: Initialize Glass Buttons in JS

**Files:**
- Modify: `scheduler.js` (initialize glass buttons and nav items)

**Step 1: Replace buttons with WebGL Buttons**
Convert primary action buttons (`#add-activity-btn`, `#add-expense-btn`) to WebGL buttons using `new window.Button({ text: 'Add Activity', size: 16, onClick: ... })`.

**Step 2: Commit**
```bash
git add scheduler.js
git commit -m "feat: replace primary CTAs with WebGL dynamic buttons"
```
