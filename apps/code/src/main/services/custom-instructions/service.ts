import { injectable } from "inversify";
import { decrypt, encrypt } from "../../utils/encryption";
import { logger } from "../../utils/logger";
import { rendererStore } from "../../utils/store";
import { TypedEventEmitter } from "../../utils/typed-event-emitter";
import {
  CustomInstructionsServiceEvent,
  type CustomInstructionsServiceEvents,
} from "./schemas";

const log = logger.scope("custom-instructions");

const SETTINGS_STORE_KEY = "settings-storage";

/**
 * Owns reading/writing the user's custom instructions (extra guidance the
 * user has appended to every agent prompt). Persisted inside the encrypted
 * `settings-storage` bucket alongside other settings the renderer manages,
 * so a write here is visible to the settings store on next reload — and
 * immediately via the {@link CustomInstructionsServiceEvent.Changed} event.
 */
@injectable()
export class CustomInstructionsService extends TypedEventEmitter<CustomInstructionsServiceEvents> {
  read(): string {
    if (!rendererStore.has(SETTINGS_STORE_KEY)) return "";
    const encrypted = rendererStore.get(SETTINGS_STORE_KEY) as string;
    const raw = decrypt(encrypted);
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw) as {
        state?: { customInstructions?: string };
      };
      return parsed.state?.customInstructions ?? "";
    } catch (err) {
      log.warn("Failed to parse settings-storage", { err });
      return "";
    }
  }

  write(value: string): void {
    let parsed: { state?: Record<string, unknown>; version?: number } = {
      state: {},
      version: 0,
    };
    if (rendererStore.has(SETTINGS_STORE_KEY)) {
      const encrypted = rendererStore.get(SETTINGS_STORE_KEY) as string;
      const raw = decrypt(encrypted);
      if (raw) {
        try {
          parsed = JSON.parse(raw);
        } catch (err) {
          log.warn("Settings store corrupted, overwriting with new state", {
            err,
          });
        }
      }
    }
    parsed.state = { ...(parsed.state ?? {}), customInstructions: value };
    rendererStore.set(SETTINGS_STORE_KEY, encrypt(JSON.stringify(parsed)));
    this.emit(CustomInstructionsServiceEvent.Changed, {
      customInstructions: value,
    });
  }
}
