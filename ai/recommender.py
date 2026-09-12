"""
ParkMe AI Parking Recommender
Calculates optimal parking space recommendations based on 3D spatial distances,
floor level differences, accessibility criteria, and facility proximity.
"""

import math

def calculate_3d_distance(slot, destination):
    """
    Computes Euclidean distance in 3D coordinate space between slot and destination.
    """
    dx = slot["x"] - destination["x"]
    dy = (slot["y"] - destination["y"]) * 2.0  # Vertical transition weight
    dz = slot["z"] - destination["z"]
    return math.sqrt(dx * dx + dy * dy + dz * dz)

def rank_parking_slots(available_slots, destination, preferences=None):
    """
    Ranks available parking slots using a multi-factor scoring function.
    Returns: (best_slot, alternatives_list)
    """
    if preferences is None:
        preferences = {}

    prefer_lift = preferences.get("near_lift", False)
    prefer_stairs = preferences.get("near_stairs", False)
    prefer_entrance = preferences.get("near_entrance", False)
    prefer_same_floor = preferences.get("same_floor", True)

    scored_slots = []

    dest_floor = destination.get("floor_id", 1)

    for slot in available_slots:
        dist_3d = calculate_3d_distance(slot, destination)
        floor_diff = abs(slot["floor_id"] - dest_floor)

        # Base score from spatial distance
        score = dist_3d

        # Penalize cross-floor travel
        if floor_diff > 0:
            score += floor_diff * 12.0
            if prefer_same_floor:
                score += 8.0

        # Bonuses for accessibility & convenience
        if slot.get("near_lift"):
            score -= 5.0 if not prefer_lift else 10.0

        if slot.get("near_stairs"):
            score -= 2.0 if not prefer_stairs else 6.0

        if slot.get("near_entrance"):
            score -= 3.0 if not prefer_entrance else 8.0

        # Estimate walking time (distance * scale factor, ~1.2m/s + floor transition)
        estimated_walk_seconds = int((dist_3d * 1.8) + (floor_diff * 25))
        walk_time_str = f"{estimated_walk_seconds} sec" if estimated_walk_seconds < 60 else f"{estimated_walk_seconds // 60}m {estimated_walk_seconds % 60}s"

        scored_slots.append({
            "id": slot["id"],
            "slot_number": slot["slot_number"],
            "floor_id": slot["floor_id"],
            "floor_name": f"Floor P{slot['floor_id']}",
            "status": slot.get("status", "available"),
            "near_lift": slot.get("near_lift"),
            "near_stairs": slot.get("near_stairs"),
            "near_entrance": slot.get("near_entrance"),
            "x": slot["x"],
            "y": slot["y"],
            "z": slot["z"],
            "distance_meters": round(dist_3d, 1),
            "walk_time": walk_time_str,
            "walk_seconds": estimated_walk_seconds,
            "score": round(score, 2),
            "match_reasons": [
                f"Near {slot['near_lift']}" if slot.get("near_lift") else None,
                "Ground Level" if slot["floor_id"] == 1 else "Rooftop Deck",
                "Quick Entrance Access" if slot.get("near_entrance") else None
            ]
        })

    # Sort slots: lower score is best
    scored_slots.sort(key=lambda s: s["score"])

    # Clean match reasons
    for s in scored_slots:
        s["match_reasons"] = [r for r in s["match_reasons"] if r]

    best = scored_slots[0] if scored_slots else None
    alternatives = scored_slots[1:5] if len(scored_slots) > 1 else []

    return best, alternatives
