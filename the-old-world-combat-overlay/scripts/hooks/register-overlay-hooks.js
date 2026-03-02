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

function resolveTowCombatOverlayHookBindings() {
  const bindings = {
    refreshAllOverlays: getOverlayHooksRefreshAllOverlaysRef(),
    refreshTokenOverlay: getOverlayHooksRefreshTokenOverlayRef(),
    refreshActorOverlays: getOverlayHooksRefreshActorOverlaysRef(),
    bringTokenToFront: getOverlayHooksBringTokenToFrontRef(),
    hideCoreTokenHoverVisuals: getOverlayHooksHideCoreTokenHoverVisualsRef(),
    updateCustomLayoutBorderVisibility: getOverlayHooksUpdateCustomLayoutBorderVisibilityRef(),
    queueActorOverlayResync: getOverlayHooksQueueActorOverlayResyncRef(),
    queueDeadSyncFromWounds: getOverlayHooksQueueDeadSyncFromWoundsRef()
  };
  const missing = Object.entries(bindings)
    .filter(([, value]) => typeof value !== "function")
    .map(([key]) => key);
  if (missing.length) {
    throw new Error(`[the-old-world-combat-overlay] Missing required overlay hook bindings: ${missing.join(", ")}`);
  }
  return bindings;
}

function registerTowCombatOverlayHooks() {
  const bindings = resolveTowCombatOverlayHookBindings();
  return {
    canvasReady: Hooks.on("canvasReady", () => bindings.refreshAllOverlays()),
    canvasPan: Hooks.on("canvasPan", (_canvas, viewPosition) => {
      const state = game[MODULE_KEY];
      if (!state) return;
      const nextScale = Number(viewPosition?.scale ?? canvas?.stage?.scale?.x ?? 1);
      const lastScale = Number(state.lastCanvasScale ?? NaN);
      if (Number.isFinite(lastScale) && Math.abs(nextScale - lastScale) < 0.01) return;
      state.lastCanvasScale = nextScale;
      bindings.refreshAllOverlays();
    }),
    refreshToken: Hooks.on("refreshToken", (token) => bindings.refreshTokenOverlay(token)),
    hoverToken: Hooks.on("hoverToken", (token, hovered) => {
      bindings.hideCoreTokenHoverVisuals(token);
      bindings.updateCustomLayoutBorderVisibility(token, { hovered });
    }),
    controlToken: Hooks.on("controlToken", (token, controlled) => {
      if (controlled) void bindings.bringTokenToFront(token);
      bindings.hideCoreTokenHoverVisuals(token);
      bindings.updateCustomLayoutBorderVisibility(token, { controlled });
    }),
    createItem: Hooks.on("createItem", (item) => {
      if (item.type !== WOUND_ITEM_TYPE) return;
      bindings.refreshActorOverlays(item.parent);
      bindings.queueActorOverlayResync(item.parent);
      bindings.queueDeadSyncFromWounds(item.parent);
    }),
    updateItem: Hooks.on("updateItem", (item) => {
      if (item.type !== WOUND_ITEM_TYPE) return;
      bindings.refreshActorOverlays(item.parent);
      bindings.queueActorOverlayResync(item.parent);
      bindings.queueDeadSyncFromWounds(item.parent);
    }),
    deleteItem: Hooks.on("deleteItem", (item) => {
      if (item.type !== WOUND_ITEM_TYPE) return;
      bindings.refreshActorOverlays(item.parent);
      bindings.queueActorOverlayResync(item.parent);
      bindings.queueDeadSyncFromWounds(item.parent);
    }),
    createActiveEffect: Hooks.on("createActiveEffect", (effect) => bindings.refreshActorOverlays(effect?.parent)),
    updateActiveEffect: Hooks.on("updateActiveEffect", (effect) => bindings.refreshActorOverlays(effect?.parent)),
    deleteActiveEffect: Hooks.on("deleteActiveEffect", (effect) => bindings.refreshActorOverlays(effect?.parent))
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
