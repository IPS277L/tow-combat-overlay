import {
  towCombatOverlayAddWound,
  towCombatOverlayGetActorWoundItemCount,
  towCombatOverlayGetResilienceValue,
  towCombatOverlayGetWoundCount,
  towCombatOverlayRemoveWound
} from "../layout/wound-state.js";
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
} from "./state.js";
import {
  applyInitialPanelPosition,
  applyPanelPosition,
  applyPanelPositionWithSelectionClamp,
  syncSelectionPanelPosition
} from "./position.js";
import { bindPanelTooltipEvent } from "./tooltip.js";
import {
  escapePanelHtml,
  normalizeItemDescription,
  resolvePanelAttackSpecialPropertyMarkup,
  resolvePanelAttackSpecialPropertyText,
  resolveTemporaryEffectDescription
} from "./description.js";
import {
  actorHasMagicCasting,
  formatMiscastDiceValue,
  formatStatNumber,
  formatWoundsWithMax,
  getPrimaryTokenIconSrc,
  getPrimaryTokenName,
  getPrimaryTokenTypeLabel,
  getSpeedLabel
} from "./selection-display.js";
import {
  getPanelItemGroupsForActor as buildPanelItemGroupsForActor,
  resolveDynamicGridLayout
} from "./item-groups.js";
import {
  bindControlPanelDrag,
  removeStaleControlPanels
} from "./drag.js";
import {
  getActorEffectsByStatus,
  getActorStatusSet,
  getAllConditionEntries,
  getConditionTooltipData,
  updatePanelWoundActionIndicator
} from "./status.js";
import { createPanelActionControlsService } from "./action-controls.js";
import { createPanelStatsStatusBindingsService } from "./stats-status-bindings.js";
import { createPanelSelectionSyncService } from "./selection-sync.js";
import { createPanelSlotRenderService } from "./slot-render.js";
import { createPanelTargetPickService } from "./target-pick.js";
import { withPatchedPanelActionSkillTestContext } from "./action-test-context.js";
import { createPanelActionExecutionService } from "./action-execution.js";
import { createPanelSlotClickService } from "./slot-click.js";
import { createPanelActionFlowService } from "./action-flow.js";
import { createPanelSpellAutoApplyService } from "./spell-auto-apply.js";
import { createPanelSlotsLayoutService } from "./slots-layout.js";
import { createPanelSelectionSyncDisplayService } from "./selection-sync-display.js";
import { createPanelReorderService } from "./reorder.js";
import { createPanelAttackResourceService } from "./attack-resource.js";
import { createPanelActionEntriesService } from "./action-entries.js";
import { createPanelSlotBindingService } from "./slot-binding.js";
import { createPanelDomLifecycleService } from "./dom-lifecycle.js";
import { createPanelBaseServices } from "./base-services.js";
import { createPanelStatusDisplayService } from "./status-display.js";

const PANEL_ID = "tow-combat-overlay-control-panel";
const PANEL_SELECTION_ID = "tow-combat-overlay-selection-panel";
const PANEL_TEMPLATE_PATH = "modules/tow-combat-overlay/templates/overlay/control-panel.hbs";
const PANEL_SELECTION_TEMPLATE_PATH = "modules/tow-combat-overlay/templates/overlay/control-panel-selection.hbs";
const PANEL_STATE_KEY = "__towCombatOverlayControlPanelState";
const PANEL_VIEWPORT_MARGIN_PX = 8;
const PANEL_SELECTION_GAP_PX = 0;
const PANEL_FALLBACK_ITEM_ICON = "icons/svg/item-bag.svg";
const PANEL_RESILIENCE_ICON = "icons/svg/shield.svg";
const PANEL_SPEED_ICON = "icons/svg/wingfoot.svg";
const PANEL_ROLL_ICON = "icons/svg/d20-grey.svg";
const PANEL_DICE_ICON = "icons/svg/d10-grey.svg";
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
const PANEL_ACTIONS_ORDER = ["help", "defence", "aim", "improvise", "accumulatePower"];
const PANEL_ACTION_ICON_BY_KEY = {
  aim: "icons/skills/targeting/crosshair-ringed-gray.webp",
  help: "icons/skills/social/diplomacy-handshake.webp",
  improvise: "icons/magic/time/hourglass-tilted-glowing-gold.webp",
  defence: "icons/equipment/shield/heater-wooden-antlers-blue.webp",
  accumulatePower: "icons/magic/symbols/rune-sigil-black-pink.webp",
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
  isPanelAutoDefenceEnabled: () => isPanelAutoDefenceEnabled(),
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
  armAutoResolveSpellTriggeredTestDialogs: ({ timeoutMs } = {}) => armAutoResolveSpellTriggeredTestDialogs({ timeoutMs }),
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

function isPanelAutoDefenceEnabled() {
  return panelContextAccessService.isPanelAutoDefenceEnabled();
}

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

function armAutoResolveSpellTriggeredTestDialogs({ timeoutMs = 20000 } = {}) {
  return panelSpellSupportService.armAutoResolveSpellTriggeredTestDialogs({ timeoutMs });
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
