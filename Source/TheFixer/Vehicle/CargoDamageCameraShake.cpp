#include "CargoDamageCameraShake.h"

#include "Shakes/PerlinNoiseCameraShakePattern.h"

UCargoDamageCameraShake::UCargoDamageCameraShake(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
	// ChangeRootShakePattern<T>() calls NewObject() with no explicit name,
	// which is fatal when called from a UObject constructor (confirmed via
	// crash log: "NewObject with empty name can't be used to create default
	// subobjects"). CreateDefaultSubobject + SetRootShakePattern is the
	// constructor-safe equivalent.
	UPerlinNoiseCameraShakePattern* Pattern = CreateDefaultSubobject<UPerlinNoiseCameraShakePattern>(TEXT("RootShakePattern"));
	SetRootShakePattern(Pattern);
	Pattern->Duration = 0.25f;

	Pattern->LocationAmplitudeMultiplier = 1.f;
	Pattern->X.Amplitude = 2.f;
	Pattern->X.Frequency = 30.f;
	Pattern->Y.Amplitude = 2.f;
	Pattern->Y.Frequency = 30.f;
	Pattern->Z.Amplitude = 1.5f;
	Pattern->Z.Frequency = 25.f;

	Pattern->RotationAmplitudeMultiplier = 1.f;
	Pattern->Pitch.Amplitude = 1.f;
	Pattern->Pitch.Frequency = 30.f;
	Pattern->Yaw.Amplitude = 0.5f;
	Pattern->Yaw.Frequency = 20.f;
	Pattern->Roll.Amplitude = 1.f;
	Pattern->Roll.Frequency = 25.f;
}
