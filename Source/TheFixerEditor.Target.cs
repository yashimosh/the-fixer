using UnrealBuildTool;

public class TheFixerEditorTarget : TargetRules
{
	public TheFixerEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("TheFixer");
	}
}
