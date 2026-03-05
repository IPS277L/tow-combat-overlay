import {
  towCombatOverlayEscapeHtml,
  towCombatOverlayGetAttackMeta,
  towCombatOverlayGetSortedWeaponAttacks,
  towCombatOverlayRenderDamageDisplay,
  towCombatOverlayRenderSelectorRowButton,
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

export function towCombatOverlayRenderAttackSelector(actor, attacks, { onFastAuto } = {}) {
  const buttonMarkup = attacks
    .map((attack, index) => {
      const itemId = towCombatOverlayEscapeHtml(attack.id);
      return towCombatOverlayRenderSelectorRowButton({
        rowClass: "attack-btn",
        dataAttrs: `data-id="${itemId}"`,
        label: attack.name,
        subLabel: towCombatOverlayGetAttackMeta(attack),
        valueLabel: "",
        highlighted: index === 0,
        compact: false
      });
    })
    .join("");

  const content = `<div style="display:flex; flex-direction:column; min-width:0; border:1px solid #b9b6aa; border-radius:4px; overflow:hidden;">
    <div style="padding:4px 6px; font-size:12px; font-weight:700; background:#d9d5c7;">${MODULE_DIALOGS.attackListHeader}</div>
    <div style="display:flex; flex-direction:column; gap:4px; padding:6px; overflow-y:auto; overflow-x:hidden; max-height:430px; scrollbar-gutter:stable;">
      ${buttonMarkup || `<div style="font-size:12px; opacity:0.7;">${MODULE_DIALOGS.noAttacks}</div>`}
    </div>
  </div>`;
  const selectorDialog = new Dialog({
    title: MODULE_DIALOGS.attackSelectorTitle.replace("{actorName}", actor.name),
    content,
    width: 560,
    height: 560,
    buttons: { close: { label: MODULE_DIALOGS.closeLabel } },
    render: (html) => {
      html.find(".attack-btn").on("click", async (event) => {
        const chosen = actor.items.get(event.currentTarget.dataset.id);
        if (!chosen) return;
        const fastRoll = event.shiftKey === true;

        selectorDialog.close();
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

  selectorDialog.render(true);
}

export async function towCombatOverlayAttackActor(actor, { manual = false, onFastAuto = null } = {}) {
  if (!actor) return;
  if (!towCombatOverlayShouldExecuteAttack(actor, { manual })) return;
  const attacks = towCombatOverlayGetSortedWeaponAttacks(actor);
  if (attacks.length === 0) return;

  if (manual) {
    towCombatOverlayRenderAttackSelector(actor, attacks, { onFastAuto });
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
