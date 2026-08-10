import { setupCardPreview } from "./card-preview.js";
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, onValue, remove, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const userWelcome = document.getElementById('user-welcome');
const userLogoutBtn = document.getElementById('user-logout-btn');
const savedDecksList = document.getElementById('saved-decks-list');
const loadingState = document.getElementById('loading-state');
const decksContainer = document.getElementById('decks-container');

// Edit Modal elements
const editModal = document.getElementById('deck-edit-modal');
const closeEditModal = document.getElementById('close-edit-modal');
const editDeckNameHeader = document.getElementById('edit-deck-name-header');
const editCardsContainer = document.getElementById('edit-cards-container');
const editSaveBtn = document.getElementById('edit-save-btn');
const editDeckCount = document.getElementById('edit-deck-count');

// Replace Modal elements
const replaceModal = document.getElementById('replace-card-modal');
const closeReplaceModal = document.getElementById('close-replace-modal');
const replaceSearchInput = document.getElementById('replace-search-input');
const replaceTypeFilter = document.getElementById('replace-type-filter');
const replaceCardsContainer = document.getElementById('replace-cards-container');

let currentUser = null;
let allCardsData = {};
let allCardsArray = [];
let currentEditingDeckId = null;
let currentEditingDeckCards = [];
let cardIndexToReplace = -1;

function init() {
  const cardsRef = ref(db, 'cards');
  onValue(cardsRef, (snapshot) => {
    allCardsData = snapshot.val() || {};
    allCardsArray = Object.keys(allCardsData).map(key => ({ id: key, ...allCardsData[key] }));
  });

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
      userWelcome.textContent = `مرحباً، ${user.email}`;
      loadUserDecks();
    } else {
      window.location.href = 'index.html';
    }
  });

  userLogoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
      window.location.href = 'index.html';
    } catch (err) {
      console.error(err);
    }
  });

  if (closeEditModal) {
    closeEditModal.addEventListener('click', () => {
      editModal.style.display = 'none';
    });
  }

  if (closeReplaceModal) {
    closeReplaceModal.addEventListener('click', () => {
      replaceModal.style.display = 'none';
    });
  }
  
  const editAddMoreBtn = document.getElementById('edit-add-more-btn');
  if (editAddMoreBtn) {
    editAddMoreBtn.addEventListener('click', () => {
      if (currentEditingDeckCards.length >= 60) {
        alert("المجموعة ممتلئة بالفعل بالحد الأقصى (60/60)!");
        return;
      }
      cardIndexToReplace = -1;
      replaceSearchInput.value = '';
      replaceTypeFilter.value = 'all';
      const replaceTitle = document.getElementById('replace-modal-title');
      if (replaceTitle) {
        replaceTitle.textContent = `إضافة بطاقات للمجموعة (${currentEditingDeckCards.length}/60)`;
      }
      renderReplaceCards();
      replaceModal.style.display = 'flex';
    });
  }
  
  replaceSearchInput.addEventListener('input', renderReplaceCards);
  replaceTypeFilter.addEventListener('change', renderReplaceCards);
}

function updateEditCountUI() {
  const count = currentEditingDeckCards.length;
  if (editDeckCount) editDeckCount.textContent = count;
  const editAddMoreBtn = document.getElementById('edit-add-more-btn');
  if (editAddMoreBtn) {
    if (count >= 60) {
      editAddMoreBtn.disabled = true;
      editAddMoreBtn.style.opacity = '0.5';
      editAddMoreBtn.style.cursor = 'not-allowed';
      editAddMoreBtn.title = 'المجموعة ممتلئة بالكامل (60/60)';
    } else {
      editAddMoreBtn.disabled = false;
      editAddMoreBtn.style.opacity = '1';
      editAddMoreBtn.style.cursor = 'pointer';
      editAddMoreBtn.title = `إضافة كروت جديدة (المتبقي: ${60 - count})`;
    }
  }
}

function renderEditCards() {
  editCardsContainer.innerHTML = '';
  updateEditCountUI();
  
  currentEditingDeckCards.forEach((cardId, index) => {
    const cardData = allCardsData[cardId];
    if (cardData) {
      const wrapper = document.createElement('div');
      wrapper.className = 'edit-card-wrapper';
      
      const img = document.createElement('img');
      img.src = cardData.imageUrl || 'https://via.placeholder.com/220x320?text=No+Image';
      img.alt = cardData.name;
      img.className = 'edit-card-image';
      img.title = cardData.name;
      
      const menuBtn = document.createElement('button');
      menuBtn.className = 'edit-card-menu-btn hide-desktop';
      menuBtn.innerHTML = '⋮';
      
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'edit-card-actions';
      
      const replaceBtn = document.createElement('button');
      replaceBtn.textContent = 'استبدال';
      replaceBtn.className = 'edit-card-action-btn edit-card-replace-btn';
      
      replaceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cardIndexToReplace = index;
        replaceSearchInput.value = '';
        replaceTypeFilter.value = 'all';
        const replaceTitle = document.getElementById('replace-modal-title');
        if (replaceTitle) {
          replaceTitle.textContent = 'اختر بطاقة بديلة';
        }
        renderReplaceCards();
        replaceModal.style.display = 'flex';
      });
      
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'حذف';
      removeBtn.className = 'edit-card-action-btn edit-card-remove-btn';
      
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentEditingDeckCards.splice(index, 1);
        renderEditCards();
      });
      
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.edit-card-wrapper.show-actions').forEach(w => {
          if (w !== wrapper) w.classList.remove('show-actions');
        });
        wrapper.classList.toggle('show-actions');
      });

      wrapper.addEventListener('mouseleave', () => {
        wrapper.classList.remove('show-actions');
      });
      
      actionsDiv.appendChild(replaceBtn);
      actionsDiv.appendChild(removeBtn);
      
      wrapper.appendChild(img);
      wrapper.appendChild(menuBtn);
      wrapper.appendChild(actionsDiv);
      
      setupCardPreview(wrapper, img.src);
      editCardsContainer.appendChild(wrapper);
    }
  });
}

function renderReplaceCards() {
  const searchTerm = replaceSearchInput.value.toLowerCase();
  const typeValue = replaceTypeFilter.value;
  
  const filtered = allCardsArray.filter(card => {
    const matchesName = card.name && card.name.toLowerCase().includes(searchTerm);
    const matchesType = typeValue === 'all' || card.type === typeValue;
    return matchesName && matchesType;
  });
  
  replaceCardsContainer.innerHTML = '';
  filtered.forEach(card => {
    const cardEl = document.createElement('div');
    cardEl.style.cursor = 'pointer';
    cardEl.style.transition = 'transform 0.2s';
    
    const img = document.createElement('img');
    img.src = card.imageUrl || 'https://via.placeholder.com/220x320?text=No+Image';
    img.alt = card.name;
    img.style.width = '100%';
    img.style.borderRadius = '4px';
    
    cardEl.appendChild(img);
    
    cardEl.addEventListener('mouseenter', () => cardEl.style.transform = 'scale(1.05)');
    cardEl.addEventListener('mouseleave', () => cardEl.style.transform = 'scale(1)');
    
    cardEl.addEventListener('click', () => {
      if (cardIndexToReplace !== -1) {
        currentEditingDeckCards[cardIndexToReplace] = card.id;
        cardIndexToReplace = -1;
        replaceModal.style.display = 'none';
        renderEditCards();
      } else {
        if (currentEditingDeckCards.length >= 60) {
          alert("وصلت المجموعة إلى الحد الأقصى (60/60)!");
          replaceModal.style.display = 'none';
          return;
        }
        currentEditingDeckCards.push(card.id);
        renderEditCards();
        const replaceTitle = document.getElementById('replace-modal-title');
        if (replaceTitle) {
          replaceTitle.textContent = `إضافة بطاقات للمجموعة (${currentEditingDeckCards.length}/60)`;
        }
        if (currentEditingDeckCards.length >= 60) {
          alert("اكتملت المجموعة بالكامل (60/60)!");
          replaceModal.style.display = 'none';
        }
      }
    });
    
    setupCardPreview(cardEl, img.src);
    replaceCardsContainer.appendChild(cardEl);
  });
}

function extractCardList(cardsVal) {
  if (!cardsVal) return [];
  if (Array.isArray(cardsVal)) return [...cardsVal];
  if (typeof cardsVal === 'object') return Object.values(cardsVal);
  return [];
}

function loadUserDecks() {
  if (!currentUser) return;
  const userDecksRef = ref(db, `users/${currentUser.uid}/decks`);
  
  onValue(userDecksRef, (snapshot) => {
    loadingState.style.display = 'none';
    decksContainer.style.display = 'block';
    savedDecksList.innerHTML = '';
    
    const data = snapshot.val();
    if (data) {
      Object.keys(data).forEach(key => {
        const deck = data[key];
        const deckEl = document.createElement('div');
        deckEl.className = 'deck-card';
        
        const mainCards = extractCardList(deck.mainDeck || deck.cards);
        const extraCards = extractCardList(deck.extraDeck);
        const sideCards = extractCardList(deck.sideDeck);
        
        const mainCount = mainCards.length;
        const extraCount = extraCards.length;
        const sideCount = sideCards.length;
        
        deckEl.innerHTML = `
          <h3>${deck.name}</h3>
          <p style="font-size: 0.85rem;">
            أساسية: ${mainCount} | إضافية: ${extraCount} | جانبية: ${sideCount}
          </p>
          ${deck.visibility === 'public' ? '<span style="color:var(--accent-gold);font-size:0.8rem;">[عام]</span>' : '<span style="color:var(--text-muted);font-size:0.8rem;">[خاص]</span>'}
          <div class="deck-actions-btn" style="margin-top: 10px;">
            <button class="btn-play">لعب</button>
            <button class="btn-preview">تعديل</button>
            <button class="btn-delete">حذف</button>
          </div>
        `;
        
        // Play action
        const playBtn = deckEl.querySelector('.btn-play');
        playBtn.addEventListener('click', () => {
          const mDeck = extractCardList(deck.mainDeck || deck.cards);
          if (mDeck.length >= 40 && mDeck.length <= 60) {
            sessionStorage.removeItem('yugioh_game_full_state');
            sessionStorage.setItem('ygo_deck', JSON.stringify(mDeck));
            window.location.href = 'game.html';
          } else {
            alert('المجموعة الأساسية غير صالحة للعب (يجب أن تحتوي على 40-60 كارت).');
          }
        });
        
        // Edit action
        const editBtn = deckEl.querySelector('.btn-preview');
        editBtn.addEventListener('click', () => {
          currentEditingDeckId = key;
          currentEditingDeckCards = extractCardList(deck.mainDeck || deck.cards);
           
          editDeckNameHeader.textContent = `تعديل المجموعة: ${deck.name}`;
          const editDeckVisibility = document.getElementById('edit-deck-visibility');
          if (editDeckVisibility) {
            editDeckVisibility.value = deck.visibility || 'private';
          }
          
          renderEditCards();
          
          const oldSaveBtn = document.getElementById('edit-save-btn');
          const newSaveBtn = oldSaveBtn.cloneNode(true);
          oldSaveBtn.parentNode.replaceChild(newSaveBtn, oldSaveBtn);
          
          newSaveBtn.addEventListener('click', async () => {
            if (currentEditingDeckCards.length < 40 || currentEditingDeckCards.length > 60) {
              alert("يجب أن تحتوي المجموعة على 40-60 كارت لحفظ التعديلات.");
              return;
            }
            
            try {
              newSaveBtn.disabled = true;
              newSaveBtn.textContent = 'جاري الحفظ...';
              await set(ref(db, `users/${currentUser.uid}/decks/${currentEditingDeckId}/mainDeck`), currentEditingDeckCards);
              const editDeckVisibility = document.getElementById('edit-deck-visibility');
              if (editDeckVisibility) {
                await set(ref(db, `users/${currentUser.uid}/decks/${currentEditingDeckId}/visibility`), editDeckVisibility.value);
              }
              alert("تم حفظ التعديلات بنجاح!");
              editModal.style.display = 'none';
            } catch (err) {
              console.error(err);
              alert("حدث خطأ أثناء حفظ التعديلات.");
            } finally {
              newSaveBtn.disabled = false;
              newSaveBtn.textContent = 'حفظ التعديلات';
            }
          });
          
          editModal.style.display = 'flex';
        });

        // Delete action
        const deleteBtn = deckEl.querySelector('.btn-delete');
        deleteBtn.addEventListener('click', async () => {
          if (confirm(`هل أنت متأكد من حذف مجموعة "${deck.name}"؟`)) {
            try {
              await remove(ref(db, `users/${currentUser.uid}/decks/${key}`));
              alert("تم الحذف بنجاح");
            } catch (err) {
              console.error(err);
              alert("حدث خطأ أثناء الحذف");
            }
          }
        });
        
        savedDecksList.appendChild(deckEl);
      });
    } else {
      savedDecksList.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary);">لا توجد مجموعات محفوظة حالياً. ابدأ بإنشاء مجموعة جديدة!</p>';
    }
  }, (error) => {
    console.error("Error loading decks:", error);
    loadingState.innerHTML = '<span style="color:red;">حدث خطأ في تحميل المجموعات</span>';
  });
}

document.addEventListener('DOMContentLoaded', init);
