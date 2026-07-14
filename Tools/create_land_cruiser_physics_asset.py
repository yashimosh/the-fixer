"""FbxImportUI.create_physics_asset=True did not actually create/assign
one (confirmed: skm.physics_asset was None after import, and the vehicle
floated motionless in a live drive test -- Chaos vehicle physics had no
collision body to simulate against). Building one explicitly via
SkeletalMeshEditorSubsystem instead.
"""
import unreal

skm = unreal.EditorAssetLibrary.load_asset("/Game/Vehicles/LandCruiser/SKM_LandCruiser")
sub = unreal.get_editor_subsystem(unreal.SkeletalMeshEditorSubsystem)

pa = sub.create_physics_asset(skm)
print(f"Created physics asset: {pa}")

if pa:
    unreal.EditorAssetLibrary.save_loaded_asset(pa)

unreal.EditorAssetLibrary.save_loaded_asset(skm)
print("Saved.")
