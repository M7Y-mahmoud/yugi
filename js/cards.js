import { setupCardPreview } from "./card-preview.js";
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, onValue, set, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getDeck, saveDeck, getDeckCount, toggleCardInDeck, isCardSelected, clearDeck } from "./deck-builder.js";

const cardsContainer = document.getElementById('cards-container');
const searchInput = document.getElementById('search-input');
const typeFilter = document.getElementById('type-filter');
const deckCountEl = document.getElementById('deck-count');
const saveDeckBtn = document.getElementById('save-deck-btn');

const deckNameInput = document.getElementById('deck-name-input');
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
  });

  searchInput.addEventListener('input', filterCards);
  typeFilter.addEventListener('change', filterCards);
  
  
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
        await signInWithEmailAndPassword(auth, email, password);
        authModal.style.display = 'none';
      } catch (err) {
        authError.textContent = 'خطأ في تسجيل الدخول. ' + err.message;
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
        await createUserWithEmailAndPassword(auth, email, password);
        authModal.style.display = 'none';
      } catch (err) {
        authError.textContent = 'خطأ في إنشاء الحساب. ' + err.message;
      }
    });
  }
}

function setupDeckManagementUI() {
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
      await set(newDeckRef, {
        name: deckName,
        cards: getDeck(),
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

function updateDeckUI() {
  if (deckStickyBar) {
    if (getDeckCount() === 60) {
      deckStickyBar.classList.add('deck-full');
    } else {
      deckStickyBar.classList.remove('deck-full');
    }
  }
  const count = getDeckCount();
  deckCountEl.textContent = count;
  if (count >= 40 && count <= 60) {
    
  } else {
    
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
    setupCardPreview(cardEl, imageUrl);
    cardEl.innerHTML = `
      <img src="${imageUrl}" alt="${card.name}" class="card-image" loading="lazy">
      <div class="card-content">
        <h3 class="card-name english-text">${card.name}</h3>
        <span class="card-type ${typeClass}">${card.type || 'Unknown'}</span>
      </div>
    `;
    
    cardEl.addEventListener('click', () => {
      if (!isBuildMode) return;

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
