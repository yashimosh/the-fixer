import bpy

for obj in bpy.data.objects:
    dims = obj.dimensions
    print(f"OBJ: {obj.name:40s} type={obj.type:10s} dims=({dims.x:.2f}, {dims.y:.2f}, {dims.z:.2f}) loc={tuple(round(c,2) for c in obj.location)}")

print("---COLLECTIONS---")
for coll in bpy.data.collections:
    print(f"COLLECTION: {coll.name} objects={[o.name for o in coll.objects]}")
