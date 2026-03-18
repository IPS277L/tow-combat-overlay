export function createControlPanelSlotMetaService({ moduleId, resolvePanelAttackSpecialPropertyText }) {
  function resolvePanelAttackAmmoMeta(item) {
    if (!item) return { isRanged: false, ammoMax: 1, reloadTarget: 0, usesReloadFlow: false };
    const attackSkill = String(item?.system?.attack?.skill ?? "").trim().toLowerCase();
    const weaponSkill = String(item?.system?.skill ?? "").trim().toLowerCase();
    const isRanged = item?.system?.isRanged === true
      || ["shooting", "throwing"].includes(attackSkill)
      || ["shooting", "throwing"].includes(weaponSkill);
    if (!isRanged) return { isRanged: false, ammoMax: 1, reloadTarget: 0, usesReloadFlow: false };

    const ammoCandidates = [
      Number(item?.system?.ammo?.current),
      Number(item?.system?.ammo?.value),
      Number(item?.system?.ammunition?.current),
      Number(item?.system?.ammunition?.value),
      Number(item?.system?.shots?.current),
      Number(item?.system?.shots?.value),
      Number(item?.system?.capacity),
      Number(item?.system?.clip)
    ].filter((value) => Number.isFinite(value) && value > 0);
    const ammoMax = Math.max(1, Math.trunc(ammoCandidates[0] ?? 1));
    const reloadTargetRaw = Number(item?.system?.reload?.value);
    const reloadTarget = Number.isFinite(reloadTargetRaw) ? Math.max(0, Math.trunc(reloadTargetRaw)) : 0;
    return {
      isRanged: true,
      ammoMax,
      reloadTarget,
      usesReloadFlow: reloadTarget > 0
    };
  }

  function resolvePanelAttackAmmoState(item) {
    const meta = resolvePanelAttackAmmoMeta(item);
    if (!meta.isRanged) return { ...meta, current: 0, reloadProgress: 0 };

    const flags = item?.flags?.[moduleId]?.panelAttackAmmo ?? {};
    const rawCurrent = Number(flags?.current);
    const rawReloadProgress = Number(flags?.reloadProgress);
    const current = Number.isFinite(rawCurrent)
      ? Math.max(0, Math.min(meta.ammoMax, Math.trunc(rawCurrent)))
      : meta.ammoMax;
    const reloadProgress = Number.isFinite(rawReloadProgress)
      ? Math.max(0, Math.min(meta.reloadTarget, Math.trunc(rawReloadProgress)))
      : 0;
    return { ...meta, current, reloadProgress };
  }

  async function writePanelAttackAmmoState(item, { current, reloadProgress } = {}) {
    if (!item || typeof item.update !== "function") return;
    const updates = {};
    if (Number.isFinite(Number(current))) {
      updates[`flags.${moduleId}.panelAttackAmmo.current`] = Math.max(0, Math.trunc(Number(current)));
    }
    if (Number.isFinite(Number(reloadProgress))) {
      updates[`flags.${moduleId}.panelAttackAmmo.reloadProgress`] = Math.max(0, Math.trunc(Number(reloadProgress)));
    }
    if (!Object.keys(updates).length) return;
    await item.update(updates);
  }

  function updatePanelSlotAmmoBadge(slotElement, item, groupKey) {
    if (!(slotElement instanceof HTMLElement)) return;
    let ammoBadge = slotElement.querySelector(".tow-combat-overlay-control-panel__slot-ammo");
    if (!(ammoBadge instanceof HTMLElement)) {
      ammoBadge = document.createElement("span");
      ammoBadge.classList.add("tow-combat-overlay-control-panel__slot-ammo");
      ammoBadge.setAttribute("aria-hidden", "true");
      slotElement.appendChild(ammoBadge);
    }

    if (groupKey !== "attacks" || !item || item.__empty === true) {
      if (groupKey === "actions" && item && item.__empty !== true) {
        const itemId = String(item?.id ?? "").trim().toLowerCase();
        if (itemId === "accumulatepower") {
          const powerRaw = Number(item?.system?.accumulatedPower ?? NaN);
          const power = Number.isFinite(powerRaw) ? Math.max(0, Math.trunc(powerRaw)) : 0;
          ammoBadge.textContent = String(power);
          ammoBadge.style.display = "inline-flex";
          return;
        }
      }
      if (groupKey === "magic" && item && item.__empty !== true) {
        const cvValue = Number(item?.system?.cv);
        if (Number.isFinite(cvValue) && cvValue >= 0) {
          ammoBadge.textContent = String(Math.trunc(cvValue));
          ammoBadge.style.display = "inline-flex";
          return;
        }
      }
      ammoBadge.style.display = "none";
      ammoBadge.textContent = "";
      return;
    }

    const state = resolvePanelAttackAmmoState(item);
    if (!state.isRanged) {
      ammoBadge.style.display = "none";
      ammoBadge.textContent = "";
      return;
    }

    if (state.usesReloadFlow && state.current <= 0) {
      ammoBadge.textContent = `${Math.max(0, state.reloadProgress)}/${Math.max(1, state.reloadTarget)}`;
    } else {
      ammoBadge.textContent = String(Math.max(1, Math.trunc(state.current || state.ammoMax || 1)));
    }
    ammoBadge.style.display = "inline-flex";
  }

  function updatePanelSlotAttackAmmoVisualState(slotElement, item, groupKey, actor = null) {
    if (!(slotElement instanceof HTMLElement)) return;
    if (groupKey !== "attacks" || !item || item.__empty === true) delete slotElement.dataset.attackReloadEmpty;
    else {
      const state = resolvePanelAttackAmmoState(item);
      const isReloadEmpty = state.isRanged && state.usesReloadFlow && state.current <= 0;
      if (isReloadEmpty) slotElement.dataset.attackReloadEmpty = "true";
      else delete slotElement.dataset.attackReloadEmpty;
    }

    if (groupKey !== "magic" || !item || item.__empty === true) delete slotElement.dataset.magicInsufficientCv;
    else {
      const rawCv = Number(item?.system?.cv ?? NaN);
      const requiredCv = Number.isFinite(rawCv) ? Math.max(0, Math.trunc(rawCv)) : 0;
      const sourceActor = actor ?? item?.actor ?? item?.parent ?? null;
      const rawAccumulated = Number(sourceActor?.system?.magic?.casting?.progress ?? NaN);
      const accumulated = Number.isFinite(rawAccumulated) ? Math.max(0, Math.trunc(rawAccumulated)) : 0;
      if (requiredCv > accumulated) slotElement.dataset.magicInsufficientCv = "true";
      else delete slotElement.dataset.magicInsufficientCv;
    }

    if (groupKey !== "actions" || !item || item.__empty === true || String(item?.id ?? "").trim().toLowerCase() !== "accumulatepower") {
      delete slotElement.dataset.accumulateMiscastReady;
    } else {
      const miscastsRaw = Number(item?.system?.miscasts ?? NaN);
      const miscasts = Number.isFinite(miscastsRaw) ? Math.max(0, Math.trunc(miscastsRaw)) : 0;
      const miscastsMaxRaw = Number(item?.system?.miscastsMax ?? NaN);
      const miscastsMax = Number.isFinite(miscastsMaxRaw) ? Math.max(0, Math.trunc(miscastsMaxRaw)) : 0;
      if (miscastsMax > 0 && miscasts >= miscastsMax) slotElement.dataset.accumulateMiscastReady = "true";
      else delete slotElement.dataset.accumulateMiscastReady;
    }
  }

  function updatePanelSlotPropertyBadge(slotElement, item, groupKey) {
    if (!(slotElement instanceof HTMLElement)) return;
    let propertyBadge = slotElement.querySelector(".tow-combat-overlay-control-panel__slot-property");
    if (!(propertyBadge instanceof HTMLElement)) {
      propertyBadge = document.createElement("span");
      propertyBadge.classList.add("tow-combat-overlay-control-panel__slot-property");
      propertyBadge.setAttribute("aria-hidden", "true");
      propertyBadge.textContent = "\u2022";
      slotElement.appendChild(propertyBadge);
    }

    const hasSpecialProperty = (
      groupKey === "attacks"
      && !!item
      && item.__empty !== true
      && !!resolvePanelAttackSpecialPropertyText(item)
    );
    propertyBadge.style.display = hasSpecialProperty ? "inline-flex" : "none";
  }

  function resolvePanelAttackPropertyRarity(item) {
    const raw = resolvePanelAttackSpecialPropertyText(item);
    const count = raw
      ? raw.split("\n").map((line) => line.trim()).filter(Boolean).length
      : 0;
    if (count <= 0) return "common";
    if (count === 1) return "uncommon";
    if (count === 2) return "rare";
    if (count === 3) return "epic";
    return "legendary";
  }

  function updatePanelSlotAttackRarity(slotElement, item, groupKey) {
    if (!(slotElement instanceof HTMLElement)) return;
    if (groupKey !== "attacks" || !item || item.__empty === true) {
      delete slotElement.dataset.attackRarity;
      const existingBadge = slotElement.querySelector(".tow-combat-overlay-control-panel__slot-property");
      if (existingBadge instanceof HTMLElement) existingBadge.style.display = "none";
      return;
    }
    slotElement.dataset.attackRarity = resolvePanelAttackPropertyRarity(item);
    const existingBadge = slotElement.querySelector(".tow-combat-overlay-control-panel__slot-property");
    if (existingBadge instanceof HTMLElement) existingBadge.style.display = "none";
  }

  function resolvePanelAttackDamageLabel(item) {
    if (!item) return "";
    const damageValueRaw = Number(item?.system?.damage?.value);
    if (Number.isFinite(damageValueRaw)) {
      return String(Math.trunc(damageValueRaw));
    }

    const formulaRaw = String(item?.system?.damage?.formula ?? "").trim();
    if (!formulaRaw) return "";
    const compact = formulaRaw.replace(/\s+/g, "");
    if (compact.length <= 6) return compact;
    return `${compact.slice(0, 6)}...`;
  }

  function updatePanelSlotDamageBadge(slotElement, item, groupKey) {
    if (!(slotElement instanceof HTMLElement)) return;
    let damageBadge = slotElement.querySelector(".tow-combat-overlay-control-panel__slot-damage");
    if (!(damageBadge instanceof HTMLElement)) {
      damageBadge = document.createElement("span");
      damageBadge.classList.add("tow-combat-overlay-control-panel__slot-damage");
      damageBadge.setAttribute("aria-hidden", "true");
      slotElement.appendChild(damageBadge);
    }

    if (groupKey === "actions" && item && item.__empty !== true) {
      const itemId = String(item?.id ?? "").trim().toLowerCase();
      if (itemId === "accumulatepower") {
        const potencyRaw = Number(item?.system?.potency ?? NaN);
        const potency = Number.isFinite(potencyRaw) ? Math.max(0, Math.trunc(potencyRaw)) : 0;
        damageBadge.textContent = String(potency);
        damageBadge.style.display = "inline-flex";
        return;
      }
    }

    const supportsDamageBadge = groupKey === "attacks" || groupKey === "magic";
    if (!supportsDamageBadge || !item || item.__empty === true) {
      damageBadge.style.display = "none";
      damageBadge.textContent = "";
      return;
    }

    const label = resolvePanelAttackDamageLabel(item);
    if (!label && groupKey === "magic") {
      damageBadge.textContent = "0";
      damageBadge.style.display = "inline-flex";
      return;
    }

    if (!label) {
      damageBadge.style.display = "none";
      damageBadge.textContent = "";
      return;
    }

    damageBadge.textContent = label;
    damageBadge.style.display = "inline-flex";
  }

  return {
    resolvePanelAttackAmmoMeta,
    resolvePanelAttackAmmoState,
    writePanelAttackAmmoState,
    updatePanelSlotAmmoBadge,
    updatePanelSlotAttackAmmoVisualState,
    updatePanelSlotPropertyBadge,
    resolvePanelAttackPropertyRarity,
    updatePanelSlotAttackRarity,
    resolvePanelAttackDamageLabel,
    updatePanelSlotDamageBadge
  };
}


