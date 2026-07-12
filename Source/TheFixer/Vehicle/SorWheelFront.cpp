#include "SorWheelFront.h"

USorWheelFront::USorWheelFront()
{
	AxleType = EAxleType::Front;
	bAffectedBySteering = true;
	bAffectedByEngine = true; // 4x4
	bAffectedByBrake = true;
	bAffectedByHandbrake = false;
	MaxSteerAngle = 38.f;
	WheelRadius = 39.f;   // ~31-inch tyre in cm
	WheelWidth = 24.f;
	SuspensionMaxRaise = 12.f;
	SuspensionMaxDrop = 12.f;
}
