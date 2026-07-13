#include "TheFixerGameMode.h"

#include "Blueprint/UserWidget.h"
#include "Kismet/GameplayStatics.h"
#include "Story/IncidentSubsystem.h"
#include "UI/StoryCardWidget.h"
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
	// Cargo state isn't tracked yet, so every run resolves clean — matches
	// the web prototype's documented current behaviour.
	const FIncidentEnding* CleanEnding = CurrentIncident.Endings.FindByPredicate(
		[](const FIncidentEnding& E) { return E.Key == TEXT("clean"); });
	if (!CleanEnding)
	{
		UE_LOG(LogFixerRun, Warning, TEXT("Incident '%s' has no 'clean' ending — no ending card shown."), *IncidentId);
		return;
	}
	bEndingShown = true;
	CardWidget->ShowCard(CleanEnding->Text, 0.f);
}

float ATheFixerGameMode::GetDistanceDrivenMeters() const
{
	const FVector Delta = TrackedVehicle->GetActorLocation() - RunStartLocation;
	return FVector::DotProduct(Delta, RunStartForward) / 100.f;
}
