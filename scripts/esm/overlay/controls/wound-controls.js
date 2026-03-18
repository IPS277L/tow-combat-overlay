import {
  AUTO_APPLY_WAIT_MS,
  AUTO_STAGGER_PATCH_MS,
  DRAG_START_THRESHOLD_PX,
  ICON_SRC_ATK,
  ICON_SRC_DEF,
  ICON_SRC_WOUND,
  KEYS,
  OVERLAY_CONTROL_ROW_GAP_PX,
  OVERLAY_FONT_SIZE,
  PreciseTextClass,
  ROLL_MODIFIER_GLORIOUS_TINT,
  ROLL_MODIFIER_GRIM_TINT,
  TOKEN_CONTROL_PAD,
  WOUND_CONTROL_LEFT_GROUP_INSET_PX,
  WOUND_CONTROL_MODIFIER_SIGN_SLOT_WIDTH
} from "../../runtime/overlay-constants.js";
import { getTowCombatOverlayConstants } from "../../runtime/module-constants.js";
import { getTowCombatOverlayActionsApi } from "../../api/module-api-registry.js";
import {
  adjustTowCombatOverlayActorRollModifierDice,
  cycleTowCombatOverlayActorRollState,
  getTowCombatOverlayActorRollModifierState
} from "../../combat/roll-modifier.js";
import {
  towCombatOverlayBindTooltipHandlers,
  towCombatOverlayCanEditActor,
  towCombatOverlayForEachSceneToken,
  towCombatOverlayGetActorFromToken,
  towCombatOverlayGetMouseButton,
  towCombatOverlayGetOverlayEdgePadPx,
  towCombatOverlayGetScreenPoint,
  towCombatOverlayGetWorldPoint,
  towCombatOverlayIsShiftModifier,
  towCombatOverlayPreventPointerDefault,
  towCombatOverlayTokenAtPoint
} from "../shared/core-helpers.js";
import {
  towCombatOverlayAddWound,
  towCombatOverlayGetWoundCount,
  towCombatOverlayRemoveWound
} from "../layout/wound-state.js";
import { towCombatOverlayClearDisplayObject } from "../layout/token-layout.js";
import { towCombatOverlayEnsureActionsApi } from "../shared/actions-bridge.js";
import {
  createTowCombatOverlayAutomationCoordinator,
  towCombatOverlayAutomation
} from "../automation/automation.js";
import {
  towCombatOverlayCreateOverlayIconSprite,
  towCombatOverlayDrawHitBoxRect,
  towCombatOverlayGetIconValueStyle,
  towCombatOverlayTuneOverlayText
} from "./control-style.js";
import {
  clearDragLine,
  createDragLine,
  drawDragLine,
  getDragLineStyle,
  setSingleTarget,
  shouldRunDragAttack
} from "./wound-controls-drag.js";

const { tooltips: MODULE_TOOLTIPS } = getTowCombatOverlayConstants();

function getOverlayControlsAutomationRef() {
  return towCombatOverlayAutomation ?? createTowCombatOverlayAutomationCoordinator();
}

function getRollModifierStateTint(rollState) {
  if (rollState === "grim") return ROLL_MODIFIER_GRIM_TINT;
  if (rollState === "glorious") return ROLL_MODIFIER_GLORIOUS_TINT;
  return 0xFFFFFF;
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
  const actionSeparatorText = new PreciseTextClass("·", towCombatOverlayGetIconValueStyle());
  towCombatOverlayTuneOverlayText(actionSeparatorText);
  if (actionSeparatorText.style) actionSeparatorText.style.fontSize = OVERLAY_FONT_SIZE + 11;
  actionSeparatorText.anchor.set(0, 0.5);
  actionSeparatorText.eventMode = "none";

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

  const modifierText = new PreciseTextClass("", towCombatOverlayGetIconValueStyle());
  towCombatOverlayTuneOverlayText(modifierText);
  if (modifierText.style) modifierText.style.fill = "#FFF4D8";
  modifierText.anchor.set(0, 0.5);
  modifierText.eventMode = "none";
  const modifierSignText = new PreciseTextClass("+", towCombatOverlayGetIconValueStyle());
  towCombatOverlayTuneOverlayText(modifierSignText);
  if (modifierSignText.style) modifierSignText.style.fill = "#FFF4D8";
  modifierSignText.anchor.set(0, 0.5);
  modifierSignText.eventMode = "none";

  const modifierHitBox = new PIXI.Graphics();
  modifierHitBox.eventMode = "static";
  modifierHitBox.interactive = true;
  modifierHitBox.buttonMode = true;
  modifierHitBox.cursor = "pointer";

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
  towCombatOverlayBindTooltipHandlers(countHitBox, () => MODULE_TOOLTIPS.wounds);

  attackHitBox.on("pointerdown", async (event) => {
    towCombatOverlayPreventPointerDefault(event);
    if (towCombatOverlayGetMouseButton(event) !== 0) return;

    const sourceToken = tokenObject;
    const sourceActor = towCombatOverlayGetActorFromToken(sourceToken);
    if (!sourceActor) return;
    if (!(await towCombatOverlayEnsureActionsApi())) return;

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
  towCombatOverlayBindTooltipHandlers(attackHitBox, () => MODULE_TOOLTIPS.attack);

  defenceHitBox.on("pointerdown", async (event) => {
    towCombatOverlayPreventPointerDefault(event);
    if (towCombatOverlayGetMouseButton(event) !== 0) return;
    const actor = towCombatOverlayGetActorFromToken(tokenObject);
    if (!actor) return;
    if (!(await towCombatOverlayEnsureActionsApi())) return;
    const actionsApi = getTowCombatOverlayActionsApi();
    await actionsApi.defenceActor(actor, { manual: actionsApi.isShiftHeld() });
  });
  defenceHitBox.on("contextmenu", towCombatOverlayPreventPointerDefault);
  towCombatOverlayBindTooltipHandlers(defenceHitBox, () => MODULE_TOOLTIPS.defence);

  modifierHitBox.on("pointerdown", async (event) => {
    towCombatOverlayPreventPointerDefault(event);
    if (towCombatOverlayGetMouseButton(event) !== 0) return;
    const actor = towCombatOverlayGetActorFromToken(tokenObject);
    if (!towCombatOverlayCanEditActor(actor)) return;
    if (towCombatOverlayIsShiftModifier(event)) {
      await cycleTowCombatOverlayActorRollState(actor, 1);
      return;
    }
    await adjustTowCombatOverlayActorRollModifierDice(actor, 1);
  });
  modifierHitBox.on("rightdown", async (event) => {
    towCombatOverlayPreventPointerDefault(event);
    const actor = towCombatOverlayGetActorFromToken(tokenObject);
    if (!towCombatOverlayCanEditActor(actor)) return;
    await adjustTowCombatOverlayActorRollModifierDice(actor, -1);
  });
  modifierHitBox.on("contextmenu", towCombatOverlayPreventPointerDefault);
  towCombatOverlayBindTooltipHandlers(modifierHitBox, () => MODULE_TOOLTIPS.rollModifier);

  container.addChild(
    countHitBox,
    countIcon,
    countText,
    attackHitBox,
    defenceHitBox,
    attackIcon,
    actionSeparatorText,
    defenceIcon,
    modifierHitBox,
    modifierSignText,
    modifierText
  );
  container[KEYS.woundUiCountText] = countText;
  container[KEYS.woundUiCountIcon] = countIcon;
  container[KEYS.woundUiCountHitBox] = countHitBox;
  container[KEYS.woundUiAttackHitBox] = attackHitBox;
  container[KEYS.woundUiDefenceHitBox] = defenceHitBox;
  container[KEYS.woundUiAttackIcon] = attackIcon;
  container[KEYS.woundUiActionSeparatorText] = actionSeparatorText;
  container[KEYS.woundUiDefenceIcon] = defenceIcon;
  container[KEYS.woundUiModifierSignText] = modifierSignText;
  container[KEYS.woundUiModifierText] = modifierText;
  container[KEYS.woundUiModifierHitBox] = modifierHitBox;

  tokenObject.addChild(container);
  tokenObject[KEYS.woundUi] = container;
  return container;
}

export function towCombatOverlayUpdateWoundControlUI(tokenObject) {
  if (!tokenObject || tokenObject.destroyed) return;

  const count = towCombatOverlayGetWoundCount(tokenObject.document);
  if (count === null || count === undefined) {
    const ui = tokenObject[KEYS.woundUi];
    if (!ui) return;
    towCombatOverlayClearDisplayObject(ui);
    delete tokenObject[KEYS.woundUi];
    return;
  }

  const existingUi = tokenObject[KEYS.woundUi];
  const hasBrokenTextStyle = !!existingUi && (
    !existingUi[KEYS.woundUiCountText] ||
    !existingUi[KEYS.woundUiCountIcon] ||
    !existingUi[KEYS.woundUiAttackIcon] ||
    !existingUi[KEYS.woundUiActionSeparatorText] ||
    !existingUi[KEYS.woundUiDefenceIcon] ||
    !existingUi[KEYS.woundUiModifierSignText] ||
    !existingUi[KEYS.woundUiModifierText] ||
    existingUi[KEYS.woundUiCountText].destroyed ||
    existingUi[KEYS.woundUiCountIcon].destroyed ||
    existingUi[KEYS.woundUiAttackIcon].destroyed ||
    existingUi[KEYS.woundUiActionSeparatorText].destroyed ||
    existingUi[KEYS.woundUiDefenceIcon].destroyed ||
    existingUi[KEYS.woundUiModifierSignText].destroyed ||
    existingUi[KEYS.woundUiModifierText].destroyed ||
    !existingUi[KEYS.woundUiCountText].style
  );
  const staleUi = !!existingUi && (
    existingUi.destroyed ||
    existingUi.parent == null ||
    existingUi.parent !== tokenObject ||
    hasBrokenTextStyle ||
    existingUi[KEYS.woundUiAttackHitBox]?.destroyed ||
    existingUi[KEYS.woundUiDefenceHitBox]?.destroyed ||
    existingUi[KEYS.woundUiCountHitBox]?.destroyed ||
    existingUi[KEYS.woundUiModifierHitBox]?.destroyed
  );
  if (staleUi) {
    towCombatOverlayClearDisplayObject(existingUi);
    delete tokenObject[KEYS.woundUi];
  }

  const ui = (!tokenObject[KEYS.woundUi] || tokenObject[KEYS.woundUi].destroyed)
    ? towCombatOverlayCreateWoundControlUI(tokenObject)
    : tokenObject[KEYS.woundUi];
  const actor = towCombatOverlayGetActorFromToken(tokenObject);
  const overlayScale = towCombatOverlayGetTokenOverlayScale(tokenObject);
  const edgePad = towCombatOverlayGetOverlayEdgePadPx(tokenObject) ?? TOKEN_CONTROL_PAD;
  const inverseScale = (overlayScale > 0) ? (1 / overlayScale) : 1;
  ui.scale.set(overlayScale);

  const countText = ui[KEYS.woundUiCountText];
  const countIcon = ui[KEYS.woundUiCountIcon];
  const countHitBox = ui[KEYS.woundUiCountHitBox];
  const attackHitBox = ui[KEYS.woundUiAttackHitBox];
  const defenceHitBox = ui[KEYS.woundUiDefenceHitBox];
  const attackIcon = ui[KEYS.woundUiAttackIcon];
  const actionSeparatorText = ui[KEYS.woundUiActionSeparatorText];
  const defenceIcon = ui[KEYS.woundUiDefenceIcon];
  const modifierSignText = ui[KEYS.woundUiModifierSignText];
  const modifierText = ui[KEYS.woundUiModifierText];
  const modifierHitBox = ui[KEYS.woundUiModifierHitBox];
  towCombatOverlayTuneOverlayText(countText);
  countText.text = `${count}`;
  towCombatOverlayTuneOverlayText(actionSeparatorText);
  towCombatOverlayTuneOverlayText(modifierSignText);
  towCombatOverlayTuneOverlayText(modifierText);
  const rollModifier = getTowCombatOverlayActorRollModifierState(actor);
  const modifierSign = rollModifier.diceModifier >= 0 ? "+" : "-";
  const modifierValue = `${Math.abs(rollModifier.diceModifier)}d10`;
  const modifierTint = getRollModifierStateTint(rollModifier.rollState);
  if (modifierSignText.text !== modifierSign) modifierSignText.text = modifierSign;
  if (modifierText.text !== modifierValue) {
    modifierText.text = modifierValue;
  }
  if (typeof modifierSignText.tint !== "undefined" && modifierSignText.tint !== modifierTint) modifierSignText.tint = modifierTint;
  if (typeof modifierText.tint !== "undefined" && modifierText.tint !== modifierTint) modifierText.tint = modifierTint;

  const padX = 0;
  const padY = 0;
  const modifierSignSlotWidth = WOUND_CONTROL_MODIFIER_SIGN_SLOT_WIDTH;
  const modifierOffsetX = -2;
  const modifierOffsetY = 0;
  const rowGap = OVERLAY_CONTROL_ROW_GAP_PX;
  const rightBottomY = rowGap / 2;
  const actionY = Math.round(-rowGap / 2);
  const modifierY = Math.round(rowGap / 2);

  const countGap = 4;
  countIcon.position.set(0, Math.round(rightBottomY - (countIcon.height / 2)));
  countText.position.set(Math.round(countIcon.width + countGap), Math.round(rightBottomY));
  const countIconBounds = countIcon.getLocalBounds();
  const countTextBounds = countText.getLocalBounds();
  const countHitLeft = Math.min(countIcon.x + countIconBounds.x, countText.x + countTextBounds.x);
  const countHitTop = Math.min(countIcon.y + countIconBounds.y, countText.y + countTextBounds.y);
  const countHitRight = Math.max(
    countIcon.x + countIconBounds.x + countIconBounds.width,
    countText.x + countTextBounds.x + countTextBounds.width
  );
  const countHitBottom = Math.max(
    countIcon.y + countIconBounds.y + countIconBounds.height,
    countText.y + countTextBounds.y + countTextBounds.height
  );
  towCombatOverlayDrawHitBoxRect(
    countHitBox,
    Math.round(countHitLeft - padX),
    Math.round(countHitTop - padY),
    Math.round(Math.max(1, (countHitRight - countHitLeft) + (padX * 2))),
    Math.round(Math.max(1, (countHitBottom - countHitTop) + (padY * 2)))
  );

  ui.position.set(Math.round(tokenObject.w + edgePad), Math.round(tokenObject.h / 2));

  const leftRightEdgeX = (-edgePad - ui.position.x) * inverseScale;
  const leftGroupInsetPx = WOUND_CONTROL_LEFT_GROUP_INSET_PX;
  const actionGap = 0;
  const actionBlockWidth = attackIcon.width + actionGap + actionSeparatorText.width + actionGap + defenceIcon.width;
  const actionBlockLeft = Math.round(leftRightEdgeX - actionBlockWidth + leftGroupInsetPx);
  const attackIconNudgeX = 0;
  attackIcon.position.set(actionBlockLeft + attackIconNudgeX, Math.round(actionY - (attackIcon.height / 2)));
  actionSeparatorText.position.set(
    Math.round(actionBlockLeft + attackIcon.width + actionGap),
    Math.round(actionY)
  );
  defenceIcon.position.set(
    Math.round(actionSeparatorText.x + actionSeparatorText.width + actionGap),
    Math.round(actionY - (defenceIcon.height / 2))
  );
  const signBounds = modifierSignText.getLocalBounds();
  const valueBounds = modifierText.getLocalBounds();
  const visualLeft = Math.min(signBounds.x, modifierSignSlotWidth + valueBounds.x);
  const modifierLabelLeft = Math.round(actionBlockLeft + attackIconNudgeX - visualLeft);
  modifierSignText.position.set(modifierLabelLeft + modifierOffsetX, Math.round(modifierY + modifierOffsetY));
  modifierText.position.set(modifierLabelLeft + modifierSignSlotWidth + modifierOffsetX, Math.round(modifierY + modifierOffsetY));

  const actionHitPadX = 0;
  const actionHitPadY = 0;
  const attackBounds = attackIcon.getLocalBounds();
  const defenceBounds = defenceIcon.getLocalBounds();
  towCombatOverlayDrawHitBoxRect(
    attackHitBox,
    attackIcon.x + attackBounds.x - actionHitPadX,
    attackIcon.y + attackBounds.y - actionHitPadY,
    Math.max(1, attackBounds.width + (actionHitPadX * 2)),
    Math.max(1, attackBounds.height + (actionHitPadY * 2))
  );
  towCombatOverlayDrawHitBoxRect(
    defenceHitBox,
    defenceIcon.x + defenceBounds.x - actionHitPadX,
    defenceIcon.y + defenceBounds.y - actionHitPadY,
    Math.max(1, defenceBounds.width + (actionHitPadX * 2)),
    Math.max(1, defenceBounds.height + (actionHitPadY * 2))
  );
  const modifierSignBounds = modifierSignText.getLocalBounds();
  const modifierValueBounds = modifierText.getLocalBounds();
  const modifierHitLeft = Math.min(
    modifierSignText.x + modifierSignBounds.x,
    modifierText.x + modifierValueBounds.x
  );
  const modifierHitRight = Math.max(
    modifierSignText.x + modifierSignBounds.x + modifierSignBounds.width,
    modifierText.x + modifierValueBounds.x + modifierValueBounds.width
  );
  const modifierHitTop = Math.min(
    modifierSignText.y + modifierSignBounds.y,
    modifierText.y + modifierValueBounds.y
  );
  const modifierHitBottom = Math.max(
    modifierSignText.y + modifierSignBounds.y + modifierSignBounds.height,
    modifierText.y + modifierValueBounds.y + modifierValueBounds.height
  );
  towCombatOverlayDrawHitBoxRect(
    modifierHitBox,
    Math.round(modifierHitLeft - padX),
    Math.round(modifierHitTop - padY),
    Math.round(Math.max(1, (modifierHitRight - modifierHitLeft) + (padX * 2))),
    Math.round(Math.max(1, (modifierHitBottom - modifierHitTop) + (padY * 2)))
  );

  const editable = towCombatOverlayCanEditActor(actor);
  countText.alpha = editable ? 1 : 0.45;
  countIcon.alpha = editable ? 1 : 0.45;
  attackIcon.alpha = 1;
  actionSeparatorText.alpha = 1;
  defenceIcon.alpha = 1;
  modifierSignText.alpha = editable ? 1 : 0.45;
  modifierText.alpha = editable ? 1 : 0.45;
  ui.visible = tokenObject.visible;
}

export function towCombatOverlayClearAllWoundControls() {
  towCombatOverlayForEachSceneToken((token) => {
    const ui = token[KEYS.woundUi];
    if (!ui) return;
    towCombatOverlayClearDisplayObject(ui);
    delete token[KEYS.woundUi];
  });

  const orphaned = [];
  for (const child of canvas.tokens.children ?? []) {
    const marked = child?.[KEYS.woundUiMarker] === true;
    const legacyLikelyWoundUi = child?._countText && child?._attackText && child?._defenceText;
    if (marked || legacyLikelyWoundUi) orphaned.push(child);
  }
  for (const ui of orphaned) towCombatOverlayClearDisplayObject(ui);
}

