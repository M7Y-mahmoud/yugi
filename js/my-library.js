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
  
  replaceSearchInput.addEventListener('input', renderReplaceCards);
  replaceTypeFilter.addEventListener('change', renderReplaceCards);
}

function updateEditCountUI() {
  editDeckCount.textContent = currentEditingDeckCards.length;
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
      }
    });
    
    setupCardPreview(cardEl, img.src);
    replaceCardsContainer.appendChild(cardEl);
  });
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
        deckEl.innerHTML = `
          <h3>${deck.name}</h3>
          <p>يحتوي على ${deck.cards ? deck.cards.length : 0} كارت</p>
          <div class="deck-actions-btn">
            <button class="btn-play">لعب</button>
            <button class="btn-preview">تعديل</button>
            <button class="btn-delete">حذف</button>
          </div>
        `;
        
        // Play action
        const playBtn = deckEl.querySelector('.btn-play');
        playBtn.addEventListener('click', () => {
          if (deck.cards && deck.cards.length >= 40 && deck.cards.length <= 60) {
            sessionStorage.removeItem('yugioh_game_full_state');
            sessionStorage.setItem('ygo_deck', JSON.stringify(deck.cards));
            window.location.href = 'game.html';
          } else {
            alert('هذه المجموعة غير صالحة للعب (يجب أن تحتوي على 40-60 كارت).');
          }
        });
        
        // Edit action
        const editBtn = deckEl.querySelector('.btn-preview');
        editBtn.addEventListener('click', () => {
          currentEditingDeckId = key;
          currentEditingDeckCards = deck.cards ? [...deck.cards] : [];
          editDeckNameHeader.textContent = `تعديل المجموعة: ${deck.name}`;
          
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
              await set(ref(db, `users/${currentUser.uid}/decks/${currentEditingDeckId}/cards`), currentEditingDeckCards);
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
