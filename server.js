const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.zip': 'application/zip'
};

async function fetchExternal(targetUrl) {
    const response = await fetch(targetUrl, {
        headers: {
            'User-Agent': 'RoamReadyBackendProxy/1.0',
            'Accept': 'application/json'
        }
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.text();
    return { status: response.status, data };
}

const server = http.createServer(async (req, res) => {
    // Enable basic CORS for all local requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    // 1. API proxy route for coordinate directions
    if (pathname === '/api/route') {
        const { mode, startLon, startLat, endLon, endLat, orsKey } = parsedUrl.query;
        if (!mode || !startLon || !startLat || !endLon || !endLat) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing parameters' }));
            return;
        }

        let otpMode = "WALK";
        if (mode === "bicycle") otpMode = "BICYCLE";
        else if (mode === "driving") otpMode = "CAR";

        const targetUrl = `http://129.225.135.42:8080/otp/routers/default/plan?fromPlace=${startLat},${startLon}&toPlace=${endLat},${endLon}&mode=${otpMode}`;

        try {
            const result = await fetchExternal(targetUrl);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(result.data);
        } catch (e) {
            console.error(`Proxy OTP routing failed for ${mode}, falling back to ORS/BRouter/OSRM:`, e.message);
            try {
                const effectiveOrsKey = orsKey || process.env.ROAMREADY_ORS_KEY || "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImRkZmUxMjY1NmFhYjQzMDU5MTc1YTlhMTlmMjczOTEyIiwiaCI6Im11cm11cjY0In0=";
                let fallbackUrl = "";
                if (effectiveOrsKey) {
                    let profile = "driving-car";
                    if (mode === "foot") profile = "foot-walking";
                    else if (mode === "bicycle") profile = "cycling-regular";
                    fallbackUrl = `https://api.openrouteservice.org/v2/directions/${profile}?api_key=${effectiveOrsKey}&start=${startLon},${startLat}&end=${endLon},${endLat}`;
                } else if (mode === "foot" || mode === "bicycle") {
                    fallbackUrl = `https://brouter.de/brouter?lonlats=${startLon},${startLat}|${endLon},${endLat}&profile=${mode === "foot" ? "trekking" : "bicycle"}&alternativeidx=0&format=geojson`;
                } else {
                    fallbackUrl = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;
                }
                const result = await fetchExternal(fallbackUrl);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(result.data);
            } catch (fallbackErr) {
                try {
                    let lastResortUrl = "";
                    if (mode === "foot" || mode === "bicycle") {
                        lastResortUrl = `https://brouter.de/brouter?lonlats=${startLon},${startLat}|${endLon},${endLat}&profile=${mode === "foot" ? "trekking" : "bicycle"}&alternativeidx=0&format=geojson`;
                    } else {
                        lastResortUrl = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;
                    }
                    const result = await fetchExternal(lastResortUrl);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(result.data);
                } catch (lastErr) {
                    try {
                        const standardOsrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;
                        const result = await fetchExternal(standardOsrmUrl);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(result.data);
                    } catch (finalErr) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Routing proxy failed completely', details: finalErr.message }));
                    }
                }
            }
        }
        return;
    }

    // 2. Static file serving
    if (pathname === '/') {
        pathname = '/scheduler.html';
    }

    const filePath = path.join(__dirname, pathname);
    
    // Safety check to prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(` RoamReady local testing server active!`);
    console.log(` Web App:  http://localhost:${PORT}`);
    console.log(` API Proxy: http://localhost:${PORT}/api/route`);
    console.log(`======================================================\n`);
});
