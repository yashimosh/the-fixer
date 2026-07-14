#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TerrainSlice.generated.h"

class UProceduralMeshComponent;
class UMaterialInterface;

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
	// 3000m gives real margin over the west-mosul-2017 incident's 900m
	// ending distance — the vehicle was observed falling off the edge of
	// the previous 1000m slice under sustained autodrive during terrain
	// verification. True chunk streaming (spawn/despawn slices around the
	// player) is a separate, deferred item for when routes need to scale
	// past what one mesh can reasonably hold.
	UPROPERTY(EditAnywhere, Category = "Terrain")
	float LengthCm = 300000.f;

	UPROPERTY(EditAnywhere, Category = "Terrain")
	float WidthCm = 20000.f;

	UPROPERTY(EditAnywhere, Category = "Terrain")
	float CellSizeCm = 600.f;

protected:
	virtual void OnConstruction(const FTransform& Transform) override;

private:
	UPROPERTY(VisibleAnywhere)
	TObjectPtr<UProceduralMeshComponent> Mesh;

	// Flat dusty-tan placeholder (Materials/M_TerrainGround) -- without an
	// explicit material CreateMeshSection falls back to the engine default
	// grey, which reads as unfinished rather than deliberately low-poly.
	UPROPERTY(EditAnywhere, Category = "Terrain")
	TObjectPtr<UMaterialInterface> GroundMaterial;

	void BuildMesh();
};
