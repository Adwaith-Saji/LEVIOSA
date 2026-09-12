# 🚗 ParkMe // 3D Digital Twin Smart Parking Platform

An integrated, full-stack smart parking management system featuring an interactive **3D Digital Twin** built with Blender and Three.js, an AI spatial recommendation engine, and a PostgreSQL-backed Flask REST API.

---

## ✨ Key Features

- **🌐 Interactive 3D Digital Twin**:
  - Realistic multi-level parking facility (`parking.glb`) modeled in Blender.
  - 40 modeled parking bays across **Floor P1 (Ground)** and **Floor P2 (Rooftop Deck)**.
  - Real-time automotive rendering: parked cars appear when bays are occupied and disappear when freed.
  - Holographic glowing bay indicators: **Green** (Available), **Red** (Occupied), **Amber** (Reserved), and **Purple** (Recommended).
  - Raycasted mouse hover and click interactions with camera focal transitions.

- **🧠 Spatial AI Recommendation Engine**:
  - Automatically calculates optimal parking spots based on 3D Euclidean distances, floor levels, walking times, and accessibility preferences (near lifts, stairs, or entrances).
  - Animates a glowing 3D waypoint navigation line from the facility entrance/ramp directly into the recommended bay.
  - Provides alternative recommendations with comparison metrics.

- **📊 Comprehensive Live Dashboard**:
  - Real-time metrics: Total spaces, Available, Occupied, Reserved, and live Occupancy Rate gauge.
  - Live 40-slot matrix with floor and status filtering, search bar, and one-click status toggles.
  - Slot Inspector panel with 3D spatial coordinate readout.
  - Traffic simulator button to test dynamic facility turnover.

- **📱 Fully Responsive Design**:
  - Fluid glassmorphic UI styled for desktop, tablet, and mobile screens.
  - Touch-enabled OrbitControls (pan, pinch-to-zoom, rotate).
  - Floor view isolation toggles and fullscreen 3D mode.

---

## 📁 Project Architecture

```
LEVIOSA2/
├── ai/
│   └── recommender.py           # 3D spatial ranking & walk-time calculation
├── backend/
│   ├── app.py                   # Flask REST API & static web server
│   ├── requirements.txt         # Python dependencies
│   └── venv/                    # Virtual environment
├── blender/
│   ├── parkme_parking.blend     # Blender 3D model source file
│   └── parkme_parking.blend1    # Blender backup file
├── database/
│   ├── schema.sql               # PostgreSQL DDL table definitions
│   └── seed.py                  # Database migration & 40-slot seeder
├── docs/
│   └── architecture.md          # Technical documentation & API reference
├── frontend/
│   ├── index.html               # Semantic HTML5 dashboard layout
│   ├── style.css                # Master CSS with dark glassmorphism
│   ├── script.js                # Frontend state management & API client
│   ├── three.js                 # Three.js 3D digital twin rendering engine
│   └── models/
│       └── parking.glb          # 3D binary glTF model (6.1 MB)
└── README.md
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Python 3.10+
- PostgreSQL database named `parkme` (running on `localhost:5432` with user `postgres`)

### 2. Setup & Database Seeding
Open PowerShell in the project root:

```powershell
# Activate the virtual environment
.\backend\venv\Scripts\Activate.ps1

# Seed the database with 40 3D-accurate parking slots and destinations
python database\seed.py
```

### 3. Launch the Integrated Server
Run the Flask application from the `backend/` directory:

```powershell
python backend\app.py

The site still loads if PostgreSQL is offline: occupancy data falls back to an in-memory digital twin.
```

### 4. Access the Website
Open your browser and navigate to:
```
http://127.0.0.1:5000
```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/parking-slots` | Returns all 40 slots with live status and 3D coordinates |
| `GET` | `/api/floors` | Returns floor definitions with breakdown counts |
| `GET` | `/api/destinations` | Returns mall destinations and locations |
| `GET` | `/api/stats` | Global facility stats (total, available, occupied, rate) |
| `POST` | `/api/parking-slots/<id>/status` | Update slot status (`available`, `occupied`, `reserved`) |
| `GET` | `/api/recommendation` | AI optimal slot recommendation for a selected destination |
| `POST` | `/api/parking-slots/simulate` | Randomizes vehicle turnover for live demonstration |

---

## 🎨 3D Camera Controls
- **Left Click + Drag**: Orbit / Rotate 3D view
- **Right Click + Drag**: Pan camera
- **Scroll Wheel**: Zoom in / Zoom out
- **Click on Slot**: Inspects bay and focuses camera
- **Toolbar Pills**: Instant presets (Overview, Birds-Eye, Entrance, P1 Deck, P2 Deck)
- **Fullscreen Button**: Expands 3D twin to full display