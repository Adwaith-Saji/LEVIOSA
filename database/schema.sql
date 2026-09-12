-- =========================================================
-- ParkMe Smart Parking System Database Schema
-- =========================================================

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

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parking_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    slot_id INTEGER REFERENCES parking_slots(id) ON DELETE CASCADE,
    booking_code VARCHAR(50) UNIQUE,
    vehicle_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    duration_hours NUMERIC(4, 2) DEFAULT 1.0,
    parking_fee NUMERIC(8, 2) DEFAULT 50.0,
    fine_rate NUMERIC(8, 2) DEFAULT 100.0,
    entry_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expiry_time TIMESTAMP,
    exit_time TIMESTAMP
);

-- Index for speedy queries
CREATE INDEX IF NOT EXISTS idx_slots_floor ON parking_slots(floor_id);
CREATE INDEX IF NOT EXISTS idx_slots_status ON parking_slots(status);
