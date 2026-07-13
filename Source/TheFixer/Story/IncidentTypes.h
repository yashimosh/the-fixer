#pragma once

#include "CoreMinimal.h"
#include "IncidentTypes.generated.h"

USTRUCT(BlueprintType)
struct FIncidentBeat
{
	GENERATED_BODY()

	// Distance along the route (metres driven) at which the beat fires.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Incident")
	float TriggerDistanceMeters = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Incident", Meta = (MultiLine = true))
	FString Text;
};

USTRUCT(BlueprintType)
struct FIncidentEnding
{
	GENERATED_BODY()

	// "clean", "failed" — matched against cargo/run state at the drop-off.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Incident")
	FString Key;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Incident", Meta = (MultiLine = true))
	FString Text;
};

USTRUCT(BlueprintType)
struct FIncident
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Incident")
	FString Id;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Incident")
	FString Title;

	// Drives radio playlist, year-conditional world props, HUD stamp.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Incident")
	int32 Year = 2017;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Incident", Meta = (MultiLine = true))
	FString IntroText;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Incident")
	TArray<FIncidentBeat> Beats;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Incident")
	TArray<FIncidentEnding> Endings;

	// Distance at which the run resolves and an ending card is shown.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Incident")
	float EndingDistanceMeters = 900.f;

	// Ending won't show before this many seconds of driving, even if the
	// distance threshold is already crossed (mirrors the web prototype's
	// minimum-run-length gate so a stalled/reversing start can't skip to it).
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Incident")
	float MinimumRunSeconds = 8.f;
};
