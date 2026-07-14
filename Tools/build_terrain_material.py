"""Creates a placeholder terrain material: flat-shaded, solid dusty-tan
color, matching the project's low-poly Bruno Simon / Sable reference
(REFERENCES.md) rather than photoreal ground textures. TerrainSlice
currently calls CreateMeshSection with no material at all, which falls
back to the engine default (flat grey, reads as broken/unfinished).
"""
import unreal

PACKAGE_PATH = "/Game/Materials"
ASSET_NAME = "M_TerrainGround"

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
existing = unreal.EditorAssetLibrary.does_asset_exist(f"{PACKAGE_PATH}/{ASSET_NAME}")

if existing:
    material = unreal.EditorAssetLibrary.load_asset(f"{PACKAGE_PATH}/{ASSET_NAME}")
    print(f"Reusing existing {ASSET_NAME}")
else:
    factory = unreal.MaterialFactoryNew()
    material = asset_tools.create_asset(ASSET_NAME, PACKAGE_PATH, unreal.Material, factory)
    print(f"Created {ASSET_NAME}")

# Dusty tan/khaki, low saturation -- Zagros limestone/scrub register
# (REFERENCES.md: "lunar landscapes of valleys with crumbly protrusions
# of rock"), not a green grass field.
base_color_node = unreal.MaterialEditingLibrary.create_material_expression(
    material, unreal.MaterialExpressionConstant3Vector, -400, -100
)
base_color_node.set_editor_property("constant", unreal.LinearColor(0.46, 0.40, 0.30, 1.0))

roughness_node = unreal.MaterialEditingLibrary.create_material_expression(
    material, unreal.MaterialExpressionConstant, -400, 100
)
roughness_node.set_editor_property("r", 0.9)

unreal.MaterialEditingLibrary.connect_material_property(
    base_color_node, "", unreal.MaterialProperty.MP_BASE_COLOR
)
unreal.MaterialEditingLibrary.connect_material_property(
    roughness_node, "", unreal.MaterialProperty.MP_ROUGHNESS
)

unreal.MaterialEditingLibrary.recompile_material(material)
unreal.EditorAssetLibrary.save_loaded_asset(material)
print(f"Saved {PACKAGE_PATH}/{ASSET_NAME}")
