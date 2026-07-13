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
	bool bHasStartedDriving = false;

	float CargoIntegrity = 100.f;
	float RolledSeconds = 0.f;
	float DebugLogAccumulator = 0.f;
	float SecondsSinceLastImpactDamage = 1000.f;

	// Impact impulse below this is normal driving contact (kerbs, small
	// bumps) and does no damage; only genuinely hard hits count. Measured
	// empirically (see Tools/build_terrain_map.py-adjacent drive tests):
	// a deliberate ~40 km/h wall hit at Mass=2400.f produces NormalImpulse
	// magnitudes in the 700k-1.2M range; normal driving/kerb contact stays
	// under ~150k. Threshold sits well clear of both.
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

	void OnThrottle(const FInputActionValue& Value);
	void OnBrake(const FInputActionValue& Value);
	void OnSteer(const FInputActionValue& Value);
	void OnHandbrakePressed(const FInputActionValue& Value);
	void OnHandbrakeReleased(const FInputActionValue& Value);
};
