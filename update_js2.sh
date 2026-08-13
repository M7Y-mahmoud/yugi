cat << 'INNER_EOF' >> js/game.js

function updateTurnPhaseUI() {
  if (currentTurnDisplay) currentTurnDisplay.textContent = currentTurn;
  if (currentPhaseDisplay) currentPhaseDisplay.textContent = PHASES[currentPhaseIndex];
}

INNER_EOF
