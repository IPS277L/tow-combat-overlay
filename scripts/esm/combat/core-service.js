import {
  ATTACK_CALL_DEDUPE_MS,
  DAMAGE_RENDER_DEDUPE_MS,
  SHIFT_KEY
} from "../runtime/action-runtime-constants.js";

const attackCallDeduper = new Map();
const damageRenderDeduper = new Map();

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

export function towCombatOverlayToElement(appElement) {
  if (!appElement) return null;
  if (appElement instanceof HTMLElement) return appElement;
  if (appElement[0] instanceof HTMLElement) return appElement[0];
  return null;
}

export function towCombatOverlayApplyDialogClass(renderHtml, className) {
  if (!renderHtml || !className) return;

  const jqRoot = renderHtml?.closest?.(".app.dialog");
  if (jqRoot?.addClass) {
    jqRoot.addClass(className);
    return;
  }

  const element = towCombatOverlayToElement(renderHtml);
  if (!element) return;

  const directLooksLikeDialog = element.classList?.contains("dialog")
    || element.classList?.contains("application")
    || element.classList?.contains("window-app");
  if (directLooksLikeDialog) {
    element.classList.add(className);
    return;
  }

  const dialogRoot = element.closest?.(".app.dialog")
    ?? element.closest?.(".application.dialog")
    ?? element.closest?.(".application")
    ?? null;
  if (dialogRoot?.classList) dialogRoot.classList.add(className);
}

export function towCombatOverlayBindClick(renderHtml, selector, handler) {
  if (!renderHtml || !selector || typeof handler !== "function") return;

  const jqMatches = renderHtml?.find?.(selector);
  if (jqMatches?.on) {
    jqMatches.on("click", handler);
    return;
  }

  const element = towCombatOverlayToElement(renderHtml);
  if (!element) return;
  for (const match of element.querySelectorAll(selector)) {
    match.addEventListener("click", handler);
  }
}

function towCombatOverlayFindRenderedDialogElementByMarker(markerId) {
  const marker = document.querySelector(`[data-tow-selector-dialog-id="${markerId}"]`);
  if (!marker) return null;
  return marker.closest(".app.window-app.dialog")
    ?? marker.closest(".application.dialog")
    ?? marker.closest(".application")
    ?? null;
}

export function towCombatOverlayOpenSelectorDialog({
  title,
  content,
  width = 560,
  height = null,
  closeLabel = null,
  onRender
} = {}) {
  const closeLabelResolved = closeLabel ?? towCombatOverlayLocalize("TOWCOMBATOVERLAY.Dialog.CloseLabel", "Close");
  const markerId = foundry?.utils?.randomID?.() ?? `tow-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const wrappedContent = `<div data-tow-selector-dialog-id="${towCombatOverlayEscapeHtml(markerId)}">${String(content ?? "")}</div>`;
  const DialogV2Class = foundry?.applications?.api?.DialogV2;
  if (typeof DialogV2Class === "function") {
    try {
      const dialogV2Config = {
        title,
        window: {
          title
        },
        content: wrappedContent,
        width,
        position: { width },
        buttons: [
          {
            action: "close",
            label: closeLabelResolved
          }
        ]
      };
      if (Number.isFinite(Number(height)) && Number(height) > 0) {
        dialogV2Config.height = Number(height);
        dialogV2Config.position.height = Number(height);
      }
      const dialogV2 = new DialogV2Class(dialogV2Config);
      dialogV2.render(true);
      if (typeof onRender === "function") {
        const bindOnceReady = (attempt = 0) => {
          const fromApp = towCombatOverlayToElement(dialogV2.element);
          const root = fromApp ?? towCombatOverlayFindRenderedDialogElementByMarker(markerId);
          if (root) {
            if (root.dataset.towSelectorBound === markerId) return;
            root.dataset.towSelectorBound = markerId;
            onRender(root, dialogV2);
            return;
          }
          if (attempt >= 30) return;
          setTimeout(() => bindOnceReady(attempt + 1), 50);
        };
        towCombatOverlayScheduleSoon(() => bindOnceReady(0));
      }
      return dialogV2;
    } catch (_error) {
      // Fall through to V1 Dialog.
    }
  }

  const dialogV1 = new Dialog({
    title,
    content: wrappedContent,
    width,
    ...(Number.isFinite(Number(height)) && Number(height) > 0 ? { height: Number(height) } : {}),
    buttons: { close: { label: closeLabelResolved } },
    render: (html) => {
      if (typeof onRender === "function") onRender(html, dialogV1);
    }
  });
  dialogV1.render(true);
  return dialogV1;
}

export function towCombatOverlayScheduleSoon(callback) {
  if (typeof window?.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => {
      void callback();
    });
    return;
  }
  Promise.resolve().then(() => {
    void callback();
  });
}

export function towCombatOverlayEscapeHtml(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

export function towCombatOverlayLocalize(key, fallback = "") {
  const localized = game?.i18n?.localize?.(key);
  if (typeof localized === "string" && localized !== key) return localized;
  return String(fallback ?? "");
}

export async function towCombatOverlayRenderTemplate(path, data = {}) {
  const renderer = foundry?.applications?.handlebars?.renderTemplate;
  if (typeof renderer !== "function") {
    throw new Error("[tow-combat-overlay] Missing foundry.applications.handlebars.renderTemplate");
  }
  return renderer(path, data);
}

function towCombatOverlayIsRangedAttack(attackItem) {
  return (attackItem.system.attack.range?.max ?? 0) > 0;
}

function towCombatOverlayIsWeaponAttack(item) {
  if (item.type !== "ability" || !item.system?.attack) return false;
  if (item.system?.isAttack === true) return true;
  return typeof item.system.attack.skill === "string" && item.system.attack.skill.length > 0;
}

export function towCombatOverlayGetSortedWeaponAttacks(actor) {
  return actor.items
    .filter(towCombatOverlayIsWeaponAttack)
    .sort((a, b) => {
      const aRanged = towCombatOverlayIsRangedAttack(a);
      const bRanged = towCombatOverlayIsRangedAttack(b);
      if (aRanged !== bRanged) return aRanged ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
}

export function towCombatOverlayGetAttackMeta(attack) {
  const skill = attack.system?.attack?.skill;
  const skillLabel = game.oldworld?.config?.skills?.[skill]
    ?? skill
    ?? towCombatOverlayLocalize("TOWCOMBATOVERLAY.Label.Attack", "Attack");
  const isRanged = attack.system?.isRanged || towCombatOverlayIsRangedAttack(attack);
  const attackType = isRanged
    ? towCombatOverlayLocalize("TOWCOMBATOVERLAY.Label.Ranged", "Ranged")
    : towCombatOverlayLocalize("TOWCOMBATOVERLAY.Label.Melee", "Melee");
  const rangeConfig = game.oldworld?.config?.range ?? {};
  const meleeRangeKey = attack.system?.attack?.range?.melee;
  const minRangeKey = attack.system?.attack?.range?.min;
  const maxRangeKey = attack.system?.attack?.range?.max;
  const rangeLabel = isRanged
    ? `${rangeConfig[minRangeKey] ?? minRangeKey ?? 0}-${rangeConfig[maxRangeKey] ?? maxRangeKey ?? 0}`
    : `${rangeConfig[meleeRangeKey] ?? meleeRangeKey ?? 0}`;
  const damage = Number(attack.system?.damage?.value ?? 0);
  const damageLabel = towCombatOverlayLocalize("TOWCOMBATOVERLAY.Label.DamageAbbrev", "DMG");
  return `${attackType} | ${rangeLabel} | ${skillLabel} | ${damageLabel} ${damage}`;
}

export function towCombatOverlayRenderSelectorRowButton(rowData = {}) {
  return towCombatOverlayRenderTemplate(
    "modules/tow-combat-overlay/templates/combat/rows/selector-row.hbs",
    rowData
  );
}

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

  await ChatMessage.create({
    content,
    speaker: message.speaker ?? {}
  });
}

export async function towCombatOverlayRenderDamageDisplay(message, { damage }) {
  if (!message) return;
  await towCombatOverlayPostSeparateDamageMessage(message, damage);
}
