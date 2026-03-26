export function createPanelSlotRenderService({
  resolveDynamicGridLayout,
  createPanelSlotElement,
  toPanelButtonKey,
  normalizeItemDescription,
  panelFallbackItemIcon,
  panelUnarmedActionId,
  resolvePanelAttackAmmoState,
  resolvePanelAttackDamageLabel,
  resolvePanelAttackSpecialPropertyMarkup,
  escapePanelHtml,
  updatePanelSlotAmmoBadge,
  updatePanelSlotAttackAmmoVisualState,
  updatePanelSlotAttackRarity,
  showItemRarity = () => true,
  showClickBehaviorText = () => true,
  updatePanelSlotDamageBadge,
  panelMainGridMinColumns = 7,
  panelMainGridMinRows = 2
} = {}) {
  function localize(key, fallback = "") {
    const localized = game?.i18n?.localize?.(String(key ?? ""));
    if (typeof localized === "string" && localized !== key) return localized;
    return String(fallback ?? key ?? "");
  }

  function format(key, data = {}, fallback = "") {
    const formatted = game?.i18n?.format?.(String(key ?? ""), data);
    if (typeof formatted === "string" && formatted !== key) return formatted;
    return String(fallback ?? key ?? "");
  }

  function getGroupGridElement(panelElement, groupKey) {
    return panelElement.querySelector(
      `.tow-combat-overlay-control-panel__group-grid[data-item-group="${groupKey}"]`
    ) ?? panelElement.querySelector(
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
    const groupElement = gridElement.closest(".tow-combat-overlay-control-panel__item-group");
    const isStatusStripAbilities = gridElement.classList.contains("tow-combat-overlay-control-panel__status-abilities")
      || (groupElement instanceof HTMLElement
        && groupElement.classList.contains("tow-combat-overlay-control-panel__status-abilities"));

    if (groupKey === "topChips") {
      const count = Math.max(0, Math.trunc(Number(slotCount) || 0));
      const cols = Math.max(1, Math.min(12, count || 1));
      gridElement.style.display = "flex";
      gridElement.style.flexWrap = "wrap-reverse";
      gridElement.style.gap = "var(--tow-control-panel-gap)";
      gridElement.style.width = `calc((${cols} * var(--tow-control-panel-slot-size)) + ((${cols} - 1) * var(--tow-control-panel-gap)))`;
      gridElement.style.maxWidth = gridElement.style.width;
      gridElement.style.justifyContent = "flex-start";
      gridElement.style.alignContent = "flex-start";
      return;
    }

    if (isStatusStripAbilities) {
      const count = Math.max(1, Math.trunc(Number(slotCount) || 1));
      gridElement.style.gridTemplateColumns = `repeat(${count}, var(--tow-control-panel-slot-size))`;
      gridElement.style.gridTemplateRows = "repeat(1, var(--tow-control-panel-slot-size))";
      gridElement.style.gridAutoFlow = "column";
      return;
    }

    if (groupKey === "all") {
      const { columns, rows } = resolveDynamicGridLayout(slotCount);
      const minColumns = Math.max(1, panelMainGridMinColumns);
      const minRows = Math.max(1, panelMainGridMinRows);
      gridElement.style.gridTemplateColumns = `repeat(${Math.max(columns, minColumns)}, var(--tow-control-panel-slot-size))`;
      gridElement.style.gridTemplateRows = `repeat(${Math.max(rows, minRows)}, var(--tow-control-panel-slot-size))`;
      gridElement.style.gridAutoFlow = "column";
      return;
    }

    if (Number(slotCount) === 1) {
      gridElement.style.gridTemplateColumns = "repeat(1, var(--tow-control-panel-slot-size))";
      gridElement.style.gridTemplateRows = "repeat(1, var(--tow-control-panel-slot-size))";
      gridElement.style.gridAutoFlow = "column";
      return;
    }

    const { columns, rows } = resolveDynamicGridLayout(slotCount);
    gridElement.style.gridTemplateColumns = `repeat(${columns}, var(--tow-control-panel-slot-size))`;
    gridElement.style.gridTemplateRows = `repeat(${rows}, var(--tow-control-panel-slot-size))`;
    gridElement.style.gridAutoFlow = "column";
  }

  function updateGroupSlots(panelElement, groupKey, groupItems = [], actor = null) {
    const rarityEnabled = (typeof showItemRarity === "function") ? !!showItemRarity() : true;
    const includeClickBehaviorText = (typeof showClickBehaviorText === "function") ? !!showClickBehaviorText() : true;
    const groupElement = panelElement.querySelector(
      `.tow-combat-overlay-control-panel__item-group[data-item-group="${groupKey}"]`
    ) ?? getGroupGridElement(panelElement, groupKey);
    if (groupElement instanceof HTMLElement) {
      groupElement.style.display = (groupItems.length > 0) ? "" : "none";
    }

    if (groupItems.length <= 0) {
      ensureGroupSlotElements(panelElement, groupKey, 0);
      return;
    }

    applyGroupGridLayout(panelElement, groupKey, groupItems.length);
    let renderSlotCount = groupItems.length;
    if (groupKey === "all" && groupItems.length > 0) {
      const { columns, rows } = resolveDynamicGridLayout(groupItems.length);
      renderSlotCount = Math.max(
        groupItems.length,
        columns * rows,
        Math.max(1, panelMainGridMinColumns) * Math.max(1, panelMainGridMinRows)
      );
    }
    const slotElements = ensureGroupSlotElements(panelElement, groupKey, renderSlotCount);
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

      if (!item || item.__empty === true) {
        const emptyGroupKey = String(item?.panelGroup ?? groupKey ?? "").trim() || groupKey;
        const emptyOrderKey = String(item?.panelButtonKey ?? "").trim() || toPanelButtonKey(emptyGroupKey, `empty-slot-${index}`);
        slotElement.dataset.itemType = "empty";
        slotElement.dataset.itemGroup = emptyGroupKey;
        slotElement.dataset.itemId = "";
        slotElement.dataset.itemName = "";
        slotElement.dataset.itemOrderKey = emptyOrderKey;
        slotElement.dataset.itemTopChipType = "";
        slotElement.dataset.itemTopChipActive = "";
        slotElement.dataset.tooltipTitle = "";
        slotElement.dataset.tooltipDescription = "";
        slotElement.classList.remove("is-top-chip-wound-active");
        slotElement.setAttribute("aria-label", `Slot ${index + 1}`);
        image.src = "";
        image.alt = "";
        image.style.display = "none";
        if (iconPlaceholder instanceof HTMLElement) iconPlaceholder.style.display = "";
        updatePanelSlotAmmoBadge(slotElement, null, emptyGroupKey);
        updatePanelSlotAttackAmmoVisualState(slotElement, null, emptyGroupKey, actor);
        if (rarityEnabled) updatePanelSlotAttackRarity(slotElement, null, emptyGroupKey);
        else {
          delete slotElement.dataset.attackRarity;
          const existingBadge = slotElement.querySelector(".tow-combat-overlay-control-panel__slot-property");
          if (existingBadge instanceof HTMLElement) existingBadge.style.display = "none";
        }
        updatePanelSlotDamageBadge(slotElement, null, emptyGroupKey);
        continue;
      }

      const resolvedGroupKey = String(item?.panelGroup ?? groupKey ?? "").trim() || groupKey;
      const itemName = String(item?.name ?? `Item ${index + 1}`).trim();
      const itemDescription = normalizeItemDescription(item);
      const itemImage = String(item?.img ?? "").trim() || panelFallbackItemIcon;
      slotElement.dataset.itemType = "item";
      slotElement.dataset.itemGroup = resolvedGroupKey;
      slotElement.dataset.itemId = String(item?.id ?? "");
      slotElement.dataset.itemName = itemName;
      slotElement.dataset.itemOrderKey = String(item?.panelButtonKey ?? toPanelButtonKey(resolvedGroupKey, item?.id));
      slotElement.dataset.itemTopChipType = String(item?.panelTopChipType ?? "");
      slotElement.dataset.itemTopChipActive = String(item?.panelTopChipActive === true);
      slotElement.dataset.tooltipTitle = itemName;
      const isTopChipWoundActive = (
        resolvedGroupKey === "topChips"
        && String(item?.panelTopChipType ?? "") === "woundActions"
        && item?.panelTopChipActive === true
      );
      slotElement.classList.toggle("is-top-chip-wound-active", isTopChipWoundActive);
      const itemKey = String(item?.id ?? "").trim().toLowerCase();
      if (resolvedGroupKey === "attacks") {
        const attackHint = includeClickBehaviorText
          ? (itemKey === panelUnarmedActionId
          ? localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.AttackUnarmed", "<em>Left click: pick target then auto-roll unarmed attack (Brawn vs Endurance) · Shift+click: self auto-roll · Alt+click: pick target then open default attack dialog · Alt+Shift+click: open default self-roll dialog</em>")
          : localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.AttackWeapon", "<em>Left click: pick target then auto-roll attack · Shift+click: auto-roll self attack · Alt+click: pick target then open default Foundry attack dialog (no auto-roll) · Alt+Shift+click: open default Foundry self-roll dialog (no auto-roll) · Ctrl+click: instantly reload this weapon (ranged weapons with reload flow only)</em>"))
          : "";
        const attackAmmoState = resolvePanelAttackAmmoState(item);
        const reloadProgressHint = (attackAmmoState.isRanged && attackAmmoState.usesReloadFlow && attackAmmoState.current <= 0)
          ? `<br><br>${format("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.ReloadProgress", {
            current: Math.max(0, attackAmmoState.reloadProgress),
            target: Math.max(1, attackAmmoState.reloadTarget)
          }, `Reload progress: ${Math.max(0, attackAmmoState.reloadProgress)} / ${Math.max(1, attackAmmoState.reloadTarget)} successes.`)}`
          : "";
        const attackDamageLabel = resolvePanelAttackDamageLabel(item);
        const damageHint = attackDamageLabel
          ? `<br><br><strong>${localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.DamageLabel", "Damage")}:</strong> ${escapePanelHtml(attackDamageLabel)}`
          : "";
        const specialPropertyMarkup = resolvePanelAttackSpecialPropertyMarkup(item);
        const specialPropertyHint = specialPropertyMarkup
          ? `<br><br><strong>${localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.ExtraPropertiesLabel", "Extra properties")}:</strong><br>${specialPropertyMarkup}`
          : "";
        const hasDistinctDescription = !!itemDescription && (
          !specialPropertyMarkup
          || !itemDescription.includes(specialPropertyMarkup)
        );
        slotElement.dataset.tooltipDescription = hasDistinctDescription
          ? `${attackHint}${damageHint}${reloadProgressHint}${specialPropertyHint}<br><br>${itemDescription}`
          : `${attackHint}${damageHint}${reloadProgressHint}${specialPropertyHint}`;
      } else if (resolvedGroupKey === "actions") {
        let actionsHint = includeClickBehaviorText
          ? localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.ActionDefault", "<em>Left click: auto-flow action (auto-roll and auto-pick first) · Alt+click: default Foundry action dialogs</em>")
          : "";
        if (itemKey === "aim" && includeClickBehaviorText) {
          actionsHint = localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.ActionAim", "<em>Left click: pick target then auto-roll · Shift+click: self auto-roll · Alt+click: pick target then manual dialog · Alt+Shift+click: self manual dialog</em>");
        } else if (itemKey === "help" && includeClickBehaviorText) {
          actionsHint = localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.ActionHelp", "<em>Left click: pick target then auto-flow · Shift+click: self auto-flow · Alt+click: pick target then manual dialogs · Alt+Shift+click: self manual dialogs</em>");
        } else if (itemKey === "improvise" && includeClickBehaviorText) {
          actionsHint = localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.ActionImprovise", "<em>Left click: auto-pick first skill and auto-roll · Alt+click: manual skill selection and dialogs</em>");
        } else if (itemKey === "defence" && includeClickBehaviorText) {
          actionsHint = localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.ActionDefence", "<em>Left click: auto defence · Alt+click: manual defence selection dialog</em>");
        } else if (itemKey === "accumulatepower") {
          const miscastReady = item?.system?.miscastReady === true;
          actionsHint = includeClickBehaviorText
            ? (miscastReady
            ? localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.ActionAccumulatePowerReady", "<em>Left click: roll on the miscast table · Ctrl+click: reset accumulated and potency values to 0</em>")
            : localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.ActionAccumulatePowerBuild", "<em>Left click: auto-roll casting test with current roll modifiers to accumulate power · Alt+click: open default manual casting dialog · Ctrl+click: reset accumulated and potency values to 0</em>"))
            : "";
          const accumulatedRaw = Number(item?.system?.accumulatedPower ?? NaN);
          const accumulated = Number.isFinite(accumulatedRaw) ? Math.max(0, Math.trunc(accumulatedRaw)) : 0;
          const potencyRaw = Number(item?.system?.potency ?? NaN);
          const potency = Number.isFinite(potencyRaw) ? Math.max(0, Math.trunc(potencyRaw)) : 0;
          const miscastsRaw = Number(item?.system?.miscasts ?? NaN);
          const miscasts = Number.isFinite(miscastsRaw) ? Math.max(0, Math.trunc(miscastsRaw)) : 0;
          const miscastsMaxRaw = Number(item?.system?.miscastsMax ?? NaN);
          const miscastsMax = Number.isFinite(miscastsMaxRaw) ? Math.max(0, Math.trunc(miscastsMaxRaw)) : 0;
          const statsHint = [
            `<strong>${localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.AccumulatedLabel", "Accumulated")}:</strong> ${accumulated}`,
            `<strong>${localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.PotencyLabel", "Potency")}:</strong> ${potency}`,
            `<strong>${localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.MiscastLabel", "Miscast")}:</strong> ${miscastsMax > 0 ? `${miscasts}/${miscastsMax}` : miscasts}`
          ].join("<br>");
          actionsHint = `${actionsHint}<br><br>${statsHint}`;
        }
        slotElement.dataset.tooltipDescription = itemDescription ? `${actionsHint}<br><br>${itemDescription}` : actionsHint;
      } else if (resolvedGroupKey === "recover") {
        const recoverHint = includeClickBehaviorText
          ? ((itemKey === "recover")
          ? localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.RecoverMain", "<em>Left click: run Recover with auto flow</em>")
          : localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.Recover", "<em>Left click: run selected Recover action with auto flow · Alt+click: open manual dialogs for the selected Recover action</em>"))
          : "";
        slotElement.dataset.tooltipDescription = itemDescription
          ? `${recoverHint}<br><br>${itemDescription}`
          : recoverHint;
      } else if (resolvedGroupKey === "manoeuvre") {
        const manoeuvreHint = includeClickBehaviorText
          ? localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.Manoeuvre", "<em>Left click: auto-roll manoeuvre checks (no dialogs) · Alt+click: default Foundry manoeuvre flow (with dialogs)</em>")
          : "";
        slotElement.dataset.tooltipDescription = itemDescription
          ? `${manoeuvreHint}<br><br>${itemDescription}`
          : manoeuvreHint;
      } else if (resolvedGroupKey === "temporaryEffects") {
        const infoHint = includeClickBehaviorText
          ? localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.TemporaryEffects", "<em>Right click: remove temporary effect.</em>")
          : "";
        slotElement.dataset.tooltipDescription = itemDescription
          ? `${infoHint}<br><br>${itemDescription}`
          : infoHint;
      } else if (resolvedGroupKey === "abilities") {
        const abilitiesHint = includeClickBehaviorText
          ? localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.Abilities", "<em>Left click: show details.</em>")
          : "";
        slotElement.dataset.tooltipDescription = itemDescription
          ? `${abilitiesHint}<br><br>${itemDescription}`
          : abilitiesHint;
      } else if (resolvedGroupKey === "topChips") {
        const topChipType = String(item?.panelTopChipType ?? "").trim();
        if (topChipType === "temporaryEffects") {
          const infoHint = includeClickBehaviorText
            ? localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.TemporaryEffects", "<em>Right click: remove temporary effect.</em>")
            : "";
          slotElement.dataset.tooltipDescription = itemDescription
            ? `${infoHint}<br><br>${itemDescription}`
            : infoHint;
        } else if (topChipType === "abilities") {
          const abilitiesHint = includeClickBehaviorText
            ? localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.Abilities", "<em>Left click: show details.</em>")
            : "";
          slotElement.dataset.tooltipDescription = itemDescription
            ? `${abilitiesHint}<br><br>${itemDescription}`
            : abilitiesHint;
        } else {
          slotElement.dataset.tooltipDescription = itemDescription;
        }
      } else if (resolvedGroupKey === "magic") {
        const magicHint = includeClickBehaviorText
          ? localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.Magic", "<em>Left click: cast and auto-process Apply buttons (with target pick when needed) · Shift+click: same cast flow, but using only currently selected targets (no target pick mode, no self fallback) · Alt+click: pick target then cast manually (no auto-apply)</em>")
          : "";
        const magicDamageLabel = resolvePanelAttackDamageLabel(item) || "0";
        const hasMagicPotency = item?.system?.damage?.potency === true;
        const targetKey = String(item?.system?.target?.value ?? "").trim();
        const targetCustom = String(item?.system?.target?.custom ?? "").trim();
        const targetLabel = targetKey
          ? String(game?.oldworld?.config?.target?.[targetKey] ?? targetKey).trim()
          : targetCustom;
        const durationKey = String(item?.system?.duration?.value ?? "").trim();
        const durationCustom = String(item?.system?.duration?.custom ?? "").trim();
        const durationLabel = durationKey
          ? String(game?.oldworld?.config?.duration?.[durationKey] ?? durationKey).trim()
          : durationCustom;
        const magicDamageHint = magicDamageLabel
          ? `<strong>${localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.DamageLabel", "Damage")}:</strong> ${escapePanelHtml(magicDamageLabel)}`
          : "";
        const magicPotencyHint = hasMagicPotency
          ? `<strong>${localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.PotencyLabel", "Potency")}:</strong> ${localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.YesValue", "Yes")}`
          : "";
        const magicTargetHint = targetLabel
          ? `<strong>${localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.TargetLabel", "Target")}:</strong> ${escapePanelHtml(targetLabel)}`
          : "";
        const magicDurationHint = durationLabel
          ? `<strong>${localize("TOWCOMBATOVERLAY.Tooltip.Panel.SlotHint.DurationLabel", "Duration")}:</strong> ${escapePanelHtml(durationLabel)}`
          : "";
        const magicStatsHint = [magicDamageHint, magicPotencyHint, magicTargetHint, magicDurationHint].filter(Boolean).join("<br>");
        const magicBlock = [magicHint, magicStatsHint].filter(Boolean).join("<br><br>");
        slotElement.dataset.tooltipDescription = magicBlock && itemDescription
          ? `${magicBlock}<br><br>${itemDescription}`
          : (magicBlock || itemDescription);
      } else {
        slotElement.dataset.tooltipDescription = itemDescription;
      }
      slotElement.dataset.tooltipDescription = String(slotElement.dataset.tooltipDescription ?? "")
        .replace(/^(?:<br><br>)+/i, "")
        .trim();
      slotElement.setAttribute("aria-label", itemName);
      image.src = itemImage;
      image.alt = itemName;
      image.style.display = "block";
      if (iconPlaceholder instanceof HTMLElement) iconPlaceholder.style.display = "none";
      updatePanelSlotAmmoBadge(slotElement, item, resolvedGroupKey);
      updatePanelSlotAttackAmmoVisualState(slotElement, item, resolvedGroupKey, actor);
      if (rarityEnabled) updatePanelSlotAttackRarity(slotElement, item, resolvedGroupKey);
      else {
        delete slotElement.dataset.attackRarity;
        const existingBadge = slotElement.querySelector(".tow-combat-overlay-control-panel__slot-property");
        if (existingBadge instanceof HTMLElement) existingBadge.style.display = "none";
      }
      updatePanelSlotDamageBadge(slotElement, item, resolvedGroupKey);
    }
  }

  return {
    updateGroupSlots
  };
}
