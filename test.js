const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

// Mock document and window for Node testing
const mockDocument = {
    addEventListener: () => {}
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
    // Mock Firebase functions so top-level calls in scheduler.js succeed
    firebaseConfig: {},
    initializeApp: () => ({}),
    getAuth: () => ({}),
    GoogleAuthProvider: class {}
};
sandbox.exports = sandbox.module.exports;

// Execute the modular scheduler code in a sandbox context
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const {
    convertToHkd,
    findDijkstraRoute,
    calculateDebtSettlement,
    FX_RATES
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

    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! ZERO BUGS DETECTED.");
} catch (err) {
    console.error("\n❌ TEST FAILED:", err);
    process.exit(1);
}
