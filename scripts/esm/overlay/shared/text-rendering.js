import {
  OVERLAY_TEXT_RESOLUTION_MAX,
  OVERLAY_TEXT_RESOLUTION_MIN,
  OVERLAY_TEXT_SCALE_BOOST
} from "../../runtime/overlay-constants.js";

export function towCombatOverlayTuneTextForScale(textObject, renderScale = 1) {
  if (!textObject) return;
  textObject.roundPixels = true;
  const devicePixelRatio = Math.max(1, Number(window.devicePixelRatio ?? 1));
  const canvasScale = Number(canvas?.stage?.scale?.x ?? 1);
  const zoom = (Number.isFinite(canvasScale) && canvasScale > 0) ? canvasScale : 1;
  const zoomBoost = zoom < 1 ? (1 / zoom) : 1;
  const scaleBoost = Math.max(1, (Number(renderScale) || 1) * OVERLAY_TEXT_SCALE_BOOST);
  const resolution = Math.min(
    OVERLAY_TEXT_RESOLUTION_MAX,
    Math.max(OVERLAY_TEXT_RESOLUTION_MIN, Math.ceil(devicePixelRatio * zoomBoost * scaleBoost))
  );
  if ("resolution" in textObject && textObject.resolution !== resolution) {
    textObject.resolution = resolution;
    textObject.dirty = true;
  }
}
