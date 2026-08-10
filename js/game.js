import { setupCardPreview } from "./card-preview.js";
import { ref, get, set, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { auth, db } from "./firebase-config.js";

const DECK_STORAGE_KEY = 'ygo_deck';
const STATE_STORAGE_KEY = 'yugioh_game_full_state';
const CARD_BACK_URL = 'public/assets/images/card-back.jpg';

let deckPile = [];
let hand = [];
let graveyard = [];
let monsterZone = [null, null, null, null, null];
let spellZone = [null, null, null, null, null];
let cardDataCache = {};

// UI Elements
const overlay = document.getElementById('start-overlay');
const shuffleStartBtn = document.getElementById('shuffle-start-btn') || document.getElementById('shuffle-deck-btn');
const newGameBtn = document.getElementById('new-game-btn');
const drawCardBtn = document.getElementById('draw-card-btn');
const toggleHandBtn = document.getElementById('toggle-hand-btn');
const deckCountDisplay = document.getElementById('deck-count-display');
const deckPileVisual = document.getElementById('deck-pile');

const handContainer = document.getElementById('hand-container');

const graveCountDisplay = document.getElementById('grave-count-display');
const graveyardPileVisual = document.getElementById('graveyard-pile');
const graveyardPopover = document.getElementById('graveyard-popover');
const closeGraveModal = document.getElementById('close-modal-btn');
const graveyardList = document.getElementById('graveyard-list');

const deckPopover = document.getElementById('deck-popover');
const closeDeckModalBtn = document.getElementById('close-deck-modal-btn');
const deckList = document.getElementById('deck-list');

// Context Menus
const contextMenu = document.getElementById('context-menu');
const ctxViewDetailsBtn = document.getElementById('ctx-view-details');
const ctxSummonAtkBtn = document.getElementById('ctx-summon-atk');
const ctxSummonDefBtn = document.getElementById('ctx-summon-def');
const ctxSetDefBtn = document.getElementById('ctx-set-def');
const ctxActivateSpellBtn = document.getElementById('ctx-activate-spell');
const ctxSetSpellBtn = document.getElementById('ctx-set-spell');
const ctxSendGraveBtn = document.getElementById('ctx-send-grave');

const fieldContextContextMenu = document.getElementById('field-context-menu');
const ctxFieldViewDetailsBtn = document.getElementById('ctx-field-view-details');
const ctxFieldFlipChangeBtn = document.getElementById('ctx-field-flip-change');
const ctxFieldToGraveBtn = document.getElementById('ctx-field-to-grave');
const ctxFieldToHandBtn = document.getElementById('ctx-field-to-hand');

const graveContextMenu = document.getElementById('grave-context-menu');
const ctxGraveToHandBtn = document.getElementById('ctx-grave-to-hand');
const ctxGraveViewDetailsBtn = document.getElementById('ctx-grave-view-details');

const deckContextMenu = document.getElementById('deck-context-menu');
const ctxDeckViewDetailsBtn = document.getElementById('ctx-deck-view-details');
const ctxDeckToHandBtn = document.getElementById('ctx-deck-to-hand');
const ctxDeckToGraveBtn = document.getElementById('ctx-deck-to-grave');

const cardDetailsModal = document.getElementById('card-details-modal');
const closeDetailsBtn = document.getElementById('close-details-btn');
const cardDetailsBody = document.getElementById('card-details-body');

// State tracking
let activeHandIndex = null;
let activeHandElement = null;
let activeFieldZone = null;
let activeFieldIndex = null;
let activeGraveIndex = null;
let activeDeckIndex = null;
let isHandHidden = false;
let matchStarted = false;

function saveGameState() {
  try {
    const state = {
      deckPile,
      hand,
      graveyard,
      monsterZone,
      spellZone,
      isHandHidden,
      matchStarted
    };
    sessionStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save game state:", e);
  }
}

function loadSavedGameState() {
  const saved = sessionStorage.getItem(STATE_STORAGE_KEY);
  if (!saved) return false;
  try {
    const parsed = JSON.parse(saved);
    if (parsed && (parsed.deckPile || parsed.hand || parsed.graveyard)) {
      deckPile = parsed.deckPile || [];
      hand = parsed.hand || [];
      graveyard = parsed.graveyard || [];
      monsterZone = parsed.monsterZone || [null, null, null, null, null];
      spellZone = parsed.spellZone || [null, null, null, null, null];
      isHandHidden = !!parsed.isHandHidden;
      matchStarted = !!parsed.matchStarted;
      return true;
    }
  } catch (e) {
    console.error("Error loading saved game state:", e);
  }
  return false;
}

async function initGame() {
  if (newGameBtn) {
    newGameBtn.addEventListener("click", () => {
      if(confirm("هل أنت متأكد أنك تريد إنهاء اللعبة الحالية والذهاب لاختيار مجموعة جديدة؟")) {
        sessionStorage.removeItem(DECK_STORAGE_KEY);
        sessionStorage.removeItem(STATE_STORAGE_KEY);
        window.location.href = "library.html";
      }
    });
  }

  // Fetch cards database
  try {
    const snapshot = await get(ref(db, 'cards'));
    if (snapshot.exists()) {
      cardDataCache = snapshot.val();
    }
  } catch (e) {
    console.error("Error loading cards database:", e);
  }

  // Register unload warning
  window.addEventListener('beforeunload', (e) => {
    if (matchStarted && (deckPile.length > 0 || hand.length > 0 || graveyard.length > 0)) {
      e.preventDefault();
      e.returnValue = 'هل أنت متأكد أنك تريد مغادرة اللعبة؟ سيتم حفظ التقدم الحالي.';
    }
  });

  // Try loading ongoing saved state
  const hasSavedState = loadSavedGameState();

  if (!hasSavedState) {
    const deckStr = sessionStorage.getItem(DECK_STORAGE_KEY);
    let deckIds = deckStr ? JSON.parse(deckStr) : [];
    
    if (deckIds && deckIds.length > 0) {
      deckPile = deckIds.map(id => ({ id, ...(cardDataCache[id] || {}) })).filter(c => c && c.name);
    }
    
    // If no deck was selected or loaded deck is empty, redirect to library.html to pick a deck
    if (deckPile.length === 0) {
      alert("لم يتم اختيار مجموعة للعب بها. جاري توجيهك إلى صفحة المجموعات لاختيار مجموعة.");
      window.location.href = "library.html";
      return;
    }

    // Fresh deck loaded, match not started yet until "خلط ولعب" is pressed
    hand = [];
    graveyard = [];
    monsterZone = [null, null, null, null, null];
    spellZone = [null, null, null, null, null];
    matchStarted = false;

    if (shuffleStartBtn) {
      shuffleStartBtn.innerHTML = '<i class="ph ph-shuffle"></i> خلط ولعب';
    }
    if (drawCardBtn) drawCardBtn.disabled = true;

    updateUI(false, false);
  } else {
    if (overlay) overlay.style.display = 'none';
    if (shuffleStartBtn) {
      shuffleStartBtn.innerHTML = matchStarted 
        ? '<i class="ph ph-shuffle"></i> خلط المجموعة' 
        : '<i class="ph ph-shuffle"></i> خلط ولعب';
    }
    if (drawCardBtn) drawCardBtn.disabled = !matchStarted || deckPile.length === 0;
    if (toggleHandBtn) {
      toggleHandBtn.innerHTML = isHandHidden ? '<i class="ph ph-eye"></i> إظهار اليد' : '<i class="ph ph-eye-slash"></i> إخفاء اليد';
    }
    updateUI(false, false);
  }

  if (shuffleStartBtn) shuffleStartBtn.addEventListener('click', handleShuffleOrStart);
  if (drawCardBtn) drawCardBtn.addEventListener('click', drawCard);
  if (toggleHandBtn) toggleHandBtn.addEventListener('click', toggleHandVisibility);
  
  if (graveyardPileVisual) {
    graveyardPileVisual.addEventListener('click', (e) => {
      e.stopPropagation();
      if (graveyardPopover && graveyardPopover.classList.contains('show')) {
        graveyardPopover.classList.remove('show');
      } else if (graveyardPopover) {
        renderGraveyardPopover();
        graveyardPopover.classList.add('show');
      }
    });
  }
  
  if (closeGraveModal) {
    closeGraveModal.addEventListener('click', () => {
      if (graveyardPopover) graveyardPopover.classList.remove('show');
    });
  }

  if (deckPileVisual) {
    deckPileVisual.addEventListener('click', (e) => {
      e.stopPropagation();
      if (deckPopover && deckPopover.classList.contains('show')) {
        deckPopover.classList.remove('show');
      } else if (deckPopover) {
        renderDeckPopover();
        deckPopover.classList.add('show');
      }
    });
  }

  if (closeDeckModalBtn) {
    closeDeckModalBtn.addEventListener('click', () => {
      if (deckPopover) deckPopover.classList.remove('show');
    });
  }

  // Dismiss context menus & popovers on outside click
  document.addEventListener('click', (e) => {
    hideAllContextMenus();

    if (graveyardPopover && !graveyardPopover.contains(e.target) && graveyardPileVisual && !graveyardPileVisual.contains(e.target)) {
      graveyardPopover.classList.remove('show');
    }
    if (deckPopover && !deckPopover.contains(e.target) && deckPileVisual && !deckPileVisual.contains(e.target)) {
      deckPopover.classList.remove('show');
    }
  });

  setupContextMenuHandlers();

  if (cardDetailsModal) {
    cardDetailsModal.addEventListener('click', (e) => {
      if (e.target === cardDetailsModal) {
        cardDetailsModal.style.display = 'none';
      }
    });
  }

  if (closeDetailsBtn) {
    closeDetailsBtn.addEventListener('click', () => {
      if (cardDetailsModal) cardDetailsModal.style.display = 'none';
    });
  }
}

function hideAllContextMenus() {
  [contextMenu, fieldContextContextMenu, graveContextMenu, deckContextMenu].forEach(m => {
    if (m) m.style.setProperty('display', 'none', 'important');
  });
}

function isSpellOrTrap(card) {
  if (!card) return false;
  const type = (card.type || '').toLowerCase();
  return type.includes('spell') || type.includes('trap') || type.includes('سحر') || type.includes('فخ');
}

function setupContextMenuHandlers() {
  if (ctxViewDetailsBtn) {
    ctxViewDetailsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideAllContextMenus();
      if (activeHandIndex !== null && hand[activeHandIndex]) {
        showCardDetails(hand[activeHandIndex]);
      }
    });
  }

  if (ctxSummonAtkBtn) {
    ctxSummonAtkBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideAllContextMenus();
      playCardFromHandToField('monster', 'atk');
    });
  }

  if (ctxSummonDefBtn) {
    ctxSummonDefBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideAllContextMenus();
      playCardFromHandToField('monster', 'def');
    });
  }

  if (ctxSetDefBtn) {
    ctxSetDefBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideAllContextMenus();
      playCardFromHandToField('monster', 'set');
    });
  }

  if (ctxActivateSpellBtn) {
    ctxActivateSpellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideAllContextMenus();
      playCardFromHandToField('spell', 'faceup');
    });
  }

  if (ctxSetSpellBtn) {
    ctxSetSpellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideAllContextMenus();
      playCardFromHandToField('spell', 'facedown');
    });
  }

  if (ctxSendGraveBtn) {
    ctxSendGraveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideAllContextMenus();
      if (activeHandIndex !== null) {
        sendToGraveyard(activeHandIndex);
      }
    });
  }

  if (ctxFieldViewDetailsBtn) {
    ctxFieldViewDetailsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideAllContextMenus();
      if (activeFieldZone && activeFieldIndex !== null) {
        const slot = activeFieldZone === 'monster' ? monsterZone[activeFieldIndex] : spellZone[activeFieldIndex];
        if (slot && slot.card) {
          showCardDetails(slot.card);
        }
      }
    });
  }

  if (ctxFieldFlipChangeBtn) {
    ctxFieldFlipChangeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideAllContextMenus();
      if (activeFieldZone && activeFieldIndex !== null) {
        const zone = activeFieldZone === 'monster' ? monsterZone : spellZone;
        const slot = zone[activeFieldIndex];
        if (slot) {
          if (activeFieldZone === 'monster') {
            slot.mode = (slot.mode === 'set' || slot.mode === 'def') ? 'atk' : 'def';
          } else {
            slot.mode = slot.mode === 'facedown' ? 'faceup' : 'facedown';
          }
          updateUI();
        }
      }
    });
  }

  if (ctxFieldToGraveBtn) {
    ctxFieldToGraveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideAllContextMenus();
      if (activeFieldZone && activeFieldIndex !== null) {
        const zone = activeFieldZone === 'monster' ? monsterZone : spellZone;
        const slot = zone[activeFieldIndex];
        if (slot && slot.card) {
          graveyard.unshift(slot.card);
          zone[activeFieldIndex] = null;
          updateUI();
        }
      }
    });
  }

  if (ctxFieldToHandBtn) {
    ctxFieldToHandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideAllContextMenus();
      if (activeFieldZone && activeFieldIndex !== null) {
        const zone = activeFieldZone === 'monster' ? monsterZone : spellZone;
        const slot = zone[activeFieldIndex];
        if (slot && slot.card) {
          hand.push(slot.card);
          zone[activeFieldIndex] = null;
          updateUI();
        }
      }
    });
  }

  if (ctxGraveToHandBtn) {
    ctxGraveToHandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideAllContextMenus();
      if (activeGraveIndex !== null) {
        const card = graveyard.splice(activeGraveIndex, 1)[0];
        if (card) hand.push(card);
        updateUI();
        renderGraveyardPopover();
      }
    });
  }

  if (ctxGraveViewDetailsBtn) {
    ctxGraveViewDetailsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideAllContextMenus();
      if (activeGraveIndex !== null && graveyard[activeGraveIndex]) {
        showCardDetails(graveyard[activeGraveIndex]);
      }
    });
  }

  if (ctxDeckViewDetailsBtn) {
    ctxDeckViewDetailsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideAllContextMenus();
      if (activeDeckIndex !== null && deckPile[activeDeckIndex]) {
        showCardDetails(deckPile[activeDeckIndex]);
      }
    });
  }

  if (ctxDeckToHandBtn) {
    ctxDeckToHandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideAllContextMenus();
      if (activeDeckIndex !== null) {
        const card = deckPile.splice(activeDeckIndex, 1)[0];
        if (card) hand.push(card);
        updateUI();
        renderDeckPopover();
      }
    });
  }

  if (ctxDeckToGraveBtn) {
    ctxDeckToGraveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideAllContextMenus();
      if (activeDeckIndex !== null) {
        const card = deckPile.splice(activeDeckIndex, 1)[0];
        if (card) graveyard.unshift(card);
        updateUI();
        renderDeckPopover();
      }
    });
  }
}

function playCardFromHandToField(targetZoneType, mode) {
  if (activeHandIndex === null || !hand[activeHandIndex]) return;

  const card = hand[activeHandIndex];
  const targetZone = targetZoneType === 'monster' ? monsterZone : spellZone;
  
  const emptyIndex = targetZone.findIndex(slot => slot === null);
  if (emptyIndex === -1) {
    alert(targetZoneType === 'monster' ? "منطقة الوحوش مليئة!" : "منطقة السحر والفخ مليئة!");
    return;
  }

  targetZone[emptyIndex] = { card, mode };
  hand.splice(activeHandIndex, 1);
  activeHandIndex = null;
  updateUI();
}

function handleShuffleOrStart() {
  if (!matchStarted) {
    matchStarted = true;
    shuffleArray(deckPile);
    
    // Draw initial 5 cards into hand
    hand = [];
    for (let i = 0; i < 5; i++) {
      if (deckPile.length > 0) {
        hand.push(deckPile.pop());
      }
    }

    if (shuffleStartBtn) {
      shuffleStartBtn.innerHTML = '<i class="ph ph-shuffle"></i> خلط المجموعة';
    }
    if (drawCardBtn) drawCardBtn.disabled = deckPile.length === 0;

    updateUI();
  } else {
    if (!deckPile || deckPile.length <= 1) {
      alert("لا توجد كروت كافية في المجموعة لخلطها!");
      return;
    }
    shuffleArray(deckPile);
    updateUI();
    alert("تم خلط مجموعة الأوراق بنجاح! 🎴");
  }
}

function shuffleDeck() {
  handleShuffleOrStart();
}

function drawCard() {
  if (!matchStarted) {
    alert("يرجى الضغط على زر 'خلط ولعب' للبدء أولاً!");
    return;
  }
  if (deckPile.length > 0) {
    hand.push(deckPile.pop());
    updateUI(true);
  } else {
    alert("لا يوجد كروت متبقية في المجموعة!");
  }
}

function sendToGraveyard(handIndex) {
  const card = hand.splice(handIndex, 1)[0];
  if (!card) return;
  graveyard.unshift(card);
  updateUI();
}

function updateUI(isDrawing = false, doSave = true) {
  if (deckCountDisplay) deckCountDisplay.textContent = deckPile.length;
  if (deckPileVisual) {
    if (deckPile.length > 0) {
      deckPileVisual.classList.remove('empty');
      deckPileVisual.style.backgroundImage = `url("${CARD_BACK_URL}")`;
    } else {
      deckPileVisual.classList.add('empty');
      deckPileVisual.style.backgroundImage = 'none';
    }
  }
  
  if (drawCardBtn) {
    drawCardBtn.disabled = !matchStarted || deckPile.length === 0;
  }

  if (shuffleStartBtn) {
    shuffleStartBtn.innerHTML = matchStarted 
      ? '<i class="ph ph-shuffle"></i> خلط المجموعة' 
      : '<i class="ph ph-shuffle"></i> خلط ولعب';
  }
  
  if (graveCountDisplay) graveCountDisplay.textContent = graveyard.length;
  if (graveyardPileVisual) {
    if (graveyard.length > 0) {
      graveyardPileVisual.classList.remove('empty');
      graveyardPileVisual.style.backgroundImage = `url("${graveyard[0].imageUrl || CARD_BACK_URL}")`;
    } else {
      graveyardPileVisual.classList.add('empty');
      graveyardPileVisual.style.backgroundImage = 'none';
    }
  }
  
  renderHandUI(isDrawing);
  renderFieldSlots();

  if (doSave) {
    saveGameState();
  }
}

function toggleHandVisibility() {
  isHandHidden = !isHandHidden;
  if (toggleHandBtn) {
    toggleHandBtn.innerHTML = isHandHidden ? '<i class="ph ph-eye"></i> إظهار اليد' : '<i class="ph ph-eye-slash"></i> إخفاء اليد';
  }
  renderHandUI();
  saveGameState();
}

function renderHandUI(isDrawing = false) {
  if (!handContainer) return;
  handContainer.innerHTML = '';

  hand.forEach((card, index) => {
    if (!card) return;
    const cardDiv = document.createElement('div');
    const displayBg = isHandHidden ? CARD_BACK_URL : (card.imageUrl || CARD_BACK_URL);
    cardDiv.style.backgroundImage = `url("${displayBg}")`;
    cardDiv.style.backgroundSize = 'cover';
    cardDiv.style.backgroundPosition = 'center';
    cardDiv.className = 'hand-card';
    cardDiv.title = isHandHidden ? 'كارت مستور' : card.name;
    
    if (isDrawing && index === hand.length - 1) {
      cardDiv.classList.add('draw-anim');
    }
    
    cardDiv.addEventListener('click', (e) => {
      e.stopPropagation();
      activeHandIndex = index;
      activeHandElement = cardDiv;
      
      const spellTrap = isSpellOrTrap(card);

      if (ctxSummonAtkBtn) ctxSummonAtkBtn.style.display = spellTrap ? 'none' : 'flex';
      if (ctxSummonDefBtn) ctxSummonDefBtn.style.display = spellTrap ? 'none' : 'flex';
      if (ctxSetDefBtn) ctxSetDefBtn.style.display = spellTrap ? 'none' : 'flex';
      if (ctxActivateSpellBtn) ctxActivateSpellBtn.style.display = spellTrap ? 'flex' : 'none';
      if (ctxSetSpellBtn) ctxSetSpellBtn.style.display = spellTrap ? 'flex' : 'none';

      positionContextMenu(contextMenu, e);
    });
    
    setupCardPreview(cardDiv, displayBg);
    handContainer.appendChild(cardDiv);
  });
}

function renderFieldSlots() {
  const monsterSlots = document.querySelectorAll('.monster-slot');
  monsterSlots.forEach((slotEl, idx) => {
    slotEl.innerHTML = '';
    const slotData = monsterZone[idx];
    if (slotData && slotData.card) {
      const cardEl = createFieldCardElement(slotData, 'monster', idx);
      slotEl.appendChild(cardEl);

      // Only display stats if card is faceup/not set
      if (slotData.mode !== 'set' && (slotData.card.atk !== undefined || slotData.card.def !== undefined)) {
        const atkVal = slotData.card.atk !== undefined ? slotData.card.atk : 0;
        const defVal = slotData.card.def !== undefined ? slotData.card.def : 0;
        const statsEl = document.createElement('div');
        statsEl.className = 'field-card-stats';
        statsEl.innerHTML = `
          <span class="stat-atk" title="نقاط الهجوم">⚔️ ${atkVal}</span>
          <span class="stat-divider">|</span>
          <span class="stat-def" title="نقاط الدفاع">🛡️ ${defVal}</span>
        `;
        slotEl.appendChild(statsEl);
      }
    }
  });

  const spellSlots = document.querySelectorAll('.spell-slot');
  spellSlots.forEach((slotEl, idx) => {
    slotEl.innerHTML = '';
    const slotData = spellZone[idx];
    if (slotData && slotData.card) {
      const cardEl = createFieldCardElement(slotData, 'spell', idx);
      slotEl.appendChild(cardEl);
    }
  });
}

function createFieldCardElement(slotData, zoneType, slotIndex) {
  const card = slotData.card;
  const mode = slotData.mode;

  const cardDiv = document.createElement('div');
  cardDiv.className = `field-card-item ${mode}`;

  if (mode === 'set' || mode === 'facedown') {
    cardDiv.style.backgroundImage = `url("${CARD_BACK_URL}")`;
    cardDiv.title = 'كارت مقلوب';
    setupCardPreview(cardDiv, CARD_BACK_URL);
  } else {
    cardDiv.style.backgroundImage = `url("${card.imageUrl || CARD_BACK_URL}")`;
    cardDiv.title = card.name;
    setupCardPreview(cardDiv, card.imageUrl || CARD_BACK_URL);
  }

  cardDiv.addEventListener('click', (e) => {
    e.stopPropagation();
    activeFieldZone = zoneType;
    activeFieldIndex = slotIndex;
    positionContextMenu(fieldContextContextMenu, e);
  });

  return cardDiv;
}

function positionContextMenu(menu, e) {
  if (!menu) return;
  hideAllContextMenus();
  
  menu.style.setProperty('display', 'flex', 'important');
  menu.style.position = 'fixed';
  menu.style.zIndex = '99999';
  
  // Force a layout recalculation to get accurate bounding dimensions
  const rect = menu.getBoundingClientRect();
  const menuWidth = rect.width || 170;
  const menuHeight = rect.height || 220;
  
  let clickX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : window.innerWidth / 2);
  let clickY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : window.innerHeight / 2);
  
  // If target is in lower half of screen (e.g. hand tray at bottom), position menu ABOVE click
  let y;
  if (clickY > window.innerHeight / 2) {
    y = clickY - menuHeight - 12;
    // If placing above overflows top of viewport, snap to top margin
    if (y < 10) y = 10;
  } else {
    y = clickY + 8;
    // If placing below overflows bottom of viewport, snap to bottom margin
    if (y + menuHeight > window.innerHeight - 10) {
      y = window.innerHeight - menuHeight - 10;
    }
  }

  // Horizontally center menu relative to click, constrained to screen bounds
  let x = clickX - menuWidth / 2;
  if (x + menuWidth > window.innerWidth - 10) {
    x = window.innerWidth - menuWidth - 10;
  }
  if (x < 10) x = 10;
  
  menu.style.left = `${Math.round(x)}px`;
  menu.style.top = `${Math.round(y)}px`;
}

function showCardDetails(card) {
  if (!card || !cardDetailsBody || !cardDetailsModal) return;
  cardDetailsBody.innerHTML = `
    <img src="${card.imageUrl || CARD_BACK_URL}" alt="${card.name}">
    <button class="card-fav-btn" data-id="${card.id}" style="position: absolute; top: 15px; right: 15px; background: rgba(0,0,0,0.7); border: 1px solid var(--gold-primary); border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; color: white; cursor: pointer; z-index: 100;">
      <i class="ph ph-heart"></i>
    </button>
    <div class="card-details-info">
      <h3 class="english-text">${card.name}</h3>
      <p><strong>النوع:</strong> ${card.type || 'غير معروف'}</p>
      ${card.attribute ? `<p><strong>السمة:</strong> ${card.attribute}</p>` : ''}
      ${card.level ? `<p><strong>المستوى:</strong> ${card.level}</p>` : ''}
      ${card.atk !== undefined && card.def !== undefined ? `<p><strong>هجوم / دفاع:</strong> ${card.atk} / ${card.def}</p>` : ''}
      <p class="card-details-desc">${card.description || 'لا يوجد وصف'}</p>
    </div>
  `;
  cardDetailsModal.style.display = 'flex';
  if (typeof updateGameFavButton === 'function') updateGameFavButton(card.id);
}

function renderGraveyardPopover() {
  if (!graveyardList) return;
  graveyardList.innerHTML = '';
  if (graveyard.length === 0) {
    graveyardList.innerHTML = '<p class="empty-msg">المقبرة فارغة</p>';
    return;
  }
  
  graveyard.forEach((card, index) => {
    if (!card) return;
    const cardDiv = document.createElement('div');
    cardDiv.style.backgroundImage = `url("${card.imageUrl || CARD_BACK_URL}")`;
    cardDiv.style.backgroundSize = 'cover';
    cardDiv.style.backgroundPosition = 'center';
    cardDiv.className = 'grave-item';
    cardDiv.title = card.name;
    
    cardDiv.addEventListener('click', (e) => {
      e.stopPropagation();
      activeGraveIndex = index;
      positionContextMenu(graveContextMenu, e);
    });
    
    setupCardPreview(cardDiv, card.imageUrl || CARD_BACK_URL);
    graveyardList.appendChild(cardDiv);
  });
}

function renderDeckPopover() {
  if (!deckList) return;
  deckList.innerHTML = '';
  if (deckPile.length === 0) {
    deckList.innerHTML = '<p class="empty-msg">المجموعة فارغة</p>';
    return;
  }
  
  deckPile.forEach((card, index) => {
    if (!card) return;
    const cardDiv = document.createElement('div');
    cardDiv.style.backgroundImage = `url("${card.imageUrl || CARD_BACK_URL}")`;
    cardDiv.style.backgroundSize = 'cover';
    cardDiv.style.backgroundPosition = 'center';
    cardDiv.className = 'grave-item';
    cardDiv.title = card.name;
    
    cardDiv.addEventListener('click', (e) => {
      e.stopPropagation();
      activeDeckIndex = index;
      positionContextMenu(deckContextMenu, e);
    });
    
    setupCardPreview(cardDiv, card.imageUrl || CARD_BACK_URL);
    deckList.appendChild(cardDiv);
  });
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

document.addEventListener('DOMContentLoaded', initGame);

// Handle fav button click in modal
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.card-fav-btn');
  if (!btn) return;
  const cardId = btn.dataset.id;
  if (!cardId) return;
  
  if (!auth.currentUser) {
    alert('يجب تسجيل الدخول لإضافة الكارت للمفضلة');
    return;
  }
  
  const favRef = ref(db, `favorites/${auth.currentUser.uid}/${cardId}`);
  try {
    const snap = await get(favRef);
    if (snap.exists()) {
      await remove(favRef);
      btn.innerHTML = '<i class="ph ph-heart"></i>';
      btn.style.color = 'white';
    } else {
      await set(favRef, true);
      btn.innerHTML = '<i class="ph-fill ph-heart"></i>';
      btn.style.color = '#e74c3c';
    }
  } catch(err) {
    console.error(err);
  }
});

// Update fav button status when modal opens
function updateGameFavButton(cardId) {
  const btn = document.querySelector('#card-details-modal .card-fav-btn');
  if (!btn || !auth.currentUser) return;
  const favRef = ref(db, `favorites/${auth.currentUser.uid}/${cardId}`);
  get(favRef).then(snap => {
    if (snap.exists()) {
      btn.innerHTML = '<i class="ph-fill ph-heart"></i>';
      btn.style.color = '#e74c3c';
    } else {
      btn.innerHTML = '<i class="ph ph-heart"></i>';
      btn.style.color = 'white';
    }
  });
}
