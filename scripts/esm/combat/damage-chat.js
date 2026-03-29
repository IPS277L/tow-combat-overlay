import { DAMAGE_RENDER_DEDUPE_MS } from "../runtime/action-constants.js";
import { towCombatOverlayApplyRollVisibility } from "./chat-visibility.js";
import { towCombatOverlayLocalize, towCombatOverlayRenderTemplate } from "./dialog-utils.js";

const damageRenderDeduper = new Map();

export async function towCombatOverlayWaitForChatMessage(messageId, timeoutMs = 3000) {
  if (!messageId) return null;
  const existing = game.messages.get(messageId);
  if (existing) return existing;

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;
    let hookId = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (hookId) Hooks.off("createChatMessage", hookId);
      if (timeoutId) clearTimeout(timeoutId);
      resolve(game.messages.get(messageId) ?? null);
    };

    hookId = Hooks.on("createChatMessage", (message) => {
      if (message?.id !== messageId) return;
      finish();
    });

    timeoutId = setTimeout(finish, timeoutMs);
  });
}

function towCombatOverlayGetDamageRenderState() {
  return damageRenderDeduper;
}

function towCombatOverlayMarkDamageRender(dedupe, key) {
  if (!dedupe || !key) return false;
  const now = Date.now();
  const last = Number(dedupe.get(key) ?? 0);
  if (now - last < DAMAGE_RENDER_DEDUPE_MS) return false;
  dedupe.set(key, now);

  if (dedupe.size > 250) {
    for (const [entryKey, ts] of dedupe.entries()) {
      if (now - Number(ts) > DAMAGE_RENDER_DEDUPE_MS * 2) dedupe.delete(entryKey);
    }
  }
  return true;
}

async function towCombatOverlayPostSeparateDamageMessage(message, damage) {
  if (!message) return;
  const targetCount = Number(message.system?.test?.context?.targetSpeakers?.length ?? 0);
  if (targetCount > 0) return;

  const dedupe = towCombatOverlayGetDamageRenderState();
  const dedupeKey = `separate:${message.id}`;
  if (!towCombatOverlayMarkDamageRender(dedupe, dedupeKey)) return;

  const content = await towCombatOverlayRenderTemplate("modules/tow-combat-overlay/templates/chat/damage-display.hbs", {
    damageLabel: towCombatOverlayLocalize("TOWCOMBATOVERLAY.Chat.Damage", "Damage"),
    damage: Number(damage ?? 0)
  });

  const chatData = {
    content,
    speaker: message.speaker ?? {}
  };
  towCombatOverlayApplyRollVisibility(chatData, {
    sourceMessage: message,
    censorForUnauthorized: true
  });
  await ChatMessage.create(chatData);
}

export async function towCombatOverlayRenderDamageDisplay(message, { damage }) {
  if (!message) return;
  await towCombatOverlayPostSeparateDamageMessage(message, damage);
}