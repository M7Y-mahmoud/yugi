sed -i 's/const fieldZoneSlotEl = document.getElementById('\''field-zone-slot'\'');/const fieldZoneSlotEl = document.getElementById('\''field-zone-slot'\'');\nconst currentTurnDisplay = document.getElementById('\''current-turn-display'\'');\nconst currentPhaseDisplay = document.getElementById('\''current-phase-display'\'');\nconst nextTurnBtn = document.getElementById('\''next-turn-btn'\'');\nconst nextPhaseBtn = document.getElementById('\''next-phase-btn'\'');/g' js/game.js

sed -i 's/let lifePoints = 4000;/let lifePoints = 4000;\nlet currentTurn = 1;\nconst PHASES = ["DRAW", "STANDBY", "MAIN 1", "BATTLE", "MAIN 2", "END"];\nlet currentPhaseIndex = 2;\n/g' js/game.js

sed -i 's/lifePoints: lifePoints/lifePoints,\n      currentTurn,\n      currentPhaseIndex/g' js/game.js

sed -i 's/lifePoints = typeof parsed.lifePoints === '\''number'\'' ? parsed.lifePoints : 4000;/lifePoints = typeof parsed.lifePoints === '\''number'\'' ? parsed.lifePoints : 4000;\n      currentTurn = typeof parsed.currentTurn === '\''number'\'' ? parsed.currentTurn : 1;\n      currentPhaseIndex = typeof parsed.currentPhaseIndex === '\''number'\'' ? parsed.currentPhaseIndex : 2;\n/g' js/game.js
