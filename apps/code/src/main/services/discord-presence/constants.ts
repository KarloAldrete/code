/**
 * Discord Rich Presence configuration.
 *
 * The client id identifies the Discord Application whose name and uploaded
 * Rich Presence art (the `*_IMAGE_KEY` assets below) show up on a user's
 * profile. Register an application at https://discord.com/developers and wire
 * its id through `VITE_DISCORD_CLIENT_ID` (see `.env.example`). Until a real id
 * is configured the service stays dormant and never opens a socket.
 */
export function getDiscordClientId(): string {
  return process.env.VITE_DISCORD_CLIENT_ID ?? "";
}

/** Asset keys uploaded under the Discord app's Rich Presence → Art Assets. */
export const LARGE_IMAGE_KEY = "posthog_logo";
export const SMALL_IMAGE_RUNNING = "agent_running";
export const SMALL_IMAGE_IDLE = "posthog_idle";

/** How long to wait before retrying a dropped/absent Discord connection. */
export const RECONNECT_INTERVAL_MS = 15_000;

/**
 * Minimum spacing between SET_ACTIVITY frames. Discord rate-limits presence
 * updates (~5 per 20s); we coalesce to one update per this window with a
 * trailing flush so the final state always lands.
 */
export const MIN_UPDATE_INTERVAL_MS = 15_000;

/** Discord rejects activity strings shorter than 2 or longer than 128 chars. */
export const MAX_FIELD_LENGTH = 128;
