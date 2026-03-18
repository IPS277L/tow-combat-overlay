export function createPanelActionEntriesService({
  panelActionsOrder,
  panelActionIconByKey,
  panelManoeuvreOrder,
  panelManoeuvreIconByKey,
  panelRecoverOrder,
  panelRecoverIconByKey,
  panelFallbackItemIcon,
  actorHasMagicCasting,
  resolvePanelCastingLore,
  normalizeDescriptionSource
} = {}) {
  function localizeMaybe(key, fallback = "") {
    const localized = game?.i18n?.localize?.(String(key ?? ""));
    if (typeof localized === "string" && localized !== key) return localized;
    return String(fallback ?? key ?? "");
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

  function resolveActorLatestCastingPotency(actor) {
    const progressRaw = Number(actor?.system?.magic?.casting?.progress ?? NaN);
    const progress = Number.isFinite(progressRaw) ? Math.max(0, Math.trunc(progressRaw)) : 0;
    if (progress <= 0) return 0;

    const actorId = String(actor?.id ?? "").trim();
    const actorUuid = String(actor?.uuid ?? "").trim();
    if (!actorId && !actorUuid) return 0;

    const messages = Array.isArray(game?.messages?.contents) ? game.messages.contents : [];
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      const rollClass = String(message?.system?.context?.rollClass ?? "").trim().toLowerCase();
      if (rollClass !== "castingtest") continue;

      const speakerActorId = String(message?.speaker?.actor ?? "").trim();
      const testActorUuid = String(message?.system?.test?.context?.actor ?? message?.system?.context?.actor ?? "").trim();
      const sameActor = (actorId && speakerActorId === actorId) || (actorUuid && testActorUuid === actorUuid);
      if (!sameActor) continue;

      const potencyRaw = Number(
        message?.system?.result?.potency
        ?? message?.system?.test?.result?.potency
        ?? message?.system?.result?.successes
        ?? message?.system?.test?.result?.successes
        ?? NaN
      );
      if (!Number.isFinite(potencyRaw)) return 0;
      return Math.max(0, Math.trunc(potencyRaw));
    }
    return 0;
  }

  function getPanelActionEntries(actor = null) {
    const actionsConfig = game?.oldworld?.config?.actions ?? {};
    return panelActionsOrder
      .map((key) => {
        if (key === "accumulatePower") {
          if (!actorHasMagicCasting(actor)) return null;
          if (!resolvePanelCastingLore(actor)) return null;
          const powerRaw = Number(actor?.system?.magic?.casting?.progress ?? NaN);
          const power = Number.isFinite(powerRaw) ? Math.max(0, Math.trunc(powerRaw)) : 0;
          const potency = resolveActorLatestCastingPotency(actor);
          const miscastsRaw = Number(actor?.system?.magic?.miscasts ?? NaN);
          const miscasts = Number.isFinite(miscastsRaw) ? Math.max(0, Math.trunc(miscastsRaw)) : 0;
          const miscastsMaxRaw = Number(actor?.system?.magic?.level ?? NaN);
          const miscastsMax = Number.isFinite(miscastsMaxRaw) ? Math.max(0, Math.trunc(miscastsMaxRaw)) : 0;
          const miscastReady = miscastsMax > 0 && miscasts >= miscastsMax;
          return {
            id: key,
            name: miscastReady ? "Dispose Miscast" : "Channel the Winds of Magic",
            img: panelActionIconByKey.accumulatePower,
            system: {
              accumulatedPower: power,
              potency,
              miscasts,
              miscastsMax,
              miscastReady,
              description: miscastReady
                ? "Miscast limit reached. Click to roll the miscast table."
                : "Roll a casting test to accumulate power."
            }
          };
        }
        if (key === "defence") {
          return {
            id: key,
            name: "Defence",
            img: panelActionIconByKey.defence,
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
        const image = String(panelActionIconByKey[key] ?? action?.effect?.img ?? action?.img ?? "").trim() || panelFallbackItemIcon;
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
    const keys = panelManoeuvreOrder.filter((key) => !!subActions?.[key]);
    return keys.map((key) => {
      const entry = subActions[key] ?? {};
      const name = String(entry?.label ?? key).trim() || key;
      return {
        id: key,
        name,
        img: panelManoeuvreIconByKey[key] ?? panelFallbackItemIcon,
        system: {
          description: getCoreActionDescription(entry)
        }
      };
    });
  }

  function getPanelRecoverActionEntries() {
    const recoverAction = game?.oldworld?.config?.actions?.recover ?? {};
    const labels = {
      recover: "Recover",
      treat: "Treat Wound",
      condition: "Remove Condition"
    };

    return panelRecoverOrder.map((key) => {
      const subAction = recoverAction?.subActions?.[key] ?? null;
      const description = getCoreActionDescription(subAction ?? recoverAction);
      return {
        id: key,
        name: labels[key] ?? key,
        img: panelRecoverIconByKey[key] ?? panelFallbackItemIcon,
        system: {
          description
        }
      };
    });
  }

  return {
    getCoreActionDescription,
    resolveActorLatestCastingPotency,
    getPanelActionEntries,
    getPanelManoeuvreSubActionEntries,
    getPanelRecoverActionEntries
  };
}
