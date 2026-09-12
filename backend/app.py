import os
import sys
import copy
import random
from datetime import datetime, timedelta
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from ai.recommender import rank_parking_slots
from database.parking_data import (
    FLOORS_DATA,
    build_memory_destinations,
    build_memory_slots,
)

FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app)

import time

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "database": os.getenv("DB_NAME", "parkme"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "dingdongpostgre"),
    "port": os.getenv("DB_PORT", "5432"),
    "connect_timeout": int(os.getenv("DB_CONNECT_TIMEOUT", "1")),
}

MEMORY_SLOTS = build_memory_slots()
MEMORY_DESTINATIONS = build_memory_destinations()
MEMORY_BOOKINGS = []

_DB_AVAILABLE = None
_DB_LAST_CHECK = 0.0


def get_db_connection():
    global _DB_AVAILABLE, _DB_LAST_CHECK
    now = time.time()
    # Cache offline DB state for 15 seconds so demo mode responds instantaneously
    if _DB_AVAILABLE is False and (now - _DB_LAST_CHECK) < 15.0:
        return None

    _DB_LAST_CHECK = now
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        _DB_AVAILABLE = True
        return conn
    except Exception as exc:
        if _DB_AVAILABLE is not False:
            print(f"[DB] Using in-memory twin data ({exc})")
        _DB_AVAILABLE = False
        return None


def floor_breakdown(slots):
    floors = []
    for floor in FLOORS_DATA:
        floor_slots = [s for s in slots if s["floor_id"] == floor["id"]]
        floors.append({
            "id": floor["id"],
            "floor_name": floor["floor_name"],
            "total_slots": floor["total_slots"],
            "available_slots": sum(1 for s in floor_slots if s["status"] == "available"),
            "occupied_slots": sum(1 for s in floor_slots if s["status"] == "occupied"),
            "reserved_slots": sum(1 for s in floor_slots if s["status"] == "reserved"),
        })
    return floors


def compute_stats(slots):
    total = len(slots)
    occupied = sum(1 for s in slots if s["status"] == "occupied")
    available = sum(1 for s in slots if s["status"] == "available")
    reserved = sum(1 for s in slots if s["status"] == "reserved")
    occupancy_rate = round((occupied / total * 100) if total else 0, 1)
    return {
        "total_slots": total,
        "available_slots": available,
        "occupied_slots": occupied,
        "reserved_slots": reserved,
        "occupancy_rate": occupancy_rate,
    }


@app.route("/")
@app.route("/bookings")
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:path>")
def serve_static(path):
    if path.startswith("api/"):
        return jsonify({"error": "API endpoint not found"}), 404
    file_path = os.path.join(FRONTEND_DIR, path)
    if os.path.exists(file_path):
        mimetype = None
        if path.endswith(".js") or path.endswith(".mjs"):
            mimetype = "text/javascript"
        elif path.endswith(".css"):
            mimetype = "text/css"
        elif path.endswith(".glb"):
            mimetype = "model/gltf-binary"
        elif path.endswith(".gltf"):
            mimetype = "model/gltf+json"
        return send_from_directory(FRONTEND_DIR, path, mimetype=mimetype)
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/api/health", methods=["GET"])
def health_check():
    conn = get_db_connection()
    db_connected = conn is not None
    if conn:
        conn.close()
    return jsonify({
        "status": "healthy",
        "service": "ParkMe 3D Digital Twin API",
        "database_connected": db_connected,
        "mode": "postgres" if db_connected else "demo",
    })


@app.route("/api/parking-slots", methods=["GET"])
def get_parking_slots():
    conn = get_db_connection()
    if not conn:
        return jsonify(copy.deepcopy(MEMORY_SLOTS))

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT
                id, slot_number, floor_id, status, near_lift, near_stairs, near_entrance,
                x_position AS x, y_position AS y, z_position AS z
            FROM parking_slots
            ORDER BY floor_id, slot_number;
        """)
        slots = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(slots)
    except Exception as exc:
        conn.close()
        print(f"[API] slots fallback: {exc}")
        return jsonify(copy.deepcopy(MEMORY_SLOTS))


@app.route("/api/floors", methods=["GET"])
def get_floors():
    conn = get_db_connection()
    if not conn:
        return jsonify(floor_breakdown(MEMORY_SLOTS))

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT
                f.id, f.floor_name, f.total_slots,
                COUNT(s.id) FILTER (WHERE s.status = 'available') AS available_slots,
                COUNT(s.id) FILTER (WHERE s.status = 'occupied') AS occupied_slots,
                COUNT(s.id) FILTER (WHERE s.status = 'reserved') AS reserved_slots
            FROM parking_floors f
            LEFT JOIN parking_slots s ON f.id = s.floor_id
            GROUP BY f.id, f.floor_name, f.total_slots
            ORDER BY f.id;
        """)
        floors = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(floors)
    except Exception:
        conn.close()
        return jsonify(floor_breakdown(MEMORY_SLOTS))


@app.route("/api/destinations", methods=["GET"])
def get_destinations():
    conn = get_db_connection()
    if not conn:
        return jsonify(copy.deepcopy(MEMORY_DESTINATIONS))

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT id, name, floor_id, x_position AS x, y_position AS y, z_position AS z
            FROM destinations
            ORDER BY floor_id, name;
        """)
        destinations = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(destinations)
    except Exception:
        conn.close()
        return jsonify(copy.deepcopy(MEMORY_DESTINATIONS))


@app.route("/api/stats", methods=["GET"])
def get_stats():
    conn = get_db_connection()
    if not conn:
        return jsonify(compute_stats(MEMORY_SLOTS))

    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'available') as available,
                COUNT(*) FILTER (WHERE status = 'occupied') as occupied,
                COUNT(*) FILTER (WHERE status = 'reserved') as reserved
            FROM parking_slots;
        """)
        total, available, occupied, reserved = cursor.fetchone()
        cursor.close()
        conn.close()
        occupancy_rate = round((occupied / total * 100) if total else 0, 1)
        return jsonify({
            "total_slots": total,
            "available_slots": available,
            "occupied_slots": occupied,
            "reserved_slots": reserved,
            "occupancy_rate": occupancy_rate,
        })
    except Exception:
        conn.close()
        return jsonify(compute_stats(MEMORY_SLOTS))


@app.route("/api/parking-slots/<int:slot_id>/status", methods=["POST"])
def update_slot_status(slot_id):
    data = request.get_json()
    if not data or "status" not in data:
        return jsonify({"error": "Status is required"}), 400

    new_status = data["status"].strip().lower()
    allowed_statuses = ["available", "occupied", "reserved"]
    if new_status not in allowed_statuses:
        return jsonify({"error": f"Invalid status '{new_status}'."}), 400

    conn = get_db_connection()
    if not conn:
        for slot in MEMORY_SLOTS:
            if slot["id"] == slot_id:
                slot["status"] = new_status
                return jsonify({
                    "message": f"Slot {slot['slot_number']} updated to {new_status}",
                    "slot": slot,
                    "mode": "demo",
                })
        return jsonify({"error": "Parking slot not found"}), 404

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            UPDATE parking_slots
            SET status = %s
            WHERE id = %s
            RETURNING id, slot_number, floor_id, status, x_position AS x, y_position AS y, z_position AS z;
        """, (new_status, slot_id))
        updated_slot = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()
        if not updated_slot:
            return jsonify({"error": "Parking slot not found"}), 404
        return jsonify({
            "message": f"Slot {updated_slot['slot_number']} updated to {new_status}",
            "slot": updated_slot,
        })
    except Exception as exc:
        conn.close()
        return jsonify({"error": str(exc)}), 500


@app.route("/api/recommendation", methods=["GET"])
def get_recommendation():
    destination_query = request.args.get("destination")
    if not destination_query:
        return jsonify({"error": "Destination parameter is required"}), 400

    prefer_lift = request.args.get("prefer_lift", "false").lower() == "true"
    prefer_entrance = request.args.get("prefer_entrance", "false").lower() == "true"
    prefer_stairs = request.args.get("prefer_stairs", "false").lower() == "true"

    conn = get_db_connection()
    destination = None
    available_slots = []

    if conn:
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            if destination_query.isdigit():
                cursor.execute("""
                    SELECT id, name, floor_id, x_position AS x, y_position AS y, z_position AS z
                    FROM destinations WHERE id = %s;
                """, (int(destination_query),))
            else:
                cursor.execute("""
                    SELECT id, name, floor_id, x_position AS x, y_position AS y, z_position AS z
                    FROM destinations WHERE LOWER(name) LIKE LOWER(%s);
                """, (f"%{destination_query.strip()}%",))
            destination = cursor.fetchone()
            cursor.execute("""
                SELECT id, slot_number, floor_id, status, near_lift, near_stairs, near_entrance,
                       x_position AS x, y_position AS y, z_position AS z
                FROM parking_slots WHERE status = 'available';
            """)
            available_slots = cursor.fetchall()
            cursor.close()
            conn.close()
        except Exception as exc:
            conn.close()
            print(f"[API] recommendation fallback: {exc}")
            destination = None

    if destination is None:
        if destination_query.isdigit():
            destination = next((d for d in MEMORY_DESTINATIONS if d["id"] == int(destination_query)), None)
        else:
            needle = destination_query.strip().lower()
            destination = next((d for d in MEMORY_DESTINATIONS if needle in d["name"].lower()), None)
        available_slots = [s for s in MEMORY_SLOTS if s["status"] == "available"]

    if not destination:
        return jsonify({"error": f"Destination '{destination_query}' not found"}), 404
    if not available_slots:
        return jsonify({"error": "No available parking slots found in the facility"}), 404

    best_slot, alternatives = rank_parking_slots(
        available_slots,
        destination,
        preferences={
            "near_lift": prefer_lift,
            "near_entrance": prefer_entrance,
            "near_stairs": prefer_stairs,
        },
    )
    return jsonify({
        "destination": destination,
        "recommended_slot": best_slot,
        "alternatives": alternatives,
    })


@app.route("/api/parking-slots/simulate", methods=["POST"])
def simulate_traffic():
    statuses = ["available", "available", "available", "occupied", "occupied", "reserved"]
    conn = get_db_connection()
    if not conn:
        for slot in MEMORY_SLOTS:
            slot["status"] = random.choice(statuses)
        return jsonify({"message": "Simulated live traffic across the digital twin.", "mode": "demo"})

    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM parking_slots;")
        slot_ids = [row[0] for row in cursor.fetchall()]
        for slot_id in slot_ids:
            cursor.execute(
                "UPDATE parking_slots SET status = %s WHERE id = %s;",
                (random.choice(statuses), slot_id),
            )
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "Simulated live traffic randomized across slots!"})
    except Exception as exc:
        conn.close()
        return jsonify({"error": str(exc)}), 500


@app.route("/api/bookings", methods=["POST"])
def create_booking():
    data = request.get_json() or {}
    slot_id = data.get("slot_id")
    if not slot_id:
        return jsonify({"error": "slot_id is required"}), 400

    try:
        duration_hours = max(0.5, float(data.get("duration_hours", 1.0)))
    except (ValueError, TypeError):
        duration_hours = 1.0

    parking_fee = float(data.get("parking_fee", duration_hours * 50.0))
    vehicle_number = (data.get("vehicle_number") or "KA-01-MJ-2024").strip().upper()
    fine_rate = float(data.get("fine_rate", 100.0))

    now = datetime.now()
    expiry = now + timedelta(hours=duration_hours)
    code_suffix = "".join(random.choices("0123456789ABCDEF", k=4))

    conn = get_db_connection()
    if not conn:
        # In-memory demo fallback
        target_slot = next((s for s in MEMORY_SLOTS if s["id"] == slot_id), None)
        if not target_slot:
            return jsonify({"error": "Slot not found"}), 404
        if target_slot["status"] != "available":
            return jsonify({"error": f"Slot {target_slot['slot_number']} is currently {target_slot['status']}. Only available spaces can be booked."}), 400

        target_slot["status"] = "occupied"
        booking_code = f"PKM-{target_slot['slot_number']}-{code_suffix}"
        booking_id = len(MEMORY_BOOKINGS) + 1
        booking = {
            "id": booking_id,
            "booking_code": booking_code,
            "slot_id": slot_id,
            "slot_number": target_slot["slot_number"],
            "floor_id": target_slot["floor_id"],
            "vehicle_number": vehicle_number,
            "status": "active",
            "duration_hours": duration_hours,
            "parking_fee": parking_fee,
            "fine_rate": fine_rate,
            "entry_time": now.isoformat(),
            "expiry_time": expiry.isoformat(),
            "exit_time": None,
            "qr_data": f"PARKME:{booking_code}:{target_slot['slot_number']}:{expiry.isoformat()}",
        }
        MEMORY_BOOKINGS.insert(0, booking)
        return jsonify({
            "message": f"Bay {target_slot['slot_number']} booked successfully!",
            "booking": booking,
        }), 201

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT id, slot_number, floor_id, status FROM parking_slots WHERE id = %s;", (slot_id,))
        slot = cursor.fetchone()
        if not slot:
            cursor.close()
            conn.close()
            return jsonify({"error": "Slot not found"}), 404
        if slot["status"] != "available":
            cursor.close()
            conn.close()
            return jsonify({"error": f"Slot {slot['slot_number']} is currently {slot['status']}. Only available spaces can be booked."}), 400

        booking_code = f"PKM-{slot['slot_number']}-{code_suffix}"
        cursor.execute("""
            INSERT INTO parking_sessions (
                slot_id, booking_code, vehicle_number, status, duration_hours,
                parking_fee, fine_rate, entry_time, expiry_time
            ) VALUES (%s, %s, %s, 'active', %s, %s, %s, %s, %s)
            RETURNING id, slot_id, booking_code, vehicle_number, status, duration_hours, parking_fee, fine_rate, entry_time, expiry_time;
        """, (slot_id, booking_code, vehicle_number, duration_hours, parking_fee, fine_rate, now, expiry))
        created_session = cursor.fetchone()

        cursor.execute("UPDATE parking_slots SET status = 'occupied' WHERE id = %s;", (slot_id,))
        conn.commit()
        cursor.close()
        conn.close()

        created_session["slot_number"] = slot["slot_number"]
        created_session["floor_id"] = slot["floor_id"]
        created_session["duration_hours"] = float(created_session["duration_hours"])
        created_session["parking_fee"] = float(created_session["parking_fee"])
        created_session["fine_rate"] = float(created_session["fine_rate"])
        created_session["entry_time"] = created_session["entry_time"].isoformat() if created_session["entry_time"] else None
        created_session["expiry_time"] = created_session["expiry_time"].isoformat() if created_session["expiry_time"] else None
        created_session["qr_data"] = f"PARKME:{booking_code}:{slot['slot_number']}:{created_session['expiry_time']}"

        return jsonify({
            "message": f"Bay {slot['slot_number']} booked successfully!",
            "booking": created_session,
        }), 201
    except Exception as exc:
        conn.close()
        return jsonify({"error": str(exc)}), 500


def enrich_booking_overstay(booking, now=None):
    if now is None:
        now = datetime.now()
    if booking.get("expiry_time") and booking.get("status") == "active":
        try:
            exp = datetime.fromisoformat(booking["expiry_time"])
            if now > exp:
                overstay_sec = (now - exp).total_seconds()
                overstay_hrs = round(overstay_sec / 3600.0, 2)
                fine = round(max(1.0, overstay_hrs) * float(booking.get("fine_rate", 100.0)), 2)
                booking["is_expired"] = True
                booking["overstay_hours"] = overstay_hrs
                booking["overstay_fine"] = fine
                booking["remaining_seconds"] = 0
            else:
                booking["is_expired"] = False
                booking["overstay_hours"] = 0.0
                booking["overstay_fine"] = 0.0
                booking["remaining_seconds"] = max(0, int((exp - now).total_seconds()))
        except Exception:
            booking["is_expired"] = False
            booking["overstay_hours"] = 0.0
            booking["overstay_fine"] = 0.0
            booking["remaining_seconds"] = 0
    else:
        booking["is_expired"] = False
        booking["overstay_hours"] = 0.0
        booking["overstay_fine"] = 0.0
        booking["remaining_seconds"] = 0
    return booking


@app.route("/api/bookings", methods=["GET"])
def get_bookings():
    now = datetime.now()
    conn = get_db_connection()
    if not conn:
        results = copy.deepcopy(MEMORY_BOOKINGS)
        for b in results:
            enrich_booking_overstay(b, now)
        return jsonify(results)

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT 
                s.id, s.slot_id, s.booking_code, s.vehicle_number, s.status,
                s.duration_hours, s.parking_fee, s.fine_rate, s.entry_time,
                s.expiry_time, s.exit_time,
                p.slot_number, p.floor_id
            FROM parking_sessions s
            LEFT JOIN parking_slots p ON s.slot_id = p.id
            ORDER BY s.id DESC;
        """)
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        bookings = []
        for r in rows:
            booking = dict(r)
            booking["duration_hours"] = float(booking["duration_hours"]) if booking.get("duration_hours") is not None else 1.0
            booking["parking_fee"] = float(booking["parking_fee"]) if booking.get("parking_fee") is not None else 50.0
            booking["fine_rate"] = float(booking["fine_rate"]) if booking.get("fine_rate") is not None else 100.0
            booking["entry_time"] = booking["entry_time"].isoformat() if booking.get("entry_time") else None
            booking["expiry_time"] = booking["expiry_time"].isoformat() if booking.get("expiry_time") else None
            booking["exit_time"] = booking["exit_time"].isoformat() if booking.get("exit_time") else None
            booking_code = booking.get("booking_code") or f"PKM-{booking['id']}"
            slot_num = booking.get("slot_number") or f"Bay-{booking.get('slot_id')}"
            booking["qr_data"] = f"PARKME:{booking_code}:{slot_num}:{booking.get('expiry_time')}"
            enrich_booking_overstay(booking, now)
            bookings.append(booking)

        return jsonify(bookings)
    except Exception as exc:
        conn.close()
        print(f"[API] bookings fallback: {exc}")
        results = copy.deepcopy(MEMORY_BOOKINGS)
        for b in results:
            enrich_booking_overstay(b, now)
        return jsonify(results)


@app.route("/api/bookings/<int:booking_id>/checkout", methods=["POST"])
def checkout_booking(booking_id):
    now = datetime.now()
    conn = get_db_connection()
    if not conn:
        booking = next((b for b in MEMORY_BOOKINGS if b["id"] == booking_id), None)
        if not booking:
            return jsonify({"error": "Booking not found"}), 404
        booking["status"] = "completed"
        booking["exit_time"] = now.isoformat()
        slot = next((s for s in MEMORY_SLOTS if s["id"] == booking["slot_id"]), None)
        if slot:
            slot["status"] = "available"
        return jsonify({"message": f"Parking session ended for {booking['slot_number']}. Bay released.", "booking": booking})

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM parking_sessions WHERE id = %s;", (booking_id,))
        session = cursor.fetchone()
        if not session:
            cursor.close()
            conn.close()
            return jsonify({"error": "Booking not found"}), 404

        cursor.execute("""
            UPDATE parking_sessions
            SET status = 'completed', exit_time = %s
            WHERE id = %s
            RETURNING id, slot_id, booking_code, status, exit_time;
        """, (now, booking_id))
        updated_session = cursor.fetchone()

        if session.get("slot_id"):
            cursor.execute("UPDATE parking_slots SET status = 'available' WHERE id = %s;", (session["slot_id"],))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({
            "message": "Parking session completed. Bay marked available.",
            "booking_id": booking_id,
            "exit_time": updated_session["exit_time"].isoformat() if updated_session.get("exit_time") else None
        })
    except Exception as exc:
        conn.close()
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"[ParkMe] http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
