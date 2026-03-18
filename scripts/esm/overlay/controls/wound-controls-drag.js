import {
  DRAG_ARROW_SIZE,
  DRAG_ENDPOINT_OUTER_RADIUS,
  DRAG_ENDPOINT_RING_WIDTH,
  DRAG_LINE_INNER_ALPHA,
  DRAG_LINE_INNER_COLOR,
  DRAG_LINE_INNER_WIDTH,
  DRAG_LINE_OUTER_COLOR,
  DRAG_LINE_OUTER_WIDTH,
  DRAG_STYLE_SCALE_EXP
} from "../../runtime/overlay-constants.js";
import {
  towCombatOverlayGetTokenOverlayScale
} from "../shared/core-helpers.js";

export function getDragLineStyle(sourceToken) {
  const overlayScale = towCombatOverlayGetTokenOverlayScale(sourceToken);
  const scaleFactor = Math.max(0.26, Math.min(1.75, Math.pow(Math.max(overlayScale, 0.001), DRAG_STYLE_SCALE_EXP)));
  return {
    outerWidth: Math.round(Math.max(1.6, Math.min(DRAG_LINE_OUTER_WIDTH, DRAG_LINE_OUTER_WIDTH * scaleFactor)) * 100) / 100,
    innerWidth: Math.round(Math.max(0.9, Math.min(DRAG_LINE_INNER_WIDTH, DRAG_LINE_INNER_WIDTH * scaleFactor)) * 100) / 100,
    arrowSize: Math.round(Math.max(4.5, Math.min(DRAG_ARROW_SIZE, DRAG_ARROW_SIZE * scaleFactor)) * 100) / 100,
    endpointRadius: Math.round(Math.max(2.4, Math.min(DRAG_ENDPOINT_OUTER_RADIUS, DRAG_ENDPOINT_OUTER_RADIUS * scaleFactor)) * 100) / 100,
    endpointRingWidth: Math.round(Math.max(0.9, Math.min(DRAG_ENDPOINT_RING_WIDTH, DRAG_ENDPOINT_RING_WIDTH * scaleFactor)) * 100) / 100
  };
}

export function createDragLine() {
  const graphics = new PIXI.Graphics();
  graphics.eventMode = "none";
  canvas.tokens.addChild(graphics);
  return graphics;
}

export function clearDragLine(graphics) {
  if (!graphics) return;
  graphics.parent?.removeChild(graphics);
  graphics.destroy();
}

export function drawDragLine(graphics, origin, point, style) {
  if (!graphics || !origin || !point || !style) return;
  graphics.clear();

  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const angle = Math.atan2(dy, dx);
  const arrowSize = style.arrowSize * 0.76;
  const leftAngle = angle + ((Math.PI * 5) / 6);
  const rightAngle = angle - ((Math.PI * 5) / 6);
  const leftX = point.x + (Math.cos(leftAngle) * arrowSize);
  const leftY = point.y + (Math.sin(leftAngle) * arrowSize);
  const rightX = point.x + (Math.cos(rightAngle) * arrowSize);
  const rightY = point.y + (Math.sin(rightAngle) * arrowSize);
  const startRadius = style.endpointRadius + 0.8;
  const startRingWidth = Math.max(0.6, style.endpointRingWidth * 0.68);
  const outerLineWidth = Math.max(1, style.outerWidth - 0.7);
  const innerLineWidth = Math.max(1, style.innerWidth - 0.35);
  const startFillRadius = Math.max(1.5, startRadius - 0.9);

  graphics.lineStyle({
    width: outerLineWidth,
    color: DRAG_LINE_OUTER_COLOR,
    alpha: 1,
    alignment: 0.5,
    cap: "round",
    join: "round",
    miterLimit: 1,
    native: false
  });
  graphics.moveTo(origin.x, origin.y);
  graphics.lineTo(point.x, point.y);
  graphics.moveTo(point.x, point.y);
  graphics.lineTo(leftX, leftY);
  graphics.moveTo(point.x, point.y);
  graphics.lineTo(rightX, rightY);

  graphics.lineStyle({
    width: innerLineWidth,
    color: DRAG_LINE_INNER_COLOR,
    alpha: DRAG_LINE_INNER_ALPHA,
    alignment: 0.5,
    cap: "round",
    join: "round",
    miterLimit: 1,
    native: false
  });
  graphics.moveTo(origin.x, origin.y);
  graphics.lineTo(point.x, point.y);
  graphics.moveTo(point.x, point.y);
  graphics.lineTo(leftX, leftY);
  graphics.moveTo(point.x, point.y);
  graphics.lineTo(rightX, rightY);

  graphics.lineStyle({
    width: startRingWidth,
    color: DRAG_LINE_OUTER_COLOR,
    alpha: 1,
    alignment: 0.5,
    cap: "round",
    join: "round",
    miterLimit: 1,
    native: false
  });
  graphics.beginFill(DRAG_LINE_INNER_COLOR, DRAG_LINE_INNER_ALPHA);
  graphics.drawCircle(origin.x, origin.y, startFillRadius);
  graphics.endFill();
}

export function shouldRunDragAttack(sourceToken, targetToken) {
  return !!sourceToken && !!targetToken && sourceToken.id !== targetToken.id;
}

export async function setSingleTarget(targetToken) {
  if (!targetToken?.id) return;
  if (typeof game.user?.updateTokenTargets === "function") {
    game.user.updateTokenTargets([targetToken.id]);
    return;
  }

  const tokenObjects = canvas?.tokens?.placeables ?? [];
  for (const tokenObject of tokenObjects) {
    if (typeof tokenObject?.setTarget !== "function") continue;
    tokenObject.setTarget(tokenObject.id === targetToken.id, {
      releaseOthers: true,
      groupSelection: false,
      user: game.user
    });
  }
}

