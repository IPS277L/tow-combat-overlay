void import("./esm/bootstrap/register-module-hooks.js").then(({
  registerTowCombatOverlayModuleHooks
}) => {
    if (typeof registerTowCombatOverlayModuleHooks !== "function") {
      throw new Error("[the-old-world-combat-overlay] ES module bootstrap registrar is unavailable.");
    }
    registerTowCombatOverlayModuleHooks();
  })
  .catch((error) => {
    console.error("[the-old-world-combat-overlay] Failed to initialize ES module bootstrap.", error);
    throw error;
  });
