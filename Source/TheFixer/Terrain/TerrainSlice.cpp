#include "TerrainSlice.h"

#include "FixerTerrainMath.h"
#include "ProceduralMeshComponent.h"

ATerrainSlice::ATerrainSlice()
{
	PrimaryActorTick.bCanEverTick = false;

	Mesh = CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("Mesh"));
	RootComponent = Mesh;
	Mesh->bUseComplexAsSimpleCollision = true;
	Mesh->SetCollisionProfileName(TEXT("BlockAll"));
	Mesh->SetMobility(EComponentMobility::Static);
}

void ATerrainSlice::OnConstruction(const FTransform& Transform)
{
	Super::OnConstruction(Transform);
	BuildMesh();
}

void ATerrainSlice::BuildMesh()
{
	const int32 CellsX = FMath::Max(1, FMath::RoundToInt(LengthCm / CellSizeCm));
	const int32 CellsY = FMath::Max(1, FMath::RoundToInt(WidthCm / CellSizeCm));
	const float OriginX = -LengthCm * 0.5f;
	const float OriginY = -WidthCm * 0.5f;
	const float UVScale = 1.f / 400.f;

	TArray<FVector> Vertices;
	TArray<int32> Triangles;
	TArray<FVector> Normals;
	TArray<FVector2D> UVs;
	TArray<FLinearColor> EmptyColors;
	TArray<FProcMeshTangent> EmptyTangents;

	const int32 QuadCount = CellsX * CellsY;
	Vertices.Reserve(QuadCount * 6);
	Triangles.Reserve(QuadCount * 6);
	Normals.Reserve(QuadCount * 6);
	UVs.Reserve(QuadCount * 6);

	// Triangle vertex order mirrors UKismetProceduralMeshLibrary::
	// CreateGridMeshWelded's proven winding exactly (idx, idx+NumX, idx+1 /
	// idx+1, idx+NumX, idx+NumX+1 in its row-major indexing) so culling
	// matches Epic's own ground-plane generator. Vertices are split (not
	// welded) here for flat shading, so each triangle also gets its own
	// explicit normal — forced to point upward regardless of winding, to
	// decouple lighting correctness from the culling convention above.
	auto AddTri = [&Vertices, &Triangles, &Normals, &UVs, UVScale](const FVector& A, const FVector& B, const FVector& C)
	{
		const int32 Base = Vertices.Num();
		Vertices.Add(A);
		Vertices.Add(B);
		Vertices.Add(C);

		FVector Normal = FVector::CrossProduct(B - A, C - A).GetSafeNormal();
		if (Normal.Z < 0.f)
		{
			Normal *= -1.f;
		}
		Normals.Add(Normal);
		Normals.Add(Normal);
		Normals.Add(Normal);

		UVs.Add(FVector2D(A.X * UVScale, A.Y * UVScale));
		UVs.Add(FVector2D(B.X * UVScale, B.Y * UVScale));
		UVs.Add(FVector2D(C.X * UVScale, C.Y * UVScale));

		Triangles.Add(Base);
		Triangles.Add(Base + 1);
		Triangles.Add(Base + 2);
	};

	for (int32 Row = 0; Row < CellsY; ++Row)
	{
		const float Y0 = OriginY + Row * CellSizeCm;
		const float Y1 = Y0 + CellSizeCm;

		for (int32 Col = 0; Col < CellsX; ++Col)
		{
			const float X0 = OriginX + Col * CellSizeCm;
			const float X1 = X0 + CellSizeCm;

			const FVector P00(X0, Y0, FixerTerrain::SampleHeightCm(X0, Y0));
			const FVector P01(X0, Y1, FixerTerrain::SampleHeightCm(X0, Y1));
			const FVector P10(X1, Y0, FixerTerrain::SampleHeightCm(X1, Y0));
			const FVector P11(X1, Y1, FixerTerrain::SampleHeightCm(X1, Y1));

			AddTri(P00, P01, P10);
			AddTri(P10, P01, P11);
		}
	}

	Mesh->CreateMeshSection_LinearColor(0, Vertices, Triangles, Normals, UVs, EmptyColors, EmptyTangents, /*bCreateCollision=*/true);
}
