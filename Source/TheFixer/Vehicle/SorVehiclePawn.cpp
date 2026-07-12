#include "SorVehiclePawn.h"

#include "Camera/CameraComponent.h"
#include "ChaosVehicleMovementComponent.h"
#include "ChaosWheeledVehicleMovementComponent.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "GameFramework/SpringArmComponent.h"
#include "InputActionValue.h"
#include "SorWheelFront.h"
#include "SorWheelRear.h"

ASorVehiclePawn::ASorVehiclePawn()
{
	SpringArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("SpringArm"));
	SpringArm->SetupAttachment(GetMesh());
	SpringArm->TargetArmLength = 650.f;
	SpringArm->SocketOffset = FVector(0.f, 0.f, 150.f);
	SpringArm->bEnableCameraRotationLag = true;
	SpringArm->CameraRotationLagSpeed = 8.f;
	SpringArm->bInheritPitch = false;
	SpringArm->bInheritRoll = false;

	ChaseCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("ChaseCamera"));
	ChaseCamera->SetupAttachment(SpringArm);
	ChaseCamera->SetRelativeRotation(FRotator(-8.f, 0.f, 0.f));

	UChaosWheeledVehicleMovementComponent* Movement =
		CastChecked<UChaosWheeledVehicleMovementComponent>(GetVehicleMovementComponent());

	// Wheel bone names are placeholders until the Land Cruiser skeletal mesh
	// lands; BP_SorVehicle overrides them to match the real skeleton.
	Movement->WheelSetups.SetNum(4);
	Movement->WheelSetups[0].WheelClass = USorWheelFront::StaticClass();
	Movement->WheelSetups[0].BoneName = TEXT("wheel_front_left");
	Movement->WheelSetups[1].WheelClass = USorWheelFront::StaticClass();
	Movement->WheelSetups[1].BoneName = TEXT("wheel_front_right");
	Movement->WheelSetups[2].WheelClass = USorWheelRear::StaticClass();
	Movement->WheelSetups[2].BoneName = TEXT("wheel_rear_left");
	Movement->WheelSetups[3].WheelClass = USorWheelRear::StaticClass();
	Movement->WheelSetups[3].BoneName = TEXT("wheel_rear_right");

	// Diesel HJ-series register: low revs, torque down low, no urgency.
	Movement->EngineSetup.MaxRPM = 4200.f;
	Movement->EngineSetup.MaxTorque = 430.f;
	Movement->TransmissionSetup.bUseAutomaticGears = true;
	Movement->Mass = 2400.f;
}

void ASorVehiclePawn::BeginPlay()
{
	Super::BeginPlay();

	if (const APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
			ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
		{
			if (DrivingContext)
			{
				Subsystem->AddMappingContext(DrivingContext, 0);
			}
		}
	}
}

void ASorVehiclePawn::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	UEnhancedInputComponent* Input = Cast<UEnhancedInputComponent>(PlayerInputComponent);
	if (!Input)
	{
		return;
	}

	if (ThrottleAction)
	{
		Input->BindAction(ThrottleAction, ETriggerEvent::Triggered, this, &ASorVehiclePawn::OnThrottle);
		Input->BindAction(ThrottleAction, ETriggerEvent::Completed, this, &ASorVehiclePawn::OnThrottle);
	}
	if (BrakeAction)
	{
		Input->BindAction(BrakeAction, ETriggerEvent::Triggered, this, &ASorVehiclePawn::OnBrake);
		Input->BindAction(BrakeAction, ETriggerEvent::Completed, this, &ASorVehiclePawn::OnBrake);
	}
	if (SteerAction)
	{
		Input->BindAction(SteerAction, ETriggerEvent::Triggered, this, &ASorVehiclePawn::OnSteer);
		Input->BindAction(SteerAction, ETriggerEvent::Completed, this, &ASorVehiclePawn::OnSteer);
	}
	if (HandbrakeAction)
	{
		Input->BindAction(HandbrakeAction, ETriggerEvent::Started, this, &ASorVehiclePawn::OnHandbrakePressed);
		Input->BindAction(HandbrakeAction, ETriggerEvent::Completed, this, &ASorVehiclePawn::OnHandbrakeReleased);
	}
}

void ASorVehiclePawn::OnThrottle(const FInputActionValue& Value)
{
	GetVehicleMovementComponent()->SetThrottleInput(Value.Get<float>());
}

void ASorVehiclePawn::OnBrake(const FInputActionValue& Value)
{
	GetVehicleMovementComponent()->SetBrakeInput(Value.Get<float>());
}

void ASorVehiclePawn::OnSteer(const FInputActionValue& Value)
{
	GetVehicleMovementComponent()->SetSteeringInput(Value.Get<float>());
}

void ASorVehiclePawn::OnHandbrakePressed(const FInputActionValue& Value)
{
	GetVehicleMovementComponent()->SetHandbrakeInput(true);
}

void ASorVehiclePawn::OnHandbrakeReleased(const FInputActionValue& Value)
{
	GetVehicleMovementComponent()->SetHandbrakeInput(false);
}
