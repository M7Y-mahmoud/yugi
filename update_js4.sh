cat << 'INNER_EOF' >> js/game.js

function onMonsterRemoved(monsterZoneIndex) {
  const monsterId = `monster-${monsterZoneIndex}`;
  spellZone.forEach((slot, index) => {
    if (slot && slot.card && slot.card.equippedToMonsterId === monsterId) {
      graveyard.unshift(slot.card);
      spellZone[index] = null;
    }
  });
}
INNER_EOF
