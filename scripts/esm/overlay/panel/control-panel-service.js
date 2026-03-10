import {
  towCombatOverlayGetResilienceValue,
  towCombatOverlayGetWoundCount
} from "../layout/wound-state-service.js";
import { getTowCombatOverlayConstants } from "../../runtime/constants.js";
import {
  getTypeTooltipData,
  hideStatusTooltip,
  showOverlayTooltip,
  towCombatOverlayLocalizeSystemKey,
  towCombatOverlayResolveConditionLabel
} from "../shared/shared-service.js";

const PANEL_ID = "tow-combat-overlay-control-panel";
const PANEL_TEMPLATE_PATH = "modules/tow-combat-overlay/templates/overlay/control-panel.hbs";
const PANEL_LOCAL_STORAGE_KEY = "tow-combat-overlay.control-panel-position.v1";
const PANEL_STATE_KEY = "__towCombatOverlayControlPanelState";
const PANEL_VIEWPORT_MARGIN_PX = 8;
const PANEL_FALLBACK_ITEM_ICON = "icons/svg/item-bag.svg";
const PANEL_DEBUG_ITEMS = false;
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
    description: String(shortDescription || "")
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
  return { panelElement };
}

function bindPanelSlotEvent(slotElement) {
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
      theme: "panel"
    });
  };
  const onHideTooltip = () => hideStatusTooltip();
  targetElement.addEventListener("pointerenter", onShowTooltip);
  targetElement.addEventListener("pointermove", onShowTooltip);
  targetElement.addEventListener("pointerleave", onHideTooltip);
  targetElement.addEventListener("pointercancel", onHideTooltip);
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
  if (key === "wounds") return MODULE_TOOLTIPS.wounds;
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

function bindPanelStatusesTooltipEvents(panelElement) {
  const statusElements = Array.from(panelElement.querySelectorAll(".tow-combat-overlay-control-panel__status-icon"));
  for (const statusElement of statusElements) {
    if (!(statusElement instanceof HTMLElement)) continue;
    const conditionId = String(statusElement.dataset.statusId ?? "");
    bindPanelTooltipEvent(statusElement, () => getConditionTooltipData(conditionId));
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

function formatMiscastDiceValue(token) {
  const actor = token?.actor ?? token?.document?.actor;
  const miscasts = Number(actor?.system?.magic?.miscasts ?? NaN);
  if (!Number.isFinite(miscasts)) return "-";
  return String(Math.trunc(miscasts));
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

  // Match Old World sheet logic:
  // - attacks: ability items where system.isAttack is true
  // - abilities: non-attack ability items + talents
  // - magic: spell items; blessings are religion in core, mapped here into magic group
  const attacks = abilityItems
    .filter((item) => item?.system?.isAttack === true)
    .concat(weaponItems.filter((item) => item?.system?.isEquipped || item?.system?.equipped?.value));
  const abilities = abilityItems
    .filter((item) => item?.system?.isAttack !== true)
    .concat(talentItems);
  const magic = spellItems.concat(blessingItems);

  return { attacks, abilities, magic };
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
    slotElement.dataset.tooltipTitle = itemName;
    slotElement.dataset.tooltipDescription = itemDescription;
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
    : { attacks: [], abilities: [], magic: [] };
  updateGroupSlots(panelElement, "attacks", groups.attacks);
  updateGroupSlots(panelElement, "abilities", groups.abilities);
  updateGroupSlots(panelElement, "magic", groups.magic);
}

function updateStatusDisplay(panelElement, token = null) {
  const statusElements = Array.from(panelElement.querySelectorAll(".tow-combat-overlay-control-panel__status-icon"));
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
  const selectionElement = panelElement.querySelector(".tow-combat-overlay-control-panel__selection");
  if (!(selectionElement instanceof HTMLElement)) return;
  const tokenNameElement = panelElement.querySelector("[data-role='tokenName']");
  const statsElement = panelElement.querySelector(".tow-combat-overlay-control-panel__stats");
  const tokenTypeElement = panelElement.querySelector("[data-stat='tokenType']");
  const resilienceElement = panelElement.querySelector("[data-stat='resilience']");
  const woundsElement = panelElement.querySelector("[data-stat='wounds']");
  const miscastDiceElement = panelElement.querySelector("[data-stat='miscastDice']");
  const speedElement = panelElement.querySelector("[data-stat='speed']");
  const imageElement = selectionElement.querySelector(".tow-combat-overlay-control-panel__selection-image");
  const placeholderElement = selectionElement.querySelector(".tow-combat-overlay-control-panel__selection-placeholder");
  const multiCountElement = selectionElement.querySelector(".tow-combat-overlay-control-panel__selection-multi-count");
  if (!(imageElement instanceof HTMLImageElement)) return;
  if (!(tokenNameElement instanceof HTMLElement)) return;
  if (!(statsElement instanceof HTMLElement)) return;
  if (!(tokenTypeElement instanceof HTMLElement)) return;
  if (!(resilienceElement instanceof HTMLElement)) return;
  if (!(woundsElement instanceof HTMLElement)) return;
  if (!(miscastDiceElement instanceof HTMLElement)) return;
  if (!(speedElement instanceof HTMLElement)) return;
  if (!(placeholderElement instanceof HTMLElement)) return;
  if (!(multiCountElement instanceof HTMLElement)) return;

  const controlledTokens = Array.isArray(canvas?.tokens?.controlled)
    ? canvas.tokens.controlled.filter((token) => token && !token.destroyed)
    : [];
  const selectedCount = controlledTokens.length;

  if (selectedCount <= 0) {
    if (controlPanelState) controlPanelState.lastDebugTokenKey = null;
    selectionElement.dataset.selection = "none";
    selectionElement.title = "No token selected";
    statsElement.dataset.selection = "none";
    tokenNameElement.textContent = "No token selected";
    tokenTypeElement.textContent = "-";
    resilienceElement.textContent = "-";
    woundsElement.textContent = "-";
    miscastDiceElement.textContent = "-";
    speedElement.textContent = "-";
    imageElement.src = "";
    imageElement.alt = "Selected token";
    placeholderElement.textContent = "-";
    multiCountElement.textContent = "x0";
    updatePanelSlots(panelElement, null);
    updateStatusDisplay(panelElement, null);
    const rect = panelElement.getBoundingClientRect();
    applyPanelPosition(panelElement, rect.left, rect.top);
    return;
  }

  if (selectedCount === 1) {
    const token = controlledTokens[0];
    debugTokenItems(controlPanelState, token);
    const iconSrc = getPrimaryTokenIconSrc(token);
    const tokenName = getPrimaryTokenName(token);
    const typeLabel = getPrimaryTokenTypeLabel(token);
    const resilience = towCombatOverlayGetResilienceValue(token?.document);
    const wounds = towCombatOverlayGetWoundCount(token?.document);
    const miscastDice = formatMiscastDiceValue(token);
    const speed = getSpeedLabel(token);
    selectionElement.dataset.selection = "single";
    selectionElement.title = tokenName;
    statsElement.dataset.selection = "single";
    tokenNameElement.textContent = tokenName;
    tokenTypeElement.textContent = typeLabel;
    resilienceElement.textContent = formatStatNumber(resilience);
    woundsElement.textContent = formatStatNumber(wounds);
    miscastDiceElement.textContent = miscastDice;
    speedElement.textContent = speed;
    imageElement.src = iconSrc;
    imageElement.alt = selectionElement.title;
    placeholderElement.textContent = iconSrc ? "-" : "?";
    multiCountElement.textContent = "x1";
    updatePanelSlots(panelElement, token);
    updateStatusDisplay(panelElement, token);
    const rect = panelElement.getBoundingClientRect();
    applyPanelPosition(panelElement, rect.left, rect.top);
    return;
  }

  selectionElement.dataset.selection = "multi";
  if (controlPanelState) controlPanelState.lastDebugTokenKey = null;
  selectionElement.title = `${selectedCount} tokens selected`;
  statsElement.dataset.selection = "multi";
  tokenNameElement.textContent = `${selectedCount} tokens selected`;
  tokenTypeElement.textContent = "Multiple";
  resilienceElement.textContent = "-";
  woundsElement.textContent = "-";
  miscastDiceElement.textContent = "-";
  speedElement.textContent = "-";
  imageElement.src = "";
  imageElement.alt = "Multiple selected tokens";
  placeholderElement.textContent = "#";
  multiCountElement.textContent = `x${selectedCount}`;
  updatePanelSlots(panelElement, null);
  updateStatusDisplay(panelElement, null);
  const rect = panelElement.getBoundingClientRect();
  applyPanelPosition(panelElement, rect.left, rect.top);
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

function bindControlPanelDrag(controlPanelState, panelElement) {
  let dragData = null;

  const onPointerMove = (event) => {
    if (!dragData) return;
    const deltaX = Number(event.clientX) - dragData.startClientX;
    const deltaY = Number(event.clientY) - dragData.startClientY;
    applyPanelPosition(panelElement, dragData.startLeft + deltaX, dragData.startTop + deltaY);
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
  };

  panelElement.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("resize", onResize);

  controlPanelState.onPointerDown = onPointerDown;
  controlPanelState.onResize = onResize;
  controlPanelState.onPointerMove = onPointerMove;
  controlPanelState.onPointerUp = onPointerUp;
}

function removeStaleControlPanels() {
  for (const panel of Array.from(document.querySelectorAll(`#${PANEL_ID}`))) {
    if (panel instanceof HTMLElement) panel.remove();
  }
}

export async function towCombatOverlayEnsureControlPanel() {
  const controlPanelState = getControlPanelState();
  if (!controlPanelState) return;

  if (controlPanelState.element instanceof HTMLElement && controlPanelState.element.isConnected) return;
  removeStaleControlPanels();

  const { panelElement } = await createControlPanelElement();
  panelElement.style.visibility = "hidden";
  document.body.appendChild(panelElement);
  applyInitialPanelPosition(panelElement);
  panelElement.style.visibility = "";

  bindPanelStatsTooltipEvents(panelElement);
  bindPanelStatusesTooltipEvents(panelElement);
  bindControlPanelDrag(controlPanelState, panelElement);
  bindPanelSelectionSync(controlPanelState, panelElement);
  controlPanelState.element = panelElement;
}

export function towCombatOverlayRemoveControlPanel() {
  const controlPanelState = game?.[PANEL_STATE_KEY];
  const panelElement = controlPanelState?.element;
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

  removeStaleControlPanels();
  if (game && Object.prototype.hasOwnProperty.call(game, PANEL_STATE_KEY)) delete game[PANEL_STATE_KEY];
}
