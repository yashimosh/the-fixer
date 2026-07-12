"""Builds the flat driving sandbox map headlessly.

Run with:
  UnrealEditor-Cmd.exe TheFixer.uproject -run=pythonscript
      -script="Tools/build_sandbox_map.py" -stdout -unattended -nosplash

Idempotent: recreates /Game/Maps/Sandbox_Flat from scratch each run.
The map is deliberately minimal — flat ground, dawn light, fog, player
start. Terrain and the real route come later; this is the physics
playground.
"""
import unreal

MAP_PATH = "/Game/Maps/Sandbox_Flat"

les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)

if unreal.EditorAssetLibrary.does_asset_exist(MAP_PATH):
    deleted = unreal.EditorAssetLibrary.delete_asset(MAP_PATH)
    unreal.log(f"delete existing map -> {deleted}")

created = les.new_level(MAP_PATH)
unreal.log(f"new_level -> {created}")
if not created:
    raise RuntimeError("new_level failed")

# Ground — 4km x 4km plane (basic-shape Plane is 100x100cm at scale 1)
plane = unreal.EditorAssetLibrary.load_asset("/Engine/BasicShapes/Plane")
ground = eas.spawn_actor_from_object(plane, unreal.Vector(0, 0, 0))
ground.set_actor_label("Ground")
ground.set_actor_scale3d(unreal.Vector(4000, 4000, 1))

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
unreal.log(f"Sandbox_Flat saved with actors: {labels}")
