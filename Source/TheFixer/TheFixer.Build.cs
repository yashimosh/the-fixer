using UnrealBuildTool;

public class TheFixer : ModuleRules
{
	public TheFixer(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"EnhancedInput",
			"ChaosVehicles",
			"ChaosVehiclesCore",
			"PhysicsCore",
			"Json",
			"JsonUtilities"
		});
	}
}
