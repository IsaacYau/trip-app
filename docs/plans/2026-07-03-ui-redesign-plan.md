# UI Redesign & Location Images Fallback Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Overhaul the RoamReady UI into a premium dashboard featuring reliable WebGL liquid glass panels, styled theme variables, Fira Code headers, and custom offline placeholder SVGs for missing location images.

**Architecture:** Bypasses `html2canvas` capture to render procedural multi-colored fluid WebGL maps immediately. Adds SVG inline fallback gradients when external location images fail to load.

**Tech Stack:** WebGL shaders, inline SVGs, CSS variables, Fira Code typography.

---

### Task 1: Re-architect Glassmorphism WebGL Rendering

**Files:**
- Modify: `container.js:126-146` (procedural canvas generation)

**Step 1: Replace html2canvas snapshot with a fluid procedural texture**
Modify `init()` in [container.js](file:///C:/Users/user/trip-app/container.js) to generate a high-contrast multi-color gradient canvas immediately on instantiation:
```javascript
  init() {
    this.createElement()
    this.setupCanvas()
    this.updateSizeFromDOM()

    if (!Container.pageSnapshot) {
      const fallbackCanvas = document.createElement('canvas')
      fallbackCanvas.width = 512
      fallbackCanvas.height = 512
      const ctx = fallbackCanvas.getContext('2d')
      
      // Draw a multi-color radial gradient to simulate fluid backdrop for glass refraction
      const grad = ctx.createRadialGradient(256, 256, 40, 256, 256, 320)
      grad.addColorStop(0, '#6366f1') // Indigo
      grad.addColorStop(0.3, '#3b82f6') // Trust Blue
      grad.addColorStop(0.6, '#a855f7') // Purple
      grad.addColorStop(1, '#070b19') // Midnight Blue
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 512, 512)
      
      Container.pageSnapshot = fallbackCanvas
    }
    
    this.initWebGL()
  }
```

**Step 2: Verify WebGL compilation**
Refresh the page. Check console to ensure no WebGL program errors are present.

**Step 3: Commit**
```bash
git add container.js
git commit -m "feat: bypass html2canvas with instant procedural WebGL glass textures"
```

---

### Task 2: Redesign UI Dashboard Aesthetics

**Files:**
- Modify: `scheduler.html:10` (Import Fira Code & Fira Sans from Google Fonts)
- Modify: `scheduler.css:1-120` (Variables, body styling, borders, card blur, fonts)

**Step 1: Update Google Fonts link**
Change the CSS font import link to load Fira Code and Fira Sans in [scheduler.html](file:///C:/Users/user/trip-app/scheduler.html).

**Step 2: Redefine style system custom variables**
```css
:root {
    --bg-primary-gradient: radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.12) 0%, transparent 60%),
                           linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    --bg-card-glass: rgba(255, 255, 255, 0.75);
    --glass-border: rgba(59, 130, 246, 0.25);
    --text-primary: #1e293b;
    --font-primary: 'Fira Sans', sans-serif;
    --font-heading: 'Fira Code', monospace;
}
[data-theme="dark"] {
    --bg-primary-gradient: radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.2) 0%, transparent 60%),
                           linear-gradient(135deg, #070b19 0%, #0b0f19 100%);
    --bg-card-glass: rgba(19, 28, 46, 0.4);
    --glass-border: rgba(96, 165, 250, 0.2);
    --text-primary: #f8fafc;
}
```

**Step 3: Commit**
```bash
git add scheduler.css scheduler.html
git commit -m "style: apply Fira font-pairings and glass dashboard color palette"
```

---

### Task 3: Implement Location Fallback SVG Images

**Files:**
- Modify: `scheduler.js` (createPlaceCardElement, location details render, and matched preview image renders)

**Step 1: Add fallback data URI SVG**
Replace image error attributes in [scheduler.js](file:///C:/Users/user/trip-app/scheduler.js) to set `this.src` to a custom gradient inline SVG containing a map-pin icon instead of setting wrapper display to `none`.

**Step 2: Commit**
```bash
git add scheduler.js
git commit -m "feat: render clean gradient inline SVGs when location photos fail to load"
```
