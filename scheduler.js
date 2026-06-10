// -------------------------------------------------------------------------
// FIREBASE AUTHENTICATION CONFIGURATION
// -------------------------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

import { firebaseConfig } from "./config.js";

let app = null;
let auth = null;
let provider = null;
let db = null;

if (firebaseConfig && firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
    db = getFirestore(app);
}

// -------------------------------------------------------------------------
// PURE LOGICAL UTILITIES (Outside DOM wrapper for unit-testability)
// -------------------------------------------------------------------------

// Exchange Rates (Base: HKD)
// 1 CNY = 1.15 HKD
// 100 JPY = 5.0 HKD => 1 JPY = 0.05 HKD
// 1 MYR = 2.0 HKD
const FX_RATES = {
    HKD: 1.0,
    JPY: 0.05,
    CNY: 1.15,
    MYR: 2.0
};

function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
}

function validateActivityInput(title) {
    return typeof title === "string" && title.trim().length > 0;
}

function validateTimeSlotInput(start, end) {
    if (!start) return false;
    if (!end) return true; // Optional end time is valid
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    if (startH < endH) return true;
    if (startH === endH && startM < endM) return true;
    return false;
}

function hasTimeConflict(activities, day, start, end, excludeId = null) {
    if (start && end) {
        const startMin = timeToMinutes(start);
        const endMin = timeToMinutes(end);
        if (endMin < startMin) {
            return { title: "Invalid Duration (End time is earlier than start time)" };
        }
    }
    return null;
}

function convertToHkd(amount, currency) {
    const rate = FX_RATES[currency] || 1.0;
    return Math.round(amount * rate * 100) / 100;
}

// Subway Adjacency Map Networks
const TRANSIT_NETWORKS = {
    japan: {
        nodes: ["Nagoya Station", "Sakae", "Osaka Castle", "Umeda", "Namba", "Universal Studios", "Sannomiya", "Kobe Harborland"],
        links: [
            { u: "Nagoya Station", v: "Sakae", time: 5, fare: 210, line: "Higashiyama Line", color: "#e53e3e" },
            { u: "Nagoya Station", v: "Umeda", time: 50, fare: 5900, line: "Tokaido Shinkansen", color: "#3182ce" },
            { u: "Umeda", v: "Namba", time: 8, fare: 240, line: "Midosuji Line", color: "#e53e3e" },
            { u: "Umeda", v: "Osaka Castle", time: 10, fare: 170, line: "JR Loop Line", color: "#dd6b20" },
            { u: "Namba", v: "Universal Studios", time: 15, fare: 210, line: "JR Sakurajima Line", color: "#319795" },
            { u: "Umeda", v: "Sannomiya", time: 30, fare: 330, line: "Hankyu Kobe Line", color: "#805ad5" },
            { u: "Sannomiya", v: "Kobe Harborland", time: 8, fare: 210, line: "Kaigan Line", color: "#38a169" }
        ]
    },
    malaysia: {
        nodes: ["KL Sentral", "KLCC", "Bukit Bintang", "Batu Caves", "Butterworth", "George Town", "Penang Hill"],
        links: [
            { u: "KL Sentral", v: "KLCC", time: 10, fare: 2.40, line: "Kelana Jaya Line", color: "#e53e3e" },
            { u: "KL Sentral", v: "Bukit Bintang", time: 7, fare: 1.80, line: "Kajang MRT Line", color: "#3182ce" },
            { u: "KL Sentral", v: "Batu Caves", time: 25, fare: 2.60, line: "KTM Komuter", color: "#38a169" },
            { u: "KL Sentral", v: "Butterworth", time: 240, fare: 60.00, line: "ETS Gold Train", color: "#d69e2e" },
            { u: "Butterworth", v: "George Town", time: 20, fare: 2.00, line: "Penang Ferry", color: "#319795" },
            { u: "George Town", v: "Penang Hill", time: 30, fare: 30.00, line: "Funicular Railway", color: "#805ad5" }
        ]
    },
    china: {
        nodes: ["Shenzhen Bao'an Airport", "Futian Checkpoint", "OCT Loft", "Shenzhen Bay Port", "Dongmen Pedestrian Street"],
        links: [
            { u: "Shenzhen Bao'an Airport", v: "Futian Checkpoint", distance: 32 },
            { u: "Shenzhen Bao'an Airport", v: "OCT Loft", distance: 22 },
            { u: "Futian Checkpoint", v: "Shenzhen Bay Port", distance: 12 },
            { u: "Futian Checkpoint", v: "Dongmen Pedestrian Street", distance: 8 },
            { u: "OCT Loft", v: "Dongmen Pedestrian Street", distance: 14 }
        ]
    }
};

// Dijkstra Path Finder
function findDijkstraRoute(destination, start, end, criteria) {
    const network = TRANSIT_NETWORKS[destination];
    if (!network) return null;

    const nodes = network.nodes;
    const links = network.links;

    const adj = {};
    nodes.forEach(n => adj[n] = []);
    links.forEach(l => {
        adj[l.u].push({ node: l.v, time: l.time, fare: l.fare, line: l.line, color: l.color });
        adj[l.v].push({ node: l.u, time: l.time, fare: l.fare, line: l.line, color: l.color });
    });

    const dist = {};
    const prev = {};
    const prevLink = {};

    nodes.forEach(n => {
        dist[n] = Infinity;
        prev[n] = null;
    });

    dist[start] = 0;
    const queue = new Set(nodes);

    while (queue.size > 0) {
        let u = null;
        queue.forEach(n => {
            if (u === null || dist[n] < dist[u]) {
                u = n;
            }
        });

        if (dist[u] === Infinity || u === end) break;
        queue.delete(u);

        adj[u].forEach(edge => {
            if (!queue.has(edge.node)) return;

            let weight = 0;
            if (criteria === "time") {
                weight = edge.time;
            } else {
                const lastLink = prevLink[u];
                const isTransfer = lastLink && lastLink.line !== edge.line;
                weight = 1 + (isTransfer ? 1000 : 0); 
            }

            const alt = dist[u] + weight;
            if (alt < dist[edge.node]) {
                dist[edge.node] = alt;
                prev[edge.node] = u;
                prevLink[edge.node] = edge;
            }
        });
    }

    if (dist[end] === Infinity) return null;

    const path = [];
    const segmentLinks = [];
    let curr = end;
    while (curr !== start) {
        path.push(curr);
        const l = prevLink[curr];
        segmentLinks.push(l);
        curr = prev[curr];
    }
    path.push(start);
    path.reverse();
    segmentLinks.reverse();

    let totalTime = 0;
    let totalFare = 0;
    let transfers = 0;
    let lastLine = null;

    segmentLinks.forEach(l => {
        totalTime += l.time;
        totalFare += l.fare;
        if (lastLine && lastLine !== l.line) {
            transfers++;
        }
        lastLine = l.line;
    });

    return {
        path,
        segmentLinks,
        totalTime,
        totalFare,
        transfers
    };
}

// Pure Debt Settlement Splitter — supports dynamic group members and custom splitAmong/splitRatios
function calculateDebtSettlement(expenses, members) {
    if (!members || members.length === 0) members = ["Alice", "Bob", "Charlie"];

    // grossPaid[member] = total HKD paid out (not counting settlements)
    const grossPaid = {};
    // netBalance[member] = amount they've contributed minus their owed share (+ = creditor, - = debtor)
    const netBalance = {};
    members.forEach(m => { grossPaid[m] = 0; netBalance[m] = 0; });

    let totalHkd = 0; // total global non-settlement spending

    expenses.forEach(exp => {
        if (exp.type === "local") return; // skip personal expenses
        const val = convertToHkd(exp.amount, exp.currency);
        if (!val || val <= 0) return;

        if (exp.isSettlement) {
            // Direct transfer: payer gains credit, recipient loses credit in net balance
            if (netBalance[exp.payer] !== undefined) netBalance[exp.payer] += val;
            if (exp.recipient && netBalance[exp.recipient] !== undefined) netBalance[exp.recipient] -= val;
            // Also track gross paid for settlement (optional)
            if (grossPaid[exp.payer] !== undefined) grossPaid[exp.payer] += val;
            if (exp.recipient && grossPaid[exp.recipient] !== undefined) grossPaid[exp.recipient] -= val;
            return;
        }

        // Determine who splits and at what ratio
        const splitAmong = exp.splitAmong && exp.splitAmong.length > 0
            ? exp.splitAmong.filter(m => members.includes(m))
            : members;
        const n = splitAmong.length;
        if (n === 0) return;

        // Track gross paid and global total
        if (grossPaid[exp.payer] !== undefined) grossPaid[exp.payer] += val;
        totalHkd += val;

        // Credit the payer's net balance
        if (netBalance[exp.payer] !== undefined) netBalance[exp.payer] += val;

        // Debit each split member's share from net balance
        if (exp.splitRatios && Object.keys(exp.splitRatios).length > 0) {
            splitAmong.forEach(m => {
                const ratio = (exp.splitRatios[m] || 0) / 100;
                if (netBalance[m] !== undefined) netBalance[m] -= val * ratio;
            });
        } else {
            const share = val / n;
            splitAmong.forEach(m => {
                if (netBalance[m] !== undefined) netBalance[m] -= share;
            });
        }
    });

    // For backward compat: share = equal split of totalHkd among all members
    const share = members.length > 0 ? totalHkd / members.length : 0;

    // Separate into debtors (negative net) and creditors (positive net)
    const debtors = [];
    const creditors = [];
    members.forEach(m => {
        const bal = netBalance[m] || 0;
        if (bal < -0.01) debtors.push({ name: m, amount: Math.abs(bal) });
        else if (bal > 0.01) creditors.push({ name: m, amount: bal });
    });

    const settlements = [];
    let d_idx = 0, c_idx = 0;

    // Greedy double-pointer settlement — minimizes number of transactions
    while (d_idx < debtors.length && c_idx < creditors.length) {
        const debtor = debtors[d_idx];
        const creditor = creditors[c_idx];
        const pay = Math.min(debtor.amount, creditor.amount);

        settlements.push({ from: debtor.name, to: creditor.name, amount: pay });

        debtor.amount -= pay;
        creditor.amount -= pay;

        if (debtor.amount < 0.01) d_idx++;
        if (creditor.amount < 0.01) c_idx++;
    }

    return { totalPaid: grossPaid, totalHkd, share, settlements };
}



function minutesToTime(mins) {
    const h = String(Math.floor(mins / 60)).padStart(2, '0');
    const m = String(mins % 60).padStart(2, '0');
    return `${h}:${m}`;
}


function curatingFallbackDb() {
    return [
        {
            "name": "Nagoya Castle",
            "city": "Nagoya",
            "country": "Japan",
            "category": "Sights",
            "rating": 4.5,
            "reviewsCount": 1200,
            "coordinates": { "lat": 35.1855, "lng": 136.9000 },
            "price_local": 500,
            "currency": "JPY",
            "price_hkd": 25.00,
            "price_level": "$",
            "street": "1-1 Honmaru, Naka Ward"
        },
        {
            "name": "Osu Shopping Street",
            "city": "Nagoya",
            "country": "Japan",
            "category": "Shopping",
            "rating": 4.2,
            "reviewsCount": 850,
            "coordinates": { "lat": 35.1593, "lng": 136.9029 },
            "price_local": 1500,
            "currency": "JPY",
            "price_hkd": 75.00,
            "price_level": "$$",
            "street": "3 Chome-45 Osu, Naka Ward"
        },
        {
            "name": "Atsuta Jingu",
            "city": "Nagoya",
            "country": "Japan",
            "category": "Sights",
            "rating": 4.4,
            "reviewsCount": 980,
            "coordinates": { "lat": 35.1257, "lng": 136.9091 },
            "price_local": 0,
            "currency": "JPY",
            "price_hkd": 0.00,
            "price_level": "Free",
            "street": "1 Chome-1-1 Jingu, Atsuta Ward"
        },
        {
            "name": "Nagoya Ramen Street",
            "city": "Nagoya",
            "country": "Japan",
            "category": "Food",
            "rating": 4.3,
            "reviewsCount": 420,
            "coordinates": { "lat": 35.1706, "lng": 136.9067 },
            "price_local": 1200,
            "currency": "JPY",
            "price_hkd": 60.00,
            "price_level": "$$",
            "street": "Nagoya Station JR Towers"
        },
        {
            "name": "Dotonbori Glico Sign",
            "city": "Osaka",
            "country": "Japan",
            "category": "Sights",
            "rating": 4.6,
            "reviewsCount": 3500,
            "coordinates": { "lat": 34.6690, "lng": 135.5013 },
            "price_local": 0,
            "currency": "JPY",
            "price_hkd": 0.00,
            "price_level": "Free",
            "street": "Chuo Ward, Shinsaibashisuji"
        },
        {
            "name": "Kobe Harborland",
            "city": "Kobe",
            "country": "Japan",
            "category": "Sights",
            "rating": 4.4,
            "reviewsCount": 1800,
            "coordinates": { "lat": 34.6796, "lng": 135.1847 },
            "price_local": 0,
            "currency": "JPY",
            "price_hkd": 0.00,
            "price_level": "Free",
            "street": "Higashikawasaki-cho, Chuo Ward"
        },
        {
            "name": "Petronas Twin Towers",
            "city": "Kuala Lumpur",
            "country": "Malaysia",
            "category": "Sights",
            "rating": 4.7,
            "reviewsCount": 5400,
            "coordinates": { "lat": 3.1578, "lng": 101.7120 },
            "price_local": 80,
            "currency": "MYR",
            "price_hkd": 160.00,
            "price_level": "$$",
            "street": "Kuala Lumpur City Centre"
        },
        {
            "name": "Jalan Alor Food Street",
            "city": "Kuala Lumpur",
            "country": "Malaysia",
            "category": "Food",
            "rating": 4.3,
            "reviewsCount": 2400,
            "coordinates": { "lat": 3.1456, "lng": 101.7088 },
            "price_local": 30,
            "currency": "MYR",
            "price_hkd": 60.00,
            "price_level": "$",
            "street": "Jalan Alor, Bukit Bintang"
        },
        {
            "name": "Penang Hill Funicular",
            "city": "George Town",
            "country": "Malaysia",
            "category": "Sights",
            "rating": 4.5,
            "reviewsCount": 1600,
            "coordinates": { "lat": 5.4084, "lng": 100.2774 },
            "price_local": 30,
            "currency": "MYR",
            "price_hkd": 60.00,
            "price_level": "$$",
            "street": "Air Itam, Penang Island"
        }
    ];
}

function createPlaceCardElement(p) {
    if (typeof document === 'undefined') return null;
    const card = document.createElement("div");
    card.className = "place-card card";

    const catClass = p.category ? p.category.toLowerCase() : "food";
    
    let localPriceHtml = "";
    if (p.country === "Japan") {
        localPriceHtml = `JPY ${p.price_local}`;
    } else if (p.country === "Malaysia") {
        localPriceHtml = `MYR ${p.price_local}`;
    } else {
        localPriceHtml = `CNY ${p.price_local}`;
    }

    const ratingHtml = `
        <div class="rating-platform-badge universal-rating-badge">
            <span class="platform-logo">★ Rating</span>
            <span class="rating-score">${p.rating.toFixed(1)} (${p.reviewsCount || 0} reviews)</span>
        </div>
    `;

    const imageHtml = p.imageUrl ? `
        <div class="place-card-image-wrapper">
            <img src="${p.imageUrl}" referrerpolicy="no-referrer" alt="${p.name}" class="place-card-image" loading="lazy" decoding="async" onerror="this.parentElement.style.display='none'">
        </div>
    ` : "";

    const reviewHtml = p.reviews && p.reviews.length > 0 ? `
        <div class="place-review-snippet" style="background-color: var(--bg-primary); border-left: 3px solid var(--accent); padding: 0.5rem; border-radius: var(--radius-sm); font-size: 0.68rem; margin: 0.5rem 0; font-style: italic; color: var(--text-secondary); line-height: 1.3; max-height: 50px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
            "${p.reviews[0]}"
        </div>
    ` : "";

    card.innerHTML = `
        ${imageHtml}
        <div class="place-header">
            <h4 class="place-title">${p.name}</h4>
            <span class="place-cat-badge ${catClass}">${p.category || "Food"}</span>
        </div>
        <div class="place-city-label">
            <i data-lucide="map-pin" style="width:12px; height:12px;"></i>
            <span>${p.city}, ${p.street}</span>
        </div>
        ${ratingHtml}
        <div class="place-details-row">
            <span>Local Cost:</span>
            <span>${localPriceHtml}</span>
        </div>
        <div class="place-details-row">
            <span>Est. Base Cost:</span>
            <span class="place-price-hkd">HKD $${p.price_hkd.toFixed(2)}</span>
        </div>
        <div class="place-details-row">
            <span>Price Level:</span>
            <span>${p.price_level}</span>
        </div>
        ${reviewHtml}
        <div class="place-actions">
            <button class="btn btn-secondary btn-sm" onclick="addPlaceToExpenseHandler('${p.name.replace(/'/g, "\\'")}', ${p.price_hkd}, '${p.category}')">
                <i data-lucide="wallet" style="width:12px; height:12px; margin-right:2px;"></i> Split Cost
            </button>
            <button class="btn btn-primary btn-sm" onclick="addPlaceToActivityHandler('${p.name.replace(/'/g, "\\'")}', '${p.street.replace(/'/g, "\\'")}')">
                <i data-lucide="calendar" style="width:12px; height:12px; margin-right:2px;"></i> Add Route
            </button>
        </div>
    `;

    card.addEventListener("click", (e) => {
        if (e.target.closest("button") || e.target.closest("a") || e.target.closest(".place-actions")) {
            return;
        }
        if (typeof window !== 'undefined' && typeof window.openPlaceDetailModal === 'function') {
            window.openPlaceDetailModal(p);
        }
    });

    if (typeof window !== 'undefined' && window.lucide) window.lucide.createIcons();
    return card;
}


// -------------------------------------------------------------------------
// DOM WRAPPER (Browser environment only)
// -------------------------------------------------------------------------
if (typeof document !== 'undefined') {
    document.addEventListener("DOMContentLoaded", () => {
        // State
        const state = {
            activities: [],
            selectedDay: null,
            firedReminders: new Set(),
            currentYear: new Date().getFullYear(),
            currentMonth: new Date().getMonth(),
            destination: "japan",
            activeUser: "Alice",
            activeGroupId: "",
            firebaseUser: null,
            expenses: [],
            groupMembers: ["Alice", "Bob", "Charlie"],
            selectedExpenseDay: null,
            cashBalances: {},
            icCards: {
                Alice: { JPY: 2000, MYR: 50, CNY: 100, logs: [] },
                Bob: { JPY: 2000, MYR: 50, CNY: 100, logs: [] },
                Charlie: { JPY: 2000, MYR: 50, CNY: 100, logs: [] }
            }
        };

        let placesDatabase = [];
        let placesCurrentPage = 1;
        let gpsCurrentPage = 1;

        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        function resetICCards() {
            state.icCards = {
                Alice: { JPY: 2000, MYR: 50, CNY: 100, logs: [] },
                Bob: { JPY: 2000, MYR: 50, CNY: 100, logs: [] },
                Charlie: { JPY: 2000, MYR: 50, CNY: 100, logs: [] }
            };
        }

        function loadAllData() {
            state.destination = localStorage.getItem("travelDestination") || "japan";
            document.getElementById("destination-select").value = state.destination;

            state.activeUser = localStorage.getItem("travelActiveUser") || "";
            state.groupCode = localStorage.getItem("travelGroupCode") || "";
            state.mappedRole = localStorage.getItem("travelMappedRole") || "";
            state.activeGroupId = localStorage.getItem("travelActiveGroupId") || "TRIP-2026";

            const firstTime = !state.activeUser || !state.groupCode || !state.mappedRole;
            if (firstTime) {
                state.activeUser = "Guest";
                state.groupCode = "TRIP-2026";
                state.mappedRole = "Alice";
                state.activeGroupId = "TRIP-2026";
            }

            document.getElementById("ic-passenger").value = state.mappedRole;

            // Load partitioned activities
            const actKey = state.activeGroupId === "TRIP-2026" ? "travelActivities" : `travelActivities_${state.activeGroupId}`;
            const storedAct = localStorage.getItem(actKey);
            if (storedAct) {
                try { state.activities = JSON.parse(storedAct); } catch (e) { state.activities = []; }
            } else {
                state.activities = [];
            }

            // Load partitioned expenses
            const expKey = state.activeGroupId === "TRIP-2026" ? "travelExpenses" : `travelExpenses_${state.activeGroupId}`;
            const storedExpenses = localStorage.getItem(expKey);
            if (storedExpenses) {
                try { state.expenses = JSON.parse(storedExpenses); } catch (e) { state.expenses = []; }
            } else {
                if (state.activeGroupId === "TRIP-2026") {
                    state.expenses = [
                        { id: "exp-1", title: "Nagoya Castle Tickets", amount: 1500, currency: "JPY", payer: "Alice", category: "Sights", type: "global", date: new Date().toLocaleDateString() },
                        { id: "exp-2", title: "Personal Souvenir Kit", amount: 4500, currency: "JPY", payer: "Bob", category: "Shopping", type: "local", date: new Date().toLocaleDateString() },
                        { id: "exp-3", title: "Jalan Alor Street Dinner", amount: 65, currency: "MYR", payer: "Bob", category: "Food", type: "global", date: new Date().toLocaleDateString() },
                        { id: "exp-4", title: "Didi Ride Shenzhen Futian", amount: 48, currency: "CNY", payer: "Charlie", category: "Transport", type: "global", date: new Date().toLocaleDateString() }
                    ];
                    saveExpensesToStorage();
                } else {
                    state.expenses = [];
                }
            }

            // Load partitioned IC cards
            const icKey = state.activeGroupId === "TRIP-2026" ? "travelICCards" : `travelICCards_${state.activeGroupId}`;
            const storedIC = localStorage.getItem(icKey);
            if (storedIC) {
                try { state.icCards = JSON.parse(storedIC); } catch (e) { resetICCards(); }
            } else {
                resetICCards();
                saveICCardsToStorage();
            }

            // Load cash balances
            const cashKey = state.activeGroupId === "TRIP-2026" ? "travelCashBalances" : `travelCashBalances_${state.activeGroupId}`;
            const storedCash = localStorage.getItem(cashKey);
            if (storedCash) {
                try { state.cashBalances = JSON.parse(storedCash); } catch (e) { state.cashBalances = {}; }
            } else {
                state.cashBalances = {};
            }

            // Set today's trip day based on destination timezone
            state.selectedExpenseDay = getTodayTripDay();

            initializeFiredReminders();
        }

        async function saveActivitiesToStorage() {
            const actKey = state.activeGroupId === "TRIP-2026" ? "travelActivities" : `travelActivities_${state.activeGroupId}`;
            localStorage.setItem(actKey, JSON.stringify(state.activities));
            if (state.activeGroupId && state.activeGroupId !== "TRIP-2026" && db) {
                try {
                    const docRef = doc(db, "trip_networks", state.activeGroupId);
                    await updateDoc(docRef, { activities: state.activities });
                } catch (err) {
                    console.error("Failed to sync activities to Firestore:", err);
                }
            }
        }
        async function saveExpensesToStorage() {
            const expKey = state.activeGroupId === "TRIP-2026" ? "travelExpenses" : `travelExpenses_${state.activeGroupId}`;
            localStorage.setItem(expKey, JSON.stringify(state.expenses));
            if (state.activeGroupId && state.activeGroupId !== "TRIP-2026" && db) {
                try {
                    const docRef = doc(db, "trip_networks", state.activeGroupId);
                    await updateDoc(docRef, { expenses: state.expenses });
                } catch (err) {
                    console.error("Failed to sync expenses to Firestore:", err);
                }
            }
        }
        async function saveICCardsToStorage() {
            const icKey = state.activeGroupId === "TRIP-2026" ? "travelICCards" : `travelICCards_${state.activeGroupId}`;
            localStorage.setItem(icKey, JSON.stringify(state.icCards));
            if (state.activeGroupId && state.activeGroupId !== "TRIP-2026" && db) {
                try {
                    const docRef = doc(db, "trip_networks", state.activeGroupId);
                    await updateDoc(docRef, { icCards: state.icCards });
                } catch (err) {
                    console.error("Failed to sync IC cards to Firestore:", err);
                }
            }
        }
        async function saveCashBalancesToStorage() {
            const cashKey = state.activeGroupId === "TRIP-2026" ? "travelCashBalances" : `travelCashBalances_${state.activeGroupId}`;
            localStorage.setItem(cashKey, JSON.stringify(state.cashBalances));
        }

        const calendarElement = document.getElementById("calendar");
        const selectedDayLabel = document.getElementById("selected-day-label");
        const placeInfo = document.getElementById("place-info");
        const addActivityBtn = document.getElementById("add-activity-btn");
        const currentMonthYearLabel = document.getElementById("current-month-year");
        
        // Theme Toggle
        const themeToggleBtn = document.getElementById("theme-toggle");
        
        // Modals
        const activityModal = document.getElementById("activity-modal");
        const activityForm = document.getElementById("activity-form");
        const modalTitle = document.getElementById("modal-title");
        const modalDayInput = document.getElementById("modal-day");
        const modalActivityIdInput = document.getElementById("modal-activity-id");
        const activityTitleInput = document.getElementById("activity-title");
        const activityStartInput = document.getElementById("activity-start");
        const activityEndInput = document.getElementById("activity-end");
        const activityLocationInput = document.getElementById("activity-location");
        const activityCategorySelect = document.getElementById("activity-category");
        const locationSuggestions = document.getElementById("location-suggestions");
        const activityReminderCheckbox = document.getElementById("activity-reminder");
        const reminderTimeContainer = document.getElementById("reminder-time-container");
        const activityReminderOffsetSelect = document.getElementById("activity-reminder-offset");
        const cancelModalBtn = document.getElementById("cancel-modal");
        const closeModalBtn = document.getElementById("close-modal");

        // Toast
        const reminderToast = document.getElementById("reminder-toast");
        const toastTitle = document.getElementById("toast-title");
        const toastBody = document.getElementById("toast-body");
        const closeToastBtn = document.getElementById("close-toast");

        const destSelect = document.getElementById("destination-select");
        const profileBadgeBtn = document.getElementById("profile-badge-btn");
        const currentUserDisplay = document.getElementById("current-user-display");
        const authModal = document.getElementById("auth-modal");
        const authForm = document.getElementById("join-group-form");
        const authUsernameInput = document.getElementById("join-username");
        const authGroupInput = document.getElementById("join-groupcode");
        const authRoleSelect = { value: "Alice" };
        const authCancelBtn = { style: { display: "none" } };
        const closeAuthModalBtn = document.getElementById("close-auth-modal");

        const tabJoinBtn = document.getElementById("tab-join-btn");
        const tabCreateBtn = document.getElementById("tab-create-btn");
        const tabBrowseBtn = document.getElementById("tab-browse-btn");
        const joinGroupForm = document.getElementById("join-group-form");
        const createGroupForm = document.getElementById("create-group-form");
        const browseGroupSection = document.getElementById("browse-group-section");
        const syncStatusBadge = document.getElementById("sync-status");
        
        // Auth0 elements
        const auth0LoginBtn = document.getElementById("auth0-login-btn");
        const auth0LogoutBtn = document.getElementById("auth0-logout-btn");
        const auth0ProfileDiv = document.getElementById("auth0-profile");
        const auth0UserAvatar = document.getElementById("auth0-user-avatar");
        
        // Transit
        const transitTitle = document.getElementById("transit-title");
        const transitSubtitle = document.getElementById("transit-subtitle");
        const transitStart = document.getElementById("transit-start");
        const transitEnd = document.getElementById("transit-end");
        const transitCriteria = document.getElementById("transit-criteria");
        const transitCriteriaContainer = document.getElementById("transit-criteria-container");
        const taxiTypeSelect = document.getElementById("taxi-type");
        const taxiTypeContainer = document.getElementById("taxi-type-container");
        const transitForm = document.getElementById("transit-form");
        const transitResultsBody = document.getElementById("transit-results-body");
        const transitCardTitle = document.getElementById("transit-card-title");
        
        // Places
        const placesSearch = document.getElementById("places-search");
        const placesCitySelect = document.getElementById("places-city-select");
        const placesGrid = document.getElementById("places-grid");
        const gpsBtn = document.getElementById("gps-discover-btn");
        const gpsStatusBar = document.getElementById("gps-status-bar");
        const gpsStatusText = document.getElementById("gps-status-text");
        const gpsRecHeader = document.getElementById("gps-recommendations-header");
        const gpsRecGrid = document.getElementById("gps-recommendations");
        const gpsPaginationContainer = document.getElementById("gps-pagination-container");

        // Expenses form
        const expenseForm = document.getElementById("expense-form");
        const expenseTitleInput = document.getElementById("expense-title");
        const expenseTypeSelect = document.getElementById("expense-type");
        const expenseCategoryInput = document.getElementById("expense-category");
        const expenseAmountInput = document.getElementById("expense-amount");
        const expenseCurrencySelect = document.getElementById("expense-currency");
        const expensePayerSelect = document.getElementById("expense-payer");
        const expenseConvertedText = document.getElementById("expense-converted-text");
        const expensesList = document.getElementById("expenses-list");
        const debtTableBody = document.getElementById("debt-table-body");

        // IC Cards
        const icPassengerSelect = document.getElementById("ic-passenger");
        const icCardSkin = document.getElementById("transit-card-skin");
        const icCardLogo = document.getElementById("ic-card-logo");
        const icCardHolder = document.getElementById("ic-card-holder");
        const icCardBalance = document.getElementById("ic-card-balance");
        const icCardNetwork = document.getElementById("ic-card-network");
        const icRechargeRow = document.getElementById("ic-recharge-row");
        const icTransitLogs = document.getElementById("ic-transit-logs");
        const icEstimatedFare = document.getElementById("ic-estimated-fare");
        const icTopupNeeded = document.getElementById("ic-topup-needed");

        // -------------------------------------------------------------------------
        // WALLET V2 HELPER FUNCTIONS
        // -------------------------------------------------------------------------

        // Get today as a trip day string (timezone-aware)
        function getTodayTripDay() {
            const tz = state.destination === "japan" ? "Asia/Tokyo" :
                       state.destination === "malaysia" ? "Asia/Kuala_Lumpur" : "Asia/Shanghai";
            const now = new Date();
            const opts = { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" };
            return new Intl.DateTimeFormat("en-CA", opts).format(now); // YYYY-MM-DD
        }

        // Render the day selector strip above the expense form
        function renderDaySelector() {
            const strip = document.getElementById("day-selector-strip");
            if (!strip) return;
            const today = getTodayTripDay();
            if (!state.selectedExpenseDay) state.selectedExpenseDay = today;

            // Build a range of 7 days around today (3 past, today, 3 future)
            const days = [];
            for (let i = -3; i <= 3; i++) {
                const d = new Date(today);
                d.setDate(d.getDate() + i);
                const iso = d.toISOString().split("T")[0];
                days.push(iso);
            }

            strip.innerHTML = days.map(iso => {
                const isToday = iso === today;
                const isSelected = iso === state.selectedExpenseDay;
                const dateObj = new Date(iso + "T12:00:00");
                const label = isToday ? "Today" : dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                return `<button type="button" class="day-pill${isSelected ? " active" : ""}${isToday ? " today" : ""}" data-day="${iso}">${label}</button>`;
            }).join("");

            strip.querySelectorAll(".day-pill").forEach(btn => {
                btn.addEventListener("click", () => {
                    state.selectedExpenseDay = btn.dataset.day;
                    renderDaySelector();
                });
            });
        }

        // Render the split panel for global expenses
        function renderSplitPanel(members) {
            const list = document.getElementById("split-members-list");
            const totalEl = document.getElementById("split-total-pct");
            const warnEl = document.getElementById("split-total-warn");
            if (!list) return;

            const n = members.length;
            const defaultPct = n > 0 ? Math.floor(100 / n) : 0;
            const remainder = n > 0 ? 100 - (defaultPct * n) : 0;

            list.innerHTML = members.map((m, idx) => {
                const pct = defaultPct + (idx === 0 ? remainder : 0);
                return `
                <div class="split-member-row" data-member="${m}">
                    <label class="split-member-label">
                        <input type="checkbox" class="split-checkbox" data-member="${m}" checked>
                        <span>${m}</span>
                    </label>
                    <div class="split-slider-group">
                        <input type="range" class="split-slider" data-member="${m}" min="0" max="100" step="1" value="${pct}">
                        <span class="split-pct-label" id="pct-${m}">${pct}%</span>
                        <input type="number" class="split-amount-input" data-member="${m}" min="0" step="0.01" placeholder="0.00">
                    </div>
                </div>`;
            }).join("");

            function recalcAmounts() {
                const totalAmount = parseFloat(expenseAmountInput.value) || 0;
                let sum = 0;
                list.querySelectorAll(".split-member-row").forEach(row => {
                    const cb = row.querySelector(".split-checkbox");
                    const slider = row.querySelector(".split-slider");
                    const amtInput = row.querySelector(".split-amount-input");
                    const pctLabel = row.querySelector(".split-pct-label");
                    const m = row.dataset.member;

                    if (cb.checked) {
                        slider.disabled = false;
                        amtInput.disabled = false;
                        const pct = parseInt(slider.value, 10);
                        sum += pct;
                        pctLabel.textContent = pct + "%";
                        
                        const amt = (totalAmount * pct / 100).toFixed(2);
                        if (document.activeElement !== amtInput) {
                            amtInput.value = parseFloat(amt) === 0 ? "" : amt;
                        }
                    } else {
                        slider.disabled = true;
                        amtInput.disabled = true;
                        slider.value = 0;
                        pctLabel.textContent = "0%";
                        amtInput.value = "";
                    }
                });
                totalEl.textContent = sum;
                warnEl.style.display = sum !== 100 ? "inline" : "none";
                totalEl.style.color = sum !== 100 ? "var(--error, #ef4444)" : "var(--success, #22c55e)";
            }

            function autoSplitChecked() {
                const checkedRows = [];
                list.querySelectorAll(".split-member-row").forEach(row => {
                    const cb = row.querySelector(".split-checkbox");
                    if (cb.checked) checkedRows.push(row);
                });

                const numChecked = checkedRows.length;
                if (numChecked > 0) {
                    const basePct = Math.floor(100 / numChecked);
                    const remainder = 100 - (basePct * numChecked);
                    checkedRows.forEach((row, idx) => {
                        const slider = row.querySelector(".split-slider");
                        slider.value = basePct + (idx === 0 ? remainder : 0);
                    });
                }
                recalcAmounts();
            }

            function distributeDifference(changedMember, targetPct) {
                const changedRow = list.querySelector(`.split-member-row[data-member="${changedMember}"]`);
                const changedSlider = changedRow.querySelector(".split-slider");
                changedSlider.value = targetPct;

                const otherCheckedRows = [];
                list.querySelectorAll(".split-member-row").forEach(row => {
                    const m = row.dataset.member;
                    const cb = row.querySelector(".split-checkbox");
                    if (cb.checked && m !== changedMember) {
                        otherCheckedRows.push(row);
                    }
                });

                const numOthers = otherCheckedRows.length;
                if (numOthers > 0) {
                    const remainingPct = 100 - targetPct;
                    const basePct = Math.floor(remainingPct / numOthers);
                    const remainder = remainingPct - (basePct * numOthers);
                    otherCheckedRows.forEach((row, idx) => {
                        const slider = row.querySelector(".split-slider");
                        slider.value = Math.max(0, basePct + (idx === 0 ? remainder : 0));
                    });
                }
                recalcAmounts();
            }

            list.querySelectorAll(".split-slider").forEach(slider => {
                slider.addEventListener("input", () => {
                    distributeDifference(slider.dataset.member, parseInt(slider.value, 10));
                });
            });

            list.querySelectorAll(".split-checkbox").forEach(cb => {
                cb.addEventListener("change", () => {
                    autoSplitChecked();
                });
            });

            list.querySelectorAll(".split-amount-input").forEach(amtInput => {
                amtInput.addEventListener("change", () => {
                    const totalAmount = parseFloat(expenseAmountInput.value) || 0;
                    if (totalAmount <= 0) return;
                    const typedAmt = parseFloat(amtInput.value) || 0;
                    let pct = Math.round((typedAmt / totalAmount) * 100);
                    pct = Math.max(0, Math.min(100, pct));
                    distributeDifference(amtInput.dataset.member, pct);
                });
                amtInput.addEventListener("focus", () => {
                    amtInput.select();
                });
            });

            if (expenseAmountInput && typeof expenseAmountInput.removeEventListener === "function") {
                expenseAmountInput.removeEventListener("input", recalcAmounts);
            }
            if (expenseAmountInput && typeof expenseAmountInput.addEventListener === "function") {
                expenseAmountInput.addEventListener("input", recalcAmounts);
            }

            autoSplitChecked();
        }

        // Read split panel values
        function getSplitConfig() {
            const list = document.getElementById("split-members-list");
            if (!list) return null;
            const splitAmong = [];
            const splitRatios = {};
            let total = 0;
            list.querySelectorAll(".split-member-row").forEach(row => {
                const m = row.dataset.member;
                const cb = row.querySelector(".split-checkbox");
                const slider = row.querySelector(".split-slider");
                if (cb && cb.checked) {
                    const pct = parseInt(slider.value, 10);
                    splitAmong.push(m);
                    splitRatios[m] = pct;
                    total += pct;
                }
            });
            if (total !== 100) return null; // invalid split
            return { splitAmong, splitRatios };
        }

        // Show/hide split vs payment panels based on expense type
        function updateExpenseTypePanels(type) {
            const splitPanel = document.getElementById("split-config-panel");
            const payPanel = document.getElementById("payment-method-panel");
            if (type === "global") {
                if (splitPanel) splitPanel.style.display = "block";
            } else {
                if (splitPanel) splitPanel.style.display = "none";
            }
            if (payPanel) payPanel.style.display = "block";
        }

        // Render cash balance tracker
        function renderCashTracker() {
            const list = document.getElementById("cash-tracker-list");
            const badge = document.getElementById("cash-tracker-currency-badge");
            if (!list) return;

            const currency = state.destination === "japan" ? "JPY" : state.destination === "malaysia" ? "MYR" : "CNY";
            const symbol = currency === "JPY" ? "¥" : currency === "MYR" ? "RM" : "¥";
            if (badge) badge.textContent = currency;

            const members = state.groupMembers && state.groupMembers.length > 0 ? state.groupMembers : ["Alice", "Bob", "Charlie"];

            // Calculate cash spent per member from cash-type expenses and settlements
            const cashSpent = {};
            members.forEach(m => { cashSpent[m] = 0; });
            state.expenses.forEach(exp => {
                if (exp.paymentMethod && exp.paymentMethod.type === "cash") {
                    const amountInLocal = exp.currency === currency ? exp.amount : (convertToHkd(exp.amount, exp.currency) / (FX_RATES[currency] || 1.0));
                    if (exp.isSettlement) {
                        if (cashSpent[exp.payer] !== undefined) cashSpent[exp.payer] += amountInLocal;
                        if (cashSpent[exp.recipient] !== undefined) cashSpent[exp.recipient] -= amountInLocal;
                    } else {
                        if (cashSpent[exp.payer] !== undefined) cashSpent[exp.payer] += exp.amount;
                    }
                }
            });

            list.innerHTML = members.map(m => {
                if (!state.cashBalances[m]) state.cashBalances[m] = { initial: 0, currency };
                const initial = state.cashBalances[m].initial || 0;
                const spent = cashSpent[m] || 0;
                const remaining = initial - spent;
                const isNeg = remaining < 0;
                return `
                <div class="cash-tracker-row">
                    <div class="cash-tracker-name">${m}</div>
                    <div class="cash-tracker-inputs">
                        <label class="cash-label">Initial ${symbol}</label>
                        <input type="number" class="cash-initial-input" data-member="${m}" min="0" step="100" value="${initial}" placeholder="0">
                    </div>
                    <div class="cash-tracker-balances">
                        <div class="cash-spent">Spent: ${symbol}${spent.toLocaleString()}</div>
                        <div class="cash-remaining ${isNeg ? 'cash-negative' : 'cash-positive'}">
                            Remaining: ${symbol}${remaining.toLocaleString()}
                            ${isNeg ? ' ⚠️' : ''}
                        </div>
                    </div>
                </div>`;
            }).join("");

            // Wire up initial balance inputs
            list.querySelectorAll(".cash-initial-input").forEach(input => {
                input.addEventListener("change", () => {
                    const m = input.dataset.member;
                    const currency = state.destination === "japan" ? "JPY" : state.destination === "malaysia" ? "MYR" : "CNY";
                    if (!state.cashBalances[m]) state.cashBalances[m] = { initial: 0, currency };
                    state.cashBalances[m].initial = parseFloat(input.value) || 0;
                    state.cashBalances[m].currency = currency;
                    saveCashBalancesToStorage();
                    renderCashTracker();
                });
            });

            // Call spending breakdown update
            updateSpendingBreakdown();
        }

        // Calculate and update spending breakdown
        function updateSpendingBreakdown() {
            const list = document.getElementById("spending-breakdown-list");
            if (!list) return;

            const currency = state.destination === "japan" ? "JPY" : state.destination === "malaysia" ? "MYR" : "CNY";
            const symbol = currency === "JPY" ? "¥" : currency === "MYR" ? "RM" : "¥";
            const rate = FX_RATES[currency] || 1.0;

            const formatAmount = (valHkd) => {
                const valLocal = valHkd / rate;
                const localFormatted = currency === "JPY" ? Math.round(valLocal).toLocaleString() : valLocal.toFixed(2);
                return `${symbol}${localFormatted} (HKD $${valHkd.toFixed(2)})`;
            };

            const members = state.groupMembers && state.groupMembers.length > 0 ? state.groupMembers : ["Alice", "Bob", "Charlie"];
            
            list.innerHTML = members.map(m => {
                let cashPaid = 0;
                let epayPaid = 0;
                let transitPaid = 0;
                let localTotal = 0;
                let globalShareTotal = 0;

                state.expenses.forEach(exp => {
                    if (exp.isSettlement) return;

                    const amtHkd = convertToHkd(exp.amount, exp.currency);

                    if (exp.payer === m) {
                        const pmType = exp.paymentMethod ? exp.paymentMethod.type : "cash";
                        if (pmType === "cash") cashPaid += amtHkd;
                        else if (pmType === "epayment") epayPaid += amtHkd;
                        else if (pmType === "transit") transitPaid += amtHkd;
                    }

                    if (exp.type === "local") {
                        if (exp.payer === m) {
                            localTotal += amtHkd;
                        }
                    } else if (exp.type === "global") {
                        if (exp.splitAmong && exp.splitAmong.includes(m)) {
                            const ratio = (exp.splitRatios && exp.splitRatios[m]) || 0;
                            globalShareTotal += amtHkd * (ratio / 100);
                        } else if (!exp.splitAmong) {
                            const numMembers = members.length || 1;
                            globalShareTotal += amtHkd / numMembers;
                        }
                    }
                });

                const totalPaidDirect = cashPaid + epayPaid + transitPaid;
                const theoreticalTotal = localTotal + globalShareTotal;

                return `
                <div class="spending-member-card" style="flex:1; min-width:200px; padding:0.5rem; background:var(--bg-primary); border:1px solid var(--border); border-radius:var(--radius-sm); font-size:0.75rem;">
                    <div style="font-weight:700; color:var(--text-primary); border-bottom:1px solid var(--border); padding-bottom:0.25rem; margin-bottom:0.4rem; display:flex; justify-content:space-between; flex-wrap:wrap; gap:0.2rem;">
                        <span>👤 ${m}</span>
                        <span style="color:var(--accent);">Theoretical: ${formatAmount(theoreticalTotal)}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.2rem; color:var(--text-secondary);">
                        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:0.2rem;">
                            <span>💵 Cash paid directly:</span>
                            <strong style="color:var(--text-primary);">${formatAmount(cashPaid)}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:0.2rem;">
                            <span>📱 ePayment paid directly:</span>
                            <strong style="color:var(--text-primary);">${formatAmount(epayPaid)}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:0.2rem;">
                            <span>🚇 Transit paid directly:</span>
                            <strong style="color:var(--text-primary);">${formatAmount(transitPaid)}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; border-top:1px dashed var(--border); padding-top:0.2rem; margin-top:0.25rem; font-weight:700; flex-wrap:wrap; gap:0.2rem;">
                            <span>💰 Total directly paid:</span>
                            <span style="color:var(--text-primary);">${formatAmount(totalPaidDirect)}</span>
                        </div>
                    </div>
                </div>`;
            }).join("");
            
            if (window.lucide) window.lucide.createIcons();
        }

        // Deduct cash balance for a payer (called on local cash expenses)
        function deductCashBalance(payer, amount, currency) {
            if (!state.cashBalances[payer]) state.cashBalances[payer] = { initial: 0, currency };
            // Cash is tracked by the render function (reads from expenses), no explicit deduction needed
            // Just re-render
            renderCashTracker();
        }


        // Theme Toggle
        const storedTheme = localStorage.getItem("theme") || "light";
        document.documentElement.setAttribute("data-theme", storedTheme);
        updateThemeIcon(storedTheme);
        themeToggleBtn.addEventListener("click", () => {
            const currentTheme = document.documentElement.getAttribute("data-theme");
            const newTheme = currentTheme === "dark" ? "light" : "dark";
            document.documentElement.setAttribute("data-theme", newTheme);
            localStorage.setItem("theme", newTheme);
            updateThemeIcon(newTheme);
        });

        function updateThemeIcon(theme) {
            if (themeToggleBtn) {
                if (theme === "dark") {
                    themeToggleBtn.innerHTML = '<i data-lucide="sun"></i>';
                } else {
                    themeToggleBtn.innerHTML = '<i data-lucide="moon"></i>';
                }
            }
            if (window.lucide) lucide.createIcons();
        }

        // SPA Tab switching
        const navItems = document.querySelectorAll(".nav-item");
        const tabContents = document.querySelectorAll(".tab-content");
        navItems.forEach(item => {
            item.addEventListener("click", () => {
                const targetTabId = item.getAttribute("data-tab");
                navItems.forEach(nav => nav.classList.remove("active"));
                tabContents.forEach(tab => tab.classList.remove("active"));
                item.classList.add("active");
                document.getElementById(targetTabId).classList.add("active");
            });
        });

        // Calendar Engine
        function generateCalendar() {
            const year = state.currentYear;
            const month = state.currentMonth;
            currentMonthYearLabel.textContent = `${monthNames[month]} ${year}`;
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            let calendarHTML = "<table><thead><tr><th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th></tr></thead><tbody><tr>";
            for (let i = 0; i < firstDay; i++) calendarHTML += "<td></td>";

            for (let day = 1; day <= daysInMonth; day++) {
                if ((day + firstDay - 1) % 7 === 0 && day !== 1) calendarHTML += "</tr><tr>";
                const dayActs = state.activities.filter(a => a.day === day).sort((a, b) => timeToMinutes(a.timeStart) - timeToMinutes(b.timeStart));
                let previewHTML = "";
                if (dayActs.length > 0) {
                    previewHTML = `<div class="calendar-activities-preview">`;
                    dayActs.slice(0, 2).forEach(act => {
                        const catClass = act.category ? `cat-${act.category.toLowerCase()}` : "cat-sights";
                        previewHTML += `<div class="activity-dot-preview ${catClass}" title="${act.timeStart} - ${act.title}">${act.title}</div>`;
                    });
                    if (dayActs.length > 2) previewHTML += `<div class="activity-dot-preview" style="background-color: var(--text-secondary)">+${dayActs.length - 2} more</div>`;
                    previewHTML += `</div>`;
                }
                const activeClass = state.selectedDay === day ? "active-day" : "";
                calendarHTML += `<td class="calendar-day ${activeClass}" data-day="${day}" ondragover="calendarDayDragOverHandler(event)" ondragleave="calendarDayDragLeaveHandler(event)" ondrop="calendarDayDropHandler(event, ${day})"><div class="day-number">${day}</div>${previewHTML}</td>`;
            }
            const totalCells = firstDay + daysInMonth;
            const remaining = (7 - (totalCells % 7)) % 7;
            for (let i = 0; i < remaining; i++) calendarHTML += "<td></td>";
            calendarHTML += "</tr></tbody></table>";
            calendarElement.innerHTML = calendarHTML;

            const days = document.querySelectorAll(".calendar-day");
            days.forEach((dayCell) => {
                dayCell.addEventListener("click", () => {
                    const day = Number(dayCell.getAttribute("data-day"));
                    selectDay(day);
                });
            });
            if (window.lucide) lucide.createIcons();
        }

        function selectDay(day) {
            state.selectedDay = day;
            const days = document.querySelectorAll(".calendar-day");
            days.forEach(d => {
                if (Number(d.getAttribute("data-day")) === day) d.classList.add("active-day");
                else d.classList.remove("active-day");
            });
            selectedDayLabel.textContent = `${monthNames[state.currentMonth]} ${day}, ${state.currentYear}`;
            addActivityBtn.removeAttribute("disabled");
            renderActivitiesList();
        }

        function renderActivitiesList() {
            if (state.selectedDay === null) {
                placeInfo.innerHTML = `<div class="empty-state"><i data-lucide="calendar-days" class="empty-icon"></i><p>Click on any date in the calendar to view, add, or edit your travel activities.</p></div>`;
                if (window.lucide) lucide.createIcons();
                return;
            }

            const dayActs = state.activities.filter(a => a.day === state.selectedDay).sort((a, b) => timeToMinutes(a.timeStart) - timeToMinutes(b.timeStart));

            // Calculate column positioning for overlapping activities (Google Calendar style)
            const positions = new Map(); // act.id -> { colIndex, totalCols }
            
            // Build overlapping sets
            const clusters = []; // array of arrays of activities
            dayActs.forEach(act => {
                const actStart = timeToMinutes(act.timeStart);
                const actEnd = act.timeEnd ? timeToMinutes(act.timeEnd) : (actStart + 30);
                
                // Find a cluster this activity overlaps with
                let placed = false;
                for (let cluster of clusters) {
                    const overlaps = cluster.some(cAct => {
                        const cStart = timeToMinutes(cAct.timeStart);
                        const cEnd = cAct.timeEnd ? timeToMinutes(cAct.timeEnd) : (cStart + 30);
                        return Math.max(actStart, cStart) < Math.min(actEnd, cEnd);
                    });
                    if (overlaps) {
                        cluster.push(act);
                        placed = true;
                        break;
                    }
                }
                if (!placed) {
                    clusters.push([act]);
                }
            });

            // For each cluster, assign columns
            clusters.forEach(cluster => {
                // Sort cluster by start time
                cluster.sort((a, b) => timeToMinutes(a.timeStart) - timeToMinutes(b.timeStart));
                
                const columns = []; // array of arrays representing columns of activities
                cluster.forEach(act => {
                    const actStart = timeToMinutes(act.timeStart);
                    
                    // Find the first column where this activity doesn't overlap with the last activity in that column
                    let colIndex = 0;
                    let placedInCol = false;
                    for (let i = 0; i < columns.length; i++) {
                        const col = columns[i];
                        const lastAct = col[col.length - 1];
                        const lastStart = timeToMinutes(lastAct.timeStart);
                        const lastEnd = lastAct.timeEnd ? timeToMinutes(lastAct.timeEnd) : (lastStart + 30);
                        
                        if (actStart >= lastEnd) {
                            col.push(act);
                            colIndex = i;
                            placedInCol = true;
                            break;
                        }
                    }
                    if (!placedInCol) {
                        columns.push([act]);
                        colIndex = columns.length - 1;
                    }
                    positions.set(act.id, { colIndex, totalCols: columns.length });
                });
                
                // Set the final totalCols for all activities in this cluster to be the number of columns in the cluster
                cluster.forEach(act => {
                    const pos = positions.get(act.id);
                    if (pos) {
                        pos.totalCols = columns.length;
                    }
                });
            });

            // Generate Left Column Time Labels (50px fixed width)
            let hourLabelsHtml = "";
            for (let h = 0; h < 24; h++) {
                const padH = String(h).padStart(2, '0');
                hourLabelsHtml += `
                    <div class="hour-label-row" style="top: ${h * 60}px;">
                        <span class="hour-label-text">${padH}:00</span>
                    </div>
                `;
            }

            // Generate Right Column Visual Hour Grid Lines (z-index: 1)
            let hourGridLinesHtml = "";
            for (let h = 0; h < 24; h++) {
                hourGridLinesHtml += `
                    <div class="hour-grid-line" style="top: ${h * 60}px;"></div>
                `;
            }

            // Beautiful modern pastel background colors dictionary
            const categoryColors = {
                Food: { bg: "#FEF9C3", border: "#CA8A04", text: "#713F12" }, // Pastel Yellow
                Sights: { bg: "#E0F2FE", border: "#0EA5E9", text: "#0C4A6E" }, // Pastel Blue
                Shopping: { bg: "#F3E8FF", border: "#A855F7", text: "#581C87" }, // Pastel Purple
                Entertainment: { bg: "#DCFCE7", border: "#22C55E", text: "#14532D" } // Pastel Green
            };
            const defaultColors = { bg: "#E0F2FE", border: "#0EA5E9", text: "#0C4A6E" };

            // Generate Draggable Visual Activity Blocks (z-index: 10)
            let blocksHtml = "";
            dayActs.forEach(act => {
                const catClass = act.category ? `cat-${act.category.toLowerCase()}` : "cat-sights";
                const colors = categoryColors[act.category] || defaultColors;

                const startM = timeToMinutes(act.timeStart);
                const [startHour, startMinute] = act.timeStart.split(":").map(Number);
                const top = (startHour * 60) + startMinute;

                // Math & Absolute Positioning with Minimum Height Fix
                let durationInMinutes = 30; // fallback default height if end time not set
                if (act.timeEnd) {
                    const endM = timeToMinutes(act.timeEnd);
                    const dur = endM - startM;
                    if (dur > 0) {
                        durationInMinutes = dur;
                    }
                }
                const height = Math.max(durationInMinutes, 25); // Enforce at least 25px for readability of short activities

                const reminderIcon = act.reminder ? `<i data-lucide="bell" style="width: 10px; height: 10px; color: #EF4444; margin-left: 2px;"></i>` : "";
                const isShort = height <= 45;
                const timeText = act.timeEnd ? `${act.timeStart} - ${act.timeEnd}` : act.timeStart;

                let blockContent = "";
                if (isShort) {
                    // Google Calendar style compact layout for short events
                    blockContent = `
                        <div class="time-block-compact" style="display: flex; align-items: center; justify-content: space-between; height: 100%; width: 100%;">
                            <div class="time-block-title" style="color: ${colors.text}; font-size: 0.7rem; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 4px;">
                                ${act.title}
                            </div>
                            <div class="time-block-time" style="color: ${colors.text}; font-size: 0.6rem; font-weight: 700; white-space: nowrap; opacity: 0.85; margin-right: 32px;">
                                ${act.timeStart}
                            </div>
                        </div>
                        <div class="time-block-actions" style="top: 2px; right: 2px;">
                            <button class="time-block-btn" style="color: ${colors.text}; padding: 0;" onclick="event.stopPropagation(); editActivityHandler('${act.id}')">
                                <i data-lucide="edit-3" style="width: 10px; height: 10px;"></i>
                            </button>
                            <button class="time-block-btn" style="color: ${colors.text}; padding: 0;" onclick="event.stopPropagation(); deleteActivityHandler('${act.id}')">
                                <i data-lucide="trash-2" style="width: 10px; height: 10px;"></i>
                            </button>
                        </div>
                    `;
                } else {
                    // Regular full height event layout
                    blockContent = `
                        <div class="time-block-title" style="color: ${colors.text}; font-weight: 800; font-size: 0.75rem;">${act.title}</div>
                        <div class="time-block-time" style="color: ${colors.text}; font-size: 0.65rem; font-weight: 700; display: flex; align-items: center; gap: 0.2rem;">
                            <i data-lucide="clock" style="width: 10px; height: 10px; color: ${colors.text};"></i>
                            <span>${timeText}</span>
                            ${reminderIcon}
                        </div>
                        ${act.location ? `<div class="time-block-loc" style="color: ${colors.text}; font-size: 0.65rem; opacity: 0.95;">📍 ${act.location.split(",")[0]}</div>` : ""}
                        <div class="time-block-actions">
                            <button class="time-block-btn" style="color: ${colors.text}" onclick="event.stopPropagation(); editActivityHandler('${act.id}')">
                                <i data-lucide="edit-3"></i>
                            </button>
                            <button class="time-block-btn" style="color: ${colors.text}" onclick="event.stopPropagation(); deleteActivityHandler('${act.id}')">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    `;
                }

                const pos = positions.get(act.id) || { colIndex: 0, totalCols: 1 };
                const colWidth = (100 - 2) / pos.totalCols;
                const leftPercent = 1 + (pos.colIndex * colWidth);
                const blockStyleWidth = `left: ${leftPercent}%; width: ${colWidth - 1}%; right: auto;`;

                blocksHtml += `
                    <div class="time-block-activity ${catClass}" 
                         style="top: ${top}px; height: ${height}px; background-color: ${colors.bg}; border-left: 4px solid ${colors.border}; border-top: 1px solid rgba(0,0,0,0.05); border-right: 1px solid rgba(0,0,0,0.05); border-bottom: 1px solid rgba(0,0,0,0.05); color: ${colors.text}; ${isShort ? 'padding: 2px 6px; justify-content: center;' : ''} ${blockStyleWidth}" 
                         draggable="true" 
                         data-id="${act.id}"
                         ondragstart="activityDragStartHandler(event)">
                        ${blockContent}
                    </div>
                `;
            });

            // Assemble Full Grid using Flexbox Two-Column Layout
            placeInfo.innerHTML = `
                <div class="calendar-day-view" id="day-grid-viewport">
                    <div class="day-view-flex-container">
                        <!-- Left Column (Time Labels) -->
                        <div class="day-view-time-labels">
                            ${hourLabelsHtml}
                        </div>
                        <!-- Right Column (Events Board) -->
                        <div class="day-view-events-board" id="day-grid-container"
                             ondragover="gridDragOverHandler(event)" 
                             ondragleave="gridDragLeaveHandler(event)"
                             ondrop="gridDropHandler(event)">
                            ${hourGridLinesHtml}
                            ${blocksHtml}
                        </div>
                    </div>
                </div>
            `;

            // Auto Scroll Viewport to first activity (if exists) or 08:00
            const viewport = document.getElementById("day-grid-viewport");
            if (viewport) {
                if (dayActs.length > 0) {
                    const firstStart = timeToMinutes(dayActs[0].timeStart);
                    viewport.scrollTop = Math.max(0, firstStart - 100);
                } else {
                    viewport.scrollTop = 480; // Scroll to 08:00
                }
            }

            if (window.lucide) lucide.createIcons();
        }

        window.editActivityHandler = function(id) {
            const act = state.activities.find(a => a.id === id);
            if (act) openModal(state.selectedDay, act);
        };

        window.deleteActivityHandler = function(id) {
            if (confirm("Are you sure you want to delete this activity?")) {
                state.activities = state.activities.filter(a => a.id !== id);
                saveActivitiesToStorage();
                generateCalendar();
                renderActivitiesList();
            }
        };

        // DRAG AND DROP HANDLERS FOR GOOGLE CALENDAR GRID & CALENDAR SWAPPING
        window.activityDragStartHandler = function(e) {
            e.dataTransfer.setData("text/plain", e.target.getAttribute("data-id"));
            e.dataTransfer.effectAllowed = "move";
        };

        window.gridDragOverHandler = function(e) {
            e.preventDefault();
            const container = document.getElementById("day-grid-container");
            if (container) container.classList.add("drag-over-grid");
        };

        window.gridDragLeaveHandler = function(e) {
            e.preventDefault();
            const container = document.getElementById("day-grid-container");
            if (container) container.classList.remove("drag-over-grid");
        };

        window.gridDropHandler = function(e) {
            e.preventDefault();
            const container = document.getElementById("day-grid-container");
            if (container) container.classList.remove("drag-over-grid");

            const actId = e.dataTransfer.getData("text/plain");
            const act = state.activities.find(a => a.id === actId);
            if (!act) return;

            const rect = e.currentTarget.getBoundingClientRect();
            const offsetY = e.clientY - rect.top;

            // 1px = 1 min
            let dropMinutes = offsetY;
            // Snap to 15-minute intervals
            dropMinutes = Math.round(dropMinutes / 15) * 15;
            dropMinutes = Math.max(0, Math.min(1440, dropMinutes));

            const duration = act.timeEnd ? (timeToMinutes(act.timeEnd) - timeToMinutes(act.timeStart)) : 30;
            let newStart = dropMinutes;
            if (newStart + duration > 1440) {
                newStart = 1440 - duration;
            }

            const newStartTimeStr = minutesToTime(newStart);
            const newEndTimeStr = minutesToTime(newStart + duration);

            // Time conflict check
            const conflict = hasTimeConflict(state.activities, act.day, newStartTimeStr, act.timeEnd ? newEndTimeStr : "", act.id);
            if (conflict) {
                alert(`Time Conflict: Shifting "${act.title}" overlaps with "${conflict.title}". Drop rejected.`);
                return;
            }

            act.timeStart = newStartTimeStr;
            if (act.timeEnd) {
                act.timeEnd = newEndTimeStr;
            }

            saveActivitiesToStorage();
            generateCalendar();
            renderActivitiesList();
        };

        window.calendarDayDragOverHandler = function(e) {
            e.preventDefault();
            e.currentTarget.classList.add("drag-over-day");
        };

        window.calendarDayDragLeaveHandler = function(e) {
            e.preventDefault();
            e.currentTarget.classList.remove("drag-over-day");
        };

        window.calendarDayDropHandler = function(e, targetDay) {
            e.preventDefault();
            e.currentTarget.classList.remove("drag-over-day");

            const actId = e.dataTransfer.getData("text/plain");
            const act = state.activities.find(a => a.id === actId);
            if (!act) return;

            // Time conflict check on target day
            const conflict = hasTimeConflict(state.activities, targetDay, act.timeStart, act.timeEnd, act.id);
            if (conflict) {
                alert(`Time Conflict on target day: Overlaps with "${conflict.title}". Swapping date rejected.`);
                return;
            }

            act.day = targetDay;

            saveActivitiesToStorage();
            generateCalendar();
            selectDay(targetDay);
        };

        // Modals
        function openModal(day, activity = null, prefill = null) {
            modalDayInput.value = day;
            activityForm.reset();
            locationSuggestions.style.display = "none";
            locationSuggestions.innerHTML = "";
            if (activity) {
                modalTitle.textContent = "Edit Activity";
                modalActivityIdInput.value = activity.id;
                activityTitleInput.value = activity.title;
                activityCategorySelect.value = activity.category || "Sights";
                activityStartInput.value = activity.timeStart;
                activityEndInput.value = activity.timeEnd;
                activityLocationInput.value = activity.location || "";
                activityReminderCheckbox.checked = activity.reminder || false;
                activityReminderOffsetSelect.value = activity.reminderOffset !== undefined ? activity.reminderOffset : "30";
                if (activity.reminder) reminderTimeContainer.classList.add("show");
                else reminderTimeContainer.classList.remove("show");
                updateModalPlacePreview(activity.location);
            } else {
                modalTitle.textContent = "Add Activity";
                modalActivityIdInput.value = "";
                activityCategorySelect.value = "Sights";
                reminderTimeContainer.classList.remove("show");
                if (prefill) {
                    activityTitleInput.value = prefill.title || "";
                    activityCategorySelect.value = prefill.category || "Sights";
                    activityLocationInput.value = prefill.location || "";
                    activityStartInput.value = prefill.timeStart || "";
                    activityEndInput.value = prefill.timeEnd || "";
                    updateModalPlacePreview(prefill.location);
                } else {
                    updateModalPlacePreview("");
                }
            }
            activityModal.classList.add("open");
        }

        function closeModal() {
            activityModal.classList.remove("open");
            locationSuggestions.style.display = "none";
            locationSuggestions.innerHTML = "";
            updateModalPlacePreview("");
        }

        function updateModalPlacePreview(loc) {
            const previewDiv = document.getElementById("activity-place-preview");
            if (!previewDiv) return;
            
            if (!loc) {
                previewDiv.style.display = "none";
                previewDiv.innerHTML = "";
                return;
            }

            const targetCountry = state.destination === "japan" ? "Japan" : (state.destination === "china" ? "China" : "Malaysia");
            const cleanLoc = loc.toLowerCase().trim();
            const matchedPlace = placesDatabase.find(p => {
                if (p.country !== targetCountry) return false;
                const name = p.name.toLowerCase();
                const localName = p.localTitle ? p.localTitle.toLowerCase() : "";
                return cleanLoc.includes(name) || name.includes(cleanLoc) || (localName && (cleanLoc.includes(localName) || localName.includes(cleanLoc)));
            });

            if (matchedPlace && matchedPlace.imageUrl) {
                let reviewsHtml = "";
                if (matchedPlace.reviews && matchedPlace.reviews.length > 0) {
                    const reviewItems = matchedPlace.reviews.map(r => `
                        <div class="place-preview-review-item">"${r}"</div>
                    `).join("");
                    reviewsHtml = `
                        <div class="place-preview-reviews-container">
                            <strong style="font-size: 0.70rem; color: var(--text-primary);">What travellers say:</strong>
                            ${reviewItems}
                        </div>
                    `;
                }
                
                previewDiv.innerHTML = `
                    <div class="place-preview-title">📍 ${matchedPlace.name}</div>
                    <div class="place-preview-image-wrapper">
                        <img src="${matchedPlace.imageUrl}" referrerpolicy="no-referrer" alt="${matchedPlace.name}" onerror="this.parentElement.style.display='none'">
                    </div>
                    ${reviewsHtml}
                `;
                previewDiv.style.display = "flex";
            } else {
                previewDiv.style.display = "none";
                previewDiv.innerHTML = "";
            }
        }
        addActivityBtn.addEventListener("click", () => { if (state.selectedDay !== null) openModal(state.selectedDay); });
        closeModalBtn.addEventListener("click", closeModal);
        cancelModalBtn.addEventListener("click", closeModal);
        activityReminderCheckbox.addEventListener("change", () => {
            if (activityReminderCheckbox.checked) reminderTimeContainer.classList.add("show");
            else reminderTimeContainer.classList.remove("show");
        });

        activityForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const day = Number(modalDayInput.value);
            const id = modalActivityIdInput.value || `act-${Date.now()}`;
            const category = activityCategorySelect.value || "Sights";
            let title = activityTitleInput.value.trim();
            if (!title) {
                title = category;
            }
            const start = activityStartInput.value;
            const end = activityEndInput.value;
            const location = activityLocationInput.value;
            const reminder = activityReminderCheckbox.checked;
            const reminderOffset = Number(activityReminderOffsetSelect.value);

            if (!validateActivityInput(title)) { alert("Please enter a valid title."); return; }
            if (!validateTimeSlotInput(start, end)) { alert("Start time must be before end time."); return; }
            
            const conflict = hasTimeConflict(state.activities, day, start, end, modalActivityIdInput.value ? id : null);
            if (conflict) { alert(`Time Conflict with "${conflict.title}"!`); return; }

            const newAct = { id, day, title, category, timeStart: start, timeEnd: end, location, reminder, reminderOffset };
            if (modalActivityIdInput.value) {
                const idx = state.activities.findIndex(a => a.id === id);
                if (idx !== -1) state.activities[idx] = newAct;
            } else state.activities.push(newAct);

            saveActivitiesToStorage();
            closeModal();
            generateCalendar();
            renderActivitiesList();
        });

        // Smart location word-matching autocomplete
        activityLocationInput.addEventListener("input", (e) => {
            const val = e.target.value.toLowerCase().trim();
            updateModalPlacePreview(e.target.value); // Dynamic place details preview updating
            if (!val) {
                locationSuggestions.style.display = "none";
                locationSuggestions.innerHTML = "";
                return;
            }

            const targetCountry = state.destination === "japan" ? "Japan" : (state.destination === "china" ? "China" : "Malaysia");
            const matches = placesDatabase.filter(p => {
                if (p.country !== targetCountry) return false;
                return (p.name && p.name.toLowerCase().includes(val)) ||
                       (p.localTitle && p.localTitle.toLowerCase().includes(val)) ||
                       (p.street && p.street.toLowerCase().includes(val));
            });

            if (matches.length === 0) {
                locationSuggestions.style.display = "none";
                locationSuggestions.innerHTML = "";
                return;
            }

            locationSuggestions.innerHTML = "";
            locationSuggestions.style.display = "block";

            matches.slice(0, 5).forEach(match => {
                const item = document.createElement("div");
                item.className = "suggestion-item";
                item.innerHTML = `
                    <span class="suggestion-name">${match.name}</span>
                    <span class="suggestion-street">📍 ${match.city}, ${match.street}</span>
                `;
                item.addEventListener("click", () => {
                    activityLocationInput.value = `${match.name}, ${match.street}`;
                    activityCategorySelect.value = match.category || "Sights";
                    if (!activityTitleInput.value.trim()) {
                        activityTitleInput.value = match.name;
                    }
                    locationSuggestions.style.display = "none";
                    locationSuggestions.innerHTML = "";
                    updateModalPlacePreview(activityLocationInput.value); // Dynamic place details preview updating
                });
                locationSuggestions.appendChild(item);
            });
        });

        document.addEventListener("click", (e) => {
            if (e.target !== activityLocationInput && e.target !== locationSuggestions) {
                locationSuggestions.style.display = "none";
            }
        });



        // Reminders
        function showToast(title, body) {
            toastTitle.textContent = title;
            toastBody.textContent = body;
            reminderToast.classList.add("show");
            setTimeout(() => { reminderToast.classList.remove("show"); }, 8000);
        }
        closeToastBtn.addEventListener("click", () => { reminderToast.classList.remove("show"); });

        function getDestinationNow() {
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
            let offset = 8;
            if (state.destination === "japan") {
                offset = 9;
            }
            return new Date(utc + (3600000 * offset));
        }

        function initializeFiredReminders() {
            const destNow = getDestinationNow();
            state.activities.forEach(act => {
                if (!act.reminder) return;
                const [sh, sm] = act.timeStart.split(":").map(Number);
                const actTime = new Date(destNow.getFullYear(), destNow.getMonth(), act.day, sh, sm, 0);
                const alertTime = new Date(actTime.getTime() - act.reminderOffset * 60 * 1000);
                
                if (destNow >= alertTime) {
                    state.firedReminders.add(act.id);
                }
            });
        }

        function checkReminders() {
            const destNow = getDestinationNow();
            state.activities.forEach(act => {
                if (!act.reminder || state.firedReminders.has(act.id)) return;
                if (state.currentMonth === destNow.getMonth() && state.currentYear === destNow.getFullYear()) {
                    const [sh, sm] = act.timeStart.split(":").map(Number);
                    const actTime = new Date(destNow.getFullYear(), destNow.getMonth(), act.day, sh, sm, 0);
                    const alertTime = new Date(actTime.getTime() - act.reminderOffset * 60 * 1000);
                    
                    if (destNow >= alertTime && destNow < new Date(actTime.getTime() + 10 * 60 * 1000)) {
                        state.firedReminders.add(act.id);
                        showToast(`Reminder: ${act.title}`, `Starts at ${act.timeStart}!`);
                        alert(`⏰ Reminder: "${act.title}" starts at ${act.timeStart}!`);
                    }
                }
            });
        }
        setInterval(checkReminders, 5000);

        // Destination updates
        destSelect.addEventListener("change", (e) => {
            state.destination = e.target.value;
            localStorage.setItem("travelDestination", state.destination);
            updateDestinationUI();
            saveICCardsToStorage();
        });

        // -------------------------------------------------------------------------
        // CALENDAR MONTH NAVIGATION
        // -------------------------------------------------------------------------
        document.getElementById("prev-month").addEventListener("click", () => {
            state.currentMonth--;
            if (state.currentMonth < 0) {
                state.currentMonth = 11;
                state.currentYear--;
            }
            generateCalendar();
        });
        
        document.getElementById("next-month").addEventListener("click", () => {
            state.currentMonth++;
            if (state.currentMonth > 11) {
                state.currentMonth = 0;
                state.currentYear++;
            }
            generateCalendar();
        });

        // -------------------------------------------------------------------------
        // PROFILE SIGNUP / LOGIN / ACCOUNT MANAGEMENT
        // -------------------------------------------------------------------------
        let authModalRequired = false;

        function openAuthModal(required = false) {
            authModalRequired = required;
            
            const joinUserEl = document.getElementById("join-username");
            const createUserEl = document.getElementById("create-username");
            const browseUserEl = document.getElementById("browse-username");
            const joinGroupEl = document.getElementById("join-groupcode");
            
            const userVal = state.activeUser === "Guest" ? "" : (state.activeUser || "");
            const groupVal = state.groupCode === "TRIP-2026" ? "" : (state.groupCode || "");

            if (joinUserEl) joinUserEl.value = userVal;
            if (createUserEl) createUserEl.value = userVal;
            if (browseUserEl) browseUserEl.value = userVal;
            if (joinGroupEl) joinGroupEl.value = groupVal;

            switchAuthTab("join");
            authModal.classList.add("open");
        }

        function closeAuthModal() {
            authModal.classList.remove("open");
        }

        // Tab Switching Logic
        function switchAuthTab(activeTab) {
            if (!tabJoinBtn || !tabCreateBtn || !tabBrowseBtn) return;
            
            tabJoinBtn.classList.remove("active");
            tabCreateBtn.classList.remove("active");
            tabBrowseBtn.classList.remove("active");
            
            tabJoinBtn.style.borderBottomColor = "transparent";
            tabCreateBtn.style.borderBottomColor = "transparent";
            tabBrowseBtn.style.borderBottomColor = "transparent";

            tabJoinBtn.style.color = "var(--text-secondary)";
            tabCreateBtn.style.color = "var(--text-secondary)";
            tabBrowseBtn.style.color = "var(--text-secondary)";

            joinGroupForm.style.display = "none";
            createGroupForm.style.display = "none";
            browseGroupSection.style.display = "none";

            if (activeTab === "join") {
                tabJoinBtn.classList.add("active");
                tabJoinBtn.style.borderBottomColor = "var(--accent)";
                tabJoinBtn.style.color = "var(--accent)";
                joinGroupForm.style.display = "block";
            } else if (activeTab === "create") {
                tabCreateBtn.classList.add("active");
                tabCreateBtn.style.borderBottomColor = "var(--accent)";
                tabCreateBtn.style.color = "var(--accent)";
                createGroupForm.style.display = "block";
            } else if (activeTab === "browse") {
                tabBrowseBtn.classList.add("active");
                tabBrowseBtn.style.borderBottomColor = "var(--accent)";
                tabBrowseBtn.style.color = "var(--accent)";
                browseGroupSection.style.display = "flex";
                loadBrowseNetworksList();
            }
        }

        if (tabJoinBtn) tabJoinBtn.addEventListener("click", () => switchAuthTab("join"));
        if (tabCreateBtn) tabCreateBtn.addEventListener("click", () => switchAuthTab("create"));
        if (tabBrowseBtn) tabBrowseBtn.addEventListener("click", () => switchAuthTab("browse"));
        if (closeAuthModalBtn) {
            closeAuthModalBtn.addEventListener("click", () => {
                closeAuthModal();
            });
        }

        // Join Existing Group Submit
        joinGroupForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("join-username").value.trim();
            const groupCode = document.getElementById("join-groupcode").value.trim();
            const password = document.getElementById("join-password").value;

            if (!username || !groupCode) {
                showToast("Auth Error", "Please fill in all fields.");
                return;
            }

            if (!state.firebaseUser || !db) {
                showToast("Auth Error", "Please login with Google first.");
                return;
            }

            showToast("Sync Status", "Entering network...");

            try {
                const docRef = doc(db, "trip_networks", groupCode);
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists()) {
                    showToast("Auth Error", `Group "${groupCode}" does not exist. Create it instead!`);
                    return;
                }

                const data = docSnap.data();
                const isPrivate = data.password && data.password.trim().length > 0;
                
                if (isPrivate && data.password !== password) {
                    showToast("Auth Error", "Incorrect group password.");
                    return;
                }

                // Add member to group if not already present
                if (!data.members.includes(state.firebaseUser.uid)) {
                    await updateDoc(docRef, {
                        members: arrayUnion(state.firebaseUser.uid),
                        memberNames: arrayUnion(username)
                    });
                }

                state.activeUser = username;
                state.groupCode = groupCode;
                state.mappedRole = "Alice";
                state.activeGroupId = groupCode;

                localStorage.setItem("travelActiveUser", username);
                localStorage.setItem("travelGroupCode", groupCode);
                localStorage.setItem("travelMappedRole", state.mappedRole);
                localStorage.setItem("travelActiveGroupId", groupCode);

                updateProfileUI();
                await loadUserNetworks(groupCode);
                closeAuthModal();
                showToast("Success", `Joined Group ${groupCode}!`);
            } catch (err) {
                console.error("Join Group Error:", err);
                showToast("Error", `Failed to join: ${err.message}`);
            }
        });

        // Create New Group Submit
        createGroupForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("create-username").value.trim();
            const groupCode = document.getElementById("create-groupcode").value.trim();
            const setPassword = document.getElementById("create-password").value;
            const isPublic = document.getElementById("create-public").checked;

            if (!username || !groupCode || (!isPublic && !setPassword)) {
                showToast("Auth Error", "Please fill in all fields.");
                return;
            }

            if (!state.firebaseUser || !db) {
                showToast("Auth Error", "Please login with Google first.");
                return;
            }

            showToast("Sync Status", "Creating network...");

            try {
                const docRef = doc(db, "trip_networks", groupCode);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    showToast("Auth Error", `Group "${groupCode}" already exists. Try joining it.`);
                    return;
                }

                const destinationVal = document.getElementById("create-destination").value || "japan";
                const passwordVal = isPublic ? "" : setPassword;
                const newNetwork = {
                    owner: state.firebaseUser.uid,
                    ownerName: username,
                    password: passwordVal,
                    destination: destinationVal,
                    members: [state.firebaseUser.uid],
                    memberNames: [username],
                    activities: [],
                    expenses: [],
                    icCards: {}
                };

                await setDoc(docRef, newNetwork);

                // Set local state
                state.activeUser = username;
                state.groupCode = groupCode;
                state.mappedRole = "Alice";
                state.activeGroupId = groupCode;

                localStorage.setItem("travelActiveUser", username);
                localStorage.setItem("travelGroupCode", groupCode);
                localStorage.setItem("travelMappedRole", state.mappedRole);
                localStorage.setItem("travelActiveGroupId", groupCode);

                // Re-initialize group local storage partitioned keys to be completely empty
                localStorage.setItem(`travelActivities_${groupCode}`, JSON.stringify([]));
                localStorage.setItem(`travelExpenses_${groupCode}`, JSON.stringify([]));
                state.activities = [];
                state.expenses = [];
                resetICCards();
                saveICCardsToStorage();

                updateProfileUI();
                await loadUserNetworks(groupCode);
                closeAuthModal();
                showToast("Success", `Created Group ${groupCode}!`);
            } catch (err) {
                console.error("Create Group Error:", err);
                showToast("Error", `Failed to create: ${err.message}`);
            }
        });

        // Dynamic Directory Browsing list loading
        let selectedBrowseGroup = null;

        async function loadBrowseNetworksList() {
            const listContainer = document.getElementById("network-group-list");
            if (!listContainer || !db) return;

            listContainer.innerHTML = '<div style="font-size: 0.75rem; color: var(--text-secondary); text-align: center; padding: 1rem;">Loading groups directory...</div>';
            
            try {
                const q = query(collection(db, "trip_networks"));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    listContainer.innerHTML = '<div style="font-size: 0.75rem; color: var(--text-secondary); text-align: center; padding: 1rem;">No networks registered. Be the first to create one!</div>';
                    return;
                }

                listContainer.innerHTML = "";
                
                querySnapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const name = docSnap.id;
                    const isPrivate = data.password && data.password.trim().length > 0;
                    
                    const row = document.createElement("div");
                    row.className = "network-row";
                    row.style.display = "flex";
                    row.style.justifyContent = "space-between";
                    row.style.alignItems = "center";
                    row.style.padding = "0.55rem 0.65rem";
                    row.style.border = "1px solid var(--border)";
                    row.style.borderRadius = "var(--radius-sm)";
                    row.style.backgroundColor = "var(--bg-card)";
                    row.style.cursor = "pointer";
                    row.style.transition = "var(--transition)";

                    const info = document.createElement("div");
                    info.style.display = "flex";
                    info.style.flexDirection = "column";
                    info.style.gap = "0.15rem";

                    const title = document.createElement("span");
                    title.textContent = name;
                    title.style.fontWeight = "800";
                    title.style.fontSize = "0.8rem";
                    title.style.color = "var(--text-primary)";
                    info.appendChild(title);

                    const subtitle = document.createElement("span");
                    const creatorLabel = data.ownerName ? ` | Creator: ${data.ownerName}` : "";
                    let countryLabel = "";
                    if (data.destination) {
                        const d = data.destination.toLowerCase();
                        countryLabel = ` | ${d === "japan" ? "JP" : (d === "china" ? "CN" : "ML")}`;
                    }
                    subtitle.textContent = `${data.members ? data.members.length : 1} Members${creatorLabel}${countryLabel}`;
                    subtitle.style.fontSize = "0.65rem";
                    subtitle.style.color = "var(--text-secondary)";
                    info.appendChild(subtitle);

                    row.appendChild(info);

                    const rightActions = document.createElement("div");
                    rightActions.style.display = "flex";
                    rightActions.style.alignItems = "center";
                    rightActions.style.gap = "0.4rem";

                    const badge = document.createElement("span");
                    badge.style.fontSize = "0.65rem";
                    badge.style.padding = "0.15rem 0.4rem";
                    badge.style.borderRadius = "3px";
                    badge.style.fontWeight = "800";

                    if (isPrivate) {
                        badge.innerHTML = '<i data-lucide="lock" style="width:10px; height:10px; display:inline-block; vertical-align:middle; margin-right:2px;"></i> Private';
                        badge.style.backgroundColor = "var(--border)";
                        badge.style.color = "var(--text-secondary)";
                    } else {
                        badge.innerHTML = "Public";
                        badge.style.backgroundColor = "rgba(16, 185, 129, 0.1)";
                        badge.style.color = "#10b981";
                    }
                    rightActions.appendChild(badge);

                    const isOwner = state.firebaseUser && data.owner === state.firebaseUser.uid;
                    if (isOwner) {
                        const deleteBtn = document.createElement("button");
                        deleteBtn.innerHTML = '<i data-lucide="trash-2" style="width:12px; height:12px; color:var(--danger);"></i>';
                        deleteBtn.style.background = "none";
                        deleteBtn.style.border = "none";
                        deleteBtn.style.cursor = "pointer";
                        deleteBtn.style.padding = "0.2rem";
                        deleteBtn.title = "Delete Group Network";

                        deleteBtn.addEventListener("click", async (e) => {
                            e.stopPropagation();
                            if (confirm(`Are you sure you want to permanently delete the group "${name}"? This action cannot be undone.`)) {
                                try {
                                    showToast("Deleting", "Deleting network...");
                                    await deleteDoc(doc(db, "trip_networks", name));
                                    showToast("Success", `Group "${name}" deleted successfully.`);
                                    
                                    if (state.activeGroupId === name) {
                                        localStorage.removeItem("travelActiveGroupId");
                                        localStorage.removeItem("travelGroupCode");
                                        state.activeGroupId = "";
                                        state.groupCode = "";
                                        await loadUserNetworks();
                                        openAuthModal(true);
                                    } else {
                                        await loadBrowseNetworksList();
                                    }
                                } catch (err) {
                                    console.error("Delete Group Error:", err);
                                    showToast("Error", `Failed to delete group: ${err.message}`);
                                }
                            }
                        });
                        rightActions.appendChild(deleteBtn);
                    }

                    row.appendChild(rightActions);

                    row.addEventListener("click", () => {
                        Array.from(listContainer.children).forEach(child => {
                            child.style.borderColor = "var(--border)";
                        });
                        row.style.borderColor = "var(--accent)";
                        
                        selectedBrowseGroup = name;
                        const joinForm = document.getElementById("browse-join-form");
                        const selectedLabel = document.getElementById("selected-browse-group-label");
                        const pwdContainer = document.getElementById("browse-password-container");
                        const memberStatus = document.getElementById("browse-member-status");
                        const submitBtn = document.getElementById("browse-submit-btn");
                        
                        selectedLabel.textContent = name;
                        joinForm.style.display = "block";
                        
                        const isMember = state.firebaseUser && data.members && data.members.includes(state.firebaseUser.uid);
                        if (isMember) {
                            if (memberStatus) {
                                memberStatus.textContent = "You have joined this group already.";
                                memberStatus.style.display = "block";
                            }
                            pwdContainer.style.display = "none";
                            document.getElementById("browse-password").required = false;
                            if (submitBtn) submitBtn.textContent = "Enter Active Group";
                        } else {
                            if (memberStatus) memberStatus.style.display = "none";
                            if (submitBtn) submitBtn.textContent = "Join Selected Group";
                            if (isPrivate) {
                                pwdContainer.style.display = "block";
                                document.getElementById("browse-password").required = true;
                            } else {
                                pwdContainer.style.display = "none";
                                document.getElementById("browse-password").required = false;
                            }
                        }
                    });

                    listContainer.appendChild(row);
                });
                lucide.createIcons();
            } catch (err) {
                console.error("Browse Groups List Error:", err);
                listContainer.innerHTML = '<div style="font-size: 0.75rem; color: var(--danger); text-align: center; padding: 1rem;">Failed to load directory.</div>';
            }
        }

        // Browse Group Submit Action
        const browseSubmitBtn = document.getElementById("browse-submit-btn");
        if (browseSubmitBtn) {
            browseSubmitBtn.addEventListener("click", async () => {
                const username = document.getElementById("browse-username").value.trim();
                const password = document.getElementById("browse-password").value;

                if (!username) {
                    showToast("Auth Error", "Please enter your name.");
                    return;
                }

                if (!selectedBrowseGroup) {
                    showToast("Auth Error", "Please select a group first.");
                    return;
                }

                if (!state.firebaseUser || !db) {
                    showToast("Auth Error", "Please login with Google first.");
                    return;
                }

                showToast("Sync Status", "Entering network...");

                try {
                    const docRef = doc(db, "trip_networks", selectedBrowseGroup);
                    const docSnap = await getDoc(docRef);

                    if (!docSnap.exists()) {
                        showToast("Auth Error", "Selected group no longer exists.");
                        return;
                    }

                    const data = docSnap.data();
                    const isPrivate = data.password && data.password.trim().length > 0;
                    const isMember = state.firebaseUser && data.members && data.members.includes(state.firebaseUser.uid);

                    if (isPrivate && !isMember && data.password !== password) {
                        showToast("Auth Error", "Incorrect group password.");
                        return;
                    }

                    if (!isMember) {
                        await updateDoc(docRef, {
                            members: arrayUnion(state.firebaseUser.uid),
                            memberNames: arrayUnion(username)
                        });
                    }

                    state.activeUser = username;
                    state.groupCode = selectedBrowseGroup;
                    state.mappedRole = "Alice";
                    state.activeGroupId = selectedBrowseGroup;

                    localStorage.setItem("travelActiveUser", username);
                    localStorage.setItem("travelGroupCode", selectedBrowseGroup);
                    localStorage.setItem("travelMappedRole", state.mappedRole);
                    localStorage.setItem("travelActiveGroupId", selectedBrowseGroup);

                    updateProfileUI();
                    await loadUserNetworks(selectedBrowseGroup);
                    closeAuthModal();
                    showToast("Success", `Joined Group ${selectedBrowseGroup}!`);
                } catch (err) {
                    console.error("Browse Join Error:", err);
                    showToast("Error", `Failed to join: ${err.message}`);
                }
            });
        }

        profileBadgeBtn.addEventListener("click", () => {
            openAuthModal(false);
        });

        function updateProfileUI() {
            let countryBadge = "";
            if (state.destination) {
                const d = state.destination.toLowerCase();
                const code = d === "japan" ? "JP" : (d === "china" ? "CN" : "ML");
                countryBadge = ` <span style="font-size:0.65rem; color:var(--text-secondary); background:var(--border); padding:0.15rem 0.3rem; border-radius:3px; margin-left:0.25rem; font-weight: 800;">${code}</span>`;
            }
            currentUserDisplay.innerHTML = `<span style="font-weight: 800; color: var(--accent);">${state.activeUser}</span>${countryBadge}`;
            
            const members = state.groupMembers && state.groupMembers.length > 0 ? state.groupMembers : ["Alice", "Bob", "Charlie"];

            const payerSelect = document.getElementById("expense-payer");
            if (payerSelect) {
                payerSelect.innerHTML = members.map(m =>
                    `<option value="${m}"${m === state.activeUser ? " selected" : ""}>${m}</option>`
                ).join("");
            }
            const icPassengerSelectEl = document.getElementById("ic-passenger");
            if (icPassengerSelectEl) {
                icPassengerSelectEl.innerHTML = members.map(m =>
                    `<option value="${m}"${m === state.activeUser ? " selected" : ""}>${m}</option>`
                ).join("");
            }

            // Lock currency to destination
            const currencySelect = document.getElementById("expense-currency");
            if (currencySelect) {
                const currencyMap = { japan: "JPY", malaysia: "MYR", china: "CNY" };
                const destCurrency = currencyMap[state.destination] || "HKD";
                currencySelect.value = destCurrency;
                currencySelect.disabled = true;
            }

            // Update IC currency symbol
            const icSymbolEl = document.getElementById("ic-currency-symbol");
            if (icSymbolEl) {
                icSymbolEl.textContent = state.destination === "malaysia" ? "RM" : "¥";
            }
        }

        // -------------------------------------------------------------------------
        // FIREBASE GOOGLE AUTHENTICATION SYSTEM
        // -------------------------------------------------------------------------
        if (auth && provider) {
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    const firstTimeLogin = !state.firebaseUser;
                    state.firebaseUser = user;
                    state.activeUser = user.displayName || user.email || "FirebaseUser";
                    localStorage.setItem("travelActiveUser", state.activeUser);

                    auth0LoginBtn.style.display = "none";
                    auth0ProfileDiv.style.display = "flex";
                    auth0UserAvatar.src = user.photoURL || "";
                    
                    updateProfileUI();
                    await loadUserNetworks();

                    // Pre-fill usernames in all onboarding forms
                    const joinUserEl = document.getElementById("join-username");
                    if (joinUserEl) joinUserEl.value = state.activeUser;
                    const createUserEl = document.getElementById("create-username");
                    if (createUserEl) createUserEl.value = state.activeUser;
                    const browseUserEl = document.getElementById("browse-username");
                    if (browseUserEl) browseUserEl.value = state.activeUser;

                    // Display feedback toast on initial login
                    if (firstTimeLogin) {
                        showToast("Collaborative Sync", `Logged in successfully as ${state.activeUser}!`);
                    }

                    // Open onboarding modal immediately if no group code is set
                    const hasGroup = localStorage.getItem("travelGroupCode");
                    if (!hasGroup || hasGroup === "TRIP-2026") {
                        openAuthModal(true);
                    }
                } else {
                    state.firebaseUser = null;
                    auth0LoginBtn.style.display = "inline-flex";
                    auth0ProfileDiv.style.display = "none";
                    
                    // Explicitly purge local storage on logout
                    localStorage.removeItem("travelActiveUser");
                    localStorage.removeItem("travelGroupCode");
                    localStorage.removeItem("travelMappedRole");
                    localStorage.removeItem("travelActiveGroupId");
                    
                    state.activeUser = "Guest";
                    state.groupCode = "TRIP-2026";
                    state.mappedRole = "Alice";
                    state.activeGroupId = "TRIP-2026";
                    
                    // Aggressively re-render UI components instantly
                    updateProfileUI();
                    loadUserNetworks();
                    generateCalendar();
                    if (state.selectedDay !== null) {
                        renderActivitiesList();
                    }
                    renderLedger();
                    renderDebtSettlement();
                    updateIcEstimator();
                }
            });

            auth0LoginBtn.addEventListener("click", async () => {
                try {
                    await signInWithPopup(auth, provider);
                } catch (err) {
                    console.error("Firebase Login Error:", err);
                    alert("Login Error: " + err.message);
                }
            });

            auth0LogoutBtn.addEventListener("click", async () => {
                try {
                    state.firebaseUser = null;
                    await signOut(auth);
                } catch (err) {
                    console.error("Firebase Logout Error:", err);
                    alert("Logout Error: " + err.message);
                }
            });
        } else {
            auth0LoginBtn.addEventListener("click", () => {
                alert("Firebase Authentication is not configured.");
            });
        }

        icPassengerSelect.addEventListener("change", (e) => {
            state.mappedRole = e.target.value;
            localStorage.setItem("travelMappedRole", state.mappedRole);
            updateProfileUI();
            updateIcEstimator();
        });

        function updateDestinationUI() {
            populateTransitDropdowns();
            renderPlacesGrid();
            populateCityDropdown();
            gpsRecHeader.style.display = "none";
            gpsRecGrid.style.display = "none";
            gpsStatusBar.style.display = "none";
            gpsPaginationContainer.innerHTML = "";
            gpsCurrentPage = 1;
            updateIcEstimator();
            renderRechargeButtons();

            // Lock currency to destination
            const currencyMap = { japan: "JPY", malaysia: "MYR", china: "CNY" };
            const destCurrency = currencyMap[state.destination] || "HKD";
            if (expenseCurrencySelect) {
                expenseCurrencySelect.value = destCurrency;
                expenseCurrencySelect.disabled = true;
            }
            updateConvertedIndicator();

            // Refresh wallet panels
            state.selectedExpenseDay = getTodayTripDay();
            renderDaySelector();
            renderSplitPanel(state.groupMembers && state.groupMembers.length > 0 ? state.groupMembers : ["Alice","Bob","Charlie"]);
            renderCashTracker();

            // Update IC currency symbol
            const icSymbolEl = document.getElementById("ic-currency-symbol");
            if (icSymbolEl) icSymbolEl.textContent = state.destination === "malaysia" ? "RM" : "¥";

            if (state.destination === "china") {
                transitTitle.textContent = "Didi Ride Fare Estimator";
                transitSubtitle.textContent = "Plan your taxi rides and didi fares across Shenzhen Futian.";
                transitCardTitle.innerHTML = `<i data-lucide="car"></i> Didi Ride Estimator`;
                transitCriteriaContainer.style.display = "none";
                taxiTypeContainer.style.display = "flex";
            } else {
                transitTitle.textContent = "Subway Node Optimizer";
                transitSubtitle.textContent = "Calculate the fastest route and optimize subway transitions.";
                transitCardTitle.innerHTML = `<i data-lucide="git-fork"></i> Route Planner`;
                transitCriteriaContainer.style.display = "flex";
                taxiTypeContainer.style.display = "none";
            }
            transitResultsBody.innerHTML = `<div class="empty-state"><i data-lucide="map" class="empty-icon"></i><p>Select route stations and calculate.</p></div>`;
            if (window.lucide) lucide.createIcons();
        }

        function populateTransitDropdowns() {
            transitStart.innerHTML = "";
            transitEnd.innerHTML = "";
            const network = TRANSIT_NETWORKS[state.destination];
            if (!network) return;
            network.nodes.forEach(node => {
                const opt1 = document.createElement("option"); opt1.value = node; opt1.textContent = node; transitStart.appendChild(opt1);
                const opt2 = document.createElement("option"); opt2.value = node; opt2.textContent = node; transitEnd.appendChild(opt2);
            });
            if (transitEnd.options.length > 1) transitEnd.selectedIndex = 1;
        }

        transitForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const start = transitStart.value;
            const end = transitEnd.value;
            if (start === end) { alert("Stations must be different."); return; }
            if (state.destination === "china") calculateShenzhenDidi(start, end);
            else calculateSubwayRoute(start, end);
        });

        function calculateSubwayRoute(start, end) {
            const crit = transitCriteria.value;
            const route = findDijkstraRoute(state.destination, start, end, crit);
            if (!route) {
                transitResultsBody.innerHTML = `<div class="empty-state"><p>No route found.</p></div>`;
                return;
            }
            const currency = state.destination === "japan" ? "JPY" : "MYR";
            const symbol = state.destination === "japan" ? "¥" : "RM";
            const hkdFare = convertToHkd(route.totalFare, currency).toFixed(2);

            let tl = `<div class="route-timeline"><div class="timeline-node"><span class="node-station">${route.path[0]}</span><div class="node-detail">Departure</div></div>`;
            for (let i = 0; i < route.segmentLinks.length; i++) {
                const link = route.segmentLinks[i];
                const next = route.path[i + 1];
                const isTransfer = i > 0 && route.segmentLinks[i - 1].line !== link.line;
                tl += `<div class="timeline-node ${isTransfer ? "transfer" : ""}"><span class="node-station">${next}</span><span class="node-line" style="background-color:${link.color};">${link.line}</span><div class="node-detail">${link.time}m • ${symbol}${link.fare}</div></div>`;
            }
            tl += `</div>`;

            transitResultsBody.innerHTML = `
                ${tl}
                <div class="transit-metrics">
                    <div>Duration: <strong>${route.totalTime} mins</strong></div>
                    <div>Transfers: <strong>${route.transfers}</strong></div>
                    <div>Fare: <strong>${symbol}${route.totalFare}</strong> <span style="font-size:0.7rem; color:var(--text-secondary)">(HKD $${hkdFare})</span></div>
                </div>
                <button class="btn btn-accent btn-block" style="margin-top:1rem;" id="charge-ic-transit-btn"><i data-lucide="credit-card"></i> Add transit fare to ${state.activeUser}</button>
            `;
            if (window.lucide) lucide.createIcons();

            document.getElementById("charge-ic-transit-btn").addEventListener("click", () => {
                const log = { desc: `${start.replace(" Station", "")} ➔ ${end.replace(" Station", "")}`, fare: route.totalFare, currency };
                state.icCards[state.activeUser][currency] -= route.totalFare;
                state.icCards[state.activeUser].logs.push(log);
                saveICCardsToStorage();
                updateIcEstimator();
                alert(`Charged ${symbol}${route.totalFare} to ${state.activeUser}!`);
            });
        }

        function calculateShenzhenDidi(start, end) {
            const network = TRANSIT_NETWORKS.china;
            let link = network.links.find(l => (l.u === start && l.v === end) || (l.u === end && l.v === start));
            let dist = link ? link.distance : 15;
            const carType = taxiTypeSelect.value;
            let base = 10, per = 2.5, carName = "Didi Express";
            if (carType === "premier") { base = 18; per = 4.0; carName = "Didi Premier"; }
            else if (carType === "luxe") { base = 35; per = 7.0; carName = "Didi Luxe"; }

            const totalFare = Math.round(base + dist * per);
            const time = Math.round(dist * 1.25 + 5);
            const hkdFare = convertToHkd(totalFare, "CNY").toFixed(2);

            transitResultsBody.innerHTML = `
                <div style="text-align: center; padding: 0.5rem 0;">
                    <i data-lucide="car" style="width:36px; height:36px; color:var(--accent); margin-bottom:0.25rem;"></i>
                    <h4 style="font-family: var(--font-heading); font-size:1.1rem; font-weight:750;">${carName} Fare Recommended</h4>
                </div>
                <div class="route-timeline">
                    <div class="timeline-node"><span class="node-station">${start}</span></div>
                    <div class="timeline-node" style="height:35px;"><span class="node-station">${end}</span><div class="node-detail">Distance: ${dist} km</div></div>
                </div>
                <div class="transit-metrics">
                    <div>Est. Time: <strong>${time} mins</strong></div>
                    <div>Fare: <strong>${totalFare} CNY</strong> <span style="font-size:0.7rem; color:var(--text-secondary)">(HKD $${hkdFare})</span></div>
                </div>
                <button class="btn btn-accent btn-block" style="margin-top:1rem;" id="charge-didi-wallet-btn"><i data-lucide="plus"></i> Add Didi fare to Wallet Ledger</button>
            `;
            if (window.lucide) lucide.createIcons();

            document.getElementById("charge-didi-wallet-btn").addEventListener("click", () => {
                const exp = {
                    id: `exp-${Date.now()}`,
                    title: `${carName}: ${start.substring(0, 8)} ➔ ${end.substring(0, 8)}`,
                    amount: totalFare,
                    currency: "CNY",
                    payer: state.activeUser,
                    category: "Transport",
                    type: "global",
                    date: new Date().toLocaleDateString()
                };
                state.expenses.push(exp);
                saveExpensesToStorage();
                renderLedger();
                renderDebtSettlement();
                updateIcEstimator();
                alert(`Added taxi fare!`);
            });
        }

        async function fetchPlacesDb() {
            try {
                const res = await fetch("final_places_db.json");
                placesDatabase = await res.json();
            } catch(e) {
                // Loaded static fallback
                placesDatabase = curatingFallbackDb();
            }
            // Sort primarily by total reviewsCount descending, and secondarily by rating score descending
            placesDatabase.sort((a, b) => {
                const countA = a.reviewsCount || 0;
                const countB = b.reviewsCount || 0;
                if (countB !== countA) {
                    return countB - countA;
                }
                return (b.rating || 0) - (a.rating || 0);
            });
            populateCityDropdown();
            renderPlacesGrid();
        }

        function populateCityDropdown() {
            placesCitySelect.innerHTML = "<option value='All'>All Cities</option>";
            if (state.destination === "china") return;
            const targetCountry = state.destination === "japan" ? "Japan" : "Malaysia";
            const cities = [...new Set(placesDatabase.filter(p => p.country === targetCountry).map(p => p.city))];
            cities.forEach(c => {
                const opt = document.createElement("option"); opt.value = c; opt.textContent = c; placesCitySelect.appendChild(opt);
            });
        }

        let activeCategoryFilter = "All";
        const chips = document.querySelectorAll(".places-filters-container .chip");
        chips.forEach(chip => {
            chip.addEventListener("click", () => {
                chips.forEach(c => c.classList.remove("active"));
                chip.classList.add("active");
                activeCategoryFilter = chip.getAttribute("data-category");
                placesCurrentPage = 1; // Reset pagination
                renderPlacesGrid();
            });
        });

        placesSearch.addEventListener("input", () => {
            placesCurrentPage = 1; // Reset pagination
            renderPlacesGrid();
        });
        
        placesCitySelect.addEventListener("change", () => {
            placesCurrentPage = 1; // Reset pagination
            renderPlacesGrid();
        });

        function renderPlacesGrid() {
            placesGrid.innerHTML = "";
            const pagContainer = document.getElementById("places-pagination-container");
            if (pagContainer) pagContainer.innerHTML = "";

            if (state.destination === "china") {
                placesGrid.innerHTML = `<div class="placeholder-card card" style="grid-column:1/-1;"><div class="placeholder-icon"><i data-lucide="compass"></i></div><h3>Shenzhen Places Ignored</h3><p>Didi transport ride-hailing is used in Shenzhen. Places lookup ignored.</p></div>`;
                if (window.lucide) lucide.createIcons();
                return;
            }

            // Non-blocking loading screen spinner/text
            if (placesDatabase.length === 0) {
                placesGrid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 2rem 0;">
                        <div class="loading-spinner" style="border: 4px solid rgba(0,0,0,0.1); width: 36px; height: 36px; border-radius: 50%; border-left-color: var(--accent); animation: spin 1s linear infinite; margin: 0 auto 1rem auto;"></div>
                        <p style="font-weight: 700; color: var(--text-secondary);">Loading places...</p>
                    </div>
                `;
                return;
            }

            const query = placesSearch.value.toLowerCase().trim();
            const cityFilter = placesCitySelect.value;
            const countryFilter = state.destination === "japan" ? "Japan" : "Malaysia";

            const filtered = placesDatabase.filter(p => {
                if (p.country !== countryFilter) return false;
                if (cityFilter !== "All" && p.city !== cityFilter) return false;
                if (activeCategoryFilter !== "All" && p.category !== activeCategoryFilter) return false;
                if (query) {
                    return p.name.toLowerCase().includes(query) || 
                           (p.localTitle && p.localTitle.toLowerCase().includes(query)) ||
                           p.street.toLowerCase().includes(query);
                }
                return true;
            });

            if (filtered.length === 0) {
                placesGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i data-lucide="search" class="empty-icon"></i><p>No matching places found.</p></div>`;
                if (window.lucide) lucide.createIcons();
                return;
            }

            // Pagination chunking: render 12 initially, and 12 more on 'Load More'
            const visibleCount = placesCurrentPage * 12;
            const visible = filtered.slice(0, visibleCount);

            visible.forEach(p => placesGrid.appendChild(createPlaceCardElement(p)));
            
            if (filtered.length > visible.length) {
                if (pagContainer) {
                    pagContainer.innerHTML = `
                        <button id="load-more-places-btn" class="btn btn-accent" style="font-weight: 750; letter-spacing: 0.5px;">
                            <i data-lucide="download-cloud" style="width: 16px; height: 16px; margin-right: 6px; vertical-align: middle;"></i>
                            Load More (Beware Roaming Data Usage)
                        </button>
                    `;
                    document.getElementById("load-more-places-btn").addEventListener("click", () => {
                        placesCurrentPage++;
                        renderPlacesGrid();
                    });
                }
            }

            if (window.lucide) lucide.createIcons();
        }

        gpsBtn.addEventListener("click", () => {
            if (state.destination === "china") { alert("Places ignored for China."); return; }
            gpsCurrentPage = 1; // Reset GPS pagination
            gpsPaginationContainer.innerHTML = "";
            if (navigator.geolocation) {
                gpsStatusText.textContent = "Locating...";
                gpsStatusBar.style.display = "inline-flex";
                navigator.geolocation.getCurrentPosition(
                    (pos) => applyGpsDiscovery(pos.coords.latitude, pos.coords.longitude, "Live GPS"),
                    () => simulateGpsLookup()
                );
            } else simulateGpsLookup();
        });

        function simulateGpsLookup() {
            let lat = 34.6937, lng = 135.5023, lbl = "Simulated Osaka";
            if (state.destination === "malaysia") { lat = 3.1390; lng = 101.6869; lbl = "Simulated KL"; }
            applyGpsDiscovery(lat, lng, lbl);
        }

        function applyGpsDiscovery(lat, lng, label) {
            gpsStatusText.textContent = `${label}: (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
            gpsStatusBar.style.display = "inline-flex";
            const country = state.destination === "japan" ? "Japan" : "Malaysia";
            
            const ranked = placesDatabase
                .filter(p => p.country === country)
                .map(p => ({ ...p, distance: getHaversineDistance(lat, lng, p.coordinates.lat, p.coordinates.lng) }))
                .sort((a, b) => a.distance - b.distance);

            gpsRecGrid.innerHTML = "";
            gpsPaginationContainer.innerHTML = "";

            const visibleCount = gpsCurrentPage * 3;
            const visible = ranked.slice(0, visibleCount);

            visible.forEach(place => {
                const card = createPlaceCardElement(place);
                const db = document.createElement("div");
                db.className = "place-details-row";
                db.style.color = "var(--success)";
                db.style.fontWeight = "750";
                db.innerHTML = `<span>Proximity:</span> <span>📍 ${place.distance.toFixed(2)} km away</span>`;
                card.insertBefore(db, card.querySelector(".place-actions"));
                gpsRecGrid.appendChild(card);
            });

            // Dynamically update header text to reflect the loaded count
            const headerTitle = gpsRecHeader.querySelector("h3");
            if (headerTitle) {
                headerTitle.innerHTML = `<i data-lucide="sparkles"></i> 📍 Right Next To You (Closest ${visible.length} Gems)`;
            }

            gpsRecHeader.style.display = "block";
            gpsRecGrid.style.display = "grid";

            if (ranked.length > visible.length) {
                gpsPaginationContainer.innerHTML = `
                    <button id="load-more-gps-btn" class="btn btn-accent" style="font-weight: 750; letter-spacing: 0.5px;">
                        <i data-lucide="download-cloud" style="width: 16px; height: 16px; margin-right: 6px; vertical-align: middle;"></i>
                        Load More (Beware Roaming Data Usage)
                    </button>
                `;
                document.getElementById("load-more-gps-btn").addEventListener("click", () => {
                    gpsCurrentPage++;
                    applyGpsDiscovery(lat, lng, label);
                });
            }

            if (window.lucide) lucide.createIcons();
        }

        function getHaversineDistance(lat1, lon1, lat2, lon2) {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        }

        // Expense type change handler — show/hide split panel vs payment method panel
        expenseTypeSelect.addEventListener("change", () => {
            updateExpenseTypePanels(expenseTypeSelect.value);
        });

        // ePayment sub-type show/hide
        document.querySelectorAll('input[name="pay-method"]').forEach(radio => {
            radio.addEventListener("change", () => {
                const val = radio.value;
                const eSubs = document.getElementById("epayment-subtypes");
                const tNote = document.getElementById("transit-note");
                if (eSubs) eSubs.style.display = val === "epayment" ? "flex" : "none";
                if (tNote) tNote.style.display = val === "transit" ? "block" : "none";
            });
        });

        // Shared Ledger Form Submit
        expenseForm.addEventListener("submit", (e) => {
            e.preventDefault();

            // Protect the Shared Wallet: require Google login to add expenses
            if (!state.firebaseUser) {
                alert("🔒 Authentication Required: You must log in via Google to add expenses to the group wallet.");
                return;
            }
            const title = expenseTitleInput.value.trim();
            const type = expenseTypeSelect.value;
            const category = expenseCategoryInput.value;
            const amount = Number(expenseAmountInput.value);
            const currency = expenseCurrencySelect.value;
            const payer = expensePayerSelect.value;

            if (!category || amount <= 0) return;

            const exp = {
                id: `exp-${Date.now()}`,
                title: title || category, // default to category if no description
                type,
                amount,
                currency,
                payer,
                category,
                day: state.selectedExpenseDay || getTodayTripDay(),
                date: new Date().toLocaleDateString()
            };

            // Read payment method for all expenses
            const payMethodRadio = document.querySelector('input[name="pay-method"]:checked');
            const payMethod = payMethodRadio ? payMethodRadio.value : "cash";
            let subType = null;
            if (payMethod === "epayment") {
                const subRadio = document.querySelector('input[name="epay-sub"]:checked');
                subType = subRadio ? subRadio.value : "alipayhk";
            }
            exp.paymentMethod = { type: payMethod, subType };

            if (type === "global") {
                const splitConfig = getSplitConfig();
                if (splitConfig) {
                    exp.splitAmong = splitConfig.splitAmong;
                    exp.splitRatios = splitConfig.splitRatios;
                }
            }

            // For cash: warn if balance is insufficient
            if (payMethod === "cash" && state.cashBalances[payer]) {
                const cashCur = state.destination === "japan" ? "JPY" : state.destination === "malaysia" ? "MYR" : "CNY";
                if (currency === cashCur) {
                    const remaining = (state.cashBalances[payer].initial || 0) -
                        state.expenses.filter(ex => ex.paymentMethod && ex.paymentMethod.type === "cash" && ex.currency === cashCur && ex.payer === payer)
                        .reduce((sum, ex) => sum + ex.amount, 0);
                    if (remaining - amount < 0) {
                        const sym = currency === "MYR" ? "RM" : "¥";
                        showToast("⚠️ Low Cash", `${payer}'s cash balance will go negative after this expense (${sym}${(remaining - amount).toFixed(0)})`);
                    }
                }
            }

            state.expenses.push(exp);
            saveExpensesToStorage();
            
            expenseTitleInput.value = "";
            expenseAmountInput.value = "";
            expenseConvertedText.textContent = "Converted: HKD $0.00";

            renderLedger();
            renderDebtSettlement();
            renderCashTracker();
            updateIcEstimator();
        });

        expenseAmountInput.addEventListener("input", updateConvertedIndicator);
        expenseCurrencySelect.addEventListener("change", updateConvertedIndicator);

        function updateConvertedIndicator() {
            const val = Number(expenseAmountInput.value);
            if (isNaN(val) || val <= 0) { expenseConvertedText.textContent = "Converted: HKD $0.00"; return; }
            const hkd = convertToHkd(val, expenseCurrencySelect.value).toFixed(2);
            expenseConvertedText.textContent = `Converted: HKD $${hkd}`;
        }

        function renderLedger() {
            expensesList.innerHTML = "";
            if (state.expenses.length === 0) {
                expensesList.innerHTML = `<div class="empty-state"><i data-lucide="receipt" class="empty-icon"></i><p>No trip expenses recorded.</p></div>`;
                if (window.lucide) lucide.createIcons();
                return;
            }

            // Filter expenses visible to current user:
            // - global expenses are always shown
            // - local expenses only shown to the 'paid by' person
            // - settlement records always shown
            const visibleExpenses = state.expenses.filter(exp => {
                if (exp.isSettlement) return true;
                if (exp.type === "local") return exp.payer === state.activeUser;
                return true;
            });

            if (visibleExpenses.length === 0) {
                expensesList.innerHTML = `<div class="empty-state"><i data-lucide="receipt" class="empty-icon"></i><p>No expenses visible for you today.</p></div>`;
                if (window.lucide) lucide.createIcons();
                return;
            }

            // Group by day
            const byDay = {};
            visibleExpenses.forEach(exp => {
                const dayKey = exp.day || exp.date || "Unknown";
                if (!byDay[dayKey]) byDay[dayKey] = [];
                byDay[dayKey].push(exp);
            });

            // Sort days descending (most recent first)
            const sortedDays = Object.keys(byDay).sort((a, b) => b.localeCompare(a));

            const destCurrency = state.destination === "japan" ? "JPY" : state.destination === "malaysia" ? "MYR" : "CNY";
            const destSymbol = destCurrency === "MYR" ? "RM" : "¥";

            sortedDays.forEach(dayKey => {
                // Day header
                const dayHeader = document.createElement("div");
                dayHeader.className = "ledger-day-header";
                const today = getTodayTripDay();
                const dayLabel = dayKey === today ? `📅 Today (${dayKey})` : `📅 ${dayKey}`;
                dayHeader.textContent = dayLabel;
                expensesList.appendChild(dayHeader);

                // Expenses for this day
                byDay[dayKey].sort((a, b) => b.id.localeCompare(a.id)).forEach(exp => {
                    const item = document.createElement("div");
                    item.className = "expense-item";
                    const origSymbol = exp.currency === "MYR" ? "RM" : (exp.currency === "HKD" ? "$" : "¥");
                    const hkdVal = convertToHkd(exp.amount, exp.currency).toFixed(2);
                    const localVal = exp.currency === destCurrency ? `${destSymbol}${exp.amount}` : `${origSymbol}${exp.amount}`;

                    // Type badge
                    const typeText = exp.type === "local" ? "👤 Local" : (exp.isSettlement ? "✅ Settled" : "🌍 Global");
                    const typeStyle = exp.type === "local" ? "background-color:var(--border); color:var(--text-secondary);" :
                                     exp.isSettlement ? "background-color:#dcfce7; color:#166534;" :
                                     "background-color:var(--accent-light); color:var(--accent-dark);";

                    // Payment method badge
                    let payBadge = "";
                    if (exp.paymentMethod) {
                        const pm = exp.paymentMethod;
                        const payIcon = pm.type === "cash" ? "💵" : pm.type === "transit" ? "🚇" : "📱";
                        const payLabel = pm.type === "cash" ? "Cash" : pm.type === "transit" ? "Transit" : (pm.subType || "ePayment");
                        payBadge = `<span class="activity-badge" style="background:var(--border); color:var(--text-secondary); padding:1px 4px; font-size:0.6rem; font-weight:700;">${payIcon} ${payLabel}</span>`;
                    }

                    // Split info for global
                    let splitBadge = "";
                    if (exp.type === "global" && !exp.isSettlement && exp.splitAmong) {
                        splitBadge = `<span style="font-size:0.65rem; color:var(--text-secondary);">÷ ${exp.splitAmong.join(", ")}</span>`;
                    }

                    const displayTitle = exp.title || exp.category;

                    item.innerHTML = `
                        <div class="expense-info">
                            <div class="expense-item-title">${displayTitle}</div>
                            <div class="expense-item-meta" style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                                <span>${exp.payer} · ${exp.category}</span>
                                <span class="activity-badge" style="${typeStyle} padding:1px 5px; font-size:0.6rem; font-weight:700;">${typeText}</span>
                                ${payBadge}
                                ${splitBadge}
                            </div>
                        </div>
                        <div class="expense-amount-side">
                            <div class="expense-amount-hkd">${localVal}</div>
                            <div class="expense-amount-orig" style="color:var(--text-secondary);">HKD $${hkdVal}</div>
                        </div>
                        <button class="action-icon-btn delete-action" style="width:24px; height:24px; margin-left:0.5rem;" onclick="deleteExpenseHandler('${exp.id}')">
                            <i data-lucide="trash-2" style="width:12px; height:12px;"></i>
                        </button>
                    `;
                    expensesList.appendChild(item);
                });
            });
            if (window.lucide) lucide.createIcons();
        }

        window.deleteExpenseHandler = function(id) {
            if (confirm("Remove this expense?")) {
                state.expenses = state.expenses.filter(e => e.id !== id);
                saveExpensesToStorage();
                renderLedger();
                renderDebtSettlement();
                updateIcEstimator();
            }
        };

        // Render Settle up details inside custom neobrutalist table
        function renderDebtSettlement() {
            debtTableBody.innerHTML = "";
            const members = state.groupMembers && state.groupMembers.length > 0 ? state.groupMembers : ["Alice", "Bob", "Charlie"];
            const result = calculateDebtSettlement(state.expenses, members);

            if (result.settlements.length === 0) {
                debtTableBody.innerHTML = `<tr><td colspan="4" style="padding:1rem; text-align:center; color:var(--text-secondary); font-weight:600;">⚖️ All global shared accounts are perfectly settled up!</td></tr>`;
                return;
            }

            const destCurrency = state.destination === "japan" ? "JPY" : state.destination === "malaysia" ? "MYR" : "CNY";
            const destSymbol = destCurrency === "MYR" ? "RM" : "¥";

            result.settlements.forEach(s => {
                const tr = document.createElement("tr");
                tr.style.borderBottom = "1px solid var(--border)";

                // Convert HKD amount to destination currency for primary display
                const hkdAmt = s.amount;
                const localAmt = destCurrency === "JPY" ? (hkdAmt / 0.05).toFixed(0) :
                                 destCurrency === "MYR" ? (hkdAmt / 2.0).toFixed(2) :
                                 destCurrency === "CNY" ? (hkdAmt / 1.15).toFixed(2) : hkdAmt.toFixed(2);

                tr.innerHTML = `
                    <td style="padding:0.65rem 0.8rem; font-weight:700; color:var(--danger);">👤 ${s.from}</td>
                    <td style="padding:0.65rem 0.8rem; font-weight:700; color:var(--success);">👤 ${s.to}</td>
                    <td style="padding:0.65rem 0.8rem; font-weight:750; text-align:right;">
                        <div style="font-size:0.9rem; font-weight:800;">${destSymbol}${localAmt}</div>
                        <div style="font-size:0.7rem; color:var(--text-secondary);">HKD $${hkdAmt.toFixed(2)}</div>
                    </td>
                    <td style="padding:0.65rem 0.8rem; text-align:center;">
                        <div style="display:flex; flex-direction:column; gap:0.25rem; align-items:center;">
                            <button class="btn btn-accent btn-sm" style="padding:0.2rem 0.5rem; font-size:0.65rem;" onclick="settleDebtHandler('${s.from}', '${s.to}', ${hkdAmt}, 'cash')">
                                💵 Cash
                            </button>
                            <button class="btn btn-secondary btn-sm" style="padding:0.2rem 0.5rem; font-size:0.65rem;" onclick="settleDebtHandler('${s.from}', '${s.to}', ${hkdAmt}, 'epayment')">
                                📱 ePayment
                            </button>
                        </div>
                    </td>
                `;
                debtTableBody.appendChild(tr);
            });
            if (window.lucide) lucide.createIcons();
        }

        // Direct Settle click callback
        window.settleDebtHandler = function(from, to, amountHkd, payMethod) {
            const methodLabel = payMethod === "epayment" ? "ePayment (AlipayHK/PayMe/Credit)" : "Cash";
            if (confirm(`${from} pays ${to} HKD $${amountHkd.toFixed(2)} via ${methodLabel}?`)) {
                const exp = {
                    id: `exp-${Date.now()}`,
                    title: `Settle: ${from} ➔ ${to} (${methodLabel})`,
                    type: "global",
                    amount: amountHkd,
                    currency: "HKD",
                    payer: from,
                    recipient: to,
                    category: "Other",
                    isSettlement: true,
                    paymentMethod: { type: payMethod, subType: null },
                    day: getTodayTripDay(),
                    date: new Date().toLocaleDateString()
                };

                state.expenses.push(exp);
                saveExpensesToStorage();

                // Deduct from cash tracker if paid in cash
                if (payMethod === "cash") {
                    renderCashTracker();
                }

                renderLedger();
                renderDebtSettlement();
                updateIcEstimator();
                glowSyncBadge();

                showToast("✅ Settlement Recorded", `${from} paid ${to} ${methodLabel}`);
            }
        };

        window.addPlaceToExpenseHandler = function(name, priceHkd, category) {
            if (!state.firebaseUser) {
                alert("🔒 Authentication Required: You must log in via Google to add expenses to the group wallet.");
                return;
            }
            const exp = {
                id: `exp-${Date.now()}`,
                title: `Split: ${name}`,
                type: "global",
                amount: priceHkd,
                currency: "HKD",
                payer: state.activeUser || "Alice",
                category: category || "Other",
                date: new Date().toLocaleDateString()
            };
            state.expenses.push(exp);
            saveExpensesToStorage();
            renderLedger();
            renderDebtSettlement();
            updateIcEstimator();
            alert(`Added "${name}" global expense (HKD $${priceHkd.toFixed(2)}) paid by ${state.activeUser}!`);
        };

        window.addPlaceToActivityHandler = function(name, location) {
            if (state.selectedDay === null) {
                alert("Please select a travel date on the calendar first!");
                return;
            }
            openModal(state.selectedDay, null, {
                title: name,
                location: location,
                timeStart: "12:00",
                timeEnd: "13:00"
            });
        };

        const placeDetailModal = document.getElementById("place-detail-modal");
        const closePlaceDetailModalBtn = document.getElementById("close-place-detail-modal");
        const placeDetailTitle = document.getElementById("place-detail-title");
        const placeDetailBody = document.getElementById("place-detail-body");

        window.closePlaceDetailModal = function() {
            if (placeDetailModal) {
                placeDetailModal.classList.remove("open");
            }
        };

        if (closePlaceDetailModalBtn) {
            closePlaceDetailModalBtn.addEventListener("click", window.closePlaceDetailModal);
        }

        if (placeDetailModal) {
            placeDetailModal.addEventListener("click", (e) => {
                if (e.target === placeDetailModal) {
                    window.closePlaceDetailModal();
                }
            });
        }

        window.openPlaceDetailModal = function(p) {
            if (!placeDetailModal || !placeDetailTitle || !placeDetailBody) return;

            placeDetailTitle.textContent = p.name;

            const catClass = p.category ? p.category.toLowerCase() : "food";
            
            let localPriceHtml = "";
            if (p.country === "Japan") {
                localPriceHtml = `JPY ${p.price_local}`;
            } else if (p.country === "Malaysia") {
                localPriceHtml = `MYR ${p.price_local}`;
            } else {
                localPriceHtml = `CNY ${p.price_local}`;
            }

            const imageHtml = p.imageUrl ? `
                <div class="place-detail-image-wrapper" style="width: 100%; height: 220px; overflow: hidden; border-radius: var(--radius-md); border: 1px solid var(--border); background-color: rgba(99, 102, 241, 0.08);">
                    <img src="${p.imageUrl}" referrerpolicy="no-referrer" alt="${p.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.style.display='none'">
                </div>
            ` : "";

            let reviewsHtml = "";
            if (p.reviews && p.reviews.length > 0) {
                const reviewItems = p.reviews.map(r => `
                    <div class="place-detail-review-item" style="background-color: var(--bg-primary); border-left: 3px solid var(--accent); padding: 0.75rem; border-radius: var(--radius-sm); font-size: 0.75rem; font-style: italic; color: var(--text-secondary); line-height: 1.4;">
                        "${r}"
                    </div>
                `).join("");
                reviewsHtml = `
                    <div class="place-detail-reviews-section" style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">
                        <h4 style="font-size: 0.85rem; font-weight: 700; margin-bottom: 0.25rem;">Traveller Reviews</h4>
                        ${reviewItems}
                    </div>
                `;
            } else {
                reviewsHtml = `
                    <div class="place-detail-reviews-section" style="margin-top: 0.5rem;">
                        <h4 style="font-size: 0.85rem; font-weight: 700; margin-bottom: 0.25rem;">Traveller Reviews</h4>
                        <div style="font-size: 0.75rem; color: var(--text-secondary); font-style: italic;">No reviews yet.</div>
                    </div>
                `;
            }

            placeDetailBody.innerHTML = `
                ${imageHtml}
                
                <div class="place-detail-info-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem;">
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <span style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase;">Category</span>
                        <div><span class="place-cat-badge ${catClass}">${p.category || "Food"}</span></div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <span style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase;">Rating</span>
                        <div class="universal-rating-badge" style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; font-weight: 700; background-color: var(--bg-primary); border: 1px solid var(--border); padding: 2px 8px; border-radius: var(--radius-sm); color: var(--text-primary);">
                            <span style="color: #eab308;">★</span> <span>${p.rating.toFixed(1)} (${p.reviewsCount || 0} reviews)</span>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <span style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase;">Local Cost</span>
                        <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary);">${localPriceHtml}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <span style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase;">Est. Base Cost</span>
                        <span style="font-size: 0.8rem; font-weight: 700; color: var(--accent);">HKD $${p.price_hkd.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <span style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase;">Price Level</span>
                        <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary);">${p.price_level}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <span style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase;">Location</span>
                        <span style="font-size: 0.75rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.25rem;">
                            <i data-lucide="map-pin" style="width:12px; height:12px; flex-shrink: 0;"></i>
                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.city}, ${p.street}</span>
                        </span>
                    </div>
                </div>

                ${reviewsHtml}

                <div class="place-detail-actions" style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem;">
                    <button class="btn btn-secondary btn-sm" onclick="window.closePlaceDetailModal(); window.addPlaceToExpenseHandler('${p.name.replace(/'/g, "\\'")}', ${p.price_hkd}, '${p.category}')">
                        <i data-lucide="wallet" style="width:12px; height:12px; margin-right:2px;"></i> Split Cost
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="window.closePlaceDetailModal(); window.addPlaceToActivityHandler('${p.name.replace(/'/g, "\\'")}', '${p.street.replace(/'/g, "\\'")}')">
                        <i data-lucide="calendar" style="width:12px; height:12px; margin-right:2px;"></i> Add Route
                    </button>
                </div>
            `;

            if (window.lucide) window.lucide.createIcons();
            placeDetailModal.classList.add("open");
        };
        
        // Passenger IC Card Estimates
        function renderRechargeButtons() {
            icRechargeRow.innerHTML = "";
            let actions = [];
            if (state.destination === "japan") {
                actions = [{ label: "+¥1000", val: 1000 }, { label: "+¥2000", val: 2000 }, { label: "+¥5000", val: 5000 }];
            } else if (state.destination === "malaysia") {
                actions = [{ label: "+RM10", val: 10 }, { label: "+RM20", val: 20 }, { label: "+RM50", val: 50 }];
            } else {
                actions = [{ label: "+¥20 CNY", val: 20 }, { label: "+¥50 CNY", val: 50 }, { label: "+¥100 CNY", val: 100 }];
            }

            actions.forEach(act => {
                const btn = document.createElement("button");
                btn.className = "btn btn-secondary btn-sm";
                btn.textContent = act.label;
                btn.addEventListener("click", () => {
                    const passenger = (icPassengerSelect && icPassengerSelect.value) ? icPassengerSelect.value : state.activeUser;
                    const currency = state.destination === "japan" ? "JPY" : (state.destination === "malaysia" ? "MYR" : "CNY");
                    if (!state.icCards[passenger]) state.icCards[passenger] = { JPY: 0, MYR: 0, CNY: 0, logs: [] };
                    state.icCards[passenger][currency] += act.val;
                    
                    // Add recharge to ledger as personal/local expense
                    const exp = {
                        id: `exp-${Date.now()}`,
                        title: `IC Card Recharge (${passenger})`,
                        amount: act.val,
                        currency,
                        payer: passenger,
                        category: "Transport",
                        type: "local",
                        paymentMethod: { type: "transit", subType: null },
                        day: getTodayTripDay(),
                        date: new Date().toLocaleDateString()
                    };
                    state.expenses.push(exp);

                    saveICCardsToStorage();
                    saveExpensesToStorage();
                    updateIcEstimator();
                    renderLedger();
                    renderDebtSettlement();
                    showToast("✅ IC Top-up", `${passenger}'s card recharged by ${act.label}`);
                });
                icRechargeRow.appendChild(btn);
            });
        }

        // IC Card: Initial Balance Set button
        const icSetInitialBtn = document.getElementById("ic-set-initial-btn");
        const icInitialBalanceInput = document.getElementById("ic-initial-balance");
        if (icSetInitialBtn && icInitialBalanceInput) {
            icSetInitialBtn.addEventListener("click", () => {
                const passenger = (icPassengerSelect && icPassengerSelect.value) ? icPassengerSelect.value : state.activeUser;
                const val = parseFloat(icInitialBalanceInput.value);
                if (isNaN(val) || val < 0) { showToast("⚠️ Invalid", "Please enter a valid initial balance"); return; }
                const currency = state.destination === "japan" ? "JPY" : (state.destination === "malaysia" ? "MYR" : "CNY");
                if (!state.icCards[passenger]) state.icCards[passenger] = { JPY: 0, MYR: 0, CNY: 0, logs: [] };
                state.icCards[passenger][currency] = val;
                saveICCardsToStorage();
                updateIcEstimator();
                showToast("✅ Balance Set", `${passenger}'s IC card balance set to ${val}`);
                icInitialBalanceInput.value = "";
            });
        }

        // IC Card: Custom Recharge button
        const icCustomAmountInput = document.getElementById("ic-custom-amount");
        const icCustomRechargeBtn = document.getElementById("ic-custom-recharge-btn");
        if (icCustomRechargeBtn && icCustomAmountInput) {
            icCustomRechargeBtn.addEventListener("click", () => {
                const passenger = (icPassengerSelect && icPassengerSelect.value) ? icPassengerSelect.value : state.activeUser;
                const val = parseFloat(icCustomAmountInput.value);
                if (isNaN(val) || val <= 0) { showToast("⚠️ Invalid", "Enter a custom recharge amount"); return; }
                const currency = state.destination === "japan" ? "JPY" : (state.destination === "malaysia" ? "MYR" : "CNY");
                if (!state.icCards[passenger]) state.icCards[passenger] = { JPY: 0, MYR: 0, CNY: 0, logs: [] };
                state.icCards[passenger][currency] += val;

                // Log as local expense
                const exp = {
                    id: `exp-${Date.now()}`,
                    title: `IC Card Recharge (${passenger})`,
                    amount: val,
                    currency,
                    payer: passenger,
                    category: "Transport",
                    type: "local",
                    paymentMethod: { type: "transit", subType: null },
                    day: getTodayTripDay(),
                    date: new Date().toLocaleDateString()
                };
                state.expenses.push(exp);

                saveICCardsToStorage();
                saveExpensesToStorage();
                updateIcEstimator();
                renderLedger();
                renderDebtSettlement();
                const sym = currency === "MYR" ? "RM" : "¥";
                showToast("✅ IC Top-up", `${passenger}'s card recharged by ${sym}${val}`);
                icCustomAmountInput.value = "";
            });
        }


        function updateIcEstimator() {
            let passenger = (icPassengerSelect && icPassengerSelect.value) ? icPassengerSelect.value.trim() : "";
            if (!passenger) {
                passenger = state.activeUser || "Guest";
            }
            if (!state.icCards[passenger]) {
                state.icCards[passenger] = { JPY: 2000, MYR: 50, CNY: 100, logs: [] };
            }
            const cards = state.icCards[passenger];
            icCardHolder.textContent = passenger.toUpperCase();
            
            icCardSkin.className = "transit-card-skin";
            if (state.destination === "japan") {
                icCardSkin.classList.add("suica-skin"); icCardLogo.textContent = "ICOCA"; icCardNetwork.textContent = "Nagoya-Osaka-Kobe IC Card";
                icCardBalance.textContent = `¥${cards.JPY || 0}`;
            } else if (state.destination === "malaysia") {
                icCardSkin.classList.add("tng-skin"); icCardLogo.textContent = "Touch 'n Go"; icCardNetwork.textContent = "Malaysia Transit System";
                icCardBalance.textContent = `RM${(cards.MYR || 0).toFixed(2)}`;
            } else {
                icCardSkin.classList.add("shenzhen-skin"); icCardLogo.textContent = "Didi Wallet"; icCardNetwork.textContent = "Shenzhen Tong Account";
                icCardBalance.textContent = `¥${cards.CNY || 0}`;
            }

            icTransitLogs.innerHTML = "";
            const currency = state.destination === "japan" ? "JPY" : (state.destination === "malaysia" ? "MYR" : "CNY");
            const symbol = state.destination === "japan" ? "¥" : (state.destination === "malaysia" ? "RM" : "¥");

            const logs = cards.logs.filter(l => l.currency === currency);
            if (logs.length === 0) {
                icTransitLogs.innerHTML = `<div class="empty-state" style="padding:1rem;"><p style="font-size:0.75rem;">No planned transit logs.</p></div>`;
                icEstimatedFare.textContent = `${symbol}0`;
                icTopupNeeded.textContent = `${symbol}0 (HK$0.00)`;
                return;
            }

            let sum = 0;
            logs.forEach(l => {
                sum += l.fare;
                const item = document.createElement("div");
                item.className = "transit-log-item";
                item.innerHTML = `<span class="transit-log-desc">${l.desc}</span><span class="transit-log-fare">${symbol}${l.fare}</span>`;
                icTransitLogs.appendChild(item);
            });

            icEstimatedFare.textContent = `${symbol}${sum}`;
            const bal = cards[currency] || 0;
            const diff = sum - bal;
            if (diff > 0) {
                icTopupNeeded.textContent = `${symbol}${diff} (HK$${convertToHkd(diff, currency).toFixed(2)})`;
                icTopupNeeded.parentElement.classList.add("highlight-alert");
            } else {
                icTopupNeeded.textContent = `${symbol}0 (HK$0.00)`;
                icTopupNeeded.parentElement.classList.remove("highlight-alert");
            }
        }

        // Live multi-tab collaboration sync glow
        function glowSyncBadge() {
            syncStatusBadge.style.backgroundColor = "var(--success)";
            syncStatusBadge.style.borderColor = "var(--success)";
            syncStatusBadge.querySelector(".sync-text").style.color = "#ffffff";
            syncStatusBadge.querySelector(".sync-text").textContent = "Live Synced";
            setTimeout(() => {
                syncStatusBadge.style.backgroundColor = "";
                syncStatusBadge.style.borderColor = "";
                syncStatusBadge.querySelector(".sync-text").style.color = "";
                syncStatusBadge.querySelector(".sync-text").textContent = "Live Sync";
            }, 1500);
        }


        // -------------------------------------------------------------------------
        // FIRESTORE MULTI-TENANT TRIP NETWORKS & GROUP MANAGEMENT (RADMIN VPN STYLE)
        // -------------------------------------------------------------------------
        let networkUnsubscribe = null;

        async function loadUserNetworks(selectedId) {
            const selectEl = document.getElementById("active-group-select");
            if (!selectEl) return;

            selectEl.innerHTML = "";

            if (!state.firebaseUser || !db) {
                selectEl.disabled = true;
                const opt = document.createElement("option");
                opt.value = "";
                opt.textContent = "No Active Trip";
                selectEl.appendChild(opt);
                state.activeGroupId = "";
                return;
            }

            try {
                const q = query(collection(db, "trip_networks"), where("members", "array-contains", state.firebaseUser.uid));
                const querySnapshot = await getDocs(q);

                let hasSelectedId = false;
                querySnapshot.forEach((docSnap) => {
                    const opt = document.createElement("option");
                    opt.value = docSnap.id;
                    opt.textContent = docSnap.id;
                    selectEl.appendChild(opt);
                    if (docSnap.id === selectedId) {
                        hasSelectedId = true;
                    }
                });

                if (selectedId && !hasSelectedId) {
                    const opt = document.createElement("option");
                    opt.value = selectedId;
                    opt.textContent = selectedId;
                    selectEl.appendChild(opt);
                }

                if (selectEl.options.length === 0) {
                    selectEl.disabled = true;
                    const opt = document.createElement("option");
                    opt.value = "";
                    opt.textContent = "No Active Trip";
                    selectEl.appendChild(opt);
                    state.activeGroupId = "";
                } else {
                    selectEl.disabled = false;
                    const cachedId = selectedId || localStorage.getItem("travelActiveGroupId") || selectEl.options[0].value;
                    
                    let exists = false;
                    for (let i = 0; i < selectEl.options.length; i++) {
                        if (selectEl.options[i].value === cachedId) {
                            exists = true;
                            break;
                        }
                    }
                    const finalId = exists ? cachedId : selectEl.options[0].value;
                    
                    selectEl.value = finalId;
                    state.activeGroupId = finalId;
                    localStorage.setItem("travelActiveGroupId", finalId);
                    switchTripNetwork(finalId);
                }
            } catch (err) {
                console.error("Error loading user networks:", err);
                selectEl.disabled = true;
                const opt = document.createElement("option");
                opt.value = "";
                opt.textContent = "No Active Trip";
                selectEl.appendChild(opt);
                state.activeGroupId = "";
            }
        }

        function switchTripNetwork(groupId) {
            if (networkUnsubscribe) {
                networkUnsubscribe();
                networkUnsubscribe = null;
            }

            if (!groupId || groupId === "TRIP-2026" || !db) {
                state.activeGroupId = "TRIP-2026";
                loadAllData();
                generateCalendar();
                if (state.selectedDay !== null) {
                    renderActivitiesList();
                }
                renderLedger();
                renderDebtSettlement();
                updateIcEstimator();
                return;
            }

            try {
                networkUnsubscribe = onSnapshot(doc(db, "trip_networks", groupId), (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        state.activities = data.activities || [];
                        state.expenses = data.expenses || [];
                        if (data.icCards) {
                            state.icCards = data.icCards;
                        }
                        if (data.cashBalances) {
                            state.cashBalances = data.cashBalances;
                        }

                        // Extract group members from member names array (if stored in Firestore)
                        if (data.memberNames && data.memberNames.length > 0) {
                            state.groupMembers = data.memberNames;
                        } else if (data.members && typeof data.members === "object") {
                            // Legacy: members stored as {username: role}
                            state.groupMembers = Object.values(data.members);
                        }

                        // Self-healing: if the current user's display name is not in memberNames, append it to Firestore
                        if (state.activeUser && (!data.memberNames || !data.memberNames.includes(state.activeUser))) {
                            const docRef = doc(db, "trip_networks", groupId);
                            updateDoc(docRef, {
                                memberNames: arrayUnion(state.activeUser)
                            }).catch(err => console.error("Error auto-adding memberName:", err));
                        }

                        if (data.destination) {
                            state.destination = data.destination.toLowerCase();
                            localStorage.setItem("travelDestination", state.destination);
                            const destSelect = document.getElementById("destination-select");
                            if (destSelect) {
                                destSelect.value = state.destination;
                            }
                            updateDestinationUI();
                            saveICCardsToStorage();
                        }

                        updateProfileUI();
                        initializeFiredReminders();

                        generateCalendar();
                        if (state.selectedDay !== null) {
                            renderActivitiesList();
                        }
                        renderLedger();
                        renderDebtSettlement();
                        updateIcEstimator();
                        renderSplitPanel(state.groupMembers && state.groupMembers.length > 0 ? state.groupMembers : ["Alice","Bob","Charlie"]);
                        renderCashTracker();

                        glowSyncBadge();
                    } else {
                        console.warn(`Trip Network ${groupId} not found in Firestore.`);
                    }
                }, (err) => {
                    console.error("Error in network real-time sync listener:", err);
                });
            } catch (err) {
                console.error("Error setting up real-time listener:", err);
            }
        }

        // Modal triggers
        const networkModal = document.getElementById("network-modal");
        const networkModalBtn = document.getElementById("network-modal-btn");
        const closeNetworkModalBtn = document.getElementById("close-network-modal");
        const cancelNetworkBtns = document.querySelectorAll(".cancel-network-btn");

        if (networkModalBtn) {
            networkModalBtn.addEventListener("click", () => {
                if (!state.firebaseUser) {
                    showToast("Auth Error", "Please login with Google first.");
                    return;
                }
                openAuthModal(false);
                switchAuthTab("browse");
            });
        }

        if (closeNetworkModalBtn && networkModal) {
            closeNetworkModalBtn.addEventListener("click", () => {
                networkModal.classList.remove("open");
            });
        }

        cancelNetworkBtns.forEach((btn) => {
            btn.addEventListener("click", () => {
                if (networkModal) networkModal.classList.remove("open");
            });
        });

        // Network creation and joining actions
        const createNetworkBtn = document.getElementById("create-network-btn");
        const joinNetworkBtn = document.getElementById("join-network-btn");
        const networkNameInput = document.getElementById("network-name-input");
        const networkPasswordInput = document.getElementById("network-password-input");

        if (createNetworkBtn) {
            createNetworkBtn.addEventListener("click", async () => {
                const name = networkNameInput.value.trim();
                const password = networkPasswordInput.value;

                if (!name || !password) {
                    alert("Please fill in all fields.");
                    return;
                }

                if (!state.firebaseUser || !db) {
                    alert("Please login to manage networks.");
                    return;
                }

                // Immediate feedback
                alert("Creating network...");

                try {
                    const docRef = doc(db, "trip_networks", name);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        alert("Trip Network already exists. Please choose a unique name or join it.");
                        return;
                    }

                    const newNetwork = {
                        owner: state.firebaseUser.uid,
                        password: password,
                        members: [state.firebaseUser.uid],
                        memberNames: [state.activeUser || state.firebaseUser.displayName || "Owner"],
                        activities: [],
                        expenses: [],
                        icCards: {}
                    };

                    await setDoc(docRef, newNetwork);
                    
                    networkNameInput.value = "";
                    networkPasswordInput.value = "";
                    if (networkModal) networkModal.classList.remove("open");

                    alert("Success! Joined network.");

                    await loadUserNetworks(name);
                } catch (err) {
                    console.error("Error creating network:", err);
                    alert("Failed to create network: " + err.message);
                }
            });
        }

        if (joinNetworkBtn) {
            joinNetworkBtn.addEventListener("click", async () => {
                const name = networkNameInput.value.trim();
                const password = networkPasswordInput.value;

                if (!name || !password) {
                    alert("Please fill in all fields.");
                    return;
                }

                if (!state.firebaseUser || !db) {
                    alert("Please login to manage networks.");
                    return;
                }

                // Immediate feedback
                alert("Joining network...");

                try {
                    const docRef = doc(db, "trip_networks", name);
                    const docSnap = await getDoc(docRef);

                    if (!docSnap.exists()) {
                        alert("Error: Trip Network not found.");
                        return;
                    }

                    const data = docSnap.data();
                    if (data.password !== password) {
                        alert("Error: Incorrect password.");
                        return;
                    }

                    await updateDoc(docRef, {
                        members: arrayUnion(state.firebaseUser.uid),
                        memberNames: arrayUnion(state.activeUser || state.firebaseUser.displayName || "Member")
                    });

                    networkNameInput.value = "";
                    networkPasswordInput.value = "";
                    if (networkModal) networkModal.classList.remove("open");

                    alert("Success! Joined network.");

                    await loadUserNetworks(name);
                } catch (err) {
                    console.error("Error joining network:", err);
                    alert("Failed to join network: " + err.message);
                }
            });
        }

        // Active network dropdown switcher
        const activeGroupSelect = document.getElementById("active-group-select");
        if (activeGroupSelect) {
            activeGroupSelect.addEventListener("change", (e) => {
                const selectedVal = e.target.value;
                state.activeGroupId = selectedVal;
                localStorage.setItem("travelActiveGroupId", selectedVal);
                switchTripNetwork(selectedVal);
            });
        }

        // Bootstrap load
        loadAllData();
        updateProfileUI();

        // Default to current system date
        const todayDateObj = new Date();
        state.currentMonth = todayDateObj.getMonth();
        state.currentYear = todayDateObj.getFullYear();
        state.selectedDay = todayDateObj.getDate();

        generateCalendar();
        selectDay(state.selectedDay);

        updateDestinationUI();
        fetchPlacesDb();
        renderLedger();
        renderDebtSettlement();

        // Wallet V2 initial renders
        renderDaySelector();
        renderSplitPanel(state.groupMembers && state.groupMembers.length > 0 ? state.groupMembers : ["Alice","Bob","Charlie"]);
        renderCashTracker();
        updateExpenseTypePanels("global"); // default to global, show split panel



        // Auto-show login signup screen on very first launch
        if (state.activeUser === "Guest") {
            openAuthModal(true);
        }
    });
}

// -------------------------------------------------------------------------
// NODE EXPORTS (For automated testing)
// -------------------------------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        convertToHkd,
        findDijkstraRoute,
        calculateDebtSettlement,
        TRANSIT_NETWORKS,
        FX_RATES,
        timeToMinutes,
        minutesToTime,
        validateActivityInput,
        validateTimeSlotInput,
        hasTimeConflict,
        curatingFallbackDb,
        createPlaceCardElement
    };
}
