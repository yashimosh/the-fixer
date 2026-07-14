import bpy

obj = bpy.data.objects["Uaz469"]
print(f"Materials on Uaz469: {[m.name if m else None for m in obj.data.materials]}")
print(f"Vertex count: {len(obj.data.vertices)}")
print(f"Polygon count: {len(obj.data.polygons)}")

# Report loose-part island count without mutating the file.
import bmesh
bm = bmesh.new()
bm.from_mesh(obj.data)
islands = []
visited = set()
for f in bm.faces:
    if f.index in visited:
        continue
    stack = [f]
    island = set()
    while stack:
        cur = stack.pop()
        if cur.index in island:
            continue
        island.add(cur.index)
        for e in cur.edges:
            for lf in e.link_faces:
                if lf.index not in island:
                    stack.append(lf)
    visited |= island
    islands.append(len(island))
print(f"Loose-part islands: {len(islands)}, sizes={sorted(islands, reverse=True)[:20]}")

# Per-material face counts
from collections import Counter
mat_counts = Counter()
for f in bm.faces:
    slot = f.material_index
    name = obj.data.materials[slot].name if slot < len(obj.data.materials) and obj.data.materials[slot] else f"slot{slot}"
    mat_counts[name] += 1
print("Faces per material:")
for name, count in mat_counts.most_common():
    print(f"  {name}: {count}")

bm.free()
