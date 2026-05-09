// shakeRef — shared mutable signal between StoryWatcher (writes) and
// ChaseCamera (reads). A module-level object rather than React state
// because this needs to be read every frame without triggering re-renders.
//
// Usage:
//   Write (StoryWatcher):  shake.countdown = 0.35;
//   Read  (ChaseCamera):   if (shake.countdown > 0) { ... shake.countdown -= dt; }

export const shake = { countdown: 0 };
