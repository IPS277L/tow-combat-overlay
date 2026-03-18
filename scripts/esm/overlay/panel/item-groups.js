export function getPanelItemGroupsForActor(actor, {
  getPanelActionEntries,
  getPanelManoeuvreSubActionEntries,
  getPanelRecoverActionEntries,
  isPanelGeneratedUnarmedItem,
  resolveTemporaryEffectDescription,
  fallbackItemIcon,
  unarmedActionId,
  actionIconByKey
} = {}) {
  const toList = (value) => (Array.isArray(value) ? value : []);
  const abilityItems = toList(actor?.itemTypes?.ability).filter((item) => !isPanelGeneratedUnarmedItem(item));
  const talentItems = toList(actor?.itemTypes?.talent);
  const spellItems = toList(actor?.itemTypes?.spell);
  const blessingItems = toList(actor?.itemTypes?.blessing);
  const weaponItems = toList(actor?.itemTypes?.weapon);
  const actions = getPanelActionEntries(actor);
  const manoeuvre = getPanelManoeuvreSubActionEntries();
  const recover = getPanelRecoverActionEntries();
  const conditionKeys = new Set(
    Object.keys(game?.oldworld?.config?.conditions ?? {}).map((key) => String(key ?? "").toLowerCase())
  );
  const temporaryEffects = toList(actor?.effects?.contents)
    .filter((effect) => {
      if (!effect) return false;
      if (effect.disabled || effect.isSuppressed) return false;
      if (effect.transfer) return false;
      const statuses = Array.from(effect.statuses ?? []).map((status) => String(status ?? "").toLowerCase());
      if (statuses.some((status) => conditionKeys.has(status))) return false;
      return true;
    })
    .sort((a, b) => Number(a?.sort ?? 0) - Number(b?.sort ?? 0))
    .map((effect) => ({
      id: String(effect?.id ?? ""),
      name: String(effect?.name ?? "Effect"),
      img: String(effect?.img ?? effect?.icon ?? fallbackItemIcon),
      system: {
        description: resolveTemporaryEffectDescription(effect)
      }
    }));

  const attacks = abilityItems
    .filter((item) => item?.system?.isAttack === true)
    .concat(weaponItems.filter((item) => item?.system?.isEquipped || item?.system?.equipped?.value));
  attacks.unshift({
    id: unarmedActionId,
    name: "Unarmed Attack",
    img: actionIconByKey.unarmed ?? fallbackItemIcon,
    system: {
      description: "Opposed attack using Brawn vs Endurance."
    }
  });
  const abilities = abilityItems
    .filter((item) => item?.system?.isAttack !== true)
    .concat(talentItems);
  const magic = spellItems.concat(blessingItems);

  return { actions, attacks, abilities, temporaryEffects, manoeuvre, recover, magic };
}

export function resolveDynamicGridLayout(itemCount) {
  const count = Math.max(0, Math.trunc(Number(itemCount) || 0));
  if (count <= 0) return { columns: 1, rows: 1 };
  if (count === 1) return { columns: 1, rows: 1 };
  const rows = Math.max(1, Math.min(2, count));
  const columns = Math.max(1, Math.ceil(count / rows));
  return { columns, rows };
}
