"""Canonical 40-bay layout matching the Blender digital twin (parking.glb)."""

SLOTS_DATA = [
    # Floor 1 (P1, y=0.0) - Front Row (z=8.85, near Entrance)
    {"slot_number": "A01", "floor_id": 1, "status": "available", "near_lift": "Lift 1 (West)", "near_stairs": "Stairs 1", "near_entrance": True, "x": -11.7, "y": 0.0, "z": 8.85},
    {"slot_number": "A02", "floor_id": 1, "status": "available", "near_lift": "Lift 1 (West)", "near_stairs": "Stairs 1", "near_entrance": True, "x": -9.1, "y": 0.0, "z": 8.85},
    {"slot_number": "A03", "floor_id": 1, "status": "occupied",  "near_lift": "Lift 1 (West)", "near_stairs": "Stairs 1", "near_entrance": True, "x": -6.5, "y": 0.0, "z": 8.85},
    {"slot_number": "A04", "floor_id": 1, "status": "available", "near_lift": "Central Lift", "near_stairs": "Stairs 1", "near_entrance": True, "x": -3.9, "y": 0.0, "z": 8.85},
    {"slot_number": "A05", "floor_id": 1, "status": "occupied",  "near_lift": "Central Lift", "near_stairs": "Stairs 2", "near_entrance": True, "x": -1.3, "y": 0.0, "z": 8.85},
    {"slot_number": "A06", "floor_id": 1, "status": "available", "near_lift": "Central Lift", "near_stairs": "Stairs 2", "near_entrance": True, "x": 1.3, "y": 0.0, "z": 8.85},
    {"slot_number": "A07", "floor_id": 1, "status": "available", "near_lift": "Central Lift", "near_stairs": "Stairs 2", "near_entrance": True, "x": 3.9, "y": 0.0, "z": 8.85},
    {"slot_number": "A08", "floor_id": 1, "status": "reserved",  "near_lift": "Lift 2 (East)", "near_stairs": "Stairs 2", "near_entrance": True, "x": 6.5, "y": 0.0, "z": 8.85},
    {"slot_number": "A09", "floor_id": 1, "status": "available", "near_lift": "Lift 2 (East)", "near_stairs": "Ramp Stairs", "near_entrance": True, "x": 9.1, "y": 0.0, "z": 8.85},
    {"slot_number": "A10", "floor_id": 1, "status": "occupied",  "near_lift": "Lift 2 (East)", "near_stairs": "Ramp Stairs", "near_entrance": True, "x": 11.7, "y": 0.0, "z": 8.85},

    # Floor 1 (P1, y=0.0) - Back Row (z=-8.85, near Mall Building)
    {"slot_number": "A11", "floor_id": 1, "status": "available", "near_lift": "Mall West Lift", "near_stairs": "Mall Stairs", "near_entrance": False, "x": -11.7, "y": 0.0, "z": -8.85},
    {"slot_number": "A12", "floor_id": 1, "status": "occupied",  "near_lift": "Mall West Lift", "near_stairs": "Mall Stairs", "near_entrance": False, "x": -9.1, "y": 0.0, "z": -8.85},
    {"slot_number": "A13", "floor_id": 1, "status": "available", "near_lift": "Mall West Lift", "near_stairs": "Mall Stairs", "near_entrance": False, "x": -6.5, "y": 0.0, "z": -8.85},
    {"slot_number": "A14", "floor_id": 1, "status": "available", "near_lift": "Mall Center Lift", "near_stairs": "Main Atrium Stairs", "near_entrance": False, "x": -3.9, "y": 0.0, "z": -8.85},
    {"slot_number": "A15", "floor_id": 1, "status": "reserved",  "near_lift": "Mall Center Lift", "near_stairs": "Main Atrium Stairs", "near_entrance": False, "x": -1.3, "y": 0.0, "z": -8.85},
    {"slot_number": "A16", "floor_id": 1, "status": "available", "near_lift": "Mall Center Lift", "near_stairs": "Main Atrium Stairs", "near_entrance": False, "x": 1.3, "y": 0.0, "z": -8.85},
    {"slot_number": "A17", "floor_id": 1, "status": "occupied",  "near_lift": "Mall Center Lift", "near_stairs": "Main Atrium Stairs", "near_entrance": False, "x": 3.9, "y": 0.0, "z": -8.85},
    {"slot_number": "A18", "floor_id": 1, "status": "available", "near_lift": "Mall East Lift", "near_stairs": "Mall Stairs", "near_entrance": False, "x": 6.5, "y": 0.0, "z": -8.85},
    {"slot_number": "A19", "floor_id": 1, "status": "available", "near_lift": "Mall East Lift", "near_stairs": "Mall Stairs", "near_entrance": False, "x": 9.1, "y": 0.0, "z": -8.85},
    {"slot_number": "A20", "floor_id": 1, "status": "occupied",  "near_lift": "Mall East Lift", "near_stairs": "Ramp Stairs", "near_entrance": False, "x": 11.7, "y": 0.0, "z": -8.85},

    # Floor 2 (P2, y=4.5) - Front Row (z=8.85)
    {"slot_number": "B01", "floor_id": 2, "status": "occupied",  "near_lift": "Lift 1 (West)", "near_stairs": "Stairs 1", "near_entrance": False, "x": -11.7, "y": 4.5, "z": 8.85},
    {"slot_number": "B02", "floor_id": 2, "status": "available", "near_lift": "Lift 1 (West)", "near_stairs": "Stairs 1", "near_entrance": False, "x": -9.1, "y": 4.5, "z": 8.85},
    {"slot_number": "B03", "floor_id": 2, "status": "available", "near_lift": "Lift 1 (West)", "near_stairs": "Stairs 1", "near_entrance": False, "x": -6.5, "y": 4.5, "z": 8.85},
    {"slot_number": "B04", "floor_id": 2, "status": "occupied",  "near_lift": "Central Lift", "near_stairs": "Stairs 1", "near_entrance": False, "x": -3.9, "y": 4.5, "z": 8.85},
    {"slot_number": "B05", "floor_id": 2, "status": "available", "near_lift": "Central Lift", "near_stairs": "Stairs 2", "near_entrance": False, "x": -1.3, "y": 4.5, "z": 8.85},
    {"slot_number": "B06", "floor_id": 2, "status": "available", "near_lift": "Central Lift", "near_stairs": "Stairs 2", "near_entrance": False, "x": 1.3, "y": 4.5, "z": 8.85},
    {"slot_number": "B07", "floor_id": 2, "status": "occupied",  "near_lift": "Central Lift", "near_stairs": "Stairs 2", "near_entrance": False, "x": 3.9, "y": 4.5, "z": 8.85},
    {"slot_number": "B08", "floor_id": 2, "status": "available", "near_lift": "Lift 2 (East)", "near_stairs": "Stairs 2", "near_entrance": False, "x": 6.5, "y": 4.5, "z": 8.85},
    {"slot_number": "B09", "floor_id": 2, "status": "reserved",  "near_lift": "Lift 2 (East)", "near_stairs": "Ramp Connection", "near_entrance": False, "x": 9.1, "y": 4.5, "z": 8.85},
    {"slot_number": "B10", "floor_id": 2, "status": "occupied",  "near_lift": "Lift 2 (East)", "near_stairs": "Ramp Connection", "near_entrance": False, "x": 11.7, "y": 4.5, "z": 8.85},

    # Floor 2 (P2, y=4.5) - Back Row (z=-8.85)
    {"slot_number": "B11", "floor_id": 2, "status": "available", "near_lift": "Mall West Lift", "near_stairs": "Mall Stairs", "near_entrance": False, "x": -11.7, "y": 4.5, "z": -8.85},
    {"slot_number": "B12", "floor_id": 2, "status": "available", "near_lift": "Mall West Lift", "near_stairs": "Mall Stairs", "near_entrance": False, "x": -9.1, "y": 4.5, "z": -8.85},
    {"slot_number": "B13", "floor_id": 2, "status": "occupied",  "near_lift": "Mall West Lift", "near_stairs": "Mall Stairs", "near_entrance": False, "x": -6.5, "y": 4.5, "z": -8.85},
    {"slot_number": "B14", "floor_id": 2, "status": "available", "near_lift": "Mall Center Lift", "near_stairs": "Main Atrium Stairs", "near_entrance": False, "x": -3.9, "y": 4.5, "z": -8.85},
    {"slot_number": "B15", "floor_id": 2, "status": "available", "near_lift": "Mall Center Lift", "near_stairs": "Main Atrium Stairs", "near_entrance": False, "x": -1.3, "y": 4.5, "z": -8.85},
    {"slot_number": "B16", "floor_id": 2, "status": "occupied",  "near_lift": "Mall Center Lift", "near_stairs": "Main Atrium Stairs", "near_entrance": False, "x": 1.3, "y": 4.5, "z": -8.85},
    {"slot_number": "B17", "floor_id": 2, "status": "available", "near_lift": "Mall Center Lift", "near_stairs": "Main Atrium Stairs", "near_entrance": False, "x": 3.9, "y": 4.5, "z": -8.85},
    {"slot_number": "B18", "floor_id": 2, "status": "available", "near_lift": "Mall East Lift", "near_stairs": "Mall Stairs", "near_entrance": False, "x": 6.5, "y": 4.5, "z": -8.85},
    {"slot_number": "B19", "floor_id": 2, "status": "reserved",  "near_lift": "Mall East Lift", "near_stairs": "Ramp Connection", "near_entrance": False, "x": 9.1, "y": 4.5, "z": -8.85},
    {"slot_number": "B20", "floor_id": 2, "status": "occupied",  "near_lift": "Mall East Lift", "near_stairs": "Ramp Connection", "near_entrance": False, "x": 11.7, "y": 4.5, "z": -8.85},
]

DESTINATIONS_DATA = [
    {"name": "Cinema & IMAX", "floor_id": 2, "x": 0.0, "y": 4.5, "z": -20.0},
    {"name": "Food Court & Dining", "floor_id": 2, "x": -10.0, "y": 4.5, "z": -18.0},
    {"name": "Supermarket & Groceries", "floor_id": 1, "x": 10.0, "y": 0.0, "z": -18.0},
    {"name": "Main Entrance & Valet", "floor_id": 1, "x": 0.0, "y": 0.0, "z": 16.0},
    {"name": "Mall Atrium & Shops", "floor_id": 1, "x": 0.0, "y": 0.0, "z": -19.0},
    {"name": "Fitness Club & Spa", "floor_id": 2, "x": 10.0, "y": 4.5, "z": -20.0},
]

FLOORS_DATA = [
    {"id": 1, "floor_name": "P1 - Ground Deck", "total_slots": 20},
    {"id": 2, "floor_name": "P2 - Rooftop Deck", "total_slots": 20},
]


def build_memory_slots():
    slots = []
    for index, slot in enumerate(SLOTS_DATA, start=1):
        slots.append({
            "id": index,
            "slot_number": slot["slot_number"],
            "floor_id": slot["floor_id"],
            "status": slot["status"],
            "near_lift": slot["near_lift"],
            "near_stairs": slot["near_stairs"],
            "near_entrance": slot["near_entrance"],
            "x": slot["x"],
            "y": slot["y"],
            "z": slot["z"],
        })
    return slots


def build_memory_destinations():
    destinations = []
    for index, dest in enumerate(DESTINATIONS_DATA, start=1):
        destinations.append({
            "id": index,
            "name": dest["name"],
            "floor_id": dest["floor_id"],
            "x": dest["x"],
            "y": dest["y"],
            "z": dest["z"],
        })
    return destinations
