import unreal

imc = unreal.load_asset("/Game/VehicleTemplate/Input/IMC_Vehicle_Default")
reset_action = unreal.load_asset("/Game/VehicleTemplate/Input/Actions/IA_Reset")

mapping_data = imc.get_editor_property("DefaultKeyMappings")
for mapping in mapping_data.get_editor_property("mappings"):
    action = mapping.get_editor_property("action")
    key = mapping.get_editor_property("key")
    key_name = key.get_editor_property("key_name")
    if action and action.get_name() == "IA_Reset":
        unreal.log(f"IA_Reset mapping -> key_name={key_name}")
