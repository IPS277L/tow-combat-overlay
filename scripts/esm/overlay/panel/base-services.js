import { createControlPanelSlotMetaService } from "./slot-meta.js";
import { createPanelContextAccessService } from "./context-access.js";
import { createPanelUnarmedLifecycleService } from "./unarmed-lifecycle.js";
import { createPanelConditionToggleService } from "./condition-toggle.js";
import { createPanelElementFactoryService } from "./element-factory.js";
import { createPanelSpellSupportService } from "./spell-support.js";

export function createPanelBaseServices({
  moduleId,
  moduleSettings,
  moduleKey,
  panelStateKey,
  panelTemplatePath,
  panelSelectionTemplatePath,
  panelId,
  panelSelectionId,
  iconSrcWound,
  panelResilienceIcon,
  panelSpeedIcon,
  panelRollIcon,
  panelDiceIcon,
  panelUnarmedFlagKey,
  panelActionIconByKey,
  panelFallbackItemIcon,
  panelUnarmedCleanupPollMs,
  panelUnarmedCleanupMaxWaitMs,
  panelUnarmedOpposedDiscoveryGraceMs,
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
} = {}) {
  const panelContextAccessService = createPanelContextAccessService({
    moduleId,
    moduleSettings,
    panelStateKey
  });

  const slotMeta = createControlPanelSlotMetaService({
    moduleId,
    resolvePanelAttackSpecialPropertyText
  });

  const panelUnarmedLifecycleService = createPanelUnarmedLifecycleService({
    panelUnarmedFlagKey,
    panelActionIconByKey,
    panelFallbackItemIcon,
    panelUnarmedCleanupPollMs,
    panelUnarmedCleanupMaxWaitMs,
    panelUnarmedOpposedDiscoveryGraceMs,
    canEditActor: towCombatOverlayCanEditActor,
    warnNoPermission: towCombatOverlayWarnNoPermission
  });

  const panelConditionToggleService = createPanelConditionToggleService({
    moduleKey,
    runActorOpLock,
    canEditActor: towCombatOverlayCanEditActor,
    warnNoPermission: towCombatOverlayWarnNoPermission,
    addActorCondition: towCombatOverlayAddActorCondition,
    removeActorCondition: towCombatOverlayRemoveActorCondition,
    getActorStatusSet,
    getActorEffectsByStatus
  });

  const panelElementFactoryService = createPanelElementFactoryService({
    panelTemplatePath,
    panelSelectionTemplatePath,
    panelId,
    panelSelectionId,
    iconSrcWound,
    panelResilienceIcon,
    panelSpeedIcon,
    panelRollIcon,
    panelDiceIcon,
    getAllConditionEntries,
    towCombatOverlayRenderTemplate
  });

  const panelSpellSupportService = createPanelSpellSupportService({
    towCombatOverlayArmAutoSubmitDialog,
    getTowCombatOverlayActorRollModifierFields
  });

  return {
    panelContextAccessService,
    slotMeta,
    panelUnarmedLifecycleService,
    panelConditionToggleService,
    panelElementFactoryService,
    panelSpellSupportService
  };
}
