import { hideStatusTooltip, showOverlayTooltip } from "../shared/shared.js";
import {
  writeSavedTopPanelPosition,
  writeSavedTopPanelTokenOrder
} from "./top-panel-state.js";
import { TOP_PANEL_HOOKS, TOP_PANEL_STATE_KEY } from "./top-panel-constants.js";
import {
  getTopPanelDragHandleTooltipData,
  getTopPanelState,
  removeStaleTopPanels
} from "./top-panel-shared.js";
import {
  applyDefaultTopPanelPosition,
  applyInitialTopPanelPosition,
  applyTopPanelPosition,
  getCurrentSceneId,
  getOrderedSceneTokens,
  isTopPanelAlwaysCenteredEnabled,
  isTopPanelLockedEnabled,
  moveTokenRelativeToTarget,
  shouldDropAfterTarget,
  syncTopPanelListBottomPadding,
  syncTopPanelWidth
} from "./top-panel-layout.js";
import {
  applyTopPanelHoveredCardHighlight,
  clearLinkedTopPanelHover,
  hasPendingControlPanelTargetPick,
  resolvePendingControlPanelTargetPick,
  selectTokenFromTopPanel,
  setLinkedTopPanelHover
} from "./top-panel-interactions.js";
import {
  createTopPanelElement,
  queueTopPanelRender,
  renderTopPanelContent
} from "./top-panel-render.js";
import { getTowCombatOverlayConstants } from "../../runtime/module-constants.js";
import {
  canTowCombatOverlayUserViewControl,
  isTowCombatOverlayDisplaySettingEnabled
} from "../../bootstrap/register-settings.js";

function bindTopPanelElementEvents(topPanelElement) {
  const state = getTopPanelState();
  if (!state) return;
  const dragHandleButton = topPanelElement.querySelector("[data-action='drag-panel-handle']");
  const controlsElement = topPanelElement.querySelector(".tow-combat-overlay-top-panel__controls");
  const { settings } = getTowCombatOverlayConstants();
  const canReorderTopPanelCards = () => canTowCombatOverlayUserViewControl(settings.tokensPanelCardsDragDropMinimumRole, "all");
  const isTopPanelTooltipsEnabled = () => isTowCombatOverlayDisplaySettingEnabled(settings.tokensPanelEnableTooltips, true);
  const isTopPanelCardTooltipEnabled = () => (
    isTopPanelTooltipsEnabled()
    && isTowCombatOverlayDisplaySettingEnabled(settings.tokensPanelEnableCardsTooltip, true)
  );

  const syncDragControls = () => {
    const alwaysCentered = isTopPanelAlwaysCenteredEnabled();
    const locked = isTopPanelLockedEnabled();
    if (controlsElement instanceof HTMLElement) controlsElement.hidden = alwaysCentered || locked;
    if (alwaysCentered) applyDefaultTopPanelPosition(topPanelElement);
    const dragTooltipData = getTopPanelDragHandleTooltipData();
    topPanelElement.classList.toggle("is-drag-locked", alwaysCentered || locked);

    if (dragHandleButton instanceof HTMLButtonElement) {
      dragHandleButton.setAttribute("aria-label", dragTooltipData.ariaLabel);
      dragHandleButton.dataset.tooltipTitle = dragTooltipData.title;
      dragHandleButton.dataset.tooltipDescription = dragTooltipData.description;
      dragHandleButton.removeAttribute("title");
    }
  };

  let panelDragData = null;

  const onPanelPointerMove = (event) => {
    if (!panelDragData) return;
    const deltaX = Number(event.clientX) - panelDragData.startClientX;
    const deltaY = Number(event.clientY) - panelDragData.startClientY;
    applyTopPanelPosition(topPanelElement, panelDragData.startLeft + deltaX, panelDragData.startTop + deltaY);
  };

  const onPanelPointerUp = () => {
    if (!panelDragData) return;
    panelDragData = null;
    topPanelElement.classList.remove("is-dragging");
    window.removeEventListener("pointermove", onPanelPointerMove);
    window.removeEventListener("pointerup", onPanelPointerUp);
    window.removeEventListener("pointercancel", onPanelPointerUp);
    writeSavedTopPanelPosition(topPanelElement);
  };

  const onPanelPointerDown = (event) => {
    if (event.button !== 0) return;
    if (isTopPanelAlwaysCenteredEnabled()) return;
    if (isTopPanelLockedEnabled()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const dragHandleElement = target.closest("[data-action='drag-panel-handle']");
    if (!(dragHandleElement instanceof HTMLButtonElement)) return;
    const portraitTarget = target.closest(".tow-combat-overlay-top-panel__portrait");
    if (portraitTarget && event.shiftKey !== true) return;

    event.preventDefault();
    const rect = topPanelElement.getBoundingClientRect();
    panelDragData = {
      startClientX: Number(event.clientX),
      startClientY: Number(event.clientY),
      startLeft: Number(rect.left),
      startTop: Number(rect.top)
    };
    topPanelElement.classList.add("is-dragging");
    window.addEventListener("pointermove", onPanelPointerMove);
    window.addEventListener("pointerup", onPanelPointerUp);
    window.addEventListener("pointercancel", onPanelPointerUp);
  };

  const onResize = () => {
    syncTopPanelWidth(topPanelElement);
    syncTopPanelListBottomPadding(topPanelElement);
    if (isTopPanelAlwaysCenteredEnabled()) {
      applyDefaultTopPanelPosition(topPanelElement);
    } else {
      const rect = topPanelElement.getBoundingClientRect();
      applyTopPanelPosition(topPanelElement, rect.left, rect.top);
    }
  };

  state.onPanelPointerDown = onPanelPointerDown;
  state.onPanelPointerMove = onPanelPointerMove;
  state.onPanelPointerUp = onPanelPointerUp;
  state.onResize = onResize;

  topPanelElement.addEventListener("pointerdown", onPanelPointerDown);
  window.addEventListener("resize", onResize);
  syncDragControls();

  topPanelElement.addEventListener("click", async (event) => {
    const liveState = getTopPanelState();
    if (!liveState) return;
    if (liveState.suppressNextClick === true) {
      liveState.suppressNextClick = false;
      return;
    }
    const portrait = event.target instanceof Element
      ? event.target.closest(".tow-combat-overlay-top-panel__portrait")
      : null;
    if (!(portrait instanceof HTMLElement)) return;
    event.preventDefault();
    const usedAsTargetPick = await resolvePendingControlPanelTargetPick(portrait.dataset.tokenId, event);
    if (usedAsTargetPick) return;
    selectTokenFromTopPanel(portrait.dataset.tokenId, event);
  });

  const onPortraitHoverStateShow = (event) => {
    const targetElement = event.target instanceof Element ? event.target : null;
    if (!targetElement) return;
    const portraitElement = targetElement.closest(".tow-combat-overlay-top-panel__portrait");
    if (!(portraitElement instanceof HTMLElement)) return;

    if (hasPendingControlPanelTargetPick()) {
      setLinkedTopPanelHover(state, portraitElement.dataset.tokenId, {
        syncCanvas: false,
        panelElement: topPanelElement
      });
      return;
    }

    setLinkedTopPanelHover(state, portraitElement.dataset.tokenId, {
      panelElement: topPanelElement
    });
  };

  const onPortraitHoverStateHide = (event) => {
    const portraitElement = event.target instanceof Element
      ? event.target.closest(".tow-combat-overlay-top-panel__portrait")
      : null;
    if (!(portraitElement instanceof HTMLElement)) return;
    const next = event.relatedTarget;
    if (next instanceof Element && next.closest(".tow-combat-overlay-top-panel__portrait") === portraitElement) return;

    clearLinkedTopPanelHover(state, {
      syncCanvas: !hasPendingControlPanelTargetPick(),
      panelElement: topPanelElement
    });
  };

  const onPortraitTooltipShow = (event) => {
    if (!isTopPanelCardTooltipEnabled()) return;
    const targetElement = event.target instanceof Element ? event.target : null;
    if (!targetElement || targetElement.closest(".tow-combat-overlay-top-panel__chip")) return;
    const portraitElement = targetElement.closest(".tow-combat-overlay-top-panel__portrait");
    if (!(portraitElement instanceof HTMLElement)) return;
    const title = String(portraitElement.dataset.tooltipTitle ?? "").trim();
    if (!title) return;
    const description = String(portraitElement.dataset.tooltipDescription ?? "").trim();
    showOverlayTooltip(title, description, { x: event.clientX, y: event.clientY }, null, {
      allowOutsideCanvas: true,
      clientCoordinates: true,
      theme: "panel",
      descriptionIsHtml: true
    });
  };

  const onPortraitTooltipHide = (event) => {
    const portraitElement = event.target instanceof Element
      ? event.target.closest(".tow-combat-overlay-top-panel__portrait")
      : null;
    if (!(portraitElement instanceof HTMLElement)) return;
    const next = event.relatedTarget;
    if (next instanceof Element && next.closest(".tow-combat-overlay-top-panel__portrait") === portraitElement) return;
    hideStatusTooltip();
  };

  topPanelElement.addEventListener("pointerover", onPortraitTooltipShow);
  topPanelElement.addEventListener("pointermove", onPortraitTooltipShow);
  topPanelElement.addEventListener("pointerout", onPortraitTooltipHide);
  topPanelElement.addEventListener("pointerover", onPortraitHoverStateShow);
  topPanelElement.addEventListener("pointermove", onPortraitHoverStateShow);
  topPanelElement.addEventListener("pointerout", onPortraitHoverStateHide);
  topPanelElement.addEventListener("pointerleave", () => clearLinkedTopPanelHover(state, { panelElement: topPanelElement }));
  topPanelElement.addEventListener("pointercancel", () => clearLinkedTopPanelHover(state, { panelElement: topPanelElement }));

  const onChipTooltipShow = (event) => {
    if (!isTopPanelTooltipsEnabled()) return;
    const chipElement = event.target instanceof Element
      ? event.target.closest(".tow-combat-overlay-top-panel__chip")
      : null;
    if (!(chipElement instanceof HTMLElement)) return;
    const title = String(chipElement.dataset.tooltipTitle ?? "").trim();
    if (!title) return;
    const description = String(chipElement.dataset.tooltipDescription ?? "").trim() || "No description.";
    showOverlayTooltip(title, description, { x: event.clientX, y: event.clientY }, null, {
      allowOutsideCanvas: true,
      clientCoordinates: true,
      theme: "panel",
      descriptionIsHtml: true
    });
  };

  const onChipTooltipHide = (event) => {
    const chipElement = event.target instanceof Element
      ? event.target.closest(".tow-combat-overlay-top-panel__chip")
      : null;
    if (!(chipElement instanceof HTMLElement)) return;
    const next = event.relatedTarget;
    if (next instanceof Element && next.closest(".tow-combat-overlay-top-panel__chip") === chipElement) return;
    hideStatusTooltip();
  };

  topPanelElement.addEventListener("pointerover", onChipTooltipShow);
  topPanelElement.addEventListener("pointermove", onChipTooltipShow);
  topPanelElement.addEventListener("pointerout", onChipTooltipHide);
  topPanelElement.addEventListener("pointercancel", () => hideStatusTooltip());

  const onControlTooltipShow = (event) => {
    if (!isTopPanelTooltipsEnabled()) return;
    const buttonElement = event.target instanceof Element
      ? event.target.closest(".tow-combat-overlay-top-panel__control-button")
      : null;
    if (!(buttonElement instanceof HTMLElement)) return;
    const title = String(buttonElement.dataset.tooltipTitle ?? "").trim();
    if (!title) return;
    const description = String(buttonElement.dataset.tooltipDescription ?? "").trim();
    showOverlayTooltip(title, description, { x: event.clientX, y: event.clientY }, null, {
      allowOutsideCanvas: true,
      clientCoordinates: true,
      theme: "panel",
      descriptionIsHtml: true
    });
  };

  const onControlTooltipHide = (event) => {
    const buttonElement = event.target instanceof Element
      ? event.target.closest(".tow-combat-overlay-top-panel__control-button")
      : null;
    if (!(buttonElement instanceof HTMLElement)) return;
    const next = event.relatedTarget;
    if (next instanceof Element && next.closest(".tow-combat-overlay-top-panel__control-button") === buttonElement) return;
    hideStatusTooltip();
  };

  topPanelElement.addEventListener("pointerover", onControlTooltipShow);
  topPanelElement.addEventListener("pointermove", onControlTooltipShow);
  topPanelElement.addEventListener("pointerout", onControlTooltipHide);

  topPanelElement.addEventListener("dragstart", (event) => {
    if (!canReorderTopPanelCards()) {
      event.preventDefault();
      return;
    }
    if (hasPendingControlPanelTargetPick()) {
      event.preventDefault();
      return;
    }

    const portrait = event.target instanceof Element
      ? event.target.closest(".tow-combat-overlay-top-panel__portrait")
      : null;
    if (!(portrait instanceof HTMLElement)) {
      event.preventDefault();
      return;
    }

    const sourceId = String(portrait.dataset.tokenId ?? "").trim();
    if (!sourceId) {
      event.preventDefault();
      return;
    }

    const liveState = getTopPanelState();
    if (!liveState) {
      event.preventDefault();
      return;
    }

    liveState.draggedTokenId = sourceId;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", sourceId);
    }
  });

  topPanelElement.addEventListener("dragover", (event) => {
    if (!canReorderTopPanelCards()) return;
    const targetPortrait = event.target instanceof Element
      ? event.target.closest(".tow-combat-overlay-top-panel__portrait")
      : null;
    if (!(targetPortrait instanceof HTMLElement)) return;

    const liveState = getTopPanelState();
    if (!liveState) return;

    const sourceId = String(
      liveState.draggedTokenId
      ?? event.dataTransfer?.getData("text/plain")
      ?? ""
    ).trim();
    const targetId = String(targetPortrait.dataset.tokenId ?? "").trim();
    if (!sourceId || !targetId || sourceId === targetId) return;

    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  });

  topPanelElement.addEventListener("drop", (event) => {
    if (!canReorderTopPanelCards()) return;
    const targetPortrait = event.target instanceof Element
      ? event.target.closest(".tow-combat-overlay-top-panel__portrait")
      : null;
    if (!(targetPortrait instanceof HTMLElement)) return;

    const liveState = getTopPanelState();
    if (!liveState) return;

    const sourceId = String(
      event.dataTransfer?.getData("text/plain")
      ?? liveState.draggedTokenId
      ?? ""
    ).trim();
    const targetId = String(targetPortrait.dataset.tokenId ?? "").trim();
    if (!sourceId || !targetId || sourceId === targetId) return;

    event.preventDefault();
    const placeAfter = shouldDropAfterTarget(event, targetPortrait);
    const sceneId = getCurrentSceneId();
    if (!sceneId) return;
    const currentTokenIds = getOrderedSceneTokens().map((token) => String(token.id ?? "").trim()).filter(Boolean);
    const nextOrder = moveTokenRelativeToTarget(currentTokenIds, sourceId, targetId, { placeAfter });
    writeSavedTopPanelTokenOrder(sceneId, nextOrder);

    // Clear drag state immediately because rerender in this handler can prevent dragend on some clients.
    liveState.draggedTokenId = "";
    liveState.suppressNextClick = true;
    void renderTopPanelContent();
  });

  topPanelElement.addEventListener("dragend", () => {
    const liveState = getTopPanelState();
    if (!liveState) return;
    liveState.draggedTokenId = "";
  });
}

function bindTopPanelHooks() {
  const state = getTopPanelState();
  if (!state) return;
  if (!(state.hookIds instanceof Map)) state.hookIds = new Map();

  for (const hookName of TOP_PANEL_HOOKS) {
    if (state.hookIds.has(hookName)) continue;
    const hookId = Hooks.on(hookName, () => queueTopPanelRender());
    state.hookIds.set(hookName, hookId);
  }

  if (!state.hookIds.has("hoverToken")) {
    const hookId = Hooks.on("hoverToken", (token, hovered) => {
      const liveState = getTopPanelState();
      if (!liveState) return;
      liveState.hoveredCanvasTokenId = hovered === true ? String(token?.id ?? "").trim() : "";
      const panelElement = liveState.element;
      if (!(panelElement instanceof HTMLElement) || !panelElement.isConnected) return;
      applyTopPanelHoveredCardHighlight(panelElement, liveState.hoveredCanvasTokenId);
    });
    state.hookIds.set("hoverToken", hookId);
  }
}

function unbindTopPanelHooks() {
  const state = getTopPanelState();
  const hookIds = state?.hookIds;
  if (!(hookIds instanceof Map)) return;

  for (const [hookName, hookId] of hookIds.entries()) {
    Hooks.off(hookName, hookId);
  }
  hookIds.clear();
}

export async function towCombatOverlayEnsureTopPanel() {
  const state = getTopPanelState();
  if (!state) return;

  if (state.element instanceof HTMLElement && state.element.isConnected) {
    await renderTopPanelContent();
    return;
  }

  removeStaleTopPanels();
  const panelElement = await createTopPanelElement(bindTopPanelElementEvents);
  panelElement.style.left = "0px";
  panelElement.style.top = "0px";
  document.body.appendChild(panelElement);
  applyInitialTopPanelPosition(panelElement);

  state.element = panelElement;
  bindTopPanelHooks();
  await renderTopPanelContent();
}

export function towCombatOverlayRemoveTopPanel() {
  const state = game?.[TOP_PANEL_STATE_KEY];
  if (state) clearLinkedTopPanelHover(state);
  unbindTopPanelHooks();

  if (typeof state?.onPanelPointerDown === "function" && state?.element instanceof HTMLElement) {
    state.element.removeEventListener("pointerdown", state.onPanelPointerDown);
  }
  if (typeof state?.onPanelPointerMove === "function") window.removeEventListener("pointermove", state.onPanelPointerMove);
  if (typeof state?.onPanelPointerUp === "function") {
    window.removeEventListener("pointerup", state.onPanelPointerUp);
    window.removeEventListener("pointercancel", state.onPanelPointerUp);
  }
  if (typeof state?.onResize === "function") window.removeEventListener("resize", state.onResize);

  if (state?.element instanceof HTMLElement) state.element.remove();
  removeStaleTopPanels();

  if (game && Object.prototype.hasOwnProperty.call(game, TOP_PANEL_STATE_KEY)) {
    delete game[TOP_PANEL_STATE_KEY];
  }
}
