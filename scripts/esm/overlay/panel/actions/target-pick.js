export function createPanelTargetPickService({
  panelId,
  pickCursor = "crosshair",
  getControlPanelState,
  hideStatusTooltip,
  showOverlayTooltip,
  copyPoint,
  tokenAtPoint,
  isAltModifier,
  runPanelAttackOnTarget,
  runPanelAimAction,
  runPanelHelpAction
} = {}) {
  const TARGET_PICKING_BODY_CLASS = "tow-combat-overlay-is-picking-target";

  function getWorldPointFromClientEvent(event) {
    const clientX = Number(event?.clientX ?? NaN);
    const clientY = Number(event?.clientY ?? NaN);
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

    const renderer = canvas?.app?.renderer;
    const mapPositionToPoint = renderer?.events?.mapPositionToPoint
      ?? renderer?.plugins?.interaction?.mapPositionToPoint;
    if (typeof mapPositionToPoint !== "function") return null;

    const localPoint = new PIXI.Point();
    mapPositionToPoint.call(renderer.events ?? renderer.plugins?.interaction, localPoint, clientX, clientY);
    if (!canvas?.stage?.worldTransform?.applyInverse) return copyPoint(localPoint);
    return copyPoint(canvas.stage.worldTransform.applyInverse(localPoint));
  }

  function getPanelAttackPickState(controlPanelState) {
    if (!controlPanelState.pendingAttackPick) controlPanelState.pendingAttackPick = {};
    return controlPanelState.pendingAttackPick;
  }

  function clearPickMode() {
    const controlPanelState = getControlPanelState();
    if (!controlPanelState) return;
    const pending = controlPanelState.pendingAttackPick;
    if (!pending) return;

    if (pending.windowPointerDownCapture) window.removeEventListener("pointerdown", pending.windowPointerDownCapture, true);
    if (pending.windowPointerMove) window.removeEventListener("pointermove", pending.windowPointerMove, true);
    if (pending.onEscape) window.removeEventListener("keydown", pending.onEscape, true);
    if (pending.panelElement instanceof HTMLElement) pending.panelElement.classList.remove("is-picking-attack");
    if (pending.slotElement instanceof HTMLElement) pending.slotElement.classList.remove("is-picking-attack");
    if (pending.canvasView instanceof HTMLElement) pending.canvasView.style.cursor = "";
    document.body?.classList?.remove?.(TARGET_PICKING_BODY_CLASS);
    hideStatusTooltip();

    delete controlPanelState.pendingAttackPick;
  }

  function startAttackPickMode(panelElement, slotElement, sourceToken, attackItem, originEvent = null, options = {}) {
    const preferDefaultDialog = options?.preferDefaultDialog === true;
    const onTargetAttack = (typeof options?.onTargetAttack === "function")
      ? options.onTargetAttack
      : null;
    const controlPanelState = getControlPanelState();
    if (!controlPanelState || !sourceToken || !attackItem) return;
    clearPickMode();

    const canvasView = canvas?.app?.view;
    if (canvasView instanceof HTMLElement) canvasView.style.cursor = pickCursor;
    document.body?.classList?.add?.(TARGET_PICKING_BODY_CLASS);
    panelElement.classList.add("is-picking-attack");
    slotElement.classList.add("is-picking-attack");
    let attackTriggered = false;
    const showPickTooltip = (event) => {
      const point = {
        x: Number(event?.clientX ?? NaN),
        y: Number(event?.clientY ?? NaN)
      };
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      showOverlayTooltip("Select Target", "Click a target token.", point, null, {
        allowOutsideCanvas: true,
        clientCoordinates: true,
        theme: "panel"
      });
    };

    const resolveAttackPickTarget = async (targetToken, event = null) => {
      if (attackTriggered) return false;
      if (!targetToken || targetToken.id === sourceToken.id) return false;
      const useDefaultDialog = preferDefaultDialog || isAltModifier(event);
      attackTriggered = true;
      clearPickMode();
      if (onTargetAttack) {
        await onTargetAttack(targetToken, { autoRoll: !useDefaultDialog });
        return true;
      }
      await runPanelAttackOnTarget(sourceToken, targetToken, attackItem, { autoRoll: !useDefaultDialog });
      return true;
    };

    const onWindowPointerDownCapture = async (event) => {
      if (attackTriggered) return;
      if (Number(event?.button ?? 0) !== 0) return;
      const target = event?.target;
      if (target instanceof Element && target.closest(`#${panelId}`)) return;
      const point = getWorldPointFromClientEvent(event);
      const targetToken = tokenAtPoint(point, { excludeTokenId: sourceToken.id });
      if (!targetToken) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      await resolveAttackPickTarget(targetToken, event);
    };

    const onEscape = (event) => {
      if (event.key !== "Escape") return;
      clearPickMode();
    };
    const onWindowPointerMove = (event) => {
      if (attackTriggered) return;
      showPickTooltip(event);
    };

    window.addEventListener("pointerdown", onWindowPointerDownCapture, true);
    window.addEventListener("pointermove", onWindowPointerMove, true);
    window.addEventListener("keydown", onEscape, true);
    showPickTooltip(originEvent);

    const pending = getPanelAttackPickState(controlPanelState);
    pending.windowPointerDownCapture = onWindowPointerDownCapture;
    pending.windowPointerMove = onWindowPointerMove;
    pending.onEscape = onEscape;
    pending.panelElement = panelElement;
    pending.slotElement = slotElement;
    pending.canvasView = canvasView;
    pending.resolveTargetTokenPick = resolveAttackPickTarget;
  }

  function startAimPickMode(panelElement, slotElement, sourceToken, originEvent = null, options = {}) {
    const preferDefaultDialog = options?.preferDefaultDialog === true;
    const controlPanelState = getControlPanelState();
    if (!controlPanelState || !sourceToken) return;
    clearPickMode();

    const canvasView = canvas?.app?.view;
    if (canvasView instanceof HTMLElement) canvasView.style.cursor = pickCursor;
    document.body?.classList?.add?.(TARGET_PICKING_BODY_CLASS);
    panelElement.classList.add("is-picking-attack");
    slotElement.classList.add("is-picking-attack");
    let aimTriggered = false;
    const showPickTooltip = (event) => {
      const point = {
        x: Number(event?.clientX ?? NaN),
        y: Number(event?.clientY ?? NaN)
      };
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      showOverlayTooltip("Select Target", "Click a target token for Aim.", point, null, {
        allowOutsideCanvas: true,
        clientCoordinates: true,
        theme: "panel"
      });
    };

    const resolveAimPickTarget = async (targetToken) => {
      if (aimTriggered) return false;
      if (!targetToken || targetToken.id === sourceToken.id) return false;
      aimTriggered = true;
      clearPickMode();
      const actor = sourceToken?.actor ?? sourceToken?.document?.actor ?? null;
      await runPanelAimAction(actor, sourceToken, {
        autoRoll: !preferDefaultDialog,
        targetToken
      });
      return true;
    };

    const onWindowPointerDownCapture = async (event) => {
      if (aimTriggered) return;
      if (Number(event?.button ?? 0) !== 0) return;
      const target = event?.target;
      if (target instanceof Element && target.closest(`#${panelId}`)) return;
      const point = getWorldPointFromClientEvent(event);
      const targetToken = tokenAtPoint(point, { excludeTokenId: sourceToken.id });
      if (!targetToken) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      await resolveAimPickTarget(targetToken);
    };

    const onEscape = (event) => {
      if (event.key !== "Escape") return;
      clearPickMode();
    };
    const onWindowPointerMove = (event) => {
      if (aimTriggered) return;
      showPickTooltip(event);
    };

    window.addEventListener("pointerdown", onWindowPointerDownCapture, true);
    window.addEventListener("pointermove", onWindowPointerMove, true);
    window.addEventListener("keydown", onEscape, true);
    showPickTooltip(originEvent);

    const pending = getPanelAttackPickState(controlPanelState);
    pending.windowPointerDownCapture = onWindowPointerDownCapture;
    pending.windowPointerMove = onWindowPointerMove;
    pending.onEscape = onEscape;
    pending.panelElement = panelElement;
    pending.slotElement = slotElement;
    pending.canvasView = canvasView;
    pending.resolveTargetTokenPick = resolveAimPickTarget;
  }

  function startHelpPickMode(panelElement, slotElement, sourceToken, originEvent = null, options = {}) {
    const preferDefaultDialog = options?.preferDefaultDialog === true;
    const controlPanelState = getControlPanelState();
    if (!controlPanelState || !sourceToken) return;
    clearPickMode();

    const canvasView = canvas?.app?.view;
    if (canvasView instanceof HTMLElement) canvasView.style.cursor = pickCursor;
    document.body?.classList?.add?.(TARGET_PICKING_BODY_CLASS);
    panelElement.classList.add("is-picking-attack");
    slotElement.classList.add("is-picking-attack");
    let helpTriggered = false;
    const showPickTooltip = (event) => {
      const point = {
        x: Number(event?.clientX ?? NaN),
        y: Number(event?.clientY ?? NaN)
      };
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      showOverlayTooltip("Select Target", "Click a target token for Help.", point, null, {
        allowOutsideCanvas: true,
        clientCoordinates: true,
        theme: "panel"
      });
    };

    const resolveHelpPickTarget = async (targetToken) => {
      if (helpTriggered) return false;
      if (!targetToken || targetToken.id === sourceToken.id) return false;
      helpTriggered = true;
      clearPickMode();
      const actor = sourceToken?.actor ?? sourceToken?.document?.actor ?? null;
      await runPanelHelpAction(actor, sourceToken, {
        autoRoll: !preferDefaultDialog,
        targetToken
      });
      return true;
    };

    const onWindowPointerDownCapture = async (event) => {
      if (helpTriggered) return;
      if (Number(event?.button ?? 0) !== 0) return;
      const target = event?.target;
      if (target instanceof Element && target.closest(`#${panelId}`)) return;
      const point = getWorldPointFromClientEvent(event);
      const targetToken = tokenAtPoint(point, { excludeTokenId: sourceToken.id });
      if (!targetToken) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      await resolveHelpPickTarget(targetToken);
    };

    const onEscape = (event) => {
      if (event.key !== "Escape") return;
      clearPickMode();
    };
    const onWindowPointerMove = (event) => {
      if (helpTriggered) return;
      showPickTooltip(event);
    };

    window.addEventListener("pointerdown", onWindowPointerDownCapture, true);
    window.addEventListener("pointermove", onWindowPointerMove, true);
    window.addEventListener("keydown", onEscape, true);
    showPickTooltip(originEvent);

    const pending = getPanelAttackPickState(controlPanelState);
    pending.windowPointerDownCapture = onWindowPointerDownCapture;
    pending.windowPointerMove = onWindowPointerMove;
    pending.onEscape = onEscape;
    pending.panelElement = panelElement;
    pending.slotElement = slotElement;
    pending.canvasView = canvasView;
    pending.resolveTargetTokenPick = resolveHelpPickTarget;
  }

  return {
    clearPickMode,
    startAttackPickMode,
    startAimPickMode,
    startHelpPickMode
  };
}
