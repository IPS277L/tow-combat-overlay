import { AUTO_DEFENCE_WAIT_MS } from "./overlay-constants.js";

export const COMBAT_OVERLAY_ACTIONS_API_VERSION = "1.0.0";
export const SHIFT_KEY = foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS.SHIFT;
export const DEFAULT_DEFENCE_SKILL = "defence";
export const SELF_ROLL_CONTEXT = { skipTargets: true, targets: [] };
export const ATTACK_CALL_DEDUPE_MS = 700;
export const DAMAGE_RENDER_DEDUPE_MS = 120000;
export const ACTION_RELAY_WAIT_NOTICE_DELAY_MS = 1200;
export const ACTION_RELAY_WAIT_NOTICE_COOLDOWN_MS = 10000;
export const ACTION_RELAY_OPPOSED_DISCOVERY_WAIT_MS = AUTO_DEFENCE_WAIT_MS;
