using UnrealBuildTool;

public class TheFixerTarget : TargetRules
{
	public TheFixerTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("TheFixer");
	}
}
