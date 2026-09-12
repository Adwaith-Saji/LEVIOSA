"""
ParkMe parking garage generator for Blender.

Run inside Blender:
    blender --background --python blender/build_parking_garage.py

Exports frontend/models/parking.glb with named car groups CAR_A01..CAR_B20
matching the live digital twin coordinates.
"""

import math
import os
import sys

try:
    import bpy
    import mathutils
except ImportError:
    sys.exit("Run this script with Blender's Python.")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORT_PATH = os.path.join(ROOT, "frontend", "models", "parking.glb")

X_POSITIONS = [-11.7, -9.1, -6.5, -3.9, -1.3, 1.3, 3.9, 6.5, 9.1, 11.7]
Z_FRONT = 8.85
Z_BACK = -8.85


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)


def add_box(name, size, location, color=(0.2, 0.22, 0.26, 1.0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    mat = bpy.data.materials.new(name=f"{name}_mat")
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    if principled:
        principled.inputs["Base Color"].default_value = color
        principled.inputs["Roughness"].default_value = 0.7
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def add_car(name, location, yaw=0.0):
    body = add_box(name, (1.7, 1.1, 4.2), (location[0], location[1] + 0.55, location[2]), (0.08, 0.12, 0.2, 1))
    body.rotation_euler[2] = yaw
    cabin = add_box(f"{name}_cabin", (1.4, 0.7, 2.0), (location[0], location[1] + 1.15, location[2] - 0.3), (0.55, 0.7, 0.82, 1))
    cabin.rotation_euler[2] = yaw
    cabin.parent = body
    cabin.location = (0, 0.6, -0.3)
    return body


def slot_configs():
    configs = []
    for i, x in enumerate(X_POSITIONS):
        configs.append((f"A{i + 1:02d}", (x, 0.0, Z_FRONT), 0.0))
    for i, x in enumerate(X_POSITIONS):
        configs.append((f"A{i + 11:02d}", (x, 0.0, Z_BACK), math.pi))
    for i, x in enumerate(X_POSITIONS):
        configs.append((f"B{i + 1:02d}", (x, 4.5, Z_FRONT), 0.0))
    for i, x in enumerate(X_POSITIONS):
        configs.append((f"B{i + 11:02d}", (x, 4.5, Z_BACK), math.pi))
    return configs


def build():
    clear_scene()
    add_box("Deck_P1", (32, 0.3, 26), (0, -0.15, 0), (0.18, 0.2, 0.23, 1))
    add_box("Floor 2 Deck", (32, 0.3, 26), (0, 4.35, 0), (0.2, 0.22, 0.25, 1))
    add_box("Ramp", (4.2, 0.25, 16), (16.5, 2.2, 6), (0.28, 0.3, 0.32, 1)).rotation_euler[0] = math.radians(-16)

    for x in (-14, -4.5, 4.5, 14):
        for z in (-10, 10):
            add_box(f"Pillar_{x}_{z}", (0.55, 4.6, 0.55), (x, 2.2, z), (0.78, 0.8, 0.83, 1))

    for number, loc, yaw in slot_configs():
        add_car(f"CAR_{number}", loc, yaw)

    os.makedirs(os.path.dirname(EXPORT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=EXPORT_PATH, export_format="GLB")
    print(f"Exported {EXPORT_PATH}")


if __name__ == "__main__":
    build()
