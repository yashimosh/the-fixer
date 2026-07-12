#include "IncidentSubsystem.h"

#include "HAL/FileManager.h"
#include "JsonObjectConverter.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"

DEFINE_LOG_CATEGORY_STATIC(LogIncident, Log, All);

void UIncidentSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	ReloadIncidents();
}

void UIncidentSubsystem::ReloadIncidents()
{
	Incidents.Empty();

	const FString Dir = FPaths::Combine(FPaths::ProjectDir(), TEXT("Data/Incidents"));
	TArray<FString> Files;
	IFileManager::Get().FindFiles(Files, *(Dir / TEXT("*.json")), true, false);

	for (const FString& File : Files)
	{
		FString Raw;
		if (!FFileHelper::LoadFileToString(Raw, *(Dir / File)))
		{
			UE_LOG(LogIncident, Warning, TEXT("Could not read %s"), *File);
			continue;
		}

		FIncident Incident;
		if (!FJsonObjectConverter::JsonObjectStringToUStruct(Raw, &Incident))
		{
			UE_LOG(LogIncident, Warning, TEXT("Could not parse %s"), *File);
			continue;
		}

		if (Incident.Id.IsEmpty())
		{
			UE_LOG(LogIncident, Warning, TEXT("%s has no id — skipped"), *File);
			continue;
		}

		Incidents.Add(Incident.Id, MoveTemp(Incident));
	}

	UE_LOG(LogIncident, Log, TEXT("Loaded %d incident(s) from %s"), Incidents.Num(), *Dir);
}

bool UIncidentSubsystem::GetIncident(const FString& Id, FIncident& OutIncident) const
{
	if (const FIncident* Found = Incidents.Find(Id))
	{
		OutIncident = *Found;
		return true;
	}
	return false;
}

TArray<FString> UIncidentSubsystem::GetIncidentIds() const
{
	TArray<FString> Ids;
	Incidents.GetKeys(Ids);
	Ids.Sort();
	return Ids;
}
