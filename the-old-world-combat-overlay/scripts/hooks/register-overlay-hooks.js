function getOverlayHooksRefreshAllOverlaysRef() {
  return globalThis.towCombatOverlayRefreshAllOverlays;
}

function getOverlayHooksRefreshTokenOverlayRef() {
  return globalThis.towCombatOverlayRefreshTokenOverlay;
}

function getOverlayHooksRefreshActorOverlaysRef() {
  return globalThis.towCombatOverlayRefreshActorOverlays;
}

function getOverlayHooksBringTokenToFrontRef() {
  return globalThis.towCombatOverlayBringTokenToFront;
}

function getOverlayHooksHideCoreTokenHoverVisualsRef() {
  return globalThis.towCombatOverlayHideCoreTokenHoverVisuals;
}

function getOverlayHooksUpdateCustomLayoutBorderVisibilityRef() {
  return globalThis.towCombatOverlayUpdateCustomLayoutBorderVisibility;
}

function getOverlayHooksQueueActorOverlayResyncRef() {
  return globalThis.towCombatOverlayQueueActorOverlayResync;
}

function getOverlayHooksQueueDeadSyncFromWoundsRef() {
  return globalThis.towCombatOverlayQueueDeadSyncFromWounds;
}

function registerTowCombatOverlayHooks() {
  return {
    canvasReady: Hooks.on("canvasReady", () => getOverlayHooksRefreshAllOverlaysRef()?.()),
    canvasPan: Hooks.on("canvasPan", (_canvas, viewPosition) => {
      const state = game[MODULE_KEY];
      if (!state) return;
      const nextScale = Number(viewPosition?.scale ?? canvas?.stage?.scale?.x ?? 1);
      const lastScale = Number(state.lastCanvasScale ?? NaN);
      if (Number.isFinite(lastScale) && Math.abs(nextScale - lastScale) < 0.01) return;
      state.lastCanvasScale = nextScale;
      getOverlayHooksRefreshAllOverlaysRef()?.();
    }),
    refreshToken: Hooks.on("refreshToken", (token) => getOverlayHooksRefreshTokenOverlayRef()?.(token)),
    hoverToken: Hooks.on("hoverToken", (token, hovered) => {
      getOverlayHooksHideCoreTokenHoverVisualsRef()?.(token);
      getOverlayHooksUpdateCustomLayoutBorderVisibilityRef()?.(token, { hovered });
    }),
    controlToken: Hooks.on("controlToken", (token, controlled) => {
      if (controlled) void getOverlayHooksBringTokenToFrontRef()?.(token);
      getOverlayHooksHideCoreTokenHoverVisualsRef()?.(token);
      getOverlayHooksUpdateCustomLayoutBorderVisibilityRef()?.(token, { controlled });
    }),
    createItem: Hooks.on("createItem", (item) => {
      if (item.type !== WOUND_ITEM_TYPE) return;
      getOverlayHooksRefreshActorOverlaysRef()?.(item.parent);
      getOverlayHooksQueueActorOverlayResyncRef()?.(item.parent);
      getOverlayHooksQueueDeadSyncFromWoundsRef()?.(item.parent);
    }),
    updateItem: Hooks.on("updateItem", (item) => {
      if (item.type !== WOUND_ITEM_TYPE) return;
      getOverlayHooksRefreshActorOverlaysRef()?.(item.parent);
      getOverlayHooksQueueActorOverlayResyncRef()?.(item.parent);
      getOverlayHooksQueueDeadSyncFromWoundsRef()?.(item.parent);
    }),
    deleteItem: Hooks.on("deleteItem", (item) => {
      if (item.type !== WOUND_ITEM_TYPE) return;
      getOverlayHooksRefreshActorOverlaysRef()?.(item.parent);
      getOverlayHooksQueueActorOverlayResyncRef()?.(item.parent);
      getOverlayHooksQueueDeadSyncFromWoundsRef()?.(item.parent);
    }),
    createActiveEffect: Hooks.on("createActiveEffect", (effect) => getOverlayHooksRefreshActorOverlaysRef()?.(effect?.parent)),
    updateActiveEffect: Hooks.on("updateActiveEffect", (effect) => getOverlayHooksRefreshActorOverlaysRef()?.(effect?.parent)),
    deleteActiveEffect: Hooks.on("deleteActiveEffect", (effect) => getOverlayHooksRefreshActorOverlaysRef()?.(effect?.parent))
  };
}

function unregisterTowCombatOverlayHooks(hookIds) {
  Hooks.off("canvasReady", hookIds.canvasReady);
  Hooks.off("canvasPan", hookIds.canvasPan);
  Hooks.off("refreshToken", hookIds.refreshToken);
  Hooks.off("hoverToken", hookIds.hoverToken);
  Hooks.off("controlToken", hookIds.controlToken);
  Hooks.off("createItem", hookIds.createItem);
  Hooks.off("updateItem", hookIds.updateItem);
  Hooks.off("deleteItem", hookIds.deleteItem);
  Hooks.off("createActiveEffect", hookIds.createActiveEffect);
  Hooks.off("updateActiveEffect", hookIds.updateActiveEffect);
  Hooks.off("deleteActiveEffect", hookIds.deleteActiveEffect);
}

globalThis.registerTowCombatOverlayHooks = registerTowCombatOverlayHooks;
globalThis.unregisterTowCombatOverlayHooks = unregisterTowCombatOverlayHooks;
