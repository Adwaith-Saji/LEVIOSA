# ParkMe Architecture & Integration Guide

## 1. System Overview
ParkMe is an end-to-end intelligent parking platform that bridges 3D digital twins, relational databases, AI-driven routing heuristics, and modern web interfaces.

### Core Subsystems:
1. **Digital Twin Subsystem (`blender/`, `frontend/three.js`, `frontend/models/parking.glb`)**:
   - High-fidelity 3D modeling of parking decks, support pillars, signage, driving lanes, ramps, and vehicle bodies.
   - WebGL runtime using Three.js with soft PCF shadow maps, ACES filmic tone mapping, and hemisphere ambient lighting.
   - Dynamic node manipulation: indexing `CAR_A01`-`CAR_A20` and `CAR_B01`-`CAR_B20` groups to toggle car meshes upon occupancy.
   - Raycasting interaction pipeline: pointer move detects hitboxes, renders floating screen-space tooltips, and click events fire focal camera tweening.
   - Path rendering: Catmull-Rom 3D splines projected over driving lanes and ramps to show real-time navigation routes.

2. **Backend & Static Web Server (`backend/app.py`)**:
   - Unified single-process delivery: serves frontend assets (`index.html`, `style.css`, `script.js`, `three.js`, `models/parking.glb`) and REST API (`/api/*`).
   - CORS enabled for cross-origin local development flexibility.
   - RealDictCursor for clean JSON response mapping.

3. **Database Layer (`database/schema.sql`, `database/seed.py`)**:
   - PostgreSQL persistence with relational foreign keys.
   - Real spatial coordinates `(x, y, z)` assigned to every parking bay, exactly calibrated with the Blender model.

4. **AI Recommender (`ai/recommender.py`)**:
   - Multi-variable weighted cost function:
     $$\text{Score} = \text{Dist}_{3D} + (\Delta \text{Floor} \times W_{\text{floor}}) - B_{\text{lift}} - B_{\text{stairs}} - B_{\text{entrance}}$$
   - Real-time walk time estimator based on pedestrian transit speeds.
