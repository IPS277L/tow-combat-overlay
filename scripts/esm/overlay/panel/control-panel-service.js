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
  AUTO_DEFENCE_WAIT_MS,
  AUTO_APPLY_WAIT_MS,
  OPPOSED_LINK_WAIT_MS,
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
  towCombatOverlayIsCtrlModifier,
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
import { towCombatOverlayRollSkill } from "../../combat/defence-service.js";
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
const PANEL_BUTTON_ORDER_LOCAL_STORAGE_KEY = "tow-combat-overlay.control-panel-button-order.v1";
const PANEL_REORDER_UNLOCKED_LOCAL_STORAGE_KEY = "tow-combat-overlay.control-panel-reorder-unlocked.v1";
const PANEL_STATE_KEY = "__towCombatOverlayControlPanelState";
const PANEL_VIEWPORT_MARGIN_PX = 8;
const PANEL_SELECTION_GAP_PX = 0;
const PANEL_FALLBACK_ITEM_ICON = "icons/svg/item-bag.svg";
const PANEL_RESILIENCE_ICON = "icons/svg/shield.svg";
const PANEL_SPEED_ICON = "icons/svg/wingfoot.svg";
const PANEL_ROLL_ICON = "icons/svg/d20-grey.svg";
const PANEL_DICE_ICON = "icons/svg/d10-grey.svg";
const PANEL_DEBUG_ITEMS = false;
const PANEL_ATTACK_PICK_CURSOR = "crosshair";
const PANEL_MANOEUVRE_ICON_BY_KEY = {
  run: "icons/skills/movement/feet-winged-boots-brown.webp",
  charge: "icons/skills/melee/strike-sword-steel-yellow.webp",
  moveQuietly: "icons/magic/nature/stealth-hide-beast-eyes-green.webp",
  moveCarefully: "icons/magic/nature/root-vine-entangle-foot-green.webp"
};
const PANEL_MANOEUVRE_ORDER = ["charge", "run", "moveQuietly", "moveCarefully"];
const PANEL_RECOVER_ICON_BY_KEY = {
  recover: "icons/consumables/potions/bottle-round-label-cork-red.webp",
  treat: "icons/skills/wounds/injury-stapled-flesh-tan.webp",
  condition: "icons/skills/wounds/injury-pain-body-orange.webp"
};
const PANEL_RECOVER_ORDER = ["treat", "condition", "recover"];
const PANEL_ACTIONS_ORDER = ["help", "defence", "aim", "improvise"];
const PANEL_ACTION_ICON_BY_KEY = {
  aim: "icons/skills/targeting/crosshair-ringed-gray.webp",
  help: "icons/skills/social/diplomacy-handshake.webp",
  improvise: "icons/magic/time/hourglass-tilted-glowing-gold.webp",
  defence: "icons/equipment/shield/heater-wooden-antlers-blue.webp",
  unarmed: "icons/weapons/clubs/club-banded-steel.webp"
};
const PANEL_UNARMED_FLAG_KEY = "generatedUnarmedAction";
const PANEL_UNARMED_ACTION_ID = "unarmed";
const PANEL_UNARMED_CLEANUP_POLL_MS = 250;
const PANEL_UNARMED_CLEANUP_MAX_WAIT_MS = AUTO_APPLY_WAIT_MS + AUTO_DEFENCE_WAIT_MS + 4000;
const PANEL_UNARMED_OPPOSED_DISCOVERY_GRACE_MS = 2000;
const PANEL_STAGGER_PATCH_DURATION_MS = AUTO_STAGGER_PATCH_MS + AUTO_APPLY_WAIT_MS + AUTO_DEFENCE_WAIT_MS;
const PANEL_MAIN_GRID_MIN_COLUMNS = 7;
const PANEL_MAIN_GRID_MIN_ROWS = 2;
const PANEL_REORDERABLE_GROUP_KEYS = new Set(["manoeuvre", "recover", "actions", "attacks", "magic"]);
const {
  moduleId: MODULE_ID,
  settings: MODULE_SETTINGS,
  tooltips: MODULE_TOOLTIPS
} = getTowCombatOverlayConstants();

function isPanelAutoDefenceEnabled() {
  try {
    return game.settings.get(MODULE_ID, MODULE_SETTINGS.enableAutoDefence) !== false;
  } catch (_error) {
    return true;
  }
}

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
  return {
    title: String(name || "Condition"),
    description: shortDescription
  };
}

function getControlPanelState() {
  if (!game) return null;
  if (!game[PANEL_STATE_KEY]) game[PANEL_STATE_KEY] = {};
  return game[PANEL_STATE_KEY];
}

function resolvePanelButtonOrderScope(token = null) {
  const tokenUuid = String(token?.document?.uuid ?? token?.document?.id ?? token?.id ?? "").trim();
  if (tokenUuid) return `token:${tokenUuid}`;
  const actorUuid = String(token?.actor?.uuid ?? token?.document?.actor?.uuid ?? "").trim();
  if (actorUuid) return `actor:${actorUuid}`;
  return "global";
}

function getPanelButtonOrderStorageKey(scope = "global") {
  const rawScope = String(scope ?? "global").trim() || "global";
  return `${PANEL_BUTTON_ORDER_LOCAL_STORAGE_KEY}:${rawScope}`;
}


function getPanelReorderUnlockedStorageKey(scope = "global") {
  const rawScope = String(scope ?? "global").trim() || "global";
  return `${PANEL_REORDER_UNLOCKED_LOCAL_STORAGE_KEY}:${rawScope}`;
}
function getCurrentPanelButtonOrderScope() {
  const controlPanelState = getControlPanelState();
  return String(controlPanelState?.buttonOrderScope ?? "global").trim() || "global";
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

function toPanelButtonKey(groupKey, itemId) {
  const group = String(groupKey ?? "").trim();
  const id = String(itemId ?? "").trim();
  if (!group || !id) return "";
  return `${group}:${id}`;
}

function parsePanelButtonKey(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const separatorIndex = raw.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex >= raw.length - 1) return null;
  const groupKey = raw.slice(0, separatorIndex).trim();
  const itemId = raw.slice(separatorIndex + 1).trim();
  if (!groupKey || !itemId) return null;
  return { groupKey, itemId };
}

function isSyntheticEmptySlotKey(value) {
  const parsed = parsePanelButtonKey(value);
  if (!parsed) return false;
  return String(parsed.itemId ?? "").startsWith("empty-slot-");
}

function getDefaultPanelButtonKeyOrder() {
  const preferredSequence = [
    ["manoeuvre", "charge"],
    ["manoeuvre", "run"],
    ["manoeuvre", "moveQuietly"],
    ["manoeuvre", "moveCarefully"],
    ["recover", "recover"],
    ["recover", "treat"],
    ["actions", "help"],
    ["recover", "condition"],
    ["actions", "defence"],
    ["actions", "aim"],
    ["attacks", PANEL_UNARMED_ACTION_ID],
    ["actions", "improvise"]
  ];
  return preferredSequence
    .map(([groupKey, itemId]) => toPanelButtonKey(groupKey, itemId))
    .filter(Boolean);
}

function readSavedPanelButtonKeyOrder(scope = "global") {
  try {
    const raw = window.localStorage.getItem(getPanelButtonOrderStorageKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const keys = parsed
      .map((entry) => String(entry ?? "").trim())
      .filter((entry) => !!parsePanelButtonKey(entry));
    return keys.length ? Array.from(new Set(keys)) : null;
  } catch (_error) {
    return null;
  }
}
function writeSavedPanelButtonKeyOrder(buttonKeys, scope = "global") {
  if (!Array.isArray(buttonKeys)) return;
  const keys = buttonKeys
    .map((entry) => String(entry ?? "").trim())
    .filter((entry) => !!parsePanelButtonKey(entry));
  if (!keys.length) return;
  try {
    window.localStorage.setItem(getPanelButtonOrderStorageKey(scope), JSON.stringify(Array.from(new Set(keys))));
  } catch (_error) {
    // Ignore storage errors.
  }
}

function clearSavedPanelButtonKeyOrder(scope = "global") {
  try {
    window.localStorage.removeItem(getPanelButtonOrderStorageKey(scope));
  } catch (_error) {
    // Ignore storage errors.
  }
}
function readSavedPanelReorderUnlocked(scope = "global") {
  try {
    return window.localStorage.getItem(getPanelReorderUnlockedStorageKey(scope)) === "true";
  } catch (_error) {
    return false;
  }
}

function writeSavedPanelReorderUnlocked(unlocked, scope = "global") {
  try {
    if (unlocked) window.localStorage.setItem(getPanelReorderUnlockedStorageKey(scope), "true");
    else window.localStorage.removeItem(getPanelReorderUnlockedStorageKey(scope));
  } catch (_error) {
    // Ignore storage errors.
  }
}

function isPanelButtonReorderUnlocked() {
  const controlPanelState = getControlPanelState();
  return !!controlPanelState?.buttonReorderUnlocked;
}

function getPanelReorderToggleTooltipData(unlocked) {
  if (unlocked) {
    return {
      title: "Button Order: Unlocked",
      description: "<em>Click to lock button order.</em><br><br>Drag and drop is enabled."
    };
  }
  return {
    title: "Button Order: Locked",
    description: "<em>Click to unlock and rearrange buttons.</em><br><br>Drag and drop is disabled."
  };
}

function syncPanelReorderToggleButton(panelElement) {
  if (!(panelElement instanceof HTMLElement)) return;
  const button = panelElement.querySelector("[data-action='toggle-button-reorder']");
  if (!(button instanceof HTMLButtonElement)) return;
  const unlocked = isPanelButtonReorderUnlocked();
  const tooltipData = getPanelReorderToggleTooltipData(unlocked);
  button.dataset.state = unlocked ? "unlocked" : "locked";
  button.setAttribute("aria-pressed", unlocked ? "true" : "false");
  button.setAttribute("aria-label", unlocked ? "Lock button order" : "Unlock button order");
  button.dataset.tooltipTitle = tooltipData.title;
  button.dataset.tooltipDescription = tooltipData.description;
  button.removeAttribute("title");
  panelElement.classList.toggle("is-reorder-unlocked", unlocked);
  const icon = button.querySelector(".tow-combat-overlay-control-panel__reorder-toggle-icon");
  if (icon instanceof HTMLElement) icon.textContent = unlocked ? "U" : "L";
}

function bindPanelReorderToggle(panelElement) {
  if (!(panelElement instanceof HTMLElement)) return;
  const button = panelElement.querySelector("[data-action='toggle-button-reorder']");
  if (!(button instanceof HTMLButtonElement)) return;
  bindPanelTooltipEvent(button, () => getPanelReorderToggleTooltipData(isPanelButtonReorderUnlocked()));
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const controlPanelState = getControlPanelState();
    if (!controlPanelState) return;
    const scope = getCurrentPanelButtonOrderScope();
    const unlocked = !isPanelButtonReorderUnlocked();
    controlPanelState.buttonReorderUnlocked = unlocked;
    writeSavedPanelReorderUnlocked(unlocked, scope);
    syncPanelReorderToggleButton(panelElement);
  });
  syncPanelReorderToggleButton(panelElement);
}


function bindPanelReorderReset(panelElement) {
  if (!(panelElement instanceof HTMLElement)) return;
  const button = panelElement.querySelector("[data-action='reset-button-order']");
  if (!(button instanceof HTMLButtonElement)) return;
  const tooltipTitle = "Reset Button Order";
  const tooltipDescription = "<em>Click to reset the selected token action buttons to default order.</em>";
  button.dataset.tooltipTitle = tooltipTitle;
  button.dataset.tooltipDescription = tooltipDescription;
  button.removeAttribute("title");
  bindPanelTooltipEvent(button, () => ({ title: tooltipTitle, description: tooltipDescription }));
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const scope = getCurrentPanelButtonOrderScope();
    clearSavedPanelButtonKeyOrder(scope);
    const controlPanelState = getControlPanelState();
    if (controlPanelState?.element instanceof HTMLElement) {
      updateSelectionDisplay(controlPanelState.element);
    }
  });
}
function getVisibleMainPanelButtonKeys(panelElement) {
  if (!(panelElement instanceof HTMLElement)) return [];
  const slots = Array.from(
    panelElement.querySelectorAll(".tow-combat-overlay-control-panel__group-grid[data-item-group='all'] .tow-combat-overlay-control-panel__slot")
  );
  if (!slots.length) return [];
  const keys = [];
  for (const slot of slots) {
    const key = getSlotPanelButtonKey(slot);
    if (!key || !parsePanelButtonKey(key)) continue;
    keys.push(key);
  }
  return keys;
}
function movePanelButtonKeyBeforeTarget(sourceKey, targetKey, panelElement = null) {
  const source = String(sourceKey ?? "").trim();
  const target = String(targetKey ?? "").trim();
  if (!source || !target || source === target) return false;

  const scope = getCurrentPanelButtonOrderScope();
  const defaultOrder = getDefaultPanelButtonKeyOrder();
  const savedOrder = readSavedPanelButtonKeyOrder(scope) ?? [];
  const visibleOrder = getVisibleMainPanelButtonKeys(panelElement);
  const merged = Array.from(new Set([...visibleOrder, ...savedOrder, ...defaultOrder]));

  // Allow reordering of runtime/dynamic buttons that are not in default order.
  if (!merged.includes(source)) merged.push(source);
  if (!merged.includes(target)) merged.push(target);

  const sourceIndex = merged.indexOf(source);
  const targetIndex = merged.indexOf(target);
  if (sourceIndex < 0 || targetIndex < 0) return false;

  // Swap source and target positions for predictable visual drag/drop in a 2-row grid.
  const temp = merged[sourceIndex];
  merged[sourceIndex] = merged[targetIndex];
  merged[targetIndex] = temp;

  // Preserve all synthetic empty-slot keys so each visible empty cell can be reordered.
  const normalized = merged.filter((key) => !!parsePanelButtonKey(key));

  writeSavedPanelButtonKeyOrder(normalized, scope);
  return true;
}
function getSlotPanelButtonKey(slotElement) {
  if (!(slotElement instanceof HTMLElement)) return "";
  const itemType = String(slotElement.dataset.itemType ?? "").trim();
  const itemGroup = String(slotElement.dataset.itemGroup ?? "").trim();

  if (itemType === "empty") {
    const explicitKey = String(slotElement.dataset.itemOrderKey ?? "").trim();
    if (explicitKey && parsePanelButtonKey(explicitKey)) return explicitKey;
    const fallbackId = String(slotElement.dataset.itemId ?? "").trim() || "empty";
    return toPanelButtonKey(itemGroup || "all", fallbackId);
  }

  if (itemType !== "item") return "";
  if (!PANEL_REORDERABLE_GROUP_KEYS.has(itemGroup)) return "";

  const explicitKey = String(slotElement.dataset.itemOrderKey ?? "").trim();
  if (explicitKey && parsePanelButtonKey(explicitKey)) return explicitKey;

  const itemId = String(slotElement.dataset.itemId ?? "").trim();
  return toPanelButtonKey(itemGroup, itemId);
}
function isMainActionPanelSlot(slotElement) {
  if (!(slotElement instanceof HTMLElement)) return false;
  const gridElement = slotElement.closest(".tow-combat-overlay-control-panel__group-grid[data-item-group='all']");
  if (!(gridElement instanceof HTMLElement)) return false;
  return !!getSlotPanelButtonKey(slotElement);
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

function applyPanelPositionWithSelectionClamp(controlPanelState, panelElement, left, top) {
  const bounds = getPanelBounds(panelElement);
  let minLeft = bounds.minLeft;
  let maxLeft = bounds.maxLeft;
  let minTop = bounds.minTop;
  let maxTop = bounds.maxTop;

  const selectionPanelElement = controlPanelState?.selectionElement;
  if (selectionPanelElement instanceof HTMLElement && selectionPanelElement.isConnected) {
    const panelRect = panelElement.getBoundingClientRect();
    const selectionRect = selectionPanelElement.getBoundingClientRect();
    const selectionVisible = selectionRect.width > 0 && selectionRect.height > 0 && selectionPanelElement.style.display !== "none";

    if (selectionVisible) {
      const leftOverflow = Math.max(0, panelRect.left - selectionRect.left);
      const topOverflow = Math.max(0, panelRect.top - selectionRect.top);
      const bottomOverflow = Math.max(0, selectionRect.bottom - panelRect.bottom);

      minLeft += leftOverflow;
      minTop += topOverflow;
      maxTop -= bottomOverflow;
    }
  }

  const safeLeft = clampPanelCoordinate(left, minLeft, maxLeft);
  const safeTop = clampPanelCoordinate(top, minTop, maxTop);
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
        <div class="tow-combat-overlay-control-panel__selection" data-selection="none">
          <img class="tow-combat-overlay-control-panel__selection-image" src="" alt="Selected token" />
          <span class="tow-combat-overlay-control-panel__selection-name">
            <span class="tow-combat-overlay-control-panel__selection-name-main">-</span>
          </span>
          <div class="tow-combat-overlay-control-panel__selection-side-stack">
            <button type="button" class="tow-combat-overlay-control-panel__selection-stat-row" data-selection-stat-row="wounds">
              <span class="tow-combat-overlay-control-panel__selection-stat-value" data-selection-stat="wounds">-</span>
              <img class="tow-combat-overlay-control-panel__selection-stat-icon" src="${ICON_SRC_WOUND}" alt="" />
            </button>
            <button type="button" class="tow-combat-overlay-control-panel__selection-stat-row" data-selection-stat-row="resilience">
              <span class="tow-combat-overlay-control-panel__selection-stat-value" data-selection-stat="resilience">-</span>
              <img class="tow-combat-overlay-control-panel__selection-stat-icon" src="${PANEL_RESILIENCE_ICON}" alt="" />
            </button>
            <button type="button" class="tow-combat-overlay-control-panel__selection-stat-row" data-selection-stat-row="speed">
              <span class="tow-combat-overlay-control-panel__selection-stat-value" data-selection-stat="speed">-</span>
              <img class="tow-combat-overlay-control-panel__selection-stat-icon tow-combat-overlay-control-panel__selection-stat-icon--speed" src="${PANEL_SPEED_ICON}" alt="" />
            </button>
            <div class="tow-combat-overlay-control-panel__selection-mini-controls">
              <button
                type="button"
                class="tow-combat-overlay-control-panel__selection-text-control tow-combat-overlay-control-panel__modifier-icon"
                data-action-control="rollState"
                aria-label="Roll State"
              >
                <span class="tow-combat-overlay-control-panel__modifier-text" data-action-label="rollState">co</span>
                <img class="tow-combat-overlay-control-panel__selection-stat-icon" src="${PANEL_ROLL_ICON}" alt="" />
              </button>
              <button
                type="button"
                class="tow-combat-overlay-control-panel__selection-text-control tow-combat-overlay-control-panel__modifier-icon"
                data-action-control="diceModifier"
                aria-label="Dice Modifier"
              >
                <span class="tow-combat-overlay-control-panel__modifier-text" data-action-label="diceModifier">+0d10</span>
                <img class="tow-combat-overlay-control-panel__selection-stat-icon tow-combat-overlay-control-panel__selection-stat-icon--dice" src="${PANEL_DICE_ICON}" alt="" />
              </button>
            </div>
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
  const selectionSizePx = Math.max(1, Math.round(panelRect.height));
  selectionPanelElement.style.setProperty("--tow-control-panel-selection-size", `${selectionSizePx}px`);

  const selectionRect = selectionPanelElement.getBoundingClientRect();
  const selectionImageBlock = selectionPanelElement.querySelector(".tow-combat-overlay-control-panel__selection");
  const imageBottomOffset = (selectionImageBlock instanceof HTMLElement)
    ? (selectionImageBlock.offsetTop + selectionImageBlock.offsetHeight)
    : selectionPanelElement.offsetHeight;
  const left = panelRect.left - selectionRect.width - PANEL_SELECTION_GAP_PX;
  const top = panelRect.bottom - imageBottomOffset;
  selectionPanelElement.style.left = `${Math.round(left)}px`;
  selectionPanelElement.style.top = `${Math.round(top)}px`;
}

function bindPanelSlotEvent(slotElement) {
  slotElement.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (isPanelButtonReorderUnlocked() && isMainActionPanelSlot(slotElement)) return;
    event.preventDefault();
    void handlePanelSlotClick(slotElement, event);
  });
  slotElement.addEventListener("click", (event) => {
    event.preventDefault();
  });
  slotElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    if (String(slotElement.dataset.itemGroup ?? "") !== "temporaryEffects") return;
    void handlePanelSlotClick(slotElement, event);
  });

  slotElement.draggable = true;
  slotElement.addEventListener("dragstart", (event) => {    if (!isPanelButtonReorderUnlocked() || !isMainActionPanelSlot(slotElement)) {
      event.preventDefault();
      return;
    }
    const sourceKey = getSlotPanelButtonKey(slotElement);
    if (!sourceKey) {
      event.preventDefault();
      return;
    }
    const controlPanelState = getControlPanelState();
    if (controlPanelState) controlPanelState.draggedPanelButtonKey = sourceKey;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", sourceKey);
    }
  });

  slotElement.addEventListener("dragover", (event) => {    if (!isPanelButtonReorderUnlocked() || !isMainActionPanelSlot(slotElement)) return;
    const targetKey = getSlotPanelButtonKey(slotElement);
    if (!targetKey) return;
    const controlPanelState = getControlPanelState();
    const sourceKey = String(
      controlPanelState?.draggedPanelButtonKey
      ?? event.dataTransfer?.getData("text/plain")
      ?? ""
    ).trim();
    if (!sourceKey || sourceKey === targetKey) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  });

  slotElement.addEventListener("drop", (event) => {    if (!isPanelButtonReorderUnlocked() || !isMainActionPanelSlot(slotElement)) return;
    const targetKey = getSlotPanelButtonKey(slotElement);
    const controlPanelState = getControlPanelState();
    const sourceKey = String(
      controlPanelState?.draggedPanelButtonKey
      ?? event.dataTransfer?.getData("text/plain")
      ?? ""
    ).trim();
    if (!sourceKey || !targetKey || sourceKey === targetKey) return;
    event.preventDefault();
    const panelElement = slotElement.closest(".tow-combat-overlay-control-panel") ?? controlPanelState?.element ?? null;
    if (!movePanelButtonKeyBeforeTarget(sourceKey, targetKey, panelElement)) return;
    if (controlPanelState?.element instanceof HTMLElement) {
      updateSelectionDisplay(controlPanelState.element);
    }
  });

  slotElement.addEventListener("dragend", () => {
    const controlPanelState = getControlPanelState();
    if (controlPanelState) controlPanelState.draggedPanelButtonKey = "";
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
  const restoreStaggerPrompt = automation.armDefaultStaggerChoiceWound(PANEL_STAGGER_PATCH_DURATION_MS);
  automation.armAutoDefenceForOpposed(sourceToken, targetToken, { sourceBeforeState });

  try {
    await withTemporaryUserTargets(targetToken, () => towCombatOverlaySetupAbilityTestWithDamage(sourceActor, attackItem, {
      autoRoll
    }));
  } finally {
    setTimeout(() => restoreStaggerPrompt(), AUTO_APPLY_WAIT_MS);
  }
}

function isPanelGeneratedUnarmedItem(item) {
  return item?.getFlag?.("tow-combat-overlay", PANEL_UNARMED_FLAG_KEY) === true;
}

async function withTemporaryPanelUnarmedAbility(actor, callback) {
  if (!actor || typeof callback !== "function") return null;
  if (!towCombatOverlayCanEditActor(actor)) {
    towCombatOverlayWarnNoPermission(actor);
    return null;
  }

  const created = await actor.createEmbeddedDocuments("Item", [{
    name: "Unarmed Attack",
    type: "ability",
    img: PANEL_ACTION_ICON_BY_KEY.unarmed ?? PANEL_FALLBACK_ITEM_ICON,
    system: {
      description: {
        public: "<p>Quick unarmed strike.</p>",
        gm: ""
      },
      attack: {
        skill: "brawn",
        dice: 0,
        target: 0,
        traits: ""
      },
      damage: {
        formula: "0",
        characteristic: "",
        ignoreArmour: false,
        magical: false,
        successes: true,
        bonus: 0,
        excludeStaggeredOptions: {
          give: false,
          prone: false,
          wounds: false
        }
      }
    },
    flags: {
      "tow-combat-overlay": {
        [PANEL_UNARMED_FLAG_KEY]: true
      }
    }
  }]);

  const unarmedAbility = created?.[0] ?? null;
  if (!unarmedAbility) return null;

  const deleteIfPresent = async () => {
    const unarmedId = String(unarmedAbility?.id ?? "");
    if (!unarmedId) return;
    if (!actor?.items?.get?.(unarmedId)) return;
    try {
      await actor.deleteEmbeddedDocuments("Item", [unarmedId]);
    } catch (_error) {
      // Ignore cleanup errors.
    }
  };

  const cleanupWhenSafe = async (testRef) => {
    const startedAt = Date.now();
    const initialMessageId = String(testRef?.context?.messageId ?? "").trim();
    let sawOpposedIds = false;

    while (Date.now() - startedAt < PANEL_UNARMED_CLEANUP_MAX_WAIT_MS) {
      const message = initialMessageId ? game?.messages?.get?.(initialMessageId) : null;
      const opposedIds = Object.values(
        message?.system?.test?.context?.opposedIds
        ?? testRef?.context?.opposedIds
        ?? {}
      )
        .map((id) => String(id ?? "").trim())
        .filter(Boolean);

      if (opposedIds.length > 0) sawOpposedIds = true;

      // No opposed chain discovered within grace window: safe to delete.
      if (!sawOpposedIds && (Date.now() - startedAt) >= PANEL_UNARMED_OPPOSED_DISCOVERY_GRACE_MS) {
        await deleteIfPresent();
        return;
      }

      const allComputed = opposedIds.every((id) => {
        const opposedMessage = game?.messages?.get?.(id);
        return opposedMessage?.type === "opposed" && opposedMessage?.system?.result?.computed === true;
      });
      if (opposedIds.length > 0 && allComputed) {
        await deleteIfPresent();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, PANEL_UNARMED_CLEANUP_POLL_MS));
    }

    // Fallback cleanup after max wait.
    await deleteIfPresent();
  };

  let callbackResult = null;
  try {
    callbackResult = await callback(unarmedAbility);
    return callbackResult;
  } finally {
    void cleanupWhenSafe(callbackResult);
  }
}

function armAutoEnduranceDefenceForOpposed(sourceToken, targetToken, { sourceBeforeState } = {}) {
  if (!isPanelAutoDefenceEnabled()) return;
  if (!sourceToken?.actor || !targetToken?.actor?.isOwner) return;

  let timeoutId = null;
  const cleanup = (hookId) => {
    Hooks.off("createChatMessage", hookId);
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
  };

  const hookId = Hooks.on("createChatMessage", async (message) => {
    if (message?.type !== "opposed") return;
    if (message.system?.defender?.token !== targetToken.id) return;

    const attackerMessage = game.messages.get(message.system?.attackerMessage);
    const attackerActorUuid = attackerMessage?.system?.test?.actor;
    if (attackerActorUuid && attackerActorUuid !== sourceToken.actor.uuid) return;

    cleanup(hookId);
    const started = Date.now();
    while (Date.now() - started < OPPOSED_LINK_WAIT_MS) {
      if (targetToken.actor.system?.opposed?.id === message.id) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    await towCombatOverlayRollSkill(targetToken.actor, "endurance", { autoRoll: true });

    const automation = getOverlayAutomationRef();
    if (typeof automation.armAutoApplyDamageForOpposed === "function") {
      automation.armAutoApplyDamageForOpposed(message, {
        sourceActor: sourceToken.actor,
        sourceBeforeState
      });
    }
  });

  timeoutId = setTimeout(() => cleanup(hookId), AUTO_DEFENCE_WAIT_MS);
}

async function runPanelUnarmedAttackOnTarget(sourceToken, targetToken, attackItem, { autoRoll = true } = {}) {
  const sourceActor = sourceToken?.actor ?? sourceToken?.document?.actor ?? null;
  if (!sourceActor || !targetToken || !attackItem) return;
  const automation = getOverlayAutomationRef();
  const sourceBeforeState = automation.snapshotActorState(sourceActor);
  const restoreStaggerPrompt = automation.armDefaultStaggerChoiceWound(PANEL_STAGGER_PATCH_DURATION_MS);
  armAutoEnduranceDefenceForOpposed(sourceToken, targetToken, { sourceBeforeState });

  try {
    return await withTemporaryUserTargets(targetToken, () => towCombatOverlaySetupAbilityTestWithDamage(sourceActor, attackItem, {
      autoRoll
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
  const onTargetAttack = (typeof options?.onTargetAttack === "function")
    ? options.onTargetAttack
    : null;
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
    if (onTargetAttack) {
      await onTargetAttack(targetToken, { autoRoll: !useDefaultDialog });
      return;
    }
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
  const rawItemGroup = String(slotElement.dataset.itemGroup ?? "").trim();
  const rawItemId = String(slotElement.dataset.itemId ?? "").trim();
  const orderKey = String(slotElement.dataset.itemOrderKey ?? "").trim();
  const parsedOrderKey = parsePanelButtonKey(orderKey);
  const itemGroup = rawItemGroup || String(parsedOrderKey?.groupKey ?? "").trim();
  const itemId = rawItemId || String(parsedOrderKey?.itemId ?? "").trim();
  if (itemGroup === "temporaryEffects" && itemId) {
    if (event?.button !== 2) return;
    const actor = getSingleControlledActor();
    if (!actor) return;
    if (!towCombatOverlayCanEditActor(actor)) {
      towCombatOverlayWarnNoPermission(actor);
      return;
    }
    const liveEffect = actor.effects?.get?.(itemId) ?? null;
    if (!liveEffect || typeof liveEffect.delete !== "function") return;
    await liveEffect.delete();
    const panelElement = slotElement.closest(`#${PANEL_ID}`);
    if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
    return;
  }

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

  if ((itemGroup === "magic" || itemGroup === "abilities") && itemId) {
    const actor = getSingleControlledActor();
    const sourceItemName = String(slotElement.dataset.itemName ?? "").trim().toLowerCase();
    const item = actor?.items?.get?.(itemId)
      ?? actor?.items?.find?.((entry) => String(entry?.name ?? "").trim().toLowerCase() === sourceItemName)
      ?? null;
    if (item?.sheet?.render) item.sheet.render(true);
    return;
  }

  if (itemGroup !== "attacks" || !itemId) return;

  const sourceToken = getSingleControlledToken();
  const sourceActor = sourceToken?.actor ?? sourceToken?.document?.actor ?? null;
  if (!sourceToken || !sourceActor) return;

  if (itemId === PANEL_UNARMED_ACTION_ID) {
    const altHeld = towCombatOverlayIsAltModifier(event);
    const shiftHeld = towCombatOverlayIsShiftModifier(event);
    const panelElement = slotElement.closest(`#${PANEL_ID}`);
    if (!(panelElement instanceof HTMLElement)) return;

    if (altHeld && shiftHeld) {
      clearPanelAttackPickMode();
      await withTemporaryPanelUnarmedAbility(sourceActor, async (unarmedAbility) => (
        towCombatOverlaySetupAbilityTestWithDamage(sourceActor, unarmedAbility, { autoRoll: false })
      ));
      return;
    }

    if (shiftHeld) {
      clearPanelAttackPickMode();
      await withTemporaryPanelUnarmedAbility(sourceActor, async (unarmedAbility) => (
        towCombatOverlaySetupAbilityTestWithDamage(sourceActor, unarmedAbility, { autoRoll: true })
      ));
      return;
    }

    startPanelAttackPickMode(panelElement, slotElement, sourceToken, { id: PANEL_UNARMED_ACTION_ID }, event, {
      preferDefaultDialog: altHeld,
      onTargetAttack: async (targetToken, { autoRoll }) => {
        await withTemporaryPanelUnarmedAbility(sourceActor, async (unarmedAbility) => (
          runPanelUnarmedAttackOnTarget(sourceToken, targetToken, unarmedAbility, { autoRoll })
        ));
      }
    });
    return;
  }

  const slotItemName = String(slotElement.dataset.itemName ?? "").trim().toLowerCase();
  const attackItem = sourceActor.items?.get?.(itemId)
    ?? sourceActor.items?.find?.((item) => String(item?.name ?? "").trim().toLowerCase() === slotItemName)
    ?? null;
  if (!attackItem) return;
  const altHeld = towCombatOverlayIsAltModifier(event);
  const ctrlHeld = towCombatOverlayIsCtrlModifier(event);
  const shiftHeld = towCombatOverlayIsShiftModifier(event);
  const panelElement = slotElement.closest(`#${PANEL_ID}`);
  if (!(panelElement instanceof HTMLElement)) return;

  const consumeAttackResource = async () => {
    const gate = await ensurePanelAttackResourceStateBeforeUse(sourceActor, attackItem);
    if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
    return gate;
  };
  const attackAmmoState = resolvePanelAttackAmmoState(attackItem);
  if (ctrlHeld && attackAmmoState.isRanged && attackAmmoState.usesReloadFlow) {
    clearPanelAttackPickMode();
    if (typeof attackItem?.update === "function") {
      const reloadTargetRaw = Number(attackItem?.system?.reload?.value);
      const reloadCurrentRaw = Number(attackItem?.system?.reload?.current);
      if (Number.isFinite(reloadTargetRaw) && reloadTargetRaw > 0 && Number.isFinite(reloadCurrentRaw)) {
        await attackItem.update({
          "system.reload.current": Math.max(Math.trunc(reloadTargetRaw), Math.trunc(reloadCurrentRaw))
        });
      }
    }
    await writePanelAttackAmmoState(attackItem, {
      current: attackAmmoState.ammoMax,
      reloadProgress: 0
    });
    if (panelElement instanceof HTMLElement) updateSelectionDisplay(panelElement);
    return;
  }
  if (attackAmmoState.isRanged && attackAmmoState.usesReloadFlow && attackAmmoState.current <= 0) {
    await consumeAttackResource();
    return;
  }


  if (altHeld && shiftHeld) {
    clearPanelAttackPickMode();
    const gate = await consumeAttackResource();
    if (gate?.blocked) return;
    await towCombatOverlaySetupAbilityTestWithDamage(sourceActor, attackItem, { autoRoll: false });
    return;
  }

  if (shiftHeld) {
    clearPanelAttackPickMode();
    const gate = await consumeAttackResource();
    if (gate?.blocked) return;
    await towCombatOverlaySetupAbilityTestWithDamage(sourceActor, attackItem, { autoRoll: true });
    return;
  }

  startPanelAttackPickMode(panelElement, slotElement, sourceToken, attackItem, event, {
    preferDefaultDialog: altHeld,
    onTargetAttack: async (targetToken, { autoRoll }) => {
      const gate = await consumeAttackResource();
      if (gate?.blocked) return;
      await runPanelAttackOnTarget(sourceToken, targetToken, attackItem, { autoRoll });
    }
  });
}

async function runDefaultPanelActorAction(actor, actionKey) {
  const key = String(actionKey ?? "").trim();
  if (!actor || !key) return;

  const runWithActionRollContext = async (callback) => withPatchedActionSkillTestContext(actor, callback);
  const normalizedKey = key.toLowerCase();

  // Old World core can throw on improvise when invoked through doAction().
  // Prefer ActionUse/script path for improvise to avoid invalid ActiveEffect payload.
  if (normalizedKey !== "improvise" && typeof actor?.system?.doAction === "function") {
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

function getCoreActionDescription(actionData) {
  return normalizeDescriptionSource(
    actionData?.description
    ?? actionData?.summary
    ?? actionData?.details
    ?? actionData?.text
    ?? actionData?.hint
    ?? ""
  );
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
            description: "Defend against incoming attacks using your available defence options."
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
          description: getCoreActionDescription(action)
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
    return {
      id: key,
      name,
      img: PANEL_MANOEUVRE_ICON_BY_KEY[key] ?? PANEL_FALLBACK_ITEM_ICON,
      system: {
        description: getCoreActionDescription(entry)
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

  return PANEL_RECOVER_ORDER.map((key) => {
    const subAction = recoverAction?.subActions?.[key] ?? null;
    const description = getCoreActionDescription(subAction ?? recoverAction);
    return {
      id: key,
      name: labels[key] ?? key,
      img: PANEL_RECOVER_ICON_BY_KEY[key] ?? PANEL_FALLBACK_ITEM_ICON,
      system: {
        description
      }
    };
  });
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
  const speedRow = selectionPanelElement.querySelector("[data-selection-stat-row='speed']");
  const resilienceRow = selectionPanelElement.querySelector("[data-selection-stat-row='resilience']");
  const woundsRow = selectionPanelElement.querySelector("[data-selection-stat-row='wounds']");

  if (speedRow instanceof HTMLElement) {
    bindPanelTooltipEvent(speedRow, () => getPanelStatTooltipData("speed"));
    speedRow.addEventListener("click", (event) => event.preventDefault());
    speedRow.addEventListener("contextmenu", (event) => event.preventDefault());
  }

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

function bindSelectionNameTooltipEvent(selectionPanelElement) {
  if (!(selectionPanelElement instanceof HTMLElement)) return;
  const nameElement = selectionPanelElement.querySelector(".tow-combat-overlay-control-panel__selection-name");
  if (!(nameElement instanceof HTMLElement)) return;
  bindPanelTooltipEvent(nameElement, () => {
    const token = getSingleControlledToken();
    if (!token) return null;
    const tokenName = getPrimaryTokenName(token) || "Token";
    const typeLabel = getPrimaryTokenTypeLabel(token) || "-";
    return {
      title: tokenName,
      description: `Type: ${typeLabel}`
    };
  });
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
  if (key === "grim") return "Grim";
  if (key === "glorious") return "Glorious";
  return "Common";
}

function updateActionControlsDisplay(panelElement, token = null) {
  const actor = token?.actor ?? token?.document?.actor ?? null;
  const typeLabels = Array.from(panelElement.querySelectorAll("[data-action-label='tokenType']"));
  const diceLabels = Array.from(panelElement.querySelectorAll("[data-action-label='diceModifier']"));
  const rollStateLabels = Array.from(panelElement.querySelectorAll("[data-action-label='rollState']"));
  for (const typeLabel of typeLabels) {
    if (!(typeLabel instanceof HTMLElement)) continue;
    typeLabel.textContent = token ? getPrimaryTokenTypeLabel(token) : "-";
  }
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
  const actor = token?.document?.actor ?? token?.actor ?? null;
  const actorName = String(actor?.name ?? "").trim();
  const nameplateName = String(token?.nameplate?.text ?? "").trim();
  const documentName = String(token?.document?.name ?? "").trim();
  const fallbackName = String(token?.name ?? actorName ?? "").trim();
  return actorName || nameplateName || documentName || fallbackName || "Selected token";
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

function escapePanelHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeDescriptionTextSource(descriptionSource) {
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

  let text = String(temp.textContent ?? temp.innerText ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  for (let index = 0; index < refLabels.length; index += 1) {
    const token = `__TOW_REF_${index}__`;
    text = text.split(token).join(refLabels[index]);
  }
  return text;
}

function normalizeDescriptionSource(descriptionSource) {
  const normalizedText = normalizeDescriptionTextSource(descriptionSource);
  if (!normalizedText) return "";
  return escapePanelHtml(normalizedText).replace(/\n/g, "<br>");
}

function resolvePanelAttackSpecialPropertyText(item) {
  if (!item) return "";

  const isMeaningfulPropertyLine = (line) => {
    const value = String(line ?? "").trim();
    if (!value) return false;
    if (/^[-–—]$/.test(value)) return false;
    if (/^(1h|2h|one[- ]handed|two[- ]handed)$/i.test(value)) return false;
    if (/^melee$/i.test(value)) return false;
    if (/^(close|short|medium|long|extreme)(\s*-\s*(close|short|medium|long|extreme))*$/i.test(value)) return false;
    if (/^(range|optimum range)\s*:/i.test(value)) return false;
    return true;
  };

  const candidateSources = [
    item?.system?.attack?.traits,
    item?.system?.traits,
    item?.system?.trait,
    item?.system?.qualities,
    item?.system?.quality,
    item?.system?.properties,
    item?.system?.special,
    item?.system?.specialRules,
    item?.system?.rules
  ];

  const lines = [];
  const appendLines = (value) => {
    const normalized = normalizeDescriptionTextSource(value);
    if (!normalized) return;
    for (const line of normalized.split("\n").map((entry) => entry.trim()).filter((entry) => isMeaningfulPropertyLine(entry))) {
      lines.push(line);
    }
  };

  for (const source of candidateSources) {
    if (Array.isArray(source)) {
      for (const entry of source) appendLines(entry);
      continue;
    }
    if (source && typeof source === "object") {
      appendLines(source?.value);
      appendLines(source?.text);
      appendLines(source?.public);
      appendLines(source?.description);
      appendLines(source?.label);
      appendLines(source?.name);
      continue;
    }
    appendLines(source);
  }

  if (!lines.length) {
    const descriptionSource = item?.system?.description ?? item?.system?.summary ?? item?.description ?? "";
    const firstDescriptionLine = normalizeDescriptionTextSource(descriptionSource).split("\n").map((line) => line.trim()).find(Boolean) ?? "";
    const looksLikeExplicitProperty = /\b(on charge|ignore|ignores|success(?:es)?\s+to\s+reload|pierc|brutal|impale|bleed|stagger|prone|\+\d+\s*(?:damage|d\d+))\b/i.test(firstDescriptionLine);
    if (isMeaningfulPropertyLine(firstDescriptionLine) && looksLikeExplicitProperty) lines.push(firstDescriptionLine);
  }

  const deduped = [];
  const seen = new Set();
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(line);
  }
  return deduped.join("\n");
}

function resolvePanelAttackSpecialPropertyMarkup(item) {
  const text = resolvePanelAttackSpecialPropertyText(item);
  if (!text) return "";
  return escapePanelHtml(text).replace(/\n/g, "<br>");
}

function getPanelItemGroupsForActor(actor) {
  const toList = (value) => (Array.isArray(value) ? value : []);
  const abilityItems = toList(actor?.itemTypes?.ability).filter((item) => !isPanelGeneratedUnarmedItem(item));
  const talentItems = toList(actor?.itemTypes?.talent);
  const spellItems = toList(actor?.itemTypes?.spell);
  const blessingItems = toList(actor?.itemTypes?.blessing);
  const weaponItems = toList(actor?.itemTypes?.weapon);
  const actions = getPanelActionEntries();
  const manoeuvre = getPanelManoeuvreSubActionEntries();
  const recover = getPanelRecoverActionEntries();
  const conditionKeys = new Set(
    Object.keys(game?.oldworld?.config?.conditions ?? {}).map((key) => String(key ?? "").toLowerCase())
  );
  const temporaryEffects = toList(actor?.effects?.contents)
    .filter((effect) => {
      if (!effect) return false;
      if (effect.disabled || effect.isSuppressed) return false;
      if (effect.transfer) return false;
      const statuses = Array.from(effect.statuses ?? []).map((status) => String(status ?? "").toLowerCase());
      if (statuses.some((status) => conditionKeys.has(status))) return false;
      return true;
    })
    .sort((a, b) => Number(a?.sort ?? 0) - Number(b?.sort ?? 0))
    .map((effect) => ({
      id: String(effect?.id ?? ""),
      name: String(effect?.name ?? "Effect"),
      img: String(effect?.img ?? effect?.icon ?? PANEL_FALLBACK_ITEM_ICON),
      system: {
        description: String(effect?.description ?? "")
      }
    }));

  // Match Old World sheet logic:
  // - attacks: ability items where system.isAttack is true
  // - abilities: non-attack ability items + talents
  // - manoeuvre: fixed manoeuvre actions from core action config
  // - magic: spell items; blessings are religion in core, mapped here into magic group
  const attacks = abilityItems
    .filter((item) => item?.system?.isAttack === true)
    .concat(weaponItems.filter((item) => item?.system?.isEquipped || item?.system?.equipped?.value));
  attacks.unshift({
    id: PANEL_UNARMED_ACTION_ID,
    name: "Unarmed",
    img: PANEL_ACTION_ICON_BY_KEY.unarmed ?? PANEL_FALLBACK_ITEM_ICON,
    system: {
      description: "Opposed attack using Brawn vs Endurance."
    }
  });
  const abilities = abilityItems
    .filter((item) => item?.system?.isAttack !== true)
    .concat(talentItems);
  const magic = spellItems.concat(blessingItems);

  return { actions, attacks, abilities, temporaryEffects, manoeuvre, recover, magic };
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
    `.tow-combat-overlay-control-panel__group-grid[data-item-group="${groupKey}"]`
  ) ?? panelElement.querySelector(
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
  const groupElement = gridElement.closest(".tow-combat-overlay-control-panel__item-group");
  const isStatusStripAbilities = gridElement.classList.contains("tow-combat-overlay-control-panel__status-abilities")
    || (groupElement instanceof HTMLElement
      && groupElement.classList.contains("tow-combat-overlay-control-panel__status-abilities"));

  if (isStatusStripAbilities) {
    const count = Math.max(1, Math.trunc(Number(slotCount) || 1));
    gridElement.style.gridTemplateColumns = `repeat(${count}, var(--tow-control-panel-slot-size))`;
    gridElement.style.gridTemplateRows = "repeat(1, var(--tow-control-panel-slot-size))";
    gridElement.style.gridAutoFlow = "column";
    return;
  }

  // Main action panel keeps a stable minimum footprint: 2 rows x 7 columns.
  if (groupKey === "all") {
    const { columns, rows } = resolveDynamicGridLayout(slotCount);
    const minColumns = Math.max(1, PANEL_MAIN_GRID_MIN_COLUMNS);
    const minRows = Math.max(1, PANEL_MAIN_GRID_MIN_ROWS);
    gridElement.style.gridTemplateColumns = `repeat(${Math.max(columns, minColumns)}, var(--tow-control-panel-slot-size))`;
    gridElement.style.gridTemplateRows = `repeat(${Math.max(rows, minRows)}, var(--tow-control-panel-slot-size))`;
    gridElement.style.gridAutoFlow = "column";
    return;
  }

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
  gridElement.style.gridAutoFlow = "column";
}

function resolvePanelAttackAmmoMeta(item) {
  if (!item) return { isRanged: false, ammoMax: 1, reloadTarget: 0, usesReloadFlow: false };
  const attackSkill = String(item?.system?.attack?.skill ?? "").trim().toLowerCase();
  const weaponSkill = String(item?.system?.skill ?? "").trim().toLowerCase();
  const isRanged = item?.system?.isRanged === true
    || ["shooting", "throwing"].includes(attackSkill)
    || ["shooting", "throwing"].includes(weaponSkill);
  if (!isRanged) return { isRanged: false, ammoMax: 1, reloadTarget: 0, usesReloadFlow: false };

  const ammoCandidates = [
    Number(item?.system?.ammo?.current),
    Number(item?.system?.ammo?.value),
    Number(item?.system?.ammunition?.current),
    Number(item?.system?.ammunition?.value),
    Number(item?.system?.shots?.current),
    Number(item?.system?.shots?.value),
    Number(item?.system?.capacity),
    Number(item?.system?.clip)
  ].filter((value) => Number.isFinite(value) && value > 0);
  const ammoMax = Math.max(1, Math.trunc(ammoCandidates[0] ?? 1));
  const reloadTargetRaw = Number(item?.system?.reload?.value);
  const reloadTarget = Number.isFinite(reloadTargetRaw) ? Math.max(0, Math.trunc(reloadTargetRaw)) : 0;
  return {
    isRanged: true,
    ammoMax,
    reloadTarget,
    usesReloadFlow: reloadTarget > 0
  };
}

function resolvePanelAttackAmmoState(item) {
  const meta = resolvePanelAttackAmmoMeta(item);
  if (!meta.isRanged) return { ...meta, current: 0, reloadProgress: 0 };

  const flags = item?.flags?.[MODULE_ID]?.panelAttackAmmo ?? {};
  const rawCurrent = Number(flags?.current);
  const rawReloadProgress = Number(flags?.reloadProgress);
  const current = Number.isFinite(rawCurrent)
    ? Math.max(0, Math.min(meta.ammoMax, Math.trunc(rawCurrent)))
    : meta.ammoMax;
  const reloadProgress = Number.isFinite(rawReloadProgress)
    ? Math.max(0, Math.min(meta.reloadTarget, Math.trunc(rawReloadProgress)))
    : 0;
  return { ...meta, current, reloadProgress };
}

async function writePanelAttackAmmoState(item, { current, reloadProgress } = {}) {
  if (!item || typeof item.update !== "function") return;
  const updates = {};
  if (Number.isFinite(Number(current))) {
    updates[`flags.${MODULE_ID}.panelAttackAmmo.current`] = Math.max(0, Math.trunc(Number(current)));
  }
  if (Number.isFinite(Number(reloadProgress))) {
    updates[`flags.${MODULE_ID}.panelAttackAmmo.reloadProgress`] = Math.max(0, Math.trunc(Number(reloadProgress)));
  }
  if (!Object.keys(updates).length) return;
  await item.update(updates);
}

function armAutoSubmitReloadTestDialog(actor) {
  towCombatOverlayArmAutoSubmitDialog({
    hookName: "renderTestDialog",
    matches: (app) => app?.actor?.id === actor?.id && String(app?.skill ?? "").trim().toLowerCase() === "dexterity",
    submitErrorMessage: "Reload test submit() is unavailable."
  });
}

async function rollPanelReloadForAttack(actor, attackItem) {
  if (!actor || !attackItem) return 0;
  armApplyRollModifiersToNextTestDialog(actor, {
    matches: (app) => app?.actor?.id === actor?.id && String(app?.skill ?? "").trim().toLowerCase() === "dexterity"
  });
  armAutoSubmitReloadTestDialog(actor);

  let test = null;
  if (typeof attackItem?.system?.rollReloadTest === "function") {
    test = await withPatchedActionSkillTestContext(actor, () => attackItem.system.rollReloadTest(actor));
  } else {
    test = await getTowCombatOverlaySystemAdapter().setupSkillTest(
      actor,
      "dexterity",
      createTowCombatOverlayRollContext(actor, { appendTitle: ` - Reloading ${String(attackItem?.name ?? "Weapon")}` })
    );
  }

  const rawSuccesses = Number(test?.result?.successes ?? 0);
  return Number.isFinite(rawSuccesses) ? Math.max(0, Math.trunc(rawSuccesses)) : 0;
}

async function ensurePanelAttackResourceStateBeforeUse(actor, attackItem) {
  const state = resolvePanelAttackAmmoState(attackItem);
  if (!state.isRanged || !state.usesReloadFlow) return { blocked: false, state };

  if (state.current > 0) {
    await writePanelAttackAmmoState(attackItem, { current: state.current - 1 });
    return { blocked: false, state: { ...state, current: state.current - 1 } };
  }

  const gainedSuccesses = await rollPanelReloadForAttack(actor, attackItem);
  const newProgress = Math.max(0, Math.min(state.reloadTarget, state.reloadProgress + gainedSuccesses));
  const completedReload = newProgress >= state.reloadTarget;
  if (completedReload) {
    await writePanelAttackAmmoState(attackItem, {
      current: state.ammoMax,
      reloadProgress: 0
    });
    return {
      blocked: true,
      reloaded: true,
      state: { ...state, current: state.ammoMax, reloadProgress: 0 }
    };
  }

  await writePanelAttackAmmoState(attackItem, {
    current: 0,
    reloadProgress: newProgress
  });
  return {
    blocked: true,
    reloaded: false,
    state: { ...state, current: 0, reloadProgress: newProgress }
  };
}

function updatePanelSlotAmmoBadge(slotElement, item, groupKey) {
  if (!(slotElement instanceof HTMLElement)) return;
  let ammoBadge = slotElement.querySelector(".tow-combat-overlay-control-panel__slot-ammo");
  if (!(ammoBadge instanceof HTMLElement)) {
    ammoBadge = document.createElement("span");
    ammoBadge.classList.add("tow-combat-overlay-control-panel__slot-ammo");
    ammoBadge.setAttribute("aria-hidden", "true");
    slotElement.appendChild(ammoBadge);
  }

  if (groupKey !== "attacks" || !item || item.__empty === true) {
    ammoBadge.style.display = "none";
    ammoBadge.textContent = "";
    return;
  }

  const state = resolvePanelAttackAmmoState(item);
  if (!state.isRanged) {
    ammoBadge.style.display = "none";
    ammoBadge.textContent = "";
    return;
  }

  if (state.usesReloadFlow && state.current <= 0) {
    ammoBadge.textContent = `${Math.max(0, state.reloadProgress)}/${Math.max(1, state.reloadTarget)}`;
  } else {
    ammoBadge.textContent = String(Math.max(1, Math.trunc(state.current || state.ammoMax || 1)));
  }
  ammoBadge.style.display = "inline-flex";
}

function updatePanelSlotPropertyBadge(slotElement, item, groupKey) {
  if (!(slotElement instanceof HTMLElement)) return;
  let propertyBadge = slotElement.querySelector(".tow-combat-overlay-control-panel__slot-property");
  if (!(propertyBadge instanceof HTMLElement)) {
    propertyBadge = document.createElement("span");
    propertyBadge.classList.add("tow-combat-overlay-control-panel__slot-property");
    propertyBadge.setAttribute("aria-hidden", "true");
    propertyBadge.textContent = "•";
    slotElement.appendChild(propertyBadge);
  }

  const hasSpecialProperty = (
    groupKey === "attacks"
    && !!item
    && item.__empty !== true
    && !!resolvePanelAttackSpecialPropertyText(item)
  );
  propertyBadge.style.display = hasSpecialProperty ? "inline-flex" : "none";
}

function resolvePanelAttackPropertyRarity(item) {
  const raw = resolvePanelAttackSpecialPropertyText(item);
  const count = raw
    ? raw.split("\n").map((line) => line.trim()).filter(Boolean).length
    : 0;
  if (count <= 0) return "common";
  if (count === 1) return "uncommon";
  if (count === 2) return "rare";
  if (count === 3) return "epic";
  return "legendary";
}

function updatePanelSlotAttackRarity(slotElement, item, groupKey) {
  if (!(slotElement instanceof HTMLElement)) return;
  if (groupKey !== "attacks" || !item || item.__empty === true) {
    delete slotElement.dataset.attackRarity;
    const existingBadge = slotElement.querySelector(".tow-combat-overlay-control-panel__slot-property");
    if (existingBadge instanceof HTMLElement) existingBadge.style.display = "none";
    return;
  }
  slotElement.dataset.attackRarity = resolvePanelAttackPropertyRarity(item);
  const existingBadge = slotElement.querySelector(".tow-combat-overlay-control-panel__slot-property");
  if (existingBadge instanceof HTMLElement) existingBadge.style.display = "none";
}

function resolvePanelAttackDamageLabel(item) {
  if (!item) return "";
  const damageValueRaw = Number(item?.system?.damage?.value);
  if (Number.isFinite(damageValueRaw)) {
    return String(Math.trunc(damageValueRaw));
  }

  const formulaRaw = String(item?.system?.damage?.formula ?? "").trim();
  if (!formulaRaw) return "";
  const compact = formulaRaw.replace(/\s+/g, "");
  if (compact.length <= 6) return compact;
  return `${compact.slice(0, 6)}…`;
}

function updatePanelSlotDamageBadge(slotElement, item, groupKey) {
  if (!(slotElement instanceof HTMLElement)) return;
  let damageBadge = slotElement.querySelector(".tow-combat-overlay-control-panel__slot-damage");
  if (!(damageBadge instanceof HTMLElement)) {
    damageBadge = document.createElement("span");
    damageBadge.classList.add("tow-combat-overlay-control-panel__slot-damage");
    damageBadge.setAttribute("aria-hidden", "true");
    slotElement.appendChild(damageBadge);
  }

  if (groupKey !== "attacks" || !item || item.__empty === true) {
    damageBadge.style.display = "none";
    damageBadge.textContent = "";
    return;
  }

  const label = resolvePanelAttackDamageLabel(item);
  if (!label) {
    damageBadge.style.display = "none";
    damageBadge.textContent = "";
    return;
  }

  damageBadge.textContent = label;
  damageBadge.style.display = "inline-flex";
}

function updateGroupSlots(panelElement, groupKey, groupItems = []) {
  const groupElement = panelElement.querySelector(
    `.tow-combat-overlay-control-panel__item-group[data-item-group="${groupKey}"]`
  ) ?? getGroupGridElement(panelElement, groupKey);
  if (groupElement instanceof HTMLElement) {
    groupElement.style.display = (groupItems.length > 0) ? "" : "none";
  }

  if (groupItems.length <= 0) {
    ensureGroupSlotElements(panelElement, groupKey, 0);
    return;
  }

  applyGroupGridLayout(panelElement, groupKey, groupItems.length);
  let renderSlotCount = groupItems.length;
  if (groupKey === "all" && groupItems.length > 0) {
    const { columns, rows } = resolveDynamicGridLayout(groupItems.length);
    renderSlotCount = Math.max(
      groupItems.length,
      columns * rows,
      Math.max(1, PANEL_MAIN_GRID_MIN_COLUMNS) * Math.max(1, PANEL_MAIN_GRID_MIN_ROWS)
    );
  }
  const slotElements = ensureGroupSlotElements(panelElement, groupKey, renderSlotCount);
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

    if (!item || item.__empty === true) {
      const emptyGroupKey = String(item?.panelGroup ?? groupKey ?? "").trim() || groupKey;
      const emptyOrderKey = String(item?.panelButtonKey ?? "").trim() || toPanelButtonKey(emptyGroupKey, `empty-slot-${index}`);
      slotElement.dataset.itemType = "empty";
      slotElement.dataset.itemGroup = emptyGroupKey;
      slotElement.dataset.itemId = "";
      slotElement.dataset.itemOrderKey = emptyOrderKey;
      slotElement.dataset.tooltipTitle = "";
      slotElement.dataset.tooltipDescription = "";
      slotElement.setAttribute("aria-label", `Slot ${index + 1}`);
      image.src = "";
      image.alt = "";
      image.style.display = "none";
      if (iconPlaceholder instanceof HTMLElement) iconPlaceholder.style.display = "";
      updatePanelSlotAmmoBadge(slotElement, null, emptyGroupKey);
      updatePanelSlotAttackRarity(slotElement, null, emptyGroupKey);
      updatePanelSlotDamageBadge(slotElement, null, emptyGroupKey);
      continue;
    }

    const resolvedGroupKey = String(item?.panelGroup ?? groupKey ?? "").trim() || groupKey;
    const itemName = String(item?.name ?? `Item ${index + 1}`).trim();
    const itemDescription = normalizeItemDescription(item);
    const itemImage = String(item?.img ?? "").trim() || PANEL_FALLBACK_ITEM_ICON;
    slotElement.dataset.itemType = "item";
    slotElement.dataset.itemGroup = resolvedGroupKey;
    slotElement.dataset.itemId = String(item?.id ?? "");
    slotElement.dataset.itemName = itemName;
    slotElement.dataset.itemOrderKey = String(item?.panelButtonKey ?? toPanelButtonKey(resolvedGroupKey, item?.id));
    slotElement.dataset.tooltipTitle = itemName;
    const itemKey = String(item?.id ?? "").trim().toLowerCase();
    if (resolvedGroupKey === "attacks") {
      const attackHint = itemKey === PANEL_UNARMED_ACTION_ID
        ? "<em>Click: pick target then auto-roll unarmed attack (Brawn vs Endurance). Shift+click: self auto-roll. Alt+click: pick target then open default attack dialog. Alt+Shift+click: open default self-roll dialog.</em>"
        : "<em>Click: pick target, then auto-roll attack. Shift+click: auto-roll self attack. Alt+click: pick target, then open default Foundry attack dialog (no auto-roll). Alt+Shift+click: open default Foundry self-roll dialog (no auto-roll). Ctrl+click: instantly reload this weapon (ranged weapons with reload flow only).</em>";
      const attackAmmoState = resolvePanelAttackAmmoState(item);
      const reloadProgressHint = (attackAmmoState.isRanged && attackAmmoState.usesReloadFlow && attackAmmoState.current <= 0)
        ? `<br><br>Reload progress: ${Math.max(0, attackAmmoState.reloadProgress)} / ${Math.max(1, attackAmmoState.reloadTarget)} successes.`
        : "";
      const attackDamageLabel = resolvePanelAttackDamageLabel(item);
      const damageHint = attackDamageLabel
        ? `<br><br><strong>Damage:</strong> ${escapePanelHtml(attackDamageLabel)}`
        : "";
      const specialPropertyMarkup = resolvePanelAttackSpecialPropertyMarkup(item);
      const specialPropertyHint = specialPropertyMarkup
        ? `<br><br><strong>Extra properties:</strong><br>${specialPropertyMarkup}`
        : "";
      const hasDistinctDescription = !!itemDescription && (
        !specialPropertyMarkup
        || !itemDescription.includes(specialPropertyMarkup)
      );
      slotElement.dataset.tooltipDescription = hasDistinctDescription
        ? `${attackHint}${damageHint}${reloadProgressHint}${specialPropertyHint}<br><br>${itemDescription}`
        : `${attackHint}${damageHint}${reloadProgressHint}${specialPropertyHint}`;
    } else if (resolvedGroupKey === "actions") {
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
    } else if (resolvedGroupKey === "recover") {
      const recoverHint = "<em>Click: run selected Recover action with auto flow. Alt+click: open default Recover chooser dialog.</em>";
      slotElement.dataset.tooltipDescription = itemDescription
        ? `${recoverHint}<br><br>${itemDescription}`
        : recoverHint;
    } else if (resolvedGroupKey === "manoeuvre") {
      const manoeuvreHint = "<em>Click: auto-roll manoeuvre checks (no dialogs). Alt+click: default Foundry manoeuvre flow (with dialogs).</em>";
      slotElement.dataset.tooltipDescription = itemDescription
        ? `${manoeuvreHint}<br><br>${itemDescription}`
        : manoeuvreHint;
    } else if (resolvedGroupKey === "temporaryEffects") {
      const infoHint = "<em>Right click: remove temporary effect.</em>";
      slotElement.dataset.tooltipDescription = itemDescription
        ? `${infoHint}<br><br>${itemDescription}`
        : infoHint;
    } else if (resolvedGroupKey === "abilities" || resolvedGroupKey === "magic") {
      slotElement.dataset.tooltipDescription = itemDescription;
    } else {
      slotElement.dataset.tooltipDescription = itemDescription;
    }
    slotElement.setAttribute("aria-label", itemName);
    image.src = itemImage;
    image.alt = itemName;
    image.style.display = "block";
    if (iconPlaceholder instanceof HTMLElement) iconPlaceholder.style.display = "none";
    updatePanelSlotAmmoBadge(slotElement, item, resolvedGroupKey);
    updatePanelSlotAttackRarity(slotElement, item, resolvedGroupKey);
    updatePanelSlotDamageBadge(slotElement, item, resolvedGroupKey);
  }
}
function updatePanelSlots(panelElement, token = null) {
  const actor = token?.actor ?? token?.document?.actor ?? null;
  const groups = actor
    ? getPanelItemGroupsForActor(actor)
    : { actions: [], attacks: [], abilities: [], temporaryEffects: [], manoeuvre: [], recover: [], magic: [] };
  const buttonOrderScope = resolvePanelButtonOrderScope(token);
  const controlPanelState = getControlPanelState();
  if (controlPanelState) controlPanelState.buttonOrderScope = buttonOrderScope;
  const reorderUnlocked = readSavedPanelReorderUnlocked(buttonOrderScope);
  if (controlPanelState) controlPanelState.buttonReorderUnlocked = reorderUnlocked;
  syncPanelReorderToggleButton(panelElement);

  const groupKeys = ["manoeuvre", "recover", "actions", "attacks", "magic"];
  const groupedItems = Object.fromEntries(groupKeys.map((key) => {
    const items = Array.isArray(groups[key]) ? groups[key] : [];
    const normalizedItems = items
      .filter(Boolean)
      .map((item, index) => {
        const stableId = String(item?.id ?? item?.key ?? item?.name ?? `${key}-${index}`).trim();
        const panelButtonKey = toPanelButtonKey(key, stableId);
        return {
          ...item,
          panelGroup: key,
          panelButtonKey
        };
      });
    return [key, normalizedItems];
  }));

  const keyToItem = new Map();
  for (const groupKey of groupKeys) {
    const items = groupedItems[groupKey] ?? [];
    for (const item of items) {
      const buttonKey = String(item?.panelButtonKey ?? "").trim();
      if (!buttonKey) continue;
      keyToItem.set(buttonKey, item);
    }
  }

  const defaultLayoutKeys = getDefaultPanelButtonKeyOrder()
    .map((key) => String(key ?? "").trim())
    .filter((key) => !!parsePanelButtonKey(key))
    .filter((key) => !isSyntheticEmptySlotKey(key));
  const defaultLayoutKeySet = new Set(defaultLayoutKeys);

  const savedLayoutKeysRaw = (readSavedPanelButtonKeyOrder(buttonOrderScope) ?? [])
    .map((key) => String(key ?? "").trim())
    .filter((key) => !!parsePanelButtonKey(key));
  const savedLayoutKeys = [];
  for (const key of savedLayoutKeysRaw) {
    if (isSyntheticEmptySlotKey(key)) {
      savedLayoutKeys.push(key);
      continue;
    }
    if (defaultLayoutKeySet.has(key) || keyToItem.has(key)) savedLayoutKeys.push(key);
  }

  const layoutKeys = Array.from(new Set([
    ...savedLayoutKeys,
    ...defaultLayoutKeys
  ]));

  const flattenedItems = [];
  const consumedKeys = new Set();
  for (const buttonKey of layoutKeys) {
    const key = String(buttonKey ?? "").trim();
    if (!key || consumedKeys.has(key)) continue;
    const item = keyToItem.get(key) ?? null;
    if (item) {
      flattenedItems.push(item);
    } else if (defaultLayoutKeySet.has(key) || isSyntheticEmptySlotKey(key)) {
      const parsed = parsePanelButtonKey(key);
      flattenedItems.push({
        __empty: true,
        panelButtonKey: key,
        panelGroup: String(parsed?.groupKey ?? "all")
      });
    }
    consumedKeys.add(key);
  }

  // Preserve behavior for dynamic/runtime buttons not part of saved/default layout yet.
  const fallbackGroupOrder = ["manoeuvre", "recover", "actions", "attacks", "magic"];
  for (const key of fallbackGroupOrder) {
    const items = Array.isArray(groupedItems[key]) ? groupedItems[key] : [];
    for (const item of items) {
      const itemKey = String(item?.panelButtonKey ?? "").trim();
      if (itemKey && consumedKeys.has(itemKey)) continue;
      flattenedItems.push(item);
      if (itemKey) consumedKeys.add(itemKey);
    }
  }

  updateGroupSlots(panelElement, "all", flattenedItems);
  updateGroupSlots(panelElement, "abilities", groups.abilities);
  updateGroupSlots(panelElement, "temporaryEffects", groups.temporaryEffects);
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

function syncItemGroupsMinWidth(panelElement) {
  if (!(panelElement instanceof HTMLElement)) return;
  const statusesElement = panelElement.querySelector(".tow-combat-overlay-control-panel__statuses");
  const statusesTopElement = panelElement.querySelector(".tow-combat-overlay-control-panel__statuses-top");
  const statusesBottomElement = panelElement.querySelector(".tow-combat-overlay-control-panel__statuses-bottom");
  const itemGroupsElement = panelElement.querySelector(".tow-combat-overlay-control-panel__item-groups");
  if (!(itemGroupsElement instanceof HTMLElement)) return;

  const widths = [
    statusesElement instanceof HTMLElement ? statusesElement.scrollWidth : 0,
    statusesTopElement instanceof HTMLElement ? statusesTopElement.scrollWidth : 0,
    statusesBottomElement instanceof HTMLElement ? statusesBottomElement.scrollWidth : 0
  ].map((value) => Number(value) || 0);
  const targetWidth = Math.max(0, Math.max(...widths) - 12);
  if (targetWidth > 0) itemGroupsElement.style.minWidth = `${Math.ceil(targetWidth)}px`;
  else itemGroupsElement.style.removeProperty("min-width");
}

function updateSelectionDisplay(panelElement) {
  const controlPanelState = getControlPanelState();
  const selectionPanelElement = controlPanelState?.selectionElement;
  const selectionElement = selectionPanelElement?.querySelector?.(".tow-combat-overlay-control-panel__selection");
  if (!(selectionElement instanceof HTMLElement)) return;
  const imageElement = selectionElement.querySelector(".tow-combat-overlay-control-panel__selection-image");
  const selectionNameMainElement = selectionPanelElement?.querySelector?.(".tow-combat-overlay-control-panel__selection-name-main");
  const selectionSpeedElement = selectionPanelElement?.querySelector?.("[data-selection-stat='speed']");
  const selectionResilienceElement = selectionPanelElement?.querySelector?.("[data-selection-stat='resilience']");
  const selectionWoundsElement = selectionPanelElement?.querySelector?.("[data-selection-stat='wounds']");
  const placeholderElement = selectionElement.querySelector(".tow-combat-overlay-control-panel__selection-placeholder");
  const multiCountElement = selectionElement.querySelector(".tow-combat-overlay-control-panel__selection-multi-count");
  if (!(imageElement instanceof HTMLImageElement)) return;
  if (!(selectionNameMainElement instanceof HTMLElement)) return;
  if (!(placeholderElement instanceof HTMLElement)) return;
  if (!(multiCountElement instanceof HTMLElement)) return;
  if (!(selectionSpeedElement instanceof HTMLElement)) return;
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
  const speed = getSpeedLabel(token);
  const actor = token?.actor ?? token?.document?.actor ?? null;
  const isDead = !!actor?.hasCondition?.("dead");
  selectionElement.dataset.selection = "single";
  selectionElement.classList.toggle("is-dead", isDead);
  imageElement.src = iconSrc;
  imageElement.alt = tokenName;
  selectionNameMainElement.textContent = tokenName || "-";
  selectionSpeedElement.textContent = speed;
  selectionResilienceElement.textContent = formatStatNumber(resilience);
  selectionWoundsElement.textContent = formatWoundsWithMax(token, wounds);
  placeholderElement.textContent = iconSrc ? "-" : "?";
  multiCountElement.textContent = "x1";
  updatePanelSlots(panelElement, token);
  updateStatusDisplay(panelElement, token);
  syncItemGroupsMinWidth(panelElement);
  updateActionControlsDisplay(panelElement, token);
  updateActionControlsDisplay(selectionPanelElement, token);
  const rect = panelElement.getBoundingClientRect();
  applyPanelPosition(panelElement, rect.left, rect.top);
  syncSelectionPanelPosition(controlPanelState);
}

function bindPanelSelectionSync(controlPanelState, panelElement) {
  const onControlToken = () => updateSelectionDisplay(panelElement);
  const onCanvasReady = () => updateSelectionDisplay(panelElement);
  const onRefreshToken = () => updateSelectionDisplay(panelElement);
  const onUpdateToken = () => updateSelectionDisplay(panelElement);
  const onUpdateActor = () => updateSelectionDisplay(panelElement);
  const onCreateItem = () => updateSelectionDisplay(panelElement);
  const onUpdateItem = () => updateSelectionDisplay(panelElement);
  const onDeleteItem = () => updateSelectionDisplay(panelElement);
  const onCreateActiveEffect = () => updateSelectionDisplay(panelElement);
  const onUpdateActiveEffect = () => updateSelectionDisplay(panelElement);
  const onDeleteActiveEffect = () => updateSelectionDisplay(panelElement);
  const controlTokenHookId = Hooks.on("controlToken", onControlToken);
  const canvasReadyHookId = Hooks.on("canvasReady", onCanvasReady);
  const refreshTokenHookId = Hooks.on("refreshToken", onRefreshToken);
  const updateTokenHookId = Hooks.on("updateToken", onUpdateToken);
  const updateActorHookId = Hooks.on("updateActor", onUpdateActor);
  const createItemHookId = Hooks.on("createItem", onCreateItem);
  const updateItemHookId = Hooks.on("updateItem", onUpdateItem);
  const deleteItemHookId = Hooks.on("deleteItem", onDeleteItem);
  const createActiveEffectHookId = Hooks.on("createActiveEffect", onCreateActiveEffect);
  const updateActiveEffectHookId = Hooks.on("updateActiveEffect", onUpdateActiveEffect);
  const deleteActiveEffectHookId = Hooks.on("deleteActiveEffect", onDeleteActiveEffect);

  controlPanelState.controlTokenHookId = controlTokenHookId;
  controlPanelState.canvasReadyHookId = canvasReadyHookId;
  controlPanelState.refreshTokenHookId = refreshTokenHookId;
  controlPanelState.updateTokenHookId = updateTokenHookId;
  controlPanelState.updateActorHookId = updateActorHookId;
  controlPanelState.createItemHookId = createItemHookId;
  controlPanelState.updateItemHookId = updateItemHookId;
  controlPanelState.deleteItemHookId = deleteItemHookId;
  controlPanelState.createActiveEffectHookId = createActiveEffectHookId;
  controlPanelState.updateActiveEffectHookId = updateActiveEffectHookId;
  controlPanelState.deleteActiveEffectHookId = deleteActiveEffectHookId;
  controlPanelState.onControlToken = onControlToken;
  controlPanelState.onCanvasReady = onCanvasReady;
  controlPanelState.onRefreshToken = onRefreshToken;
  controlPanelState.onUpdateToken = onUpdateToken;
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

function bindControlPanelDrag(controlPanelState, panelElement, { onMoved = null, dragSources = [] } = {}) {
  let dragData = null;

  const onPointerMove = (event) => {
    if (!dragData) return;
    const deltaX = Number(event.clientX) - dragData.startClientX;
    const deltaY = Number(event.clientY) - dragData.startClientY;
    applyPanelPositionWithSelectionClamp(controlPanelState, panelElement, dragData.startLeft + deltaX, dragData.startTop + deltaY);
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
    applyPanelPositionWithSelectionClamp(controlPanelState, panelElement, rect.left, rect.top);
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

function removeStaleControlPanels() {
  for (const panel of Array.from(document.querySelectorAll(`#${PANEL_ID}, #${PANEL_SELECTION_ID}`))) {
    if (panel instanceof HTMLElement) panel.remove();
  }
}

export async function towCombatOverlayEnsureControlPanel() {
  const controlPanelState = getControlPanelState();
  if (!controlPanelState) return;
  if (typeof controlPanelState.buttonReorderUnlocked !== "boolean") {
    controlPanelState.buttonReorderUnlocked = readSavedPanelReorderUnlocked();
  }

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
  bindPanelReorderToggle(panelElement);
  bindPanelReorderReset(panelElement);
  bindPanelActionControls(selectionPanelElement);
  bindSelectionPanelStatEvents(selectionPanelElement);
  bindSelectionNameTooltipEvent(selectionPanelElement);
  bindPanelStatusesTooltipEvents(panelElement);
  controlPanelState.element = panelElement;
  controlPanelState.selectionElement = selectionPanelElement;
  bindControlPanelDrag(controlPanelState, panelElement, {
    dragSources: [selectionPanelElement],
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
  const refreshTokenHookId = controlPanelState?.refreshTokenHookId;
  const updateTokenHookId = controlPanelState?.updateTokenHookId;
  const updateActorHookId = controlPanelState?.updateActorHookId;
  const createItemHookId = controlPanelState?.createItemHookId;
  const updateItemHookId = controlPanelState?.updateItemHookId;
  const deleteItemHookId = controlPanelState?.deleteItemHookId;
  const createActiveEffectHookId = controlPanelState?.createActiveEffectHookId;
  const updateActiveEffectHookId = controlPanelState?.updateActiveEffectHookId;
  const deleteActiveEffectHookId = controlPanelState?.deleteActiveEffectHookId;

  if (typeof onPointerDown === "function") {
    const dragSourceElements = Array.isArray(controlPanelState?.dragSourceElements)
      ? controlPanelState.dragSourceElements
      : (panelElement instanceof HTMLElement ? [panelElement] : []);
    for (const sourceElement of dragSourceElements) {
      if (!(sourceElement instanceof HTMLElement)) continue;
      sourceElement.removeEventListener("pointerdown", onPointerDown);
    }
  }
  if (typeof onPointerMove === "function") window.removeEventListener("pointermove", onPointerMove);
  if (typeof onPointerUp === "function") {
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  }
  if (typeof onResize === "function") window.removeEventListener("resize", onResize);
  if (controlTokenHookId != null) Hooks.off("controlToken", controlTokenHookId);
  if (canvasReadyHookId != null) Hooks.off("canvasReady", canvasReadyHookId);
  if (refreshTokenHookId != null) Hooks.off("refreshToken", refreshTokenHookId);
  if (updateTokenHookId != null) Hooks.off("updateToken", updateTokenHookId);
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


















































