import {
  AUTO_APPLY_WAIT_MS,
  AUTO_STAGGER_PATCH_MS,
  DRAG_ARROW_SIZE,
  DRAG_ENDPOINT_OUTER_RADIUS,
  DRAG_ENDPOINT_RING_WIDTH,
  DRAG_LINE_INNER_ALPHA,
  DRAG_LINE_INNER_COLOR,
  DRAG_LINE_INNER_WIDTH,
  DRAG_LINE_OUTER_COLOR,
  DRAG_LINE_OUTER_WIDTH,
  DRAG_START_THRESHOLD_PX,
  DRAG_STYLE_SCALE_EXP,
  ICON_SRC_ATK,
  ICON_SRC_DEF,
  ICON_SRC_WOUND,
  KEYS,
  OVERLAY_FONT_SIZE,
  PreciseTextClass,
  TOKEN_CONTROL_PAD
} from "../../runtime/overlay-runtime-constants.js";
import { getTowCombatOverlayActionsApi } from "../../bootstrap/register-public-apis.js";
import {
  towCombatOverlayBindTooltipHandlers,
  towCombatOverlayCanEditActor,
  towCombatOverlayForEachSceneToken,
  towCombatOverlayGetActorFromToken,
  towCombatOverlayGetMouseButton,
  towCombatOverlayGetOverlayEdgePadPx,
  towCombatOverlayGetScreenPoint,
  towCombatOverlayGetTokenOverlayScale,
  towCombatOverlayGetWorldPoint,
  towCombatOverlayIsShiftModifier,
  towCombatOverlayPreventPointerDefault,
  towCombatOverlayTokenAtPoint
} from "../shared/core-helpers-service.js";
import {
  towCombatOverlayAddWound,
  towCombatOverlayGetWoundCount,
  towCombatOverlayRemoveWound
} from "../layout/wound-state-service.js";
import { towCombatOverlayClearDisplayObject } from "../layout/token-layout-service.js";
import { towCombatOverlayEnsureTowActions } from "../shared/actions-bridge-service.js";
import {
  createTowCombatOverlayAutomationCoordinator,
  towCombatOverlayAutomation
} from "../automation/automation-service.js";
import {
  towCombatOverlayCreateOverlayIconSprite,
  towCombatOverlayDrawHitBoxRect,
  towCombatOverlayGetIconValueStyle,
  towCombatOverlayTuneOverlayText
} from "./control-style-service.js";

function getOverlayControlsAutomationRef() {
  return towCombatOverlayAutomation ?? createTowCombatOverlayAutomationCoordinator();
}

function getDragLineStyle(sourceToken) {
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

function createDragLine() {
  const graphics = new PIXI.Graphics();
  graphics.eventMode = "none";
  canvas.tokens.addChild(graphics);
  return graphics;
}

function clearDragLine(graphics) {
  if (!graphics) return;
  graphics.parent?.removeChild(graphics);
  graphics.destroy();
}

function drawDragLine(graphics, origin, point, style) {
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

function shouldRunDragAttack(sourceToken, targetToken) {
  return !!sourceToken && !!targetToken && sourceToken.id !== targetToken.id;
}

async function setSingleTarget(targetToken) {
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

export function towCombatOverlayCreateWoundControlUI(tokenObject) {
  for (const child of canvas.tokens.children ?? []) {
    if (child?.[KEYS.woundUiMarker] === true && child?.[KEYS.woundUiTokenId] === tokenObject.id) {
      towCombatOverlayClearDisplayObject(child);
    }
  }

  const container = new PIXI.Container();
  container.eventMode = "passive";
  container.interactiveChildren = true;
  container[KEYS.woundUiMarker] = true;
  container[KEYS.woundUiTokenId] = tokenObject.id;

  const countText = new PreciseTextClass("", towCombatOverlayGetIconValueStyle());
  towCombatOverlayTuneOverlayText(countText);
  countText.anchor.set(0, 0.5);
  countText.eventMode = "none";
  const countIcon = towCombatOverlayCreateOverlayIconSprite(ICON_SRC_WOUND, OVERLAY_FONT_SIZE + 1);

  const countHitBox = new PIXI.Graphics();
  countHitBox.eventMode = "static";
  countHitBox.interactive = true;
  countHitBox.buttonMode = true;
  countHitBox.cursor = "pointer";

  const attackIcon = towCombatOverlayCreateOverlayIconSprite(ICON_SRC_ATK, OVERLAY_FONT_SIZE + 2);
  const defenceIcon = towCombatOverlayCreateOverlayIconSprite(ICON_SRC_DEF, OVERLAY_FONT_SIZE + 2);

  const attackHitBox = new PIXI.Graphics();
  attackHitBox.eventMode = "static";
  attackHitBox.interactive = true;
  attackHitBox.buttonMode = true;
  attackHitBox.cursor = "grab";

  const defenceHitBox = new PIXI.Graphics();
  defenceHitBox.eventMode = "static";
  defenceHitBox.interactive = true;
  defenceHitBox.buttonMode = true;
  defenceHitBox.cursor = "pointer";

  countHitBox.on("pointerdown", async (event) => {
    towCombatOverlayPreventPointerDefault(event);
    const actor = towCombatOverlayGetActorFromToken(tokenObject);
    if (!actor) return;
    if (towCombatOverlayGetMouseButton(event) !== 0) return;
    await towCombatOverlayAddWound(actor);
  });
  countHitBox.on("rightdown", async (event) => {
    towCombatOverlayPreventPointerDefault(event);
    const actor = towCombatOverlayGetActorFromToken(tokenObject);
    if (!actor) return;
    await towCombatOverlayRemoveWound(actor);
  });
  countHitBox.on("contextmenu", towCombatOverlayPreventPointerDefault);
  towCombatOverlayBindTooltipHandlers(countHitBox, () => ({
    title: "Wounds",
    description: "Left-click adds 1 wound. Right-click removes 1 wound."
  }));

  attackHitBox.on("pointerdown", async (event) => {
    towCombatOverlayPreventPointerDefault(event);
    if (towCombatOverlayGetMouseButton(event) !== 0) return;

    const sourceToken = tokenObject;
    const sourceActor = towCombatOverlayGetActorFromToken(sourceToken);
    if (!sourceActor) return;
    if (!(await towCombatOverlayEnsureTowActions())) return;

    const pointerDownShift = towCombatOverlayIsShiftModifier(event);
    const origin = {
      x: sourceToken.x + (sourceToken.w / 2),
      y: sourceToken.y + (sourceToken.h / 2)
    };
    const startScreenPoint = towCombatOverlayGetScreenPoint(event) ?? towCombatOverlayGetWorldPoint(event) ?? origin;
    let dragStarted = false;
    let dragFinished = false;
    let dragLine = null;
    const dragStyle = getDragLineStyle(sourceToken);
    attackHitBox.cursor = "grabbing";

    const cleanupDrag = () => {
      canvas.stage.off("pointermove", onDragMove);
      canvas.stage.off("pointerup", finishDrag);
      canvas.stage.off("pointerupoutside", finishDrag);
      clearDragLine(dragLine);
      dragLine = null;
      attackHitBox.cursor = "grab";
    };

    const onDragMove = (moveEvent) => {
      const point = towCombatOverlayGetWorldPoint(moveEvent);
      if (!point) return;
      const screenPoint = towCombatOverlayGetScreenPoint(moveEvent) ?? point;
      const dx = screenPoint.x - startScreenPoint.x;
      const dy = screenPoint.y - startScreenPoint.y;
      if (!dragStarted) {
        if (Math.hypot(dx, dy) < DRAG_START_THRESHOLD_PX) return;
        dragStarted = true;
        dragLine = createDragLine();
      }
      drawDragLine(dragLine, origin, point, dragStyle);
    };

    const finishDrag = async (upEvent) => {
      if (dragFinished) return;
      dragFinished = true;
      cleanupDrag();

      const shiftManual = pointerDownShift || towCombatOverlayIsShiftModifier(upEvent);
      const actionsApi = getTowCombatOverlayActionsApi();
      if (!dragStarted) {
        await actionsApi.attackActor(sourceActor, { manual: shiftManual });
        return;
      }

      const point = towCombatOverlayGetWorldPoint(upEvent);
      const target = towCombatOverlayTokenAtPoint(point, { excludeTokenId: sourceToken.id });
      if (!target) return;
      if (!shouldRunDragAttack(sourceToken, target)) return;

      await setSingleTarget(target);
      const armAutoOpposedFlow = () => {
        const automation = getOverlayControlsAutomationRef();
        const sourceBeforeState = automation.snapshotActorState(sourceActor);
        const restoreStaggerPrompt = automation.armDefaultStaggerChoiceWound(AUTO_STAGGER_PATCH_MS);
        automation.armAutoDefenceForOpposed(sourceToken, target, { sourceBeforeState });
        return () => setTimeout(() => restoreStaggerPrompt(), AUTO_APPLY_WAIT_MS);
      };
      if (shiftManual) {
        await actionsApi.attackActor(sourceActor, {
          manual: true,
          onFastAuto: async () => armAutoOpposedFlow()()
        });
        return;
      }

      const restoreAutoFlow = armAutoOpposedFlow();
      try {
        await actionsApi.attackActor(sourceActor, { manual: false });
      } finally {
        restoreAutoFlow();
      }
    };

    canvas.stage.on("pointermove", onDragMove);
    canvas.stage.on("pointerup", finishDrag);
    canvas.stage.on("pointerupoutside", finishDrag);
  });
  attackHitBox.on("contextmenu", towCombatOverlayPreventPointerDefault);
  towCombatOverlayBindTooltipHandlers(attackHitBox, () => ({
    title: "Attack",
    description: "Attack roll. Left-click attacks. Drag to a target for quick targeting. Hold Shift for manual mode."
  }));

  defenceHitBox.on("pointerdown", async (event) => {
    towCombatOverlayPreventPointerDefault(event);
    if (towCombatOverlayGetMouseButton(event) !== 0) return;
    const actor = towCombatOverlayGetActorFromToken(tokenObject);
    if (!actor) return;
    if (!(await towCombatOverlayEnsureTowActions())) return;
    const actionsApi = getTowCombatOverlayActionsApi();
    await actionsApi.defenceActor(actor, { manual: actionsApi.isShiftHeld() });
  });
  defenceHitBox.on("contextmenu", towCombatOverlayPreventPointerDefault);
  towCombatOverlayBindTooltipHandlers(defenceHitBox, () => ({
    title: "Defence",
    description: "Defence roll. Left-click defends. Hold Shift for manual mode."
  }));

  container.addChild(countHitBox, countIcon, countText, attackHitBox, defenceHitBox, attackIcon, defenceIcon);
  container._countText = countText;
  container._countIcon = countIcon;
  container._countHitBox = countHitBox;
  container._attackHitBox = attackHitBox;
  container._defenceHitBox = defenceHitBox;
  container._attackIcon = attackIcon;
  container._defenceIcon = defenceIcon;

  tokenObject.addChild(container);
  tokenObject[KEYS.woundUI] = container;
  return container;
}

export function towCombatOverlayUpdateWoundControlUI(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;

  const count = towCombatOverlayGetWoundCount(tokenObject.document);
  if (count === null || count === undefined) {
    const ui = tokenObject[KEYS.woundUI];
    if (!ui) return;
    towCombatOverlayClearDisplayObject(ui);
    delete tokenObject[KEYS.woundUI];
    return;
  }

  const existingUi = tokenObject[KEYS.woundUI];
  const hasBrokenTextStyle = !!existingUi && (
    !existingUi._countText ||
    !existingUi._countIcon ||
    !existingUi._attackIcon ||
    !existingUi._defenceIcon ||
    existingUi._countText.destroyed ||
    existingUi._countIcon.destroyed ||
    existingUi._attackIcon.destroyed ||
    existingUi._defenceIcon.destroyed ||
    !existingUi._countText.style
  );
  const staleUi = !!existingUi && (
    existingUi.destroyed ||
    existingUi.parent == null ||
    existingUi.parent !== tokenObject ||
    hasBrokenTextStyle ||
    existingUi._attackHitBox?.destroyed ||
    existingUi._defenceHitBox?.destroyed ||
    existingUi._countHitBox?.destroyed
  );
  if (staleUi) {
    towCombatOverlayClearDisplayObject(existingUi);
    delete tokenObject[KEYS.woundUI];
  }

  const ui = (!tokenObject[KEYS.woundUI] || tokenObject[KEYS.woundUI].destroyed)
    ? towCombatOverlayCreateWoundControlUI(tokenObject)
    : tokenObject[KEYS.woundUI];
  const actor = towCombatOverlayGetActorFromToken(tokenObject);
  const overlayScale = towCombatOverlayGetTokenOverlayScale(tokenObject);
  const edgePad = towCombatOverlayGetOverlayEdgePadPx(tokenObject) ?? TOKEN_CONTROL_PAD;
  const inverseScale = (overlayScale > 0) ? (1 / overlayScale) : 1;
  ui.scale.set(overlayScale);

  const countText = ui._countText;
  const countIcon = ui._countIcon;
  const countHitBox = ui._countHitBox;
  const attackHitBox = ui._attackHitBox;
  const defenceHitBox = ui._defenceHitBox;
  const attackIcon = ui._attackIcon;
  const defenceIcon = ui._defenceIcon;
  towCombatOverlayTuneOverlayText(countText);
  countText.text = `${count}`;

  const padX = 3;
  const padY = 2;
  const rowGap = Math.max(18, countText.height + 4);
  const rightBottomY = rowGap / 2;
  const leftTopY = -(rowGap / 2);
  const leftBottomY = leftTopY + rowGap;

  const countGap = 4;
  countIcon.position.set(0, Math.round(rightBottomY - (countIcon.height / 2)));
  countText.position.set(Math.round(countIcon.width + countGap), Math.round(rightBottomY));
  const countBlockWidth = countIcon.width + countGap + countText.width;
  const countBlockHeight = Math.max(countIcon.height, countText.height);
  towCombatOverlayDrawHitBoxRect(
    countHitBox,
    -padX,
    rightBottomY - (countBlockHeight / 2) - padY,
    countBlockWidth + (padX * 2),
    countBlockHeight + (padY * 2)
  );

  ui.position.set(Math.round(tokenObject.w + edgePad), Math.round(tokenObject.h / 2));

  const leftX = -((tokenObject.w + (edgePad * 2)) * inverseScale);
  attackIcon.position.set(Math.round(leftX - attackIcon.width), Math.round(leftTopY - (attackIcon.height / 2)));
  defenceIcon.position.set(Math.round(leftX - defenceIcon.width), Math.round(leftBottomY - (defenceIcon.height / 2)));

  if (overlayScale > 0) {
    const targetLeftRightEdge = (-edgePad - ui.position.x) / overlayScale;
    const currentLeftRightEdge = Math.max(
      Number(attackIcon.x ?? 0) + Number(attackIcon.width ?? 0),
      Number(defenceIcon.x ?? 0) + Number(defenceIcon.width ?? 0)
    );
    const leftDelta = Math.round(targetLeftRightEdge - currentLeftRightEdge);
    if (leftDelta !== 0) {
      attackIcon.x += leftDelta;
      defenceIcon.x += leftDelta;
    }
  }

  towCombatOverlayDrawHitBoxRect(attackHitBox, attackIcon.x - padX, attackIcon.y - padY, attackIcon.width + (padX * 2), attackIcon.height + (padY * 2));
  towCombatOverlayDrawHitBoxRect(defenceHitBox, defenceIcon.x - padX, defenceIcon.y - padY, defenceIcon.width + (padX * 2), defenceIcon.height + (padY * 2));

  const editable = towCombatOverlayCanEditActor(actor);
  countText.alpha = editable ? 1 : 0.45;
  countIcon.alpha = editable ? 1 : 0.45;
  attackIcon.alpha = 1;
  defenceIcon.alpha = 1;
  ui.visible = tokenObject.visible;
}

export function towCombatOverlayClearAllWoundControls() {
  towCombatOverlayForEachSceneToken((token) => {
    const ui = token[KEYS.woundUI];
    if (!ui) return;
    towCombatOverlayClearDisplayObject(ui);
    delete token[KEYS.woundUI];
  });

  const orphaned = [];
  for (const child of canvas.tokens.children ?? []) {
    const marked = child?.[KEYS.woundUiMarker] === true;
    const legacyLikelyWoundUi = child?._countText && child?._attackText && child?._defenceText;
    if (marked || legacyLikelyWoundUi) orphaned.push(child);
  }
  for (const ui of orphaned) towCombatOverlayClearDisplayObject(ui);
}
