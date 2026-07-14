#include "TheFixerGameMode.h"

#include "Blueprint/UserWidget.h"
#include "Camera/PlayerCameraManager.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "Story/IncidentSubsystem.h"
#include "UI/StoryCardWidget.h"
#include "Vehicle/CargoDamageCameraShake.h"
#include "Vehicle/SorVehiclePawn.h"

DEFINE_LOG_CATEGORY_STATIC(LogFixerRun, Log, All);

ATheFixerGameMode::ATheFixerGameMode()
{
	DefaultPawnClass = ASorVehiclePawn::StaticClass();
	StoryCardWidgetClass = UStoryCardWidget::StaticClass();

	PrimaryActorTick.bCanEverTick = true;
}

void ATheFixerGameMode::BeginPlay()
{
	Super::BeginPlay();

	// Command-line override so both incidents can be picked without a full
	// anthology-selection system yet: -Incident=sinjar-2014
	FString IncidentOverride;
	if (FParse::Value(FCommandLine::Get(), TEXT("Incident="), IncidentOverride))
	{
		IncidentId = IncidentOverride;
	}

	// The player pawn is possessed during world start-up, just before level
	// actors' BeginPlay runs — but give it one tick of slack rather than
	// assume ordering.
	GetWorldTimerManager().SetTimer(BeginRunTimerHandle, this, &ATheFixerGameMode::BeginRun, 0.1f, false);
}

void ATheFixerGameMode::BeginRun()
{
	if (UIncidentSubsystem* Incidents = GetGameInstance()->GetSubsystem<UIncidentSubsystem>())
	{
		bIncidentLoaded = Incidents->GetIncident(IncidentId, CurrentIncident);
	}
	if (!bIncidentLoaded)
	{
		UE_LOG(LogFixerRun, Warning, TEXT("Incident '%s' not found — no story cards will show."), *IncidentId);
		return;
	}

	TrackedVehicle = Cast<ASorVehiclePawn>(UGameplayStatics::GetPlayerPawn(this, 0));
	if (!TrackedVehicle)
	{
		UE_LOG(LogFixerRun, Warning, TEXT("No player-controlled SorVehiclePawn found — retrying."));
		GetWorldTimerManager().SetTimer(BeginRunTimerHandle, this, &ATheFixerGameMode::BeginRun, 0.2f, false);
		return;
	}

	RunStartLocation = TrackedVehicle->GetActorLocation();
	RunStartForward = TrackedVehicle->GetActorForwardVector();
	TrackedVehicle->OnCargoDamaged.AddUObject(this, &ATheFixerGameMode::HandleCargoDamaged);

	CardWidget = CreateWidget<UStoryCardWidget>(GetWorld(), StoryCardWidgetClass);
	if (!CardWidget)
	{
		UE_LOG(LogFixerRun, Warning, TEXT("Failed to create story card widget — no story cards will show."));
		return;
	}
	CardWidget->AddToViewport(100);

	ShowIntro();
}

void ATheFixerGameMode::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (!bIncidentLoaded || !TrackedVehicle || !CardWidget)
	{
		return;
	}

	ElapsedSeconds += DeltaSeconds;
	SecondsSinceLastCargoFeedback += DeltaSeconds;

	if (bIntroShowing)
	{
		// Dismiss on the player's own action rather than a button (no UI
		// chrome), but never before IntroMinimumSeconds — a reflexive tap
		// of the throttle on spawn shouldn't skip the card before it's read.
		if (TrackedVehicle->HasStartedDriving() && (ElapsedSeconds - IntroShownAtSeconds) >= IntroMinimumSeconds)
		{
			CardWidget->HideCard();
			bIntroShowing = false;
			RunStartElapsedSeconds = ElapsedSeconds;
			UE_LOG(LogFixerRun, Log, TEXT("[Run] intro dismissed at %.1fs"), ElapsedSeconds);
		}
		return;
	}

	if (bEndingShown || CardWidget->IsShowingCard())
	{
		return;
	}

	const float DistanceMeters = GetDistanceDrivenMeters();

	if (NextBeatIndex < CurrentIncident.Beats.Num()
		&& DistanceMeters >= CurrentIncident.Beats[NextBeatIndex].TriggerDistanceMeters)
	{
		UE_LOG(LogFixerRun, Log, TEXT("[Run] beat %d shown at %.1fm (%.1fs)"), NextBeatIndex, DistanceMeters, ElapsedSeconds);
		ShowBeat(CurrentIncident.Beats[NextBeatIndex]);
		++NextBeatIndex;
	}
	else if (DistanceMeters >= CurrentIncident.EndingDistanceMeters
		&& (ElapsedSeconds - RunStartElapsedSeconds) >= CurrentIncident.MinimumRunSeconds)
	{
		UE_LOG(LogFixerRun, Log, TEXT("[Run] ending triggered at %.1fm (%.1fs)"), DistanceMeters, ElapsedSeconds);
		ShowEnding();
	}
}

void ATheFixerGameMode::ShowIntro()
{
	bIntroShowing = true;
	IntroShownAtSeconds = ElapsedSeconds;
	CardWidget->ShowCard(CurrentIncident.IntroText, 0.f);
}

void ATheFixerGameMode::ShowBeat(const FIncidentBeat& Beat)
{
	CardWidget->ShowCard(Beat.Text, 6.f);
}

void ATheFixerGameMode::ShowEnding()
{
	// Cargo determines outcome, per the incident design: below the
	// threshold, whatever the run was carrying (footage, testimony,
	// equipment) didn't survive the drive intact.
	const float CargoIntegrity = TrackedVehicle->GetCargoIntegrity();
	const FString EndingKey = CargoIntegrity >= CargoIntegrityCleanThreshold ? TEXT("clean") : TEXT("failed");
	UE_LOG(LogFixerRun, Log, TEXT("[Run] ending resolved '%s' (cargo integrity %.1f)"), *EndingKey, CargoIntegrity);

	const FIncidentEnding* Ending = CurrentIncident.Endings.FindByPredicate(
		[&EndingKey](const FIncidentEnding& E) { return E.Key == EndingKey; });
	// Set the gate regardless of whether a matching ending was found — a
	// missing/misspelled key should log once and no-op, not leave Tick()'s
	// "!bEndingShown" gate open so ShowEnding() retries every frame forever.
	bEndingShown = true;
	if (!Ending)
	{
		UE_LOG(LogFixerRun, Warning, TEXT("Incident '%s' has no '%s' ending — no ending card shown."), *IncidentId, *EndingKey);
		return;
	}
	CardWidget->ShowCard(Ending->Text, 0.f);
}

void ATheFixerGameMode::HandleCargoDamaged()
{
	if (SecondsSinceLastCargoFeedback < CargoFeedbackCooldownSeconds)
	{
		// Rollover damage ticks every frame -- without this, a sustained
		// tumble would restart the shake dozens of times a second.
		return;
	}
	SecondsSinceLastCargoFeedback = 0.f;

	if (APlayerController* PC = Cast<APlayerController>(TrackedVehicle->GetController()))
	{
		if (PC->PlayerCameraManager)
		{
			PC->PlayerCameraManager->StartCameraShake(UCargoDamageCameraShake::StaticClass());
		}
	}

	// Playtest-validated line, reused verbatim rather than inventing new
	// copy (PLAYTEST-LOG.md, 2026-05-09 web-prototype fix for the exact
	// same silent-mechanic gap). Skip rather than interrupt if a beat/
	// intro/ending is already up -- the shake alone still signals the hit.
	if (CardWidget && !CardWidget->IsShowingCard())
	{
		CardWidget->ShowCard(TEXT("Something shifts behind you. You hear it."), 1.5f);
	}
}

float ATheFixerGameMode::GetDistanceDrivenMeters() const
{
	const FVector Delta = TrackedVehicle->GetActorLocation() - RunStartLocation;
	return FVector::DotProduct(Delta, RunStartForward) / 100.f;
}
