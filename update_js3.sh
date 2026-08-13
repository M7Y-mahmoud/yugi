cat << 'INNER_EOF' >> js/game.js

const SPELL_SPEED = {
  normal: 1, continuous: 1, equip: 1, field: 1, ritual: 1,
  quickplay: 2, normal_trap: 2, continuous_trap: 2,
  counter_trap: 3,
  monster_continuous: 1, monster_ignition: 1, monster_trigger: 1, monster_quick: 2
};

function getSpellSpeed(card) {
  const info = card.subtype || getCardTypeInfo(card).subtype;
  return SPELL_SPEED[info] || 1;
}

function canActivateTrap(card) {
  if (card.cardType !== "trap") return true;
  if (card.turnPlacedOn === currentTurn) return false;
  return true;
}

function canActivateQuickPlaySpell(card, activatingFromHand) {
  if (card.cardType !== "spell" || card.subtype !== "quickplay") return true;
  if (activatingFromHand) return true;
  if (card.turnPlacedOn === currentTurn) return false;
  return true;
}

function canActivateNormalOrRitualSpell(card, activatingFromHand) {
  if (card.cardType !== "spell") return true;
  if (card.subtype === "quickplay") return true;
  if (currentPhaseIndex !== 2 && currentPhaseIndex !== 4) return false; // MAIN 1 or MAIN 2
  return true;
}

function validateCardActivation(card, activatingFromHand) {
  const typeInfo = getCardTypeInfo(card);
  card.cardType = typeInfo.cardType;
  card.subtype = typeInfo.subtype;

  if (card.cardType === "trap") {
    if (!canActivateTrap(card)) {
      alert("لا يمكن تفعيل بطاقة الفخ في نفس الدور الذي تم وضعها فيه (Set).");
      return false;
    }
  } else if (card.cardType === "spell") {
    if (card.subtype === "quickplay") {
      if (!canActivateQuickPlaySpell(card, activatingFromHand)) {
        alert("لا يمكن تفعيل سحر سريع (Quick-Play) في نفس الدور الذي تم وضعه فيه (Set).");
        return false;
      }
    } else {
      if (!canActivateNormalOrRitualSpell(card, activatingFromHand)) {
        alert("لا يمكن تفعيل السحر العادي/الطقسي/المستمر/التجهيز إلا في المرحلة الأساسية (Main Phase 1 or 2).");
        return false;
      }
    }
  }
  return true;
}
INNER_EOF
