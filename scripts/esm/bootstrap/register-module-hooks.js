import { towCombatOverlayEnsurePromiseClose } from "../combat/attack.js";
import { registerTowCombatOverlayApi } from "../api/combat-overlay-api.js";
import { getTowCombatOverlayConstants } from "../runtime/module-constants.js";
import { registerTowCombatOverlayActionsRuntimeApi } from "./register-actions-api.js";
import { registerTowCombatOverlayDeadWoundSyncHooks } from "./register-dead-wound-sync-hooks.js";
import { getTowCombatOverlayOverlayApi } from "../api/module-api-registry.js";
import {
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
    || normalizedChangedSettingKey === settings.controlPanelEnableAbilities
    || normalizedChangedSettingKey === settings.controlPanelEnableWounds
    || normalizedChangedSettingKey === settings.controlPanelEnableTemporaryEffects
    || normalizedChangedSettingKey === settings.controlPanelEnableName
    || normalizedChangedSettingKey === settings.controlPanelEnableStats
    || normalizedChangedSettingKey === settings.controlPanelEnableImage
    || normalizedChangedSettingKey === settings.controlPanelEnableActionButtons
    || normalizedChangedSettingKey === settings.controlPanelEnableWeaponsButtons
    || normalizedChangedSettingKey === settings.controlPanelEnableMagicButtons
    || normalizedChangedSettingKey === settings.controlPanelShowDeadPortraitStatus
    || normalizedChangedSettingKey === settings.controlPanelPositionMode;
  if (normalizedChangedSettingKey === settings.controlPanelPositionMode) {
    const positionMode = String(getTowCombatOverlayDisplaySetting(settings.controlPanelPositionMode, "free")).trim();
    if (positionMode === "free") {
      const panelElement = document.getElementById("tow-combat-overlay-control-panel");
      if (panelElement instanceof HTMLElement) writeSavedPanelPosition(panelElement);
    }
  }

  const wantsEnabled = isTowCombatOverlayDisplaySettingEnabled(settings.enableOverlay, true);
  const wantsControlPanel = isTowCombatOverlayDisplaySettingEnabled(settings.enableControlPanel, true);
  const wantsTopPanel = isTowCombatOverlayDisplaySettingEnabled(settings.enableTopPanel, true);

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
        isTowCombatOverlayDisplaySettingEnabled(settings.controlPanelEnableButtonsDragDrop, true)
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
    syncTowCombatOverlayDisplaySettings();
  });
}
