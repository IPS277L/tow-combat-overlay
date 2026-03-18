const PANEL_SELECTION_SYNC_HOOKS = Object.freeze([
  { hookName: "controlToken", idKey: "controlTokenHookId", callbackKey: "onControlToken" },
  { hookName: "canvasReady", idKey: "canvasReadyHookId", callbackKey: "onCanvasReady" },
  { hookName: "refreshToken", idKey: "refreshTokenHookId", callbackKey: "onRefreshToken" },
  { hookName: "updateToken", idKey: "updateTokenHookId", callbackKey: "onUpdateToken" },
  { hookName: "updateActor", idKey: "updateActorHookId", callbackKey: "onUpdateActor" },
  { hookName: "createItem", idKey: "createItemHookId", callbackKey: "onCreateItem" },
  { hookName: "updateItem", idKey: "updateItemHookId", callbackKey: "onUpdateItem" },
  { hookName: "deleteItem", idKey: "deleteItemHookId", callbackKey: "onDeleteItem" },
  { hookName: "createActiveEffect", idKey: "createActiveEffectHookId", callbackKey: "onCreateActiveEffect" },
  { hookName: "updateActiveEffect", idKey: "updateActiveEffectHookId", callbackKey: "onUpdateActiveEffect" },
  { hookName: "deleteActiveEffect", idKey: "deleteActiveEffectHookId", callbackKey: "onDeleteActiveEffect" }
]);

export function createPanelSelectionSyncService({
  updateSelectionDisplay
} = {}) {
  function bindSelectionSync(controlPanelState, panelElement) {
    if (!controlPanelState || typeof updateSelectionDisplay !== "function") return;
    for (const hookConfig of PANEL_SELECTION_SYNC_HOOKS) {
      const callback = () => updateSelectionDisplay(panelElement);
      const hookId = Hooks.on(hookConfig.hookName, callback);
      controlPanelState[hookConfig.idKey] = hookId;
      controlPanelState[hookConfig.callbackKey] = callback;
    }
    updateSelectionDisplay(panelElement);
  }

  function unbindSelectionSync(controlPanelState) {
    if (!controlPanelState) return;
    for (const hookConfig of PANEL_SELECTION_SYNC_HOOKS) {
      const hookId = controlPanelState[hookConfig.idKey];
      if (hookId != null) Hooks.off(hookConfig.hookName, hookId);
      controlPanelState[hookConfig.idKey] = null;
      controlPanelState[hookConfig.callbackKey] = null;
    }
  }

  return {
    bindSelectionSync,
    unbindSelectionSync
  };
}

