#pragma once

#include "CoreMinimal.h"

/**
 * Heightfield-as-pure-function: no baked heightmap, no Landscape asset.
 * Every terrain-aware system (mesh generation, later chunk streaming,
 * spawn placement) samples the same deterministic function.
 *
 * X is the driving axis (the run's distance-tracking axis in
 * ATheFixerGameMode); Y is across the road. A smooth corridor runs along
 * Y=0 so the route is actually driveable; mountain flanks with full
 * amplitude sit outside it for silhouette. This mirrors a lesson learned
 * the hard way on this project's web prototype (LESSONS.md, 2026-06-12):
 * full-amplitude noise under the wheels reads as a washboard and
 * launches the vehicle airborne — the road has to be graded.
 */
namespace FixerTerrain
{
	constexpr float CorridorHalfWidthCm = 900.f;
	constexpr float BlendWidthCm = 600.f;

	// Gentle, driveable undulation along the route.
	inline float SampleCorridorHeightCm(float X)
	{
		return FMath::Sin(X / 5500.f) * 45.f
			+ FMath::Sin(X / 1300.f + 1.7f) * 15.f;
	}

	// Mountain-flank silhouette, layered on top of the corridor grade so
	// there's no slope discontinuity at the blend seam — only amplitude
	// grows as the corridor falls away.
	inline float SampleFlankHeightCm(float X, float Y)
	{
		const float Ridge = FMath::Sin(Y / 4200.f + X / 9000.f) * 900.f;
		const float Detail = FMath::Sin(X / 900.f + Y / 700.f) * 180.f
			+ FMath::Sin(X / 340.f - Y / 260.f) * 60.f;
		return Ridge + Detail;
	}

	inline float SampleHeightCm(float X, float Y)
	{
		const float AbsY = FMath::Abs(Y);
		const float Corridor = SampleCorridorHeightCm(X);
		if (AbsY <= CorridorHalfWidthCm)
		{
			return Corridor;
		}
		const float Flank = Corridor + SampleFlankHeightCm(X, Y);
		const float BlendT = FMath::Clamp((AbsY - CorridorHalfWidthCm) / BlendWidthCm, 0.f, 1.f);
		return FMath::Lerp(Corridor, Flank, FMath::SmoothStep(0.f, 1.f, BlendT));
	}
}
