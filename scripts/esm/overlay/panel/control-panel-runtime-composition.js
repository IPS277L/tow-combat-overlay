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
  canTowCombatOverlayUserViewControl,
  isTowCombatOverlayDisplaySettingEnabled
} from "../../bootstrap/register-settings.js";
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
import {
  towCombatOverlayApplyRollVisibility,
  towCombatOverlayRenderTemplate
} from "../../combat/core.js";
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
  isSyntheticEmptySlotKey,
  parsePanelButtonKey,
  readSavedPanelButtonKeyOrder,
  resolvePanelButtonOrderScope,
  toPanelButtonKey,
  writeSavedPanelButtonKeyOrder,
  writeSavedPanelPosition
} from "./shared/state.js";
import {
  applyInitialPanelPosition,
  applyPanelPosition,
  applyPanelPositionWithSelectionClamp,
  isControlPanelAlwaysCenteredEnabled,
  isControlPanelLockedEnabled,
  syncSelectionPanelPosition
} from "./shared/position.js";
import { bindPanelTooltipEvent } from "./shared/tooltip.js";
import { createControlPanelTooltipVisibilityService } from "./shared/tooltip-visibility.js";
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
  getConditionTooltipData
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
import { TOP_PANEL_ID } from "../top-panel/top-panel-constants.js";
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
  notifications: MODULE_NOTIFICATIONS,
  tooltips: MODULE_TOOLTIPS
} = getTowCombatOverlayConstants();
const panelTooltipVisibilityService = createControlPanelTooltipVisibilityService({
  moduleSettings: MODULE_SETTINGS,
  isSettingEnabled: (key, fallback) => isTowCombatOverlayDisplaySettingEnabled(key, fallback)
});
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
  canShowButtonsTooltip: () => panelTooltipVisibilityService.isControlPanelButtonsTooltipEnabled(),
  showClickBehaviorText: () => panelTooltipVisibilityService.showControlPanelTooltipClickBehaviorText(),
  getPrimaryTokenTypeLabel,
  getSingleControlledActor: () => panelContextAccessService.getSingleControlledActor()
});
const panelStatsStatusBindingsService = createPanelStatsStatusBindingsService({
  moduleTooltips: MODULE_TOOLTIPS,
  getSingleControlledToken: () => panelContextAccessService.getSingleControlledToken(),
  getControlPanelState: () => panelContextAccessService.getControlPanelState(),
  updateSelectionDisplay: (panelElement) => panelSelectionSyncDisplayService.updateSelectionDisplay(panelElement),
  getTypeTooltipData,
  bindPanelTooltipEvent,
  getConditionTooltipData,
  toggleConditionFromPanel: (actor, conditionId) => panelConditionToggleService.toggleConditionFromPanel(actor, conditionId),
  updateStatusDisplay: (panelElement, token = null) => panelStatusDisplayService.updateStatusDisplay(panelElement, token),
  getPrimaryTokenName,
  getPrimaryTokenTypeLabel,
  towCombatOverlayGetActorWoundItemCount,
  towCombatOverlayAddActorWound,
  towCombatOverlayRemoveWound,
  towCombatOverlayAddWound,
  towCombatOverlayIsShiftModifier,
  towCombatOverlayIsCtrlModifier,
  isTooltipsEnabled: () => panelTooltipVisibilityService.isControlPanelTooltipsEnabled(),
  showClickBehaviorText: () => panelTooltipVisibilityService.showControlPanelTooltipClickBehaviorText(),
  canShowNameTooltip: () => panelTooltipVisibilityService.isControlPanelNameTooltipEnabled(),
  canShowStatsTooltip: () => panelTooltipVisibilityService.isControlPanelStatsTooltipEnabled(),
  canShowStatusesTooltip: () => panelTooltipVisibilityService.isControlPanelStatusesTooltipEnabled(),
  canShowWoundsTooltip: () => panelTooltipVisibilityService.isControlPanelWoundsTooltipEnabled()
});
const panelSelectionSyncService = createPanelSelectionSyncService({
  updateSelectionDisplay: (panelElement) => panelSelectionSyncDisplayService.updateSelectionDisplay(panelElement)
});
const panelSlotRenderService = createPanelSlotRenderService({
  resolveDynamicGridLayout,
  createPanelSlotElement: (slotIndex) => panelSlotBindingService.createPanelSlotElement(slotIndex),
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
  showItemRarity: () => isTowCombatOverlayDisplaySettingEnabled(MODULE_SETTINGS.controlPanelEnableItemsRarity, true),
  showClickBehaviorText: () => panelTooltipVisibilityService.showControlPanelTooltipClickBehaviorText(),
  updatePanelSlotDamageBadge,
  panelMainGridMinColumns: PANEL_MAIN_GRID_MIN_COLUMNS,
  panelMainGridMinRows: PANEL_MAIN_GRID_MIN_ROWS
});
const panelTargetPickService = createPanelTargetPickService({
  panelId: PANEL_ID,
  topPanelId: TOP_PANEL_ID,
  pickCursor: PANEL_ATTACK_PICK_CURSOR,
  getControlPanelState: () => panelContextAccessService.getControlPanelState(),
  hideStatusTooltip,
  showOverlayTooltip,
  copyPoint: towCombatOverlayCopyPoint,
  tokenAtPoint: towCombatOverlayTokenAtPoint,
  isAltModifier: towCombatOverlayIsAltModifier,
  runPanelAttackOnTarget: (sourceToken, targetToken, attackItem, options) => (
    panelActionExecutionService.runPanelAttackOnTarget(sourceToken, targetToken, attackItem, options)
  ),
  runPanelAimAction: (actor, sourceToken, options) => panelActionExecutionService.runPanelAimAction(actor, sourceToken, options),
  runPanelHelpAction: (actor, sourceToken, options) => panelActionExecutionService.runPanelHelpAction(actor, sourceToken, options)
});
const panelActionExecutionService = createPanelActionExecutionService({
  getOverlayAutomationRef: () => towCombatOverlayAutomation ?? createTowCombatOverlayAutomationCoordinator(),
  panelStaggerPatchDurationMs: PANEL_STAGGER_PATCH_DURATION_MS,
  autoApplyWaitMs: AUTO_APPLY_WAIT_MS,
  opposedLinkWaitMs: OPPOSED_LINK_WAIT_MS,
  autoDefenceWaitMs: AUTO_DEFENCE_WAIT_MS,
  setupAbilityTestWithDamage: towCombatOverlaySetupAbilityTestWithDamage,
  rollSkill: towCombatOverlayRollSkill,
  armAutoSubmitActionSkillDialog: (actor, skill) => panelActionFlowService.armAutoSubmitActionSkillDialog(actor, skill),
  runDefaultPanelActorAction: (actor, actionKey) => panelActionFlowService.runDefaultPanelActorAction(actor, actionKey),
  getSystemAdapter: () => getTowCombatOverlaySystemAdapter(),
  createRollContext: createTowCombatOverlayRollContext,
  armApplyRollModifiersToNextTestDialog: (actor, options) => (
    panelActionFlowService.armApplyRollModifiersToNextTestDialog(actor, options)
  ),
  armAutoPickFirstHelpSkillDialog: (actor) => panelActionFlowService.armAutoPickFirstHelpSkillDialog(actor)
});
const panelSlotClickService = createPanelSlotClickService({
  panelId: PANEL_ID,
  panelUnarmedActionId: PANEL_UNARMED_ACTION_ID,
  parsePanelButtonKey,
  getSingleControlledActor: () => panelContextAccessService.getSingleControlledActor(),
  getSingleControlledToken: () => panelContextAccessService.getSingleControlledToken(),
  canEditActor: towCombatOverlayCanEditActor,
  warnNoPermission: towCombatOverlayWarnNoPermission,
  isAltModifier: towCombatOverlayIsAltModifier,
  isShiftModifier: towCombatOverlayIsShiftModifier,
  isCtrlModifier: towCombatOverlayIsCtrlModifier,
  clearPanelAttackPickMode: () => panelTargetPickService.clearPickMode(),
  startPanelAimPickMode: (panelElement, slotElement, sourceToken, originEvent, options) => (
    panelTargetPickService.startAimPickMode(panelElement, slotElement, sourceToken, originEvent, options)
  ),
  startPanelHelpPickMode: (panelElement, slotElement, sourceToken, originEvent, options) => (
    panelTargetPickService.startHelpPickMode(panelElement, slotElement, sourceToken, originEvent, options)
  ),
  startPanelAttackPickMode: (panelElement, slotElement, sourceToken, attackItem, originEvent, options) => (
    panelTargetPickService.startAttackPickMode(panelElement, slotElement, sourceToken, attackItem, originEvent, options)
  ),
  runPanelAimAction: (actor, sourceToken, options) => panelActionExecutionService.runPanelAimAction(actor, sourceToken, options),
  runPanelHelpAction: (actor, sourceToken, options) => panelActionExecutionService.runPanelHelpAction(actor, sourceToken, options),
  resetPanelAccumulatePowerValues: (actor) => panelSpellAutoApplyService.resetPanelAccumulatePowerValues(actor),
  resolveActorMiscastState: (actor) => panelSpellSupportService.resolveActorMiscastState(actor),
  runPanelAccumulatePowerAction: (actor, options) => panelActionFlowService.runPanelAccumulatePowerAction(actor, options),
  runPanelActorAction: (actor, actionKey, options) => panelActionFlowService.runPanelActorAction(actor, actionKey, options),
  runPanelRecoverAction: (actor, subAction, options) => panelActionFlowService.runPanelRecoverAction(actor, subAction, options),
  runPanelManoeuvreAction: (actor, subAction, options) => panelActionFlowService.runPanelManoeuvreAction(actor, subAction, options),
  spellRequiresTargetPick: (spell) => panelSpellSupportService.spellRequiresTargetPick(spell),
  withTemporaryUserTargets: (targetToken, callback) => panelActionExecutionService.withTemporaryUserTargets(targetToken, callback),
  runPanelCastSpecificSpellFromAccumulatedPower: (actor, spell, options) => (
    panelSpellAutoApplyService.runPanelCastSpecificSpellFromAccumulatedPower(actor, spell, options)
  ),
  spellTargetsSelf: (spell) => panelSpellSupportService.spellTargetsSelf(spell),
  updateSelectionDisplay: (panelElement) => panelSelectionSyncDisplayService.updateSelectionDisplay(panelElement),
  withTemporaryPanelUnarmedAbility: (actor, callback) => panelUnarmedLifecycleService.withTemporaryPanelUnarmedAbility(actor, callback),
  setupAbilityTestWithDamage: towCombatOverlaySetupAbilityTestWithDamage,
  runPanelUnarmedAttackOnTarget: (sourceToken, targetToken, attackItem, options) => (
    panelActionExecutionService.runPanelUnarmedAttackOnTarget(sourceToken, targetToken, attackItem, options)
  ),
  ensurePanelAttackResourceStateBeforeUse: (actor, attackItem) => (
    panelAttackResourceService.ensurePanelAttackResourceStateBeforeUse(actor, attackItem)
  ),
  resolvePanelAttackAmmoState,
  writePanelAttackAmmoState,
  runPanelAttackOnTarget: (sourceToken, targetToken, attackItem, options) => (
    panelActionExecutionService.runPanelAttackOnTarget(sourceToken, targetToken, attackItem, options)
  )
});
const panelActionFlowService = createPanelActionFlowService({
  withPatchedActionSkillTestContext: (actor, callback) => withPatchedPanelActionSkillTestContext(actor, callback, {
    createRollContext: createTowCombatOverlayRollContext
  }),
  getTowCombatOverlayActorRollModifierFields,
  towCombatOverlayArmAutoSubmitDialog,
  towCombatOverlayDefenceActor,
  getTowCombatOverlaySystemAdapter: () => getTowCombatOverlaySystemAdapter(),
  createTowCombatOverlayRollContext,
  moduleNotifications: MODULE_NOTIFICATIONS
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
  resolvePanelCastingLore: (actor) => panelActionFlowService.resolvePanelCastingLore(actor),
  normalizeDescriptionSource
});
const panelSpellAutoApplyService = createPanelSpellAutoApplyService({
  getOverlayAutomationRef: () => towCombatOverlayAutomation ?? createTowCombatOverlayAutomationCoordinator(),
  panelStaggerPatchDurationMs: PANEL_STAGGER_PATCH_DURATION_MS,
  autoApplyWaitMs: AUTO_APPLY_WAIT_MS,
  armAutoResolveSpellTriggeredTestDialogs: (actor = null, { timeoutMs, matches } = {}) => (
    panelSpellSupportService.armAutoResolveSpellTriggeredTestDialogs(actor, { timeoutMs, matches })
  ),
  spellRequiresTargetPick: (spell) => panelSpellSupportService.spellRequiresTargetPick(spell),
  spellTargetsSelf: (spell) => panelSpellSupportService.spellTargetsSelf(spell),
  withTemporaryUserTargets: (targetToken, callback) => panelActionExecutionService.withTemporaryUserTargets(targetToken, callback),
  startPanelAttackPickMode: (panelElement, slotElement, sourceToken, attackItem, originEvent, options) => (
    panelTargetPickService.startAttackPickMode(panelElement, slotElement, sourceToken, attackItem, originEvent, options)
  ),
  resolveActorLatestCastingPotency: (actor) => panelActionEntriesService.resolveActorLatestCastingPotency(actor),
  ensurePanelItemUseRollCompatibility: () => panelSpellSupportService.ensurePanelItemUseRollCompatibility(),
  towCombatOverlayApplyRollVisibility,
  armApplyRollModifiersToNextTestDialog: (actor, options) => (
    panelActionFlowService.armApplyRollModifiersToNextTestDialog(actor, options)
  ),
  towCombatOverlayArmAutoSubmitDialog,
  createTowCombatOverlayRollContext
});
const panelSlotsLayoutService = createPanelSlotsLayoutService({
  iconSrcWound: ICON_SRC_WOUND,
  escapePanelHtml,
  buildPanelItemGroupsForActor,
  getPanelActionEntries: (actor) => panelActionEntriesService.getPanelActionEntries(actor),
  getPanelManoeuvreSubActionEntries: () => panelActionEntriesService.getPanelManoeuvreSubActionEntries(),
  getPanelRecoverActionEntries: () => panelActionEntriesService.getPanelRecoverActionEntries(),
  isPanelGeneratedUnarmedItem: (item) => panelUnarmedLifecycleService.isPanelGeneratedUnarmedItem(item),
  resolveTemporaryEffectDescription,
  panelFallbackItemIcon: PANEL_FALLBACK_ITEM_ICON,
  panelUnarmedActionId: PANEL_UNARMED_ACTION_ID,
  panelActionIconByKey: PANEL_ACTION_ICON_BY_KEY,
  resolvePanelButtonOrderScope,
  getControlPanelState: () => panelContextAccessService.getControlPanelState(),
  toPanelButtonKey,
  getDefaultPanelButtonKeyOrder: () => panelReorderService.getDefaultPanelButtonKeyOrder(),
  parsePanelButtonKey,
  isSyntheticEmptySlotKey,
  readSavedPanelButtonKeyOrder,
  updateGroupSlots: (panelElement, groupKey, groupItems, actor) => (
    panelSlotRenderService.updateGroupSlots(panelElement, groupKey, groupItems, actor)
  )
});
const panelSelectionSyncDisplayService = createPanelSelectionSyncDisplayService({
  getControlPanelState: () => panelContextAccessService.getControlPanelState(),
  clearPanelAttackPickMode: () => panelTargetPickService.clearPickMode(),
  getPrimaryTokenIconSrc,
  getPrimaryTokenName,
  towCombatOverlayGetResilienceValue,
  towCombatOverlayGetWoundCount,
  getSpeedLabel,
  actorHasMagicCasting,
  formatStatNumber,
  formatWoundsWithMax,
  formatMiscastDiceValue,
  updatePanelSlots: (panelElement, token) => panelSlotsLayoutService.updatePanelSlots(panelElement, token),
  updateStatusDisplay: (panelElement, token) => panelStatusDisplayService.updateStatusDisplay(panelElement, token),
  updateActionControlsDisplay: (panelElement, token) => panelActionControlsService.updateActionControlsDisplay(panelElement, token),
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
  getControlPanelState: () => panelContextAccessService.getControlPanelState(),
  readSavedPanelButtonKeyOrder,
  writeSavedPanelButtonKeyOrder,
  parsePanelButtonKey,
  toPanelButtonKey,
  reorderableGroupKeys: PANEL_REORDERABLE_GROUP_KEYS,
  panelUnarmedActionId: PANEL_UNARMED_ACTION_ID
});
const panelAttackResourceService = createPanelAttackResourceService({
  towCombatOverlayArmAutoSubmitDialog,
  armApplyRollModifiersToNextTestDialog: (actor, options) => (
    panelActionFlowService.armApplyRollModifiersToNextTestDialog(actor, options)
  ),
  withPatchedActionSkillTestContext: (actor, callback) => withPatchedPanelActionSkillTestContext(actor, callback, {
    createRollContext: createTowCombatOverlayRollContext
  }),
  getTowCombatOverlaySystemAdapter: () => getTowCombatOverlaySystemAdapter(),
  createTowCombatOverlayRollContext,
  resolvePanelAttackAmmoState,
  writePanelAttackAmmoState
});
const panelSlotBindingService = createPanelSlotBindingService({
  getControlPanelState: () => panelContextAccessService.getControlPanelState(),
  canReorderButtons: () => isTowCombatOverlayDisplaySettingEnabled(MODULE_SETTINGS.controlPanelEnableButtonsDragDrop, false),
  canShowSlotTooltip: (slotElement) => panelTooltipVisibilityService.canShowControlPanelSlotTooltip(slotElement),
  isMainActionPanelSlot: (slotElement) => panelReorderService.isMainActionPanelSlot(slotElement),
  getSlotPanelButtonKey: (slotElement) => panelReorderService.getSlotPanelButtonKey(slotElement),
  movePanelButtonKeyBeforeTarget: (sourceKey, targetKey, panelElement) => (
    panelReorderService.movePanelButtonKeyBeforeTarget(sourceKey, targetKey, panelElement)
  ),
  handlePanelSlotClick: (slotElement, event) => panelSlotClickService.handleSlotClick(slotElement, event),
  updateSelectionDisplay: (panelElement) => panelSelectionSyncDisplayService.updateSelectionDisplay(panelElement),
  hideStatusTooltip,
  showOverlayTooltip
});
const panelDomLifecycleService = createPanelDomLifecycleService({
  panelId: PANEL_ID,
  panelSelectionId: PANEL_SELECTION_ID,
  panelStateKey: PANEL_STATE_KEY,
  panelViewportMarginPx: PANEL_VIEWPORT_MARGIN_PX,
  panelSelectionGapPx: PANEL_SELECTION_GAP_PX,
  getControlPanelState: () => panelContextAccessService.getControlPanelState(),
  removeStaleControlPanels,
  createControlPanelElement: () => panelElementFactoryService.createControlPanelElement(),
  applyInitialPanelPosition,
  syncSelectionPanelPosition,
  bindPanelActionControls: (panelElement) => panelActionControlsService.bindPanelActionControls(panelElement, {
    onUpdated: () => panelSelectionSyncDisplayService.updateSelectionDisplay(panelElement)
  }),
  bindSelectionPanelStatEvents: (selectionPanelElement) => (
    panelStatsStatusBindingsService.bindSelectionPanelStatEvents(selectionPanelElement)
  ),
  bindSelectionNameTooltipEvent: (selectionPanelElement) => (
    panelStatsStatusBindingsService.bindSelectionNameTooltipEvent(selectionPanelElement)
  ),
  bindPanelStatusesTooltipEvents: (panelElement) => panelStatsStatusBindingsService.bindPanelStatusesTooltipEvents(panelElement),
  bindControlPanelDrag,
  isPanelDragEnabled: () => !isControlPanelAlwaysCenteredEnabled() && !isControlPanelLockedEnabled(),
  applyPanelPositionWithSelectionClamp,
  writeSavedPanelPosition,
  bindPanelSelectionSync: (controlPanelState, panelElement) => (
    panelSelectionSyncService.bindSelectionSync(controlPanelState, panelElement)
  ),
  clearPanelAttackPickMode: () => panelTargetPickService.clearPickMode(),
  panelSelectionSyncService
});

export async function towCombatOverlayEnsureControlPanel() {
  if (!canTowCombatOverlayUserViewControl(MODULE_SETTINGS.controlPanelMinimumRole, "all")) {
    panelDomLifecycleService.removeControlPanel();
    return;
  }
  await panelDomLifecycleService.ensureControlPanel();
}

export function towCombatOverlayRemoveControlPanel() {
  panelDomLifecycleService.removeControlPanel();
}
