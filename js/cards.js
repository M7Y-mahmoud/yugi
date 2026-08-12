import { ref as dbRef, get as dbGet, set as dbSet, remove as dbRemove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { setupCardPreview } from "./card-preview.js";
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, onValue, set, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getDeck, saveDeck, getDeckCount, toggleCardInDeck, isCardSelected, clearDeck, activeDeckSection, setActiveDeckSection } from "./deck-builder.js";
import { handleAuthError, loginUser, registerUser } from "./auth.js";

const cardsContainer = document.getElementById('cards-container');
const searchInput = document.getElementById('search-input');
const typeFilter = document.getElementById('type-filter');
const deckCountEl = document.getElementById('deck-count');
const saveDeckBtn = document.getElementById('save-deck-btn');

const deckNameInput = document.getElementById('deck-name-input');
const deckVisibilitySelect = document.getElementById('deck-visibility-select');
const deckDescInput = document.getElementById('deck-desc-input');
const deckSectionSelect = document.getElementById('deck-section-select');
const deckLimitEl = document.getElementById('deck-limit');
const deckStickyBar = document.getElementById('deck-sticky-bar');
const enterBuildModeBtn = document.getElementById('enter-build-mode-btn');
const cancelBuildBtn = document.getElementById('cancel-build-btn');
const libraryDescription = document.getElementById('library-description');

// Auth elements
const authModal = document.getElementById('auth-modal');
const closeAuthModal = document.getElementById('close-auth-modal');
const userLoginBtn = document.getElementById('user-login-btn');
const userLogoutBtn = document.getElementById('user-logout-btn');
const userWelcome = document.getElementById('user-welcome');
const navLibraryLink = document.getElementById('nav-library-link');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authRegisterBtn = document.getElementById('auth-register-btn');
const authError = document.getElementById('auth-error');

let allCards = [];
let currentUser = null;
let isBuildMode = false;

function init() {
  renderSkeletons();
  updateDeckUI();
  
  // Setup Auth listeners
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const userProfileContainer = document.getElementById('user-profile-container');
    const adminLinkDropdown = document.getElementById('admin-link-dropdown');
    
    if (user) {
      if (userLoginBtn) userLoginBtn.style.display = 'none';
      if (userProfileContainer) userProfileContainer.style.display = 'block';
      if (userWelcome) {
        userWelcome.textContent = user.email;
      }
      if (navLibraryLink) navLibraryLink.style.display = 'inline-block';
      
      // Check admin status to show admin link
      try {
        const idTokenResult = await user.getIdTokenResult();
        if (idTokenResult.claims.role === 'admin' || idTokenResult.claims.role === 'superadmin') {
          if (adminLinkDropdown) adminLinkDropdown.style.display = 'flex';
        }
      } catch (err) {
        console.error("Error fetching token result:", err);
      }
    } else {
      if (userLoginBtn) userLoginBtn.style.display = 'inline-block';
      if (userProfileContainer) userProfileContainer.style.display = 'none';
      if (navLibraryLink) navLibraryLink.style.display = 'none';
    }
  });

  setupAuthUI();
  setupDeckManagementUI();
  
  const cardsRef = ref(db, 'cards');
  onValue(cardsRef, (snapshot) => {
    const data = snapshot.val();
    allCards = [];
    if (data) {
      Object.keys(data).forEach(key => {
        allCards.push({ id: key, ...data[key] });
      });
      // Shuffle the cards
      for (let i = allCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
      }
    }
    renderCards(allCards);
    updateFavButtons();
  });

  searchInput.addEventListener('input', filterCards);
  typeFilter.addEventListener('change', filterCards);

  const heroPlayRandomBtn = document.getElementById('hero-play-random-btn');
  if (heroPlayRandomBtn) {
    heroPlayRandomBtn.addEventListener('click', async () => {
      try {
        heroPlayRandomBtn.disabled = true;
        heroPlayRandomBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> <span>جاري تجهيز 60 كارت...</span>';

        let cardList = allCards;
        if (cardList.length === 0) {
          const snapshot = await dbGet(dbRef(db, 'cards'));
          if (snapshot.exists()) {
            const data = snapshot.val();
            cardList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
          }
        }

        const cardIds = cardList.map(c => c.id);
        if (cardIds.length === 0) {
          alert('عذراً، لم يتم العثور على بطاقات في قاعدة البيانات لتجهيز المجموعة العشوائية.');
          heroPlayRandomBtn.disabled = false;
          heroPlayRandomBtn.innerHTML = '<i class="ph ph-shuffle"></i> <span>مجموعة عشوائية (60 ورقة)</span>';
          return;
        }

        let candidatePool = [];
        cardIds.forEach(id => {
          candidatePool.push(id, id, id);
        });

        for (let i = candidatePool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [candidatePool[i], candidatePool[j]] = [candidatePool[j], candidatePool[i]];
        }

        let randomDeck = candidatePool.slice(0, 60);

        while (randomDeck.length < 60 && cardIds.length > 0) {
          const randomPick = cardIds[Math.floor(Math.random() * cardIds.length)];
          randomDeck.push(randomPick);
        }

        sessionStorage.removeItem('yugioh_game_full_state');
        sessionStorage.setItem('ygo_deck', JSON.stringify(randomDeck));
        sessionStorage.setItem('ygo_is_random_deck', 'true');

        window.location.href = 'game.html';
      } catch (err) {
        console.error("Error generating random deck:", err);
        alert('حدث خطأ أثناء تجهيز المجموعة العشوائية.');
        heroPlayRandomBtn.disabled = false;
        heroPlayRandomBtn.innerHTML = '<i class="ph ph-shuffle"></i> <span>مجموعة عشوائية (60 ورقة)</span>';
      }
    });
  }
}

function setupAuthUI() {
  const userDropdownBtn = document.getElementById('user-dropdown-btn');
  const userDropdownMenu = document.getElementById('user-dropdown-menu');

  if (userDropdownBtn && userDropdownMenu) {
    userDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdownMenu.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!userDropdownMenu.contains(e.target) && !userDropdownBtn.contains(e.target)) {
        userDropdownMenu.classList.remove('show');
      }
    });
  }

  if (userLoginBtn) {
    userLoginBtn.addEventListener('click', () => {
      authModal.style.display = 'flex';
    });
  }

  if (closeAuthModal) {
    closeAuthModal.addEventListener('click', () => {
      authModal.style.display = 'none';
      authError.textContent = '';
    });
  }

  if (userLogoutBtn) {
    userLogoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth);
      } catch (err) {
        console.error(err);
      }
    });
  }

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      authError.textContent = '';
      const email = authEmail.value;
      const password = authPassword.value;
      try {
        await loginUser(email, password);
        authModal.style.display = 'none';
      } catch (err) {
        authError.textContent = handleAuthError(err);
      }
    });

    authRegisterBtn.addEventListener('click', async () => {
      authError.textContent = '';
      if (!authForm.checkValidity()) {
        authError.textContent = 'يرجى إدخال بريد إلكتروني وكلمة مرور صحيحين';
        return;
      }
      const email = authEmail.value;
      const password = authPassword.value;
      try {
        await registerUser(email, password);
        authModal.style.display = 'none';
      } catch (err) {
        authError.textContent = handleAuthError(err);
      }
    });
  }
}

function setupDeckManagementUI() {
  const heroBuildDeckBtn = document.getElementById('hero-start-build-action');
  if (heroBuildDeckBtn) {
    heroBuildDeckBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!isBuildMode && enterBuildModeBtn) {
        enterBuildModeBtn.click();
      }
      const deckBar = document.getElementById('deck-sticky-bar');
      if (deckBar && deckBar.style.display !== 'none') {
        deckBar.scrollIntoView({ behavior: 'smooth' });
      } else {
        const cardsCont = document.getElementById('cards-container');
        if (cardsCont) cardsCont.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  if (enterBuildModeBtn) {
    enterBuildModeBtn.addEventListener('click', () => {
      clearDeck();
      isBuildMode = true;
      deckStickyBar.style.display = 'block';
      document.body.classList.add('build-mode-active');
      enterBuildModeBtn.style.display = 'none';
      if (libraryDescription) libraryDescription.textContent = 'اختر الكروت لمجموعتك الجديدة (40 - 60 كارت).';
      renderCards(allCards);
      updateDeckUI();
    });
  }

  if (cancelBuildBtn) {
    cancelBuildBtn.addEventListener('click', () => {
      clearDeck();
      isBuildMode = false;
      deckStickyBar.style.display = 'none';
      document.body.classList.remove('build-mode-active');
      enterBuildModeBtn.style.display = 'inline-block';
      if (libraryDescription) libraryDescription.textContent = 'استعرض الكروت المتاحة في اللعبة.';
      deckNameInput.value = '';
      renderCards(allCards);
    });
  }

  const deckAddMoreBtn = document.getElementById('deck-add-more-btn');
  if (deckAddMoreBtn) {
    deckAddMoreBtn.addEventListener('click', () => {
      const currentSection = activeDeckSection || 'mainDeck';
      const limit = currentSection === 'mainDeck' ? 60 : 15;
      const count = getDeckCount(currentSection);
      if (count >= limit) {
        alert(`المجموعة ممتلئة بالفعل (${limit}/${limit})!`);
        return;
      }
      const cardsCont = document.getElementById('cards-container');
      if (cardsCont) {
        cardsCont.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  saveDeckBtn.addEventListener('click', async () => {
    if (!currentUser) {
      alert("يجب تسجيل الدخول أولاً لحفظ المجموعة.");
      return;
    }
    const count = getDeckCount();
    if (count < 40 || count > 60) {
      alert("يجب أن تحتوي المجموعة على 40-60 كارت للحفظ.");
      return;
    }
    const deckName = deckNameInput.value.trim();
    if (!deckName) {
      alert("يرجى إدخال اسم للمجموعة (لا يمكن ترك الاسم فارغاً).");
      return;
    }

    saveDeckBtn.disabled = true;
    saveDeckBtn.textContent = 'جاري الحفظ...';

    const userDecksRef = ref(db, `users/${currentUser.uid}/decks`);
    const newDeckRef = push(userDecksRef);
    try {
      const d = getDeck();
      await set(newDeckRef, {
        name: deckName,
        mainDeck: d.mainDeck || [],
        extraDeck: d.extraDeck || [],
        sideDeck: d.sideDeck || [],
        cards: d.mainDeck || [],
        createdAt: Date.now()
      });
      clearDeck();
      deckNameInput.value = '';
      isBuildMode = false;
      saveDeckBtn.disabled = false;
      saveDeckBtn.textContent = 'حفظ المجموعة';
      alert("تم حفظ المجموعة بنجاح في مكتبتك! يمكنك رؤيتها الآن.");
      window.location.href = 'library.html';
    } catch (err) {
      console.error(err);
      saveDeckBtn.disabled = false;
      saveDeckBtn.textContent = 'حفظ المجموعة';
      alert("حدث خطأ أثناء حفظ المجموعة.");
    }
  });
}


  if (deckSectionSelect) {
    deckSectionSelect.addEventListener('change', (e) => {
      setActiveDeckSection(e.target.value);
      deckLimitEl.textContent = e.target.value === 'mainDeck' ? '60' : '15';
      updateDeckUI();
      renderCards(allCards);
    });
  }

function updateDeckUI() {
  const currentSection = activeDeckSection || 'mainDeck';
  const limit = currentSection === 'mainDeck' ? 60 : 15;
  const count = getDeckCount(currentSection);

  if (deckStickyBar) {
    if (count >= limit) {
      deckStickyBar.classList.add('deck-full');
    } else {
      deckStickyBar.classList.remove('deck-full');
    }
  }
  if (deckCountEl) deckCountEl.textContent = count;

  const deckAddMoreBtn = document.getElementById('deck-add-more-btn');
  if (deckAddMoreBtn) {
    if (count >= limit) {
      deckAddMoreBtn.disabled = true;
      deckAddMoreBtn.style.opacity = '0.5';
      deckAddMoreBtn.style.cursor = 'not-allowed';
      deckAddMoreBtn.title = `المجموعة ممتلئة (${limit}/${limit})`;
    } else {
      deckAddMoreBtn.disabled = false;
      deckAddMoreBtn.style.opacity = '1';
      deckAddMoreBtn.style.cursor = 'pointer';
      deckAddMoreBtn.title = `إضافة المزيد من الكروت (المتبقي: ${limit - count})`;
    }
  }
}

function renderSkeletons() {
  cardsContainer.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const skel = document.createElement('div');
    skel.className = 'skeleton';
    cardsContainer.appendChild(skel);
  }
}

function renderCards(cardsToRender) {
  cardsContainer.innerHTML = '';
  
  if (cardsToRender.length === 0) {
    cardsContainer.innerHTML = '<div class="empty-state">لا توجد كروت متاحة حالياً.</div>';
    return;
  }
  
  cardsToRender.forEach(card => {
    const cardEl = document.createElement('div');
    const isSelected = isBuildMode ? isCardSelected(card.id) : false;
    cardEl.className = `card ${isSelected ? 'selected' : ''}`;
    cardEl.dataset.id = card.id;
    
    // Type class
    let typeClass = '';
    if (card.type === 'Monster') typeClass = 'type-monster';
    else if (card.type === 'Spell') typeClass = 'type-spell';
    else if (card.type === 'Trap') typeClass = 'type-trap';
    
    let imageUrl = card.imageUrl || 'https://via.placeholder.com/220x320?text=No+Image';
    setupCardPreview(cardEl, card);
    cardEl.innerHTML = `
      <button class="card-fav-btn" data-id="${card.id}" style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.7); border: 1px solid var(--gold-primary); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: white; cursor: pointer; z-index: 5;">
        <i class="ph ph-heart"></i>
      </button>
      <img src="${imageUrl}" alt="${card.name}" class="card-image" loading="lazy">
      <div class="card-content">
        <h3 class="card-name english-text">${card.name}</h3>
        <span class="card-type ${typeClass}">${card.type || 'Unknown'}</span>
      </div>
    `;
    
    cardEl.addEventListener('click', (e) => {
      if (e.target.closest('.card-fav-btn')) {
        e.stopPropagation();
        toggleFavorite(card.id, e.target.closest('.card-fav-btn'));
        return;
      }
      if (!isBuildMode) {
        // If not build mode, maybe we can show preview on click for desktop?
        // But for now, just return.
        return;
      }

      const currentlySelected = cardEl.classList.contains('selected');
      // If we are at 60 and not currently selected, the toggle will alert, so we handle UI correctly
      if (!currentlySelected && getDeckCount() >= 60) {
        alert("لا يمكن اختيار أكثر من 60 كارت.");
        return;
      }
      
      const nowSelected = toggleCardInDeck(card.id);
      if (nowSelected) {
        cardEl.classList.add('selected');
      } else {
        cardEl.classList.remove('selected');
      }
      updateDeckUI();
    });
    
    cardsContainer.appendChild(cardEl);
  });
}

function filterCards() {
  const searchTerm = searchInput.value.toLowerCase();
  const typeValue = typeFilter.value;
  
  const filtered = allCards.filter(card => {
    const matchesName = card.name && card.name.toLowerCase().includes(searchTerm);
    const matchesType = typeValue === 'all' || card.type === typeValue;
    return matchesName && matchesType;
  });
  
  renderCards(filtered);
}

document.addEventListener('DOMContentLoaded', init);



async function toggleFavorite(cardId, btnElement) {
  if (!auth.currentUser) {
    alert('يجب تسجيل الدخول لإضافة الكارت للمفضلة');
    return;
  }
  const favRef = dbRef(db, `favorites/${auth.currentUser.uid}/${cardId}`);
  try {
    const snap = await dbGet(favRef);
    if (snap.exists()) {
      await dbRemove(favRef);
      btnElement.innerHTML = '<i class="ph ph-heart"></i>';
      btnElement.style.color = 'white';
    } else {
      await dbSet(favRef, true);
      btnElement.innerHTML = '<i class="ph-fill ph-heart"></i>';
      btnElement.style.color = '#e74c3c';
    }
  } catch(err) {
    console.error(err);
  }
}

function updateFavButtons() {
  if (!auth.currentUser) return;
  const favsRef = dbRef(db, `favorites/${auth.currentUser.uid}`);
  dbGet(favsRef).then(snap => {
    if (snap.exists()) {
      const favs = snap.val();
      document.querySelectorAll('.card-fav-btn').forEach(btn => {
        const id = btn.dataset.id;
        if (favs[id]) {
          btn.innerHTML = '<i class="ph-fill ph-heart"></i>';
          btn.style.color = '#e74c3c';
        } else {
          btn.innerHTML = '<i class="ph ph-heart"></i>';
          btn.style.color = 'white';
        }
      });
    }
  });
}
