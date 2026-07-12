#include "TheFixerGameMode.h"
#include "Vehicle/SorVehiclePawn.h"

ATheFixerGameMode::ATheFixerGameMode()
{
	// The C++ pawn is the fallback; BP_SorVehicle (with the real mesh and
	// input assets assigned) overrides this in the map's World Settings.
	DefaultPawnClass = ASorVehiclePawn::StaticClass();
}
