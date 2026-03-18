import { hideStatusTooltip, showOverlayTooltip } from "../../shared/shared.js";

export function bindPanelTooltipEvent(targetElement, getTooltipData) {
  if (!(targetElement instanceof HTMLElement) || typeof getTooltipData !== "function") return;
  const onShowTooltip = (event) => {
    const data = getTooltipData();
    const title = String(data?.title ?? "").trim();
    if (!title) {
      hideStatusTooltip();
      return;
    }
    const description = String(data?.description ?? "").trim();
    showOverlayTooltip(title, description, { x: event.clientX, y: event.clientY }, null, {
      allowOutsideCanvas: true,
      clientCoordinates: true,
      theme: "panel",
      descriptionIsHtml: true
    });
  };
  const onHideTooltip = () => hideStatusTooltip();
  targetElement.addEventListener("pointerenter", onShowTooltip);
  targetElement.addEventListener("pointermove", onShowTooltip);
  targetElement.addEventListener("pointerleave", onHideTooltip);
  targetElement.addEventListener("pointercancel", onHideTooltip);
}

