#pragma once

#include "CoreMinimal.h"
#include "WheeledVehiclePawn.h"
#include "SorVehiclePawn.generated.h"

class UCameraComponent;
class USpringArmComponent;
class UStaticMeshComponent;
class UPrimitiveComponent;
class UInputAction;
class UInputMappingContext;
struct FInputActionValue;
struct FHitResult;

/**
 * Sor's truck. Chaos-physics wheeled vehicle with a chase camera.
 *
 * Currently rides on the engine template's offroad skeletal mesh
 * (/Game/Vehicles/OffroadCar) as a placeholder until the Land Cruiser
 * model lands. All references are loaded in the constructor so the pawn
 * works with no Blueprint child; a BP child can still override any of it.
 */
UCLASS()
class THEFIXER_API ASorVehiclePawn : public AWheeledVehiclePawn
{
	GENERATED_BODY()

public:
	ASorVehiclePawn();

	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

	// True from the first meaningful throttle input onward. The game mode
	// uses this to dismiss the intro card the moment the player starts
	// driving, instead of gating on a UI button.
	UFUNCTION(BlueprintPure, Category = "Sor")
	bool HasStartedDriving() const { return bHasStartedDriving; }

	// Dev scaffold: logs speed every couple of seconds for headless verification.
	// Launch with -SorAutoDrive to hold full throttle from code.
	virtual void Tick(float DeltaSeconds) override;

	// 100 = untouched. Hard impacts and sustained rollover both cost
	// integrity; the game mode reads this at the ending to pick clean vs
	// failed. "Cargo determines outcome" per the incident design.
	UFUNCTION(BlueprintPure, Category = "Sor")
	float GetCargoIntegrity() const { return CargoIntegrity; }

private:
	bool bAutoDrive = false;
	bool bAutoCrash = false; // -SorAutoCrash: also steers off the corridor into the mountain flank, for calibration testing
	bool bHasStartedDriving = false;

	// -SorScreenshot: captures a real frame to disk a few seconds into the
	// run, via the console command system (no extra engine headers needed).
	// Every prior "verification" pass in this project's history was log-
	// telemetry only (speed/position numbers) -- none of it could catch a
	// wrong camera angle or a missing material, because nothing ever
	// actually looked at a rendered frame. This is permanent dev tooling,
	// matching the -SorAutoDrive/-SorAutoCrash/-SorForceCargoDamage pattern.
	bool bScreenshotRequested = false;
	bool bScreenshotTaken = false;
	float ScreenshotAtSeconds = 10.f;
	float ScreenshotAccumulator = 0.f;

	float CargoIntegrity = 100.f;
	float RolledSeconds = 0.f;
	float DebugLogAccumulator = 0.f;
	float SecondsSinceLastImpactDamage = 1000.f;

	// Impact impulse below this is normal driving contact (kerbs, small
	// bumps) and does no damage; only genuinely hard hits count.
	// TODO(calibration): still not measured against a real collision —
	// two attempts, two different negative results, both informative:
	// (1) a full clean-run drive test held CargoIntegrity at exactly
	// 100.0 throughout normal driving, including over uneven terrain —
	// routine wheel-terrain contact never fires OnComponentHit at all.
	// (2) a -SorAutoCrash test (steers off the corridor into the rising
	// mountain flank at speed) produced ZERO "[SorVehicle] RAW impact
	// impulse" log lines despite the vehicle genuinely climbing rough
	// terrain (Z swung from -594 to +695) and eventually getting stuck
	// wedged on the slope (speed dropped to ~0, wheels still grounded).
	// Chaos vehicle suspension absorbs wheel-terrain interaction entirely
	// via raycasts, even on steep off-corridor terrain — it never
	// produces a chassis rigid-body collision. Conclusion: impact damage
	// in this system can only ever come from discrete obstacles/props
	// (rocks, walls, other vehicles), not terrain of any steepness.
	// There's no obstacle geometry in the test scene yet, so this can't
	// be calibrated further until one exists. Placeholder values stand;
	// -SorAutoCrash and the raw-impulse log are kept as dev tooling for
	// whenever a real obstacle test becomes possible.
	static constexpr float ImpactDamageThresholdImpulse = 400000.f;
	static constexpr float ImpactDamageScale = 0.00004f;

	// UE hit events can re-fire on successive physics substeps during
	// sustained contact (a scrape, not a single hit) — without this, one
	// crash could apply damage many times in a fraction of a second.
	static constexpr float ImpactDamageCooldownSeconds = 0.4f;

	// up-vector Z below this means tipped past ~70 degrees from vertical —
	// matches the rollover-detection angle Border Run's recovery net used
	// (LESSONS.md, 2026-06-12). A grace period means a hard bump that
	// rights itself doesn't count as a rollover. RolledSeconds decays
	// rather than snapping to 0 on recovery, so a single good frame of
	// physics jitter mid-tumble (or a player rocking the vehicle to dodge
	// damage) can't erase multiple seconds of accumulated rollover.
	static constexpr float RolloverUpDotThreshold = 0.35f;
	static constexpr float RolloverGraceSeconds = 1.5f;
	static constexpr float RolloverDamagePerSecond = 15.f;

	UFUNCTION()
	void OnChassisHit(UPrimitiveComponent* HitComp, AActor* OtherActor, UPrimitiveComponent* OtherComp,
		FVector NormalImpulse, const FHitResult& Hit);

	void ApplyCargoDamage(float Amount, const TCHAR* Reason);
	void TickRolloverDamage(float DeltaSeconds);

protected:
	virtual void BeginPlay() override;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Camera")
	TObjectPtr<USpringArmComponent> SpringArm;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Camera")
	TObjectPtr<UCameraComponent> ChaseCamera;

	// The offroad skeletal mesh is only suspension + wheel bones; the body
	// and tires are separate static meshes, matching the template authoring.
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Mesh")
	TObjectPtr<UStaticMeshComponent> Chassis;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Mesh")
	TObjectPtr<UStaticMeshComponent> TireFrontLeft;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Mesh")
	TObjectPtr<UStaticMeshComponent> TireFrontRight;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Mesh")
	TObjectPtr<UStaticMeshComponent> TireRearLeft;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Mesh")
	TObjectPtr<UStaticMeshComponent> TireRearRight;

	UPROPERTY(EditDefaultsOnly, Category = "Input")
	TObjectPtr<UInputMappingContext> DrivingContext;

	UPROPERTY(EditDefaultsOnly, Category = "Input")
	TObjectPtr<UInputAction> ThrottleAction;

	UPROPERTY(EditDefaultsOnly, Category = "Input")
	TObjectPtr<UInputAction> BrakeAction;

	UPROPERTY(EditDefaultsOnly, Category = "Input")
	TObjectPtr<UInputAction> SteerAction;

	UPROPERTY(EditDefaultsOnly, Category = "Input")
	TObjectPtr<UInputAction> HandbrakeAction;

	// Available at any time, not just after the ending — off-corridor
	// terrain can wedge the vehicle with no way to recover otherwise
	// (observed directly during impact-damage calibration testing).
	UPROPERTY(EditDefaultsOnly, Category = "Input")
	TObjectPtr<UInputAction> ResetAction;

	void OnThrottle(const FInputActionValue& Value);
	void OnBrake(const FInputActionValue& Value);
	void OnSteer(const FInputActionValue& Value);
	void OnHandbrakePressed(const FInputActionValue& Value);
	void OnHandbrakeReleased(const FInputActionValue& Value);
	void OnReset(const FInputActionValue& Value);
};
