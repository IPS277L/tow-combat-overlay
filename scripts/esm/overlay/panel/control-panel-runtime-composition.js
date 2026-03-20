import {
  towCombatOverlayAddWound,
  towCombatOverlayGetActorWoundItemCount,
  towCombatOverlayGetResilienceValue,
  towCombatOverlayGetWoundCount,
  towCombatOverlayRemoveWound
} from "../layout/wound-state.js";
import { getTowCombatOverlayConstants } from "../../runtime/module-constants.js";
import { MODULE_KEY } from "../../runtime/overlay-constants.js";
import {
  AUTO_DEFENCE_WAIT_MS,
  AUTO_APPLY_WAIT_MS,
  OPPOSED_LINK_WAIT_MS,
  AUTO_STAGGER_PATCH_MS,
  ICON_SRC_WOUND
} from "../../runtime/overlay-constants.js";
import {
  getTypeTooltipData,
  hideStatusTooltip,
  runActorOpLock,
  showOverlayTooltip
} from "../shared/shared.js";
import {
  towCombatOverlayCanEditActor,
  towCombatOverlayCopyPoint,
  towCombatOverlayIsAltModifier,
  towCombatOverlayIsCtrlModifier,
  towCombatOverlayIsShiftModifier,
  towCombatOverlayTokenAtPoint,
  towCombatOverlayWarnNoPermission
} from "../shared/core-helpers.js";
import {
  towCombatOverlayAddActorWound,
  towCombatOverlayAddActorCondition,
  towCombatOverlayRemoveActorCondition
} from "../shared/actions-bridge.js";
import {
  towCombatOverlayArmAutoSubmitDialog,
  towCombatOverlaySetupAbilityTestWithDamage
} from "../../combat/attack.js";
import { towCombatOverlayRenderTemplate } from "../../combat/core.js";
import { towCombatOverlayDefenceActor } from "../../combat/defence.js";
import { towCombatOverlayRollSkill } from "../../combat/defence.js";
import {
  createTowCombatOverlayAutomationCoordinator,
  towCombatOverlayAutomation
} from "../automation/automation.js";
import {
  adjustTowCombatOverlayActorRollModifierDice,
  createTowCombatOverlayRollContext,
  cycleTowCombatOverlayActorRollState,
  getTowCombatOverlayActorRollModifierFields,
  getTowCombatOverlayActorRollModifierState,
  getTowCombatOverlayActorRollModifierStateLabel,
  setTowCombatOverlayActorRollModifierState
} from "../../combat/roll-modifier.js";
import { getTowCombatOverlaySystemAdapter } from "../../system-adapter/system-adapter.js";
import {
  clearSavedPanelButtonKeyOrder,
  isSyntheticEmptySlotKey,
  parsePanelButtonKey,
  readSavedPanelButtonKeyOrder,
  readSavedPanelReorderUnlocked,
  resolvePanelButtonOrderScope,
  toPanelButtonKey,
  writeSavedPanelButtonKeyOrder,
  writeSavedPanelPosition,
  writeSavedPanelReorderUnlocked
} from "./shared/state.js";
import {
  applyInitialPanelPosition,
  applyPanelPosition,
  applyPanelPositionWithSelectionClamp,
  syncSelectionPanelPosition
} from "./shared/position.js";
import { bindPanelTooltipEvent } from "./shared/tooltip.js";
import {
  escapePanelHtml,
  normalizeDescriptionSource,
  normalizeItemDescription,
  resolvePanelAttackSpecialPropertyMarkup,
  resolvePanelAttackSpecialPropertyText,
  resolveTemporaryEffectDescription
} from "./shared/description.js";
import {
  actorHasMagicCasting,
  formatMiscastDiceValue,
  formatStatNumber,
  formatWoundsWithMax,
  getPrimaryTokenIconSrc,
  getPrimaryTokenName,
  getPrimaryTokenTypeLabel,
  getSpeedLabel
} from "./selection/selection-display.js";
import {
  getPanelItemGroupsForActor as buildPanelItemGroupsForActor,
  resolveDynamicGridLayout
} from "./slots/item-groups.js";
import {
  bindControlPanelDrag,
  removeStaleControlPanels
} from "./shared/drag.js";
import {
  getActorEffectsByStatus,
  getActorStatusSet,
  getAllConditionEntries,
  getConditionTooltipData,
  updatePanelWoundActionIndicator
} from "./shared/status.js";
import { createPanelActionControlsService } from "./actions/action-controls.js";
import { createPanelStatsStatusBindingsService } from "./selection/stats-status-bindings.js";
import { createPanelSelectionSyncService } from "./selection/selection-sync.js";
import { createPanelSlotRenderService } from "./slots/slot-render.js";
import { createPanelTargetPickService } from "./actions/target-pick.js";
import { withPatchedPanelActionSkillTestContext } from "./actions/action-test-context.js";
import { createPanelActionExecutionService } from "../../combat/action-runtime/action-execution.js";
import { createPanelSlotClickService } from "./slots/slot-click.js";
import { createPanelActionFlowService } from "../../combat/action-runtime/action-flow.js";
import { createPanelSpellAutoApplyService } from "../spells/spell-auto-apply.js";
import { createPanelSlotsLayoutService } from "./slots/slots-layout.js";
import { createPanelSelectionSyncDisplayService } from "./selection/selection-sync-display.js";
import { createPanelReorderService } from "./slots/reorder.js";
import { createPanelAttackResourceService } from "../../combat/resources/attack-resource.js";
import { createPanelActionEntriesService } from "./actions/action-entries.js";
import { createPanelSlotBindingService } from "./slots/slot-binding.js";
import { createPanelDomLifecycleService } from "./lifecycle/dom-lifecycle.js";
import { createPanelBaseServices } from "./core/base-services.js";
import { createPanelStatusDisplayService } from "./selection/status-display.js";
import {
  PANEL_ACTIONS_ORDER,
  PANEL_ACTION_ICON_BY_KEY,
  PANEL_ATTACK_PICK_CURSOR,
  PANEL_DICE_ICON,
  PANEL_FALLBACK_ITEM_ICON,
  PANEL_ID,
  PANEL_MAIN_GRID_MIN_COLUMNS,
  PANEL_MAIN_GRID_MIN_ROWS,
  PANEL_MANOEUVRE_ICON_BY_KEY,
  PANEL_MANOEUVRE_ORDER,
  PANEL_RECOVER_ICON_BY_KEY,
  PANEL_RECOVER_ORDER,
  PANEL_REORDERABLE_GROUP_KEYS,
  PANEL_RESILIENCE_ICON,
  PANEL_ROLL_ICON,
  PANEL_SELECTION_GAP_PX,
  PANEL_SELECTION_ID,
  PANEL_SELECTION_TEMPLATE_PATH,
  PANEL_SPEED_ICON,
  PANEL_STATE_KEY,
  PANEL_TEMPLATE_PATH,
  PANEL_UNARMED_ACTION_ID,
  PANEL_UNARMED_CLEANUP_POLL_MS,
  PANEL_UNARMED_FLAG_KEY,
  PANEL_UNARMED_OPPOSED_DISCOVERY_GRACE_MS,
  PANEL_VIEWPORT_MARGIN_PX
} from "./shared/panel-constants.js";

const PANEL_UNARMED_CLEANUP_MAX_WAIT_MS = AUTO_APPLY_WAIT_MS + AUTO_DEFENCE_WAIT_MS + 4000;
const PANEL_STAGGER_PATCH_DURATION_MS = AUTO_STAGGER_PATCH_MS + AUTO_APPLY_WAIT_MS + AUTO_DEFENCE_WAIT_MS;
const {
  moduleId: MODULE_ID,
  settings: MODULE_SETTINGS,
  tooltips: MODULE_TOOLTIPS
} = getTowCombatOverlayConstants();
const {
  panelContextAccessService,
  slotMeta,
  panelUnarmedLifecycleService,
  panelConditionToggleService,
  panelElementFactoryService,
  panelSpellSupportService
} = createPanelBaseServices({
  moduleId: MODULE_ID,
  moduleSettings: MODULE_SETTINGS,
  moduleKey: MODULE_KEY,
  panelStateKey: PANEL_STATE_KEY,
  panelTemplatePath: PANEL_TEMPLATE_PATH,
  panelSelectionTemplatePath: PANEL_SELECTION_TEMPLATE_PATH,
  panelId: PANEL_ID,
  panelSelectionId: PANEL_SELECTION_ID,
  iconSrcWound: ICON_SRC_WOUND,
  panelResilienceIcon: PANEL_RESILIENCE_ICON,
  panelSpeedIcon: PANEL_SPEED_ICON,
  panelRollIcon: PANEL_ROLL_ICON,
  panelDiceIcon: PANEL_DICE_ICON,
  panelUnarmedFlagKey: PANEL_UNARMED_FLAG_KEY,
  panelActionIconByKey: PANEL_ACTION_ICON_BY_KEY,
  panelFallbackItemIcon: PANEL_FALLBACK_ITEM_ICON,
  panelUnarmedCleanupPollMs: PANEL_UNARMED_CLEANUP_POLL_MS,
  panelUnarmedCleanupMaxWaitMs: PANEL_UNARMED_CLEANUP_MAX_WAIT_MS,
  panelUnarmedOpposedDiscoveryGraceMs: PANEL_UNARMED_OPPOSED_DISCOVERY_GRACE_MS,
  resolvePanelAttackSpecialPropertyText,
  getAllConditionEntries,
  towCombatOverlayRenderTemplate,
  towCombatOverlayArmAutoSubmitDialog,
  getTowCombatOverlayActorRollModifierFields,
  runActorOpLock,
  towCombatOverlayCanEditActor,
  towCombatOverlayWarnNoPermission,
  towCombatOverlayAddActorCondition,
  towCombatOverlayRemoveActorCondition,
  getActorStatusSet,
  getActorEffectsByStatus
});
const {
  resolvePanelAttackAmmoState,
  writePanelAttackAmmoState,
  updatePanelSlotAmmoBadge,
  updatePanelSlotAttackAmmoVisualState,
  updatePanelSlotPropertyBadge,
  updatePanelSlotAttackRarity,
  resolvePanelAttackDamageLabel,
  updatePanelSlotDamageBadge
} = slotMeta;
const panelActionControlsService = createPanelActionControlsService({
  getTowCombatOverlayActorRollModifierState,
  getTowCombatOverlayActorRollModifierStateLabel,
  setTowCombatOverlayActorRollModifierState,
  adjustTowCombatOverlayActorRollModifierDice,
  cycleTowCombatOverlayActorRollState,
  towCombatOverlayCanEditActor,
  towCombatOverlayWarnNoPermission,
  towCombatOverlayIsCtrlModifier,
  bindPanelTooltipEvent,
  getPrimaryTokenTypeLabel,
  getSingleControlledActor: () => getSingleControlledActor()
});
const panelStatsStatusBindingsService = createPanelStatsStatusBindingsService({
  moduleTooltips: MODULE_TOOLTIPS,
  getSingleControlledToken: () => getSingleControlledToken(),
  getControlPanelState: () => getControlPanelState(),
  updateSelectionDisplay: (panelElement) => updateSelectionDisplay(panelElement),
  getTypeTooltipData,
  bindPanelTooltipEvent,
  getConditionTooltipData,
  toggleConditionFromPanel,
  updateStatusDisplay,
  getPrimaryTokenName,
  getPrimaryTokenTypeLabel,
  towCombatOverlayGetActorWoundItemCount,
  towCombatOverlayAddActorWound,
  towCombatOverlayRemoveWound,
  towCombatOverlayAddWound,
  towCombatOverlayIsShiftModifier,
  towCombatOverlayIsCtrlModifier
});
const panelSelectionSyncService = createPanelSelectionSyncService({
  updateSelectionDisplay: (panelElement) => updateSelectionDisplay(panelElement)
});
const panelSlotRenderService = createPanelSlotRenderService({
  resolveDynamicGridLayout,
  createPanelSlotElement: (slotIndex) => createPanelSlotElement(slotIndex),
  toPanelButtonKey,
  normalizeItemDescription,
  panelFallbackItemIcon: PANEL_FALLBACK_ITEM_ICON,
  panelUnarmedActionId: PANEL_UNARMED_ACTION_ID,
  resolvePanelAttackAmmoState,
  resolvePanelAttackDamageLabel,
  resolvePanelAttackSpecialPropertyMarkup,
  escapePanelHtml,
  updatePanelSlotAmmoBadge,
  updatePanelSlotAttackAmmoVisualState,
  updatePanelSlotAttackRarity,
  updatePanelSlotDamageBadge,
  panelMainGridMinColumns: PANEL_MAIN_GRID_MIN_COLUMNS,
  panelMainGridMinRows: PANEL_MAIN_GRID_MIN_ROWS
});
const panelTargetPickService = createPanelTargetPickService({
  panelId: PANEL_ID,
  pickCursor: PANEL_ATTACK_PICK_CURSOR,
  getControlPanelState: () => getControlPanelState(),
  hideStatusTooltip,
  showOverlayTooltip,
  copyPoint: towCombatOverlayCopyPoint,
  tokenAtPoint: towCombatOverlayTokenAtPoint,
  isAltModifier: towCombatOverlayIsAltModifier,
  runPanelAttackOnTarget: (sourceToken, targetToken, attackItem, options) => runPanelAttackOnTarget(sourceToken, targetToken, attackItem, options),
  runPanelAimAction: (actor, sourceToken, options) => runPanelAimAction(actor, sourceToken, options),
  runPanelHelpAction: (actor, sourceToken, options) => runPanelHelpAction(actor, sourceToken, options)
});
const panelActionExecutionService = createPanelActionExecutionService({
  getOverlayAutomationRef: () => getOverlayAutomationRef(),
  panelStaggerPatchDurationMs: PANEL_STAGGER_PATCH_DURATION_MS,
  autoApplyWaitMs: AUTO_APPLY_WAIT_MS,
  opposedLinkWaitMs: OPPOSED_LINK_WAIT_MS,
  autoDefenceWaitMs: AUTO_DEFENCE_WAIT_MS,
  setupAbilityTestWithDamage: towCombatOverlaySetupAbilityTestWithDamage,
  rollSkill: towCombatOverlayRollSkill,
  armAutoSubmitActionSkillDialog: (actor, skill) => armAutoSubmitActionSkillDialog(actor, skill),
  runDefaultPanelActorAction: (actor, actionKey) => runDefaultPanelActorAction(actor, actionKey),
  getSystemAdapter: () => getTowCombatOverlaySystemAdapter(),
  createRollContext: createTowCombatOverlayRollContext,
  armApplyRollModifiersToNextTestDialog: (actor, options) => armApplyRollModifiersToNextTestDialog(actor, options),
  armAutoPickFirstHelpSkillDialog: (actor) => armAutoPickFirstHelpSkillDialog(actor)
});
const panelSlotClickService = createPanelSlotClickService({
  panelId: PANEL_ID,
  panelUnarmedActionId: PANEL_UNARMED_ACTION_ID,
  parsePanelButtonKey,
  getSingleControlledActor: () => getSingleControlledActor(),
  getSingleControlledToken: () => getSingleControlledToken(),
  canEditActor: towCombatOverlayCanEditActor,
  warnNoPermission: towCombatOverlayWarnNoPermission,
  isAltModifier: towCombatOverlayIsAltModifier,
  isShiftModifier: towCombatOverlayIsShiftModifier,
  isCtrlModifier: towCombatOverlayIsCtrlModifier,
  clearPanelAttackPickMode: () => clearPanelAttackPickMode(),
  startPanelAimPickMode: (panelElement, slotElement, sourceToken, originEvent, options) => (
    startPanelAimPickMode(panelElement, slotElement, sourceToken, originEvent, options)
  ),
  startPanelHelpPickMode: (panelElement, slotElement, sourceToken, originEvent, options) => (
    startPanelHelpPickMode(panelElement, slotElement, sourceToken, originEvent, options)
  ),
  startPanelAttackPickMode: (panelElement, slotElement, sourceToken, attackItem, originEvent, options) => (
    startPanelAttackPickMode(panelElement, slotElement, sourceToken, attackItem, originEvent, options)
  ),
  runPanelAimAction: (actor, sourceToken, options) => runPanelAimAction(actor, sourceToken, options),
  runPanelHelpAction: (actor, sourceToken, options) => runPanelHelpAction(actor, sourceToken, options),
  resetPanelAccumulatePowerValues: (actor) => resetPanelAccumulatePowerValues(actor),
  resolveActorMiscastState: (actor) => resolveActorMiscastState(actor),
  runPanelAccumulatePowerAction: (actor, options) => runPanelAccumulatePowerAction(actor, options),
  runPanelActorAction: (actor, actionKey, options) => runPanelActorAction(actor, actionKey, options),
  runPanelRecoverAction: (actor, subAction, options) => runPanelRecoverAction(actor, subAction, options),
  runPanelManoeuvreAction: (actor, subAction, options) => runPanelManoeuvreAction(actor, subAction, options),
  spellRequiresTargetPick: (spell) => spellRequiresTargetPick(spell),
  withTemporaryUserTargets: (targetToken, callback) => withTemporaryUserTargets(targetToken, callback),
  runPanelCastSpecificSpellFromAccumulatedPower: (actor, spell, options) => runPanelCastSpecificSpellFromAccumulatedPower(actor, spell, options),
  spellTargetsSelf: (spell) => spellTargetsSelf(spell),
  updateSelectionDisplay: (panelElement) => updateSelectionDisplay(panelElement),
  withTemporaryPanelUnarmedAbility: (actor, callback) => withTemporaryPanelUnarmedAbility(actor, callback),
  setupAbilityTestWithDamage: towCombatOverlaySetupAbilityTestWithDamage,
  runPanelUnarmedAttackOnTarget: (sourceToken, targetToken, attackItem, options) => (
    runPanelUnarmedAttackOnTarget(sourceToken, targetToken, attackItem, options)
  ),
  ensurePanelAttackResourceStateBeforeUse: (actor, attackItem) => ensurePanelAttackResourceStateBeforeUse(actor, attackItem),
  resolvePanelAttackAmmoState,
  writePanelAttackAmmoState,
  runPanelAttackOnTarget: (sourceToken, targetToken, attackItem, options) => (
    runPanelAttackOnTarget(sourceToken, targetToken, attackItem, options)
  )
});
const panelActionFlowService = createPanelActionFlowService({
  withPatchedActionSkillTestContext: (actor, callback) => withPatchedActionSkillTestContext(actor, callback),
  getTowCombatOverlayActorRollModifierFields,
  towCombatOverlayArmAutoSubmitDialog,
  towCombatOverlayDefenceActor,
  getTowCombatOverlaySystemAdapter: () => getTowCombatOverlaySystemAdapter(),
  createTowCombatOverlayRollContext
});
const panelActionEntriesService = createPanelActionEntriesService({
  panelActionsOrder: PANEL_ACTIONS_ORDER,
  panelActionIconByKey: PANEL_ACTION_ICON_BY_KEY,
  panelManoeuvreOrder: PANEL_MANOEUVRE_ORDER,
  panelManoeuvreIconByKey: PANEL_MANOEUVRE_ICON_BY_KEY,
  panelRecoverOrder: PANEL_RECOVER_ORDER,
  panelRecoverIconByKey: PANEL_RECOVER_ICON_BY_KEY,
  panelFallbackItemIcon: PANEL_FALLBACK_ITEM_ICON,
  actorHasMagicCasting,
  resolvePanelCastingLore: (actor) => resolvePanelCastingLore(actor),
  normalizeDescriptionSource
});
const panelSpellAutoApplyService = createPanelSpellAutoApplyService({
  getOverlayAutomationRef: () => getOverlayAutomationRef(),
  panelStaggerPatchDurationMs: PANEL_STAGGER_PATCH_DURATION_MS,
  autoApplyWaitMs: AUTO_APPLY_WAIT_MS,
  armAutoResolveSpellTriggeredTestDialogs: (actor = null, { timeoutMs } = {}) => armAutoResolveSpellTriggeredTestDialogs(actor, { timeoutMs }),
  spellRequiresTargetPick: (spell) => spellRequiresTargetPick(spell),
  spellTargetsSelf: (spell) => spellTargetsSelf(spell),
  withTemporaryUserTargets: (targetToken, callback) => withTemporaryUserTargets(targetToken, callback),
  startPanelAttackPickMode: (panelElement, slotElement, sourceToken, attackItem, originEvent, options) => (
    startPanelAttackPickMode(panelElement, slotElement, sourceToken, attackItem, originEvent, options)
  ),
  resolveActorLatestCastingPotency: (actor) => resolveActorLatestCastingPotency(actor),
  ensurePanelItemUseRollCompatibility: () => ensurePanelItemUseRollCompatibility(),
  armApplyRollModifiersToNextTestDialog: (actor, options) => armApplyRollModifiersToNextTestDialog(actor, options),
  towCombatOverlayArmAutoSubmitDialog,
  createTowCombatOverlayRollContext
});
const panelSlotsLayoutService = createPanelSlotsLayoutService({
  updatePanelWoundActionIndicator,
  iconSrcWound: ICON_SRC_WOUND,
  escapePanelHtml,
  buildPanelItemGroupsForActor,
  getPanelActionEntries: (actor) => getPanelActionEntries(actor),
  getPanelManoeuvreSubActionEntries: () => getPanelManoeuvreSubActionEntries(),
  getPanelRecoverActionEntries: () => getPanelRecoverActionEntries(),
  isPanelGeneratedUnarmedItem: (item) => isPanelGeneratedUnarmedItem(item),
  resolveTemporaryEffectDescription,
  panelFallbackItemIcon: PANEL_FALLBACK_ITEM_ICON,
  panelUnarmedActionId: PANEL_UNARMED_ACTION_ID,
  panelActionIconByKey: PANEL_ACTION_ICON_BY_KEY,
  resolvePanelButtonOrderScope,
  getControlPanelState: () => getControlPanelState(),
  readSavedPanelReorderUnlocked,
  syncPanelReorderToggleButton: (panelElement) => syncPanelReorderToggleButton(panelElement),
  toPanelButtonKey,
  getDefaultPanelButtonKeyOrder: () => getDefaultPanelButtonKeyOrder(),
  parsePanelButtonKey,
  isSyntheticEmptySlotKey,
  readSavedPanelButtonKeyOrder,
  updateGroupSlots: (panelElement, groupKey, groupItems, actor) => updateGroupSlots(panelElement, groupKey, groupItems, actor)
});
const panelSelectionSyncDisplayService = createPanelSelectionSyncDisplayService({
  getControlPanelState: () => getControlPanelState(),
  clearPanelAttackPickMode: () => clearPanelAttackPickMode(),
  getPrimaryTokenIconSrc,
  getPrimaryTokenName,
  towCombatOverlayGetResilienceValue,
  towCombatOverlayGetWoundCount,
  getSpeedLabel,
  actorHasMagicCasting,
  formatStatNumber,
  formatWoundsWithMax,
  formatMiscastDiceValue,
  updatePanelSlots: (panelElement, token) => updatePanelSlots(panelElement, token),
  updateStatusDisplay: (panelElement, token) => updateStatusDisplay(panelElement, token),
  updateActionControlsDisplay: (panelElement, token) => updateActionControlsDisplay(panelElement, token),
  applyInitialPanelPosition,
  applyPanelPosition,
  syncSelectionPanelPosition,
  panelViewportMarginPx: PANEL_VIEWPORT_MARGIN_PX,
  panelSelectionGapPx: PANEL_SELECTION_GAP_PX
});
const panelStatusDisplayService = createPanelStatusDisplayService({
  getActorStatusSet
});
const panelReorderService = createPanelReorderService({
  bindPanelTooltipEvent,
  getControlPanelState: () => getControlPanelState(),
  writeSavedPanelReorderUnlocked,
  clearSavedPanelButtonKeyOrder,
  readSavedPanelButtonKeyOrder,
  writeSavedPanelButtonKeyOrder,
  parsePanelButtonKey,
  toPanelButtonKey,
  reorderableGroupKeys: PANEL_REORDERABLE_GROUP_KEYS,
  panelUnarmedActionId: PANEL_UNARMED_ACTION_ID,
  updateSelectionDisplay: (panelElement) => updateSelectionDisplay(panelElement)
});
const panelAttackResourceService = createPanelAttackResourceService({
  towCombatOverlayArmAutoSubmitDialog,
  armApplyRollModifiersToNextTestDialog: (actor, options) => armApplyRollModifiersToNextTestDialog(actor, options),
  withPatchedActionSkillTestContext: (actor, callback) => withPatchedActionSkillTestContext(actor, callback),
  getTowCombatOverlaySystemAdapter: () => getTowCombatOverlaySystemAdapter(),
  createTowCombatOverlayRollContext,
  resolvePanelAttackAmmoState,
  writePanelAttackAmmoState
});
const panelSlotBindingService = createPanelSlotBindingService({
  getControlPanelState: () => getControlPanelState(),
  isPanelButtonReorderUnlocked: () => isPanelButtonReorderUnlocked(),
  isMainActionPanelSlot: (slotElement) => isMainActionPanelSlot(slotElement),
  getSlotPanelButtonKey: (slotElement) => getSlotPanelButtonKey(slotElement),
  movePanelButtonKeyBeforeTarget: (sourceKey, targetKey, panelElement) => (
    movePanelButtonKeyBeforeTarget(sourceKey, targetKey, panelElement)
  ),
  handlePanelSlotClick: (slotElement, event) => handlePanelSlotClick(slotElement, event),
  updateSelectionDisplay: (panelElement) => updateSelectionDisplay(panelElement),
  hideStatusTooltip,
  showOverlayTooltip
});
const panelDomLifecycleService = createPanelDomLifecycleService({
  panelId: PANEL_ID,
  panelSelectionId: PANEL_SELECTION_ID,
  panelStateKey: PANEL_STATE_KEY,
  panelViewportMarginPx: PANEL_VIEWPORT_MARGIN_PX,
  panelSelectionGapPx: PANEL_SELECTION_GAP_PX,
  getControlPanelState: () => getControlPanelState(),
  readSavedPanelReorderUnlocked,
  removeStaleControlPanels,
  createControlPanelElement: () => createControlPanelElement(),
  applyInitialPanelPosition,
  syncSelectionPanelPosition,
  bindPanelActionControls: (panelElement) => bindPanelActionControls(panelElement),
  bindPanelReorderToggle: (panelElement) => bindPanelReorderToggle(panelElement),
  bindPanelReorderReset: (panelElement) => bindPanelReorderReset(panelElement),
  bindSelectionPanelStatEvents: (selectionPanelElement) => bindSelectionPanelStatEvents(selectionPanelElement),
  bindSelectionNameTooltipEvent: (selectionPanelElement) => bindSelectionNameTooltipEvent(selectionPanelElement),
  bindPanelStatusesTooltipEvents: (panelElement) => bindPanelStatusesTooltipEvents(panelElement),
  bindControlPanelDrag,
  applyPanelPositionWithSelectionClamp,
  writeSavedPanelPosition,
  bindPanelSelectionSync: (controlPanelState, panelElement) => bindPanelSelectionSync(controlPanelState, panelElement),
  clearPanelAttackPickMode: () => clearPanelAttackPickMode(),
  panelSelectionSyncService
});


async function toggleConditionFromPanel(actor, conditionId) {
  return panelConditionToggleService.toggleConditionFromPanel(actor, conditionId);
}

function getSingleControlledToken() {
  return panelContextAccessService.getSingleControlledToken();
}

function getControlPanelState() {
  return panelContextAccessService.getControlPanelState();
}
function getDefaultPanelButtonKeyOrder() {
  return panelReorderService.getDefaultPanelButtonKeyOrder();
}

function isPanelButtonReorderUnlocked() {
  return panelReorderService.isPanelButtonReorderUnlocked();
}

function syncPanelReorderToggleButton(panelElement) {
  panelReorderService.syncPanelReorderToggleButton(panelElement);
}

function bindPanelReorderToggle(panelElement) {
  panelReorderService.bindPanelReorderToggle(panelElement);
}


function bindPanelReorderReset(panelElement) {
  panelReorderService.bindPanelReorderReset(panelElement);
}
function movePanelButtonKeyBeforeTarget(sourceKey, targetKey, panelElement = null) {
  return panelReorderService.movePanelButtonKeyBeforeTarget(sourceKey, targetKey, panelElement);
}
function getSlotPanelButtonKey(slotElement) {
  return panelReorderService.getSlotPanelButtonKey(slotElement);
}
function isMainActionPanelSlot(slotElement) {
  return panelReorderService.isMainActionPanelSlot(slotElement);
}
async function createControlPanelElement() {
  return panelElementFactoryService.createControlPanelElement();
}

function bindPanelSlotEvent(slotElement) {
  panelSlotBindingService.bindPanelSlotEvent(slotElement);
}
function getOverlayAutomationRef() {
  return towCombatOverlayAutomation ?? createTowCombatOverlayAutomationCoordinator();
}

function clearPanelAttackPickMode() {
  panelTargetPickService.clearPickMode();
}
async function runPanelAttackOnTarget(sourceToken, targetToken, attackItem, { autoRoll = true } = {}) {
  return panelActionExecutionService.runPanelAttackOnTarget(sourceToken, targetToken, attackItem, { autoRoll });
}

function isPanelGeneratedUnarmedItem(item) {
  return panelUnarmedLifecycleService.isPanelGeneratedUnarmedItem(item);
}

async function withTemporaryPanelUnarmedAbility(actor, callback) {
  return panelUnarmedLifecycleService.withTemporaryPanelUnarmedAbility(actor, callback);
}

function armAutoEnduranceDefenceForOpposed(sourceToken, targetToken, { sourceBeforeState } = {}) {
  panelActionExecutionService.armAutoEnduranceDefenceForOpposed(sourceToken, targetToken, { sourceBeforeState });
}

async function runPanelUnarmedAttackOnTarget(sourceToken, targetToken, attackItem, { autoRoll = true } = {}) {
  return panelActionExecutionService.runPanelUnarmedAttackOnTarget(sourceToken, targetToken, attackItem, { autoRoll });
}

async function withTemporaryUserTargets(targetToken, callback) {
  return panelActionExecutionService.withTemporaryUserTargets(targetToken, callback);
}

async function runPanelAimAction(actor, sourceToken, { autoRoll = true, targetToken = null } = {}) {
  return panelActionExecutionService.runPanelAimAction(actor, sourceToken, { autoRoll, targetToken });
}

async function runPanelHelpAction(actor, sourceToken, { autoRoll = true, targetToken = null } = {}) {
  return panelActionExecutionService.runPanelHelpAction(actor, sourceToken, { autoRoll, targetToken });
}

function startPanelAttackPickMode(panelElement, slotElement, sourceToken, attackItem, originEvent = null, options = {}) {
  panelTargetPickService.startAttackPickMode(panelElement, slotElement, sourceToken, attackItem, originEvent, options);
}

function startPanelAimPickMode(panelElement, slotElement, sourceToken, originEvent = null, options = {}) {
  panelTargetPickService.startAimPickMode(panelElement, slotElement, sourceToken, originEvent, options);
}

function startPanelHelpPickMode(panelElement, slotElement, sourceToken, originEvent = null, options = {}) {
  panelTargetPickService.startHelpPickMode(panelElement, slotElement, sourceToken, originEvent, options);
}

async function handlePanelSlotClick(slotElement, event) {
  await panelSlotClickService.handleSlotClick(slotElement, event);
}

async function runDefaultPanelActorAction(actor, actionKey) {
  return panelActionFlowService.runDefaultPanelActorAction(actor, actionKey);
}

async function withPatchedActionSkillTestContext(actor, callback) {
  return withPatchedPanelActionSkillTestContext(actor, callback, {
    createRollContext: createTowCombatOverlayRollContext
  });
}

function armApplyRollModifiersToNextTestDialog(actor, { matches = null, timeoutMs = 20000 } = {}) {
  panelActionFlowService.armApplyRollModifiersToNextTestDialog(actor, { matches, timeoutMs });
}

function armAutoSubmitActionSkillDialog(actor, skill) {
  panelActionFlowService.armAutoSubmitActionSkillDialog(actor, skill);
}

function armAutoResolveSpellTriggeredTestDialogs(actor = null, { timeoutMs = 20000 } = {}) {
  return panelSpellSupportService.armAutoResolveSpellTriggeredTestDialogs(actor, { timeoutMs });
}

function ensurePanelItemUseRollCompatibility() {
  panelSpellSupportService.ensurePanelItemUseRollCompatibility();
}

function armAutoPickFirstImproviseSkillDialog(actor) {
  panelActionFlowService.armAutoPickFirstImproviseSkillDialog(actor);
}

function armAutoPickFirstHelpSkillDialog(actor) {
  panelActionFlowService.armAutoPickFirstHelpSkillDialog(actor);
}

async function runPanelActorAction(actor, actionKey, { autoRoll = true } = {}) {
  return panelActionFlowService.runPanelActorAction(actor, actionKey, { autoRoll });
}

function getCoreActionDescription(actionData) {
  return panelActionEntriesService.getCoreActionDescription(actionData);
}

function resolveActorLatestCastingPotency(actor) {
  return panelActionEntriesService.resolveActorLatestCastingPotency(actor);
}

function getPanelActionEntries(actor = null) {
  return panelActionEntriesService.getPanelActionEntries(actor);
}

function getPanelManoeuvreSubActionEntries() {
  return panelActionEntriesService.getPanelManoeuvreSubActionEntries();
}

function getPanelRecoverActionEntries() {
  return panelActionEntriesService.getPanelRecoverActionEntries();
}

async function runPanelRecoverAction(actor, subAction, { autoRoll = true } = {}) {
  return panelActionFlowService.runPanelRecoverAction(actor, subAction, { autoRoll });
}

async function runPanelManoeuvreAction(actor, subAction, { autoRoll = true } = {}) {
  return panelActionFlowService.runPanelManoeuvreAction(actor, subAction, { autoRoll });
}

function resolvePanelCastingLore(actor) {
  return panelActionFlowService.resolvePanelCastingLore(actor);
}

async function runPanelAccumulatePowerAction(actor, { autoRoll = true } = {}) {
  return panelActionFlowService.runPanelAccumulatePowerAction(actor, { autoRoll });
}

async function invokeChatMessageActionByName(message, action, targetElement = null) {
  return panelSpellAutoApplyService.invokeChatMessageActionByName(message, action, targetElement);
}

function spellRequiresTargetPick(spell) {
  return panelSpellSupportService.spellRequiresTargetPick(spell);
}

function spellTargetsSelf(spell) {
  return panelSpellSupportService.spellTargetsSelf(spell);
}

function armAutoProcessSpellApplyButtons(actor, spell, {
  allowTargetPick = true,
  onAfterApply = null,
  sourceToken = null,
  panelElement = null,
  slotElement = null,
  originEvent = null
} = {}) {
  panelSpellAutoApplyService.armAutoProcessSpellApplyButtons(actor, spell, {
    allowTargetPick,
    onAfterApply,
    sourceToken,
    panelElement,
    slotElement,
    originEvent
  });
}

async function runPanelCastSpecificSpellFromAccumulatedPower(actor, spell, {
  autoRollCastingTest = false,
  autoProcessApply = true,
  allowTargetPick = true,
  sourceToken = null,
  panelElement = null,
  slotElement = null,
  originEvent = null
} = {}) {
  return panelSpellAutoApplyService.runPanelCastSpecificSpellFromAccumulatedPower(actor, spell, {
    autoRollCastingTest,
    autoProcessApply,
    allowTargetPick,
    sourceToken,
    panelElement,
    slotElement,
    originEvent
  });
}

async function resetPanelAccumulatePowerValues(actor) {
  return panelSpellAutoApplyService.resetPanelAccumulatePowerValues(actor);
}

function resolveActorMiscastState(actor) {
  return panelSpellSupportService.resolveActorMiscastState(actor);
}

function getPanelStatTooltipData(statKey) {
  return panelStatsStatusBindingsService.getPanelStatTooltipData(statKey);
}

function bindPanelStatsTooltipEvents(panelElement) {
  panelStatsStatusBindingsService.bindPanelStatsTooltipEvents(panelElement);
}

function bindPanelWoundsStatEvents(panelElement) {
  panelStatsStatusBindingsService.bindPanelWoundsStatEvents(panelElement);
}

function bindSelectionPanelStatEvents(selectionPanelElement) {
  panelStatsStatusBindingsService.bindSelectionPanelStatEvents(selectionPanelElement);
}

function bindSelectionNameTooltipEvent(selectionPanelElement) {
  panelStatsStatusBindingsService.bindSelectionNameTooltipEvent(selectionPanelElement);
}

function bindPanelStatusesTooltipEvents(panelElement) {
  panelStatsStatusBindingsService.bindPanelStatusesTooltipEvents(panelElement);
}

function getSingleControlledActor() {
  return panelContextAccessService.getSingleControlledActor();
}

function updateActionControlsDisplay(panelElement, token = null) {
  panelActionControlsService.updateActionControlsDisplay(panelElement, token);
}

function bindPanelActionControls(panelElement) {
  panelActionControlsService.bindPanelActionControls(panelElement, {
    onUpdated: () => updateSelectionDisplay(panelElement)
  });
}

function createPanelSlotElement(slotIndex) {
  return panelSlotBindingService.createPanelSlotElement(slotIndex);
}

function armAutoSubmitReloadTestDialog(actor) {
  panelAttackResourceService.armAutoSubmitReloadTestDialog(actor);
}

async function rollPanelReloadForAttack(actor, attackItem) {
  return panelAttackResourceService.rollPanelReloadForAttack(actor, attackItem);
}

async function ensurePanelAttackResourceStateBeforeUse(actor, attackItem) {
  return panelAttackResourceService.ensurePanelAttackResourceStateBeforeUse(actor, attackItem);
}

function updateGroupSlots(panelElement, groupKey, groupItems = [], actor = null) {
  panelSlotRenderService.updateGroupSlots(panelElement, groupKey, groupItems, actor);
}
function updatePanelSlots(panelElement, token = null) {
  panelSlotsLayoutService.updatePanelSlots(panelElement, token);
}
function updateStatusDisplay(panelElement, token = null) {
  panelStatusDisplayService.updateStatusDisplay(panelElement, token);
}

function syncItemGroupsMinWidth(panelElement) {
  panelSelectionSyncDisplayService.syncItemGroupsMinWidth(panelElement);
}

function fitSelectionNameFont(selectionNameMainElement, { minFontSizePx = 12 } = {}) {
  panelSelectionSyncDisplayService.fitSelectionNameFont(selectionNameMainElement, { minFontSizePx });
}

function updateSelectionDisplay(panelElement) {
  panelSelectionSyncDisplayService.updateSelectionDisplay(panelElement);
}

function bindPanelSelectionSync(controlPanelState, panelElement) {
  panelSelectionSyncService.bindSelectionSync(controlPanelState, panelElement);
}

export async function towCombatOverlayEnsureControlPanel() {
  await panelDomLifecycleService.ensureControlPanel();
}

export function towCombatOverlayRemoveControlPanel() {
  panelDomLifecycleService.removeControlPanel();
}



