"""Imports the Land Cruiser rig (built by build_land_cruiser_rig.py from
the free UAZ-469 model) into /Game/Vehicles/LandCruiser/.
"""
import unreal

STAGING = "C:/Users/yasha/claude-code-projects/personal/the-fixer-ue/ImportStaging/"
DEST = "/Game/Vehicles/LandCruiser"

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()


def import_skeletal(filename, dest_path, asset_name):
    task = unreal.AssetImportTask()
    task.filename = STAGING + filename
    task.destination_path = dest_path
    task.destination_name = asset_name
    task.automated = True
    task.save = True
    task.replace_existing = True

    options = unreal.FbxImportUI()
    options.import_mesh = True
    options.import_as_skeletal = True
    options.import_animations = False
    options.mesh_type_to_import = unreal.FBXImportType.FBXIT_SKELETAL_MESH
    # Without this, a brand-new skeleton imports with no collision body at
    # all -- confirmed by a real drive test: the vehicle floated at a
    # fixed Z forever, wheel0grounded always 0, because Chaos vehicle
    # physics has nothing to simulate against with an empty PhysicsAsset.
    options.create_physics_asset = True
    task.options = options

    asset_tools.import_asset_tasks([task])
    return task.imported_object_paths


def import_static(filename, dest_path, asset_name):
    task = unreal.AssetImportTask()
    task.filename = STAGING + filename
    task.destination_path = dest_path
    task.destination_name = asset_name
    task.automated = True
    task.save = True
    task.replace_existing = True

    options = unreal.FbxImportUI()
    options.import_mesh = True
    options.import_as_skeletal = False
    options.mesh_type_to_import = unreal.FBXImportType.FBXIT_STATIC_MESH
    options.static_mesh_import_data.combine_meshes = True
    task.options = options

    asset_tools.import_asset_tasks([task])
    return task.imported_object_paths


print("Importing skeletal body...")
body_paths = import_skeletal("LandCruiser_Body.fbx", DEST, "SKM_LandCruiser")
print(f"Body imported: {body_paths}")

for wheel in ["FL", "FR", "RL", "RR", "Spare"]:
    paths = import_static(f"LandCruiser_Wheel_{wheel}.fbx", DEST + "/Wheels", f"SM_LandCruiser_Wheel_{wheel}")
    print(f"Wheel {wheel} imported: {paths}")

print("DONE")
