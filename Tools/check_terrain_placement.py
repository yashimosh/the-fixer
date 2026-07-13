import unreal

eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
unreal.log(f"current world -> {unreal.SystemLibrary.get_display_name(eas.get_editor_world())}")
for a in eas.get_all_level_actors():
    if a.get_actor_label() == "TerrainSlice":
        loc = a.get_actor_location()
        unreal.log(f"TerrainSlice actual location -> X={loc.x} Y={loc.y} Z={loc.z}")
