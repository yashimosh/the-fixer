#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "Story/IncidentTypes.h"
#include "TheFixerGameMode.generated.h"

class ASorVehiclePawn;
class UStoryCardWidget;

/**
 * Owns the run: loads the current incident, shows the intro/beat/ending
 * story cards, and tracks distance driven along the run's starting
 * heading to know when to fire them. One incident per level for now —
 * incident selection (anthology menu) is a later layer.
 */
UCLASS()
class THEFIXER_API ATheFixerGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	ATheFixerGameMode();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	UPROPERTY(EditDefaultsOnly, Category = "Incident")
	FString IncidentId = TEXT("west-mosul-2017");

protected:
	UPROPERTY(EditDefaultsOnly, Category = "Incident")
	TSubclassOf<UStoryCardWidget> StoryCardWidgetClass;

private:
	void BeginRun();
	void ShowIntro();
	void ShowBeat(const FIncidentBeat& Beat);
	void ShowEnding();
	void HandleCargoDamaged();
	float GetDistanceDrivenMeters() const;

	FIncident CurrentIncident;
	bool bIncidentLoaded = false;

	UPROPERTY()
	TObjectPtr<UStoryCardWidget> CardWidget;

	UPROPERTY()
	TObjectPtr<ASorVehiclePawn> TrackedVehicle;

	FVector RunStartLocation = FVector::ZeroVector;
	FVector RunStartForward = FVector::ForwardVector;
	float RunStartElapsedSeconds = 0.f;
	float ElapsedSeconds = 0.f;

	// Floor on how long the intro stays up regardless of throttle input —
	// see the comment in Tick() by the dismiss check.
	static constexpr float IntroMinimumSeconds = 2.5f;
	float IntroShownAtSeconds = 0.f;

	// Cargo integrity (0-100, see ASorVehiclePawn::GetCargoIntegrity) at or
	// above this at the ending resolves "clean"; below resolves "failed".
	static constexpr float CargoIntegrityCleanThreshold = 50.f;

	bool bIntroShowing = false;
	int32 NextBeatIndex = 0;
	bool bEndingShown = false;

	// Cargo damage can land many times per second during a sustained
	// rollover (ASorVehiclePawn ticks rollover damage every frame); without
	// a cooldown here the shake would restart continuously and the card
	// would fight itself. This debounces the FEEDBACK signal only -- the
	// underlying damage still applies at full resolution.
	static constexpr float CargoFeedbackCooldownSeconds = 1.f;
	float SecondsSinceLastCargoFeedback = 1000.f;

	FTimerHandle BeginRunTimerHandle;
};
