#pragma once

#include "CoreMinimal.h"
#include "Camera/CameraShakeBase.h"
#include "CargoDamageCameraShake.generated.h"

/**
 * Short, punchy shake for the moment cargo takes damage (impact or
 * rollover) -- the mechanic was silent before this (PLAYTEST-LOG.md,
 * 2026-05-09 web-prototype entry: "cargo mechanic is silent... no
 * in-moment signal, discovered post-run or by accident"). Configured
 * entirely in C++, no Blueprint asset, per the project's C++-core rule.
 */
UCLASS()
class THEFIXER_API UCargoDamageCameraShake : public UCameraShakeBase
{
	GENERATED_BODY()

public:
	UCargoDamageCameraShake(const FObjectInitializer& ObjectInitializer);
};
