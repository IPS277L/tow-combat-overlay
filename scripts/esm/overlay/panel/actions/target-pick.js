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
      const useDefaultDialog = preferDefaultDialog || isAltModifier(event);
      attackTriggered = true;
      clearPickMode();
      if (onTargetAttack) {
        await onTargetAttack(targetToken, { autoRoll: !useDefaultDialog });
        return;
      }
      await runPanelAttackOnTarget(sourceToken, targetToken, attackItem, { autoRoll: !useDefaultDialog });
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
  }

  function startAimPickMode(panelElement, slotElement, sourceToken, originEvent = null, options = {}) {
    const preferDefaultDialog = options?.preferDefaultDialog === true;
    const controlPanelState = getControlPanelState();
    if (!controlPanelState || !sourceToken) return;
    clearPickMode();

    const canvasView = canvas?.app?.view;
    if (canvasView instanceof HTMLElement) canvasView.style.cursor = pickCursor;
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
      aimTriggered = true;
      clearPickMode();
      const actor = sourceToken?.actor ?? sourceToken?.document?.actor ?? null;
      await runPanelAimAction(actor, sourceToken, {
        autoRoll: !preferDefaultDialog,
        targetToken
      });
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
  }

  function startHelpPickMode(panelElement, slotElement, sourceToken, originEvent = null, options = {}) {
    const preferDefaultDialog = options?.preferDefaultDialog === true;
    const controlPanelState = getControlPanelState();
    if (!controlPanelState || !sourceToken) return;
    clearPickMode();

    const canvasView = canvas?.app?.view;
    if (canvasView instanceof HTMLElement) canvasView.style.cursor = pickCursor;
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
      helpTriggered = true;
      clearPickMode();
      const actor = sourceToken?.actor ?? sourceToken?.document?.actor ?? null;
      await runPanelHelpAction(actor, sourceToken, {
        autoRoll: !preferDefaultDialog,
        targetToken
      });
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
  }

  return {
    clearPickMode,
    startAttackPickMode,
    startAimPickMode,
    startHelpPickMode
  };
}

