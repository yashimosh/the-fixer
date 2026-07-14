"""Builds Sor's Land Cruiser-stand-in vehicle rig from the free UAZ-469
model (Low Poly Soviet Cars pack, Fab, Standard License) for The Fixer.

Separates the UAZ469 mesh into body + 4 wheels + spare, builds a
minimal armature with bones matching ASorVehiclePawn's expected wheel
bone names (PhysWheel_FL/FR/BL/BR) at the model's real wheel-hub
positions, skins the body to the root bone, and exports:
  - LandCruiser_Body.fbx  (skeletal: armature + skinned body)
  - LandCruiser_Wheel_FL.fbx / _FR / _RL / _RR / _Spare.fbx (static)

Run: blender.exe -b low_poly_soviet_cars.blend --python build_land_cruiser_rig.py
"""
import bpy
import bmesh
import mathutils

OUT_DIR = "C:/Users/yasha/claude-code-projects/personal/the-fixer-ue/ImportStaging/"
# Do NOT rescale wheels to match the old tuned WheelRadius=50cm -- the real
# UAZ-469 wheel's natural radius (~34cm) already matches its own hub-bone
# height almost exactly, which is not a coincidence (a wheel's center sits
# at roughly its own radius above the ground). Inflating the wheel mesh
# without also raising the bone made the wheel geometrically penetrate the
# ground at rest, forcing the suspension to bottom out from the start --
# confirmed via live telemetry (suspension pinned near zero, spring force
# in the hundreds of thousands, vehicle stalled at idle RPM regardless of
# throttle). SorWheelFront/Rear's WheelRadius/WheelWidth are updated to
# match the real proportions instead of the other way around.

# --- Isolate Uaz469, remove everything else ---
for obj in list(bpy.data.objects):
    if obj.name != "Uaz469":
        bpy.data.objects.remove(obj, do_unlink=True)

uaz = bpy.data.objects["Uaz469"]
bpy.context.view_layer.objects.active = uaz
uaz.select_set(True)

# --- Separate by loose parts (body vs 4 wheels vs spare) ---
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='LOOSE')
bpy.ops.object.mode_set(mode='OBJECT')

parts = [o for o in bpy.data.objects if o.type == 'MESH']

def world_bbox(o):
    coords = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    xs = [c.x for c in coords]; ys = [c.y for c in coords]; zs = [c.z for c in coords]
    return (min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs))

info = []
for o in parts:
    (x0, x1), (y0, y1), (z0, z1) = world_bbox(o)
    dims = (x1 - x0, y1 - y0, z1 - z0)
    centroid = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    info.append({"obj": o, "dims": dims, "centroid": centroid, "zmin": z0})
    print(f"PART {o.name}: dims={tuple(round(d,3) for d in dims)} centroid={tuple(round(c,3) for c in centroid)}")

# Body = largest bounding-box volume by far.
info.sort(key=lambda i: i["dims"][0] * i["dims"][1] * i["dims"][2], reverse=True)
body = info[0]
wheel_candidates = info[1:]
print(f"BODY: {body['obj'].name}")

# Spare = the wheel-shaped part sitting highest (mounted on the body, not on the ground).
wheel_candidates.sort(key=lambda i: i["zmin"], reverse=True)
spare = wheel_candidates[0]
ground_wheels = wheel_candidates[1:]
print(f"SPARE: {spare['obj'].name} zmin={spare['zmin']:.3f}")

# Front/rear by X centroid, left/right by Y centroid sign.
xs = sorted(set(round(w["centroid"][0], 2) for w in ground_wheels))
front_x, rear_x = max(xs), min(xs)

def closest(target_x, side_positive):
    candidates = [w for w in ground_wheels if (w["centroid"][1] > 0) == side_positive]
    return min(candidates, key=lambda w: abs(w["centroid"][0] - target_x))

fl = closest(front_x, True)
fr = closest(front_x, False)
rl = closest(rear_x, True)
rr = closest(rear_x, False)
print(f"FL={fl['obj'].name} FR={fr['obj'].name} RL={rl['obj'].name} RR={rr['obj'].name}")

# --- Rename clearly ---
body["obj"].name = "LandCruiser_Body"
fl["obj"].name = "Wheel_FL"
fr["obj"].name = "Wheel_FR"
rl["obj"].name = "Wheel_RL"
rr["obj"].name = "Wheel_RR"
spare["obj"].name = "Wheel_Spare"

# --- Re-center each wheel's origin to its own geometry bounds (still
# needed so the exported mesh's local origin matches the bone position
# for zero-offset attachment in C++), but no longer rescaled -- keep the
# real UAZ-469 proportions so the wheel radius stays consistent with the
# bone height it was measured from.
for w in (fl, fr, rl, rr, spare):
    o = w["obj"]
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    diameter_cm = max(w["dims"][0], w["dims"][1]) * 100.0
    print(f"{o.name}: natural diameter {diameter_cm:.1f}cm (radius {diameter_cm/2:.1f}cm)")

# Recompute wheel hub centroids after scaling (scale was about original centroid, so centroid unchanged).
hub = {}
for w, key in ((fl, "FL"), (fr, "FR"), (rl, "RL"), (rr, "RR")):
    hub[key] = w["centroid"]

# --- Build armature with bones at each wheel hub, root at body origin ---
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
arm_obj = bpy.context.object
arm_obj.name = "SKM_LandCruiser_Skeleton"
armature = arm_obj.data
armature.name = "LandCruiserSkeleton"

edit_bones = armature.edit_bones
root = edit_bones[0]
root.name = "Root"
root.head = (0, 0, 0)
root.tail = (0, 0, 30)

def add_wheel_bone(name, pos):
    b = edit_bones.new(name)
    b.head = pos
    b.tail = (pos[0], pos[1], pos[2] + 20)
    b.parent = root
    return b

add_wheel_bone("PhysWheel_FL", hub["FL"])
add_wheel_bone("PhysWheel_FR", hub["FR"])
add_wheel_bone("PhysWheel_BL", hub["RL"])
add_wheel_bone("PhysWheel_BR", hub["RR"])

bpy.ops.object.mode_set(mode='OBJECT')

# --- Skin the body to Root (rigid bind, single bone, weight 1.0) ---
# Direct data-API binding rather than bpy.ops.object.parent_set(), which
# depends on UI/viewport context that isn't reliably present in -b
# (background) mode. FBX skin export reads the Armature MODIFIER +
# matching vertex-group weights -- it does NOT need (and, confirmed by
# a failed first export attempt: "'ARMATURE' parenting type is not
# supported") the object-level parent_type='ARMATURE' deform link.
# Plain object parenting is only for scene organization here.
body_obj = body["obj"]
body_obj.parent = arm_obj
arm_modifier = body_obj.modifiers.new(name="Armature", type='ARMATURE')
arm_modifier.object = arm_obj
vg = body_obj.vertex_groups.new(name="Root")
vg.add(list(range(len(body_obj.data.vertices))), 1.0, 'REPLACE')

# --- Export: skeletal body+armature, and each wheel as static mesh ---
bpy.ops.object.select_all(action='DESELECT')
arm_obj.select_set(True)
body_obj.select_set(True)
bpy.context.view_layer.objects.active = arm_obj
bpy.ops.export_scene.fbx(
    filepath=OUT_DIR + "LandCruiser_Body.fbx",
    use_selection=True,
    add_leaf_bones=False,
    bake_anim=False,
)
print("Exported LandCruiser_Body.fbx")

for w, name in ((fl, "FL"), (fr, "FR"), (rl, "RL"), (rr, "RR"), (spare, "Spare")):
    bpy.ops.object.select_all(action='DESELECT')
    w["obj"].select_set(True)
    bpy.context.view_layer.objects.active = w["obj"]
    bpy.ops.export_scene.fbx(
        filepath=OUT_DIR + f"LandCruiser_Wheel_{name}.fbx",
        use_selection=True,
        add_leaf_bones=False,
        bake_anim=False,
    )
    print(f"Exported LandCruiser_Wheel_{name}.fbx")

print("DONE")

# --- Diagnostic: verify bone world positions right before export ---
import bpy as _bpy
_arm_data = arm_obj.data
for _bname in ("Root", "PhysWheel_FL", "PhysWheel_FR", "PhysWheel_BL", "PhysWheel_BR"):
    _b = _arm_data.bones.get(_bname)
    if _b:
        _world_head = arm_obj.matrix_world @ _b.head_local
        print(f"BONEWORLD {_bname}: head_local={tuple(round(c,3) for c in _b.head_local)} world={tuple(round(c,3) for c in _world_head)}")
