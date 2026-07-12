#pragma once

#include "CoreMinimal.h"
#include "WheeledVehiclePawn.h"
#include "SorVehiclePawn.generated.h"

class UCameraComponent;
class USpringArmComponent;
class UStaticMeshComponent;
class UInputAction;
class UInputMappingContext;
struct FInputActionValue;

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

	// Dev scaffold: logs speed every couple of seconds for headless verification.
	// Launch with -SorAutoDrive to hold full throttle from code.
	virtual void Tick(float DeltaSeconds) override;

private:
	bool bAutoDrive = false;

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
