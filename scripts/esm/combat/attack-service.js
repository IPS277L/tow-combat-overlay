import {
  towCombatOverlayApplyDialogClass,
  towCombatOverlayBindClick,
  towCombatOverlayGetAttackMeta,
  towCombatOverlayGetSortedWeaponAttacks,
  towCombatOverlayOpenSelectorDialog,
  towCombatOverlayRenderDamageDisplay,
  towCombatOverlayRenderSelectorRowButton,
  towCombatOverlayRenderTemplate,
  towCombatOverlayScheduleSoon,
  towCombatOverlayShouldExecuteAttack,
  towCombatOverlayToElement,
  towCombatOverlayWaitForChatMessage
} from "./core-service.js";
import { shouldTowCombatOverlayAutoSubmitDialogs } from "../bootstrap/register-settings.js";
import { getTowCombatOverlayConstants } from "../runtime/constants.js";
import { createTowCombatOverlayRollContext } from "./roll-modifier-service.js";
import { getTowCombatOverlaySystemAdapter } from "../system-adapter/system-adapter.js";

const {
  logPrefix: MODULE_LOG_PREFIX,
  notifications: MODULE_NOTIFICATIONS,
  dialogs: MODULE_DIALOGS
} = getTowCombatOverlayConstants();

export function towCombatOverlayEnsurePromiseClose(app) {
  if (!app || app._towCombatOverlayPromiseCloseWrapped || typeof app.close !== "function") return app;
  const originalClose = app.close;
  app.close = function wrappedTowPromiseClose(...args) {
    try {
      return Promise.resolve(originalClose.apply(this, args));
    } catch (error) {
      return Promise.reject(error);
    }
  };
  app._towCombatOverlayPromiseCloseWrapped = true;
  return app;
}

export function towCombatOverlayArmDamageAppend(actor, ability) {
  let timeoutId = null;

  const cleanup = (hookId) => {
    Hooks.off("createChatMessage", hookId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const hookId = Hooks.on("createChatMessage", async (message) => {
    const test = message?.system?.test;
    const sameActor = test?.context?.actor === actor.uuid;
    const sameItem = test?.context?.itemUuid === ability.uuid;
    if (!sameActor || !sameItem) return;

    cleanup(hookId);
    const flatDamage = test?.testData?.damage ?? ability.system.damage?.value ?? 0;
    await towCombatOverlayRenderDamageDisplay(message, { damage: flatDamage });
  });

  timeoutId = setTimeout(() => cleanup(hookId), 30000);
}

export function towCombatOverlayArmAutoSubmitDialog({ hookName, matches, submitErrorMessage }) {
  if (!shouldTowCombatOverlayAutoSubmitDialogs()) {
    return;
  }

  const hookId = Hooks.on(hookName, (app) => {
    if (!matches(app)) return;
    Hooks.off(hookName, hookId);
    towCombatOverlayEnsurePromiseClose(app);

    const element = towCombatOverlayToElement(app?.element);
    if (element) {
      element.style.visibility = "hidden";
      element.style.pointerEvents = "none";
    }

    towCombatOverlayScheduleSoon(async () => {
      if (typeof app?.submit !== "function") {
        console.error(`${MODULE_LOG_PREFIX} ${submitErrorMessage}`);
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

function towCombatOverlayArmAutoSubmitAbilityDialog(actor, ability) {
  towCombatOverlayArmAutoSubmitDialog({
    hookName: "renderAbilityAttackDialog",
    matches: (app) => app?.actor?.id === actor.id && app?.ability?.id === ability.id,
    submitErrorMessage: "AbilityAttackDialog.submit() is unavailable."
  });
}

export async function towCombatOverlaySetupAbilityTestWithDamage(actor, ability, { autoRoll = false } = {}) {
  towCombatOverlayArmDamageAppend(actor, ability);
  const rollContext = createTowCombatOverlayRollContext(actor);

  let testRef;

  if (autoRoll) {
    towCombatOverlayArmAutoSubmitAbilityDialog(actor, ability);
    testRef = await getTowCombatOverlaySystemAdapter().setupAbilityTest(actor, ability, rollContext);
  } else {
    testRef = await getTowCombatOverlaySystemAdapter().setupAbilityTest(actor, ability, rollContext);
  }

  if (!testRef) return null;

  const flatDamage = testRef.testData?.damage ?? ability.system.damage?.value ?? 0;
  const message = await towCombatOverlayWaitForChatMessage(testRef.context?.messageId);
  await towCombatOverlayRenderDamageDisplay(message, { damage: flatDamage });
  return testRef;
}

export async function towCombatOverlayRenderAttackSelector(actor, attacks, { onFastAuto } = {}) {
  const rows = attacks.map((attack, index) => ({
    rowClass: "attack-btn",
    id: attack.id,
    label: attack.name,
    subLabel: towCombatOverlayGetAttackMeta(attack),
    valueLabel: "",
    highlighted: index === 0,
    compact: false
  }));
  const buttonMarkup = (await Promise.all(
    rows.map((row) => towCombatOverlayRenderSelectorRowButton(row))
  )).join("");

  const content = await towCombatOverlayRenderTemplate("modules/tow-combat-overlay/templates/combat/attack-selector.hbs", {
    attackListHeader: MODULE_DIALOGS.attackListHeader,
    noAttacks: MODULE_DIALOGS.noAttacks,
    buttonMarkup
  });
  const title = MODULE_DIALOGS.attackSelectorTitle.replace("{actorName}", actor.name);
  towCombatOverlayOpenSelectorDialog({
    title,
    content,
    width: 560,
    closeLabel: MODULE_DIALOGS.closeLabel,
    onRender: (html, dialogApp) => {
      towCombatOverlayApplyDialogClass(html, "tow-combat-overlay-dialog");
      towCombatOverlayBindClick(html, ".attack-btn", async (event) => {
        const chosen = actor.items.get(event.currentTarget.dataset.id);
        if (!chosen) return;
        const fastRoll = event.shiftKey === true;

        dialogApp.close();
        if (fastRoll && typeof onFastAuto === "function") {
          try {
            await onFastAuto({ actor, ability: chosen });
          } catch (error) {
            console.error(`${MODULE_LOG_PREFIX} onFastAuto callback failed.`, error);
          }
        }

        await towCombatOverlaySetupAbilityTestWithDamage(actor, chosen, { autoRoll: fastRoll });
      });
    }
  });
}

export async function towCombatOverlayAttackActor(actor, { manual = false, onFastAuto = null } = {}) {
  if (!actor) return;
  if (!towCombatOverlayShouldExecuteAttack(actor, { manual })) return;
  const attacks = towCombatOverlayGetSortedWeaponAttacks(actor);
  if (attacks.length === 0) return;

  if (manual) {
    await towCombatOverlayRenderAttackSelector(actor, attacks, { onFastAuto });
    return;
  }
  await towCombatOverlaySetupAbilityTestWithDamage(actor, attacks[0], { autoRoll: true });
}

export async function towCombatOverlayRunAttackForControlled({ manual = false } = {}) {
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) {
    ui.notifications.warn(MODULE_NOTIFICATIONS.selectAtLeastOneToken);
    return;
  }
  for (const token of tokens) {
    await towCombatOverlayAttackActor(token.actor, { manual });
  }
}
