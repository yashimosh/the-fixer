#include "SorVehiclePawn.h"

#include "Animation/AnimInstance.h"
#include "Camera/CameraComponent.h"
#include "ChaosVehicleMovementComponent.h"
#include "ChaosWheeledVehicleMovementComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "Engine/SkeletalMesh.h"
#include "Engine/StaticMesh.h"
#include "GameFramework/SpringArmComponent.h"
#include "InputActionValue.h"
#include "InputMappingContext.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "SorWheelFront.h"
#include "SorWheelRear.h"
#include "UObject/ConstructorHelpers.h"

ASorVehiclePawn::ASorVehiclePawn()
{
	// AWheeledVehiclePawn's base constructor sets bSimulatePhysics=false; the
	// engine template relies on a Blueprint component-default override to
	// re-enable it. We're Blueprint-free, so it has to happen here instead.
	GetMesh()->SetSimulatePhysics(true);

	// Placeholder truck: engine template offroad car until the Land Cruiser lands.
	static ConstructorHelpers::FObjectFinder<USkeletalMesh> BodyMesh(TEXT("/Game/Vehicles/OffroadCar/SKM_Offroad"));
	if (BodyMesh.Succeeded())
	{
		GetMesh()->SetSkeletalMesh(BodyMesh.Object);
	}
	static ConstructorHelpers::FClassFinder<UAnimInstance> AnimBP(TEXT("/Game/Vehicles/OffroadCar/Offroad_AnimBP"));
	if (AnimBP.Succeeded())
	{
		GetMesh()->SetAnimInstanceClass(AnimBP.Class);
	}

	static ConstructorHelpers::FObjectFinder<UStaticMesh> BodyStaticMesh(TEXT("/Game/Vehicles/OffroadCar/SM_Offroad_Body"));
	Chassis = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Chassis"));
	Chassis->SetupAttachment(GetMesh());
	Chassis->SetCollisionProfileName(FName("NoCollision"));
	if (BodyStaticMesh.Succeeded())
	{
		Chassis->SetStaticMesh(BodyStaticMesh.Object);
	}

	static ConstructorHelpers::FObjectFinder<UStaticMesh> TireMesh(TEXT("/Game/Vehicles/OffroadCar/SM_Offroad_Tire"));
	auto MakeTire = [this](const TCHAR* Name, const TCHAR* Socket, bool bMirrored) -> UStaticMeshComponent*
	{
		UStaticMeshComponent* Tire = CreateDefaultSubobject<UStaticMeshComponent>(Name);
		Tire->SetupAttachment(GetMesh(), Socket);
		Tire->SetCollisionProfileName(FName("NoCollision"));
		if (TireMesh.Succeeded())
		{
			Tire->SetStaticMesh(TireMesh.Object);
		}
		if (bMirrored)
		{
			Tire->SetRelativeRotation(FRotator(0.f, 180.f, 0.f));
		}
		return Tire;
	};
	TireFrontLeft = MakeTire(TEXT("TireFrontLeft"), TEXT("VisWheel_FL"), false);
	TireFrontRight = MakeTire(TEXT("TireFrontRight"), TEXT("VisWheel_FR"), true);
	TireRearLeft = MakeTire(TEXT("TireRearLeft"), TEXT("VisWheel_BL"), false);
	TireRearRight = MakeTire(TEXT("TireRearRight"), TEXT("VisWheel_BR"), true);

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

	// Input assets from the template pack; overridable per-instance/BP.
	static ConstructorHelpers::FObjectFinder<UInputMappingContext> Imc(TEXT("/Game/VehicleTemplate/Input/IMC_Vehicle_Default"));
	if (Imc.Succeeded()) { DrivingContext = Imc.Object; }
	static ConstructorHelpers::FObjectFinder<UInputAction> IaThrottle(TEXT("/Game/VehicleTemplate/Input/Actions/IA_Throttle"));
	if (IaThrottle.Succeeded()) { ThrottleAction = IaThrottle.Object; }
	static ConstructorHelpers::FObjectFinder<UInputAction> IaBrake(TEXT("/Game/VehicleTemplate/Input/Actions/IA_Brake"));
	if (IaBrake.Succeeded()) { BrakeAction = IaBrake.Object; }
	static ConstructorHelpers::FObjectFinder<UInputAction> IaSteering(TEXT("/Game/VehicleTemplate/Input/Actions/IA_Steering"));
	if (IaSteering.Succeeded()) { SteerAction = IaSteering.Object; }
	static ConstructorHelpers::FObjectFinder<UInputAction> IaHandbrake(TEXT("/Game/VehicleTemplate/Input/Actions/IA_Handbrake"));
	if (IaHandbrake.Succeeded()) { HandbrakeAction = IaHandbrake.Object; }

	UChaosWheeledVehicleMovementComponent* Movement =
		CastChecked<UChaosWheeledVehicleMovementComponent>(GetVehicleMovementComponent());

	Movement->bLegacyWheelFrictionPosition = false;
	Movement->ChassisHeight = 160.f;
	Movement->DragCoefficient = 0.3f;
	Movement->DownforceCoefficient = 0.1f;
	Movement->CenterOfMassOverride = FVector(0.f, 0.f, 75.f);
	Movement->bEnableCenterOfMassOverride = true;

	Movement->WheelSetups.SetNum(4);
	Movement->WheelSetups[0].WheelClass = USorWheelFront::StaticClass();
	Movement->WheelSetups[0].BoneName = TEXT("PhysWheel_FL");
	Movement->WheelSetups[1].WheelClass = USorWheelFront::StaticClass();
	Movement->WheelSetups[1].BoneName = TEXT("PhysWheel_FR");
	Movement->WheelSetups[2].WheelClass = USorWheelRear::StaticClass();
	Movement->WheelSetups[2].BoneName = TEXT("PhysWheel_BL");
	Movement->WheelSetups[3].WheelClass = USorWheelRear::StaticClass();
	Movement->WheelSetups[3].BoneName = TEXT("PhysWheel_BR");

	// Diesel HJ-series register: torque down low, no urgency.
	// Normalized torque curve (x = normalized RPM, y = torque fraction of MaxTorque).
	if (FRichCurve* Torque = Movement->EngineSetup.TorqueCurve.GetRichCurve())
	{
		Torque->Reset();
		Torque->AddKey(0.00f, 0.55f);
		Torque->AddKey(0.25f, 0.90f);
		Torque->AddKey(0.45f, 1.00f);
		Torque->AddKey(0.70f, 0.88f);
		Torque->AddKey(1.00f, 0.60f);
	}
	Movement->EngineSetup.MaxTorque = 500.f;
	Movement->EngineSetup.MaxRPM = 4200.f;
	Movement->EngineSetup.EngineIdleRPM = 800.f;
	Movement->EngineSetup.EngineBrakeEffect = 0.08f;
	Movement->EngineSetup.EngineRevUpMOI = 6.f;
	Movement->EngineSetup.EngineRevDownRate = 600.f;
	Movement->TransmissionSetup.bUseAutomaticGears = true;
	Movement->TransmissionSetup.ChangeUpRPM = 3600.f;
	Movement->TransmissionSetup.ChangeDownRPM = 1400.f;

	Movement->DifferentialSetup.DifferentialType = EVehicleDifferential::AllWheelDrive;
	Movement->DifferentialSetup.FrontRearSplit = 0.5f;

	Movement->SteeringSetup.SteeringType = ESteeringType::AngleRatio;
	Movement->SteeringSetup.AngleRatio = 0.7f;

	Movement->Mass = 2400.f;

	PrimaryActorTick.bCanEverTick = true;
	SetActorTickInterval(2.f);
}

void ASorVehiclePawn::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (bAutoDrive)
	{
		GetVehicleMovementComponent()->SetThrottleInput(1.f);
		bHasStartedDriving = true;

		const UChaosWheeledVehicleMovementComponent* WheeledMovement =
			Cast<UChaosWheeledVehicleMovementComponent>(GetVehicleMovementComponent());
		UE_LOG(LogTemp, Log, TEXT("[SorVehicle] speed %.1f km/h  throttle %.2f  gear %d  rpm %.0f  z %.1f  wheel0grounded %d"),
			GetVehicleMovementComponent()->GetForwardSpeed() * 0.036f,
			GetVehicleMovementComponent()->GetThrottleInput(),
			GetVehicleMovementComponent()->GetCurrentGear(),
			WheeledMovement ? WheeledMovement->GetEngineRotationSpeed() : 0.f,
			GetActorLocation().Z,
			WheeledMovement && WheeledMovement->GetNumWheels() > 0 ? WheeledMovement->GetWheelState(0).bInContact : false);
	}
}

void ASorVehiclePawn::BeginPlay()
{
	Super::BeginPlay();

	bAutoDrive = FParse::Param(FCommandLine::Get(), TEXT("SorAutoDrive"));

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
	const float ThrottleValue = Value.Get<float>();
	GetVehicleMovementComponent()->SetThrottleInput(ThrottleValue);
	if (!bHasStartedDriving && FMath::Abs(ThrottleValue) > 0.05f)
	{
		bHasStartedDriving = true;
	}
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
