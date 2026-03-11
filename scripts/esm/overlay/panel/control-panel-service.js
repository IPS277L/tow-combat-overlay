import {
  towCombatOverlayAddWound,
  towCombatOverlayGetMaxWoundLimit,
  towCombatOverlayGetResilienceValue,
  towCombatOverlayGetWoundCount,
  towCombatOverlayRemoveWound
} from "../layout/wound-state-service.js";
import { getTowCombatOverlayConstants } from "../../runtime/constants.js";
import { MODULE_KEY } from "../../runtime/overlay-runtime-constants.js";
import {
  AUTO_APPLY_WAIT_MS,
  AUTO_STAGGER_PATCH_MS,
  ICON_SRC_WOUND
} from "../../runtime/overlay-runtime-constants.js";
import {
  getTypeTooltipData,
  hideStatusTooltip,
  runActorOpLock,
  showOverlayTooltip,
  towCombatOverlayLocalizeSystemKey,
  towCombatOverlayResolveConditionLabel
} from "../shared/shared-service.js";
import {
  towCombatOverlayCanEditActor,
  towCombatOverlayCopyPoint,
  towCombatOverlayIsAltModifier,
  towCombatOverlayIsShiftModifier,
  towCombatOverlayTokenAtPoint,
  towCombatOverlayWarnNoPermission
} from "../shared/core-helpers-service.js";
import {
  towCombatOverlayAddActorCondition,
  towCombatOverlayRemoveActorCondition
} from "../shared/actions-bridge-service.js";
import {
  towCombatOverlayArmAutoSubmitDialog,
  towCombatOverlaySetupAbilityTestWithDamage
} from "../../combat/attack-service.js";
import { towCombatOverlayDefenceActor } from "../../combat/defence-service.js";
import {
  createTowCombatOverlayAutomationCoordinator,
  towCombatOverlayAutomation
} from "../automation/automation-service.js";
import {
  adjustTowCombatOverlayActorRollModifierDice,
  createTowCombatOverlayRollContext,
  cycleTowCombatOverlayActorRollState,
  getTowCombatOverlayActorRollModifierFields,
  getTowCombatOverlayActorRollModifierState,
  getTowCombatOverlayActorRollModifierStateLabel
} from "../../combat/roll-modifier-service.js";
import { getTowCombatOverlaySystemAdapter } from "../../system-adapter/system-adapter.js";

const PANEL_ID = "tow-combat-overlay-control-panel";
const PANEL_SELECTION_ID = "tow-combat-overlay-selection-panel";
const PANEL_TEMPLATE_PATH = "modules/tow-combat-overlay/templates/overlay/control-panel.hbs";
const PANEL_LOCAL_STORAGE_KEY = "tow-combat-overlay.control-panel-position.v1";
const PANEL_STATE_KEY = "__towCombatOverlayControlPanelState";
const PANEL_VIEWPORT_MARGIN_PX = 8;
const PANEL_SELECTION_GAP_PX = 8;
const PANEL_FALLBACK_ITEM_ICON = "icons/svg/item-bag.svg";
const PANEL_RESILIENCE_ICON = "icons/svg/shield.svg";
const PANEL_DEBUG_ITEMS = false;
const PANEL_ATTACK_PICK_CURSOR = "crosshair";
const PANEL_MANOEUVRE_ICON_BY_KEY = {
  run: "systems/whtow/assets/icons/give-ground.svg",
  charge: "systems/whtow/assets/icons/conditions/prone.svg",
  moveQuietly: "systems/whtow/assets/icons/conditions/distracted.svg",
  moveCarefully: "systems/whtow/assets/icons/conditions/defenceless.svg"
};
const PANEL_MANOEUVRE_ORDER = ["run", "charge", "moveQuietly", "moveCarefully"];
const PANEL_RECOVER_ICON_BY_KEY = {
  recover: "systems/whtow/assets/icons/conditions/staggered.svg",
  treat: "systems/whtow/assets/icons/conditions/critical.svg",
  condition: "systems/whtow/assets/icons/conditions/dead.svg"
};
const PANEL_RECOVER_ORDER = ["recover", "treat", "condition"];
const PANEL_ACTIONS_ORDER = ["aim", "help", "improvise", "defence"];
const PANEL_ACTION_ICON_BY_KEY = {
  aim: "systems/whtow/assets/icons/conditions/distracted.svg",
  help: "systems/whtow/assets/icons/conditions/defenceless.svg",
  improvise: "systems/whtow/assets/icons/conditions/broken.svg",
  defence: "systems/whtow/assets/icons/conditions/defenceless.svg"
};
const { tooltips: MODULE_TOOLTIPS } = getTowCombatOverlayConstants();

function localizeMaybe(key, fallback = "") {
  const localized = game?.i18n?.localize?.(String(key ?? ""));
  if (typeof localized === "string" && localized !== key) return localized;
  return String(fallback ?? key ?? "");
}

function getAllConditionEntries() {
  const conditions = game.oldworld?.config?.conditions ?? {};
  return Object.entries(conditions)
    .map(([id, data]) => {
      const key = String(id ?? "").trim();
      if (!key) return null;
      const rawLabel = String(data?.name ?? key);
      const label = rawLabel.startsWith("TOW.") ? localizeMaybe(rawLabel, key) : rawLabel;
      const img = String(data?.img ?? data?.icon ?? `/systems/whtow/assets/icons/conditions/${key}.svg`);
      return {
        id: key,
        img,
        label
      };
    })
    .filter(Boolean);
}

function getActorStatusSet(actor) {
  const statuses = new Set(Array.from(actor?.statuses ?? []).map((s) => String(s)));
  for (const effect of Array.from(actor?.effects?.contents ?? [])) {
    for (const status of Array.from(effect?.statuses ?? [])) statuses.add(String(status));
  }
  return statuses;
}

function getActorEffectsByStatus(actor, conditionId) {
  const id = String(conditionId ?? "");
  if (!id) return [];
  return Array.from(actor?.effects?.contents ?? []).filter((effect) => (
    Array.from(effect?.statuses ?? []).map(String).includes(id)
  ));
}

async function setActorConditionState(actor, conditionId, active) {
  if (!actor || !conditionId) return;
  const id = String(conditionId);
  if (id !== "staggered" && typeof actor.toggleStatusEffect === "function") {
    try {
      await actor.toggleStatusEffect(id, { active });
      return;
    } catch (_error) {
      // Fall through to adapter-driven methods.
    }
  }
  if (active) await towCombatOverlayAddActorCondition(actor, id);
  else await towCombatOverlayRemoveActorCondition(actor, id);
}

async function toggleConditionFromPanel(actor, conditionId) {
  if (!actor || !conditionId) return;
  if (!towCombatOverlayCanEditActor(actor)) {
    towCombatOverlayWarnNoPermission(actor);
    return;
  }
  const id = String(conditionId);
  const applyToggle = async () => {
    const active = getActorStatusSet(actor).has(id);
    if (!active) {
      await setActorConditionState(actor, id, true);
      return;
    }
    await setActorConditionState(actor, id, false);
    for (let i = 0; i < 4; i++) {
      if (!getActorStatusSet(actor).has(id)) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    for (const effect of getActorEffectsByStatus(actor, id)) {
      const liveEffect = effect?.id ? actor.effects?.get?.(effect.id) : null;
      if (liveEffect) await liveEffect.delete();
    }
  };

  if (game?.[MODULE_KEY]) {
    await runActorOpLock(actor, `condition:${id}`, applyToggle);
    return;
  }
  await applyToggle();
}

function getSingleControlledToken() {
  const controlledTokens = Array.isArray(canvas?.tokens?.controlled)
    ? canvas.tokens.controlled.filter((token) => token && !token.destroyed)
    : [];
  return controlledTokens.length === 1 ? controlledTokens[0] : null;
}

function getConditionTooltipData(conditionId) {
  const key = String(conditionId ?? "").trim();
  if (!key) return null;
  const condition = game.oldworld?.config?.conditions?.[key] ?? {};
  const rawName = String(condition?.name ?? key);
  const rawDescription = String(condition?.description ?? "");
  const name = rawName.startsWith("TOW.")
    ? towCombatOverlayLocalizeSystemKey(rawName, towCombatOverlayResolveConditionLabel(key))
    : rawName;
  const localizedDescription = rawDescription.startsWith("TOW.")
    ? towCombatOverlayLocalizeSystemKey(rawDescription, rawDescription)
    : rawDescription;
  const shortDescription = localizedDescription
    ? (localizedDescription.split(/(?<=[.!?])\s+/)[0] ?? localizedDescription).trim()
    : "";
  const hint = "<em>Click: apply/remove status</em>";
  return {
    title: String(name || "Condition"),
    description: shortDescription ? `${hint}<br><br>${shortDescription}` : hint
  };
}

function getControlPanelState() {
  if (!game) return null;
  if (!game[PANEL_STATE_KEY]) game[PANEL_STATE_KEY] = {};
  return game[PANEL_STATE_KEY];
}

function clampPanelCoordinate(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  if (max < min) return min;
  return Math.min(max, Math.max(min, numeric));
}

function readSavedPanelPosition() {
  try {
    const raw = window.localStorage.getItem(PANEL_LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const left = Number(parsed?.left);
    const top = Number(parsed?.top);
    if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
    return { left, top };
  } catch (_error) {
    return null;
  }
}

function writeSavedPanelPosition(panelElement) {
  if (!(panelElement instanceof HTMLElement)) return;
  try {
    const payload = {
      left: Number(panelElement.style.left.replace("px", "")),
      top: Number(panelElement.style.top.replace("px", ""))
    };
    if (!Number.isFinite(payload.left) || !Number.isFinite(payload.top)) return;
    window.localStorage.setItem(PANEL_LOCAL_STORAGE_KEY, JSON.stringify(payload));
  } catch (_error) {
    // Ignore storage errors.
  }
}

function getPanelBounds(panelElement) {
  const rect = panelElement.getBoundingClientRect();
  const panelWidth = Math.max(1, Math.round(rect.width || panelElement.offsetWidth || 1));
  const panelHeight = Math.max(1, Math.round(rect.height || panelElement.offsetHeight || 1));
  const maxLeft = window.innerWidth - panelWidth - PANEL_VIEWPORT_MARGIN_PX;
  const maxTop = window.innerHeight - panelHeight - PANEL_VIEWPORT_MARGIN_PX;
  return {
    minLeft: PANEL_VIEWPORT_MARGIN_PX,
    minTop: PANEL_VIEWPORT_MARGIN_PX,
    maxLeft,
    maxTop
  };
}

function applyPanelPosition(panelElement, left, top) {
  const bounds = getPanelBounds(panelElement);
  const safeLeft = clampPanelCoordinate(left, bounds.minLeft, bounds.maxLeft);
  const safeTop = clampPanelCoordinate(top, bounds.minTop, bounds.maxTop);
  panelElement.style.left = `${Math.round(safeLeft)}px`;
  panelElement.style.top = `${Math.round(safeTop)}px`;
}

function applyInitialPanelPosition(panelElement) {
  const saved = readSavedPanelPosition();
  if (saved) {
    applyPanelPosition(panelElement, saved.left, saved.top);
    return;
  }

  const panelWidth = Math.max(1, Math.round(panelElement.offsetWidth || 1));
  const panelHeight = Math.max(1, Math.round(panelElement.offsetHeight || 1));
  const defaultLeft = Math.round((window.innerWidth / 2) - (panelWidth / 2));
  const defaultTop = Math.round(window.innerHeight - panelHeight - 42);
  applyPanelPosition(panelElement, defaultLeft, defaultTop);
}

function getPanelTemplateData() {
  const statuses = getAllConditionEntries();
  return { statuses };
}

async function createControlPanelElement() {
  const renderer = foundry?.applications?.handlebars?.renderTemplate;
  if (typeof renderer !== "function") {
    throw new Error("[tow-combat-overlay] Missing foundry.applications.handlebars.renderTemplate");
  }

  const html = await renderer(PANEL_TEMPLATE_PATH, getPanelTemplateData());
  const wrapper = document.createElement("div");
  wrapper.innerHTML = String(html ?? "").trim();
  const panelElement = wrapper.firstElementChild;
  if (!(panelElement instanceof HTMLElement) || panelElement.id !== PANEL_ID) {
    throw new Error("[tow-combat-overlay] Failed to render control panel template.");
  }
  return { panelElement, selectionPanelElement: createSelectionPanelElement() };
}

function createSelectionPanelElement() {
  const selectionPanel = document.createElement("section");
  selectionPanel.id = PANEL_SELECTION_ID;
  selectionPanel.className = "tow-combat-overlay-selection-panel";
  selectionPanel.setAttribute("aria-label", "Selected token panel");
  selectionPanel.innerHTML = `
    <div class="tow-combat-overlay-selection-panel__main">
      <div class="tow-combat-overlay-selection-panel__portrait-column">
        <span class="tow-combat-overlay-control-panel__selection-name">
          <span class="tow-combat-overlay-control-panel__selection-name-main">-</span>
        </span>
        <div class="tow-combat-overlay-control-panel__selection" data-selection="none">
          <img class="tow-combat-overlay-control-panel__selection-image" src="" alt="Selected token" />
          <div class="tow-combat-overlay-control-panel__selection-stats">
            <button type="button" class="tow-combat-overlay-control-panel__selection-stat-row" data-selection-stat-row="wounds">
              <span class="tow-combat-overlay-control-panel__selection-stat-value" data-selection-stat="wounds">-</span>
              <img class="tow-combat-overlay-control-panel__selection-stat-icon" src="${ICON_SRC_WOUND}" alt="" />
            </button>
            <button type="button" class="tow-combat-overlay-control-panel__selection-stat-row" data-selection-stat-row="resilience">
              <span class="tow-combat-overlay-control-panel__selection-stat-value" data-selection-stat="resilience">-</span>
              <img class="tow-combat-overlay-control-panel__selection-stat-icon" src="${PANEL_RESILIENCE_ICON}" alt="" />
            </button>
          </div>
          <span class="tow-combat-overlay-control-panel__selection-placeholder">-</span>
          <span class="tow-combat-overlay-control-panel__selection-multi-count">x0</span>
        </div>
      </div>
    </div>
  `;
  return selectionPanel;
}

function syncSelectionPanelPosition(controlPanelState) {
  const panelElement = controlPanelState?.element;
  const selectionPanelElement = controlPanelState?.selectionElement;
  if (!(panelElement instanceof HTMLElement)) return;
  if (!(selectionPanelElement instanceof HTMLElement)) return;
  const panelRect = panelElement.getBoundingClientRect();
  const selectionRect = selectionPanelElement.getBoundingClientRect();
  const selectionImageBlock = selectionPanelElement.querySelector(".tow-combat-overlay-control-panel__selection");
  const imageBottomOffset = (selectionImageBlock instanceof HTMLElement)
    ? (selectionImageBlock.offsetTop + selectionImageBlock.offsetHeight)
    : selectionPanelElement.offsetHeight;
  const left = panelRect.left - selectionRect.width - PANEL_SELECTION_GAP_PX;
  const top = panelRect.bottom - imageBottomOffset;
  applyPanelPosition(selectionPanelElement, left, top);
}

function bindPanelSlotEvent(slotElement) {
  slotElement.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    void handlePanelSlotClick(slotElement, event);
  });
  slotElement.addEventListener("click", (event) => {
    event.preventDefault();
  });
  slotElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
  const onShowTooltip = (event) => {
    const title = String(slotElement.dataset.tooltipTitle ?? "").trim();
    const description = String(slotElement.dataset.tooltipDescription ?? "").trim();
    if (!title) {
      hideStatusTooltip();
      return;
    }
    showOverlayTooltip(title, description || "No description.", { x: event.clientX, y: event.clientY }, null, {
      allowOutsideCanvas: true,
      clientCoordinates: true,
      theme: "panel",
      descriptionIsHtml: true
    });
  };
  const onHideTooltip = () => hideStatusTooltip();
  slotElement.addEventListener("pointerenter", onShowTooltip);
  slotElement.addEventListener("pointermove", onShowTooltip);
  slotElement.addEventListener("pointerleave", onHideTooltip);
  slotElement.addEventListener("pointercancel", onHideTooltip);
}

function bindPanelTooltipEvent(targetElement, getTooltipData) {
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

function getOverlayAutomationRef() {
  return towCombatOverlayAutomation ?? createTowCombatOverlayAutomationCoordinator();
}

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
  if (!canvas?.stage?.worldTransform?.applyInverse) return towCombatOverlayCopyPoint(localPoint);
  return towCombatOverlayCopyPoint(canvas.stage.worldTransform.applyInverse(localPoint));
}

function getPanelAttackPickState(controlPanelState) {
  if (!controlPanelState.pendingAttackPick) controlPanelState.pendingAttackPick = {};
  return controlPanelState.pendingAttackPick;
}

function clearPanelAttackPickMode() {
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

async function runPanelAttackOnTarget(sourceToken, targetToken, attackItem, { autoRoll = true } = {}) {
  const sourceActor = sourceToken?.actor ?? sourceToken?.document?.actor ?? null;
  if (!sourceActor || !targetToken || !attackItem) return;
  const automation = getOverlayAutomationRef();
  const sourceBeforeState = automation.snapshotActorState(sourceActor);
  const restoreStaggerPrompt = automation.armDefaultStaggerChoiceWound(AUTO_STAGGER_PATCH_MS);
  automation.armAutoDefenceForOpposed(sourceToken, targetToken, { sourceBeforeState });

  try {
    await withTemporaryUserTargets(targetToken, () => towCombatOverlaySetupAbilityTestWithDamage(sourceActor, attackItem, {
      autoRoll,
      context: { targets: [targetToken] }
    }));
  } finally {
    setTimeout(() => restoreStaggerPrompt(), AUTO_APPLY_WAIT_MS);
  }
}

async function withTemporaryUserTargets(targetToken, callback) {
  const targetId = String(targetToken?.id ?? "").trim();
  if (!targetId || typeof callback !== "function") return callback?.();
  const previousTargetIds = Array.from(game?.user?.targets ?? [])
    .map((token) => String(token?.id ?? "").trim())
    .filter(Boolean);
  const placeables = Array.isArray(canvas?.tokens?.placeables) ? canvas.tokens.placeables : [];
  const setByToggle = (ids) => {
    const idSet = new Set((Array.isArray(ids) ? ids : []).map((id) => String(id ?? "").trim()).filter(Boolean));
    let usedToggle = false;
    for (const tokenObject of placeables) {
      if (typeof tokenObject?.setTarget !== "function") continue;
      usedToggle = true;
      tokenObject.setTarget(idSet.has(String(tokenObject.id ?? "")), {
        releaseOthers: false,
        groupSelection: false,
        user: game.user
      });
    }
    return usedToggle;
  };

  // Prefer explicit token target toggles because core action scripts read game.user.targets.
  const usedToggle = setByToggle([targetId]);
  if (!usedToggle) {
    const updateTargets = game?.user?.updateTokenTargets;
    if (typeof updateTargets === "function") {
      const updateResult = updateTargets.call(game.user, [targetId]);
      if (updateResult && typeof updateResult.then === "function") await updateResult;
    } else {
      return callback();
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 0));
  try {
    return await callback();
  } finally {
    if (!setByToggle(previousTargetIds)) {
      const updateTargets = game?.user?.updateTokenTargets;
      if (typeof updateTargets === "function") {
        const restoreResult = updateTargets.call(game.user, previousTargetIds);
        if (restoreResult && typeof restoreResult.then === "function") await restoreResult;
      }
    }
  }
}

async function runPanelAimAction(actor, sourceToken, { autoRoll = true, targetToken = null } = {}) {
  if (!actor) return;
  const execute = async () => {
    if (autoRoll) armAutoSubmitActionSkillDialog(actor, "awareness");
    if (typeof actor?.system?.doAction === "function") {
      await runDefaultPanelActorAction(actor, "aim");
      return;
    }
    await getTowCombatOverlaySystemAdapter().setupSkillTest(
      actor,
      "awareness",
      createTowCombatOverlayRollContext(actor, { action: "aim", skipTargets: true })
    );
  };

  const resolvedTarget = targetToken ?? sourceToken ?? null;
  if (resolvedTarget) {
    await withTemporaryUserTargets(resolvedTarget, execute);
    return;
  }
  await execute();
}

async function runPanelHelpAction(actor, sourceToken, { autoRoll = true, targetToken = null } = {}) {
  if (!actor) return;
  const execute = async () => {
    armApplyRollModifiersToNextTestDialog(actor, {
      matches: (app) => String(app?.context?.action ?? "").toLowerCase() === "help"
    });
    if (autoRoll) armAutoPickFirstHelpSkillDialog(actor);
    await runDefaultPanelActorAction(actor, "help");
  };

  const resolvedTarget = targetToken ?? null;
  if (resolvedTarget) {
    await withTemporaryUserTargets(resolvedTarget, execute);
    return;
  }
  await execute();
}

function startPanelAttackPickMode(panelElement, slotElement, sourceToken, attackItem, originEvent = null, options = {}) {
  const preferDefaultDialog = options?.preferDefaultDialog === true;
  const controlPanelState = getControlPanelState();
  if (!controlPanelState || !sourceToken || !attackItem) return;
  clearPanelAttackPickMode();

  const canvasView = canvas?.app?.view;
  if (canvasView instanceof HTMLElement) canvasView.style.cursor = PANEL_ATTACK_PICK_CURSOR;
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
    if (target instanceof Element && target.closest(`#${PANEL_ID}`)) return;
    const point = getWorldPointFromClientEvent(event);
    const targetToken = towCombatOverlayTokenAtPoint(point, { excludeTokenId: sourceToken.id });
    if (!targetToken) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    const useDefaultDialog = preferDefaultDialog || towCombatOverlayIsAltModifier(event);
    attackTriggered = true;
    clearPanelAttackPickMode();
    await runPanelAttackOnTarget(sourceToken, targetToken, attackItem, { autoRoll: !useDefaultDialog });
  };

  const onEscape = (event) => {
    if (event.key !== "Escape") return;
    clearPanelAttackPickMode();
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

function startPanelAimPickMode(panelElement, slotElement, sourceToken, originEvent = null, options = {}) {
  const preferDefaultDialog = options?.preferDefaultDialog === true;
  const controlPanelState = getControlPanelState();
  if (!controlPanelState || !sourceToken) return;
  clearPanelAttackPickMode();

  const canvasView = canvas?.app?.view;
  if (canvasView instanceof HTMLElement) canvasView.style.cursor = PANEL_ATTACK_PICK_CURSOR;
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
    if (target instanceof Element && target.closest(`#${PANEL_ID}`)) return;
    const point = getWorldPointFromClientEvent(event);
    const targetToken = towCombatOverlayTokenAtPoint(point, { excludeTokenId: sourceToken.id });
    if (!targetToken) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    aimTriggered = true;
    clearPanelAttackPickMode();
    const actor = sourceToken?.actor ?? sourceToken?.document?.actor ?? null;
    await runPanelAimAction(actor, sourceToken, {
      autoRoll: !preferDefaultDialog,
      targetToken
    });
  };

  const onEscape = (event) => {
    if (event.key !== "Escape") return;
    clearPanelAttackPickMode();
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

function startPanelHelpPickMode(panelElement, slotElement, sourceToken, originEvent = null, options = {}) {
  const preferDefaultDialog = options?.preferDefaultDialog === true;
  const controlPanelState = getControlPanelState();
  if (!controlPanelState || !sourceToken) return;
  clearPanelAttackPickMode();

  const canvasView = canvas?.app?.view;
  if (canvasView instanceof HTMLElement) canvasView.style.cursor = PANEL_ATTACK_PICK_CURSOR;
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
    if (target instanceof Element && target.closest(`#${PANEL_ID}`)) return;
    const point = getWorldPointFromClientEvent(event);
    const targetToken = towCombatOverlayTokenAtPoint(point, { excludeTokenId: sourceToken.id });
    if (!targetToken) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    helpTriggered = true;
    clearPanelAttackPickMode();
    const actor = sourceToken?.actor ?? sourceToken?.document?.actor ?? null;
    await runPanelHelpAction(actor, sourceToken, {
      autoRoll: !preferDefaultDialog,
      targetToken
    });
  };

  const onEscape = (event) => {
    if (event.key !== "Escape") return;
    clearPanelAttackPickMode();
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

async function handlePanelSlotClick(slotElement, event) {
  const itemGroup = String(slotElement.dataset.itemGroup ?? "");
  const itemId = String(slotElement.dataset.itemId ?? "");
  if (itemGroup === "actions" && itemId) {
    const actor = getSingleControlledActor();
    const sourceToken = getSingleControlledToken();
    if (!actor) return;
    if (!towCombatOverlayCanEditActor(actor)) {
      towCombatOverlayWarnNoPermission(actor);
      return;
    }
    if (itemId === "aim") {
      const useDefaultDialog = towCombatOverlayIsAltModifier(event);
      const selfRoll = towCombatOverlayIsShiftModifier(event);
      const panelElement = slotElement.closest(`#${PANEL_ID}`);
      if (!(panelElement instanceof HTMLElement)) return;
      if (selfRoll) {
        clearPanelAttackPickMode();
        await runPanelAimAction(actor, sourceToken, {
          autoRoll: !useDefaultDialog,
          targetToken: null
        });
      } else if (sourceToken) {
        startPanelAimPickMode(panelElement, slotElement, sourceToken, event, {
          preferDefaultDialog: useDefaultDialog
        });
      }
      if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
      return;
    }
    if (itemId === "help") {
      const useDefaultDialog = towCombatOverlayIsAltModifier(event);
      const selfRoll = towCombatOverlayIsShiftModifier(event);
      const panelElement = slotElement.closest(`#${PANEL_ID}`);
      if (!(panelElement instanceof HTMLElement)) return;
      if (selfRoll) {
        clearPanelAttackPickMode();
        await runPanelHelpAction(actor, sourceToken, {
          autoRoll: !useDefaultDialog,
          targetToken: null
        });
      } else if (sourceToken) {
        startPanelHelpPickMode(panelElement, slotElement, sourceToken, event, {
          preferDefaultDialog: useDefaultDialog
        });
      }
      if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
      return;
    }
    const useDefaultDialog = towCombatOverlayIsAltModifier(event);
    await runPanelActorAction(actor, itemId, { autoRoll: !useDefaultDialog });
    const panelElement = slotElement.closest(`#${PANEL_ID}`);
    if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
    return;
  }

  if (itemGroup === "recover" && itemId) {
    const actor = getSingleControlledActor();
    if (!actor) return;
    if (!towCombatOverlayCanEditActor(actor)) {
      towCombatOverlayWarnNoPermission(actor);
      return;
    }
    const useDefaultDialog = towCombatOverlayIsAltModifier(event);
    await runPanelRecoverAction(actor, itemId, { autoRoll: !useDefaultDialog });
    const panelElement = slotElement.closest(`#${PANEL_ID}`);
    if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
    return;
  }

  if (itemGroup === "manoeuvre" && itemId) {
    const actor = getSingleControlledActor();
    if (!actor) return;
    if (!towCombatOverlayCanEditActor(actor)) {
      towCombatOverlayWarnNoPermission(actor);
      return;
    }
    const useDefaultDialog = towCombatOverlayIsAltModifier(event);
    await runPanelManoeuvreAction(actor, itemId, { autoRoll: !useDefaultDialog });
    const panelElement = slotElement.closest(`#${PANEL_ID}`);
    if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
    return;
  }

  if (itemGroup !== "attacks" || !itemId) return;

  const sourceToken = getSingleControlledToken();
  const sourceActor = sourceToken?.actor ?? sourceToken?.document?.actor ?? null;
  if (!sourceToken || !sourceActor) return;

  const attackItem = sourceActor.items?.get?.(itemId) ?? null;
  if (!attackItem) return;
  const altHeld = towCombatOverlayIsAltModifier(event);
  const shiftHeld = towCombatOverlayIsShiftModifier(event);

  if (altHeld && shiftHeld) {
    clearPanelAttackPickMode();
    await towCombatOverlaySetupAbilityTestWithDamage(sourceActor, attackItem, { autoRoll: false });
    return;
  }

  if (shiftHeld) {
    clearPanelAttackPickMode();
    await towCombatOverlaySetupAbilityTestWithDamage(sourceActor, attackItem, { autoRoll: true });
    return;
  }

  const panelElement = slotElement.closest(`#${PANEL_ID}`);
  if (!(panelElement instanceof HTMLElement)) return;
  startPanelAttackPickMode(panelElement, slotElement, sourceToken, attackItem, event, {
    preferDefaultDialog: altHeld
  });
}

async function runDefaultPanelActorAction(actor, actionKey) {
  const key = String(actionKey ?? "").trim();
  if (!actor || !key) return;

  const runWithActionRollContext = async (callback) => withPatchedActionSkillTestContext(actor, callback);

  if (typeof actor?.system?.doAction === "function") {
    await runWithActionRollContext(() => actor.system.doAction(key));
    return;
  }

  const actionData = game?.oldworld?.config?.actions?.[key] ?? null;
  if (actionData?.script && typeof actionData.script === "function") {
    await runWithActionRollContext(() => actionData.script.call(actionData, actor));
    return;
  }

  const actionUse = game?.oldworld?.config?.rollClasses?.ActionUse;
  if (typeof actionUse?.fromAction === "function") {
    await runWithActionRollContext(() => actionUse.fromAction(key, actor));
  }
}

async function withPatchedActionSkillTestContext(actor, callback) {
  if (!actor || typeof callback !== "function") return callback?.();
  if (typeof actor.setupSkillTest !== "function") return callback();

  const originalSetupSkillTest = actor.setupSkillTest;
  const boundOriginal = originalSetupSkillTest.bind(actor);
  const patchedSetupSkillTest = function patchedTowCombatOverlayActionSkillTest(skill, context = {}) {
    return boundOriginal(skill, createTowCombatOverlayRollContext(actor, context));
  };
  actor.setupSkillTest = patchedSetupSkillTest;

  try {
    return await callback();
  } finally {
    if (actor.setupSkillTest === patchedSetupSkillTest) {
      actor.setupSkillTest = originalSetupSkillTest;
    }
  }
}

function armApplyRollModifiersToNextTestDialog(actor, { matches = null, timeoutMs = 20000 } = {}) {
  if (!actor) return;
  const rollFields = getTowCombatOverlayActorRollModifierFields(actor);
  const hookName = "renderTestDialog";
  let hookId = null;
  let timeoutId = null;

  const cleanup = () => {
    if (hookId !== null) Hooks.off(hookName, hookId);
    hookId = null;
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = null;
  };

  hookId = Hooks.on(hookName, (app) => {
    if (app?.actor?.id !== actor.id) return;
    if (typeof matches === "function" && !matches(app)) return;
    cleanup();

    if (!app || app._towCombatOverlayRollModsInjected) return;
    app._towCombatOverlayRollModsInjected = true;

    app.userEntry ??= {};
    app.fields ??= {};
    for (const [key, value] of Object.entries(rollFields)) {
      const numericValue = Number(value ?? 0);
      app.userEntry[key] = numericValue;
      app.fields[key] = numericValue;
    }

    if (typeof app.render === "function") app.render(true);
  });

  timeoutId = setTimeout(cleanup, Math.max(250, Number(timeoutMs) || 0));
}

function armAutoSubmitActionSkillDialog(actor, skill) {
  const skillKey = String(skill ?? "").trim();
  if (!skillKey) return;
  towCombatOverlayArmAutoSubmitDialog({
    hookName: "renderTestDialog",
    matches: (app) => app?.actor?.id === actor.id && app?.skill === skillKey,
    submitErrorMessage: "TestDialog.submit() is unavailable."
  });
}

function armAutoPickFirstImproviseSkillDialog(actor) {
  towCombatOverlayArmAutoSubmitDialog({
    hookName: "renderItemDialog",
    matches: (app) => {
      const text = String(app?.options?.text ?? "").trim().toLowerCase();
      const title = String(app?.options?.window?.title ?? app?.title ?? "").trim().toLowerCase();
      return text.includes("choose skill") || title.includes("improvise");
    },
    submitErrorMessage: "ItemDialog.submit() is unavailable.",
    beforeSubmit: async (app) => {
      if (!app) return;
      const firstChoice = app?.items?.[0] ?? null;
      const firstSkill = String(firstChoice?.id ?? "").trim();
      app.chosen = [0];
      if (firstSkill) armAutoSubmitActionSkillDialog(actor, firstSkill);
    }
  });
}

function armAutoPickFirstHelpSkillDialog(actor) {
  towCombatOverlayArmAutoSubmitDialog({
    hookName: "renderItemDialog",
    matches: (app) => {
      const text = String(app?.options?.text ?? "").trim().toLowerCase();
      const title = String(app?.options?.window?.title ?? app?.title ?? "").trim().toLowerCase();
      return text.includes("choose skill") || title.includes("help");
    },
    submitErrorMessage: "ItemDialog.submit() is unavailable.",
    beforeSubmit: async (app) => {
      if (!app) return;
      const firstChoice = app?.items?.[0] ?? null;
      const firstSkill = String(firstChoice?.id ?? "").trim();
      app.chosen = [0];
      if (firstSkill) armAutoSubmitActionSkillDialog(actor, firstSkill);
    }
  });
}

async function runPanelActorAction(actor, actionKey, { autoRoll = true } = {}) {
  const key = String(actionKey ?? "").trim().toLowerCase();
  if (!actor || !key) return;

  if (key === "defence") {
    await towCombatOverlayDefenceActor(actor, { manual: !autoRoll });
    return;
  }

  if (!autoRoll) {
    await runDefaultPanelActorAction(actor, key);
    return;
  }

  if (key === "aim") armAutoSubmitActionSkillDialog(actor, "awareness");
  if (key === "improvise") armAutoPickFirstImproviseSkillDialog(actor);

  await runDefaultPanelActorAction(actor, key);
}

function getPanelActionEntries() {
  const actionsConfig = game?.oldworld?.config?.actions ?? {};
  return PANEL_ACTIONS_ORDER
    .map((key) => {
      if (key === "defence") {
        return {
          id: key,
          name: "Defence",
          img: PANEL_ACTION_ICON_BY_KEY.defence,
          system: {
            description: ""
          }
        };
      }
      const action = actionsConfig?.[key] ?? null;
      if (!action) return null;
      const localizedLabel = localizeMaybe(String(action?.label ?? ""), String(action?.label ?? key));
      const rawLabel = localizedLabel && localizedLabel !== String(action?.label ?? "")
        ? localizedLabel
        : toReadableTypeLabel(key);
      const label = String(rawLabel || key);
      const image = String(PANEL_ACTION_ICON_BY_KEY[key] ?? action?.effect?.img ?? action?.img ?? "").trim() || PANEL_FALLBACK_ITEM_ICON;
      return {
        id: key,
        name: label,
        img: image,
        system: {
          description: ""
        }
      };
    })
    .filter(Boolean);
}

function getPanelManoeuvreSubActionEntries() {
  const subActions = game?.oldworld?.config?.actions?.manoeuvre?.subActions ?? {};
  const keys = PANEL_MANOEUVRE_ORDER.filter((key) => !!subActions?.[key]);
  return keys.map((key) => {
    const entry = subActions[key] ?? {};
    const name = String(entry?.label ?? key).trim() || key;
    const description = String(entry?.description ?? "").trim();
    const skill = String(entry?.test?.skill ?? "").trim();
    const descriptionParts = [];
    if (description) descriptionParts.push(description);
    if (skill) descriptionParts.push(`Test: ${toReadableTypeLabel(skill)}.`);
    descriptionParts.push("<em>Click: run manoeuvre action.</em>");
    return {
      id: key,
      name,
      img: PANEL_MANOEUVRE_ICON_BY_KEY[key] ?? PANEL_FALLBACK_ITEM_ICON,
      system: {
        description: descriptionParts.join(" ")
      }
    };
  });
}

function getDialogActionList(config) {
  if (Array.isArray(config?.buttons)) return config.buttons.map((button) => String(button?.action ?? ""));
  return Object.values(config?.buttons ?? {}).map((button) => String(button?.action ?? ""));
}

function isRecoverChoiceDialogConfig(config) {
  const title = String(config?.window?.title ?? "").toLowerCase();
  const actions = getDialogActionList(config);
  const hasExpectedChoices = actions.includes("recover") && actions.includes("treat") && actions.includes("condition");
  return hasExpectedChoices && title.includes("recover");
}

async function withForcedRecoverDialogChoice(choice, callback) {
  const DialogApi = foundry?.applications?.api?.Dialog;
  if (typeof DialogApi?.wait !== "function" || typeof callback !== "function") return callback?.();

  const originalWait = DialogApi.wait.bind(DialogApi);
  DialogApi.wait = async (config, options) => {
    if (isRecoverChoiceDialogConfig(config)) return String(choice ?? "");
    return originalWait(config, options);
  };

  try {
    return await callback();
  } finally {
    DialogApi.wait = originalWait;
  }
}

async function runDefaultRecoverAction(actor) {
  if (typeof actor?.system?.doAction === "function") {
    await withPatchedActionSkillTestContext(actor, () => actor.system.doAction("recover"));
    return;
  }

  const recoverActionData = game?.oldworld?.config?.actions?.recover ?? null;
  if (recoverActionData?.script && typeof recoverActionData.script === "function") {
    await withPatchedActionSkillTestContext(actor, () => recoverActionData.script.call(recoverActionData, actor));
    return;
  }

  const actionUse = game?.oldworld?.config?.rollClasses?.ActionUse;
  if (typeof actionUse?.fromAction === "function") {
    await withPatchedActionSkillTestContext(actor, () => actionUse.fromAction("recover", actor));
  }
}

function armAutoSubmitRecallSkillDialog(actor) {
  towCombatOverlayArmAutoSubmitDialog({
    hookName: "renderTestDialog",
    matches: (app) => app?.actor?.id === actor.id && app?.skill === "recall",
    submitErrorMessage: "TestDialog.submit() is unavailable."
  });
}

function armAutoPickFirstRecoverItemDialog(pickerType) {
  const type = String(pickerType ?? "").trim();
  if (!type) return;

  const expectedText = (type === "treat")
    ? "select wound to treat"
    : "select condition to test against";
  const expectedTitle = (type === "treat")
    ? "treat wound"
    : "remove condition";

  towCombatOverlayArmAutoSubmitDialog({
    hookName: "renderItemDialog",
    matches: (app) => {
      const text = String(app?.options?.text ?? "").trim().toLowerCase();
      const title = String(app?.options?.window?.title ?? app?.title ?? "").trim().toLowerCase();
      return text.includes(expectedText) || title.includes(expectedTitle);
    },
    submitErrorMessage: "ItemDialog.submit() is unavailable.",
    beforeSubmit: async (app) => {
      if (!app) return;
      const itemCount = Number(app?.items?.length ?? 0);
      if (!Number.isFinite(itemCount) || itemCount <= 0) return;
      app.chosen = [0];
    }
  });
}

function getPanelRecoverActionEntries() {
  const recoverAction = game?.oldworld?.config?.actions?.recover ?? {};
  const labels = {
    recover: "Recover",
    treat: "Treat Wound",
    condition: "Remove Condition"
  };

  return PANEL_RECOVER_ORDER.map((key) => ({
    id: key,
    name: labels[key] ?? key,
    img: PANEL_RECOVER_ICON_BY_KEY[key] ?? PANEL_FALLBACK_ITEM_ICON,
    system: {
      description: String(recoverAction?.label ?? "Recover action")
    }
  }));
}

async function runPanelRecoverAction(actor, subAction, { autoRoll = true } = {}) {
  const actionKey = String(subAction ?? "").trim();
  if (!actor || !actionKey) return;

  if (!autoRoll) {
    if (actionKey === "treat") {
      armApplyRollModifiersToNextTestDialog(actor, {
        matches: (app) => {
          const skill = String(app?.skill ?? "").toLowerCase();
          const title = String(app?.context?.title ?? "").toLowerCase();
          const appendTitle = String(app?.context?.appendTitle ?? "").toLowerCase();
          return skill === "recall" && (title.includes("treat wound") || appendTitle.includes("treat wound"));
        }
      });
    }
    await runDefaultRecoverAction(actor);
    return;
  }

  if (actionKey === "treat") {
    armApplyRollModifiersToNextTestDialog(actor, {
      matches: (app) => {
        const skill = String(app?.skill ?? "").toLowerCase();
        const title = String(app?.context?.title ?? "").toLowerCase();
        const appendTitle = String(app?.context?.appendTitle ?? "").toLowerCase();
        return skill === "recall" && (title.includes("treat wound") || appendTitle.includes("treat wound"));
      }
    });
    armAutoSubmitRecallSkillDialog(actor);
    armAutoPickFirstRecoverItemDialog("treat");
  }
  if (actionKey === "condition") armAutoPickFirstRecoverItemDialog("condition");
  const forcedChoice = (actionKey === "condition" || actionKey === "treat" || actionKey === "recover")
    ? actionKey
    : "recover";
  await withForcedRecoverDialogChoice(forcedChoice, () => runDefaultRecoverAction(actor));
}

async function runPanelManoeuvreAction(actor, subAction, { autoRoll = true } = {}) {
  const action = "manoeuvre";
  const actionKey = String(subAction ?? "").trim();
  if (!actor || !actionKey) return;
  const subActionData = game?.oldworld?.config?.actions?.[action]?.subActions?.[actionKey] ?? null;

  if (!autoRoll && typeof actor?.system?.doAction === "function") {
    await withPatchedActionSkillTestContext(actor, () => actor.system.doAction(action, actionKey));
    return;
  }

  const runSkillTestAuto = async (skill) => {
    const skillKey = String(skill ?? "").trim();
    if (!skillKey || typeof actor.setupSkillTest !== "function") return null;
    towCombatOverlayArmAutoSubmitDialog({
      hookName: "renderTestDialog",
      matches: (app) => app?.actor?.id === actor.id && app?.skill === skillKey,
      submitErrorMessage: "TestDialog.submit() is unavailable."
    });
    return getTowCombatOverlaySystemAdapter().setupSkillTest(
      actor,
      skillKey,
      createTowCombatOverlayRollContext(actor, { action, subAction: actionKey, skipTargets: true })
    );
  };

  if (actionKey === "run") {
    const test = await runSkillTestAuto("athletics");
    if (test?.failed && !actor.system?.isStaggered) await actor.addCondition?.("staggered");
    return;
  }

  if (actionKey === "charge") {
    const test = await runSkillTestAuto("athletics");
    if (test?.failed) {
      if (!actor.system?.isStaggered) await actor.addCondition?.("staggered");
      return;
    }
    const effect = foundry?.utils?.deepClone?.(subActionData?.effect);
    if (effect) await actor.applyEffect?.({ effectData: [effect] });
    return;
  }

  if (subActionData?.test?.skill) {
    await runSkillTestAuto(String(subActionData.test.skill));
    return;
  }

  if (subActionData?.script && typeof subActionData.script === "function") {
    await subActionData.script.call(subActionData, actor);
    return;
  }

  const actionUse = game?.oldworld?.config?.rollClasses?.ActionUse;
  if (typeof actionUse?.fromAction === "function") {
    await actionUse.fromAction(action, actor, { subAction: actionKey });
  }
}

function getPanelStatTooltipData(statKey) {
  const key = String(statKey ?? "").trim();
  if (!key) return null;

  if (key === "tokenType") {
    const token = getSingleControlledToken();
    if (token?.actor || token?.document?.actor) return getTypeTooltipData(token.actor ?? token.document.actor);
    return {
      title: "Type",
      description: MODULE_TOOLTIPS.actorType.defaultDescription
    };
  }
  if (key === "resilience") return MODULE_TOOLTIPS.resilience;
  if (key === "wounds") {
    const title = String(MODULE_TOOLTIPS?.wounds?.title ?? "Wounds");
    const baseDescription = String(MODULE_TOOLTIPS?.wounds?.description ?? "").trim();
    const hint = "<em>Left click: +1 wound · Right click: -1 wound</em>";
    const cleanedBaseDescription = baseDescription
      .replace(/Left-?click adds 1 wound\.?\s*Right-?click removes 1 wound\.?/gi, "")
      .trim();
    const description = cleanedBaseDescription ? `${hint}<br><br>${cleanedBaseDescription}` : hint;
    return { title, description };
  }
  if (key === "speed") return MODULE_TOOLTIPS.speed;
  if (key === "miscastDice") return MODULE_TOOLTIPS.miscastDice;
  return null;
}

function bindPanelStatsTooltipEvents(panelElement) {
  const statRows = Array.from(panelElement.querySelectorAll(".tow-combat-overlay-control-panel__stat-row[data-stat-row]"));
  for (const statRow of statRows) {
    if (!(statRow instanceof HTMLElement)) continue;
    const statKey = String(statRow.dataset.statRow ?? "");
    bindPanelTooltipEvent(statRow, () => getPanelStatTooltipData(statKey));
  }
}

function bindPanelWoundsStatEvents(panelElement) {
  const woundsRow = panelElement.querySelector(".tow-combat-overlay-control-panel__stat-row[data-stat-row='wounds']");
  if (!(woundsRow instanceof HTMLElement)) return;
  woundsRow.style.cursor = "pointer";

  woundsRow.addEventListener("click", async (event) => {
    event.preventDefault();
    const token = getSingleControlledToken();
    const actor = token?.actor ?? token?.document?.actor ?? null;
    if (!actor) return;
    await towCombatOverlayAddWound(actor);
    updateSelectionDisplay(panelElement);
  });

  woundsRow.addEventListener("contextmenu", async (event) => {
    event.preventDefault();
    const token = getSingleControlledToken();
    const actor = token?.actor ?? token?.document?.actor ?? null;
    if (!actor) return;
    await towCombatOverlayRemoveWound(actor);
    updateSelectionDisplay(panelElement);
  });
}

function bindSelectionPanelStatEvents(selectionPanelElement) {
  if (!(selectionPanelElement instanceof HTMLElement)) return;
  const resilienceRow = selectionPanelElement.querySelector("[data-selection-stat-row='resilience']");
  const woundsRow = selectionPanelElement.querySelector("[data-selection-stat-row='wounds']");
  if (resilienceRow instanceof HTMLElement) {
    bindPanelTooltipEvent(resilienceRow, () => getPanelStatTooltipData("resilience"));
    resilienceRow.addEventListener("click", (event) => event.preventDefault());
    resilienceRow.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  if (woundsRow instanceof HTMLElement) {
    bindPanelTooltipEvent(woundsRow, () => getPanelStatTooltipData("wounds"));
    woundsRow.style.cursor = "pointer";
    woundsRow.addEventListener("click", async (event) => {
      event.preventDefault();
      const token = getSingleControlledToken();
      const actor = token?.actor ?? token?.document?.actor ?? null;
      if (!actor) return;
      await towCombatOverlayAddWound(actor);
      const panelElement = getControlPanelState()?.element;
      if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
    });
    woundsRow.addEventListener("contextmenu", async (event) => {
      event.preventDefault();
      const token = getSingleControlledToken();
      const actor = token?.actor ?? token?.document?.actor ?? null;
      if (!actor) return;
      await towCombatOverlayRemoveWound(actor);
      const panelElement = getControlPanelState()?.element;
      if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
    });
  }
}

function bindPanelTypeIconTooltipEvent(panelElement) {
  if (!(panelElement instanceof HTMLElement)) return;
  const typeElement = panelElement.querySelector("[data-panel-type-icon='tokenType']");
  if (!(typeElement instanceof HTMLElement)) return;
  bindPanelTooltipEvent(typeElement, () => getPanelStatTooltipData("tokenType"));
  typeElement.addEventListener("click", (event) => event.preventDefault());
  typeElement.addEventListener("contextmenu", (event) => event.preventDefault());
}

function bindPanelStatusesTooltipEvents(panelElement) {
  const statusElements = Array.from(panelElement.querySelectorAll(".tow-combat-overlay-control-panel__status-icon[data-status-id]"));
  for (const statusElement of statusElements) {
    if (!(statusElement instanceof HTMLElement)) continue;
    const conditionId = String(statusElement.dataset.statusId ?? "");
    bindPanelTooltipEvent(statusElement, () => getConditionTooltipData(conditionId));
    statusElement.addEventListener("click", async (event) => {
      event.preventDefault();
      const token = getSingleControlledToken();
      const actor = token?.actor ?? token?.document?.actor ?? null;
      if (!actor || !conditionId) return;
      await toggleConditionFromPanel(actor, conditionId);
      updateStatusDisplay(panelElement, token);
    });
    statusElement.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });
  }
}

function getSingleControlledActor() {
  const token = getSingleControlledToken();
  return token?.actor ?? token?.document?.actor ?? null;
}

function getDiceModifierTooltipData() {
  const actor = getSingleControlledActor();
  const state = getTowCombatOverlayActorRollModifierState(actor);
  const value = `${state.diceModifier >= 0 ? "+" : ""}${state.diceModifier}d10`;
  return {
    title: "Dice Modifier",
    description: `<em>Left click: +1d10 · Right click: -1d10</em><br><br>Current: ${value}`
  };
}

function getRollStateTooltipData() {
  const actor = getSingleControlledActor();
  const state = getTowCombatOverlayActorRollModifierState(actor);
  const label = getTowCombatOverlayActorRollModifierStateLabel(state);
  return {
    title: "Roll State",
    description: `<em>Left click: next state · Right click: previous state</em><br><br>Current: ${label}`
  };
}

function formatActionDiceLabel(actor) {
  const state = getTowCombatOverlayActorRollModifierState(actor);
  const value = Number(state?.diceModifier ?? 0);
  return `${value >= 0 ? "+" : ""}${Math.trunc(value)}d10`;
}

function formatActionRollStateLabel(actor) {
  const key = String(getTowCombatOverlayActorRollModifierState(actor)?.rollState ?? "normal").toLowerCase();
  if (key === "grim") return "gr";
  if (key === "glorious") return "gl";
  return "co";
}

function updateActionControlsDisplay(panelElement, token = null) {
  const actor = token?.actor ?? token?.document?.actor ?? null;
  const diceLabels = Array.from(panelElement.querySelectorAll("[data-action-label='diceModifier']"));
  const rollStateLabels = Array.from(panelElement.querySelectorAll("[data-action-label='rollState']"));
  for (const diceLabel of diceLabels) {
    if (!(diceLabel instanceof HTMLElement)) continue;
    diceLabel.textContent = actor ? formatActionDiceLabel(actor) : "-";
  }
  for (const rollStateLabel of rollStateLabels) {
    if (!(rollStateLabel instanceof HTMLElement)) continue;
    rollStateLabel.textContent = actor ? formatActionRollStateLabel(actor) : "-";
  }
}

function bindPanelActionControls(panelElement) {
  const actionButtons = Array.from(panelElement.querySelectorAll("[data-action-control]"));
  if (!actionButtons.length) return;

  const withEditableSingleActor = async (runAction) => {
    const actor = getSingleControlledActor();
    if (!actor) return;
    if (!towCombatOverlayCanEditActor(actor)) {
      towCombatOverlayWarnNoPermission(actor);
      return;
    }
    await runAction(actor);
    updateSelectionDisplay(panelElement);
  };

  for (const button of actionButtons) {
    if (!(button instanceof HTMLElement)) continue;
    const control = String(button.dataset.actionControl ?? "");
    if (control === "diceModifier") bindPanelTooltipEvent(button, getDiceModifierTooltipData);
    if (control === "rollState") bindPanelTooltipEvent(button, getRollStateTooltipData);

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      if (control === "diceModifier") {
        await withEditableSingleActor((actor) => adjustTowCombatOverlayActorRollModifierDice(actor, 1));
        return;
      }
      if (control === "rollState") {
        await withEditableSingleActor((actor) => cycleTowCombatOverlayActorRollState(actor, 1));
      }
    });

    button.addEventListener("contextmenu", async (event) => {
      event.preventDefault();
      if (control === "diceModifier") {
        await withEditableSingleActor((actor) => adjustTowCombatOverlayActorRollModifierDice(actor, -1));
        return;
      }
      if (control === "rollState") {
        await withEditableSingleActor((actor) => cycleTowCombatOverlayActorRollState(actor, -1));
      }
    });
  }
}

function createPanelSlotElement(slotIndex) {
  const slotElement = document.createElement("button");
  slotElement.type = "button";
  slotElement.classList.add("tow-combat-overlay-control-panel__slot");
  slotElement.dataset.slotIndex = String(slotIndex);
  slotElement.setAttribute("aria-label", `Slot ${slotIndex + 1}`);

  const iconPlaceholder = document.createElement("span");
  iconPlaceholder.classList.add("tow-combat-overlay-control-panel__slot-icon");
  iconPlaceholder.textContent = "+";
  slotElement.appendChild(iconPlaceholder);

  bindPanelSlotEvent(slotElement);
  return slotElement;
}

function getPrimaryTokenIconSrc(token) {
  const textureSrc = String(token?.document?.texture?.src ?? "").trim();
  if (textureSrc) return textureSrc;
  const actorImg = String(token?.actor?.img ?? "").trim();
  if (actorImg) return actorImg;
  return "";
}

function toReadableTypeLabel(rawType) {
  const value = String(rawType ?? "").trim();
  if (!value) return "";
  if (value !== value.toLowerCase()) return value;
  return value
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getPrimaryTokenName(token) {
  return String(token?.name ?? token?.document?.name ?? token?.actor?.name ?? "Selected token").trim();
}

function getPrimaryTokenTypeLabel(token) {
  const actor = token?.actor ?? token?.document?.actor;
  const systemType = String(actor?.system?.type ?? "").trim();
  const actorType = String(actor?.type ?? "").trim();
  const typeKey = (systemType || actorType).toLowerCase();
  const npcTypeLabelKey = game.oldworld?.config?.npcType?.[typeKey];
  if (typeof npcTypeLabelKey === "string" && npcTypeLabelKey.length > 0) {
    const localized = game?.i18n?.localize?.(npcTypeLabelKey);
    if (typeof localized === "string" && localized !== npcTypeLabelKey) return localized;
  }
  return toReadableTypeLabel(systemType || actorType || "Actor");
}

function formatStatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return String(Math.trunc(numeric));
}

function formatWoundsWithMax(token, woundsValue) {
  const current = formatStatNumber(woundsValue);
  if (current === "-") return current;
  const actor = token?.actor ?? token?.document?.actor ?? null;
  const max = towCombatOverlayGetMaxWoundLimit(actor);
  if (!Number.isFinite(Number(max)) || Number(max) <= 0) return current;
  const maxText = formatStatNumber(max);
  return `${current}/${maxText}`;
}

function formatMiscastDiceValue(token) {
  const actor = token?.actor ?? token?.document?.actor;
  const miscasts = Number(actor?.system?.magic?.miscasts ?? NaN);
  if (!Number.isFinite(miscasts)) return "-";
  return String(Math.trunc(miscasts));
}

function actorHasMagicCasting(actor) {
  const magicLevel = Number(actor?.system?.magic?.level ?? NaN);
  const hasMagicLevel = Number.isFinite(magicLevel) && magicLevel > 0;
  const spellCount = Number(actor?.itemTypes?.spell?.length ?? 0);
  return hasMagicLevel || spellCount > 0;
}

function getSpeedLabel(token) {
  const actor = token?.actor ?? token?.document?.actor;
  const speedRaw = actor?.system?.speed;
  let speedKey = "";

  if (typeof speedRaw === "string") speedKey = speedRaw;
  else if (speedRaw && typeof speedRaw === "object") {
    const objectKey = speedRaw.value ?? speedRaw.key ?? speedRaw.current ?? speedRaw.type ?? "";
    speedKey = typeof objectKey === "string" ? objectKey : "";
  }

  const normalizedKey = String(speedKey ?? "").trim().toLowerCase();
  if (!normalizedKey) return "-";
  const mapEntry = game.oldworld?.config?.speed?.[normalizedKey];
  if (typeof mapEntry === "string" && mapEntry.length > 0) {
    const localized = game?.i18n?.localize?.(mapEntry);
    if (typeof localized === "string" && localized !== mapEntry) return localized;
  }
  return toReadableTypeLabel(normalizedKey);
}

function normalizeItemDescription(item) {
  const descriptionSource = item?.system?.description
    ?? item?.system?.summary
    ?? item?.description
    ?? item?.flags?.core?.description
    ?? "";
  return normalizeDescriptionSource(descriptionSource);
}

function normalizeDescriptionSource(descriptionSource) {
  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  let raw = descriptionSource;
  if (raw && typeof raw === "object") {
    raw = raw?.value
      ?? raw?.public
      ?? raw?.text
      ?? raw?.content
      ?? raw?.description
      ?? "";
  }
  const html = (typeof raw === "string") ? raw : "";
  if (!html) return "";

  const refLabels = [];
  const refTokenized = html.replace(/@[\w.]+\[[^\]]+\](?:\{([^}]+)\})?/g, (_full, label) => {
    const index = refLabels.length;
    const safeLabel = String(label ?? "Reference").trim() || "Reference";
    refLabels.push(safeLabel);
    return `__TOW_REF_${index}__`;
  });

  const temp = document.createElement("div");
  temp.innerHTML = refTokenized
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "</p>\n");
  const plainText = String(temp.textContent ?? temp.innerText ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n");
  const normalizedText = plainText
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  let markup = escapeHtml(normalizedText).replace(/\n/g, "<br>");
  for (let index = 0; index < refLabels.length; index += 1) {
    const token = `__TOW_REF_${index}__`;
    const chip = `<span class="tow-combat-overlay-control-panel__ref-chip">${escapeHtml(refLabels[index])}</span>`;
    markup = markup.split(token).join(chip);
  }
  return markup;
}

function getPanelItemGroupsForActor(actor) {
  const toList = (value) => (Array.isArray(value) ? value : []);
  const abilityItems = toList(actor?.itemTypes?.ability);
  const talentItems = toList(actor?.itemTypes?.talent);
  const spellItems = toList(actor?.itemTypes?.spell);
  const blessingItems = toList(actor?.itemTypes?.blessing);
  const weaponItems = toList(actor?.itemTypes?.weapon);
  const actions = getPanelActionEntries();
  const manoeuvre = getPanelManoeuvreSubActionEntries();
  const recover = getPanelRecoverActionEntries();

  // Match Old World sheet logic:
  // - attacks: ability items where system.isAttack is true
  // - abilities: non-attack ability items + talents
  // - manoeuvre: fixed manoeuvre actions from core action config
  // - magic: spell items; blessings are religion in core, mapped here into magic group
  const attacks = abilityItems
    .filter((item) => item?.system?.isAttack === true)
    .concat(weaponItems.filter((item) => item?.system?.isEquipped || item?.system?.equipped?.value));
  const abilities = abilityItems
    .filter((item) => item?.system?.isAttack !== true)
    .concat(talentItems);
  const magic = spellItems.concat(blessingItems);

  return { actions, attacks, abilities, manoeuvre, recover, magic };
}

function debugTokenItems(controlPanelState, token) {
  if (!PANEL_DEBUG_ITEMS) return;
  const actor = token?.actor ?? token?.document?.actor ?? null;
  if (!actor) return;
  const tokenKey = String(token?.document?.uuid ?? token?.id ?? "");
  if (!tokenKey) return;
  if (controlPanelState?.lastDebugTokenKey === tokenKey) return;
  controlPanelState.lastDebugTokenKey = tokenKey;

  const rows = (Array.isArray(actor?.items?.contents) ? actor.items.contents : []).map((item) => ({
    id: item?.id ?? "",
    name: item?.name ?? "",
    type: item?.type ?? "",
    category: item?.system?.category ?? "",
    itemType: item?.system?.type ?? "",
    trappingType: item?.system?.trappingType ?? "",
    isAttack: item?.system?.isAttack ?? false
  }));

  console.groupCollapsed(`[tow-combat-overlay] Item debug: ${actor.name} (${rows.length})`);
  console.table(rows);
  console.groupEnd();
}

function resolveDynamicGridLayout(itemCount) {
  const count = Math.max(0, Math.trunc(Number(itemCount) || 0));
  if (count <= 0) return { columns: 1, rows: 1 };
  if (count === 1) return { columns: 1, rows: 1 };
  const rows = Math.max(1, Math.min(2, count));
  const columns = Math.max(1, Math.ceil(count / rows));
  return { columns, rows };
}

function getGroupGridElement(panelElement, groupKey) {
  return panelElement.querySelector(
    `.tow-combat-overlay-control-panel__item-group[data-item-group="${groupKey}"] .tow-combat-overlay-control-panel__group-grid`
  );
}

function ensureGroupSlotElements(panelElement, groupKey, slotCount) {
  const gridElement = getGroupGridElement(panelElement, groupKey);
  if (!(gridElement instanceof HTMLElement)) return [];

  const safeCount = Math.max(0, Math.trunc(Number(slotCount) || 0));
  let slotElements = Array.from(gridElement.querySelectorAll(".tow-combat-overlay-control-panel__slot"));

  while (slotElements.length < safeCount) {
    const slotElement = createPanelSlotElement(slotElements.length);
    gridElement.appendChild(slotElement);
    slotElements.push(slotElement);
  }

  while (slotElements.length > safeCount) {
    const slotElement = slotElements.pop();
    slotElement?.remove();
  }

  slotElements = Array.from(gridElement.querySelectorAll(".tow-combat-overlay-control-panel__slot"));
  return slotElements;
}

function applyGroupGridLayout(panelElement, groupKey, slotCount) {
  const gridElement = getGroupGridElement(panelElement, groupKey);
  if (!(gridElement instanceof HTMLElement)) return;

  // Force a strict single-row footprint for single-item groups.
  if (Number(slotCount) === 1) {
    gridElement.style.gridTemplateColumns = "repeat(1, var(--tow-control-panel-slot-size))";
    gridElement.style.gridTemplateRows = "repeat(1, var(--tow-control-panel-slot-size))";
    gridElement.style.gridAutoFlow = "column";
    return;
  }

  const { columns, rows } = resolveDynamicGridLayout(slotCount);
  gridElement.style.gridTemplateColumns = `repeat(${columns}, var(--tow-control-panel-slot-size))`;
  gridElement.style.gridTemplateRows = `repeat(${rows}, var(--tow-control-panel-slot-size))`;
  gridElement.style.gridAutoFlow = "";
}

function updateGroupSlots(panelElement, groupKey, groupItems = []) {
  const groupElement = panelElement.querySelector(
    `.tow-combat-overlay-control-panel__item-group[data-item-group="${groupKey}"]`
  );
  if (groupElement instanceof HTMLElement) {
    groupElement.style.display = (groupItems.length > 0) ? "" : "none";
  }

  if (groupItems.length <= 0) {
    ensureGroupSlotElements(panelElement, groupKey, 0);
    return;
  }

  applyGroupGridLayout(panelElement, groupKey, groupItems.length);
  const slotElements = ensureGroupSlotElements(panelElement, groupKey, groupItems.length);
  if (!slotElements.length) return;

  for (let index = 0; index < slotElements.length; index += 1) {
    const slotElement = slotElements[index];
    if (!(slotElement instanceof HTMLButtonElement)) continue;
    const iconPlaceholder = slotElement.querySelector(".tow-combat-overlay-control-panel__slot-icon");
    const item = groupItems[index] ?? null;

    let image = slotElement.querySelector(".tow-combat-overlay-control-panel__slot-image");
    if (!(image instanceof HTMLImageElement)) {
      image = document.createElement("img");
      image.classList.add("tow-combat-overlay-control-panel__slot-image");
      image.alt = "";
      slotElement.appendChild(image);
    }

    if (!item) {
      slotElement.dataset.itemType = "empty";
      slotElement.dataset.itemGroup = groupKey;
      slotElement.dataset.itemId = "";
      slotElement.dataset.tooltipTitle = "";
      slotElement.dataset.tooltipDescription = "";
      slotElement.setAttribute("aria-label", `Slot ${index + 1}`);
      image.src = "";
      image.alt = "";
      image.style.display = "none";
      if (iconPlaceholder instanceof HTMLElement) iconPlaceholder.style.display = "";
      continue;
    }

    const itemName = String(item?.name ?? `Item ${index + 1}`).trim();
    const itemDescription = normalizeItemDescription(item);
    const itemImage = String(item?.img ?? "").trim() || PANEL_FALLBACK_ITEM_ICON;
    slotElement.dataset.itemType = "item";
    slotElement.dataset.itemGroup = groupKey;
    slotElement.dataset.itemId = String(item?.id ?? "");
    slotElement.dataset.tooltipTitle = itemName;
    const itemKey = String(item?.id ?? "").trim().toLowerCase();
    if (groupKey === "attacks") {
      const attackHint = "<em>Click: pick target, then auto-roll attack. Shift+click: auto-roll self attack. Alt+click: pick target, then open default Foundry attack dialog (no auto-roll). Alt+Shift+click: open default Foundry self-roll dialog (no auto-roll).</em>";
      slotElement.dataset.tooltipDescription = itemDescription
        ? `${attackHint}<br><br>${itemDescription}`
        : attackHint;
    } else if (groupKey === "actions") {
      let actionsHint = "<em>Click: auto-flow action (auto-roll / auto-pick first). Alt+click: default Foundry action dialogs.</em>";
      if (itemKey === "aim") {
        actionsHint = "<em>Click: pick target then auto-roll. Shift+click: self auto-roll. Alt+click: pick target then manual dialog. Alt+Shift+click: self manual dialog.</em>";
      } else if (itemKey === "help") {
        actionsHint = "<em>Click: pick target then auto-flow. Shift+click: self auto-flow. Alt+click: pick target then manual dialogs. Alt+Shift+click: self manual dialogs.</em>";
      } else if (itemKey === "improvise") {
        actionsHint = "<em>Click: auto-pick first skill and auto-roll. Alt+click: manual skill selection/dialogs.</em>";
      } else if (itemKey === "defence") {
        actionsHint = "<em>Click: auto defence. Alt+click: manual defence selection dialog.</em>";
      }
      slotElement.dataset.tooltipDescription = itemDescription ? `${actionsHint}<br><br>${itemDescription}` : actionsHint;
    } else if (groupKey === "recover") {
      const recoverHint = "<em>Click: run selected Recover action with auto flow. Alt+click: open default Recover chooser dialog.</em>";
      slotElement.dataset.tooltipDescription = itemDescription
        ? `${recoverHint}<br><br>${itemDescription}`
        : recoverHint;
    } else if (groupKey === "manoeuvre") {
      const manoeuvreHint = "<em>Click: auto-roll manoeuvre checks (no dialogs). Alt+click: default Foundry manoeuvre flow (with dialogs).</em>";
      slotElement.dataset.tooltipDescription = itemDescription
        ? `${manoeuvreHint}<br><br>${itemDescription}`
        : manoeuvreHint;
    } else if (groupKey === "abilities" || groupKey === "magic") {
      const infoHint = "<em>Reference only in this panel (no quick click action).</em>";
      slotElement.dataset.tooltipDescription = itemDescription
        ? `${infoHint}<br><br>${itemDescription}`
        : infoHint;
    } else {
      slotElement.dataset.tooltipDescription = itemDescription;
    }
    slotElement.setAttribute("aria-label", itemName);
    image.src = itemImage;
    image.alt = itemName;
    image.style.display = "block";
    if (iconPlaceholder instanceof HTMLElement) iconPlaceholder.style.display = "none";
  }
}

function updatePanelSlots(panelElement, token = null) {
  const actor = token?.actor ?? token?.document?.actor ?? null;
  const groups = actor
    ? getPanelItemGroupsForActor(actor)
    : { actions: [], attacks: [], abilities: [], manoeuvre: [], recover: [], magic: [] };
  updateGroupSlots(panelElement, "actions", groups.actions);
  updateGroupSlots(panelElement, "attacks", groups.attacks);
  updateGroupSlots(panelElement, "abilities", groups.abilities);
  updateGroupSlots(panelElement, "manoeuvre", groups.manoeuvre);
  updateGroupSlots(panelElement, "recover", groups.recover);
  updateGroupSlots(panelElement, "magic", groups.magic);
}

function updateStatusDisplay(panelElement, token = null) {
  const statusElements = Array.from(panelElement?.querySelectorAll?.(".tow-combat-overlay-control-panel__status-icon[data-status-id]") ?? []);
  if (!statusElements.length) return;
  const actor = token?.actor ?? token?.document?.actor ?? null;
  const activeStatuses = actor ? getActorStatusSet(actor) : new Set();
  for (const statusElement of statusElements) {
    if (!(statusElement instanceof HTMLElement)) continue;
    const conditionId = String(statusElement.dataset.statusId ?? "");
    const isActive = !!conditionId && activeStatuses.has(conditionId);
    statusElement.classList.toggle("is-active", isActive);
  }
}

function updateSelectionDisplay(panelElement) {
  const controlPanelState = getControlPanelState();
  const selectionPanelElement = controlPanelState?.selectionElement;
  const selectionElement = selectionPanelElement?.querySelector?.(".tow-combat-overlay-control-panel__selection");
  if (!(selectionElement instanceof HTMLElement)) return;
  const imageElement = selectionElement.querySelector(".tow-combat-overlay-control-panel__selection-image");
  const selectionNameMainElement = selectionPanelElement?.querySelector?.(".tow-combat-overlay-control-panel__selection-name-main");
  const selectionResilienceElement = selectionPanelElement?.querySelector?.("[data-selection-stat='resilience']");
  const selectionWoundsElement = selectionPanelElement?.querySelector?.("[data-selection-stat='wounds']");
  const placeholderElement = selectionElement.querySelector(".tow-combat-overlay-control-panel__selection-placeholder");
  const multiCountElement = selectionElement.querySelector(".tow-combat-overlay-control-panel__selection-multi-count");
  if (!(imageElement instanceof HTMLImageElement)) return;
  if (!(selectionNameMainElement instanceof HTMLElement)) return;
  if (!(placeholderElement instanceof HTMLElement)) return;
  if (!(multiCountElement instanceof HTMLElement)) return;
  if (!(selectionResilienceElement instanceof HTMLElement)) return;
  if (!(selectionWoundsElement instanceof HTMLElement)) return;

  const controlledTokens = Array.isArray(canvas?.tokens?.controlled)
    ? canvas.tokens.controlled.filter((token) => token && !token.destroyed)
    : [];
  const selectedCount = controlledTokens.length;

  if (selectedCount !== 1) {
    panelElement.style.display = "none";
    if (selectionPanelElement instanceof HTMLElement) selectionPanelElement.style.display = "none";
    clearPanelAttackPickMode();
    return;
  }

  panelElement.style.display = "";
  if (selectionPanelElement instanceof HTMLElement) selectionPanelElement.style.display = "";

  const token = controlledTokens[0];
  debugTokenItems(controlPanelState, token);
  const iconSrc = getPrimaryTokenIconSrc(token);
  const tokenName = getPrimaryTokenName(token);
  const resilience = towCombatOverlayGetResilienceValue(token?.document);
  const wounds = towCombatOverlayGetWoundCount(token?.document);
  const actor = token?.actor ?? token?.document?.actor ?? null;
  const isDead = !!actor?.hasCondition?.("dead");
  selectionElement.dataset.selection = "single";
  selectionElement.classList.toggle("is-dead", isDead);
  imageElement.src = iconSrc;
  imageElement.alt = tokenName;
  selectionNameMainElement.textContent = tokenName || "-";
  selectionResilienceElement.textContent = formatStatNumber(resilience);
  selectionWoundsElement.textContent = formatWoundsWithMax(token, wounds);
  placeholderElement.textContent = iconSrc ? "-" : "?";
  multiCountElement.textContent = "x1";
  updatePanelSlots(panelElement, token);
  updateStatusDisplay(panelElement, token);
  updateActionControlsDisplay(panelElement, token);
  const rect = panelElement.getBoundingClientRect();
  applyPanelPosition(panelElement, rect.left, rect.top);
  syncSelectionPanelPosition(controlPanelState);
}

function bindPanelSelectionSync(controlPanelState, panelElement) {
  const onControlToken = () => updateSelectionDisplay(panelElement);
  const onCanvasReady = () => updateSelectionDisplay(panelElement);
  const onUpdateActor = () => updateSelectionDisplay(panelElement);
  const onCreateItem = () => updateSelectionDisplay(panelElement);
  const onUpdateItem = () => updateSelectionDisplay(panelElement);
  const onDeleteItem = () => updateSelectionDisplay(panelElement);
  const onCreateActiveEffect = () => updateSelectionDisplay(panelElement);
  const onUpdateActiveEffect = () => updateSelectionDisplay(panelElement);
  const onDeleteActiveEffect = () => updateSelectionDisplay(panelElement);
  const controlTokenHookId = Hooks.on("controlToken", onControlToken);
  const canvasReadyHookId = Hooks.on("canvasReady", onCanvasReady);
  const updateActorHookId = Hooks.on("updateActor", onUpdateActor);
  const createItemHookId = Hooks.on("createItem", onCreateItem);
  const updateItemHookId = Hooks.on("updateItem", onUpdateItem);
  const deleteItemHookId = Hooks.on("deleteItem", onDeleteItem);
  const createActiveEffectHookId = Hooks.on("createActiveEffect", onCreateActiveEffect);
  const updateActiveEffectHookId = Hooks.on("updateActiveEffect", onUpdateActiveEffect);
  const deleteActiveEffectHookId = Hooks.on("deleteActiveEffect", onDeleteActiveEffect);

  controlPanelState.controlTokenHookId = controlTokenHookId;
  controlPanelState.canvasReadyHookId = canvasReadyHookId;
  controlPanelState.updateActorHookId = updateActorHookId;
  controlPanelState.createItemHookId = createItemHookId;
  controlPanelState.updateItemHookId = updateItemHookId;
  controlPanelState.deleteItemHookId = deleteItemHookId;
  controlPanelState.createActiveEffectHookId = createActiveEffectHookId;
  controlPanelState.updateActiveEffectHookId = updateActiveEffectHookId;
  controlPanelState.deleteActiveEffectHookId = deleteActiveEffectHookId;
  controlPanelState.onControlToken = onControlToken;
  controlPanelState.onCanvasReady = onCanvasReady;
  controlPanelState.onUpdateActor = onUpdateActor;
  controlPanelState.onCreateItem = onCreateItem;
  controlPanelState.onUpdateItem = onUpdateItem;
  controlPanelState.onDeleteItem = onDeleteItem;
  controlPanelState.onCreateActiveEffect = onCreateActiveEffect;
  controlPanelState.onUpdateActiveEffect = onUpdateActiveEffect;
  controlPanelState.onDeleteActiveEffect = onDeleteActiveEffect;
  updateSelectionDisplay(panelElement);
}

function isDragBlockedTarget(targetElement) {
  if (!(targetElement instanceof Element)) return true;
  const blockedSelector = [
    ".tow-combat-overlay-control-panel__slot",
    ".tow-combat-overlay-control-panel__selection",
    ".tow-combat-overlay-control-panel__stats",
    ".tow-combat-overlay-control-panel__statuses",
    "button",
    "input",
    "select",
    "textarea",
    "a",
    "[contenteditable='true']"
  ].join(", ");
  return !!targetElement.closest(blockedSelector);
}

function bindControlPanelDrag(controlPanelState, panelElement, { onMoved = null } = {}) {
  let dragData = null;

  const onPointerMove = (event) => {
    if (!dragData) return;
    const deltaX = Number(event.clientX) - dragData.startClientX;
    const deltaY = Number(event.clientY) - dragData.startClientY;
    applyPanelPosition(panelElement, dragData.startLeft + deltaX, dragData.startTop + deltaY);
    if (typeof onMoved === "function") onMoved();
  };

  const onPointerUp = () => {
    if (!dragData) return;
    dragData = null;
    panelElement.classList.remove("is-dragging");
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    writeSavedPanelPosition(panelElement);
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
    applyPanelPosition(panelElement, rect.left, rect.top);
    if (typeof onMoved === "function") onMoved();
  };

  panelElement.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("resize", onResize);

  controlPanelState.onPointerDown = onPointerDown;
  controlPanelState.onResize = onResize;
  controlPanelState.onPointerMove = onPointerMove;
  controlPanelState.onPointerUp = onPointerUp;
}

function removeStaleControlPanels() {
  for (const panel of Array.from(document.querySelectorAll(`#${PANEL_ID}, #${PANEL_SELECTION_ID}`))) {
    if (panel instanceof HTMLElement) panel.remove();
  }
}

export async function towCombatOverlayEnsureControlPanel() {
  const controlPanelState = getControlPanelState();
  if (!controlPanelState) return;

  const hasMainPanel = controlPanelState.element instanceof HTMLElement && controlPanelState.element.isConnected;
  const hasSelectionPanel = controlPanelState.selectionElement instanceof HTMLElement && controlPanelState.selectionElement.isConnected;
  if (hasMainPanel && hasSelectionPanel) return;
  removeStaleControlPanels();

  const { panelElement, selectionPanelElement } = await createControlPanelElement();
  panelElement.style.visibility = "hidden";
  selectionPanelElement.style.visibility = "hidden";
  document.body.appendChild(panelElement);
  document.body.appendChild(selectionPanelElement);
  applyInitialPanelPosition(panelElement);
  syncSelectionPanelPosition({ element: panelElement, selectionElement: selectionPanelElement });
  panelElement.style.visibility = "";
  selectionPanelElement.style.visibility = "";

  bindPanelActionControls(panelElement);
  bindPanelActionControls(selectionPanelElement);
  bindSelectionPanelStatEvents(selectionPanelElement);
  bindPanelTypeIconTooltipEvent(panelElement);
  bindPanelStatusesTooltipEvents(panelElement);
  controlPanelState.element = panelElement;
  controlPanelState.selectionElement = selectionPanelElement;
  bindControlPanelDrag(controlPanelState, panelElement, {
    onMoved: () => syncSelectionPanelPosition(controlPanelState)
  });
  bindPanelSelectionSync(controlPanelState, panelElement);
}

export function towCombatOverlayRemoveControlPanel() {
  const controlPanelState = game?.[PANEL_STATE_KEY];
  clearPanelAttackPickMode();
  const panelElement = controlPanelState?.element;
  const selectionPanelElement = controlPanelState?.selectionElement;
  const onPointerDown = controlPanelState?.onPointerDown;
  const onPointerMove = controlPanelState?.onPointerMove;
  const onPointerUp = controlPanelState?.onPointerUp;
  const onResize = controlPanelState?.onResize;
  const controlTokenHookId = controlPanelState?.controlTokenHookId;
  const canvasReadyHookId = controlPanelState?.canvasReadyHookId;
  const updateActorHookId = controlPanelState?.updateActorHookId;
  const createItemHookId = controlPanelState?.createItemHookId;
  const updateItemHookId = controlPanelState?.updateItemHookId;
  const deleteItemHookId = controlPanelState?.deleteItemHookId;
  const createActiveEffectHookId = controlPanelState?.createActiveEffectHookId;
  const updateActiveEffectHookId = controlPanelState?.updateActiveEffectHookId;
  const deleteActiveEffectHookId = controlPanelState?.deleteActiveEffectHookId;

  if (panelElement instanceof HTMLElement && typeof onPointerDown === "function") {
    panelElement.removeEventListener("pointerdown", onPointerDown);
  }
  if (typeof onPointerMove === "function") window.removeEventListener("pointermove", onPointerMove);
  if (typeof onPointerUp === "function") {
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  }
  if (typeof onResize === "function") window.removeEventListener("resize", onResize);
  if (controlTokenHookId != null) Hooks.off("controlToken", controlTokenHookId);
  if (canvasReadyHookId != null) Hooks.off("canvasReady", canvasReadyHookId);
  if (updateActorHookId != null) Hooks.off("updateActor", updateActorHookId);
  if (createItemHookId != null) Hooks.off("createItem", createItemHookId);
  if (updateItemHookId != null) Hooks.off("updateItem", updateItemHookId);
  if (deleteItemHookId != null) Hooks.off("deleteItem", deleteItemHookId);
  if (createActiveEffectHookId != null) Hooks.off("createActiveEffect", createActiveEffectHookId);
  if (updateActiveEffectHookId != null) Hooks.off("updateActiveEffect", updateActiveEffectHookId);
  if (deleteActiveEffectHookId != null) Hooks.off("deleteActiveEffect", deleteActiveEffectHookId);
  if (panelElement instanceof HTMLElement) panelElement.remove();
  if (selectionPanelElement instanceof HTMLElement) selectionPanelElement.remove();

  removeStaleControlPanels();
  if (game && Object.prototype.hasOwnProperty.call(game, PANEL_STATE_KEY)) delete game[PANEL_STATE_KEY];
}
