import {
  AUTO_APPLY_WAIT_MS,
  AUTO_DEFENCE_WAIT_MS,
  AUTO_STAGGER_PATCH_MS,
  MODULE_KEY,
  OPPOSED_LINK_WAIT_MS
} from "../../runtime/overlay-runtime-constants.js";
import { getTowCombatOverlayActionsApi } from "../../bootstrap/register-public-apis.js";
import {
  shouldTowCombatOverlayAutoApplyDamage,
  shouldTowCombatOverlayAutoChooseStaggerWound,
  shouldTowCombatOverlayAutoDefence
} from "../../bootstrap/register-settings.js";
import {
  towCombatOverlayApplyActorDamage,
  towCombatOverlayEnsureActionsApi
} from "../shared/actions-bridge-service.js";
import { towCombatOverlayLocalize, towCombatOverlayRenderTemplate } from "../../combat/core-service.js";
import { towCombatOverlayResolveConditionLabel } from "../shared/shared-service.js";

function getDialogActionList(config) {
  return Array.isArray(config?.buttons)
    ? config.buttons.map((button) => String(button?.action ?? ""))
    : Object.values(config?.buttons ?? {}).map((button) => String(button?.action ?? ""));
}

function isLikelyStaggerChoiceDialog(config) {
  const title = String(config?.window?.title ?? "").toLowerCase();
  const content = String(config?.content ?? "").toLowerCase();
  const actions = getDialogActionList(config);
  const hasExpectedChoices = actions.includes("wound")
    && (actions.includes("prone") || actions.includes("give"));
  if (!hasExpectedChoices) return false;

  return title.includes("stagger")
    || content.includes("stagger")
    || content.includes("choose from the following options");
}

export function armDefaultStaggerChoiceWound(durationMs = AUTO_STAGGER_PATCH_MS) {
  if (!shouldTowCombatOverlayAutoChooseStaggerWound()) {
    return () => {};
  }

  const state = game[MODULE_KEY];
  const DialogApi = foundry.applications?.api?.Dialog;
  if (!state || typeof DialogApi?.wait !== "function") return () => {};

  if (!state.staggerWaitPatch) {
    const originalWait = DialogApi.wait.bind(DialogApi);
    state.staggerWaitPatch = { originalWait, refs: 0, activeUntil: 0 };

    DialogApi.wait = async (config, options) => {
      const patchState = state.staggerWaitPatch;
      if (!patchState || patchState.refs <= 0 || Date.now() > Number(patchState.activeUntil ?? 0)) {
        return originalWait(config, options);
      }
      if (isLikelyStaggerChoiceDialog(config)) return "wound";
      return state.staggerWaitPatch.originalWait(config, options);
    };
  }

  state.staggerWaitPatch.refs += 1;
  state.staggerWaitPatch.activeUntil = Math.max(
    Number(state.staggerWaitPatch.activeUntil ?? 0),
    Date.now() + Math.max(0, Number(durationMs) || 0)
  );
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    if (!state.staggerWaitPatch) return;
    state.staggerWaitPatch.refs = Math.max(0, state.staggerWaitPatch.refs - 1);
    if (state.staggerWaitPatch.refs === 0) {
      DialogApi.wait = state.staggerWaitPatch.originalWait;
      delete state.staggerWaitPatch;
    }
  };

  const timer = setTimeout(restore, durationMs);
  return () => {
    clearTimeout(timer);
    restore();
  };
}

export function armAutoDefenceForOpposed(sourceToken, targetToken, { sourceBeforeState } = {}) {
  if (!shouldTowCombatOverlayAutoDefence()) {
    return;
  }

  if (!sourceToken?.actor || !targetToken?.actor?.isOwner) return;

  let timeoutId = null;
  const cleanup = (hookId) => {
    Hooks.off("createChatMessage", hookId);
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
  };

  const hookId = Hooks.on("createChatMessage", async (message) => {
    if (message?.type !== "opposed") return;
    if (message.system?.defender?.token !== targetToken.id) return;

    const attackerMessage = game.messages.get(message.system?.attackerMessage);
    const attackerActorUuid = attackerMessage?.system?.test?.actor;
    if (attackerActorUuid && attackerActorUuid !== sourceToken.actor.uuid) return;

    const state = game[MODULE_KEY];
    if (state) {
      if (!state.autoDefenceHandled) state.autoDefenceHandled = new Set();
      if (state.autoDefenceHandled.has(message.id)) return;
      state.autoDefenceHandled.add(message.id);
    }

    cleanup(hookId);
    if (!(await towCombatOverlayEnsureActionsApi())) return;

    const started = Date.now();
    while (Date.now() - started < OPPOSED_LINK_WAIT_MS) {
      if (targetToken.actor.system?.opposed?.id === message.id) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    const actionsApi = getTowCombatOverlayActionsApi();
    await actionsApi.defenceActor(targetToken.actor, { manual: false });
    armAutoApplyDamageForOpposed(message, {
      sourceActor: sourceToken.actor,
      sourceBeforeState
    });
  });

  timeoutId = setTimeout(() => cleanup(hookId), AUTO_DEFENCE_WAIT_MS);
}

async function applyDamageWithWoundsFallback(defenderActor, damageValue, context) {
  const system = defenderActor?.system;
  if (!system || typeof system.applyDamage !== "function") return;

  const originalAddWound = (typeof system.addWound === "function") ? system.addWound.bind(system) : null;
  if (!originalAddWound) {
    await towCombatOverlayApplyActorDamage(defenderActor, damageValue, context);
    return;
  }

  system.addWound = async function wrappedAddWound(options = {}) {
    const tableId = game.settings.get("whtow", "tableSettings")?.wounds;
    const hasTable = !!(tableId && game.tables.get(tableId));

    if (!hasTable) return originalAddWound({ ...options, roll: false });
    try {
      return await originalAddWound(options);
    } catch (error) {
      const message = String(error?.message ?? error ?? "");
      if (message.includes("No table found for wounds")) {
        return originalAddWound({ ...options, roll: false });
      }
      throw error;
    }
  };

  try {
    await towCombatOverlayApplyActorDamage(defenderActor, damageValue, context);
  } finally {
    system.addWound = originalAddWound;
  }
}

export function snapshotActorState(actor) {
  const statuses = new Set(Array.from(actor?.statuses ?? []).map((status) => String(status)));
  for (const effect of Array.from(actor?.effects?.contents ?? [])) {
    for (const status of Array.from(effect?.statuses ?? [])) statuses.add(String(status));
  }
  const wounds = Number(actor?.itemTypes?.wound?.length ?? 0);
  return { statuses, wounds };
}

async function captureSettledActorState(actor, baselineState, settleMs = 700) {
  const started = Date.now();
  let last = snapshotActorState(actor);
  let stableFor = 0;

  while (Date.now() - started < settleMs) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const current = snapshotActorState(actor);
    const sameWounds = current.wounds === last.wounds;
    const sameStatuses = current.statuses.size === last.statuses.size
      && Array.from(current.statuses).every((status) => last.statuses.has(status));
    if (sameWounds && sameStatuses) {
      stableFor += 80;
      if (stableFor >= 160) return current;
    } else {
      stableFor = 0;
      last = current;
    }
  }

  const finalState = snapshotActorState(actor);
  if ((finalState.wounds ?? 0) < (baselineState?.wounds ?? 0)) return last;
  return finalState;
}

async function deriveSourceStatusHints(sourceActor, sourceBeforeState) {
  if (!sourceActor || !sourceBeforeState) return [];
  const sourceAfterState = await captureSettledActorState(sourceActor, sourceBeforeState, 500);
  return deriveAppliedStatusLabels(sourceBeforeState, sourceAfterState);
}

function deriveAppliedStatusLabels(before, after) {
  const labels = [];
  const add = (label) => {
    if (!label) return;
    if (!labels.includes(label)) labels.push(label);
  };

  if ((after?.wounds ?? 0) > (before?.wounds ?? 0)) {
    add(towCombatOverlayLocalize("TOWCOMBATOVERLAY.Status.Wound", "Wound"));
  }

  const beforeStatuses = before?.statuses ?? new Set();
  const afterStatuses = after?.statuses ?? new Set();
  for (const statusId of afterStatuses) {
    if (beforeStatuses.has(statusId)) continue;
    const label = towCombatOverlayResolveConditionLabel(statusId);
    add(label);
  }
  return labels;
}

function getFlowNamesModel(attackerName, defenderName) {
  const combinedLen = `${attackerName} vs. ${defenderName}`.length;
  const needsStacked = combinedLen > 34 || attackerName.length > 18 || defenderName.length > 18;
  return {
    attackerName,
    defenderName,
    needsStacked
  };
}

async function postFlowSeparatorCard(opposed, { sourceStatusHints = [], targetStatusHints = [] } = {}) {
  const attackerName = opposed?.attackerToken?.name ?? towCombatOverlayLocalize("TOWCOMBATOVERLAY.Chat.Attacker", "Attacker");
  const defenderName = opposed?.defenderToken?.name ?? opposed?.defender?.alias ?? towCombatOverlayLocalize("TOWCOMBATOVERLAY.Chat.Defender", "Defender");
  const outcome = opposed?.result?.outcome ?? "resolved";
  const outcomeText = String(outcome);
  const outcomeLabel = outcomeText.charAt(0).toUpperCase() + outcomeText.slice(1).toLowerCase();
  const margin = Number(opposed?.result?.successes ?? 0);
  const marginLabel = `${margin >= 0 ? "+" : ""}${margin}`;
  const damageValue = Number(opposed?.result?.damage?.value ?? 0);
  const damageLabel = Number.isFinite(damageValue) && damageValue > 0 ? String(damageValue) : "0";

  const statusLabels = [];
  const pushStatus = (label) => {
    if (!label) return;
    if (!statusLabels.includes(label)) statusLabels.push(label);
  };

  const damageMessageKey = String(opposed?.result?.damage?.message ?? "");
  if (damageMessageKey.includes("TakesWound")) {
    pushStatus(towCombatOverlayLocalize("TOWCOMBATOVERLAY.Status.Wound", "Wound"));
  }
  if (damageMessageKey.includes("GainsStaggered")) {
    pushStatus(towCombatOverlayLocalize("TOWCOMBATOVERLAY.Status.Staggered", "Staggered"));
  }
  if (damageMessageKey.includes("SuffersFault")) {
    pushStatus(towCombatOverlayLocalize("TOWCOMBATOVERLAY.Status.Fault", "Fault"));
  }

  const effectStatuses = Array.isArray(opposed?.attackerTest?.damageEffects)
    ? opposed.attackerTest.damageEffects.flatMap((effect) => Array.from(effect?.statuses ?? []))
    : [];
  for (const status of effectStatuses) {
    const key = String(status ?? "");
    const label = towCombatOverlayResolveConditionLabel(key);
    pushStatus(label);
  }

  for (const label of targetStatusHints) pushStatus(label);
  const targetStatusLabels = [...statusLabels];
  const sourceStatusLabels = Array.from(new Set((sourceStatusHints ?? []).filter(Boolean)));

  const getOutcomeTone = (value) => {
    if (value === "success") return "success";
    if (value === "failure") return "failure";
    return "neutral";
  };
  const getMarginTone = (value) => {
    if (value > 0) return "success";
    if (value < 0) return "failure";
    return "neutral";
  };
  const getDamageTone = (value) => (value > 0 ? "failure" : "neutral");

  const statusToneFor = (label) => {
    const key = String(label).toLowerCase();
    if (key.includes("wound")) return "wound";
    if (key.includes("stagger")) return "staggered";
    if (key.includes("prone")) return "prone";
    if (key.includes("fault")) return "fault";
    return "default";
  };

  const toStatusItems = (labels) => (labels.length
    ? labels.map((label) => ({ label, tone: statusToneFor(label) }))
    : [{ label: towCombatOverlayLocalize("TOWCOMBATOVERLAY.Chat.None", "None"), tone: "none" }]);

  const namesModel = getFlowNamesModel(attackerName, defenderName);
  const sourceStatusMarkup = (await Promise.all(
    toStatusItems(sourceStatusLabels).map((item) => towCombatOverlayRenderTemplate(
      "modules/tow-combat-overlay/templates/chat/rows/status-chip.hbs",
      item
    ))
  )).join("");
  const targetStatusMarkup = (await Promise.all(
    toStatusItems(targetStatusLabels).map((item) => towCombatOverlayRenderTemplate(
      "modules/tow-combat-overlay/templates/chat/rows/status-chip.hbs",
      item
    ))
  )).join("");
  const content = await towCombatOverlayRenderTemplate("modules/tow-combat-overlay/templates/chat/flow-separator.hbs", {
    attackerName: namesModel.attackerName,
    defenderName: namesModel.defenderName,
    namesStacked: namesModel.needsStacked,
    vsLabel: towCombatOverlayLocalize("TOWCOMBATOVERLAY.Chat.Vs", "vs."),
    sourceLabel: towCombatOverlayLocalize("TOWCOMBATOVERLAY.Chat.Source", "Source"),
    targetLabel: towCombatOverlayLocalize("TOWCOMBATOVERLAY.Chat.Target", "Target"),
    marginLabelText: towCombatOverlayLocalize("TOWCOMBATOVERLAY.Chat.Margin", "Margin"),
    damageLabelText: towCombatOverlayLocalize("TOWCOMBATOVERLAY.Chat.Damage", "Damage"),
    outcomeLabel,
    marginLabel,
    damageLabel,
    outcomeTone: getOutcomeTone(outcome),
    marginTone: getMarginTone(margin),
    damageTone: getDamageTone(damageValue),
    sourceStatusMarkup,
    targetStatusMarkup
  });

  await ChatMessage.create({
    content,
    speaker: { alias: towCombatOverlayLocalize("TOWCOMBATOVERLAY.Chat.CombatFlowAlias", "Combat Flow") }
  });
}

function armAutoApplyDamageForOpposed(opposedMessage, { sourceActor = null, sourceBeforeState = null } = {}) {
  if (!shouldTowCombatOverlayAutoApplyDamage()) {
    return;
  }

  if (!opposedMessage?.id) return;
  const state = game[MODULE_KEY];
  if (state) {
    if (!state.autoApplyArmed) state.autoApplyArmed = new Set();
    if (state.autoApplyArmed.has(opposedMessage.id)) return;
    state.autoApplyArmed.add(opposedMessage.id);
  }

  const cleanup = () => {
    state?.autoApplyArmed?.delete(opposedMessage.id);
    state?.autoDefenceHandled?.delete(opposedMessage.id);
  };

  void (async () => {
    let applying = false;
    let separatorPosted = false;
    const postSeparatorOnce = async (opposed) => {
      if (separatorPosted) return;
      separatorPosted = true;
      const sourceStatusHints = await deriveSourceStatusHints(sourceActor, sourceBeforeState);
      await postFlowSeparatorCard(opposed, { sourceStatusHints, targetStatusHints: [] });
    };

    const started = Date.now();
    while (Date.now() - started < AUTO_APPLY_WAIT_MS) {
      const message = game.messages.get(opposedMessage.id);
      const opposed = message?.system;
      if (!opposed) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      const computed = opposed.result?.computed === true;
      const hasDamage = typeof opposed.result?.damage !== "undefined" && opposed.result?.damage !== null;
      const alreadyApplied = opposed.result?.damage?.applied === true;
      if (!computed) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      if (!hasDamage || alreadyApplied) {
        await postSeparatorOnce(opposed);
        break;
      }

      const defenderActor = ChatMessage.getSpeakerActor(opposed.defender);
      if (!defenderActor?.isOwner || applying) {
        await postSeparatorOnce(opposed);
        break;
      }

      applying = true;
      const beforeState = snapshotActorState(defenderActor);
      const damageValue = Number(opposed.result?.damage?.value ?? 0);
      await applyDamageWithWoundsFallback(defenderActor, damageValue, {
        opposed,
        item: opposed.attackerTest?.item,
        test: opposed.attackerMessage?.system?.test
      });
      const afterState = await captureSettledActorState(defenderActor, beforeState, 700);
      const targetStatusHints = deriveAppliedStatusLabels(beforeState, afterState);
      const sourceStatusHints = await deriveSourceStatusHints(sourceActor, sourceBeforeState);
      if (!separatorPosted) {
        separatorPosted = true;
        await postFlowSeparatorCard(opposed, { sourceStatusHints, targetStatusHints });
      }
      break;
    }
    cleanup();
  })();
}

export function createTowCombatOverlayAutomationCoordinator() {
  return {
    armDefaultStaggerChoiceWound,
    armAutoDefenceForOpposed,
    snapshotActorState
  };
}

export const towCombatOverlayAutomation = createTowCombatOverlayAutomationCoordinator();
