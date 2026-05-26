# RoamReady Part 2 Refactoring Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Implement a close button for the Access RoamReady popup, delete manual save/load buttons, automatically load and sync data, remove TRIP-2026 placeholders, disable active trip dropdown when not in a group, and allow group creators to delete their groups and display group creators in the directory.

**Architecture:** We will add a close button to `auth-modal` that dismisses the popup overlay, strip the save/load buttons from the DOM, refactor `loadUserNetworks` to dynamically disable/enable `<select id="active-group-select">` and omit TRIP-2026, save `ownerName` during setDoc, display creators next to their groups in the directory list, and show a delete button for owned groups.

**Tech Stack:** HTML5, CSS3, ES6 Javascript, Firebase Auth, Firestore.

---

### Task 8: Add close button to auth-modal
**Files:**
- Modify: `scheduler.html:515-525`
- Modify: `scheduler.js:686-694`

**Step 1: Write close button in auth-modal**
Add a clean button to `scheduler.html` with an ID `close-auth-modal`.
```html
            <div class="modal-header" style="border-bottom: 2px solid var(--border); padding-bottom: 0.75rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                <h3 id="auth-modal-title" style="font-family: var(--font-heading); font-weight: 800; font-size: 1.25rem; display: flex; align-items: center; gap: 0.35rem; margin:0;">
                    <i data-lucide="key" style="width:18px; height:18px; color:var(--accent);"></i> Access RoamReady
                </h3>
                <button class="close-modal-btn" id="close-auth-modal"><i data-lucide="x"></i></button>
            </div>
```

**Step 2: Add click event listener in scheduler.js**
Bind `close-auth-modal` to close the modal.
```javascript
        const closeAuthModalBtn = document.getElementById("close-auth-modal");
        if (closeAuthModalBtn) {
            closeAuthModalBtn.addEventListener("click", () => {
                closeAuthModal();
            });
        }
```

---

### Task 9: Remove Save Plan and Load Saved buttons
**Files:**
- Modify: `scheduler.html:75-82`

**Step 1: Remove buttons from HTML**
Delete the `.action-row` containing `save-schedule` and `load-schedule` buttons so saving and loading are entirely automated.
```html
            <div class="section-header">
                <div>
                    <h2>Interactive Travel Scheduler</h2>
                    <p class="subtitle">Plan your journey step-by-step and manage reminders.</p>
                </div>
            </div>
```

---

### Task 10: Delete TRIP-2026 placeholder and disable dropdown when not in a group
**Files:**
- Modify: `scheduler.html:31-33`
- Modify: `scheduler.js:2367-2418`

**Step 1: Remove default option in HTML**
Make the dropdown empty by default.
```html
                <select id="active-group-select" class="header-select" title="Choose Active Trip" style="font-weight: 750;" disabled>
                </select>
```

**Step 2: Rewrite loadUserNetworks in scheduler.js**
Remove the TRIP-2026 default option, dynamically query active groups, and disable the dropdown if empty.
```javascript
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
                    selectEl.value = cachedId;
                    state.activeGroupId = cachedId;
                    localStorage.setItem("travelActiveGroupId", cachedId);
                    switchTripNetwork(cachedId);
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
```

---

### Task 11: Group deletion and display creator
**Files:**
- Modify: `scheduler.js:1546-1744` (around setDoc and loadBrowseNetworksList)

**Step 1: Add ownerName during group creation**
Update the group creation setDoc payload to include `ownerName: state.activeUser`.
```javascript
                const newNetwork = {
                    owner: state.firebaseUser.uid,
                    ownerName: state.activeUser,
                    password: passwordVal,
                    members: [state.firebaseUser.uid],
                    activities: [],
                    expenses: [],
                    icCards: {}
                };
```

**Step 2: Render ownerName and delete button in Browse list**
Modify `loadBrowseNetworksList` to render the group creator name and a red delete icon next to groups owned by the active user.
```javascript
                querySnapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const name = docSnap.id;
                    const isPrivate = data.password && data.password.trim().length > 0;
                    const isOwner = data.owner === state.firebaseUser.uid;
                    
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
                    subtitle.textContent = `${data.members ? data.members.length : 1} Members${creatorLabel}`;
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
                                    
                                    // If active group was deleted, clear it
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
```

---

### Task 12: Verify all changes
**Files:**
- Test: `test.js`

**Step 1: Execute test suite**
Verify there are no regressions by running `node test.js`.
