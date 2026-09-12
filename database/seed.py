"""
ParkMe Database Seeder
Populates PostgreSQL with all 40 parking slots matching the 3D Blender model (parking.glb).
"""

import os
import sys

import psycopg2

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from parking_data import DESTINATIONS_DATA, SLOTS_DATA

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "database": os.getenv("DB_NAME", "parkme"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "dingdongpostgre"),
    "port": os.getenv("DB_PORT", "5432"),
}


def seed_database():
    print("Connecting to PostgreSQL...")
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    print("Ensuring tables exist...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS parking_floors (
            id SERIAL PRIMARY KEY,
            floor_name VARCHAR(50) NOT NULL,
            total_slots INTEGER NOT NULL DEFAULT 20
        );

        CREATE TABLE IF NOT EXISTS parking_slots (
            id SERIAL PRIMARY KEY,
            slot_number VARCHAR(20) NOT NULL UNIQUE,
            floor_id INTEGER NOT NULL REFERENCES parking_floors(id) ON DELETE CASCADE,
            status VARCHAR(20) NOT NULL DEFAULT 'available',
            near_lift VARCHAR(50),
            near_stairs VARCHAR(50),
            near_entrance BOOLEAN DEFAULT FALSE,
            x_position DOUBLE PRECISION DEFAULT 0.0,
            y_position DOUBLE PRECISION DEFAULT 0.0,
            z_position DOUBLE PRECISION DEFAULT 0.0
        );

        CREATE TABLE IF NOT EXISTS destinations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            floor_id INTEGER NOT NULL,
            x_position DOUBLE PRECISION DEFAULT 0.0,
            y_position DOUBLE PRECISION DEFAULT 0.0,
            z_position DOUBLE PRECISION DEFAULT 0.0
        );
    """)

    print("Clearing old data...")
    cur.execute("""
        DO $$ BEGIN
            IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'parking_sessions') THEN
                DELETE FROM parking_sessions;
            END IF;
        END $$;
    """)
    cur.execute("DELETE FROM parking_slots;")
    cur.execute("DELETE FROM destinations;")
    cur.execute("DELETE FROM parking_floors;")

    print("Seeding floors...")
    cur.execute("""
        INSERT INTO parking_floors (id, floor_name, total_slots) VALUES
        (1, 'P1 - Ground Deck', 20),
        (2, 'P2 - Rooftop Deck', 20);
    """)

    print("Seeding destinations...")
    for dest in DESTINATIONS_DATA:
        cur.execute("""
            INSERT INTO destinations (name, floor_id, x_position, y_position, z_position)
            VALUES (%s, %s, %s, %s, %s);
        """, (dest["name"], dest["floor_id"], dest["x"], dest["y"], dest["z"]))

    print("Seeding 40 parking slots...")
    for slot in SLOTS_DATA:
        cur.execute("""
            INSERT INTO parking_slots (
                slot_number, floor_id, status, near_lift, near_stairs, near_entrance,
                x_position, y_position, z_position
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
        """, (
            slot["slot_number"], slot["floor_id"], slot["status"],
            slot["near_lift"], slot["near_stairs"], slot["near_entrance"],
            slot["x"], slot["y"], slot["z"],
        ))

    conn.commit()
    cur.close()
    conn.close()
    print("Database successfully seeded with 40 3D-accurate parking slots and destinations!")


if __name__ == "__main__":
    seed_database()
