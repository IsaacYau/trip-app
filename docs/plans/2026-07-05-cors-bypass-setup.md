# CORS Bypass Guide for Localhost Testing

When running web applications from a local file (`file:///...`) or `localhost`, modern web browsers restrict cross-origin requests (CORS) to external APIs like `brouter.de` or `openstreetmap.de` to protect user security.

To test these APIs locally, you can use any of the following standard developer bypass methods:

---

## Method 1: Use a Browser Extension (Easiest)

This is the quickest way to temporarily bypass CORS checks in your browser.

1. **For Chrome / Edge / Brave**:
   * Install the [Allow CORS: Access-Control-Allow-Origin](https://chromewebstore.google.com/detail/allow-cors-access-control/lhobafceokglbbddbejdnnofjfhbhgne) extension from the Chrome Web Store.
2. **How to use**:
   * Click the extension icon in your toolbar.
   * Toggle it **ON** (the icon will turn green).
   * Reload your RoamReady app tab and run the route calculation.
   * *Note: Remember to toggle it **OFF** when you are done testing to restore standard browser security.*

---

## Method 2: Launch Chrome with Web Security Disabled

You can launch a temporary, isolated instance of Chrome that bypasses CORS checks entirely.

### Windows (PowerShell / Command Prompt)
1. Close all active Chrome windows.
2. Open PowerShell or Command Prompt.
3. Run the following command:
   ```powershell
   Start-Process chrome.exe -ArgumentList '--user-data-dir="C:/tmp/chrome_dev_test"', '--disable-web-security', '--disable-site-isolation-trials'
   ```
4. A new Chrome window will open with a yellow warning bar saying *"You are using an unsupported command-line flag: --disable-web-security"*.
5. Drag and drop `scheduler.html` (or your localhost dev URL) into this window to test without CORS blockages.

---

## Method 3: Use a Local CORS Proxy

If you want to run a local proxy server to relay requests:

1. Install `local-cors-proxy` globally via npm:
   ```bash
   npm install -g local-cors-proxy
   ```
2. Start the proxy server pointing to BRouter:
   ```bash
   lcp --proxyUrl https://brouter.de
   ```
3. The proxy will listen on `http://localhost:8010`. You can redirect local queries there to completely avoid browser CORS blocks.
