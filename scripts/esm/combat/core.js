import {
  ATTACK_CALL_DEDUPE_MS,
  SHIFT_KEY
} from "../runtime/action-constants.js";

const attackCallDeduper = new Map();

export function towCombatOverlayIsShiftHeld() {
  return game.keyboard.isModifierActive(SHIFT_KEY);
}

export function towCombatOverlayShouldExecuteAttack(actor, { manual = false } = {}) {
  if (!actor) return false;

  const key = `${game.user.id}:${actor.id}:${manual ? "manual" : "auto"}`;
  const now = Date.now();
  const last = Number(attackCallDeduper.get(key) ?? 0);
  if (now - last < ATTACK_CALL_DEDUPE_MS) return false;

  attackCallDeduper.set(key, now);

  if (attackCallDeduper.size > 200) {
    for (const [entryKey, ts] of attackCallDeduper.entries()) {
      if (now - Number(ts) > ATTACK_CALL_DEDUPE_MS * 3) attackCallDeduper.delete(entryKey);
    }
  }

  return true;
}

export {
  towCombatOverlayToElement,
  towCombatOverlayApplyDialogClass,
  towCombatOverlayBindClick,
  towCombatOverlayOpenSelectorDialog,
  towCombatOverlayScheduleSoon,
  towCombatOverlayEscapeHtml,
  towCombatOverlayLocalize,
  towCombatOverlayRenderTemplate
} from "./dialog-utils.js";

export {
  towCombatOverlayApplyRollVisibility,
  towCombatOverlayApplyChatMessageCensorship
} from "./chat-visibility.js";

export {
  towCombatOverlayGetSortedWeaponAttacks,
  towCombatOverlayGetAttackMeta,
  towCombatOverlayRenderSelectorRowButton
} from "./attack-meta.js";

export {
  towCombatOverlayWaitForChatMessage,
  towCombatOverlayRenderDamageDisplay
} from "./damage-chat.js";