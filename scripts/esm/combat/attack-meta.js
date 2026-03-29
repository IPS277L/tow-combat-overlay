import { towCombatOverlayLocalize, towCombatOverlayRenderTemplate } from "./dialog-utils.js";

function towCombatOverlayIsRangedAttack(attackItem) {
  return (attackItem.system.attack.range?.max ?? 0) > 0;
}

function towCombatOverlayIsWeaponAttack(item) {
  if (item.type !== "ability" || !item.system?.attack) return false;
  if (item.system?.isAttack === true) return true;
  return typeof item.system.attack.skill === "string" && item.system.attack.skill.length > 0;
}

export function towCombatOverlayGetSortedWeaponAttacks(actor) {
  return actor.items
    .filter(towCombatOverlayIsWeaponAttack)
    .sort((a, b) => {
      const aRanged = towCombatOverlayIsRangedAttack(a);
      const bRanged = towCombatOverlayIsRangedAttack(b);
      if (aRanged !== bRanged) return aRanged ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
}

export function towCombatOverlayGetAttackMeta(attack) {
  const skill = attack.system?.attack?.skill;
  const skillLabel = game.oldworld?.config?.skills?.[skill]
    ?? skill
    ?? towCombatOverlayLocalize("TOWCOMBATOVERLAY.Label.Attack", "Attack");
  const isRanged = attack.system?.isRanged || towCombatOverlayIsRangedAttack(attack);
  const attackType = isRanged
    ? towCombatOverlayLocalize("TOWCOMBATOVERLAY.Label.Ranged", "Ranged")
    : towCombatOverlayLocalize("TOWCOMBATOVERLAY.Label.Melee", "Melee");
  const rangeConfig = game.oldworld?.config?.range ?? {};
  const meleeRangeKey = attack.system?.attack?.range?.melee;
  const minRangeKey = attack.system?.attack?.range?.min;
  const maxRangeKey = attack.system?.attack?.range?.max;
  const rangeLabel = isRanged
    ? `${rangeConfig[minRangeKey] ?? minRangeKey ?? 0}-${rangeConfig[maxRangeKey] ?? maxRangeKey ?? 0}`
    : `${rangeConfig[meleeRangeKey] ?? meleeRangeKey ?? 0}`;
  const damage = Number(attack.system?.damage?.value ?? 0);
  const damageLabel = towCombatOverlayLocalize("TOWCOMBATOVERLAY.Label.DamageAbbrev", "DMG");
  return `${attackType} | ${rangeLabel} | ${skillLabel} | ${damageLabel} ${damage}`;
}

export function towCombatOverlayRenderSelectorRowButton(rowData = {}) {
  return towCombatOverlayRenderTemplate(
    "modules/tow-combat-overlay/templates/combat/rows/selector-row.hbs",
    rowData
  );
}