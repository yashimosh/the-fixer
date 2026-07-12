using UnrealBuildTool;

public class TheFixerEditorTarget : TargetRules
{
	public TheFixerEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.V7;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("TheFixer");
	}
}
