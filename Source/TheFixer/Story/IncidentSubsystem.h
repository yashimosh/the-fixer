#pragma once

#include "CoreMinimal.h"
#include "IncidentTypes.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "IncidentSubsystem.generated.h"

/**
 * Loads incident definitions from Data/Incidents/*.json at startup.
 * Story text lives in plain JSON — editable without the engine or Claude.
 */
UCLASS()
class THEFIXER_API UIncidentSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	UFUNCTION(BlueprintCallable, Category = "Incident")
	bool GetIncident(const FString& Id, FIncident& OutIncident) const;

	UFUNCTION(BlueprintCallable, Category = "Incident")
	TArray<FString> GetIncidentIds() const;

	UFUNCTION(BlueprintCallable, Category = "Incident")
	void ReloadIncidents();

private:
	TMap<FString, FIncident> Incidents;
};
