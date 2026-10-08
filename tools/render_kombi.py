"""Renders portfolio views of the real CozyKombi model (a copy of the .blend, never saved).

blender -b CozyKombi.blend --python render_kombi.py -- <mode> <out_dir> [frames] [res_x] [samples]
modes: test, turntable, explode, wire, parts
"""
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
MODE, OUT = argv[0], argv[1]
FRAMES = int(argv[2]) if len(argv) > 2 else 1
RES_X = int(argv[3]) if len(argv) > 3 else 1200
SAMPLES = int(argv[4]) if len(argv) > 4 else 48
os.makedirs(OUT, exist_ok=True)

sc = bpy.context.scene
prefs = bpy.context.preferences.addons["cycles"].preferences
for kind in ("OPTIX", "CUDA"):
    try:
        prefs.compute_device_type = kind
        prefs.get_devices()
        if any(d.type == kind for d in prefs.devices):
            break
    except TypeError:
        continue
for d in prefs.devices:
    d.use = d.type != "CPU"
sc.cycles.device = "GPU"
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True
sc.render.resolution_x = RES_X
sc.render.resolution_y = int(RES_X * 0.75)
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGBA"

root = bpy.data.objects["CozyKombi"]
group = {c.name: c for c in root.children}


def render(path):
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("WROTE", path, flush=True)


def set_camera(name, lens=None):
    cam = bpy.data.objects[name]
    sc.camera = cam
    if lens:
        cam.data.lens = lens
    return cam


if MODE == "test":
    set_camera("01_Exterior")
    render(os.path.join(OUT, "test.png"))

elif MODE == "turntable":
    set_camera("01_Exterior")
    base = root.rotation_euler.z
    for f in range(FRAMES):
        root.rotation_euler.z = base + 2 * math.pi * f / FRAMES
        render(os.path.join(OUT, f"turn-{f:02d}.png"))

elif MODE == "explode":
    # Camera pulled back along its own view line so the parts stay in frame.
    cam = set_camera("01_Exterior")
    # The exterior camera is orthographic: zoom out through its ortho scale.
    cam.data.ortho_scale *= 1.32
    cam.data.shift_y = 0.05
    # Each assembly slides away from the chassis (metres; X right, Y forward, Z up).
    moves = {
        "Roof_Assembly": (0, 0, 1.9),
        "Windows": (0, 0, 1.05),
        "Shell_Left": (-1.5, 0, 0.15),
        "Shell_Right": (1.5, 0, 0.15),
        "Shell_Front": (0, 1.6, 0.1),
        "Shell_Rear": (0, -1.6, 0.1),
        "Cockpit": (0, 0.7, 0.55),
        "Interior_Furniture": (0, -0.1, 0.55),
        "Interior_WoodAndTextiles": (0, 0, 0.28),
        "Interior_AmbientDetails": (0, 0, 1.4),
        "Decor_AcousticGuitar": (0.9, -0.3, 0.9),
        "Decor_HandheldAndBooks": (-0.6, -0.4, 1.2),
        "Decor_OrbitClubPoster": (-1.0, 0, 0.9),
        "Decor_RearConstellationMap": (0, -1.1, 1.0),
        "Decor_CoopCrewPatch": (1.2, 0, 0.6),
        "Wheel_FL_Suspension": (-1.0, 0.25, 0),
        "Wheel_FR_Suspension": (1.0, 0.25, 0),
        "Wheel_RL_Suspension": (-1.0, -0.25, 0),
        "Wheel_RR_Suspension": (1.0, -0.25, 0),
    }
    home = {name: group[name].location.copy() for name in moves if name in group}
    for f in range(FRAMES):
        t = f / max(FRAMES - 1, 1)
        e = t * t * (3 - 2 * t)  # smoothstep
        for name, (dx, dy, dz) in moves.items():
            if name in group:
                group[name].location = home[name] + Vector((dx, dy, dz)) * e
        render(os.path.join(OUT, f"explode-{f:02d}.png"))

elif MODE == "wire":
    # Clay with every triangle edge drawn: shows the real topology.
    mat = bpy.data.materials.new("PortfolioWire")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    wire = nt.nodes.new("ShaderNodeWireframe")
    wire.use_pixel_size = True
    wire.inputs[0].default_value = 1.7
    sc.cycles.use_denoising = False
    sc.cycles.samples = max(SAMPLES, 96)
    clay = nt.nodes.new("ShaderNodeBsdfPrincipled")
    clay.inputs["Base Color"].default_value = (0.86, 0.83, 0.78, 1)
    clay.inputs["Roughness"].default_value = 0.85
    line = nt.nodes.new("ShaderNodeEmission")
    line.inputs["Color"].default_value = (0.015, 0.06, 0.075, 1)
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(wire.outputs[0], mix.inputs[0])
    nt.links.new(clay.outputs[0], mix.inputs[1])
    nt.links.new(line.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    studio = bpy.data.objects["STUDIO_NOT_EXPORTED"]
    studio_meshes = {o for o in studio.children_recursive if o.type == "MESH"}
    for o in bpy.data.objects:
        if o.type == "MESH" and o not in studio_meshes:
            o.data.materials.clear() if False else None
            for slot in o.material_slots:
                slot.link = "OBJECT"
                slot.material = mat
            if not o.material_slots:
                o.data.materials.append(mat)
    for cam in ("01_Exterior", "02_Cutaway"):
        set_camera(cam)
        render(os.path.join(OUT, f"wire-{cam}.png"))

elif MODE == "parts":
    sc.render.film_transparent = True
    studio = bpy.data.objects["STUDIO_NOT_EXPORTED"]
    hide_always = [o for o in studio.children_recursive if o.type == "MESH"]
    parts = {
        "guitar": ["Decor_AcousticGuitar"],
        "wheel": ["Wheel_FR_Suspension"],
        "cockpit": ["Cockpit"],
        "handheld": ["Decor_HandheldAndBooks"],
    }
    if len(argv) > 5:
        parts = {k: v for k, v in parts.items() if k in argv[5].split(",")}
    all_meshes = [o for o in root.children_recursive if o.type in ("MESH", "CURVE")]
    cam_data = bpy.data.cameras.new("PartCam")
    cam_obj = bpy.data.objects.new("PartCam", cam_data)
    sc.collection.objects.link(cam_obj)
    cam_data.lens = 70
    sc.camera = cam_obj
    for o in hide_always:
        o.hide_render = True
    for key, groups in parts.items():
        keep = set()
        for g in groups:
            keep |= {o for o in group[g].children_recursive if o.type in ("MESH", "CURVE")}
        for o in all_meshes:
            o.hide_render = o not in keep
        def obj_center(o):
            return o.matrix_world @ (sum((Vector(c) for c in o.bound_box), Vector()) / 8)
        centers = sorted([(obj_center(o), o) for o in keep], key=lambda t: t[0].z)
        mid = centers[len(centers) // 2][0]
        core = [o for c, o in centers if (c - mid).length < 0.75] or list(keep)
        pts = [o.matrix_world @ Vector(c) for o in core for c in o.bound_box]
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        center = (lo + hi) / 2
        radius = (hi - lo).length / 2
        view = {"guitar": Vector((-1.0, 0.45, 0.18)), "wheel": Vector((1.0, 0.8, 0.35)),
                "cockpit": Vector((0.35, -1.0, 0.55)), "handheld": Vector((0.5, -0.8, 0.9))}[key].normalized()
        fov = 2 * math.atan(cam_data.sensor_width / (2 * cam_data.lens))
        pad = 1.3 if key == "guitar" else 1.08
        cam_obj.location = center + view * (radius / math.sin(fov / 2)) * pad
        cam_obj.rotation_euler = (center - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
        render(os.path.join(OUT, f"part-{key}.png"))
