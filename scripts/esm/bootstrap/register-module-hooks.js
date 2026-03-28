import { towCombatOverlayEnsurePromiseClose } from "../combat/attack.js";
import {
  towCombatOverlayArmAutoSubmitDialog
} from "../combat/attack.js";
import { towCombatOverlayApplyChatMessageCensorship } from "../combat/core.js";
import {
  towCombatOverlayDefenceActor,
  towCombatOverlayRollSkill
} from "../combat/defence.js";
import {
  createTowCombatOverlayRollContext,
  getTowCombatOverlayActorRollModifierFields
} from "../combat/roll-modifier.js";
import { registerTowCombatOverlayApi } from "../api/combat-overlay-api.js";
import { getTowCombatOverlayConstants } from "../runtime/module-constants.js";
import { registerTowCombatOverlayActionsRuntimeApi } from "./register-actions-api.js";
import { registerTowCombatOverlayDeadWoundSyncHooks } from "./register-dead-wound-sync-hooks.js";
import { getTowCombatOverlayOverlayApi } from "../api/module-api-registry.js";
import { towCombatOverlayAutomation } from "../overlay/automation/automation.js";
import { withPatchedPanelActionSkillTestContext } from "../overlay/panel/actions/action-test-context.js";
import {
  canTowCombatOverlayUserViewControl,
  getTowCombatOverlayDisplaySetting,
  isTowCombatOverlayDisplaySettingEnabled,
  registerTowCombatOverlayDisplaySettings
} from "./register-settings.js";
import {
  towCombatOverlayEnsureControlPanel,
  towCombatOverlayRemoveControlPanel
} from "../overlay/panel/control-panel-service.js";
import { writeSavedPanelPosition } from "../overlay/panel/shared/state.js";
import {
  towCombatOverlayEnsureTopPanel,
  towCombatOverlayRemoveTopPanel
} from "../overlay/top-panel/top-panel-service.js";
import { TOP_PANEL_ID } from "../overlay/top-panel/top-panel-constants.js";
import {
  applyTopPanelWorldOrderUpdate,
  writeSavedTopPanelPosition
} from "../overlay/top-panel/top-panel-state.js";

function ensureTowCombatOverlayStylesheetLoaded() {
  const explicitHrefs = [
    "modules/tow-combat-overlay/styles/dialog-base.css",
    "modules/tow-combat-overlay/styles/dialog-selectors.css",
    "modules/tow-combat-overlay/styles/chat-cards.css",
    "modules/tow-combat-overlay/styles/status-tooltip.css",
    "modules/tow-combat-overlay/styles/control-panel.css",
    "modules/tow-combat-overlay/styles/top-panel.css"
  ];
  const links = Array.from(document.querySelectorAll("link[rel='stylesheet']"));
  const loadedHrefs = new Set(
    links.map((link) => String(link.getAttribute("href") ?? ""))
  );
  let injected = false;
  for (const explicitHref of explicitHrefs) {
    const alreadyLoaded = Array.from(loadedHrefs).some((href) => href.includes(explicitHref));
    if (alreadyLoaded) continue;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = explicitHref;
    document.head.appendChild(link);
    loadedHrefs.add(explicitHref);
    injected = true;
  }
  return injected;
}

function syncControlPanelButtonsDragDrop(enabled = true) {
  const panelElement = document.getElementById("tow-combat-overlay-control-panel");
  if (!(panelElement instanceof HTMLElement)) return;
  const slotElements = panelElement.querySelectorAll(".tow-combat-overlay-control-panel__slot");
  for (const slotElement of slotElements) {
    if (!(slotElement instanceof HTMLElement)) continue;
    slotElement.draggable = !!enabled;
  }
}

export function syncTowCombatOverlayDisplaySettings(changedSettingKey = "") {
  const { settings } = getTowCombatOverlayConstants();
  const overlayApi = getTowCombatOverlayOverlayApi();
  let didChange = false;
  const normalizedChangedSettingKey = String(changedSettingKey ?? "").trim();
  const shouldRebuildControlPanel = normalizedChangedSettingKey === settings.controlPanelEnableStatuses
    || normalizedChangedSettingKey === settings.controlPanelEnableStatusRow
    || normalizedChangedSettingKey === settings.controlPanelEnableAbilities
    || normalizedChangedSettingKey === settings.controlPanelEnableWounds
    || normalizedChangedSettingKey === settings.controlPanelEnableTemporaryEffects
    || normalizedChangedSettingKey === settings.controlPanelEnablePortrait
    || normalizedChangedSettingKey === settings.controlPanelEnableName
    || normalizedChangedSettingKey === settings.controlPanelEnableStats
    || normalizedChangedSettingKey === settings.controlPanelEnableImage
    || normalizedChangedSettingKey === settings.controlPanelEnableGridButtons
    || normalizedChangedSettingKey === settings.controlPanelEnableActionButtons
    || normalizedChangedSettingKey === settings.controlPanelEnableWeaponsButtons
    || normalizedChangedSettingKey === settings.controlPanelEnableMagicButtons
    || normalizedChangedSettingKey === settings.controlPanelEnableItemsRarity
    || normalizedChangedSettingKey === settings.controlPanelEnableTooltips
    || normalizedChangedSettingKey === settings.controlPanelShowTooltipClickBehaviorText
    || normalizedChangedSettingKey === settings.controlPanelEnableNameTooltip
    || normalizedChangedSettingKey === settings.controlPanelEnableStatsTooltip
    || normalizedChangedSettingKey === settings.controlPanelEnableStatusesTooltip
    || normalizedChangedSettingKey === settings.controlPanelEnableAbilitiesTooltip
    || normalizedChangedSettingKey === settings.controlPanelEnableWoundsTooltip
    || normalizedChangedSettingKey === settings.controlPanelEnableTemporaryEffectsTooltip
    || normalizedChangedSettingKey === settings.controlPanelEnableButtonsTooltip
    || normalizedChangedSettingKey === settings.controlPanelShowDeadPortraitStatus
    || normalizedChangedSettingKey === settings.controlPanelPositionMode;
  if (normalizedChangedSettingKey === settings.controlPanelPositionMode) {
    const positionMode = String(getTowCombatOverlayDisplaySetting(settings.controlPanelPositionMode, "free")).trim();
    if (positionMode === "free") {
      const panelElement = document.getElementById("tow-combat-overlay-control-panel");
      if (panelElement instanceof HTMLElement) writeSavedPanelPosition(panelElement);
    }
  }
  if (normalizedChangedSettingKey === settings.tokensPanelPositionMode) {
    const positionMode = String(getTowCombatOverlayDisplaySetting(settings.tokensPanelPositionMode, "free")).trim();
    if (positionMode === "free") {
      const panelElement = document.getElementById(TOP_PANEL_ID);
      if (panelElement instanceof HTMLElement) writeSavedTopPanelPosition(panelElement);
    }
  }

  const wantsEnabled = isTowCombatOverlayDisplaySettingEnabled(settings.enableOverlay, true)
    && canTowCombatOverlayUserViewControl(settings.tokenLayoutMinimumRole, "all");
  const wantsControlPanel = isTowCombatOverlayDisplaySettingEnabled(settings.enableControlPanel, true)
    && canTowCombatOverlayUserViewControl(settings.controlPanelMinimumRole, "all");
  const wantsTopPanel = isTowCombatOverlayDisplaySettingEnabled(settings.enableTopPanel, true)
    && canTowCombatOverlayUserViewControl(settings.tokensPanelMinimumRole, "all");

  if (!overlayApi) {
    if (!wantsControlPanel) towCombatOverlayRemoveControlPanel();
    if (wantsTopPanel) {
      void towCombatOverlayEnsureTopPanel().catch((error) => {
        console.error("[tow-combat-overlay] Failed to initialize top panel.", error);
      });
    } else {
      towCombatOverlayRemoveTopPanel();
    }
    return false;
  }
  const isEnabled = typeof overlayApi.isEnabled === "function"
    ? !!overlayApi.isEnabled()
    : false;

  if (wantsEnabled && !isEnabled && typeof overlayApi.enable === "function") {
    overlayApi.enable();
    didChange = true;
  }

  if (!wantsEnabled && isEnabled && typeof overlayApi.disable === "function") {
    overlayApi.disable();
    didChange = true;
  }
  if (wantsEnabled && typeof overlayApi.refreshAll === "function") {
    void Promise.resolve(overlayApi.refreshAll()).catch((error) => {
      console.error("[tow-combat-overlay] Failed to refresh token overlays after settings update.", error);
    });
  }

  if (wantsControlPanel) {
    if (shouldRebuildControlPanel) towCombatOverlayRemoveControlPanel();
    void towCombatOverlayEnsureControlPanel()
      .then(() => {
        if (shouldRebuildControlPanel || normalizedChangedSettingKey === settings.controlPanelPositionMode) {
          requestTowCombatOverlayViewportSync();
        }
      })
      .catch((error) => {
        console.error("[tow-combat-overlay] Failed to initialize control panel.", error);
      });
    if (normalizedChangedSettingKey === settings.controlPanelEnableButtonsDragDrop) {
      syncControlPanelButtonsDragDrop(
        isTowCombatOverlayDisplaySettingEnabled(settings.controlPanelEnableButtonsDragDrop, false)
      );
    }
  } else {
    towCombatOverlayRemoveControlPanel();
  }

  if (wantsTopPanel) {
    void towCombatOverlayEnsureTopPanel().catch((error) => {
      console.error("[tow-combat-overlay] Failed to initialize top panel.", error);
    });
  } else {
    towCombatOverlayRemoveTopPanel();
  }

  return didChange;
}

function registerTowCombatOverlayRuntimeApis() {
  registerTowCombatOverlayActionsRuntimeApi();
  registerTowCombatOverlayApi();
}

function requestTowCombatOverlayViewportSync() {
  const stateKey = "__towCombatOverlayViewportSyncState";
  if (!game) {
    window.dispatchEvent(new Event("resize"));
    return;
  }
  if (!game[stateKey]) {
    game[stateKey] = {
      queued: false,
      delayedTimerId: null
    };
  }
  const syncState = game[stateKey];
  if (syncState.queued === true) return;
  syncState.queued = true;

  window.requestAnimationFrame(() => {
    syncState.queued = false;
    window.dispatchEvent(new Event("resize"));
    if (syncState.delayedTimerId !== null) {
      window.clearTimeout(syncState.delayedTimerId);
    }
    syncState.delayedTimerId = window.setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
      syncState.delayedTimerId = null;
    }, 220);
  });
}

function ensureTowCombatOverlaySidebarObserver() {
  const stateKey = "__towCombatOverlaySidebarObserver";
  if (!game) return;
  const sidebarElement = document.getElementById("sidebar");
  if (!(sidebarElement instanceof HTMLElement)) return;

  const existing = game[stateKey];
  if (existing?.observer instanceof MutationObserver && existing.element === sidebarElement) {
    return;
  }
  if (existing?.observer instanceof MutationObserver) {
    existing.observer.disconnect();
  }

  const observer = new MutationObserver((mutations) => {
    const shouldSync = mutations.some((mutation) => mutation.type === "attributes" && mutation.attributeName === "class");
    if (shouldSync) requestTowCombatOverlayViewportSync();
  });

  observer.observe(sidebarElement, {
    attributes: true,
    attributeFilter: ["class"]
  });
  game[stateKey] = {
    observer,
    element: sidebarElement
  };
}

function resolveCanvasTokenById(tokenId) {
  const id = String(tokenId ?? "").trim();
  if (!id) return null;
  const tokenByScene = canvas?.scene?.tokens?.get?.(id)?.object ?? null;
  if (tokenByScene) return tokenByScene;
  const placeables = Array.isArray(canvas?.tokens?.placeables) ? canvas.tokens.placeables : [];
  return placeables.find((token) => String(token?.id ?? "") === id) ?? null;
}

async function withTemporaryCurrentUserTargets(targetToken, callback) {
  if (typeof callback !== "function") return callback?.();
  const targetId = String(targetToken?.id ?? "").trim();
  if (!targetId) return callback();
  const currentUser = game?.user;
  if (!currentUser) return callback();

  const previousTargetIds = Array.from(currentUser.targets ?? [])
    .map((token) => String(token?.id ?? "").trim())
    .filter(Boolean);
  const placeables = Array.isArray(canvas?.tokens?.placeables) ? canvas.tokens.placeables : [];

  const setByToggle = (ids) => {
    const idSet = new Set((Array.isArray(ids) ? ids : []).map((id) => String(id ?? "").trim()).filter(Boolean));
    let toggled = false;
    for (const token of placeables) {
      if (typeof token?.setTarget !== "function") continue;
      toggled = true;
      token.setTarget(idSet.has(String(token.id ?? "")), {
        releaseOthers: false,
        groupSelection: false,
        user: currentUser
      });
    }
    return toggled;
  };

  const usedToggle = setByToggle([targetId]);
  if (!usedToggle) {
    const updateTargets = currentUser.updateTokenTargets;
    if (typeof updateTargets === "function") {
      await Promise.resolve(updateTargets.call(currentUser, [targetId]));
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 0));
  try {
    return await callback();
  } finally {
    if (!setByToggle(previousTargetIds)) {
      const updateTargets = currentUser.updateTokenTargets;
      if (typeof updateTargets === "function") {
        await Promise.resolve(updateTargets.call(currentUser, previousTargetIds));
      }
    }
  }
}

function armAutoSubmitActionSkillDialog(actor, skill) {
  const skillKey = String(skill ?? "").trim();
  if (!actor || !skillKey) return;
  towCombatOverlayArmAutoSubmitDialog({
    hookName: "renderTestDialog",
    matches: (app) => app?.actor?.id === actor.id && app?.skill === skillKey,
    submitErrorMessage: "TestDialog.submit() is unavailable."
  });
}

function armAutoPickFirstHelpSkillDialog(actor) {
  if (!actor) return;
  towCombatOverlayArmAutoSubmitDialog({
    hookName: "renderItemDialog",
    matches: (app) => {
      const text = String(app?.options?.text ?? "").trim().toLowerCase();
      const title = String(app?.options?.window?.title ?? app?.title ?? "").trim().toLowerCase();
      return text.includes("choose skill") || title.includes("help");
    },
    submitErrorMessage: "ItemDialog.submit() is unavailable.",
    beforeSubmit: async (app) => {
      if (!app) return;
      const firstChoice = app?.items?.[0] ?? null;
      const firstSkill = String(firstChoice?.id ?? "").trim();
      app.chosen = [0];
      if (firstSkill) armAutoSubmitActionSkillDialog(actor, firstSkill);
    }
  });
}

function armApplyRollModifiersToNextTestDialog(actor, { matches = null, timeoutMs = 20000 } = {}) {
  if (!actor) return;
  const rollFields = getTowCombatOverlayActorRollModifierFields(actor);
  const hookName = "renderTestDialog";
  let hookId = null;
  let timeoutId = null;

  const cleanup = () => {
    if (hookId !== null) Hooks.off(hookName, hookId);
    hookId = null;
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = null;
  };

  hookId = Hooks.on(hookName, (app) => {
    if (app?.actor?.id !== actor.id) return;
    if (typeof matches === "function" && !matches(app)) return;
    cleanup();
    if (!app || app._towCombatOverlayRollModsInjected) return;
    app._towCombatOverlayRollModsInjected = true;
    app.userEntry ??= {};
    app.fields ??= {};
    for (const [key, value] of Object.entries(rollFields)) {
      const numericValue = Number(value ?? 0);
      app.userEntry[key] = numericValue;
      app.fields[key] = numericValue;
    }
    if (typeof app.render === "function") app.render(true);
  });

  timeoutId = setTimeout(cleanup, Math.max(250, Number(timeoutMs) || 0));
}

async function runDefaultPanelActorAction(actor, actionKey) {
  const key = String(actionKey ?? "").trim();
  if (!actor || !key) return;
  armApplyRollModifiersToNextTestDialog(actor);
  const runWithActionRollContext = async (callback) => withPatchedPanelActionSkillTestContext(
    actor,
    callback,
    { createRollContext: createTowCombatOverlayRollContext }
  );

  if (typeof actor?.system?.doAction === "function") {
    await runWithActionRollContext(() => actor.system.doAction(key));
    return;
  }

  const actionData = game?.oldworld?.config?.actions?.[key] ?? null;
  if (actionData?.script && typeof actionData.script === "function") {
    await runWithActionRollContext(() => actionData.script.call(actionData, actor));
    return;
  }

  const actionUse = game?.oldworld?.config?.rollClasses?.ActionUse;
  if (typeof actionUse?.fromAction === "function") {
    await runWithActionRollContext(() => actionUse.fromAction(key, actor));
  }
}

function resolveTowCombatOverlayMessageRefId(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "object") return "";

  const directId = String(value.id ?? value._id ?? "").trim();
  if (directId) return directId;

  const nestedMessage = value.message;
  if (typeof nestedMessage === "string") return nestedMessage.trim();
  if (nestedMessage && typeof nestedMessage === "object") {
    const nestedId = String(nestedMessage.id ?? nestedMessage._id ?? "").trim();
    if (nestedId) return nestedId;
  }

  const messageId = String(value.messageId ?? value.chatMessageId ?? "").trim();
  if (messageId) return messageId;
  return "";
}

function resolveOpposedMessageForRelay({ targetToken = null, opposedMessageId = "", attackerMessageId = "" } = {}) {
  const explicitOpposedId = String(opposedMessageId ?? "").trim();
  if (explicitOpposedId) {
    const explicit = game?.messages?.get?.(explicitOpposedId) ?? null;
    if (explicit?.type === "opposed") return explicit;
  }

  const targetOpposedId = String(targetToken?.actor?.system?.opposed?.id ?? "").trim();
  if (targetOpposedId) {
    const byTargetOpposed = game?.messages?.get?.(targetOpposedId) ?? null;
    if (byTargetOpposed?.type === "opposed") return byTargetOpposed;
  }

  const attackerRef = String(attackerMessageId ?? "").trim();
  let latestByTarget = null;
  const messages = Array.from(game?.messages ?? []);
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.type !== "opposed") continue;
    const defenderTokenId = String(message?.system?.defender?.token ?? "").trim();
    if (targetToken && defenderTokenId !== String(targetToken.id ?? "")) continue;
    if (!latestByTarget) latestByTarget = message;
    if (!attackerRef) continue;
    const attackerMessage = resolveTowCombatOverlayMessageRefId(message?.system?.attackerMessage);
    if (attackerMessage && attackerMessage === attackerRef) return message;
  }
  return latestByTarget;
}

function parseTowDatasetFromTag(tagHtml) {
  const dataset = {};
  const attrMatches = Array.from(String(tagHtml ?? "").matchAll(/\bdata-([a-z0-9_-]+)\s*=\s*["']([^"']*)["']/gi));
  for (const match of attrMatches) {
    const rawKey = String(match?.[1] ?? "").trim();
    if (!rawKey) continue;
    const camelKey = rawKey.replace(/-([a-z0-9])/gi, (_m, char) => String(char ?? "").toUpperCase());
    dataset[camelKey] = String(match?.[2] ?? "");
  }
  return dataset;
}

function getTowMessageAutoApplyActions(message) {
  const content = String(message?.content ?? "");
  const buttonMatches = Array.from(content.matchAll(/<(button|a)\b[^>]*>/gi));
  const actionsFromContent = buttonMatches
    .map((match) => {
      const tagHtml = String(match?.[0] ?? "");
      const dataset = parseTowDatasetFromTag(tagHtml);
      const action = String(dataset?.action ?? "").trim();
      if (!action || !action.toLowerCase().startsWith("apply")) return null;
      return { action, dataset };
    })
    .filter(Boolean);

  const handlers = message?.system?.constructor?.actions ?? message?.system?.actions ?? {};
  const availableHandlerNames = new Set(
    Object.keys(handlers).map((name) => String(name ?? "").trim()).filter(Boolean)
  );

  const unique = [];
  const seen = new Set();
  for (const entry of actionsFromContent) {
    const action = String(entry?.action ?? "").trim();
    if (!availableHandlerNames.has(action)) continue;
    const key = JSON.stringify({ action, dataset: entry?.dataset ?? {} });
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ action, dataset: entry?.dataset ?? {} });
  }

  const priority = new Map([
    ["applydamage", 1],
    ["applytargeteffect", 2]
  ]);
  return unique.sort((a, b) => {
    const left = priority.get(String(a?.action ?? "").toLowerCase()) ?? 100;
    const right = priority.get(String(b?.action ?? "").toLowerCase()) ?? 100;
    if (left !== right) return left - right;
    return String(a?.action ?? "").localeCompare(String(b?.action ?? ""));
  });
}

async function invokeTowMessageActionByName(message, action, dataset = {}) {
  const actionName = String(action ?? "").trim();
  if (!message || !actionName) return false;
  const system = message.system;
  const handlers = system?.constructor?.actions ?? system?.actions ?? {};
  const handler = handlers?.[actionName];
  if (typeof handler !== "function") return false;
  const syntheticTarget = { dataset: { ...dataset, action: actionName } };
  const syntheticEvent = {
    preventDefault: () => {},
    stopPropagation: () => {},
    stopImmediatePropagation: () => {},
    currentTarget: syntheticTarget,
    target: syntheticTarget
  };

  const resolveActorFromReference = (reference) => {
    const value = String(reference ?? "").trim();
    if (!value) return null;
    const actorById = game?.actors?.get?.(value) ?? null;
    if (actorById) return actorById;
    const tokenById = canvas?.tokens?.get?.(value)
      ?? canvas?.tokens?.placeables?.find?.((token) => String(token?.id ?? "").trim() === value)
      ?? null;
    return tokenById?.actor ?? tokenById?.document?.actor ?? null;
  };
  const collectMessageTargetActors = (rawTargets) => {
    const actors = [];
    const add = (actor) => {
      if (!actor) return;
      if (actors.some((entry) => entry === actor || String(entry?.uuid ?? "") === String(actor?.uuid ?? ""))) return;
      actors.push(actor);
    };
    if (Array.isArray(rawTargets)) {
      for (const entry of rawTargets) {
        add(resolveActorFromReference(
          entry?.actor
          ?? entry?.actorId
          ?? entry?.token
          ?? entry?.tokenId
          ?? entry?.id
          ?? entry
        ));
      }
      return actors;
    }
    if (rawTargets instanceof Set) {
      for (const entry of rawTargets) add(resolveActorFromReference(entry?.id ?? entry));
      return actors;
    }
    if (rawTargets && typeof rawTargets === "object") {
      for (const [key, value] of Object.entries(rawTargets)) {
        add(resolveActorFromReference(
          value?.actor
          ?? value?.actorId
          ?? value?.token
          ?? value?.tokenId
          ?? value?.id
          ?? key
        ));
      }
    }
    return actors;
  };
  const affectedActors = [];
  const addAffected = (actor) => {
    if (!actor) return;
    if (affectedActors.some((entry) => entry === actor || String(entry?.uuid ?? "") === String(actor?.uuid ?? ""))) return;
    affectedActors.push(actor);
  };
  addAffected(resolveActorFromReference(
    message?.speaker?.actor
    ?? message?.system?.test?.context?.actor
    ?? message?.system?.context?.actor
  ));
  const targetCandidates = [
    message?.system?.test?.context?.targets,
    message?.system?.context?.targets,
    message?.system?.test?.targets,
    message?.system?.targets
  ];
  for (const rawTargets of targetCandidates) {
    for (const actor of collectMessageTargetActors(rawTargets)) addAffected(actor);
  }
  for (const [key, value] of Object.entries(dataset ?? {})) {
    const lowerKey = String(key ?? "").trim().toLowerCase();
    if (!lowerKey || lowerKey === "action") continue;
    if (!/(actor|token|target)/i.test(lowerKey)) continue;
    addAffected(resolveActorFromReference(value));
  }
  for (const token of Array.from(game?.user?.targets ?? [])) {
    addAffected(token?.actor ?? token?.document?.actor ?? null);
  }
  const affectedActorRefs = new Set();
  for (const actor of affectedActors) {
    const actorId = String(actor?.id ?? "").trim();
    const actorUuid = String(actor?.uuid ?? "").trim();
    if (actorId) affectedActorRefs.add(actorId);
    if (actorUuid) affectedActorRefs.add(actorUuid);
  }

  const restoreAutoSubmitTestDialog = towCombatOverlayArmAutoSubmitDialog({
    hookName: "renderTestDialog",
    matches: (app) => {
      const appActorId = String(app?.actor?.id ?? "").trim();
      const appActorUuid = String(app?.actor?.uuid ?? app?.context?.actor ?? "").trim();
      if (!affectedActorRefs.size) return true;
      return (appActorId && affectedActorRefs.has(appActorId))
        || (appActorUuid && affectedActorRefs.has(appActorUuid));
    },
    submitErrorMessage: "TestDialog.submit() is unavailable.",
    timeoutMs: 2500
  });
  const restoreAutoSubmitItemDialog = towCombatOverlayArmAutoSubmitDialog({
    hookName: "renderItemDialog",
    matches: (app) => {
      const text = String(app?.options?.text ?? "").trim().toLowerCase();
      const title = String(app?.options?.window?.title ?? app?.title ?? "").trim().toLowerCase();
      return text.includes("select") || text.includes("choose") || title.includes("select") || title.includes("choose");
    },
    submitErrorMessage: "ItemDialog.submit() is unavailable.",
    beforeSubmit: async (app) => {
      if (!app) return;
      const itemCount = Number(app?.items?.length ?? 0);
      if (!Number.isFinite(itemCount) || itemCount <= 0) return;
      app.chosen = [0];
    },
    timeoutMs: 2500
  });
  try {
    await handler.call(system, syntheticEvent, syntheticTarget);
    return true;
  } catch (_error) {
    return false;
  } finally {
    if (typeof restoreAutoSubmitTestDialog === "function") restoreAutoSubmitTestDialog();
    if (typeof restoreAutoSubmitItemDialog === "function") restoreAutoSubmitItemDialog();
  }
}

async function waitAndInvokeTowAutoApplyActionsInMessage(messageId, { attempts = 16, intervalMs = 80 } = {}) {
  const id = String(messageId ?? "").trim();
  if (!id) return false;
  const getActionKey = (entry) => JSON.stringify({
    action: String(entry?.action ?? "").trim(),
    dataset: entry?.dataset ?? {}
  });
  const total = Math.max(1, Math.trunc(Number(attempts) || 1));
  const waitMs = Math.max(10, Math.trunc(Number(intervalMs) || 0));
  const executedActionKeys = new Set();
  let anyInvoked = false;
  let settledNoActionsChecks = 0;
  for (let i = 0; i < total; i += 1) {
    const messageBefore = game?.messages?.get?.(id) ?? null;
    const actionsBefore = getTowMessageAutoApplyActions(messageBefore);
    const hadActionsBefore = actionsBefore.length > 0;
    const actions = actionsBefore.filter((entry) => !executedActionKeys.has(getActionKey(entry)));
    let invoked = false;
    for (const { action, dataset } of actions) {
      const done = await invokeTowMessageActionByName(messageBefore, action, dataset);
      if (done) {
        invoked = true;
        executedActionKeys.add(getActionKey({ action, dataset }));
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    anyInvoked = anyInvoked || invoked;
    const messageAfter = game?.messages?.get?.(id) ?? null;
    const actionsAfter = getTowMessageAutoApplyActions(messageAfter);
    const hasPendingActionsAfter = actionsAfter.some((entry) => !executedActionKeys.has(getActionKey(entry)));
    if (!hasPendingActionsAfter && (invoked || hadActionsBefore || anyInvoked)) {
      settledNoActionsChecks += 1;
      if (settledNoActionsChecks >= 2) return true;
    } else {
      settledNoActionsChecks = 0;
    }
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  return anyInvoked;
}

async function handleTowCombatOverlayActionRelayPayload(payload) {
  const actionType = String(payload?.actionType ?? "").trim().toLowerCase();
  if (!actionType) return false;
  const sourceToken = resolveCanvasTokenById(payload?.sourceTokenId);
  const targetToken = resolveCanvasTokenById(payload?.targetTokenId);

  if (actionType === "spellautoapply") {
    const messageId = String(payload?.messageId ?? "").trim();
    if (targetToken) {
      await withTemporaryCurrentUserTargets(targetToken, async () => {
        await waitAndInvokeTowAutoApplyActionsInMessage(messageId, { attempts: 20, intervalMs: 100 });
      });
      return true;
    }
    await waitAndInvokeTowAutoApplyActionsInMessage(messageId, { attempts: 20, intervalMs: 100 });
    return true;
  }

  if (!sourceToken?.actor || !targetToken) return false;

  if (actionType === "help") {
    if (payload?.autoRoll !== false) armAutoPickFirstHelpSkillDialog(sourceToken.actor);
    await withTemporaryCurrentUserTargets(targetToken, async () => {
      await runDefaultPanelActorAction(sourceToken.actor, "help");
    });
    return true;
  }

  if (actionType === "defence") {
    const opposedMessageId = String(payload?.opposedMessageId ?? "").trim();
    const attackerMessageId = String(payload?.attackerMessageId ?? "").trim();
    const preferredSkill = String(payload?.preferredSkill ?? "").trim().toLowerCase();
    const sourceBeforeState = towCombatOverlayAutomation.snapshotActorState(sourceToken.actor);
    const started = Date.now();
    let opposedMessage = null;
    while ((Date.now() - started) < 5000) {
      opposedMessage = resolveOpposedMessageForRelay({
        targetToken,
        opposedMessageId,
        attackerMessageId
      });
      if (opposedMessage) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (preferredSkill) await towCombatOverlayRollSkill(targetToken.actor, preferredSkill, { autoRoll: true });
    else await towCombatOverlayDefenceActor(targetToken.actor, { manual: false });
    if (!opposedMessage) {
      const afterDefenceStarted = Date.now();
      while ((Date.now() - afterDefenceStarted) < 3000) {
        opposedMessage = resolveOpposedMessageForRelay({
          targetToken,
          opposedMessageId,
          attackerMessageId
        });
        if (opposedMessage) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    if (opposedMessage) {
      towCombatOverlayAutomation.armAutoApplyDamageForOpposed(opposedMessage, {
        sourceActor: sourceToken.actor,
        sourceBeforeState
      });
    }
    return true;
  }

  return false;
}

function ensureTowCombatOverlayActionRelayFlagHook() {
  const { moduleId, flags } = getTowCombatOverlayConstants();
  const relayFlagKey = String(flags?.actionRelayRequest ?? "actionRelayRequest");
  const stateKey = "__towCombatOverlayActionRelayFlagHookState";
  if (!game) return null;
  const existingState = game[stateKey];
  if (existingState && typeof existingState === "object") return existingState;

  const processedByRequester = new Map();

  const buildFingerprint = (payload, fallbackRequesterId = "") => JSON.stringify({
    requesterId: String(payload?.requesterId ?? fallbackRequesterId).trim(),
    actionType: String(payload?.actionType ?? "").trim(),
    sourceTokenId: String(payload?.sourceTokenId ?? "").trim(),
    targetTokenId: String(payload?.targetTokenId ?? "").trim(),
    messageId: String(payload?.messageId ?? "").trim(),
    attackerMessageId: String(payload?.attackerMessageId ?? "").trim(),
    opposedMessageId: String(payload?.opposedMessageId ?? "").trim(),
    preferredSkill: String(payload?.preferredSkill ?? "").trim(),
    autoRoll: payload?.autoRoll === false ? false : true,
    timestamp: Number(payload?.timestamp ?? 0)
  });

  const didUpdateTouchRelayFlag = (changed) => {
    const moduleFlags = changed?.flags?.[moduleId];
    if (moduleFlags && Object.prototype.hasOwnProperty.call(moduleFlags, relayFlagKey)) return true;
    if (!foundry?.utils?.flattenObject || !changed || typeof changed !== "object") return false;
    const flattened = foundry.utils.flattenObject(changed);
    const rootPath = `flags.${moduleId}.${relayFlagKey}`;
    return Object.keys(flattened).some((key) => key === rootPath || key.startsWith(`${rootPath}.`) || key.startsWith(`${rootPath}.-=`));
  };

  const handleRelayPayload = async (payload, requestUser = null) => {
    if (!payload || typeof payload !== "object") return false;
    const sourceUserId = String(requestUser?.id ?? payload?.requesterId ?? "").trim();
    if (!sourceUserId) return false;
    const fingerprint = buildFingerprint(payload, sourceUserId);
    if (processedByRequester.get(sourceUserId) === fingerprint) return false;
    processedByRequester.set(sourceUserId, fingerprint);
    const didApply = await handleTowCombatOverlayActionRelayPayload(payload);
    if (requestUser?.unsetFlag) {
      void Promise.resolve(requestUser.unsetFlag(moduleId, relayFlagKey)).catch(() => {});
    }
    return didApply;
  };

  const hookId = Hooks.on("updateUser", (user, changed) => {
    if (game?.user?.isGM !== true) return;
    if (!didUpdateTouchRelayFlag(changed)) return;
    const payload = user?.getFlag?.(moduleId, relayFlagKey);
    if (!payload || typeof payload !== "object") return;
    void Promise.resolve(handleRelayPayload(payload, user)).catch(() => {});
  });

  const relayState = {
    hookId,
    handleRelayPayload,
    buildFingerprint
  };
  game[stateKey] = relayState;
  return relayState;
}

function ensureTowCombatOverlayTopPanelOrderRelayHook() {
  const { moduleId, flags } = getTowCombatOverlayConstants();
  const requestFlagKey = String(flags?.topPanelOrderRequest ?? "topPanelOrderRequest");
  const stateKey = "__towCombatOverlayTopPanelOrderRelayHookId";
  if (!game) return null;
  const existingState = game[stateKey];
  if (existingState && typeof existingState === "object") return existingState;

  const processedRequestFingerprintByUserId = new Map();

  const buildRequestFingerprint = (payload, fallbackRequesterId = "") => {
    const sceneId = String(payload?.sceneId ?? "").trim();
    const tokenIds = Array.isArray(payload?.tokenIds) ? payload.tokenIds : [];
    const timestampValue = Number(payload?.timestamp);
    return JSON.stringify({
      sceneId,
      tokenIds,
      requesterId: String(payload?.requesterId ?? fallbackRequesterId).trim(),
      timestamp: Number.isFinite(timestampValue) ? timestampValue : 0
    });
  };

  const handleOrderRequestPayload = async (payload, requestUser = null) => {
    if (!payload || typeof payload !== "object") return false;
    const sourceUserId = String(requestUser?.id ?? payload?.requesterId ?? "").trim();
    if (!sourceUserId) return false;
    const sceneId = String(payload.sceneId ?? "").trim();
    if (!sceneId) return false;
    const tokenIds = Array.isArray(payload.tokenIds) ? payload.tokenIds : [];
    const fingerprint = buildRequestFingerprint(payload, sourceUserId);
    if (processedRequestFingerprintByUserId.get(sourceUserId) === fingerprint) return false;
    processedRequestFingerprintByUserId.set(sourceUserId, fingerprint);
    const didApply = await applyTopPanelWorldOrderUpdate(sceneId, tokenIds);
    if (requestUser?.unsetFlag) {
      void Promise.resolve(requestUser.unsetFlag(moduleId, requestFlagKey)).catch(() => {});
    }
    return didApply;
  };

  const didUpdateTouchTopPanelRequest = (changed) => {
    const moduleFlags = changed?.flags?.[moduleId];
    if (moduleFlags && Object.prototype.hasOwnProperty.call(moduleFlags, requestFlagKey)) return true;
    if (!foundry?.utils?.flattenObject || !changed || typeof changed !== "object") return false;
    const flattened = foundry.utils.flattenObject(changed);
    const rootPath = `flags.${moduleId}.${requestFlagKey}`;
    return Object.keys(flattened).some((key) => key === rootPath || key.startsWith(`${rootPath}.`) || key.startsWith(`${rootPath}.-=`));
  };

  const hookId = Hooks.on("updateUser", (user, changed) => {
    if (game?.user?.isGM !== true) return;
    if (!didUpdateTouchTopPanelRequest(changed)) return;
    const payload = user?.getFlag?.(moduleId, requestFlagKey);
    if (!payload || typeof payload !== "object") return;
    void Promise.resolve(handleOrderRequestPayload(payload, user)).catch(() => {});
  });
  const relayState = {
    hookId,
    handleOrderRequestPayload
  };
  game[stateKey] = relayState;
  return relayState;
}

function ensureTowCombatOverlayTopPanelOrderSocketRelay() {
  const { moduleId, sockets } = getTowCombatOverlayConstants();
  const requestSocketType = String(sockets?.topPanelOrderRequest ?? "topPanelOrderRequest");
  const actionRelaySocketType = String(sockets?.actionRelayRequest ?? "actionRelayRequest");
  const stateKey = "__towCombatOverlayTopPanelOrderSocketRelayBound";
  if (!game || game[stateKey] === true) return;
  const socket = game?.socket;
  if (!socket?.on) return;
  const relayState = ensureTowCombatOverlayTopPanelOrderRelayHook();
  const handleOrderRequestPayload = relayState?.handleOrderRequestPayload;
  if (typeof handleOrderRequestPayload !== "function") return;
  const actionRelayState = ensureTowCombatOverlayActionRelayFlagHook();
  const handleRelayPayload = actionRelayState?.handleRelayPayload;

  socket.on(`module.${moduleId}`, (message) => {
    if (game?.user?.isGM !== true) return;
    if (!message || typeof message !== "object") return;
    const type = String(message.type ?? "").trim();
    const payload = message.payload;
    if (type === requestSocketType) {
      const requesterId = String(payload?.requesterId ?? "").trim();
      const requestUser = requesterId ? game?.users?.get?.(requesterId) : null;
      void Promise.resolve(handleOrderRequestPayload(payload, requestUser ?? null)).catch(() => {});
      return;
    }
    if (type === actionRelaySocketType) {
      if (typeof handleRelayPayload !== "function") return;
      const requesterId = String(payload?.requesterId ?? "").trim();
      const requestUser = requesterId ? game?.users?.get?.(requesterId) : null;
      void Promise.resolve(handleRelayPayload(payload, requestUser ?? null)).catch((error) => {
        console.error("[tow-combat-overlay] Failed to handle action relay payload.", error);
      });
    }
  });

  game[stateKey] = true;
}

async function runTowCombatOverlayTopPanelOrderFlagSweep() {
  const { moduleId, flags } = getTowCombatOverlayConstants();
  const requestFlagKey = String(flags?.topPanelOrderRequest ?? "topPanelOrderRequest");
  if (!game || game?.user?.isGM !== true) return;
  const relayState = ensureTowCombatOverlayTopPanelOrderRelayHook();
  const handleOrderRequestPayload = relayState?.handleOrderRequestPayload;
  if (typeof handleOrderRequestPayload !== "function") return;

  const users = game?.users ? Array.from(game.users) : [];
  for (const user of users) {
    const payload = user?.getFlag?.(moduleId, requestFlagKey);
    if (!payload || typeof payload !== "object") continue;
    await handleOrderRequestPayload(payload, user);
  }
}

function ensureTowCombatOverlayTopPanelOrderBackoffSweeps() {
  const stateKey = "__towCombatOverlayTopPanelOrderBackoffSweepState";
  if (!game) return;
  if (game[stateKey] === true) return;
  game[stateKey] = true;
  const delays = [0, 2000, 10000];
  for (const delayMs of delays) {
    window.setTimeout(() => {
      void runTowCombatOverlayTopPanelOrderFlagSweep().catch(() => {});
    }, delayMs);
  }
}

export function registerTowCombatOverlayModuleHooks() {
  Hooks.once("init", () => {
    ensureTowCombatOverlayStylesheetLoaded();
    registerTowCombatOverlayDisplaySettings({
      onDisplaySettingsChanged: syncTowCombatOverlayDisplaySettings
    });
    registerTowCombatOverlayRuntimeApis();
  });

  Hooks.on("renderAbilityAttackDialog", (app) => {
    towCombatOverlayEnsurePromiseClose(app);
  });

  Hooks.on("renderTestDialog", (app) => {
    towCombatOverlayEnsurePromiseClose(app);
  });

  Hooks.on("renderWeaponDialog", (app) => {
    towCombatOverlayEnsurePromiseClose(app);
  });

  Hooks.on("renderChatMessage", (message, html) => {
    towCombatOverlayApplyChatMessageCensorship(message, html);
  });

  Hooks.on("collapseSidebar", () => {
    requestTowCombatOverlayViewportSync();
  });

  Hooks.on("renderSidebar", () => {
    ensureTowCombatOverlaySidebarObserver();
  });

  Hooks.once("ready", () => {
    ensureTowCombatOverlayStylesheetLoaded();
    registerTowCombatOverlayDeadWoundSyncHooks();
    ensureTowCombatOverlaySidebarObserver();
    ensureTowCombatOverlayTopPanelOrderSocketRelay();
    ensureTowCombatOverlayTopPanelOrderRelayHook();
    ensureTowCombatOverlayActionRelayFlagHook();
    ensureTowCombatOverlayTopPanelOrderBackoffSweeps();
    syncTowCombatOverlayDisplaySettings();
  });
}
