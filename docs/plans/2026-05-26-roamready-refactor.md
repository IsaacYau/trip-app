# RoamReady Refactor Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Fix the onboarding popup issues, prevent page freezing, sync the active trip select dropdown, secure network entry with passwords, partition storage keys by group ID, and ensure new groups default to empty schedules.

**Architecture:** We will redesign the `auth-modal` into a modern 3-tabbed component ("Join Group", "Create Group", "Browse Networks"). We will update the persistent initialization logic so it doesn't overwrite authenticated users as "Guest" upon refresh, partition the localStorage keys dynamically as `travelActivities_[groupId]` to isolate group data, and perform password verification before joining.

**Tech Stack:** Vanilla HTML5, CSS3, ES6 Javascript (async/await), Firebase Auth, Firestore.

---

### Task 1: Refactor auth-modal HTML
**Files:**
- Modify: `scheduler.html:515-538`

**Step 1: Write the updated HTML structure for auth-modal**
Replace the single form in the `auth-modal` overlay with a beautiful 3-tab structure including public/private option fields.
```html
    <!-- Signup / Login Modal -->
    <div id="auth-modal" class="modal-overlay">
        <div class="modal-container" style="max-width: 440px; padding: 1.5rem;">
            <div class="modal-header" style="border-bottom: 2px solid var(--border); padding-bottom: 0.75rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                <h3 id="auth-modal-title" style="font-family: var(--font-heading); font-weight: 800; font-size: 1.25rem; display: flex; align-items: center; gap: 0.35rem; margin:0;">
                    <i data-lucide="key" style="width:18px; height:18px; color:var(--accent);"></i> Access RoamReady
                </h3>
            </div>
            
            <!-- Beautiful Tabs -->
            <div class="network-tabs" style="display: flex; border-bottom: 1px solid var(--border); margin-bottom: 1rem; gap: 0.5rem;">
                <button type="button" id="tab-join-btn" class="active" style="flex: 1; padding: 0.5rem; background: none; border: none; border-bottom: 3px solid var(--accent); color: var(--accent); font-weight: 700; cursor: pointer; font-size: 0.8rem;">Join Group</button>
                <button type="button" id="tab-create-btn" style="flex: 1; padding: 0.5rem; background: none; border: none; border-bottom: 3px solid transparent; color: var(--text-secondary); font-weight: 700; cursor: pointer; font-size: 0.8rem;">Create Group</button>
                <button type="button" id="tab-browse-btn" style="flex: 1; padding: 0.5rem; background: none; border: none; border-bottom: 3px solid transparent; color: var(--text-secondary); font-weight: 700; cursor: pointer; font-size: 0.8rem;">Browse Network</button>
            </div>

            <!-- Tab 1 Content: Join Existing Group -->
            <form id="join-group-form" class="modal-form">
                <div class="form-group" style="margin-bottom: 0.75rem;">
                    <label for="join-username" style="display: block; font-size: 0.75rem; font-weight: 750; margin-bottom: 0.35rem;">Your Name *</label>
                    <input type="text" id="join-username" placeholder="e.g. Isaac" required style="width: 100%; padding: 0.55rem; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-primary); font-size: 0.85rem;" autocomplete="off">
                </div>
                <div class="form-group" style="margin-bottom: 0.75rem;">
                    <label for="join-groupcode" style="display: block; font-size: 0.75rem; font-weight: 750; margin-bottom: 0.35rem;">Group / Trip Code *</label>
                    <input type="text" id="join-groupcode" placeholder="e.g. HK-GANG-2026" required style="width: 100%; padding: 0.55rem; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-primary); font-size: 0.85rem;" autocomplete="off">
                </div>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="join-password" style="display: block; font-size: 0.75rem; font-weight: 750; margin-bottom: 0.35rem;">Group Password (Optional if public) *</label>
                    <input type="password" id="join-password" placeholder="Enter group password" style="width: 100%; padding: 0.55rem; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-primary); font-size: 0.85rem;">
                </div>
                <div class="modal-actions" style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.25rem;">
                    <button type="submit" class="btn btn-accent" style="width: 100%;">Enter Group Trip</button>
                </div>
            </form>

            <!-- Tab 2 Content: Create New Group (Hidden by default) -->
            <form id="create-group-form" class="modal-form" style="display: none;">
                <div class="form-group" style="margin-bottom: 0.75rem;">
                    <label for="create-username" style="display: block; font-size: 0.75rem; font-weight: 750; margin-bottom: 0.35rem;">Your Name *</label>
                    <input type="text" id="create-username" placeholder="e.g. Isaac" required style="width: 100%; padding: 0.55rem; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-primary); font-size: 0.85rem;" autocomplete="off">
                </div>
                <div class="form-group" style="margin-bottom: 0.75rem;">
                    <label for="create-groupcode" style="display: block; font-size: 0.75rem; font-weight: 750; margin-bottom: 0.35rem;">New Group / Trip Code *</label>
                    <input type="text" id="create-groupcode" placeholder="e.g. TOKYO-EXP-2026" required style="width: 100%; padding: 0.55rem; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-primary); font-size: 0.85rem;" autocomplete="off">
                </div>
                <div class="form-group" style="margin-bottom: 0.75rem;">
                    <label for="create-password" style="display: block; font-size: 0.75rem; font-weight: 750; margin-bottom: 0.35rem;">Group Password *</label>
                    <input type="password" id="create-password" placeholder="Set a group password" required style="width: 100%; padding: 0.55rem; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-primary); font-size: 0.85rem;">
                </div>
                <div class="form-group checkbox-group" style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.35rem;">
                    <input type="checkbox" id="create-public" style="width: auto;">
                    <label for="create-public" style="font-size: 0.75rem; font-weight: 750;">Make Group Public (No password required to join)</label>
                </div>
                <div class="modal-actions" style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.25rem;">
                    <button type="submit" class="btn btn-accent" style="width: 100%;">Create & Enter Group</button>
                </div>
            </form>

            <!-- Tab 3 Content: Browse Network (Hidden by default) -->
            <div id="browse-group-section" style="display: none; flex-direction: column; gap: 0.75rem;">
                <div class="form-group" style="margin-bottom: 0.35rem;">
                    <label for="browse-username" style="display: block; font-size: 0.75rem; font-weight: 750; margin-bottom: 0.35rem;">Your Name *</label>
                    <input type="text" id="browse-username" placeholder="e.g. Isaac" required style="width: 100%; padding: 0.55rem; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-primary); font-size: 0.85rem;" autocomplete="off">
                </div>
                <div id="network-group-list" class="scrollbar-custom" style="max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; padding-right: 0.25rem; border: 1px solid var(--border); padding: 0.5rem; border-radius: var(--radius-sm); background: var(--bg-primary);">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); text-align: center; padding: 1rem;">Loading groups directory...</div>
                </div>
                <!-- Mini inline join form that appears when a private group is clicked -->
                <div id="browse-join-form" style="display: none; border-top: 1px solid var(--border); padding-top: 0.75rem; margin-top: 0.5rem;">
                    <div style="font-size: 0.75rem; font-weight: 750; color: var(--accent); margin-bottom: 0.35rem;">Selected Group: <span id="selected-browse-group-label" style="font-weight: 800; color: var(--text-primary);">None</span></div>
                    <div class="form-group" id="browse-password-container" style="margin-bottom: 0.75rem;">
                        <label for="browse-password" style="display: block; font-size: 0.75rem; font-weight: 750; margin-bottom: 0.35rem;">Enter Group Password *</label>
                        <input type="password" id="browse-password" placeholder="Enter group password" style="width: 100%; padding: 0.55rem; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-primary); font-size: 0.85rem;">
                    </div>
                    <button type="button" id="browse-submit-btn" class="btn btn-accent" style="width: 100%;">Join Selected Group</button>
                </div>
            </div>
            
        </div>
    </div>
```

---

### Task 2: Implement styling for tabs & scrollbar
**Files:**
- Modify: `scheduler.css:2233-2247`

**Step 1: Write styling rules for popup tabs and active status**
Ensure beautiful interactive animations and scrollbars.
```css
/* Radmin VPN Inspired Network Modal Tabs Styling */
.network-tabs button {
    transition: var(--transition);
}
.network-tabs button:hover {
    color: var(--accent);
    background-color: rgba(99, 102, 241, 0.04);
}
.network-tabs button.active {
    color: var(--accent) !important;
    border-bottom: 3px solid var(--accent) !important;
}

.scrollbar-custom::-webkit-scrollbar {
    width: 6px;
}
.scrollbar-custom::-webkit-scrollbar-track {
    background: transparent;
}
.scrollbar-custom::-webkit-scrollbar-thumb {
    background-color: var(--border);
    border-radius: 3px;
}
```

---

### Task 3: Refactor State & loadAllData() Group-Specific Key Partitioning
**Files:**
- Modify: `scheduler.js:553-629`

**Step 1: Write partitioned localStorage saves and load**
Update the localStorage load and save routines to dynamically load activities, expenses, and IC cards using `travelActivities_${state.activeGroupId}` style keys. If `activeGroupId` is `"TRIP-2026"` or blank, load/save to global keys to preserve backward compatibility.
```javascript
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
```

---

### Task 4: Fix Persistent Login Refresh Onboarding Bug
**Files:**
- Modify: `scheduler.js:1443-1494`

**Step 1: Write updated Firebase Authentication and persistent state sync**
Upon user login/auth-state change, display immediate feedback, pre-fill inputs in the new 3-tab popup modal, and show the popup directly without forcing a refresh. Do not overwrite display name with Guest in `loadAllData()` when group is empty.
```javascript
        if (auth && provider) {
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    const firstTimeLogin = !state.firebaseUser;
                    state.firebaseUser = user;
                    state.activeUser = user.displayName || user.email || "FirebaseUser";
                    localStorage.setItem("travelActiveUser", state.activeUser);

                    auth0LoginBtn.style.display = "none";
                    auth0ProfileDiv.style.display = "flex";
                    auth0UserAvatar.src = user.photoURL || "";
                    
                    updateProfileUI();
                    loadUserNetworks().then(() => {
                        // Pre-fill usernames across all forms
                        document.getElementById("join-username").value = state.activeUser;
                        document.getElementById("create-username").value = state.activeUser;
                        document.getElementById("browse-username").value = state.activeUser;

                        // Give dynamic toast feedback if first login in this session
                        if (firstTimeLogin) {
                            showToast("Collaborative Sync", `Welcome back, ${state.activeUser}!`);
                        }

                        // Open onboarding modal immediately to enter group details
                        if (!state.groupCode || state.groupCode === "TRIP-2026") {
                            openAuthModal(true);
                        }
                    });
                } else {
                    state.firebaseUser = null;
                    auth0LoginBtn.style.display = "inline-flex";
                    auth0ProfileDiv.style.display = "none";
                    
                    localStorage.removeItem("travelActiveUser");
                    localStorage.removeItem("travelGroupCode");
                    localStorage.removeItem("travelMappedRole");
                    localStorage.removeItem("travelActiveGroupId");
                    
                    state.activeUser = "Guest";
                    state.groupCode = "TRIP-2026";
                    state.mappedRole = "Alice";
                    state.activeGroupId = "TRIP-2026";
                    
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
```

---

### Task 5: Implement Unified 3-Tab Group Creation, Joining, and Directory Browsing
**Files:**
- Modify: `scheduler.js:1345-1399`
- Modify: `scheduler.js:2320-2561`

**Step 1: Write tab switching logic**
Hook up button clicks for `tab-join-btn`, `tab-create-btn`, and `tab-browse-btn`.
```javascript
        const tabJoinBtn = document.getElementById("tab-join-btn");
        const tabCreateBtn = document.getElementById("tab-create-btn");
        const tabBrowseBtn = document.getElementById("tab-browse-btn");
        const joinGroupForm = document.getElementById("join-group-form");
        const createGroupForm = document.getElementById("create-group-form");
        const browseGroupSection = document.getElementById("browse-group-section");

        function switchAuthTab(activeTab) {
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

        tabJoinBtn.addEventListener("click", () => switchAuthTab("join"));
        tabCreateBtn.addEventListener("click", () => switchAuthTab("create"));
        tabBrowseBtn.addEventListener("click", () => switchAuthTab("browse"));
```

**Step 2: Write Join/Create group submissions with password validation**
Implement fully secure password checking, new group creation, and dynamic adding to active list dropdown without freezes.
```javascript
        // Join form submit
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
                        members: arrayUnion(state.firebaseUser.uid)
                    });
                }

                state.activeUser = username;
                state.groupCode = groupCode;
                state.mappedRole = "Alice"; // Default role
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

        // Create form submit
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

                const passwordVal = isPublic ? "" : setPassword;
                const newNetwork = {
                    owner: state.firebaseUser.uid,
                    password: passwordVal,
                    members: [state.firebaseUser.uid],
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
```

**Step 3: Write Directory Browsing list dynamically**
Retrieve all networks from Firestore, display badges (green for public, locked/gray for private), and implement inline password prompts.
```javascript
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

                    row.addEventListener("mouseover", () => {
                        row.style.borderColor = "var(--accent)";
                    });
                    row.addEventListener("mouseout", () => {
                        if (selectedBrowseGroup !== name) {
                            row.style.borderColor = "var(--border)";
                        }
                    });

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
                    subtitle.textContent = `${data.members ? data.members.length : 1} Members`;
                    subtitle.style.fontSize = "0.65rem";
                    subtitle.style.color = "var(--text-secondary)";
                    info.appendChild(subtitle);

                    row.appendChild(info);

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

                    row.appendChild(badge);

                    row.addEventListener("click", () => {
                        // Reset all border colors
                        Array.from(listContainer.children).forEach(child => {
                            child.style.borderColor = "var(--border)";
                        });
                        row.style.borderColor = "var(--accent)";
                        
                        selectedBrowseGroup = name;
                        const joinForm = document.getElementById("browse-join-form");
                        const selectedLabel = document.getElementById("selected-browse-group-label");
                        const pwdContainer = document.getElementById("browse-password-container");
                        
                        selectedLabel.textContent = name;
                        joinForm.style.display = "block";
                        
                        if (isPrivate) {
                            pwdContainer.style.display = "block";
                            document.getElementById("browse-password").required = true;
                        } else {
                            pwdContainer.style.display = "none";
                            document.getElementById("browse-password").required = false;
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

        // Browse join form button click
        document.getElementById("browse-submit-btn").addEventListener("click", async () => {
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

                if (isPrivate && data.password !== password) {
                    showToast("Auth Error", "Incorrect group password.");
                    return;
                }

                if (!data.members.includes(state.firebaseUser.uid)) {
                    await updateDoc(docRef, {
                        members: arrayUnion(state.firebaseUser.uid)
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
```

---

### Task 6: Run verification and tests
**Files:**
- Test: `test.js`

**Step 1: Execute test runner**
Run `node test.js` to ensure zero regressions in the routing optimizer, conversion modules, and calendar logic.
Expected: `ALL TESTS PASSED SUCCESSFULLY! ZERO BUGS DETECTED.`
