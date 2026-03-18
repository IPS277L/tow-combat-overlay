export function createPanelUnarmedLifecycleService({
  panelUnarmedFlagKey,
  panelActionIconByKey,
  panelFallbackItemIcon,
  panelUnarmedCleanupPollMs,
  panelUnarmedCleanupMaxWaitMs,
  panelUnarmedOpposedDiscoveryGraceMs,
  canEditActor,
  warnNoPermission
} = {}) {
  function isPanelGeneratedUnarmedItem(item) {
    return item?.getFlag?.("tow-combat-overlay", panelUnarmedFlagKey) === true;
  }

  async function withTemporaryPanelUnarmedAbility(actor, callback) {
    if (!actor || typeof callback !== "function") return null;
    if (!canEditActor(actor)) {
      warnNoPermission(actor);
      return null;
    }

    const created = await actor.createEmbeddedDocuments("Item", [{
      name: "Unarmed Attack",
      type: "ability",
      img: panelActionIconByKey.unarmed ?? panelFallbackItemIcon,
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
          [panelUnarmedFlagKey]: true
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

      while (Date.now() - startedAt < panelUnarmedCleanupMaxWaitMs) {
        const message = initialMessageId ? game?.messages?.get?.(initialMessageId) : null;
        const opposedIds = Object.values(
          message?.system?.test?.context?.opposedIds
          ?? testRef?.context?.opposedIds
          ?? {}
        )
          .map((id) => String(id ?? "").trim())
          .filter(Boolean);

        if (opposedIds.length > 0) sawOpposedIds = true;

        if (!sawOpposedIds && (Date.now() - startedAt) >= panelUnarmedOpposedDiscoveryGraceMs) {
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
        await new Promise((resolve) => setTimeout(resolve, panelUnarmedCleanupPollMs));
      }

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

  return {
    isPanelGeneratedUnarmedItem,
    withTemporaryPanelUnarmedAbility
  };
}

