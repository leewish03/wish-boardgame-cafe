// A reconnect grace period is a short recovery window, not a second lobby.
// Keeping this value shared prevents the core and legacy room paths from
// disagreeing about how long a table may be paused.
export const RECONNECT_GRACE_MS = 30_000;
