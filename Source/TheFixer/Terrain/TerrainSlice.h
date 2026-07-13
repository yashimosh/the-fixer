#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TerrainSlice.generated.h"

class UProceduralMeshComponent;

/**
 * A single procedurally-generated terrain mesh, sampling
 * FixerTerrain::SampleHeightCm at every grid vertex. Not a chunk-
 * streaming system yet (that's a later milestone) — one slice, one
 * mesh section, rebuilt in OnConstruction so it also regenerates live
 * when tuning parameters in the editor.
 *
 * Flat-shaded on purpose: vertices are NOT welded across triangles, so
 * each triangle gets its own normal. Matches the project's low-poly
 * faceted reference (Bruno Simon / Sable) rather than smoothed terrain.
 */
UCLASS()
class THEFIXER_API ATerrainSlice : public AActor
{
	GENERATED_BODY()

public:
	ATerrainSlice();

	// Extent along the driving axis (X) and across it (Y), in cm.
	UPROPERTY(EditAnywhere, Category = "Terrain")
	float LengthCm = 100000.f;

	UPROPERTY(EditAnywhere, Category = "Terrain")
	float WidthCm = 20000.f;

	UPROPERTY(EditAnywhere, Category = "Terrain")
	float CellSizeCm = 600.f;

protected:
	virtual void OnConstruction(const FTransform& Transform) override;

private:
	UPROPERTY(VisibleAnywhere)
	TObjectPtr<UProceduralMeshComponent> Mesh;

	void BuildMesh();
};
