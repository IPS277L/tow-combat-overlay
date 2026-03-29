import { towCombatOverlayEnsurePromiseClose } from "../combat/attack.js";
import { towCombatOverlayApplyChatMessageCensorship } from "../combat/core.js";
import { registerTowCombatOverlayApi } from "../api/combat-overlay-api.js";
import { registerTowCombatOverlayActionsRuntimeApi } from "./register-actions-api.js";
import { registerTowCombatOverlayDeadWoundSyncHooks } from "./register-dead-wound-sync-hooks.js";
import { registerTowCombatOverlayDisplaySettings } from "./register-settings.js";
import { towCombatOverlayApplyTableVisibilityRelay } from "../chat/table-visibility-relay.js";
import {
  ensureTowCombatOverlayStylesheetLoaded,
  ensureTowCombatOverlaySidebarObserver,
  requestTowCombatOverlayViewportSync
} from "./ui-bootstrap.js";
import { syncTowCombatOverlayDisplaySettings } from "./display-settings-sync.js";
import { ensureTowCombatOverlayActionRelayFlagHook } from "./relay/action-relay-runtime.js";
import {
  ensureTowCombatOverlayTopPanelOrderBackoffSweeps,
  ensureTowCombatOverlayTopPanelOrderRelayHook,
  ensureTowCombatOverlayTopPanelOrderSocketRelay
} from "./relay/top-panel-order-relay.js";

function ensureTowCombatOverlayApplyEffectQueryRegistered() {
  const systemId = String(game?.system?.id ?? "").trim();
  if (!systemId) return;

  const queryKey = `${systemId}.applyEffect`;
  const queries = CONFIG?.queries;
  if (!queries || typeof queries !== "object") return;
  if (typeof queries[queryKey] === "function") return;

  const socketHandlers = globalThis?.warhammer?.apps?.SocketHandlers;
  const useSocketHandler = typeof socketHandlers?.applyEffect === "function";

  queries[queryKey] = async (queryData = {}, options = {}) => {
    if (useSocketHandler) return socketHandlers.applyEffect(queryData, options);

    const actorUuid = String(queryData?.actorUuid ?? "").trim();
    if (!actorUuid) return null;

    let actor = null;
    if (typeof fromUuidSync === "function") actor = fromUuidSync(actorUuid);
    if (!actor && typeof fromUuid === "function") actor = await fromUuid(actorUuid);
    if (!actor || typeof actor.applyEffect !== "function") return null;

    return actor.applyEffect({
      effectUuids: queryData?.effectUuids,
      effectData: queryData?.effectData,
      messageId: queryData?.messageId
    });
  };
}

function registerTowCombatOverlayRuntimeApis() {
  registerTowCombatOverlayActionsRuntimeApi();
  registerTowCombatOverlayApi();
}

export { syncTowCombatOverlayDisplaySettings };

export function registerTowCombatOverlayModuleHooks() {
  Hooks.once("init", () => {
    ensureTowCombatOverlayApplyEffectQueryRegistered();
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

  Hooks.on("preCreateChatMessage", (messageDoc, createData, _options, userId) => {
    towCombatOverlayApplyTableVisibilityRelay(messageDoc, createData, userId);
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
    ensureTowCombatOverlayApplyEffectQueryRegistered();
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
