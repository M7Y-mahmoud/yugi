import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get, remove, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const loadingState = document.getElementById('loading-state');
const favoritesContainer = document.getElementById('favorites-container');
const favCount = document.getElementById('fav-count');

const userLogoutBtn = document.getElementById('user-logout-btn');
const userWelcome = document.getElementById('user-welcome');

let currentUser = null;
let allCardsCache = {};

function init() {
  // Pre-load all cards (to easily map fav ids to cards without multiple round trips)
  get(ref(db, 'cards')).then(snap => {
    if (snap.exists()) {
      allCardsCache = snap.val();
    }
  });

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      if (userWelcome) userWelcome.textContent = `مرحباً، ${user.email}`;
      loadFavorites();
    } else {
      window.location.replace('index.html');
    }
  });

  if (userLogoutBtn) {
    userLogoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth);
        window.location.replace('index.html');
      } catch (err) {
        console.error(err);
      }
    });
  }
}

async function loadFavorites() {
  const favsRef = ref(db, `favorites/${currentUser.uid}`);
  
  onValue(favsRef, (snapshot) => {
    loadingState.style.display = 'none';
    favoritesContainer.innerHTML = '';
    
    if (snapshot.exists()) {
      const favs = snapshot.val();
      const favIds = Object.keys(favs);
      favCount.textContent = `${favIds.length} كارت`;
      
      if (favIds.length === 0) {
        favoritesContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">لا توجد كروت مفضلة بعد.</div>';
        return;
      }
      
      favIds.forEach(cardId => {
        const cardData = allCardsCache[cardId];
        if (!cardData) return; // Skip if card was deleted from db
        
        const cardEl = document.createElement('div');
        cardEl.className = 'card fav-card';
        
        let typeClass = '';
        if (cardData.type === 'Monster') typeClass = 'type-monster';
        else if (cardData.type === 'Spell') typeClass = 'type-spell';
        else if (cardData.type === 'Trap') typeClass = 'type-trap';
        
        let imageUrl = cardData.imageUrl || 'https://via.placeholder.com/220x320?text=No+Image';
        
        cardEl.innerHTML = `
          <button class="fav-btn-card" data-id="${cardId}" title="إزالة من المفضلة">
            <i class="ph-fill ph-heart"></i>
          </button>
          <img src="${imageUrl}" alt="${cardData.name}" class="card-image" loading="lazy">
          <div class="card-content">
            <h3 class="card-name english-text">${cardData.name}</h3>
            <span class="card-type ${typeClass}">${cardData.type || 'Unknown'}</span>
          </div>
        `;
        
        favoritesContainer.appendChild(cardEl);
        
        const rmBtn = cardEl.querySelector('.fav-btn-card');
        rmBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const targetFavRef = ref(db, `favorites/${currentUser.uid}/${cardId}`);
          try {
            await remove(targetFavRef);
          } catch(err) {
            console.error("Error removing fav:", err);
          }
        });
      });
      
    } else {
      favCount.textContent = `0 كارت`;
      favoritesContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">لا توجد كروت مفضلة بعد.</div>';
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
