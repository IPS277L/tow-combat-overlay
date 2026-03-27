import { towCombatOverlayEnsurePromiseClose } from "../combat/attack.js";
import { registerTowCombatOverlayApi } from "../api/combat-overlay-api.js";
import { getTowCombatOverlayConstants } from "../runtime/module-constants.js";
import { registerTowCombatOverlayActionsRuntimeApi } from "./register-actions-api.js";
import { registerTowCombatOverlayDeadWoundSyncHooks } from "./register-dead-wound-sync-hooks.js";
import { getTowCombatOverlayOverlayApi } from "../api/module-api-registry.js";
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
  const stateKey = "__towCombatOverlayTopPanelOrderSocketRelayBound";
  if (!game || game[stateKey] === true) return;
  const socket = game?.socket;
  if (!socket?.on) return;
  const relayState = ensureTowCombatOverlayTopPanelOrderRelayHook();
  const handleOrderRequestPayload = relayState?.handleOrderRequestPayload;
  if (typeof handleOrderRequestPayload !== "function") return;

  socket.on(`module.${moduleId}`, (message) => {
    if (game?.user?.isGM !== true) return;
    if (!message || typeof message !== "object") return;
    if (String(message.type ?? "").trim() !== requestSocketType) return;
    const payload = message.payload;
    const requesterId = String(payload?.requesterId ?? "").trim();
    const requestUser = requesterId ? game?.users?.get?.(requesterId) : null;
    void Promise.resolve(handleOrderRequestPayload(payload, requestUser ?? null)).catch(() => {});
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
    ensureTowCombatOverlayTopPanelOrderBackoffSweeps();
    syncTowCombatOverlayDisplaySettings();
  });
}
