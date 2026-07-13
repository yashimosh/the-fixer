#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "StoryCardWidget.generated.h"

class STextBlock;

/**
 * Full-bleed text card over a dark scrim — intro / beat / ending text.
 * Built entirely from Slate in RebuildWidget(); no UMG Blueprint asset,
 * per the project's C++-core rule (Blueprints only bind assets).
 *
 * One card is shown at a time. ShowCard() with HoldSeconds <= 0 holds
 * until HideCard() is called explicitly (used for the intro, which the
 * game mode dismisses the moment the player starts driving, and for the
 * ending, which is the last thing shown). HoldSeconds > 0 auto-fades
 * after that many seconds (used for mid-run beats).
 */
UCLASS()
class THEFIXER_API UStoryCardWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	virtual TSharedRef<SWidget> RebuildWidget() override;
	virtual void NativeOnInitialized() override;
	virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;

	void ShowCard(const FString& InText, float HoldSeconds);
	void HideCard();

	// True while a card is visible or fading — the game mode uses this to
	// avoid stomping one card with the next before the first has cleared.
	bool IsShowingCard() const { return bVisible || GetRenderOpacity() > KINDA_SMALL_NUMBER; }

private:
	TSharedPtr<STextBlock> BodyTextBlock;

	bool bVisible = false;
	float HoldRemainingSeconds = 0.f;
	float TargetOpacity = 0.f;
};
