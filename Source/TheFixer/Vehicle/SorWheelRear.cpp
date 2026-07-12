#include "SorWheelRear.h"

USorWheelRear::USorWheelRear()
{
	AxleType = EAxleType::Rear;
	bAffectedBySteering = false;
	bAffectedByEngine = true;
	bAffectedByBrake = true;
	bAffectedByHandbrake = true;
	WheelRadius = 39.f;
	WheelWidth = 24.f;
	SuspensionMaxRaise = 14.f;
	SuspensionMaxDrop = 14.f;
}
