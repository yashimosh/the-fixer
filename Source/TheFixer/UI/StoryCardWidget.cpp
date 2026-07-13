#include "StoryCardWidget.h"

#include "Widgets/SOverlay.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Images/SImage.h"
#include "Widgets/Text/STextBlock.h"
#include "Styling/CoreStyle.h"

namespace
{
	// Cards fade at a fixed rate rather than a fixed duration, so a card
	// interrupted mid-fade (HideCard called again) doesn't jump.
	constexpr float FadeSpeed = 2.5f;
}

TSharedRef<SWidget> UStoryCardWidget::RebuildWidget()
{
	FSlateFontInfo BodyFont = FCoreStyle::GetDefaultFontStyle("Regular", 22);

	return SNew(SBox)
		.HAlign(HAlign_Fill)
		.VAlign(VAlign_Fill)
		.Padding(FMargin(0.f))
		[
			SNew(SOverlay)
			+ SOverlay::Slot()
			[
				// Full-bleed dark scrim — no border, no chrome.
				SNew(SImage)
				.Image(FCoreStyle::Get().GetBrush("WhiteBrush"))
				.ColorAndOpacity(FLinearColor(0.f, 0.f, 0.f, 0.82f))
			]
			+ SOverlay::Slot()
			.HAlign(HAlign_Center)
			.VAlign(VAlign_Center)
			[
				SNew(SBox)
				.WidthOverride(900.f)
				.Padding(FMargin(40.f))
				[
					SAssignNew(BodyTextBlock, STextBlock)
					.Text(FText::GetEmpty())
					.Font(BodyFont)
					.ColorAndOpacity(FLinearColor(0.94f, 0.94f, 0.9f, 1.f))
					.Justification(ETextJustify::Center)
					.AutoWrapText(true)
					.LineHeightPercentage(1.3f)
				]
			]
		];
}

void UStoryCardWidget::NativeOnInitialized()
{
	Super::NativeOnInitialized();
	// Start transparent so the first-ever ShowCard() (the intro) actually
	// fades in instead of appearing at RenderOpacity's UWidget default of 1.
	SetRenderOpacity(0.f);
}

void UStoryCardWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
	Super::NativeTick(MyGeometry, InDeltaTime);

	SetRenderOpacity(FMath::FInterpConstantTo(GetRenderOpacity(), TargetOpacity, InDeltaTime, FadeSpeed));

	if (bVisible && HoldRemainingSeconds > 0.f)
	{
		HoldRemainingSeconds -= InDeltaTime;
		if (HoldRemainingSeconds <= 0.f)
		{
			HideCard();
		}
	}
}

void UStoryCardWidget::ShowCard(const FString& InText, float HoldSeconds)
{
	if (BodyTextBlock.IsValid())
	{
		BodyTextBlock->SetText(FText::FromString(InText));
	}
	bVisible = true;
	TargetOpacity = 1.f;
	HoldRemainingSeconds = HoldSeconds;
	SetVisibility(ESlateVisibility::HitTestInvisible);
}

void UStoryCardWidget::HideCard()
{
	bVisible = false;
	TargetOpacity = 0.f;
}
