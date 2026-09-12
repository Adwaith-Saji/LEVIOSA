import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// -------------------------------------------------------------
// GLOBAL 3D DIGITAL TWIN CONTROLLER
// -------------------------------------------------------------

const container = document.getElementById("threeContainer");
const tooltip = document.getElementById("slot3DTooltip");
const progressBar = document.getElementById("loadingProgressBar");
const loadingOverlay = document.getElementById("modelLoadingOverlay");

// Scene & Camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f19);
scene.fog = new THREE.FogExp2(0x0b0f19, 0.012);

const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / (container.clientHeight || 560),
    0.1,
    1000
);
camera.position.set(28, 22, 32);

// Renderer
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
});
renderer.setSize(container.clientWidth, container.clientHeight || 560);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.domElement.style.width = "100%";
renderer.domElement.style.height = "100%";
renderer.domElement.style.touchAction = "none";
container.appendChild(renderer.domElement);

// Orbit Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI / 2 - 0.04;
controls.minDistance = 6;
controls.maxDistance = 90;
controls.target.set(0, 2, 0);
controls.enablePan = true;
controls.screenSpacePanning = false;
controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN
};

// Lighting
const ambientLight = new THREE.AmbientLight(0xdce7f5, 0.9);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0x8bc34a, 0x1e293b, 0.5);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfffaed, 1.4);
sunLight.position.set(30, 45, 25);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 120;
sunLight.shadow.camera.left = -35;
sunLight.shadow.camera.right = 35;
sunLight.shadow.camera.top = 35;
sunLight.shadow.camera.bottom = -35;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

// Fill Light (Cyber Cyan soft fill)
const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
fillLight.position.set(-25, 20, -25);
scene.add(fillLight);

// -------------------------------------------------------------
// STATE & REGISTRIES
// -------------------------------------------------------------

const carGroups = {};          // slotNumber -> THREE.Group
const slotPads = {};           // slotNumber -> THREE.Mesh
const slotBoundingBoxes = [];  // Array of meshes for raycasting
let currentSlotsData = [];     // Cached list of slot objects from API
let selectedSlotNumber = null;
let recommendedSlotNumber = null;
let navigationPathObject = null;
let recommendationMarker = null;
let floor2Elements = [];       // Store Floor 2 objects for floor isolating/fading
let autoRotateActive = false;

// Raycasting
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredSlot = null;

// Camera Animation Target
let cameraAnim = null; // { fromPos, toPos, fromTarget, toTarget, progress, duration }

// -------------------------------------------------------------
// MODEL LOADER (parking.glb)
// -------------------------------------------------------------

const loader = new GLTFLoader();

function initModel() {
    const modelUrl = "models/parking.glb";

    loader.load(
        modelUrl,
        (gltf) => {
            const root = gltf.scene;
            scene.add(root);

            root.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // Optimize material roughness & metallic for nice ambient reflections
                    if (child.material) {
                        child.material.roughness = Math.min(child.material.roughness || 0.6, 0.85);
                    }

                    // Check if mesh belongs to Floor 2 for floor-filtering
                    if (child.position.y > 2.5 || (child.name && child.name.includes("Floor 2"))) {
                        floor2Elements.push(child);
                    }
                }

                // Index CAR groups (CAR_A01 to CAR_A20, CAR_B01 to CAR_B20)
                if (child.name && child.name.startsWith("CAR_")) {
                    const slotNum = child.name.replace("CAR_", "");
                    carGroups[slotNum] = child;
                }
            });

            // Create interactive glowing bay indicator pads for all 40 slots
            buildSlotInteractivePads();

            // Apply any already-loaded slot statuses
            if (currentSlotsData.length > 0) {
                applySlotStatuses(currentSlotsData);
            }

            // Hide loading overlay
            if (loadingOverlay) {
                loadingOverlay.classList.add("hidden");
            }
            handleResize();
            console.log("3D Parking Model loaded successfully. Found car slots:", Object.keys(carGroups).length);
            window.dispatchEvent(new CustomEvent("parkme:3d-ready"));
        },
        (xhr) => {
            if (xhr.lengthComputable && progressBar) {
                const percent = Math.round((xhr.loaded / xhr.total) * 100);
                progressBar.style.width = `${percent}%`;
                const progressText = document.getElementById("loadingProgressText");
                if (progressText) progressText.innerText = `Loading 3D Twin... ${percent}%`;
            }
        },
        (error) => {
            console.error("❌ Failed to load parking.glb:", error);
            buildProceduralFallback();
            buildSlotInteractivePads();
            if (currentSlotsData.length > 0) {
                applySlotStatuses(currentSlotsData);
            }
            if (loadingOverlay) {
                loadingOverlay.classList.add("hidden");
            }
            handleResize();
        }
    );
}

function buildProceduralFallback() {
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
    const deck1 = new THREE.Mesh(new THREE.BoxGeometry(32, 0.25, 24), deckMat);
    deck1.position.y = -0.12;
    deck1.receiveShadow = true;
    scene.add(deck1);

    const deck2 = new THREE.Mesh(new THREE.BoxGeometry(32, 0.25, 24), deckMat);
    deck2.position.y = 4.38;
    deck2.receiveShadow = true;
    scene.add(deck2);
    floor2Elements.push(deck2);

    const pillarGeom = new THREE.CylinderGeometry(0.28, 0.32, 4.5, 12);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.4 });
    [-12, 0, 12].forEach((x) => {
        [-8, 8].forEach((z) => {
            const pillar = new THREE.Mesh(pillarGeom, pillarMat);
            pillar.position.set(x, 2.2, z);
            pillar.castShadow = true;
            scene.add(pillar);
        });
    });
}

function buildSlotInteractivePads() {
    // 40 slots coordinates:
    // A01..A10 (Floor 1, y=0.06, z=8.85)
    // A11..A20 (Floor 1, y=0.06, z=-8.85)
    // B01..B10 (Floor 2, y=4.56, z=8.85)
    // B11..B20 (Floor 2, y=4.56, z=-8.85)

    const padGeom = new THREE.BoxGeometry(2.3, 0.08, 4.8);

    const floorY = { 1: 0.06, 2: 4.56 };
    const xPositions = [-11.7, -9.1, -6.5, -3.9, -1.3, 1.3, 3.9, 6.5, 9.1, 11.7];

    // Generate pads for Floor 1 (A01-A20) and Floor 2 (B01-B20)
    const slotConfigs = [];
    // P1
    for (let i = 0; i < 10; i++) {
        const num = (i + 1).toString().padStart(2, "0");
        slotConfigs.push({ num: `A${num}`, floor: 1, x: xPositions[i], y: floorY[1], z: 8.85 });
    }
    for (let i = 0; i < 10; i++) {
        const num = (i + 11).toString().padStart(2, "0");
        slotConfigs.push({ num: `A${num}`, floor: 1, x: xPositions[i], y: floorY[1], z: -8.85 });
    }
    // P2
    for (let i = 0; i < 10; i++) {
        const num = (i + 1).toString().padStart(2, "0");
        slotConfigs.push({ num: `B${num}`, floor: 2, x: xPositions[i], y: floorY[2], z: 8.85 });
    }
    for (let i = 0; i < 10; i++) {
        const num = (i + 11).toString().padStart(2, "0");
        slotConfigs.push({ num: `B${num}`, floor: 2, x: xPositions[i], y: floorY[2], z: -8.85 });
    }

    slotConfigs.forEach((cfg) => {
        const mat = new THREE.MeshStandardMaterial({
            color: 0x10b981, // Default Available Green
            transparent: true,
            opacity: 0.45,
            roughness: 0.3,
            metalness: 0.1
        });

        const pad = new THREE.Mesh(padGeom, mat);
        pad.position.set(cfg.x, cfg.y, cfg.z);
        pad.userData = {
            slotNumber: cfg.num,
            floor: cfg.floor,
            baseY: cfg.y,
            status: "available"
        };
        pad.receiveShadow = true;

        // Wireframe border outline for modern neon look
        const edges = new THREE.EdgesGeometry(padGeom);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x34d399, linewidth: 2 });
        const wireframe = new THREE.LineSegments(edges, lineMat);
        pad.add(wireframe);
        pad.userData.wireframe = wireframe;

        scene.add(pad);
        slotPads[cfg.num] = pad;
        slotBoundingBoxes.push(pad);

        if (cfg.floor === 2) {
            floor2Elements.push(pad);
        }
    });
}

// -------------------------------------------------------------
// UPDATE SLOT VISUALS ACCORDING TO LIVE DATA
// -------------------------------------------------------------

export function applySlotStatuses(slots) {
    currentSlotsData = slots;

    slots.forEach((slot) => {
        const slotNum = slot.slot_number;
        const car = carGroups[slotNum];
        const pad = slotPads[slotNum];

        if (!pad) return;
        pad.userData.status = slot.status;
        pad.userData.slotData = slot;

        if (slot.status === "available") {
            // Available: Hide car, green glowing bay
            if (car) car.visible = false;
            pad.material.color.setHex(0x10b981);
            pad.material.opacity = 0.35;
            pad.userData.wireframe.material.color.setHex(0x34d399);
        } else if (slot.status === "occupied") {
            // Occupied: Show car, subtle red ground indicator
            if (car) car.visible = true;
            pad.material.color.setHex(0xef4444);
            pad.material.opacity = 0.25;
            pad.userData.wireframe.material.color.setHex(0xf87171);
        } else if (slot.status === "reserved") {
            // Reserved: Hide car, amber/yellow glowing bay
            if (car) car.visible = false;
            pad.material.color.setHex(0xf59e0b);
            pad.material.opacity = 0.65;
            pad.userData.wireframe.material.color.setHex(0xfbbf24);
        }

        // Highlight selected or recommended
        if (slotNum === selectedSlotNumber) {
            pad.material.color.setHex(0x06b6d4);
            pad.material.opacity = 0.85;
            pad.userData.wireframe.material.color.setHex(0x22d3ee);
        } else if (slotNum === recommendedSlotNumber) {
            pad.material.color.setHex(0xa855f7);
            pad.material.opacity = 0.9;
            pad.userData.wireframe.material.color.setHex(0xc084fc);
        }
    });
}

// -------------------------------------------------------------
// SELECT AND FOCUS A SLOT
// -------------------------------------------------------------

export function selectSlot(slotNumber, moveCamera = true) {
    selectedSlotNumber = slotNumber;
    applySlotStatuses(currentSlotsData);

    const pad = slotPads[slotNumber];
    if (pad && moveCamera) {
        const targetPos = new THREE.Vector3(pad.position.x, pad.position.y + 0.5, pad.position.z);
        const camPos = new THREE.Vector3(
            pad.position.x + 8,
            pad.position.y + 7,
            pad.position.z + 12
        );
        animateCameraTo(camPos, targetPos, 900);
    }
}

// -------------------------------------------------------------
// RECOMMENDATION WAYPOINT PATH & FLOATING PIN
// -------------------------------------------------------------

export function highlightRecommendation(slotNumber) {
    recommendedSlotNumber = slotNumber;
    applySlotStatuses(currentSlotsData);

    const pad = slotPads[slotNumber];
    if (!pad) return;

    // Remove prior pin/path
    if (recommendationMarker) {
        scene.remove(recommendationMarker);
        recommendationMarker = null;
    }
    if (navigationPathObject) {
        scene.remove(navigationPathObject);
        navigationPathObject = null;
    }

    // 1. Create Bouncing 3D Marker Pin
    const pinGroup = new THREE.Group();
    const coneGeom = new THREE.ConeGeometry(0.7, 1.8, 16);
    coneGeom.rotateX(Math.PI); // Point downwards
    const coneMat = new THREE.MeshStandardMaterial({
        color: 0x8b5cf6,
        emissive: 0x7c3aed,
        emissiveIntensity: 0.8,
        roughness: 0.2
    });
    const cone = new THREE.Mesh(coneGeom, coneMat);
    cone.position.y = 2.4;
    pinGroup.add(cone);

    const ringGeom = new THREE.RingGeometry(0.8, 1.2, 32);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.position.y = 0.15;
    pinGroup.add(ring);

    pinGroup.position.set(pad.position.x, pad.position.y, pad.position.z);
    pinGroup.userData.baseY = pad.position.y;
    scene.add(pinGroup);
    recommendationMarker = pinGroup;

    // 2. Build Guided Waypoint Navigation Path
    const pathPoints = [];
    const isFloor2 = pad.userData.floor === 2;

    // Start at facility entrance
    pathPoints.push(new THREE.Vector3(0, 0.25, 16));

    if (!isFloor2) {
        // Floor 1 path: Entrance -> Lane -> Spot
        pathPoints.push(new THREE.Vector3(0, 0.25, pad.position.z > 0 ? 5 : -4));
        pathPoints.push(new THREE.Vector3(pad.position.x, 0.25, pad.position.z > 0 ? 5 : -4));
        pathPoints.push(new THREE.Vector3(pad.position.x, 0.25, pad.position.z));
    } else {
        // Floor 2 path: Entrance -> Ramp Bottom -> Ramp Top -> Deck Lane -> Spot
        pathPoints.push(new THREE.Vector3(12, 0.25, 16));
        pathPoints.push(new THREE.Vector3(18, 0.35, 18));
        pathPoints.push(new THREE.Vector3(18, 2.4, 10)); // Mid ramp
        pathPoints.push(new THREE.Vector3(16, 4.65, 2));  // Floor 2 connection
        pathPoints.push(new THREE.Vector3(0, 4.65, pad.position.z > 0 ? 5 : -4));
        pathPoints.push(new THREE.Vector3(pad.position.x, 4.65, pad.position.z > 0 ? 5 : -4));
        pathPoints.push(new THREE.Vector3(pad.position.x, 4.65, pad.position.z));
    }

    const curve = new THREE.CatmullRomCurve3(pathPoints);
    const tubeGeom = new THREE.TubeGeometry(curve, 64, 0.14, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.85
    });
    navigationPathObject = new THREE.Mesh(tubeGeom, tubeMat);
    scene.add(navigationPathObject);

    // Smoothly fly camera to show route
    const camX = pad.position.x * 0.7;
    const camY = isFloor2 ? 14 : 10;
    const camZ = pad.position.z + (pad.position.z > 0 ? 12 : -12);
    animateCameraTo(
        new THREE.Vector3(camX, camY, camZ),
        new THREE.Vector3(pad.position.x, pad.position.y + 1, pad.position.z),
        1100
    );
}

export function clearRecommendationHighlight() {
    recommendedSlotNumber = null;
    if (recommendationMarker) {
        scene.remove(recommendationMarker);
        recommendationMarker = null;
    }
    if (navigationPathObject) {
        scene.remove(navigationPathObject);
        navigationPathObject = null;
    }
    applySlotStatuses(currentSlotsData);
}

// -------------------------------------------------------------
// CAMERA PRESETS & FLOOR ISOLATION
// -------------------------------------------------------------

export function setCameraPreset(type) {
    switch (type) {
        case "overview":
            animateCameraTo(new THREE.Vector3(26, 22, 30), new THREE.Vector3(0, 2, 0), 1000);
            break;
        case "topdown":
            animateCameraTo(new THREE.Vector3(0, 40, 0.1), new THREE.Vector3(0, 0, 0), 1000);
            break;
        case "floor1":
            animateCameraTo(new THREE.Vector3(0, 7, 24), new THREE.Vector3(0, 0, 0), 1000);
            break;
        case "floor2":
            animateCameraTo(new THREE.Vector3(0, 16, 26), new THREE.Vector3(0, 4.5, 0), 1000);
            break;
        case "entrance":
            animateCameraTo(new THREE.Vector3(0, 4, 25), new THREE.Vector3(0, 1.5, 10), 1000);
            break;
        default:
            animateCameraTo(new THREE.Vector3(26, 22, 30), new THREE.Vector3(0, 2, 0), 1000);
    }
}

export function filterFloorVisibility(floorId) {
    // floorId: 0 (all), 1 (P1 only), 2 (P2 only)
    floor2Elements.forEach((obj) => {
        if (floorId === 1) {
            // Lower opacity or hide Floor 2 so Floor 1 is clearly visible
            if (obj.material) {
                obj.userData.origOpacity = obj.userData.origOpacity || obj.material.opacity;
                obj.material.transparent = true;
                obj.material.opacity = 0.08;
            } else {
                obj.visible = false;
            }
        } else {
            // Restore visibility
            if (obj.material) {
                obj.material.opacity = obj.userData.origOpacity || 1.0;
                if (obj.userData.origOpacity === undefined) obj.material.transparent = false;
            } else {
                obj.visible = true;
            }
        }
    });

    // Also toggle car group visibility for the filtered floor
    Object.keys(carGroups).forEach((num) => {
        const car = carGroups[num];
        const isB = num.startsWith("B");
        if (floorId === 1 && isB) {
            car.visible = false;
        } else if (floorId === 2 && !isB) {
            car.visible = false;
        } else {
            const slotData = currentSlotsData.find((s) => s.slot_number === num);
            if (slotData) {
                car.visible = (slotData.status === "occupied");
            }
        }
    });
}

// -------------------------------------------------------------
// SMOOTH CAMERA TWEENING
// -------------------------------------------------------------

function animateCameraTo(toPos, toTarget, duration = 800) {
    cameraAnim = {
        fromPos: camera.position.clone(),
        toPos: toPos.clone(),
        fromTarget: controls.target.clone(),
        toTarget: toTarget.clone(),
        startTime: performance.now(),
        duration: duration
    };
}

// -------------------------------------------------------------
// RAYCASTING (HOVER & CLICK)
// -------------------------------------------------------------

function onPointerMove(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(slotBoundingBoxes, false);

    if (intersects.length > 0) {
        const hit = intersects[0].object;
        const slotNum = hit.userData.slotNumber;
        const slotData = hit.userData.slotData || currentSlotsData.find((s) => s.slot_number === slotNum);

        container.style.cursor = "pointer";
        hoveredSlot = slotNum;

        // Position & populate floating tooltip
        if (tooltip && slotData) {
            tooltip.classList.remove("hidden");
            tooltip.style.left = `${event.clientX - rect.left + 15}px`;
            tooltip.style.top = `${event.clientY - rect.top - 20}px`;

            const statusClass = slotData.status;
            tooltip.innerHTML = `
                <div class="tooltip-header">
                    <strong>Slot ${slotData.slot_number}</strong>
                    <span class="badge ${statusClass}">${slotData.status.toUpperCase()}</span>
                </div>
                <div class="tooltip-body">
                    <div>Floor P${slotData.floor_id}</div>
                    ${slotData.near_lift ? `<div>Lift: ${slotData.near_lift}</div>` : ""}
                    ${slotData.near_entrance ? `<div>Near Entrance</div>` : ""}
                </div>
            `;
        }
    } else {
        container.style.cursor = "default";
        hoveredSlot = null;
        if (tooltip) tooltip.classList.add("hidden");
    }
}

function onPointerClick(event) {
    if (hoveredSlot) {
        selectSlot(hoveredSlot, true);
        // Dispatch custom event to notify script.js
        window.dispatchEvent(new CustomEvent("parkme:slot-selected", {
            detail: { slotNumber: hoveredSlot }
        }));
    }
}

renderer.domElement.addEventListener("pointermove", onPointerMove);
renderer.domElement.addEventListener("click", onPointerClick);

// -------------------------------------------------------------
// RESPONSIVE RESIZE
// -------------------------------------------------------------

function handleResize() {
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight || 560;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

window.addEventListener("resize", handleResize);
document.addEventListener("fullscreenchange", handleResize);
document.addEventListener("webkitfullscreenchange", handleResize);

// ResizeObserver ensures responsiveness when sidebar expands/collapses
if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => handleResize());
    ro.observe(container);
}

// -------------------------------------------------------------
// ANIMATION LOOP
// -------------------------------------------------------------

let lastTime = 0;

function animate(time) {
    requestAnimationFrame(animate);

    // Smooth Camera Animation
    if (cameraAnim) {
        const elapsed = time - cameraAnim.startTime;
        const t = Math.min(elapsed / cameraAnim.duration, 1.0);
        // Smooth ease-out-cubic
        const ease = 1 - Math.pow(1 - t, 3);

        camera.position.lerpVectors(cameraAnim.fromPos, cameraAnim.toPos, ease);
        controls.target.lerpVectors(cameraAnim.fromTarget, cameraAnim.toTarget, ease);

        if (t >= 1.0) {
            cameraAnim = null;
        }
    }

    // Auto rotate if active
    if (autoRotateActive && !cameraAnim) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.0;
    } else {
        controls.autoRotate = false;
    }

    // Gentle floating bounce on recommendation pin
    if (recommendationMarker) {
        recommendationMarker.position.y = (recommendationMarker.userData?.baseY || 0) + Math.sin(time * 0.005) * 0.25;
        recommendationMarker.rotation.y += 0.02;
    }

    controls.update();
    renderer.render(scene, camera);
}

animate(0);
initModel();

// -------------------------------------------------------------
// EXPOSE GLOBAL API FOR UI INTERACTION
// -------------------------------------------------------------

window.ParkMe3D = {
    applySlotStatuses,
    selectSlot,
    highlightRecommendation,
    clearRecommendationHighlight,
    setCameraPreset,
    filterFloorVisibility,
    toggleAutoRotate: (active) => { autoRotateActive = active; },
    toggleFullscreen: () => {
        if (!document.fullscreenElement) {
            container.requestFullscreen?.().catch(console.error);
        } else {
            document.exitFullscreen?.().catch(console.error);
        }
    },
    resize: handleResize
};

window.dispatchEvent(new Event("parkme:3d-ready"));