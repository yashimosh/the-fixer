#include "SorWheelRear.h"

USorWheelRear::USorWheelRear()
{
	AxleType = EAxleType::Rear;
	bAffectedBySteering = false;
	bAffectedByEngine = true;
	bAffectedByBrake = true;
	bAffectedByHandbrake = true;

	WheelRadius = 50.f;
	WheelWidth = 40.f;
	CorneringStiffness = 750.f;
	FrictionForceMultiplier = 4.f;
	WheelLoadRatio = 1.f;

	SuspensionMaxRaise = 20.f;
	SuspensionMaxDrop = 20.f;
	SpringRate = 100.f;
	SpringPreload = 100.f;
	SweepShape = ESweepShape::Shapecast;

	MaxBrakeTorque = 3000.f;
	MaxHandBrakeTorque = 6000.f;
}
