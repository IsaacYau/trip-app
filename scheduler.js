document.addEventListener("DOMContentLoaded", () => {
    // -------------------------------------------------------------------------
    // 1. STATE MANAGEMENT & EXTENSIONS
    // -------------------------------------------------------------------------
    const state = {
        activities: [], // Array of { id, day, title, timeStart, timeEnd, reminder, reminderOffset, location }
        selectedDay: null,
        firedReminders: new Set(), // Track triggered activity IDs
        currentYear: new Date().getFullYear(),
        currentMonth: new Date().getMonth(), // 0-indexed (Jan = 0)

        // New Premium Features State
        destination: "japan", // "japan", "china", "malaysia"
        activeUser: "Alice", // "Alice", "Bob", "Charlie"
        expenses: [], // Array of { id, title, amount, currency, payer, category, date }
        icCards: {
            Alice: { JPY: 2000, MYR: 50, CNY: 100, logs: [] },
            Bob: { JPY: 2000, MYR: 50, CNY: 100, logs: [] },
            Charlie: { JPY: 2000, MYR: 50, CNY: 100, logs: [] }
        }
    };

    // Month name utility
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

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

    function convertToHkd(amount, currency) {
        const rate = FX_RATES[currency] || 1.0;
        return amount * rate;
    }

    function resetICCards() {
        state.icCards = {
            Alice: { JPY: 2000, MYR: 50, CNY: 100, logs: [] },
            Bob: { JPY: 2000, MYR: 50, CNY: 100, logs: [] },
            Charlie: { JPY: 2000, MYR: 50, CNY: 100, logs: [] }
        };
    }

    // Load initial data from localStorage
    function loadAllData() {
        // 1. Activities
        const storedAct = localStorage.getItem("travelActivities");
        if (storedAct) {
            try {
                state.activities = JSON.parse(storedAct);
            } catch (e) {
                console.error("Error parsing stored activities, resetting.", e);
                state.activities = [];
            }
        }

        // 2. Destination
        state.destination = localStorage.getItem("travelDestination") || "japan";
        document.getElementById("destination-select").value = state.destination;

        // 3. User
        state.activeUser = localStorage.getItem("travelActiveUser") || "Alice";
        document.getElementById("user-select").value = state.activeUser;
        document.getElementById("ic-passenger").value = state.activeUser;

        // 4. Expenses Ledger
        const storedExpenses = localStorage.getItem("travelExpenses");
        if (storedExpenses) {
            try {
                state.expenses = JSON.parse(storedExpenses);
            } catch (e) {
                state.expenses = [];
            }
        } else {
            // Seed default expenses to look premium and complete
            state.expenses = [
                { id: "exp-1", title: "Nagoya Castle Tickets", amount: 1500, currency: "JPY", payer: "Alice", category: "Sights", date: new Date().toLocaleDateString() },
                { id: "exp-2", title: "Jalan Alor Street Food", amount: 65, currency: "MYR", payer: "Bob", category: "Food", date: new Date().toLocaleDateString() },
                { id: "exp-3", title: "Didi Ride Shenzhen Futian", amount: 48, currency: "CNY", payer: "Charlie", category: "Transport", date: new Date().toLocaleDateString() }
            ];
            saveExpensesToStorage();
        }

        // 5. IC Cards
        const storedIC = localStorage.getItem("travelICCards");
        if (storedIC) {
            try {
                state.icCards = JSON.parse(storedIC);
            } catch (e) {
                resetICCards();
            }
        } else {
            resetICCards();
            saveICCardsToStorage();
        }
    }

    // Storage saves
    function saveActivitiesToStorage() {
        localStorage.setItem("travelActivities", JSON.stringify(state.activities));
    }

    function saveExpensesToStorage() {
        localStorage.setItem("travelExpenses", JSON.stringify(state.expenses));
    }

    function saveICCardsToStorage() {
        localStorage.setItem("travelICCards", JSON.stringify(state.icCards));
    }

    // -------------------------------------------------------------------------
    // 2. DOM ELEMENTS & LISTENERS
    // -------------------------------------------------------------------------
    const calendarElement = document.getElementById("calendar");
    const selectedDayLabel = document.getElementById("selected-day-label");
    const placeInfo = document.getElementById("place-info");
    const addActivityBtn = document.getElementById("add-activity-btn");
    const saveScheduleBtn = document.getElementById("save-schedule");
    const loadScheduleBtn = document.getElementById("load-schedule");
    const currentMonthYearLabel = document.getElementById("current-month-year");
    
    // Theme Toggle
    const themeToggleBtn = document.getElementById("theme-toggle");
    
    // Modal Elements
    const activityModal = document.getElementById("activity-modal");
    const activityForm = document.getElementById("activity-form");
    const modalTitle = document.getElementById("modal-title");
    const modalDayInput = document.getElementById("modal-day");
    const modalActivityIdInput = document.getElementById("modal-activity-id");
    const activityTitleInput = document.getElementById("activity-title");
    const activityStartInput = document.getElementById("activity-start");
    const activityEndInput = document.getElementById("activity-end");
    const activityLocationInput = document.getElementById("activity-location");
    const activityReminderCheckbox = document.getElementById("activity-reminder");
    const reminderTimeContainer = document.getElementById("reminder-time-container");
    const activityReminderOffsetSelect = document.getElementById("activity-reminder-offset");
    const cancelModalBtn = document.getElementById("cancel-modal");
    const closeModalBtn = document.getElementById("close-modal");

    // Toast Alert Elements
    const reminderToast = document.getElementById("reminder-toast");
    const toastTitle = document.getElementById("toast-title");
    const toastBody = document.getElementById("toast-body");
    const closeToastBtn = document.getElementById("close-toast");

    // New premium feature elements
    const destSelect = document.getElementById("destination-select");
    const userSelect = document.getElementById("user-select");
    const syncStatusBadge = document.getElementById("sync-status");
    
    // Transit selectors
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
    
    // Nearby Places filters & GPS
    const placesSearch = document.getElementById("places-search");
    const placesCitySelect = document.getElementById("places-city-select");
    const placesGrid = document.getElementById("places-grid");
    const gpsBtn = document.getElementById("gps-discover-btn");
    const gpsStatusBar = document.getElementById("gps-status-bar");
    const gpsStatusText = document.getElementById("gps-status-text");
    const gpsRecHeader = document.getElementById("gps-recommendations-header");
    const gpsRecGrid = document.getElementById("gps-recommendations");

    // Expenses ledger
    const expenseForm = document.getElementById("expense-form");
    const expenseTitleInput = document.getElementById("expense-title");
    const expenseCategoryInput = document.getElementById("expense-category");
    const expenseAmountInput = document.getElementById("expense-amount");
    const expenseCurrencySelect = document.getElementById("expense-currency");
    const expensePayerSelect = document.getElementById("expense-payer");
    const expenseConvertedText = document.getElementById("expense-converted-text");
    const expensesList = document.getElementById("expenses-list");
    const debtList = document.getElementById("debt-list");
    const simulateSyncBtn = document.getElementById("simulate-sync-btn");

    // IC Card elements
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
    // 3. THEME TOGGLE LOGIC
    // -------------------------------------------------------------------------
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
        const icon = themeToggleBtn.querySelector("i");
        if (theme === "dark") {
            icon.setAttribute("data-lucide", "sun");
        } else {
            icon.setAttribute("data-lucide", "moon");
        }
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    // -------------------------------------------------------------------------
    // 4. SPA TAB SWITCHING
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // 5. INPUT VALIDATION & CONFLICT DETECTION
    // -------------------------------------------------------------------------
    function validateActivityInput(title) {
        return title && title.trim().length > 0;
    }

    function validateTimeSlotInput(start, end) {
        if (!start || !end) return false;
        const [sh, sm] = start.split(":").map(Number);
        const [eh, em] = end.split(":").map(Number);
        const startMinutes = sh * 60 + sm;
        const endMinutes = eh * 60 + em;
        return startMinutes < endMinutes;
    }

    function timeToMinutes(timeStr) {
        const [h, m] = timeStr.split(":").map(Number);
        return h * 60 + m;
    }

    function hasTimeConflict(day, startStr, endStr, excludeId = null) {
        const startMin = timeToMinutes(startStr);
        const endMin = timeToMinutes(endStr);

        const dailyActivities = state.activities.filter(act => 
            act.day === Number(day) && act.id !== excludeId
        );

        for (const act of dailyActivities) {
            const actStart = timeToMinutes(act.timeStart);
            const actEnd = timeToMinutes(act.timeEnd);
            if (startMin < actEnd && actStart < endMin) {
                return act;
            }
        }
        return null;
    }

    // -------------------------------------------------------------------------
    // 6. CALENDAR RENDERING ENGINE
    // -------------------------------------------------------------------------
    function generateCalendar() {
        const year = state.currentYear;
        const month = state.currentMonth;

        currentMonthYearLabel.textContent = `${monthNames[month]} ${year}`;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        let calendarHTML = "<table>";
        calendarHTML += "<thead><tr><th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th></tr></thead>";
        calendarHTML += "<tbody><tr>";

        for (let i = 0; i < firstDay; i++) {
            calendarHTML += "<td></td>";
        }

        for (let day = 1; day <= daysInMonth; day++) {
            if ((day + firstDay - 1) % 7 === 0 && day !== 1) {
                calendarHTML += "</tr><tr>";
            }

            const dayActs = state.activities.filter(a => a.day === day)
                .sort((a, b) => timeToMinutes(a.timeStart) - timeToMinutes(b.timeStart));
            
            let previewHTML = "";
            if (dayActs.length > 0) {
                previewHTML = `<div class="calendar-activities-preview">`;
                dayActs.slice(0, 2).forEach(act => {
                    previewHTML += `<div class="activity-dot-preview" title="${act.timeStart} - ${act.title}">${act.title}</div>`;
                });
                if (dayActs.length > 2) {
                    previewHTML += `<div class="activity-dot-preview" style="background-color: var(--text-secondary)">+${dayActs.length - 2} more</div>`;
                }
                previewHTML += `</div>`;
            }

            const activeClass = state.selectedDay === day ? "active-day" : "";
            calendarHTML += `
                <td class="calendar-day ${activeClass}" data-day="${day}">
                    <div class="day-number">${day}</div>
                    ${previewHTML}
                </td>`;
        }

        const totalCells = firstDay + daysInMonth;
        const remaining = (7 - (totalCells % 7)) % 7;
        for (let i = 0; i < remaining; i++) {
            calendarHTML += "<td></td>";
        }

        calendarHTML += "</tr></tbody></table>";
        calendarElement.innerHTML = calendarHTML;

        const days = document.querySelectorAll(".calendar-day");
        days.forEach((dayCell) => {
            dayCell.addEventListener("click", () => {
                const day = Number(dayCell.getAttribute("data-day"));
                selectDay(day);
            });
        });

        if (window.lucide) {
            lucide.createIcons();
        }
    }

    // -------------------------------------------------------------------------
    // 7. DAY SELECTION & DETAILS RENDERING
    // -------------------------------------------------------------------------
    function selectDay(day) {
        state.selectedDay = day;
        
        const days = document.querySelectorAll(".calendar-day");
        days.forEach(d => {
            if (Number(d.getAttribute("data-day")) === day) {
                d.classList.add("active-day");
            } else {
                d.classList.remove("active-day");
            }
        });

        selectedDayLabel.textContent = `${monthNames[state.currentMonth]} ${day}, ${state.currentYear}`;
        addActivityBtn.removeAttribute("disabled");

        renderActivitiesList();
    }

    function renderActivitiesList() {
        if (state.selectedDay === null) {
            placeInfo.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="calendar-days" class="empty-icon"></i>
                    <p>Click on any date in the calendar to view, add, or edit your travel activities.</p>
                </div>`;
            if (window.lucide) lucide.createIcons();
            return;
        }

        const dayActs = state.activities.filter(a => a.day === state.selectedDay)
            .sort((a, b) => timeToMinutes(a.timeStart) - timeToMinutes(b.timeStart));

        if (dayActs.length === 0) {
            placeInfo.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="compass" class="empty-icon"></i>
                    <p>No activities planned for this day yet.</p>
                    <p style="font-size:0.8rem; margin-top:0.25rem;">Click "Add Activity" to plan your visit!</p>
                </div>`;
            if (window.lucide) lucide.createIcons();
            return;
        }

        let listHTML = `<div class="activities-list">`;
        dayActs.forEach(act => {
            const hasReminder = act.reminder;
            const locationStr = act.location ? `
                <div class="activity-loc">
                    <i data-lucide="map-pin"></i> <span>${act.location}</span>
                </div>` : "";
            
            const reminderBadge = hasReminder ? `
                <span class="activity-badge badge-alert">
                    <i data-lucide="bell" style="width:10px; height:10px;"></i>
                    Alert: -${act.reminderOffset}m
                </span>` : "";

            listHTML += `
                <div class="activity-item" data-id="${act.id}">
                    <div class="activity-main-info">
                        <div class="activity-time">
                            <i data-lucide="clock"></i> <span>${act.timeStart} - ${act.timeEnd}</span>
                            ${reminderBadge}
                        </div>
                        <div class="activity-name">${act.title}</div>
                        ${locationStr}
                    </div>
                    <div class="activity-actions">
                        <button class="action-icon-btn edit-action" title="Edit Activity" onclick="editActivityHandler('${act.id}')">
                            <i data-lucide="edit-3"></i>
                        </button>
                        <button class="action-icon-btn delete-action" title="Delete Activity" onclick="deleteActivityHandler('${act.id}')">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>`;
        });
        listHTML += `</div>`;

        placeInfo.innerHTML = listHTML;
        if (window.lucide) lucide.createIcons();
    }

    window.editActivityHandler = function(id) {
        const act = state.activities.find(a => a.id === id);
        if (!act) return;
        openModal(state.selectedDay, act);
    };

    window.deleteActivityHandler = function(id) {
        if (confirm("Are you sure you want to delete this activity?")) {
            state.activities = state.activities.filter(a => a.id !== id);
            saveActivitiesToStorage();
            generateCalendar();
            renderActivitiesList();
        }
    };

    // -------------------------------------------------------------------------
    // 8. MODAL WINDOW ACTIONS
    // -------------------------------------------------------------------------
    function openModal(day, activity = null) {
        modalDayInput.value = day;
        activityForm.reset();

        if (activity) {
            modalTitle.textContent = "Edit Activity";
            modalActivityIdInput.value = activity.id;
            activityTitleInput.value = activity.title;
            activityStartInput.value = activity.timeStart;
            activityEndInput.value = activity.timeEnd;
            activityLocationInput.value = activity.location || "";
            activityReminderCheckbox.checked = activity.reminder || false;
            activityReminderOffsetSelect.value = activity.reminderOffset !== undefined ? activity.reminderOffset : "30";
            if (activity.reminder) {
                reminderTimeContainer.classList.add("show");
            } else {
                reminderTimeContainer.classList.remove("show");
            }
        } else {
            modalTitle.textContent = "Add Activity";
            modalActivityIdInput.value = "";
            reminderTimeContainer.classList.remove("show");
        }

        activityModal.classList.add("open");
    }

    function closeModal() {
        activityModal.classList.remove("open");
    }

    addActivityBtn.addEventListener("click", () => {
        if (state.selectedDay !== null) {
            openModal(state.selectedDay);
        }
    });

    closeModalBtn.addEventListener("click", closeModal);
    cancelModalBtn.addEventListener("click", closeModal);
    activityReminderCheckbox.addEventListener("change", () => {
        if (activityReminderCheckbox.checked) {
            reminderTimeContainer.classList.add("show");
        } else {
            reminderTimeContainer.classList.remove("show");
        }
    });

    activityForm.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const day = Number(modalDayInput.value);
        const id = modalActivityIdInput.value || `act-${Date.now()}`;
        const title = activityTitleInput.value;
        const start = activityStartInput.value;
        const end = activityEndInput.value;
        const location = activityLocationInput.value;
        const reminder = activityReminderCheckbox.checked;
        const reminderOffset = Number(activityReminderOffsetSelect.value);

        if (!validateActivityInput(title)) {
            alert("Please enter a valid activity title.");
            return;
        }

        if (!validateTimeSlotInput(start, end)) {
            alert("Start time must be before the end time.");
            return;
        }

        const conflict = hasTimeConflict(day, start, end, modalActivityIdInput.value ? id : null);
        if (conflict) {
            alert(`Time Conflict! This slot overlaps with "${conflict.title}" (${conflict.timeStart} - ${conflict.timeEnd}).`);
            return;
        }

        const newAct = {
            id,
            day,
            title,
            timeStart: start,
            timeEnd: end,
            location,
            reminder,
            reminderOffset
        };

        if (modalActivityIdInput.value) {
            const index = state.activities.findIndex(a => a.id === id);
            if (index !== -1) {
                state.activities[index] = newAct;
            }
        } else {
            state.activities.push(newAct);
        }

        saveActivitiesToStorage();
        closeModal();
        generateCalendar();
        renderActivitiesList();
    });

    // -------------------------------------------------------------------------
    // 9. BACKUP / MANUAL LOAD BUTTONS
    // -------------------------------------------------------------------------
    saveScheduleBtn.addEventListener("click", () => {
        localStorage.setItem("travelSchedule", JSON.stringify({
            activities: state.activities,
            currentMonth: state.currentMonth,
            currentYear: state.currentYear
        }));
        alert("Travel schedule successfully backed up!");
    });

    loadScheduleBtn.addEventListener("click", () => {
        const backedUp = localStorage.getItem("travelSchedule");
        if (backedUp) {
            try {
                const data = JSON.parse(backedUp);
                state.activities = data.activities || [];
                state.currentMonth = data.currentMonth !== undefined ? data.currentMonth : state.currentMonth;
                state.currentYear = data.currentYear !== undefined ? data.currentYear : state.currentYear;
                
                saveActivitiesToStorage();
                generateCalendar();
                
                if (state.selectedDay !== null) {
                    selectDay(state.selectedDay);
                } else {
                    placeInfo.innerHTML = `
                        <div class="empty-state">
                            <i data-lucide="calendar-days" class="empty-icon"></i>
                            <p>Schedule Loaded! Click a date to inspect activities.</p>
                        </div>`;
                }
                if (window.lucide) lucide.createIcons();
                alert("Travel schedule successfully restored from backup!");
            } catch (e) {
                alert("Error loading backup: Invalid file data.");
            }
        } else {
            alert("No saved travel schedule backup found in this browser.");
        }
    });

    // -------------------------------------------------------------------------
    // 10. REAL-TIME REMINDER ENGINE
    // -------------------------------------------------------------------------
    function showToast(title, body) {
        toastTitle.textContent = title;
        toastBody.textContent = body;
        reminderToast.classList.add("show");
        
        setTimeout(() => {
            reminderToast.classList.remove("show");
        }, 8000);
    }

    closeToastBtn.addEventListener("click", () => {
        reminderToast.classList.remove("show");
    });

    function checkReminders() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        state.activities.forEach(act => {
            if (!act.reminder || state.firedReminders.has(act.id)) return;

            if (state.currentMonth === currentMonth && state.currentYear === currentYear) {
                const [startHour, startMin] = act.timeStart.split(":").map(Number);
                const activityTime = new Date(currentYear, currentMonth, act.day, startHour, startMin, 0);
                const alertTime = new Date(activityTime.getTime() - act.reminderOffset * 60 * 1000);

                if (now >= alertTime && now < activityTime) {
                    state.firedReminders.add(act.id);
                    const timeRemaining = act.reminderOffset === 0 ? "now" : `in ${act.reminderOffset} minutes`;
                    showToast(
                        `Reminder: ${act.title}`,
                        `Scheduled for ${act.timeStart} ${timeRemaining}.${act.location ? ' at ' + act.location : ''}`
                    );
                }
            }
        });
    }

    setInterval(checkReminders, 5000);

    // -------------------------------------------------------------------------
    // 11. NEW PREMIUM FEATURES LOGIC
    // -------------------------------------------------------------------------

    // Global Destination & User Swapping Event Listeners
    destSelect.addEventListener("change", (e) => {
        state.destination = e.target.value;
        localStorage.setItem("travelDestination", state.destination);
        updateDestinationUI();
        saveICCardsToStorage();
    });

    userSelect.addEventListener("change", (e) => {
        state.activeUser = e.target.value;
        localStorage.setItem("travelActiveUser", state.activeUser);
        icPassengerSelect.value = state.activeUser;
        updateIcEstimator();
    });

    icPassengerSelect.addEventListener("change", (e) => {
        state.activeUser = e.target.value;
        localStorage.setItem("travelActiveUser", state.activeUser);
        userSelect.value = state.activeUser;
        updateIcEstimator();
    });

    function updateDestinationUI() {
        // 1. Update Transit optimizer fields
        populateTransitDropdowns();
        
        // 2. Update Nearby Places grid
        renderPlacesGrid();
        populateCityDropdown();
        gpsRecHeader.style.display = "none";
        gpsRecGrid.style.display = "none";
        gpsStatusBar.style.display = "none";

        // 3. Update IC Card display
        updateIcEstimator();
        renderRechargeButtons();
        
        // 4. Update the Transit Title / Layout
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

        // Clear transit results
        transitResultsBody.innerHTML = `
            <div class="empty-state">
                <i data-lucide="map" class="empty-icon"></i>
                <p>Select stations and calculate to view the optimized itinerary details and fare estimations.</p>
            </div>`;

        if (window.lucide) lucide.createIcons();
    }

    // --- TRANSIT OPTIMIZER GRAPH NODE DIJKSTRA DATA ---
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
            // Shenzhen Didi Points
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

    function populateTransitDropdowns() {
        transitStart.innerHTML = "";
        transitEnd.innerHTML = "";
        
        const network = TRANSIT_NETWORKS[state.destination];
        if (!network) return;

        network.nodes.forEach(node => {
            const opt1 = document.createElement("option");
            opt1.value = node;
            opt1.textContent = node;
            transitStart.appendChild(opt1);

            const opt2 = document.createElement("option");
            opt2.value = node;
            opt2.textContent = node;
            transitEnd.appendChild(opt2);
        });

        // Set different defaults
        if (transitEnd.options.length > 1) {
            transitEnd.selectedIndex = 1;
        }
    }

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

    // Transit Calculation submit
    transitForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const start = transitStart.value;
        const end = transitEnd.value;
        
        if (start === end) {
            alert("Start and End stations must be different.");
            return;
        }

        if (state.destination === "china") {
            calculateShenzhenDidi(start, end);
        } else {
            calculateSubwayRoute(start, end);
        }
    });

    function calculateSubwayRoute(start, end) {
        const criteria = transitCriteria.value;
        const route = findDijkstraRoute(state.destination, start, end, criteria);

        if (!route) {
            transitResultsBody.innerHTML = `<div class="empty-state"><p>No route found between selected stations.</p></div>`;
            return;
        }

        const symbol = state.destination === "japan" ? "¥" : "RM";
        const currency = state.destination === "japan" ? "JPY" : "MYR";
        const hkdFare = convertToHkd(route.totalFare, currency).toFixed(2);

        let timelineHTML = `<div class="route-timeline">`;
        timelineHTML += `
            <div class="timeline-node">
                <span class="node-station">${route.path[0]}</span>
                <div class="node-detail">Departure Station</div>
            </div>`;

        for (let i = 0; i < route.segmentLinks.length; i++) {
            const link = route.segmentLinks[i];
            const nextStation = route.path[i + 1];
            const isTransfer = i > 0 && route.segmentLinks[i - 1].line !== link.line;
            const transferClass = isTransfer ? "transfer" : "";

            timelineHTML += `
                <div class="timeline-node ${transferClass}">
                    <span class="node-station">${nextStation}</span>
                    <span class="node-line" style="background-color: ${link.color};">${link.line}</span>
                    <div class="node-detail">${link.time} mins • Fare: ${symbol}${link.fare}</div>
                </div>`;
        }
        timelineHTML += `</div>`;

        transitResultsBody.innerHTML = `
            ${timelineHTML}
            <div class="transit-metrics">
                <div>Duration: <strong>${route.totalTime} mins</strong></div>
                <div>Transfers: <strong>${route.transfers}</strong></div>
                <div>Total Fare: <strong>${symbol}${route.totalFare}</strong> <span style="font-size:0.75rem; color:var(--text-secondary)">(HKD $${hkdFare})</span></div>
            </div>
            <button class="btn btn-accent btn-block" style="margin-top:1rem;" id="charge-ic-transit-btn">
                <i data-lucide="credit-card"></i> Add Transit Fare to ${state.activeUser}'s Card
            </button>
        `;

        if (window.lucide) lucide.createIcons();

        // Charge fare listener
        document.getElementById("charge-ic-transit-btn").addEventListener("click", () => {
            const logEntry = {
                desc: `${start.replace(" Station", "")} ➔ ${end.replace(" Station", "")}`,
                fare: route.totalFare,
                currency: currency
            };
            
            // Deduct from card balance
            state.icCards[state.activeUser][currency] -= route.totalFare;
            state.icCards[state.activeUser].logs.push(logEntry);
            
            saveICCardsToStorage();
            updateIcEstimator();
            
            alert(`Logged transit trip and charged ${symbol}${route.totalFare} to ${state.activeUser}'s transit card!`);
        });
    }

    function calculateShenzhenDidi(start, end) {
        const network = TRANSIT_NETWORKS.china;
        // Search distance
        let link = network.links.find(l => (l.u === start && l.v === end) || (l.u === end && l.v === start));
        let dist = 15; // default fallback distance in km
        if (link) {
            dist = link.distance;
        } else {
            // Pseudo-distance if not directly linked
            dist = Math.abs(start.length - end.length) * 3 + 10;
        }

        const carType = taxiTypeSelect.value;
        let baseFare = 10;
        let perKm = 2.5;
        let carName = "Didi Express";

        if (carType === "premier") {
            baseFare = 18;
            perKm = 4.0;
            carName = "Didi Premier";
        } else if (carType === "luxe") {
            baseFare = 35;
            perKm = 7.0;
            carName = "Didi Luxe";
        }

        const totalFare = Math.round(baseFare + dist * perKm);
        const time = Math.round(dist * 1.25 + 5);
        const hkdFare = convertToHkd(totalFare, "CNY").toFixed(2);

        transitResultsBody.innerHTML = `
            <div style="text-align: center; padding: 1rem 0;">
                <i data-lucide="car" style="width: 48px; height: 48px; color: var(--accent); margin-bottom: 0.5rem;"></i>
                <h4 style="font-family: var(--font-heading); font-size: 1.15rem; font-weight: 750;">${carName} Recommended</h4>
                <p style="color: var(--text-secondary); font-size:0.85rem; margin-top:0.25rem;">Futian High-speed Traffic Route (Shenzhen)</p>
            </div>
            <div class="route-timeline">
                <div class="timeline-node">
                    <span class="node-station">${start}</span>
                    <div class="node-detail">Pick Up Point</div>
                </div>
                <div class="timeline-node" style="height: 35px;">
                    <span class="node-station">${end}</span>
                    <div class="node-detail">Destination • Route Distance: ${dist} km</div>
                </div>
            </div>
            <div class="transit-metrics">
                <div>Est. Time: <strong>${time} mins</strong></div>
                <div>Distance: <strong>${dist} km</strong></div>
                <div>Fare: <strong>${totalFare} CNY</strong> <span style="font-size:0.75rem; color:var(--text-secondary)">(HKD $${hkdFare})</span></div>
            </div>
            <button class="btn btn-accent btn-block" style="margin-top:1rem;" id="charge-didi-wallet-btn">
                <i data-lucide="plus"></i> Add Taxi Fare to Wallet Ledger
            </button>
        `;

        if (window.lucide) lucide.createIcons();

        document.getElementById("charge-didi-wallet-btn").addEventListener("click", () => {
            const expense = {
                id: `exp-${Date.now()}`,
                title: `${carName}: ${start.substring(0, 10)}... ➔ ${end.substring(0, 10)}...`,
                amount: totalFare,
                currency: "CNY",
                payer: state.activeUser,
                category: "Transport",
                date: new Date().toLocaleDateString()
            };
            state.expenses.push(expense);
            saveExpensesToStorage();
            renderLedger();
            renderDebtSettlement();
            updateIcEstimator();
            alert(`Added Didi fare of ${totalFare} CNY to trip expenses ledger!`);
        });
    }

    // --- CURATED LOCAL GUIDE DATABASE FETCHING & MOCKS ---
    let placesDatabase = [];

    // Local curated fallback if fetch is blocked
    function curatingFallbackDb() {
        return [
            // Nagoya
            { name: "Nagoya Castle", city: "Nagoya", country: "Japan", category: "Sights", rating: 4.4, reviewsCount: 1205, coordinates: { lat: 35.1856, lng: 136.9015 }, price_local: 500, currency: "JPY", price_hkd: 25.0, price_level: "$", street: "1-1 Honmaru, Naka Ward" },
            { name: "Atsuta Jingu Shrine", city: "Nagoya", country: "Japan", category: "Sights", rating: 4.5, reviewsCount: 3410, coordinates: { lat: 35.1257, lng: 136.9091 }, price_local: 0, currency: "JPY", price_hkd: 0.0, price_level: "Free", street: "1 Chome-1-1 Jingu, Atsuta Ward" },
            { name: "Sekai no Yamachan", city: "Nagoya", country: "Japan", category: "Food", rating: 4.2, reviewsCount: 890, coordinates: { lat: 35.1685, lng: 136.9077 }, price_local: 1800, currency: "JPY", price_hkd: 90.0, price_level: "$$", street: "Sakae 4-16-27" },
            { name: "Osu Kannon Temple", city: "Nagoya", country: "Japan", category: "Sights", rating: 4.3, reviewsCount: 755, coordinates: { lat: 35.1598, lng: 136.8996 }, price_local: 0, currency: "JPY", price_hkd: 0.0, price_level: "Free", street: "2 Chome-21-47 Osu" },
            // Osaka
            { name: "Osaka Castle Park", city: "Osaka", country: "Japan", category: "Sights", rating: 4.6, reviewsCount: 8740, coordinates: { lat: 34.6873, lng: 135.5262 }, price_local: 600, currency: "JPY", price_hkd: 30.0, price_level: "$", street: "1-1 Osakajo, Chuo Ward" },
            { name: "Dotonbori Glico Man", city: "Osaka", country: "Japan", category: "Sights", rating: 4.5, reviewsCount: 16800, coordinates: { lat: 34.6687, lng: 135.5013 }, price_local: 0, currency: "JPY", price_hkd: 0.0, price_level: "Free", street: "1 Chome-10-4 Dotonbori" },
            { name: "Ichiran Ramen Dotonbori", city: "Osaka", country: "Japan", category: "Food", rating: 4.3, reviewsCount: 4210, coordinates: { lat: 34.6691, lng: 135.5024 }, price_local: 1100, currency: "JPY", price_hkd: 55.0, price_level: "$$", street: "7-17 Souemoncho" },
            { name: "Universal Studios Japan", city: "Osaka", country: "Japan", category: "Entertainment", rating: 4.7, reviewsCount: 12500, coordinates: { lat: 34.6654, lng: 135.4323 }, price_local: 8600, currency: "JPY", price_hkd: 430.0, price_level: "$$$", street: "2 Chome-1-33 Sakurajima" },
            // Kobe
            { name: "Kobe Port Tower", city: "Kobe", country: "Japan", category: "Sights", rating: 4.3, reviewsCount: 2201, coordinates: { lat: 34.6826, lng: 135.1867 }, price_local: 1000, currency: "JPY", price_hkd: 50.0, price_level: "$$", street: "5-5 Hatobacho, Chuo Ward" },
            { name: "Meriken Park", city: "Kobe", country: "Japan", category: "Sights", rating: 4.4, reviewsCount: 3105, coordinates: { lat: 34.6813, lng: 135.1884 }, price_local: 0, currency: "JPY", price_hkd: 0.0, price_level: "Free", street: "2 Hatobacho" },
            { name: "Kobe Beef Red One", city: "Kobe", country: "Japan", category: "Food", rating: 4.6, reviewsCount: 914, coordinates: { lat: 34.6912, lng: 135.1925 }, price_local: 5500, currency: "JPY", price_hkd: 275.0, price_level: "$$$", street: "Kitanagasadori 1-9-9" },
            // Kuala Lumpur
            { name: "Petronas Twin Towers", city: "Kuala Lumpur", country: "Malaysia", category: "Sights", rating: 4.6, reviewsCount: 25100, coordinates: { lat: 3.1578, lng: 101.7118 }, price_local: 80, currency: "MYR", price_hkd: 160.0, price_level: "$$$", street: "Concourse Level, Lower Ground" },
            { name: "Batu Caves", city: "Kuala Lumpur", country: "Malaysia", category: "Sights", rating: 4.4, reviewsCount: 14500, coordinates: { lat: 3.2374, lng: 101.6841 }, price_local: 0, currency: "MYR", price_hkd: 0.0, price_level: "Free", street: "Gombak, 68100" },
            { name: "Jalan Alor Food Street", city: "Kuala Lumpur", country: "Malaysia", category: "Food", rating: 4.2, reviewsCount: 8900, coordinates: { lat: 3.1461, lng: 101.7088 }, price_local: 30, currency: "MYR", price_hkd: 60.0, price_level: "$$", street: "Jalan Alor, Bukit Bintang" },
            { name: "VCR Cafe Coffee", city: "Kuala Lumpur", country: "Malaysia", category: "Food", rating: 4.3, reviewsCount: 1045, coordinates: { lat: 3.1418, lng: 101.7022 }, price_local: 25, currency: "MYR", price_hkd: 50.0, price_level: "$$", street: "2 Jalan Galloway" },
            // George Town
            { name: "Kek Lok Si Temple", city: "George Town", country: "Malaysia", category: "Sights", rating: 4.5, reviewsCount: 4210, coordinates: { lat: 5.3673, lng: 100.2731 }, price_local: 10, currency: "MYR", price_hkd: 20.0, price_level: "$", street: "Air Itam, 11500" },
            { name: "Penang Hill Funicular", city: "George Town", country: "Malaysia", category: "Sights", rating: 4.4, reviewsCount: 6540, coordinates: { lat: 5.4085, lng: 100.2774 }, price_local: 30, currency: "MYR", price_hkd: 60.0, price_level: "$$", street: "Perbadanan Bukit Bendera" },
            { name: "George Town Street Art", city: "George Town", country: "Malaysia", category: "Sights", rating: 4.6, reviewsCount: 3102, coordinates: { lat: 5.4141, lng: 100.3385 }, price_local: 0, currency: "MYR", price_hkd: 0.0, price_level: "Free", street: "Lebuh Armenian" },
            { name: "Gurney Drive Food Hawker", city: "George Town", country: "Malaysia", category: "Food", rating: 4.1, reviewsCount: 2210, coordinates: { lat: 5.4385, lng: 100.3090 }, price_local: 15, currency: "MYR", price_hkd: 30.0, price_level: "$", street: "Jalan Gurney" }
        ];
    }

    async function fetchPlacesDb() {
        try {
            const res = await fetch("final_places_db.json");
            placesDatabase = await res.json();
            console.log("Successfully fetched " + placesDatabase.length + " places from final_places_db.json");
        } catch (e) {
            console.warn("CORS/file boundary blocked direct places fetch. Loading client-side high fidelity mocks.");
            placesDatabase = curatingFallbackDb();
        }
        populateCityDropdown();
        renderPlacesGrid();
    }

    function populateCityDropdown() {
        placesCitySelect.innerHTML = "<option value='All'>All Cities</option>";
        
        let targetCountry = state.destination === "japan" ? "Japan" : "Malaysia";
        if (state.destination === "china") return; // ignored for mainland

        const cities = [...new Set(placesDatabase
            .filter(p => p.country === targetCountry)
            .map(p => p.city)
        )];

        cities.forEach(city => {
            const opt = document.createElement("option");
            opt.value = city;
            opt.textContent = city;
            placesCitySelect.appendChild(opt);
        });
    }

    let activeCategoryFilter = "All";

    // Category chips click
    const chips = document.querySelectorAll(".places-filters-container .chip");
    chips.forEach(chip => {
        chip.addEventListener("click", () => {
            chips.forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            activeCategoryFilter = chip.getAttribute("data-category");
            renderPlacesGrid();
        });
    });

    placesSearch.addEventListener("input", renderPlacesGrid);
    placesCitySelect.addEventListener("change", renderPlacesGrid);

    function renderPlacesGrid() {
        placesGrid.innerHTML = "";
        
        if (state.destination === "china") {
            placesGrid.innerHTML = `
                <div class="placeholder-card card" style="grid-column: 1 / -1; max-width: 600px; margin: 2rem auto;">
                    <div class="placeholder-icon" style="background-color:#ffebe6; color:#ff6d00;">
                        <i data-lucide="compass"></i>
                    </div>
                    <h3>Shenzhen Places Guide Ignored</h3>
                    <p>Subway and places databases are ignored for Shenzhen since Didi transport ride-hailing is used. Swapping to Japan or Malaysia unlocks full place guides!</p>
                </div>`;
            if (window.lucide) lucide.createIcons();
            return;
        }

        const query = placesSearch.value.toLowerCase().strip();
        const cityFilter = placesCitySelect.value;
        const targetCountry = state.destination === "japan" ? "Japan" : "Malaysia";

        const filtered = placesDatabase.filter(place => {
            if (place.country !== targetCountry) return false;
            if (cityFilter !== "All" && place.city !== cityFilter) return false;
            if (activeCategoryFilter !== "All" && place.category !== activeCategoryFilter) return false;
            
            if (query) {
                const nameMatch = place.name.toLowerCase().includes(query);
                const streetMatch = place.street.toLowerCase().includes(query);
                const catMatch = place.category.toLowerCase().includes(query);
                return nameMatch || streetMatch || catMatch;
            }
            return true;
        });

        if (filtered.length === 0) {
            placesGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <i data-lucide="search" class="empty-icon"></i>
                    <p>No places found matching your active filters.</p>
                </div>`;
            if (window.lucide) lucide.createIcons();
            return;
        }

        // Render card grids
        filtered.forEach(place => {
            placesGrid.appendChild(createPlaceCardElement(place));
        });

        if (window.lucide) lucide.createIcons();
    }

    function createPlaceCardElement(place) {
        const div = document.createElement("div");
        div.className = "boarding-pass-ticket";
        
        const AIRPORT_CODES = {
            "Nagoya": "NGO",
            "Osaka": "KIX",
            "Kobe": "UKB",
            "Tateyama Kurobe": "TTE",
            "Kuwana": "KWN",
            "Suzuka": "SZK",
            "Kuala Lumpur": "KUL",
            "George Town": "PEN",
            "Penang": "PEN",
            "Shenzhen": "SZX"
        };
        const destCode = AIRPORT_CODES[place.city] || "NGO";
        
        let platformClass = "tabelog-badge-mini";
        let platformName = "食べログ Tabelog";
        let ratingHTML = `<span class="tabelog-score">${place.rating}</span>`;

        if (place.country === "Japan") {
            platformClass = "tabelog-badge-mini";
            platformName = "Tabelog";
            ratingHTML = `<span class="tabelog-score">${place.rating}</span>`;
        } else if (place.country === "Malaysia") {
            platformClass = "openrice-badge-mini";
            platformName = "TripAdvisor";
            ratingHTML = `<span class="openrice-score">🟢 ${place.rating}</span>`;
        }

        const symbol = place.currency === "JPY" ? "¥" : "RM";
        const catClass = place.category.toLowerCase();

        div.innerHTML = `
            <div class="boarding-pass-header">
                <div class="logo-mini"><i data-lucide="plane-takeoff" style="width:12px; height:12px;"></i> ROAMREADY BOARDING PASS</div>
                <div class="ticket-luggage-tag">${place.category}</div>
            </div>
            
            <div class="boarding-pass-body">
                <!-- Airport Code Terminal Route Row -->
                <div class="ticket-airport-row">
                    <div>
                        <div class="airport-code origin">HKG</div>
                        <div style="font-size:0.65rem; color:var(--text-secondary); font-weight:700;">HONG KONG</div>
                    </div>
                    <div class="airport-arrow">
                        <i data-lucide="arrow-right" style="width:16px; height:16px;"></i>
                    </div>
                    <div style="text-align: right;">
                        <div class="airport-code destination">${destCode}</div>
                        <div style="font-size:0.65rem; color:var(--text-secondary); font-weight:700;">${place.city.toUpperCase()}</div>
                    </div>
                </div>

                <div class="ticket-divider"></div>

                <div class="place-header" style="margin-bottom:0.65rem;">
                    <div class="place-title" style="font-size: 1.05rem;">${place.name}</div>
                </div>

                <div class="place-city-label" style="margin-bottom:0.75rem;">
                    <i data-lucide="map-pin" style="width:12px; height:12px; color:var(--accent);"></i>
                    <span style="font-family:'Share Tech Mono', monospace; font-size:0.75rem; letter-spacing:0.02em;">${place.street || "City Center"}</span>
                </div>
                
                <!-- Platform Brand Badge -->
                <div class="rating-platform-badge ${platformClass}" style="margin-bottom:0.75rem;">
                    <span class="platform-logo">${platformName}</span>
                    ${ratingHTML}
                </div>

                <div class="place-details-row">
                    <span>Reviews Count:</span>
                    <strong>${place.reviewsCount} reviews</strong>
                </div>
                <div class="place-details-row">
                    <span>Est. Cost:</span>
                    <strong>${symbol}${place.price_local} <span class="place-price-hkd">(HKD $${place.price_hkd})</span></strong>
                </div>

                <div class="ticket-barcode"></div>
            </div>

            <div class="place-actions" style="padding: 0.75rem 1.15rem 1.15rem 1.15rem; background-color: var(--bg-primary); border-top: 1.5px dashed var(--border); margin-top:0;">
                <button class="btn btn-secondary btn-sm" onclick="addPlaceToSchedulerHandler('${place.name.replace(/'/g, "\\'")}', '${place.street.replace(/'/g, "\\'")}')">
                    <i data-lucide="calendar"></i> +Schedule
                </button>
                <button class="btn btn-accent btn-sm" onclick="addPlaceToWalletHandler('${place.name.replace(/'/g, "\\'")}', ${place.price_local}, '${place.currency}', '${place.category}')">
                    <i data-lucide="wallet"></i> +Wallet
                </button>
            </div>
        `;
        return div;
    }

    // Expose handlers globally
    window.addPlaceToSchedulerHandler = function(name, street) {
        // Switch to scheduler tab
        navItems[0].click();
        
        const targetDay = state.selectedDay || 1;
        selectDay(targetDay);
        
        openModal(targetDay);
        activityTitleInput.value = name;
        activityLocationInput.value = street;
    };

    window.addPlaceToWalletHandler = function(name, cost, currency, category) {
        if (cost === 0) {
            alert(`"${name}" is free! No need to add to wallet.`);
            return;
        }
        
        const expense = {
            id: `exp-${Date.now()}`,
            title: name,
            amount: cost,
            currency: currency,
            payer: state.activeUser,
            category: category,
            date: new Date().toLocaleDateString()
        };
        
        state.expenses.push(expense);
        saveExpensesToStorage();
        renderLedger();
        renderDebtSettlement();
        updateIcEstimator();
        
        alert(`Successfully added expense of ${currency} ${cost} to ledger (converted to HKD)!`);
    };

    // --- GPS FIND NEARBY GEMS ENGINE ---
    gpsBtn.addEventListener("click", () => {
        if (state.destination === "china") {
            alert("Places lookup is ignored for Shenzhen since Didi transport is used.");
            return;
        }

        if (navigator.geolocation) {
            gpsStatusText.textContent = "Requesting GPS signal...";
            gpsStatusBar.style.display = "inline-flex";
            
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    applyGpsDiscovery(lat, lng, "Live GPS Coordinates");
                },
                (err) => {
                    console.warn("Live GPS access blocked. Simulating City Center coordinate grid.");
                    simulateGpsLookup();
                }
            );
        } else {
            simulateGpsLookup();
        }
    });

    function simulateGpsLookup() {
        let lat = 34.6937;
        let lng = 135.5023;
        let label = "Simulated Osaka Umeda";

        if (state.destination === "malaysia") {
            lat = 3.1390;
            lng = 101.6869;
            label = "Simulated KL Sentral";
        }
        applyGpsDiscovery(lat, lng, label);
    }

    // Haversine formula
    function getHaversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; 
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; 
    }

    function applyGpsDiscovery(lat, lng, label) {
        gpsStatusText.textContent = `${label}: (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        gpsStatusBar.style.display = "inline-flex";

        const countryFilter = state.destination === "japan" ? "Japan" : "Malaysia";
        
        // Calculate distances
        const ranked = placesDatabase
            .filter(p => p.country === countryFilter)
            .map(p => {
                const d = getHaversineDistance(lat, lng, p.coordinates.lat, p.coordinates.lng);
                return { ...p, distance: d };
            })
            .sort((a, b) => a.distance - b.distance);

        // Show top 3
        gpsRecGrid.innerHTML = "";
        const top3 = ranked.slice(0, 3);
        
        top3.forEach(place => {
            const card = createPlaceCardElement(place);
            const distBadge = document.createElement("div");
            distBadge.className = "place-details-row";
            distBadge.style.color = "var(--success)";
            distBadge.style.fontWeight = "750";
            distBadge.innerHTML = `<span>GPS Proximity:</span> <span>📍 ${place.distance.toFixed(2)} km away</span>`;
            
            // Insert distance before actions
            card.insertBefore(distBadge, card.querySelector(".place-actions"));
            gpsRecGrid.appendChild(card);
        });

        gpsRecHeader.style.display = "block";
        gpsRecGrid.style.display = "grid";
        
        if (window.lucide) lucide.createIcons();
    }

    // --- SHARED WALLET LEDGER & DEBT CALCULATOR (HKD BASE) ---

    // Add Expense Submit
    expenseForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const title = expenseTitleInput.value;
        const category = expenseCategoryInput.value;
        const amount = Number(expenseAmountInput.value);
        const currency = expenseCurrencySelect.value;
        const payer = expensePayerSelect.value;

        if (!title || amount <= 0) return;

        const expense = {
            id: `exp-${Date.now()}`,
            title,
            amount,
            currency,
            payer,
            category,
            date: new Date().toLocaleDateString()
        };

        state.expenses.push(expense);
        saveExpensesToStorage();
        
        expenseTitleInput.value = "";
        expenseAmountInput.value = "";
        expenseConvertedText.textContent = "Converted: HKD $0.00";

        renderLedger();
        renderDebtSettlement();
        updateIcEstimator();
    });

    expenseAmountInput.addEventListener("input", updateConvertedIndicator);
    expenseCurrencySelect.addEventListener("change", updateConvertedIndicator);

    function updateConvertedIndicator() {
        const val = Number(expenseAmountInput.value);
        if (isNaN(val) || val <= 0) {
            expenseConvertedText.textContent = "Converted: HKD $0.00";
            return;
        }
        const currency = expenseCurrencySelect.value;
        const hkd = convertToHkd(val, currency).toFixed(2);
        expenseConvertedText.textContent = `Converted: HKD $${hkd}`;
    }

    function renderLedger() {
        expensesList.innerHTML = "";
        if (state.expenses.length === 0) {
            expensesList.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="receipt" class="empty-icon" style="width:32px; height:32px;"></i>
                    <p>No trip expenses recorded in ledger yet.</p>
                </div>`;
            if (window.lucide) lucide.createIcons();
            return;
        }

        // Sort by id desc (newest first)
        const sorted = [...state.expenses].sort((a, b) => b.id.localeCompare(a.id));

        sorted.forEach(exp => {
            const item = document.createElement("div");
            item.className = "expense-item";
            
            const origSymbol = exp.currency === "JPY" ? "¥" : (exp.currency === "MYR" ? "RM" : (exp.currency === "CNY" ? "¥" : "$"));
            const hkdVal = convertToHkd(exp.amount, exp.currency).toFixed(2);

            item.innerHTML = `
                <div class="expense-info">
                    <div class="expense-item-title">${exp.title}</div>
                    <div class="expense-item-meta">${exp.payer} paid for ${exp.category} • ${exp.date}</div>
                </div>
                <div class="expense-amount-side">
                    <div class="expense-amount-hkd">HKD $${hkdVal}</div>
                    <div class="expense-amount-orig">${origSymbol}${exp.amount}</div>
                </div>
                <button class="action-icon-btn delete-action" style="width:24px; height:24px; margin-left:0.5rem;" onclick="deleteExpenseHandler('${exp.id}')">
                    <i data-lucide="trash-2" style="width:12px; height:12px;"></i>
                </button>
            `;
            expensesList.appendChild(item);
        });

        if (window.lucide) lucide.createIcons();
    }

    window.deleteExpenseHandler = function(id) {
        if (confirm("Remove this expense from group ledger?")) {
            state.expenses = state.expenses.filter(e => e.id !== id);
            saveExpensesToStorage();
            renderLedger();
            renderDebtSettlement();
            updateIcEstimator();
        }
    };

    // Greedy Debt Settler Algorithm in HKD
    function renderDebtSettlement() {
        debtList.innerHTML = "";
        
        // Passengers
        const members = ["Alice", "Bob", "Charlie"];
        
        // Sum total spent in HKD
        let totalHkd = 0;
        const totalPaid = { Alice: 0, Bob: 0, Charlie: 0 };

        state.expenses.forEach(exp => {
            const val = convertToHkd(exp.amount, exp.currency);
            totalPaid[exp.payer] += val;
            totalHkd += val;
        });

        const share = totalHkd / 3;
        
        // Net balances
        const netBalances = {};
        members.forEach(m => {
            netBalances[m] = totalPaid[m] - share;
        });

        // Debt Minimizer
        const debtors = [];
        const creditors = [];

        members.forEach(m => {
            const bal = netBalances[m];
            if (bal < -0.01) {
                debtors.push({ name: m, amount: Math.abs(bal) });
            } else if (bal > 0.01) {
                creditors.push({ name: m, amount: bal });
            }
        });

        // Greedy matching
        const settlements = [];
        let d_idx = 0;
        let c_idx = 0;

        while (d_idx < debtors.length && c_idx < creditors.length) {
            const debtor = debtors[d_idx];
            const creditor = creditors[c_idx];

            const pay = Math.min(debtor.amount, creditor.amount);
            
            settlements.push({
                from: debtor.name,
                to: creditor.name,
                amount: pay
            });

            debtor.amount -= pay;
            creditor.amount -= pay;

            if (debtor.amount < 0.01) d_idx++;
            if (creditor.amount < 0.01) c_idx++;
        }

        if (settlements.length === 0) {
            debtList.innerHTML = `<div class="debt-settlement-item" style="text-align:center;">All accounts are perfectly even! ⚖️</div>`;
            return;
        }

        settlements.forEach(s => {
            const item = document.createElement("div");
            item.className = "debt-settlement-item";
            item.innerHTML = `👩‍💻 <strong>${s.from}</strong> owes <strong>${s.to}</strong>: <span style="color:var(--danger); font-weight:750;">HKD $${s.amount.toFixed(2)}</span>`;
            debtList.appendChild(item);
        });
    }

    // --- TRANSIT IC CARD TRACKER & SKIN RENDERER ---
    function renderRechargeButtons() {
        icRechargeRow.innerHTML = "";
        
        let actions = [];
        if (state.destination === "japan") {
            actions = [
                { label: "+¥1000", val: 1000 },
                { label: "+¥2000", val: 2000 },
                { label: "+¥5000", val: 5000 }
            ];
        } else if (state.destination === "malaysia") {
            actions = [
                { label: "+RM10", val: 10 },
                { label: "+RM20", val: 20 },
                { label: "+RM50", val: 50 }
            ];
        } else {
            actions = [
                { label: "+¥20 CNY", val: 20 },
                { label: "+¥50 CNY", val: 50 },
                { label: "+¥100 CNY", val: 100 }
            ];
        }

        actions.forEach(act => {
            const btn = document.createElement("button");
            btn.className = "btn btn-secondary btn-sm";
            btn.textContent = act.label;
            btn.addEventListener("click", () => {
                const currency = state.destination === "japan" ? "JPY" : (state.destination === "malaysia" ? "MYR" : "CNY");
                state.icCards[state.activeUser][currency] += act.val;
                
                // Add to ledger too
                const exp = {
                    id: `exp-${Date.now()}`,
                    title: `Transit Card Top-up (${state.activeUser})`,
                    amount: act.val,
                    currency: currency,
                    payer: state.activeUser,
                    category: "Transport",
                    date: new Date().toLocaleDateString()
                };
                
                state.expenses.push(exp);
                
                saveICCardsToStorage();
                saveExpensesToStorage();
                
                updateIcEstimator();
                renderLedger();
                renderDebtSettlement();
                
                alert(`Successfully recharged card with ${act.label} and logged it in expenses!`);
            });
            icRechargeRow.appendChild(btn);
        });
    }

    function updateIcEstimator() {
        const passenger = icPassengerSelect.value;
        const cards = state.icCards[passenger];
        
        icCardHolder.textContent = passenger.toUpperCase();
        
        // Swap visual skins
        icCardSkin.className = "transit-card-skin";
        if (state.destination === "japan") {
            icCardSkin.classList.add("suica-skin");
            icCardLogo.textContent = "ICOCA";
            icCardNetwork.textContent = "Nagoya-Osaka-Kobe IC Card";
            const bal = cards.JPY || 0;
            icCardBalance.textContent = `¥${bal}`;
        } else if (state.destination === "malaysia") {
            icCardSkin.classList.add("tng-skin");
            icCardLogo.textContent = "Touch 'n Go";
            icCardNetwork.textContent = "Malaysia Transit System";
            const bal = cards.MYR || 0;
            icCardBalance.textContent = `RM${bal.toFixed(2)}`;
        } else {
            icCardSkin.classList.add("shenzhen-skin");
            icCardLogo.textContent = "Didi Wallet Pass";
            icCardNetwork.textContent = "Shenzhen Tong Taxi Account";
            const bal = cards.CNY || 0;
            icCardBalance.textContent = `¥${bal}`;
        }

        // Render logs
        icTransitLogs.innerHTML = "";
        
        const currency = state.destination === "japan" ? "JPY" : (state.destination === "malaysia" ? "MYR" : "CNY");
        const symbol = state.destination === "japan" ? "¥" : (state.destination === "malaysia" ? "RM" : "¥");

        const logs = cards.logs.filter(l => l.currency === currency);
        
        if (logs.length === 0) {
            icTransitLogs.innerHTML = `<div class="empty-state" style="padding:1rem;"><p style="font-size:0.75rem;">No planned transit route trips logged.</p></div>`;
            icEstimatedFare.textContent = `${symbol}0`;
            icTopupNeeded.textContent = `${symbol}0 (HK$0.00)`;
            return;
        }

        let totalTripCost = 0;
        logs.forEach(log => {
            totalTripCost += log.fare;
            const logItem = document.createElement("div");
            logItem.className = "transit-log-item";
            logItem.innerHTML = `
                <span class="transit-log-desc">${log.desc}</span>
                <span class="transit-log-fare">${symbol}${log.fare}</span>
            `;
            icTransitLogs.appendChild(logItem);
        });

        icEstimatedFare.textContent = `${symbol}${totalTripCost}`;
        
        const bal = cards[currency] || 0;
        const diff = totalTripCost - bal;
        if (diff > 0) {
            const hkdDiff = convertToHkd(diff, currency).toFixed(2);
            icTopupNeeded.textContent = `${symbol}${diff} (HK$${hkdDiff})`;
            icTopupNeeded.parentElement.classList.add("highlight-alert");
        } else {
            icTopupNeeded.textContent = `${symbol}0 (HK$0.00)`;
            icTopupNeeded.parentElement.classList.remove("highlight-alert");
        }
    }

    // --- HTML5 LOCAL STORAGE COLLABORATION ENGINE ---
    window.addEventListener("storage", (e) => {
        if (e.key === "travelExpenses") {
            try {
                state.expenses = JSON.parse(e.newValue) || [];
                renderLedger();
                renderDebtSettlement();
                updateIcEstimator();
                glowSyncBadge();
            } catch (err) {}
        }
        if (e.key === "travelActivities") {
            try {
                state.activities = JSON.parse(e.newValue) || [];
                generateCalendar();
                renderActivitiesList();
                glowSyncBadge();
            } catch (err) {}
        }
        if (e.key === "travelICCards") {
            try {
                state.icCards = JSON.parse(e.newValue) || {};
                updateIcEstimator();
                glowSyncBadge();
            } catch (err) {}
        }
    });

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

    // Simulate Collaborative Multi-user additions
    simulateSyncBtn.addEventListener("click", () => {
        const payers = ["Charlie", "Bob"];
        const payer = payers[Math.floor(Math.random() * payers.length)];

        let title = "Nagoya Local Ramen Dinner";
        let amount = 2200;
        let currency = "JPY";
        let category = "Food";

        if (state.destination === "malaysia") {
            const KLItems = [
                { title: "Penang Street Food", amount: 45, currency: "MYR", category: "Food" },
                { title: "Kuala Lumpur Souvenir Shop", amount: 120, currency: "MYR", category: "Shopping" },
                { title: "Batu Caves Entrance Tickets", amount: 20, currency: "MYR", category: "Sights" }
            ];
            const item = KLItems[Math.floor(Math.random() * KLItems.length)];
            title = item.title;
            amount = item.amount;
            currency = item.currency;
            category = item.category;
        } else if (state.destination === "china") {
            const CNItems = [
                { title: "Dongmen Dim Sum Lunch", amount: 180, currency: "CNY", category: "Food" },
                { title: "Shenzhen Tong Smart Card Top-up", amount: 100, currency: "CNY", category: "Transport" },
                { title: "OCT Loft Art Gallery Tour", amount: 45, currency: "CNY", category: "Sights" }
            ];
            const item = CNItems[Math.floor(Math.random() * CNItems.length)];
            title = item.title;
            amount = item.amount;
            currency = item.currency;
            category = item.category;
        } else {
            const JPItems = [
                { title: "Osaka Izakaya Tavern", amount: 3500, currency: "JPY", category: "Food" },
                { title: "Kobe Beef Lunch Set", amount: 6500, currency: "JPY", category: "Food" },
                { title: "Nagoya Shinkansen Ticket", amount: 5900, currency: "JPY", category: "Transport" }
            ];
            const item = JPItems[Math.floor(Math.random() * JPItems.length)];
            title = item.title;
            amount = item.amount;
            currency = item.currency;
            category = item.category;
        }

        const exp = {
            id: `exp-${Date.now()}`,
            title,
            amount,
            currency,
            payer,
            category,
            date: new Date().toLocaleDateString()
        };

        state.expenses.push(exp);
        saveExpensesToStorage();

        renderLedger();
        renderDebtSettlement();
        updateIcEstimator();

        // Glow the badge
        glowSyncBadge();

        // Toast notification
        showToast(
            `Collaborative Activity Alert`,
            `Cooperative Sync: ${payer} added "${title}" (${currency} ${amount}) to trip expenses ledger!`
        );
    });

    // -------------------------------------------------------------------------
    // 12. BOOTSTRAP INITIALIZATION
    // -------------------------------------------------------------------------
    loadAllData();
    generateCalendar();
    updateDestinationUI();
    fetchPlacesDb();
    renderLedger();
    renderDebtSettlement();
});
