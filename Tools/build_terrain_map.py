"""Builds the terrain driving map headlessly.

Run with:
  UnrealEditor.exe TheFixer.uproject -ExecutePythonScript="Tools/build_terrain_map.py"
      -stdout -unattended -nosplash

Idempotent: recreates /Game/Maps/Sandbox_Terrain from scratch each run.
Same dawn lighting rig as build_sandbox_map.py, but ground is a single
ATerrainSlice (procedural, heightfield-as-function — see
Source/TheFixer/Terrain/FixerTerrainMath.h) instead of a flat plane.
Sandbox_Flat is left untouched as the flat-ground physics regression map.
"""
import unreal

MAP_PATH = "/Game/Maps/Sandbox_Terrain"

les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)

# The editor tends to reopen the last-edited level on launch rather than
# EditorStartupMap, so if Sandbox_Terrain is already the active level,
# deleting its own package out from under itself is what crashes/hangs
# the process. Switch to a different, stable map first.
current_world_name = eas.get_editor_world().get_name()
unreal.log(f"current world at script start -> {current_world_name}")
if current_world_name == MAP_PATH.rsplit("/", 1)[-1]:
    unreal.log("Sandbox_Terrain is the active level — switching to Sandbox_Flat first")
    load_ok = les.load_level("/Game/Maps/Sandbox_Flat")
    unreal.log(f"load_level(Sandbox_Flat) -> {load_ok}")

if unreal.EditorAssetLibrary.does_asset_exist(MAP_PATH):
    deleted = unreal.EditorAssetLibrary.delete_asset(MAP_PATH)
    unreal.log(f"delete existing map -> {deleted}")

created = les.new_level(MAP_PATH)
unreal.log(f"new_level -> {created}")
if not created:
    raise RuntimeError("new_level failed")

# Terrain — one slice, constructor defaults already match this map's scale
# (1000m along the driving axis x 200m across, 6m cells).
terrain_class = unreal.load_class(None, "/Script/TheFixer.TerrainSlice")
if not terrain_class:
    raise RuntimeError("Could not load /Script/TheFixer.TerrainSlice — build TheFixerEditor first.")
terrain = eas.spawn_actor_from_class(terrain_class, unreal.Vector(0, 0, 0))
terrain.set_actor_label("TerrainSlice")
terrain.set_actor_location(unreal.Vector(0, 0, 0), False, False)
loc = terrain.get_actor_location()
unreal.log(f"TerrainSlice location after explicit set -> X={loc.x} Y={loc.y} Z={loc.z}")

# Dawn sun — low grazing angle, warm
sun = eas.spawn_actor_from_class(
    unreal.DirectionalLight, unreal.Vector(0, 0, 800),
    unreal.Rotator(roll=0.0, pitch=-8.0, yaw=35.0))
sun.set_actor_label("DawnSun")
sun_comp = sun.get_component_by_class(unreal.DirectionalLightComponent)
sun_comp.set_editor_property("intensity", 6.0)
sun_comp.set_editor_property("light_color", unreal.Color(255, 214, 170))
sun_comp.set_editor_property("atmosphere_sun_light", True)

sky = eas.spawn_actor_from_class(unreal.SkyAtmosphere, unreal.Vector(0, 0, 0))
sky.set_actor_label("SkyAtmosphere")

skylight = eas.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 400))
skylight.set_actor_label("SkyLight")
sl_comp = skylight.get_component_by_class(unreal.SkyLightComponent)
sl_comp.set_editor_property("real_time_capture", True)

fog = eas.spawn_actor_from_class(unreal.ExponentialHeightFog, unreal.Vector(0, 0, 0))
fog.set_actor_label("Fog")
fog_comp = fog.get_component_by_class(unreal.ExponentialHeightFogComponent)
fog_comp.set_editor_property("fog_density", 0.015)
fog_comp.set_editor_property("fog_height_falloff", 0.4)

# Spawn well above the corridor's (small) local height and let the truck
# settle under Chaos physics, same pattern as Sandbox_Flat.
start = eas.spawn_actor_from_class(
    unreal.PlayerStart, unreal.Vector(0, 0, 150),
    unreal.Rotator(roll=0.0, pitch=0.0, yaw=0.0))
start.set_actor_label("PlayerStart")

saved = unreal.EditorLoadingAndSavingUtils.save_dirty_packages(
    save_map_packages=True, save_content_packages=True)
unreal.log(f"save_dirty_packages -> {saved}")
if not saved:
    raise RuntimeError("save_dirty_packages failed")

labels = [a.get_actor_label() for a in eas.get_all_level_actors()]
unreal.log(f"Sandbox_Terrain saved with actors: {labels}")
