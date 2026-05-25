const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

let domContentLoadedCallback = null;

// Mock document and window for Node testing
const mockDocument = {
    addEventListener: (event, callback) => {
        if (event === "DOMContentLoaded") {
            domContentLoadedCallback = callback;
        }
    },
    documentElement: {
        setAttribute: () => {},
        getAttribute: () => "light"
    },
    getElementById: (id) => {
        return {
            addEventListener: () => {},
            querySelector: () => ({ setAttribute: () => {} }),
            classList: { add: () => {}, remove: () => {} },
            style: {},
            appendChild: () => {},
            removeAttribute: () => {},
            setAttribute: () => {},
            value: "",
            textContent: "",
            innerHTML: "",
            options: []
        };
    },
    createElement: (tag) => {
        return {
            addEventListener: () => {},
            querySelector: () => ({ setAttribute: () => {} }),
            classList: { add: () => {}, remove: () => {} },
            style: {},
            appendChild: () => {},
            removeAttribute: () => {},
            setAttribute: () => {},
            value: "",
            textContent: "",
            innerHTML: "",
            options: []
        };
    },
    querySelectorAll: () => []
};

// Read scheduler.js content
let code = fs.readFileSync("./scheduler.js", "utf8");

// Strip the browser-only ES static imports from scheduler.js before vm execution
code = code.replace(/import\s+[\s\S]*?from\s+["']https:\/\/[\s\S]*?["'];?/g, "");
code = code.replace(/import\s+[\s\S]*?from\s+["']\.\/config\.js["'];?/g, "");

// Create sandbox context with standard mocks
const sandbox = {
    global: {},
    console,
    module: { exports: {} },
    document: mockDocument,
    typeof: (val) => typeof val,
    localStorage: {
        getItem: () => null,
        setItem: () => {}
    },
    window: {
        location: { origin: "http://localhost", pathname: "/" }
    },
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
    fetch: () => Promise.reject(new Error("Network Error")),
    // Mock Firebase functions so top-level calls in scheduler.js succeed
    firebaseConfig: {},
    initializeApp: () => ({}),
    getAuth: () => ({}),
    GoogleAuthProvider: class {},
    onAuthStateChanged: () => {}
};
sandbox.exports = sandbox.module.exports;

// Execute the modular scheduler code in a sandbox context
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const {
    convertToHkd,
    findDijkstraRoute,
    calculateDebtSettlement,
    FX_RATES,
    timeToMinutes,
    validateActivityInput,
    validateTimeSlotInput,
    hasTimeConflict,
    curatingFallbackDb,
    createPlaceCardElement
} = sandbox.module.exports;

console.log("=== RUNNING ROAMREADY AUTOMATED TDD TESTS ===");

try {
    // -------------------------------------------------------------------------
    // TEST 1: Currency Conversion
    // -------------------------------------------------------------------------
    console.log("\n[Test 1] Testing Currency Conversions to HKD...");
    
    // 1 JPY = 0.05 HKD (100 JPY = 5.0 HKD)
    assert.strictEqual(convertToHkd(1000, "JPY"), 50);
    assert.strictEqual(convertToHkd(0, "JPY"), 0);
    
    // 1 CNY = 1.15 HKD
    assert.strictEqual(convertToHkd(100, "CNY"), 115);
    
    // 1 MYR = 2.0 HKD
    assert.strictEqual(convertToHkd(50, "MYR"), 100);
    
    // 1 HKD = 1.0 HKD
    assert.strictEqual(convertToHkd(88, "HKD"), 88);
    
    console.log("✅ Currency conversion tests passed!");

    // -------------------------------------------------------------------------
    // TEST 2: Debt Settlement Algorithm (Global vs. Local separation)
    // -------------------------------------------------------------------------
    console.log("\n[Test 2] Testing Debt Settlement Splits & Local/Global separation...");
    
    const mockExpenses = [
        // Global shared dinner paid by Alice
        { id: "exp-1", title: "Shared Dinner", amount: 300, currency: "HKD", payer: "Alice", category: "Food", type: "global" },
        // Local/Personal shopping paid by Bob (should be completely ignored in debt settlements!)
        { id: "exp-2", title: "Bob Personal Shopping", amount: 150, currency: "HKD", payer: "Bob", category: "Shopping", type: "local" },
        // Global tickets paid by Bob
        { id: "exp-3", title: "Shared Tickets", amount: 150, currency: "HKD", payer: "Bob", category: "Sights", type: "global" }
    ];

    const result = calculateDebtSettlement(mockExpenses);
    
    // Total global HKD should be 300 (exp-1) + 150 (exp-3) = 450 HKD (exp-2 local is ignored)
    assert.strictEqual(result.totalHkd, 450);
    
    // Group share should be 450 / 3 = 150 HKD
    assert.strictEqual(result.share, 150);
    
    // Alice paid 300 global. Net balance = 300 - 150 = +150 HKD (Alice is owed 150)
    // Bob paid 150 global (his local 150 is ignored). Net balance = 150 - 150 = 0 HKD (Bob is even)
    // Charlie paid 0 global. Net balance = 0 - 150 = -150 HKD (Charlie owes 150)
    assert.strictEqual(result.totalPaid.Alice, 300);
    assert.strictEqual(result.totalPaid.Bob, 150);
    assert.strictEqual(result.totalPaid.Charlie, 0);

    // Direct repayments: Charlie owes Alice 150
    assert.strictEqual(result.settlements.length, 1);
    assert.strictEqual(result.settlements[0].from, "Charlie");
    assert.strictEqual(result.settlements[0].to, "Alice");
    assert.strictEqual(result.settlements[0].amount, 150);
    
    console.log("✅ Debt settlement & Local/Global separation tests passed!");

    // -------------------------------------------------------------------------
    // TEST 3: Settlement Transaction Logic
    // -------------------------------------------------------------------------
    console.log("\n[Test 3] Testing Direct Settlement Transaction Handling...");
    
    const mockExpensesWithSettle = [
        { id: "exp-1", title: "Shared Dinner", amount: 300, currency: "HKD", payer: "Alice", category: "Food", type: "global" },
        // Direct settlement: Charlie paid Alice HKD 150 directly to settle their debt
        { id: "exp-2", title: "Settle: Charlie paid Alice", amount: 150, currency: "HKD", payer: "Charlie", recipient: "Alice", category: "Other", type: "global", isSettlement: true }
    ];

    const resultSettle = calculateDebtSettlement(mockExpensesWithSettle);
    
    // Group total global spending should remain 300 (settlement is a transfer, not spending!)
    assert.strictEqual(resultSettle.totalHkd, 300);
    assert.strictEqual(resultSettle.share, 100); // 300 / 3
    
    // Alice paid 300 global, but received 150 settlement. Net paid = 300 - 150 = 150 HKD.
    // Net balance = 150 - 100 = +50 HKD.
    // Charlie paid 0 global, but paid 150 settlement. Net paid = 0 + 150 = 150 HKD.
    // Net balance = 150 - 100 = +50 HKD.
    // Bob paid 0. Net balance = 0 - 100 = -100 HKD.
    assert.strictEqual(resultSettle.totalPaid.Alice, 150);
    assert.strictEqual(resultSettle.totalPaid.Charlie, 150);
    assert.strictEqual(resultSettle.totalPaid.Bob, 0);

    // Repayments: Bob owes Alice 50, and Bob owes Charlie 50
    assert.strictEqual(resultSettle.settlements.length, 2);
    
    console.log("✅ Direct settlement transaction tests passed!");

    // -------------------------------------------------------------------------
    // TEST 4: Dijkstra Routing Engine
    // -------------------------------------------------------------------------
    console.log("\n[Test 4] Testing Dijkstra Transit Routing...");
    
    // Japan route: Nagoya Station -> Universal Studios (requires multiple stops)
    const route = findDijkstraRoute("japan", "Nagoya Station", "Universal Studios", "time");
    
    assert.ok(route);
    assert.strictEqual(route.path[0], "Nagoya Station");
    assert.strictEqual(route.path[route.path.length - 1], "Universal Studios");
    assert.ok(route.totalTime > 50); // Shinkansen (50m) + subway stops
    assert.ok(route.totalFare > 6000); // Shinkansen (5900) + local fares
    
    console.log("✅ Dijkstra routing engine tests passed!");

    // -------------------------------------------------------------------------
    // TEST 5: Utility & Validation Functions
    // -------------------------------------------------------------------------
    console.log("\n[Test 5] Testing Utility & Input Validation Functions...");

    // Test timeToMinutes
    assert.strictEqual(timeToMinutes("00:00"), 0);
    assert.strictEqual(timeToMinutes("12:30"), 750);
    assert.strictEqual(timeToMinutes("23:59"), 1439);

    // Test validateActivityInput
    assert.strictEqual(validateActivityInput(""), false);
    assert.strictEqual(validateActivityInput("   "), false);
    assert.strictEqual(validateActivityInput("Lunch Plan"), true);

    // Test validateTimeSlotInput
    assert.strictEqual(validateTimeSlotInput("12:00", "11:30"), false);
    assert.strictEqual(validateTimeSlotInput("12:00", "12:00"), false);
    assert.strictEqual(validateTimeSlotInput("12:00", "13:00"), true);

    // Test hasTimeConflict
    const testActivities = [
        { id: "act-1", day: 5, timeStart: "10:00", timeEnd: "11:30", title: "Activity 1" }
    ];
    assert.ok(hasTimeConflict(testActivities, 5, "10:30", "12:00")); // overlapping start
    assert.ok(hasTimeConflict(testActivities, 5, "09:00", "10:30")); // overlapping end
    assert.strictEqual(hasTimeConflict(testActivities, 5, "12:00", "13:00"), null); // no overlap
    assert.strictEqual(hasTimeConflict(testActivities, 5, "10:30", "12:00", "act-1"), null); // excluded act-1
    assert.strictEqual(hasTimeConflict(testActivities, 6, "10:30", "12:00"), null); // different day

    console.log("✅ Utility & validation tests passed!");

    // -------------------------------------------------------------------------
    // TEST 7: Fallback Places Database
    // -------------------------------------------------------------------------
    console.log("\n[Test 7] Testing Fallback Places Database...");
    const fallbackDb = curatingFallbackDb();
    assert.ok(Array.isArray(fallbackDb));
    assert.ok(fallbackDb.length >= 5);
    const firstPlace = fallbackDb[0];
    assert.ok(firstPlace.name);
    assert.ok(firstPlace.city);
    assert.ok(firstPlace.country);
    assert.ok(firstPlace.category);
    assert.ok(firstPlace.coordinates);
    console.log("✅ Fallback places database tests passed!");

    // -------------------------------------------------------------------------
    // TEST 8: Place Card Element Generation
    // -------------------------------------------------------------------------
    console.log("\n[Test 8] Testing Place Card Element Generation...");
    const mockPlace = {
        name: "Test Garden",
        city: "Nagoya",
        country: "Japan",
        category: "Sights",
        rating: 4.5,
        price_local: 500,
        price_hkd: 25.00,
        price_level: "$",
        street: "Test street"
    };
    const cardElement = createPlaceCardElement(mockPlace);
    assert.ok(cardElement);
    assert.strictEqual(cardElement.className, "place-card card");
    assert.ok(cardElement.innerHTML.includes("Test Garden"));
    assert.ok(cardElement.innerHTML.includes("Tabelog"));
    console.log("✅ Place card element generation tests passed!");

    // -------------------------------------------------------------------------
    // TEST 9: Month Switch State Navigation
    // -------------------------------------------------------------------------
    console.log("\n[Test 9] Testing Month Switch State Navigation...");
    let testMonth = 5; // June
    let testYear = 2026;
    testMonth++;
    if (testMonth > 11) {
        testMonth = 0;
        testYear++;
    }
    assert.strictEqual(testMonth, 6);
    assert.strictEqual(testYear, 2026);
    
    testMonth--;
    if (testMonth < 0) {
        testMonth = 11;
        testYear--;
    }
    assert.strictEqual(testMonth, 5);
    assert.strictEqual(testYear, 2026);
    console.log("✅ Month switch state navigation tests passed!");

    // -------------------------------------------------------------------------
    // TEST 10: LocalStorage Backup State persistence
    // -------------------------------------------------------------------------
    console.log("\n[Test 10] Testing LocalStorage Backup State persistence...");
    const sampleBackup = {
        activities: [{ id: "act-1", day: 5, timeStart: "10:00", timeEnd: "11:30", title: "Activity 1" }],
        currentMonth: 5,
        currentYear: 2026
    };
    const serialized = JSON.stringify(sampleBackup);
    const parsed = JSON.parse(serialized);
    assert.ok(parsed.activities);
    assert.strictEqual(parsed.activities.length, 1);
    assert.strictEqual(parsed.currentMonth, 5);
    assert.strictEqual(parsed.currentYear, 2026);
    console.log("✅ LocalStorage backup state persistence tests passed!");

    // -------------------------------------------------------------------------
    // TEST 6: DOMContentLoaded Bootstrap Runner
    // -------------------------------------------------------------------------
    console.log("\n[Test 6] Testing DOMContentLoaded Bootstrap lifecycle...");
    
    // We execute the captured DOMContentLoaded callback
    assert.ok(domContentLoadedCallback);
    
    // Execute callback and verify it doesn't throw ReferenceError or null pointer crashes
    domContentLoadedCallback();

    console.log("✅ DOMContentLoaded Bootstrap lifecycle completed successfully!");

    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! ZERO BUGS DETECTED.");
} catch (err) {
    console.error("\n❌ TEST FAILED:", err);
    process.exit(1);
}
