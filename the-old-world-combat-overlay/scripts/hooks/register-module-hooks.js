function getTowCombatOverlayApiFromModuleOrGame() {
  const { moduleId } = getTowCombatOverlayModuleConstants();
  return game.modules.get(moduleId)?.api?.towOverlay ?? game.towOverlay ?? null;
}

function syncTowCombatOverlayEnabledSetting() {
  const { settings } = getTowCombatOverlayModuleConstants();
  const overlayApi = getTowCombatOverlayApiFromModuleOrGame();
  if (!overlayApi) return false;

  const wantsEnabled = isTowCombatOverlaySettingEnabled(settings.enableOverlay, true);
  const isEnabled = typeof overlayApi.isEnabled === "function"
    ? !!overlayApi.isEnabled()
    : !!game.towOverlay;

  if (wantsEnabled && !isEnabled && typeof overlayApi.enable === "function") {
    overlayApi.enable();
    return true;
  }

  if (!wantsEnabled && isEnabled && typeof overlayApi.disable === "function") {
    overlayApi.disable();
    return true;
  }

  return false;
}

function registerTowCombatOverlayModuleHooks() {
  Hooks.once("init", () => {
    registerTowCombatOverlaySettings();
    if (typeof globalThis.registerTowActionsApi === "function") {
      const services = typeof globalThis.getTowCombatOverlayActionServices === "function"
        ? globalThis.getTowCombatOverlayActionServices()
        : {};
      globalThis.registerTowActionsApi({
        attackActor: services.attackActor,
        castActor: services.castActor,
        defenceActor: services.defenceActor,
        runAttackForControlled: services.runAttackForControlled,
        runCastingForControlled: services.runCastingForControlled,
        runDefenceForControlled: services.runDefenceForControlled
      });
    }
    if (typeof globalThis.registerTowOverlayApi === "function") {
      globalThis.registerTowOverlayApi();
    }
  });

  Hooks.once("ready", () => {
    if (typeof globalThis.registerTowActionsApi === "function") {
      const services = typeof globalThis.getTowCombatOverlayActionServices === "function"
        ? globalThis.getTowCombatOverlayActionServices()
        : {};
      globalThis.registerTowActionsApi({
        attackActor: services.attackActor,
        castActor: services.castActor,
        defenceActor: services.defenceActor,
        runAttackForControlled: services.runAttackForControlled,
        runCastingForControlled: services.runCastingForControlled,
        runDefenceForControlled: services.runDefenceForControlled
      });
    }
    if (typeof globalThis.registerTowOverlayApi === "function") {
      globalThis.registerTowOverlayApi();
    }
    if (typeof globalThis.syncTowCombatOverlayPublicApisFromGlobals === "function") {
      globalThis.syncTowCombatOverlayPublicApisFromGlobals();
    }
    syncTowCombatOverlayEnabledSetting();
  });
}

globalThis.syncTowCombatOverlayEnabledSetting = syncTowCombatOverlayEnabledSetting;
