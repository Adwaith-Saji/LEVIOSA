/**
 * ParkMe 3D Digital Twin - Frontend Application Logic
 * Integrates 2D Dashboard, REST API, and Three.js 3D Digital Twin Scene
 */

const API_URL = window.location.origin.includes("5000")
    ? `${window.location.origin}/api`
    : "http://127.0.0.1:5000/api";

// Application State
let allSlots = [];
let allDestinations = [];
let allBookings = [];
let selectedSlot = null;
let activeFloorFilter = "all";
let activeStatusFilter = "all";
let activeSearchQuery = "";
let isAutoRotating = false;
let currentBookingSlot = null;
let selectedBookingDuration = 1.0;
let countdownIntervalId = null;

// -------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
    initUIEventListeners();
    checkHealth();
    loadAllData();
    startCountdownLoop();

    // Support URL routing
    if (window.location.hash === "#bookings" || window.location.pathname.endsWith("/bookings")) {
        switchView("bookings");
    }

    window.addEventListener("hashchange", () => {
        if (window.location.hash === "#bookings") {
            switchView("bookings");
        } else {
            switchView("twin");
        }
    });

    // Listen for 3D selection events emitted from Three.js scene
    window.addEventListener("parkme:3d-ready", () => {
        syncWith3DDigitalTwin();
    });

    window.addEventListener("parkme:slot-selected", (e) => {
        const slotNum = e.detail.slotNumber;
        const targetSlot = allSlots.find((s) => s.slot_number === slotNum);
        if (targetSlot) {
            selectSlot(targetSlot, false); // false = don't re-tween 3D camera since user already clicked it in 3D
        }
    });
});

function showToast(message, type = "success") {
    const stack = document.getElementById("toastStack");
    if (!stack) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    stack.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

async function checkHealth() {
    const pill = document.getElementById("liveStatusPill");
    const label = document.getElementById("liveStatusLabel");
    try {
        const res = await fetch(`${API_URL}/health`);
        const data = await res.json();
        if (data.database_connected) {
            pill?.classList.remove("demo", "offline");
            if (label) label.textContent = "Live twin sync";
        } else {
            pill?.classList.add("demo");
            pill?.classList.remove("offline");
            if (label) label.textContent = "Demo twin";
        }
    } catch (err) {
        pill?.classList.add("offline");
        pill?.classList.remove("demo");
        if (label) label.textContent = "Offline";
    }
}

async function loadAllData() {
    await Promise.all([
        checkHealth(),
        loadStats(),
        loadDestinations(),
        loadParkingSlots(),
        loadBookings()
    ]);
}

// -------------------------------------------------------------
// API FETCH: STATS & OVERVIEW
// -------------------------------------------------------------

async function loadStats() {
    try {
        const res = await fetch(`${API_URL}/stats`);
        if (!res.ok) return;
        const stats = await res.json();

        document.getElementById("statTotal").innerText = stats.total_slots;
        document.getElementById("statAvailable").innerText = stats.available_slots;
        document.getElementById("statOccupied").innerText = stats.occupied_slots;
        document.getElementById("statReserved").innerText = stats.reserved_slots;
        document.getElementById("statRate").innerText = `${stats.occupancy_rate}%`;

        const fill = document.getElementById("occupancyFill");
        if (fill) fill.style.width = `${stats.occupancy_rate}%`;
    } catch (err) {
        console.warn("Unable to fetch stats from API:", err);
    }
}

// -------------------------------------------------------------
// API FETCH: DESTINATIONS
// -------------------------------------------------------------

async function loadDestinations() {
    try {
        const res = await fetch(`${API_URL}/destinations`);
        if (!res.ok) return;
        allDestinations = await res.json();

        const select = document.getElementById("destinationSelect");
        select.innerHTML = `<option value="">-- Select Destination --</option>`;

        allDestinations.forEach((dest) => {
            const opt = document.createElement("option");
            opt.value = dest.id;
            opt.textContent = `${dest.name} (Floor P${dest.floor_id})`;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("Failed to load destinations:", err);
    }
}

// -------------------------------------------------------------
// API FETCH: PARKING SLOTS
// -------------------------------------------------------------

async function loadParkingSlots() {
    try {
        const res = await fetch(`${API_URL}/parking-slots`);
        if (!res.ok) throw new Error("API returned " + res.status);
        allSlots = await res.json();

        // Render Matrix & Update 3D Twin
        renderSlotMatrix();
        syncWith3DDigitalTwin();

        // If a slot was previously selected, keep it refreshed
        if (selectedSlot) {
            const refreshed = allSlots.find((s) => s.id === selectedSlot.id);
            if (refreshed) selectSlot(refreshed, false);
        }
    } catch (err) {
        console.error("Failed to load parking slots:", err);
        const container = document.getElementById("slotsContainer");
        if (container) {
            container.innerHTML = `
                <div class="grid-loading" style="color: #f43f5e;">
                    ⚠️ Unable to connect to ParkMe server (${err.message}). Check that the backend is running.
                </div>
            `;
        }
    }
}

// -------------------------------------------------------------
// SYNCHRONIZATION WITH 3D TWIN (Three.js)
// -------------------------------------------------------------

function syncWith3DDigitalTwin() {
    if (window.ParkMe3D && typeof window.ParkMe3D.applySlotStatuses === "function") {
        window.ParkMe3D.applySlotStatuses(allSlots);
    }
}

// -------------------------------------------------------------
// SLOT MATRIX RENDERING & FILTERING
// -------------------------------------------------------------

function renderSlotMatrix() {
    const container = document.getElementById("slotsContainer");
    if (!container) return;

    // Apply active filters
    const filtered = allSlots.filter((slot) => {
        // Floor filter
        if (activeFloorFilter !== "all" && slot.floor_id !== parseInt(activeFloorFilter)) {
            return false;
        }
        // Status filter
        if (activeStatusFilter !== "all" && slot.status !== activeStatusFilter) {
            return false;
        }
        // Search filter
        if (activeSearchQuery && !slot.slot_number.toLowerCase().includes(activeSearchQuery.toLowerCase())) {
            return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="grid-loading">No parking bays found matching your filters.</div>
        `;
        return;
    }

    container.innerHTML = "";

    filtered.forEach((slot) => {
        const tile = document.createElement("div");
        const isSelected = selectedSlot && selectedSlot.id === slot.id;
        tile.className = `slot-tile ${slot.status} ${isSelected ? "selected" : ""}`;
        tile.dataset.slotId = slot.id;

        tile.innerHTML = `
            <div class="slot-tile-top">
                <span class="slot-id-text">${slot.slot_number}</span>
                <span class="badge ${slot.status}">${slot.status}</span>
            </div>
            <div class="slot-tile-meta">
                Floor P${slot.floor_id}
                ${slot.near_entrance ? " • Entrance" : ""}
                ${slot.near_lift ? " • " + slot.near_lift.split(" ")[0] : ""}
            </div>
            <div class="slot-actions-mini">
                ${slot.status !== "occupied" ? `
                    <button class="btn-mini btn-occupy" onclick="event.stopPropagation(); quickStatusChange(${slot.id}, 'occupied')">
                        Occupy
                    </button>
                ` : ""}
                ${slot.status !== "available" ? `
                    <button class="btn-mini btn-free" onclick="event.stopPropagation(); quickStatusChange(${slot.id}, 'available')">
                        Free
                    </button>
                ` : ""}
            </div>
        `;

        tile.addEventListener("click", () => {
            selectSlot(slot, true);
        });

        container.appendChild(tile);
    });
}

// -------------------------------------------------------------
// SELECT SLOT & INSPECTOR PANEL
// -------------------------------------------------------------

function selectSlot(slot, trigger3DFocus = true) {
    selectedSlot = slot;

    // Update active highlight in matrix
    document.querySelectorAll(".slot-tile").forEach((el) => {
        if (parseInt(el.dataset.slotId) === slot.id) {
            el.classList.add("selected");
            el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else {
            el.classList.remove("selected");
        }
    });

    // Check if this slot currently has an active booking
    const activeBooking = allBookings.find((b) => b.slot_id === slot.id && b.status === "active");
    if (activeBooking) {
        renderInPlacePass(activeBooking);
    } else {
        // Populate Inspector Card standard view
        const inspector = document.getElementById("inspectorBody");
        if (inspector) {
            const isAvailable = slot.status === "available";
            inspector.innerHTML = `
                <div class="inspector-details">
                    <div class="inspector-header-row">
                        <span class="inspector-slot-name">Bay ${slot.slot_number}</span>
                        <span class="badge ${slot.status}">${slot.status.toUpperCase()}</span>
                    </div>
                    <table class="inspector-table">
                        <tr><td>Floor Deck</td><td>Floor P${slot.floor_id}</td></tr>
                        <tr><td>Near Lift</td><td>${slot.near_lift || "None"}</td></tr>
                        <tr><td>Near Stairs</td><td>${slot.near_stairs || "Standard"}</td></tr>
                        <tr><td>Main Entrance</td><td>${slot.near_entrance ? "Yes (Direct Access)" : "Standard Distance"}</td></tr>
                        <tr><td>3D Coordinates</td><td>X: ${slot.x}, Y: ${slot.y}, Z: ${slot.z}</td></tr>
                    </table>
                    <div class="inspector-action-buttons">
                        ${isAvailable ? `
                            <button class="action-btn park-here" onclick="openParkHereModal(${slot.id})">
                                🚗 Park here
                            </button>
                        ` : ""}
                        <button class="action-btn occupy" onclick="quickStatusChange(${slot.id}, 'occupied')">Occupy</button>
                        <button class="action-btn free" onclick="quickStatusChange(${slot.id}, 'available')">Free</button>
                        <button class="action-btn reserve" onclick="quickStatusChange(${slot.id}, 'reserved')">Reserve</button>
                    </div>
                </div>
            `;
        }
    }

    // Trigger 3D focus
    if (trigger3DFocus && window.ParkMe3D && typeof window.ParkMe3D.selectSlot === "function") {
        window.ParkMe3D.selectSlot(slot.slot_number, true);
    }
}

// -------------------------------------------------------------
// QUICK STATUS UPDATE
// -------------------------------------------------------------

window.quickStatusChange = async function (slotId, newStatus) {
    try {
        const res = await fetch(`${API_URL}/parking-slots/${slotId}/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus })
        });

        const data = await res.json();
        if (!res.ok) {
            showToast(data.error || "Failed to update status", "error");
            return;
        }

        await loadParkingSlots();
        await loadStats();
        await loadBookings();
        showToast(data.message || "Bay updated");
    } catch (err) {
        console.error("Status update error:", err);
        showToast("Could not reach the ParkMe server.", "error");
    }
};

// -------------------------------------------------------------
// SMART PARKING RECOMMENDATION
// -------------------------------------------------------------

async function handleRecommendation() {
    const select = document.getElementById("destinationSelect");
    const destId = select.value;
    const container = document.getElementById("recommendationContainer");

    if (!destId) {
        container.innerHTML = `
            <div class="empty-state-hint" style="color: #f59e0b;">
                ⚠️ Please select a destination from the dropdown above.
            </div>
        `;
        return;
    }

    const preferLift = document.getElementById("prefLift").checked;
    const preferEntrance = document.getElementById("prefEntrance").checked;
    const preferStairs = document.getElementById("prefStairs").checked;

    container.innerHTML = `
        <div class="empty-state-hint">
            <span class="spinner" style="width: 24px; height: 24px; margin: 0 auto 8px; display: block;"></span>
            Calculating optimal 3D spatial trajectory...
        </div>
    `;

    try {
        const queryParams = new URLSearchParams({
            destination: destId,
            prefer_lift: preferLift,
            prefer_entrance: preferEntrance,
            prefer_stairs: preferStairs
        });

        const res = await fetch(`${API_URL}/recommendation?${queryParams.toString()}`);
        const data = await res.json();

        if (!res.ok) {
            container.innerHTML = `
                <div class="empty-state-hint" style="color: #f43f5e;">
                    ❌ ${data.error || "No recommendation available"}
                </div>
            `;
            return;
        }

        const best = data.recommended_slot;
        const dest = data.destination;
        const alternatives = data.alternatives || [];

        // Build feature tags
        let featuresHTML = "";
        best.match_reasons.forEach((r) => {
            featuresHTML += `<span class="feature-tag">✓ ${r}</span>`;
        });

        // Build alternatives
        let altHTML = "";
        if (alternatives.length > 0) {
            altHTML = `
                <div class="alternatives-container">
                    <div class="alt-heading">Alternative Available Spots:</div>
                    ${alternatives.map((alt) => `
                        <div class="alt-item" onclick="selectSlotByNumber('${alt.slot_number}')">
                            <span class="alt-slot">Bay ${alt.slot_number}</span>
                            <span>P${alt.floor_id} • ${alt.distance_meters}m • ~${alt.walk_time}</span>
                        </div>
                    `).join("")}
                </div>
            `;
        }

        container.innerHTML = `
            <div class="recommendation-box">
                <div class="rec-badge-row">
                    <span class="rec-title-tag">Best match · ${dest.name}</span>
                    <span class="badge recommended">AI MATCH</span>
                </div>
                <div class="rec-slot-hero">
                    <span class="rec-slot-number">${best.slot_number}</span>
                    <span class="rec-slot-floor">Floor P${best.floor_id}</span>
                </div>
                <div class="rec-metrics">
                    <div class="rec-metric-card">
                        <div class="metric-lbl">EST. WALK TIME</div>
                        <div class="metric-val">⏱️ ${best.walk_time}</div>
                    </div>
                    <div class="rec-metric-card">
                        <div class="metric-lbl">DISTANCE TO VENUE</div>
                        <div class="metric-val">📐 ${best.distance_meters} m</div>
                    </div>
                </div>
                <div class="rec-features">
                    ${featuresHTML}
                </div>
                <div class="rec-actions">
                    <button class="btn btn-secondary" onclick="focusRecommended3D('${best.slot_number}')">
                        Focus 3D route
                    </button>
                    <button class="btn btn-primary" onclick="openParkHereModal(${best.id})">
                        Park here
                    </button>
                </div>
                ${altHTML}
            </div>
        `;

        // Trigger 3D waypoint highlighting & navigation line in Three.js
        if (window.ParkMe3D && typeof window.ParkMe3D.highlightRecommendation === "function") {
            window.ParkMe3D.highlightRecommendation(best.slot_number);
        }

        // Also select the slot in the inspector
        const matchingSlot = allSlots.find((s) => s.slot_number === best.slot_number);
        if (matchingSlot) {
            selectSlot(matchingSlot, false);
        }
    } catch (err) {
        console.error("Recommendation error:", err);
        container.innerHTML = `
            <div class="empty-state-hint" style="color: #f43f5e;">
                ⚠️ Failed to calculate recommendation. Check API connectivity.
            </div>
        `;
    }
}

window.selectSlotByNumber = function (slotNumber) {
    const slot = allSlots.find((s) => s.slot_number === slotNumber);
    if (slot) {
        selectSlot(slot, true);
    }
};

window.focusRecommended3D = function (slotNumber) {
    if (window.ParkMe3D && typeof window.ParkMe3D.highlightRecommendation === "function") {
        window.ParkMe3D.highlightRecommendation(slotNumber);
    }
};

// -------------------------------------------------------------
// UI EVENT LISTENERS
// -------------------------------------------------------------

function initUIEventListeners() {
    // Recommend Button
    document.getElementById("recommendButton")?.addEventListener("click", handleRecommendation);

    // Refresh Button
    document.getElementById("btnRefresh")?.addEventListener("click", async () => {
        const btn = document.getElementById("btnRefresh");
        btn.style.transform = "rotate(360deg)";
        btn.style.transition = "transform 0.5s ease";
        await loadAllData();
        setTimeout(() => {
            btn.style.transform = "none";
            btn.style.transition = "none";
        }, 500);
    });

    // Simulate Traffic Button
    document.getElementById("btnSimulate")?.addEventListener("click", async () => {
        try {
            const res = await fetch(`${API_URL}/parking-slots/simulate`, { method: "POST" });
            if (res.ok) {
                await loadParkingSlots();
                await loadStats();
                showToast("Traffic simulation applied");
            }
        } catch (err) {
            console.error("Simulation error:", err);
        }
    });

    // 3D Toolbar: Floor View Filter Buttons
    const floorViewBtns = document.querySelectorAll("#floorViewSelector .pill");
    floorViewBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            floorViewBtns.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            const floor = parseInt(btn.dataset.floor);
            if (window.ParkMe3D && typeof window.ParkMe3D.filterFloorVisibility === "function") {
                window.ParkMe3D.filterFloorVisibility(floor);
            }
        });
    });

    // 3D Toolbar: Camera Presets
    const camBtns = document.querySelectorAll("#cameraAngleSelector .pill");
    camBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            camBtns.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            const camType = btn.dataset.cam;
            if (window.ParkMe3D && typeof window.ParkMe3D.setCameraPreset === "function") {
                window.ParkMe3D.setCameraPreset(camType);
            }
        });
    });

    // Floating 3D Controls
    document.getElementById("btnAutoRotate")?.addEventListener("click", () => {
        isAutoRotating = !isAutoRotating;
        const btn = document.getElementById("btnAutoRotate");
        btn.classList.toggle("active", isAutoRotating);
        if (window.ParkMe3D && typeof window.ParkMe3D.toggleAutoRotate === "function") {
            window.ParkMe3D.toggleAutoRotate(isAutoRotating);
        }
    });

    document.getElementById("btnResetCamera")?.addEventListener("click", () => {
        if (window.ParkMe3D && typeof window.ParkMe3D.setCameraPreset === "function") {
            window.ParkMe3D.setCameraPreset("overview");
        }
    });

    document.getElementById("btnFullscreen")?.addEventListener("click", () => {
        if (window.ParkMe3D && typeof window.ParkMe3D.toggleFullscreen === "function") {
            window.ParkMe3D.toggleFullscreen();
        }
    });

    // Matrix Filters: Floor
    const matrixFloorBtns = document.querySelectorAll("#matrixFloorFilter .pill");
    matrixFloorBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            matrixFloorBtns.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            activeFloorFilter = btn.dataset.floor;
            renderSlotMatrix();
        });
    });

    // Matrix Filters: Status
    const matrixStatusBtns = document.querySelectorAll("#matrixStatusFilter .pill");
    matrixStatusBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            matrixStatusBtns.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            activeStatusFilter = btn.dataset.status;
            renderSlotMatrix();
        });
    });

    // Matrix Search Input
    document.getElementById("slotSearchInput")?.addEventListener("input", (e) => {
        activeSearchQuery = e.target.value.trim();
        renderSlotMatrix();
    });

    // Navigation Tabs (3D Twin View & Your Bookings)
    document.getElementById("navTwinTab")?.addEventListener("click", () => switchView("twin"));
    document.getElementById("navBookingsTab")?.addEventListener("click", () => switchView("bookings"));

    // Bookings Page Buttons
    document.getElementById("btnRefreshBookings")?.addEventListener("click", async () => {
        await loadBookings();
        showToast("Bookings refreshed");
    });
    document.getElementById("btnNewBooking")?.addEventListener("click", () => {
        switchView("twin");
    });

    // Modal Close & Cancel
    document.getElementById("btnModalClose")?.addEventListener("click", closeParkHereModal);
    document.getElementById("btnModalCancel")?.addEventListener("click", closeParkHereModal);

    // Modal Overlay backdrop click
    document.getElementById("bookingModal")?.addEventListener("click", (e) => {
        if (e.target.id === "bookingModal") closeParkHereModal();
    });

    // Modal Confirm Booking
    document.getElementById("btnModalConfirm")?.addEventListener("click", confirmBooking);

    // Duration Chips
    const chips = document.querySelectorAll("#modalDurationChips .duration-chip");
    chips.forEach((chip) => {
        chip.addEventListener("click", () => {
            chips.forEach((c) => c.classList.remove("active"));
            chip.classList.add("active");
            selectedBookingDuration = parseFloat(chip.dataset.hours);
            const customInput = document.getElementById("modalCustomHoursInput");
            if (customInput) customInput.value = selectedBookingDuration.toFixed(1);
            updateModalFeeCalculation();
        });
    });

    // Custom Hours Input
    document.getElementById("modalCustomHoursInput")?.addEventListener("input", (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val) || val <= 0) val = 0.5;
        if (val > 24) val = 24;
        selectedBookingDuration = val;
        chips.forEach((c) => {
            c.classList.toggle("active", parseFloat(c.dataset.hours) === val);
        });
        updateModalFeeCalculation();
    });
}

// -------------------------------------------------------------
// NAVIGATION & VIEW SWITCHING
// -------------------------------------------------------------

window.switchView = function (view) {
    const twinTab = document.getElementById("navTwinTab");
    const bookingsTab = document.getElementById("navBookingsTab");
    const viewTwin = document.getElementById("viewTwin");
    const viewBookings = document.getElementById("viewBookings");

    if (view === "bookings") {
        twinTab?.classList.remove("active");
        twinTab?.setAttribute("aria-selected", "false");
        bookingsTab?.classList.add("active");
        bookingsTab?.setAttribute("aria-selected", "true");

        viewTwin?.classList.add("hidden");
        viewBookings?.classList.remove("hidden");
        window.location.hash = "bookings";
        renderBookingsPage();
    } else {
        bookingsTab?.classList.remove("active");
        bookingsTab?.setAttribute("aria-selected", "false");
        twinTab?.classList.add("active");
        twinTab?.setAttribute("aria-selected", "true");

        viewBookings?.classList.add("hidden");
        viewTwin?.classList.remove("hidden");
        if (window.location.hash === "#bookings") {
            history.replaceState(null, "", window.location.pathname);
        }
        window.dispatchEvent(new Event("resize"));
    }
};

// -------------------------------------------------------------
// BOOKING API & BADGE MANAGEMENT
// -------------------------------------------------------------

async function loadBookings() {
    try {
        const res = await fetch(`${API_URL}/bookings`);
        if (!res.ok) return;
        allBookings = await res.json();
        updateBookingsBadge();
        renderBookingsPage();
    } catch (err) {
        console.warn("Failed to load bookings from API:", err);
    }
}

function updateBookingsBadge() {
    const badge = document.getElementById("bookingsCountBadge");
    const activeCount = allBookings.filter((b) => b.status === "active").length;
    if (badge) {
        badge.textContent = activeCount;
        badge.classList.toggle("hidden", activeCount === 0);
    }
}

// -------------------------------------------------------------
// "PARK HERE" BOOKING & FINE WARNING MODAL
// -------------------------------------------------------------

window.openParkHereModal = function (slotId) {
    const slot = allSlots.find((s) => s.id === slotId);
    if (!slot) {
        showToast("Slot not found", "error");
        return;
    }

    if (slot.status !== "available") {
        showToast(`Bay ${slot.slot_number} is currently ${slot.status}. Only available spaces can be booked.`, "error");
        return;
    }

    currentBookingSlot = slot;
    selectedBookingDuration = 1.0;

    const slotNumEl = document.getElementById("modalSlotNum");
    if (slotNumEl) slotNumEl.textContent = `Bay ${slot.slot_number}`;

    const subEl = document.getElementById("modalSlotSubtitle");
    if (subEl) subEl.textContent = `Floor P${slot.floor_id} · Direct Space Reservation`;

    const metaEl = document.getElementById("modalSlotMeta");
    if (metaEl) {
        metaEl.textContent = `Floor P${slot.floor_id}${slot.near_lift ? " • " + slot.near_lift : ""}${slot.near_entrance ? " • Near Entrance" : ""}`;
    }

    // Reset duration chips to 1 hour
    document.querySelectorAll("#modalDurationChips .duration-chip").forEach((chip) => {
        chip.classList.toggle("active", parseFloat(chip.dataset.hours) === 1.0);
    });

    const customInput = document.getElementById("modalCustomHoursInput");
    if (customInput) customInput.value = "1.0";

    updateModalFeeCalculation();

    const modal = document.getElementById("bookingModal");
    modal?.classList.remove("hidden");
};

function closeParkHereModal() {
    const modal = document.getElementById("bookingModal");
    modal?.classList.add("hidden");
    currentBookingSlot = null;
}

function updateModalFeeCalculation() {
    const hours = selectedBookingDuration;
    const ratePerHour = 50.0;
    const totalFee = (hours * ratePerHour).toFixed(2);

    const feeEl = document.getElementById("modalTotalFeeDisplay");
    if (feeEl) feeEl.textContent = `₹${totalFee}`;

    const noteEl = document.getElementById("modalDurationNote");
    if (noteEl) noteEl.textContent = `(${Math.round(hours * 60)} minutes)`;

    const now = new Date();
    const expiry = new Date(now.getTime() + hours * 3600 * 1000);
    const timeStr = expiry.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const expiryEl = document.getElementById("modalExpiryLimitPreview");
    if (expiryEl) expiryEl.textContent = `${timeStr} (in ${hours} hr${hours > 1 ? "s" : ""})`;
}

async function confirmBooking() {
    if (!currentBookingSlot) return;

    const vehiclePlate = (document.getElementById("modalVehiclePlate")?.value || "KA-01-MJ-2024").trim().toUpperCase();
    const hours = selectedBookingDuration;
    const fee = hours * 50.0;

    const btnConfirm = document.getElementById("btnModalConfirm");
    if (btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.textContent = "Issuing pass...";
    }

    try {
        const res = await fetch(`${API_URL}/bookings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                slot_id: currentBookingSlot.id,
                duration_hours: hours,
                parking_fee: fee,
                vehicle_number: vehiclePlate,
                fine_rate: 100.0
            })
        });

        const data = await res.json();
        if (!res.ok) {
            showToast(data.error || "Failed to book bay", "error");
            if (btnConfirm) {
                btnConfirm.disabled = false;
                btnConfirm.textContent = "Accept Policy & Park Here";
            }
            return;
        }

        const bookedPass = data.booking;
        closeParkHereModal();
        showToast(data.message || `Bay ${currentBookingSlot.slot_number} booked successfully!`);

        await loadParkingSlots();
        await loadStats();
        await loadBookings();

        // Render QR pass directly on the parking details field (Inspector & Recommendation)
        renderInPlacePass(bookedPass);

    } catch (err) {
        console.error("Booking error:", err);
        showToast("Could not contact server: " + err.message, "error");
    } finally {
        if (btnConfirm) {
            btnConfirm.disabled = false;
            btnConfirm.textContent = "Accept Policy & Park Here";
        }
    }
}

// -------------------------------------------------------------
// CHECKOUT / END PARKING SESSION
// -------------------------------------------------------------

window.checkoutBooking = async function (bookingId) {
    if (!confirm("Are you sure you want to end this parking session and free the bay?")) return;
    try {
        const res = await fetch(`${API_URL}/bookings/${bookingId}/checkout`, {
            method: "POST"
        });
        const data = await res.json();
        if (!res.ok) {
            showToast(data.error || "Failed to release bay", "error");
            return;
        }
        showToast(data.message || "Parking session completed. Bay freed.");
        await loadParkingSlots();
        await loadStats();
        await loadBookings();

        // If the inspected slot was this booking's slot, re-select to refresh inspector view
        if (selectedSlot) {
            const refreshed = allSlots.find((s) => s.id === selectedSlot.id);
            if (refreshed) selectSlot(refreshed, false);
        }
    } catch (err) {
        console.error("Checkout error:", err);
        showToast("Error releasing bay: " + err.message, "error");
    }
};

// -------------------------------------------------------------
// IN-PLACE QR PASS RENDERING (PARKING DETAILS FIELD)
// -------------------------------------------------------------

function renderInPlacePass(booking) {
    const inspector = document.getElementById("inspectorBody");
    if (inspector) {
        const timeInfo = getTimeInfo(booking.expiry_time);
        const expiryDate = new Date(booking.expiry_time);
        const expiryStr = expiryDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        inspector.innerHTML = `
            <div class="in-place-pass">
                <div class="pass-top-row">
                    <span class="pass-title">🎟️ Active Pass: Bay ${booking.slot_number}</span>
                    <span class="badge ${timeInfo.isExpired ? "occupied" : "available"}">
                        ${timeInfo.isExpired ? "EXPIRED" : "ACTIVE"}
                    </span>
                </div>
                <div class="pass-qr-center">
                    <div class="qr-box-wrapper">
                        <div class="qr-render-target" id="inspectorQrPass"></div>
                        ${timeInfo.isExpired ? `
                            <div class="qr-expired-lock">
                                <span class="lock-icon">🔒</span>
                                <span class="lock-msg">EXPIRED<br>QR VOID</span>
                            </div>
                        ` : ""}
                    </div>
                    <span class="pass-code-pill">${booking.booking_code}</span>
                </div>
                <div class="pass-countdown-timer ${timeInfo.isExpired ? "overdue" : "valid"}" 
                     data-expiry="${booking.expiry_time}">
                    <span>${timeInfo.isExpired ? "Overstay Time:" : "Remaining:"}</span>
                    <strong class="timer-digits">
                        ${timeInfo.isExpired ? `+${timeInfo.formattedOverdue}` : timeInfo.formatted}
                    </strong>
                </div>
                ${timeInfo.isExpired ? `
                    <div class="overstay-fine-badge">
                        <span class="fine-title">⚠️ OVERSTAY PENALTY APPLIED</span>
                        <span class="fine-calc">Overdue Fine: <strong>₹${timeInfo.overdueFine}</strong> (₹100/hr)</span>
                    </div>
                ` : ""}
                <div class="pass-meta-grid">
                    <div class="meta-cell"><span class="lbl">Vehicle</span><span class="val">${booking.vehicle_number}</span></div>
                    <div class="meta-cell"><span class="lbl">Duration</span><span class="val">${booking.duration_hours} hrs</span></div>
                    <div class="meta-cell"><span class="lbl">Fee Paid</span><span class="val">₹${parseFloat(booking.parking_fee).toFixed(2)}</span></div>
                    <div class="meta-cell"><span class="lbl">Expiry Limit</span><span class="val">${expiryStr}</span></div>
                </div>
                <div class="pass-fine-warning-mini">
                    ⚠️ <strong>Fine Warning:</strong> Overstay fine of ₹100/hr is charged automatically past the expiration limit.
                </div>
                <div class="pass-actions">
                    <button class="btn btn-secondary" onclick="switchView('bookings')">View in Your Bookings</button>
                    <button class="btn btn-ghost" onclick="checkoutBooking(${booking.id})">Release Bay</button>
                </div>
            </div>
        `;

        setTimeout(() => {
            renderQRCode(document.getElementById("inspectorQrPass"), booking.qr_data || booking.booking_code, 120);
        }, 50);
    }

    // Also if recommendation box matches this slot, show the active pass there
    const recContainer = document.getElementById("recommendationContainer");
    const recBox = recContainer?.querySelector(".recommendation-box");
    if (recBox) {
        const recActions = recBox.querySelector(".rec-actions");
        if (recActions) {
            recActions.innerHTML = `
                <div style="width: 100%; display: flex; flex-direction: column; gap: 8px; align-items: center;">
                    <div class="qr-box-wrapper" style="padding: 6px;">
                        <div class="qr-render-target" id="recQrPass"></div>
                    </div>
                    <span class="pass-code-pill">${booking.booking_code} · Active</span>
                    <button class="btn btn-primary btn-block" onclick="switchView('bookings')">
                        View in Your Bookings
                    </button>
                </div>
            `;
            setTimeout(() => {
                renderQRCode(document.getElementById("recQrPass"), booking.qr_data || booking.booking_code, 100);
            }, 50);
        }
    }
}

// -------------------------------------------------------------
// "YOUR BOOKINGS" PAGE RENDERER & EXPIRY ACCESS CONTROL
// -------------------------------------------------------------

function renderBookingsPage() {
    const activeContainer = document.getElementById("activePassesGrid");
    const historyContainer = document.getElementById("historyPassesGrid");
    const activeCategoryPill = document.getElementById("activeCategoryPill");
    const historyCategoryPill = document.getElementById("historyCategoryPill");

    if (!activeContainer || !historyContainer) return;

    const activePasses = allBookings.filter((b) => b.status === "active");
    const historyPasses = allBookings.filter((b) => b.status !== "active");

    if (activeCategoryPill) activeCategoryPill.textContent = `${activePasses.length} active`;
    if (historyCategoryPill) historyCategoryPill.textContent = `${historyPasses.length} past`;

    // Render Active Passes
    if (activePasses.length === 0) {
        activeContainer.innerHTML = `
            <div class="empty-passes-hint">
                <p>No active parking passes found. Select an available bay on the 3D twin to park.</p>
                <button class="btn btn-primary" style="margin-top: 14px;" onclick="switchView('twin')">
                    Go to 3D Digital Twin
                </button>
            </div>
        `;
    } else {
        activeContainer.innerHTML = "";
        activePasses.forEach((pass) => {
            const card = document.createElement("div");
            const timeInfo = getTimeInfo(pass.expiry_time);
            card.className = `booking-pass-card active-pass ${timeInfo.isExpired ? "expired-pass" : ""}`;
            card.id = `booking-card-${pass.id}`;

            const expiryDate = new Date(pass.expiry_time);
            const expiryStr = expiryDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const entryDate = new Date(pass.entry_time);
            const entryStr = entryDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

            card.innerHTML = `
                <div class="pass-card-top">
                    <div class="pass-bay-info">
                        <h4>Bay ${pass.slot_number}</h4>
                        <span class="pass-floor-text">Floor P${pass.floor_id}</span>
                    </div>
                    <span class="pass-code-pill">${pass.booking_code}</span>
                </div>

                <!-- QR Pass Box (Accessible Until Expiring Limit) -->
                <div class="pass-qr-section">
                    <div class="qr-box-wrapper">
                        <div class="qr-render-target" id="qr-target-${pass.id}"></div>
                        ${timeInfo.isExpired ? `
                            <div class="qr-expired-lock">
                                <span class="lock-icon">🔒</span>
                                <span class="lock-msg">EXPIRED<br>QR INACCESSIBLE</span>
                            </div>
                        ` : ""}
                    </div>
                    <span class="pass-scan-instruction">
                        ${timeInfo.isExpired 
                            ? "⚠️ Expiration limit reached. QR pass is locked and void for exit." 
                            : "Scan at facility gate. Valid strictly until expiration limit."}
                    </span>
                </div>

                <!-- Live Countdown Timer -->
                <div class="pass-countdown-timer ${timeInfo.isExpired ? "overdue" : "valid"}" 
                     data-expiry="${pass.expiry_time}" data-booking-id="${pass.id}">
                    <span>${timeInfo.isExpired ? "Overstay Time:" : "Remaining:"}</span>
                    <strong class="timer-digits">
                        ${timeInfo.isExpired ? `+${timeInfo.formattedOverdue}` : timeInfo.formatted}
                    </strong>
                </div>

                ${timeInfo.isExpired ? `
                    <div class="overstay-fine-badge">
                        <span class="fine-title">⚠️ OVERSTAY PENALTY APPLIED</span>
                        <span class="fine-calc">Penalty Fine: <strong>₹${timeInfo.overdueFine}</strong> (billed at ₹100.00/hr)</span>
                    </div>
                ` : ""}

                <!-- Pass Details Table -->
                <table class="pass-table">
                    <tr><td>Vehicle Number</td><td>${pass.vehicle_number}</td></tr>
                    <tr><td>Assigned Duration</td><td>${pass.duration_hours} hrs</td></tr>
                    <tr><td>Base Parking Fee</td><td>₹${parseFloat(pass.parking_fee).toFixed(2)}</td></tr>
                    <tr><td>Entry Time</td><td>${entryStr}</td></tr>
                    <tr><td>Expiration Limit</td><td>${expiryStr}</td></tr>
                </table>

                <div class="pass-actions">
                    <button class="btn ${timeInfo.isExpired ? "btn-primary" : "btn-secondary"}" onclick="checkoutBooking(${pass.id})">
                        ${timeInfo.isExpired ? "Pay Penalty & Release Bay" : "End Session & Free Bay"}
                    </button>
                </div>
            `;

            activeContainer.appendChild(card);

            // Render QR Code (only generated if element exists)
            setTimeout(() => {
                const qrEl = document.getElementById(`qr-target-${pass.id}`);
                if (qrEl) {
                    renderQRCode(qrEl, pass.qr_data || pass.booking_code, 130);
                }
            }, 50);
        });
    }

    // Render History Passes
    if (historyPasses.length === 0) {
        historyContainer.innerHTML = `
            <div class="empty-passes-hint">No completed parking sessions yet.</div>
        `;
    } else {
        historyContainer.innerHTML = "";
        historyPasses.forEach((pass) => {
            const card = document.createElement("div");
            card.className = "booking-pass-card history-pass";
            const exitStr = pass.exit_time 
                ? new Date(pass.exit_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) 
                : "--";

            card.innerHTML = `
                <div class="pass-card-top">
                    <div class="pass-bay-info">
                        <h4>Bay ${pass.slot_number}</h4>
                        <span class="pass-floor-text">Floor P${pass.floor_id}</span>
                    </div>
                    <span class="badge" style="background: rgba(148, 163, 184, 0.2); color: #94a3b8;">COMPLETED</span>
                </div>
                <table class="pass-table" style="margin-top: 8px;">
                    <tr><td>Pass Reference</td><td>${pass.booking_code}</td></tr>
                    <tr><td>Vehicle</td><td>${pass.vehicle_number}</td></tr>
                    <tr><td>Duration</td><td>${pass.duration_hours} hrs</td></tr>
                    <tr><td>Fee Paid</td><td>₹${parseFloat(pass.parking_fee).toFixed(2)}</td></tr>
                    <tr><td>Released At</td><td>${exitStr}</td></tr>
                </table>
            `;
            historyContainer.appendChild(card);
        });
    }
}

// -------------------------------------------------------------
// QR CODE RENDERING HELPER
// -------------------------------------------------------------

function renderQRCode(containerElement, text, size = 128) {
    if (!containerElement) return;
    containerElement.innerHTML = "";
    try {
        if (typeof QRCode !== "undefined") {
            new QRCode(containerElement, {
                text: text,
                width: size,
                height: size,
                colorDark: "#090d16",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        } else {
            containerElement.innerText = text;
        }
    } catch (err) {
        console.error("QRCode render error:", err);
        containerElement.innerText = text;
    }
}

// -------------------------------------------------------------
// EXPIRY & OVERSTAY TIME CALCULATOR
// -------------------------------------------------------------

function getTimeInfo(expiryIso) {
    if (!expiryIso) {
        return { isExpired: false, formatted: "--", diffSec: 0, overdueFine: "0.00" };
    }
    const now = new Date();
    const exp = new Date(expiryIso);
    const diffSec = Math.floor((exp - now) / 1000);

    if (diffSec > 0) {
        const hrs = Math.floor(diffSec / 3600);
        const mins = Math.floor((diffSec % 3600) / 60);
        const secs = diffSec % 60;
        return {
            isExpired: false,
            formatted: `${hrs.toString().padStart(2, "0")}h ${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`,
            diffSec
        };
    } else {
        const overdueSec = Math.abs(diffSec);
        const hrs = Math.floor(overdueSec / 3600);
        const mins = Math.floor((overdueSec % 3600) / 60);
        const secs = overdueSec % 60;
        const overstayHours = Math.max(1.0, overdueSec / 3600);
        return {
            isExpired: true,
            formattedOverdue: `${hrs.toString().padStart(2, "0")}h ${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`,
            overdueHours: overstayHours.toFixed(1),
            overdueFine: (overstayHours * 100).toFixed(2),
            diffSec
        };
    }
}

// -------------------------------------------------------------
// REAL-TIME COUNTDOWN LOOP
// -------------------------------------------------------------

function startCountdownLoop() {
    if (countdownIntervalId) clearInterval(countdownIntervalId);
    countdownIntervalId = setInterval(() => {
        const timerElements = document.querySelectorAll(".pass-countdown-timer[data-expiry]");
        timerElements.forEach((el) => {
            const expiry = el.dataset.expiry;
            if (!expiry) return;
            const timeInfo = getTimeInfo(expiry);
            const digitsEl = el.querySelector(".timer-digits");
            const labelEl = el.querySelector("span");

            if (timeInfo.isExpired) {
                if (!el.classList.contains("overdue")) {
                    el.classList.remove("valid");
                    el.classList.add("overdue");
                    renderBookingsPage();
                    return;
                }
                if (labelEl) labelEl.textContent = "Overstay Time:";
                if (digitsEl) digitsEl.textContent = `+${timeInfo.formattedOverdue}`;
            } else {
                if (labelEl) labelEl.textContent = "Remaining:";
                if (digitsEl) digitsEl.textContent = timeInfo.formatted;
            }
        });
    }, 1000);
}