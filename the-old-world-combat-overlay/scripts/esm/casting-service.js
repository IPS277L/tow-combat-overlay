import { SELF_ROLL_CONTEXT } from "./action-runtime-constants.js";
import { shouldTowCombatOverlayAutoSubmitDialogs } from "./register-settings.js";
import {
  towCombatOverlayEscapeHtml,
  towCombatOverlayScheduleSoon,
  towCombatOverlayToElement
} from "./core-service.js";
import { getTowCombatOverlaySystemAdapter } from "./system-adapter/system-adapter.js";

function towCombatOverlayHasLoreText(value) {
  return typeof value === "string" && value.length > 0;
}

function towCombatOverlayIsCastableSpell(item) {
  if (item?.type !== "spell") return false;
  const lore = item.system?.lore;
  return towCombatOverlayHasLoreText(lore) && lore !== "none";
}

function towCombatOverlayGetSpellLoreLabel(spell) {
  const lore = spell.system?.lore;
  return game.oldworld?.config?.magicLore?.[lore] ?? lore ?? "";
}

export function towCombatOverlayGetSortedSpells(actor) {
  return actor.items
    .filter(towCombatOverlayIsCastableSpell)
    .sort((a, b) => {
      const loreCmp = towCombatOverlayGetSpellLoreLabel(a).localeCompare(towCombatOverlayGetSpellLoreLabel(b));
      if (loreCmp !== 0) return loreCmp;

      const cvA = Number(a.system?.cv ?? 0);
      const cvB = Number(b.system?.cv ?? 0);
      if (cvA !== cvB) return cvA - cvB;

      return a.name.localeCompare(b.name);
    });
}

function towCombatOverlayArmAutoSubmitCastingDialog(actor, spell) {
  if (!shouldTowCombatOverlayAutoSubmitDialogs()) {
    return;
  }

  Hooks.once("renderCastingDialog", (app) => {
    const sameActor = app?.actor?.id === actor.id;
    const sameSpell = app?.spell?.id === spell.id;
    if (!sameActor || !sameSpell) return;

    const element = towCombatOverlayToElement(app?.element);
    if (element) {
      element.style.visibility = "hidden";
      element.style.pointerEvents = "none";
    }

    towCombatOverlayScheduleSoon(async () => {
      if (typeof app?.submit !== "function") {
        console.error("[the-old-world-combat-overlay] CastingDialog.submit() is unavailable.");
        if (element) {
          element.style.visibility = "";
          element.style.pointerEvents = "";
        }
        return;
      }

      await app.submit();
    });
  });
}

export async function towCombatOverlaySetupCastingTest(actor, spell, { autoRoll = false } = {}) {
  const lore = spell.system?.lore;

  if (!towCombatOverlayHasLoreText(lore) || lore === "none") {
    ui.notifications.warn(`${actor.name}: '${spell.name}' has no lore, cannot open Casting Test.`);
    return null;
  }

  if (autoRoll) {
    towCombatOverlayArmAutoSubmitCastingDialog(actor, spell);
  }

  return getTowCombatOverlaySystemAdapter().setupCastingTest(actor, { lore, spell }, SELF_ROLL_CONTEXT);
}

export function towCombatOverlayRenderSpellSelector(actor, spells) {
  const buttonMarkup = spells
    .map((spell) => {
      const itemId = towCombatOverlayEscapeHtml(spell.id);
      const itemName = towCombatOverlayEscapeHtml(spell.name);
      const loreName = towCombatOverlayEscapeHtml(towCombatOverlayGetSpellLoreLabel(spell) || "No Lore");
      const cv = Number(spell.system?.cv ?? 0);

      return `<button type="button"
        class="spell-btn"
        data-id="${itemId}"
        style="text-align:left; padding:6px;">
        <strong>${itemName}</strong>
        <div style="font-size:12px; opacity:0.8;">${loreName} | CV ${cv}</div>
      </button>`;
    })
    .join("");

  const content = `<div style="display:flex; flex-direction:column; gap:6px;">${buttonMarkup}</div>`;

  const selectorDialog = new Dialog({
    title: `${actor.name} - Spells`,
    content,
    buttons: { close: { label: "Close" } },
    render: (html) => {
      html.find(".spell-btn").on("click", async (event) => {
        const chosen = actor.items.get(event.currentTarget.dataset.id);
        if (!chosen) return;

        selectorDialog.close();
        await towCombatOverlaySetupCastingTest(actor, chosen, { autoRoll: false });
      });
    }
  });

  selectorDialog.render(true);
}

export async function towCombatOverlayCastActor(actor, { manual = false } = {}) {
  if (!actor) return;

  const spells = towCombatOverlayGetSortedSpells(actor);
  if (spells.length === 0) {
    ui.notifications.warn(`${actor.name}: no castable spells found in Magic tab.`);
    return;
  }

  if (manual) {
    towCombatOverlayRenderSpellSelector(actor, spells);
    return;
  }

  await towCombatOverlaySetupCastingTest(actor, spells[0], { autoRoll: true });
}

export async function towCombatOverlayRunCastingForControlled({ manual = false } = {}) {
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) {
    ui.notifications.warn("Select at least one token.");
    return;
  }

  for (const token of tokens) {
    await towCombatOverlayCastActor(token.actor, { manual });
  }
}
