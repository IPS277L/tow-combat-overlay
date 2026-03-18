export function removeStaleControlPanels({ panelId, selectionPanelId } = {}) {
  for (const panel of Array.from(document.querySelectorAll(`#${panelId}, #${selectionPanelId}`))) {
    if (panel instanceof HTMLElement) panel.remove();
  }
}

export function isDragBlockedTarget(targetElement) {
  if (!(targetElement instanceof Element)) return true;
  const blockedSelector = [
    ".tow-combat-overlay-control-panel__slot",
    ".tow-combat-overlay-control-panel__status-icon",
    ".tow-combat-overlay-control-panel__selection-stat-row",
    ".tow-combat-overlay-control-panel__selection-text-control",
    ".tow-combat-overlay-control-panel__selection-mod-button",
    "button",
    "input",
    "select",
    "textarea",
    "a",
    "[contenteditable='true']"
  ].join(", ");
  return !!targetElement.closest(blockedSelector);
}

export function bindControlPanelDrag(controlPanelState, panelElement, {
  applyPosition,
  persistPosition,
  onMoved = null,
  dragSources = []
} = {}) {
  let dragData = null;

  const onPointerMove = (event) => {
    if (!dragData) return;
    const deltaX = Number(event.clientX) - dragData.startClientX;
    const deltaY = Number(event.clientY) - dragData.startClientY;
    applyPosition(controlPanelState, panelElement, dragData.startLeft + deltaX, dragData.startTop + deltaY);
    if (typeof onMoved === "function") onMoved();
  };

  const onPointerUp = () => {
    if (!dragData) return;
    dragData = null;
    panelElement.classList.remove("is-dragging");
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    if (typeof persistPosition === "function") persistPosition(panelElement);
  };

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    if (isDragBlockedTarget(event.target)) return;
    event.preventDefault();

    const rect = panelElement.getBoundingClientRect();
    dragData = {
      startClientX: Number(event.clientX),
      startClientY: Number(event.clientY),
      startLeft: Number(rect.left),
      startTop: Number(rect.top)
    };
    panelElement.classList.add("is-dragging");
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  const onResize = () => {
    const rect = panelElement.getBoundingClientRect();
    applyPosition(controlPanelState, panelElement, rect.left, rect.top);
    if (typeof onMoved === "function") onMoved();
  };

  const sources = [
    panelElement,
    ...(Array.isArray(dragSources) ? dragSources : []).filter((source) => source instanceof HTMLElement)
  ];
  for (const sourceElement of sources) sourceElement.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("resize", onResize);

  controlPanelState.onPointerDown = onPointerDown;
  controlPanelState.dragSourceElements = sources;
  controlPanelState.onResize = onResize;
  controlPanelState.onPointerMove = onPointerMove;
  controlPanelState.onPointerUp = onPointerUp;
}
