void import("./esm/bootstrap/register-module-hooks.js").then(({
  registerTowCombatOverlayModuleHooks
}) => {
    if (typeof registerTowCombatOverlayModuleHooks !== "function") {
      throw new Error("[tow-combat-overlay] ES module bootstrap registrar is unavailable.");
    }
    registerTowCombatOverlayModuleHooks();
  })
  .catch((error) => {
    console.error("[tow-combat-overlay] Failed to initialize ES module bootstrap.", error);
    throw error;
  });
