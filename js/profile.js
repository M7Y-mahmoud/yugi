import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get, onValue, set, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { listenUserPresence, formatPresence } from "./presence.js";

const loadingState = document.getElementById('loading-state');
const profileContainer = document.getElementById('profile-container');
const profileAvatar = document.getElementById('profile-avatar');
const profileStatusDot = document.getElementById('profile-status-dot');
const profileName = document.getElementById('profile-name');
const profileJoinDate = document.getElementById('profile-join-date');
const profileLastSeen = document.getElementById('profile-last-seen');
const profileBio = document.getElementById('profile-bio');
const profileActionsContainer = document.getElementById('profile-actions-container');

const statDecks = document.getElementById('stat-decks');
const statDecksLabel = document.getElementById('stat-decks-label');
const statFavorites = document.getElementById('stat-favorites');
const statFriends = document.getElementById('stat-friends');

const decksSectionTitle = document.getElementById('decks-section-title');
const decksSubtitle = document.getElementById('decks-subtitle');
const publicDecksContainer = document.getElementById('public-decks-container');

const userLogoutBtn = document.getElementById('user-logout-btn');
const userWelcome = document.getElementById('user-welcome');

// Inspect Deck Modal
const inspectDeckModal = document.getElementById('inspect-deck-modal');
const inspectDeckName = document.getElementById('inspect-deck-name');
const inspectDeckStats = document.getElementById('inspect-deck-stats');
const inspectCardsContainer = document.getElementById('inspect-cards-container');
const inspectPlayDeckBtn = document.getElementById('inspect-play-deck-btn');
const closeInspectModal = document.getElementById('close-inspect-modal');

let currentUser = null;
let profileUid = null;
let isOwnProfile = false;
let cardsDatabaseCache = null;
let currentInspectedMainDeck = [];

function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const targetUidParam = urlParams.get('uid');

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      if (userWelcome) userWelcome.textContent = `مرحباً، ${user.email}`;

      if (!targetUidParam || targetUidParam === user.uid) {
        profileUid = user.uid;
        isOwnProfile = true;
      } else {
        profileUid = targetUidParam;
        isOwnProfile = false;
      }

      setupInspectModalEvents();
      loadUserProfile();
    } else {
      if (targetUidParam) {
        profileUid = targetUidParam;
        isOwnProfile = false;
        setupInspectModalEvents();
        loadUserProfile();
      } else {
        window.location.replace('index.html');
      }
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

function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function extractCardList(cardsVal) {
  if (!cardsVal) return [];
  if (Array.isArray(cardsVal)) return [...cardsVal];
  if (typeof cardsVal === 'object') return Object.values(cardsVal);
  return [];
}

async function loadUserProfile() {
  if (!profileUid) return;

  const userRef = ref(db, `users/${profileUid}`);

  onValue(userRef, async (snapshot) => {
    loadingState.style.display = 'none';
    profileContainer.style.display = 'block';

    if (snapshot.exists()) {
      const userData = snapshot.val();
      const displayName = userData.username || (userData.email ? userData.email.split('@')[0] : 'مستخدم');

      profileName.textContent = displayName;
      profileAvatar.src = userData.avatarUrl || ('https://api.dicebear.com/9.x/adventurer/svg?seed=' + profileUid);
      profileBio.textContent = userData.bio || 'لا توجد نبذة شخصية.';
      profileJoinDate.textContent = formatDate(userData.createdAt);

      // Listen to real-time presence
      listenUserPresence(profileUid, (pData) => {
        if (profileLastSeen) {
          profileLastSeen.textContent = formatPresence(pData.lastSeen, pData.state);
        }
        if (profileStatusDot) {
          if (pData.state === 'online') {
            profileStatusDot.classList.add('online');
          } else {
            profileStatusDot.classList.remove('online');
          }
        }
      });

      // Profile Actions
      renderProfileActions(displayName, userData);

      // Load Stats & Decks
      await loadUserDecksAndStats();

      // Load Favorites count
      try {
        const favsRef = ref(db, `favorites/${profileUid}`);
        const favsSnapshot = await get(favsRef);
        if (favsSnapshot && favsSnapshot.exists()) {
          statFavorites.textContent = Object.keys(favsSnapshot.val()).length;
        } else {
          statFavorites.textContent = '0';
        }
      } catch (err) {
        console.warn("Could not load favorites:", err);
        statFavorites.textContent = '0';
      }

      // Load Friends count
      try {
        const friendsRef = ref(db, `friends/${profileUid}`);
        const friendsSnapshot = await get(friendsRef);
        if (friendsSnapshot && friendsSnapshot.exists()) {
          statFriends.textContent = Object.keys(friendsSnapshot.val()).length;
        } else {
          statFriends.textContent = '0';
        }
      } catch (err) {
        console.warn("Could not load friends:", err);
        statFriends.textContent = '0';
      }

      // Load Mutual Friends
      await loadMutualFriends();

    } else {
      profileName.textContent = 'مستخدم غير موجود';
      profileBio.textContent = 'تعذر العثور على بيانات هذا المستخدم.';
      publicDecksContainer.innerHTML = '<div class="empty-decks-box" style="grid-column: 1 / -1;"><h3>المستخدم غير موجود</h3></div>';
    }
  }, (error) => {
    console.error("Error loading profile:", error);
    loadingState.innerHTML = '<span style="color:var(--accent-wine);">حدث خطأ أثناء تحميل الملف الشخصي.</span>';
  });
}

async function renderProfileActions(displayName, userData) {
  if (!profileActionsContainer) return;
  profileActionsContainer.innerHTML = '';

  if (isOwnProfile) {
    profileActionsContainer.innerHTML = `
      <a href="settings.html" class="profile-btn profile-btn-secondary">
        <i class="ph ph-gear"></i> تعديل الملف الشخصي
      </a>
      <a href="library.html" class="profile-btn profile-btn-primary">
        <i class="ph ph-plus-circle"></i> إنشاء مجموعة جديدة
      </a>
    `;
    if (decksSectionTitle) decksSectionTitle.textContent = 'مجموعات الأوراق (الخاصة والعامة)';
    if (decksSubtitle) decksSubtitle.textContent = 'جميع المجاميع التي قمت بإنشائها';
    if (statDecksLabel) statDecksLabel.textContent = 'إجمالي المجموعات';
  } else {
    if (decksSectionTitle) decksSectionTitle.textContent = `المجموعات العامة لـ ${displayName}`;
    if (decksSubtitle) decksSubtitle.textContent = 'المجاميع المتاحة للمعاينة واللعب';
    if (statDecksLabel) statDecksLabel.textContent = 'المجموعات العامة';

    let friendBtnHtml = `<button id="profile-friend-btn" class="profile-btn profile-btn-primary"><i class="ph ph-user-plus"></i> إضافة صديق</button>`;

    if (currentUser) {
      // Check if friend
      const isFriendSnap = await get(ref(db, `friends/${currentUser.uid}/${profileUid}`));
      if (isFriendSnap.exists()) {
        friendBtnHtml = `<button class="profile-btn profile-btn-secondary" disabled style="opacity: 0.85; cursor: default;"><i class="ph ph-user-check"></i> صديقك</button>`;
      }
    }

    profileActionsContainer.innerHTML = `
      <a href="friends.html" class="profile-btn profile-btn-primary">
        <i class="ph ph-chat-circle-dots"></i> مراسلة
      </a>
      ${friendBtnHtml}
    `;

    const friendBtn = document.getElementById('profile-friend-btn');
    if (friendBtn && currentUser) {
      friendBtn.addEventListener('click', async () => {
        try {
          const reqRef = push(ref(db, 'friendRequests'));
          await set(reqRef, {
            fromUid: currentUser.uid,
            toUid: profileUid,
            status: 'pending',
            timestamp: Date.now()
          });
          friendBtn.innerHTML = '<i class="ph ph-clock"></i> تم إرسال الطلب';
          friendBtn.disabled = true;
          friendBtn.className = 'profile-btn profile-btn-secondary';
        } catch (e) {
          console.error(e);
          alert("تعذر إرسال طلب الصداقة.");
        }
      });
    }
  }
}

async function loadUserDecksAndStats() {
  const decksRef = ref(db, `users/${profileUid}/decks`);
  const decksSnapshot = await get(decksRef);

  if (!publicDecksContainer) return;
  publicDecksContainer.innerHTML = '';

  if (!decksSnapshot.exists()) {
    statDecks.textContent = '0';
    renderEmptyDecksState();
    return;
  }

  const decksData = decksSnapshot.val();
  const allDecks = Object.keys(decksData).map(key => ({
    id: key,
    ...decksData[key]
  }));

  // Filter Decks: If not own profile, ONLY show public decks!
  let visibleDecks = [];
  if (isOwnProfile) {
    visibleDecks = allDecks;
  } else {
    visibleDecks = allDecks.filter(d => d.visibility === 'public');
  }

  statDecks.textContent = visibleDecks.length;

  if (visibleDecks.length === 0) {
    renderEmptyDecksState();
    return;
  }

  visibleDecks.forEach(deck => {
    const mainCards = extractCardList(deck.mainDeck || deck.cards);
    const extraCards = extractCardList(deck.extraDeck);
    const sideCards = extractCardList(deck.sideDeck);

    const isPublic = deck.visibility === 'public';

    const deckEl = document.createElement('div');
    deckEl.className = 'profile-deck-card';

    deckEl.innerHTML = `
      <div>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
          <h3 style="margin: 0; color: var(--gold-bright); font-size: 1.15rem; font-family: var(--font-heading);">${deck.name || 'مجموعة بدون اسم'}</h3>
          <span class="deck-badge ${isPublic ? 'public' : 'private'}">
            <i class="ph ph-${isPublic ? 'globe' : 'lock-key'}"></i> ${isPublic ? 'عامة' : 'خاصة'}
          </span>
        </div>
        
        <div class="deck-stats-pills" style="margin-top: 10px;">
          <span class="deck-pill">الرئيسية: <strong style="color:#fff;">${mainCards.length}</strong></span>
          <span class="deck-pill">الإضافية: <strong style="color:#fff;">${extraCards.length}</strong></span>
          <span class="deck-pill">الجانبية: <strong style="color:#fff;">${sideCards.length}</strong></span>
        </div>
      </div>

      <div style="display: flex; gap: 8px; margin-top: 10px;">
        <button class="profile-btn profile-btn-secondary inspect-deck-btn" style="flex: 1; justify-content: center; font-size: 0.85rem; padding: 8px;">
          <i class="ph ph-eye"></i> معاينة
        </button>
        <button class="profile-btn profile-btn-primary play-deck-btn" style="flex: 1; justify-content: center; font-size: 0.85rem; padding: 8px;">
          <i class="ph ph-game-controller"></i> لعب
        </button>
      </div>
    `;

    publicDecksContainer.appendChild(deckEl);

    // Inspect Deck Event
    const inspectBtn = deckEl.querySelector('.inspect-deck-btn');
    inspectBtn.addEventListener('click', () => {
      openInspectModal(deck, mainCards, extraCards, sideCards);
    });

    // Play Deck Event
    const playBtn = deckEl.querySelector('.play-deck-btn');
    playBtn.addEventListener('click', () => {
      if (mainCards.length >= 40 && mainCards.length <= 60) {
        sessionStorage.removeItem('yugioh_game_full_state');
        sessionStorage.setItem('ygo_deck', JSON.stringify(mainCards));
        window.location.href = 'game.html';
      } else {
        alert(`المجموعة تحتوي على ${mainCards.length} كارت. يجب أن تكون المجموعة بين 40 و 60 كارت للبدء بالمباراة.`);
      }
    });
  });
}

function renderEmptyDecksState() {
  if (!publicDecksContainer) return;
  publicDecksContainer.innerHTML = `
    <div class="empty-decks-box" style="grid-column: 1 / -1;">
      <i class="ph ph-lock-key"></i>
      <h3>لا توجد مجموعات عامة</h3>
      <p>${isOwnProfile ? 'لم تقم بإنشاء أي مجموعات بعد. يمكنك إنشاء مجموعة جديدة من المكتبة!' : 'هذا المستخدم لم يقم بإنشاء مجموعات عامة حتى الآن أو أن جميع مجموعاته خاصة.'}</p>
    </div>
  `;
}

// Inspect Deck Modal Logic
async function openInspectModal(deck, mainCards, extraCards, sideCards) {
  if (!inspectDeckModal) return;

  inspectDeckName.textContent = `معاينة: ${deck.name || 'المجموعة'}`;
  inspectDeckStats.innerHTML = `
    <span class="deck-pill">الرئيسية: ${mainCards.length}</span>
    <span class="deck-pill">الإضافية: ${extraCards.length}</span>
    <span class="deck-pill">الجانبية: ${sideCards.length}</span>
  `;

  currentInspectedMainDeck = mainCards;
  inspectCardsContainer.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted);">جاري تحميل الكروت...</div>';
  inspectDeckModal.style.display = 'flex';

  // Load cards database
  if (!cardsDatabaseCache) {
    try {
      const snap = await get(ref(db, 'cards'));
      if (snap.exists()) {
        cardsDatabaseCache = snap.val();
      } else {
        cardsDatabaseCache = {};
      }
    } catch (e) {
      console.error(e);
      cardsDatabaseCache = {};
    }
  }

  inspectCardsContainer.innerHTML = '';
  const allCardIds = [...mainCards, ...extraCards, ...sideCards];

  if (allCardIds.length === 0) {
    inspectCardsContainer.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted);">المجموعة فارغة.</div>';
    return;
  }

  allCardIds.forEach(cardId => {
    const cardData = cardsDatabaseCache[cardId] || { name: `كارت #${cardId}`, imageUrl: 'https://via.placeholder.com/100x140?text=Card' };
    const cardItem = document.createElement('div');
    cardItem.className = 'inspect-card-item';

    cardItem.innerHTML = `
      <img src="${cardData.imageUrl}" alt="${cardData.name}" class="inspect-card-img" onerror="this.src='https://via.placeholder.com/100x140?text=YGo';">
      <div class="inspect-card-name" title="${cardData.name}">${cardData.name}</div>
    `;

    inspectCardsContainer.appendChild(cardItem);
  });
}

function setupInspectModalEvents() {
  if (closeInspectModal) {
    closeInspectModal.addEventListener('click', () => {
      if (inspectDeckModal) inspectDeckModal.style.display = 'none';
    });
  }
  if (inspectDeckModal) {
    inspectDeckModal.addEventListener('click', (e) => {
      if (e.target === inspectDeckModal) inspectDeckModal.style.display = 'none';
    });
  }
  if (inspectPlayDeckBtn) {
    inspectPlayDeckBtn.addEventListener('click', () => {
      if (currentInspectedMainDeck.length >= 40 && currentInspectedMainDeck.length <= 60) {
        sessionStorage.removeItem('yugioh_game_full_state');
        sessionStorage.setItem('ygo_deck', JSON.stringify(currentInspectedMainDeck));
        window.location.href = 'game.html';
      } else {
        alert(`المجموعة تحتوي على ${currentInspectedMainDeck.length} كارت. يلزم 40-60 كارت في المجموعة الرئيسية للعب.`);
      }
    });
  }
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadMutualFriends() {
  const mutualSection = document.getElementById('mutual-friends-section');
  const mutualContainer = document.getElementById('mutual-friends-container');
  const mutualBadge = document.getElementById('mutual-count-badge');

  if (!mutualSection || !mutualContainer) return;

  if (isOwnProfile || !currentUser) {
    mutualSection.style.display = 'none';
    return;
  }

  try {
    const [myFriendsSnap, targetFriendsSnap] = await Promise.all([
      get(ref(db, `friends/${currentUser.uid}`)),
      get(ref(db, `friends/${profileUid}`))
    ]);

    if (!myFriendsSnap.exists() || !targetFriendsSnap.exists()) {
      mutualSection.style.display = 'none';
      return;
    }

    const myFriendsKeys = Object.keys(myFriendsSnap.val());
    const targetFriendsKeys = Object.keys(targetFriendsSnap.val());

    const mutualUids = targetFriendsKeys.filter(uid => myFriendsKeys.includes(uid) && uid !== currentUser.uid && uid !== profileUid);

    if (mutualUids.length === 0) {
      mutualSection.style.display = 'none';
      return;
    }

    mutualSection.style.display = 'block';
    if (mutualBadge) mutualBadge.textContent = `(${mutualUids.length})`;
    mutualContainer.innerHTML = '';

    for (const mUid of mutualUids) {
      const userSnap = await get(ref(db, `users/${mUid}`));
      const uData = userSnap.exists() ? userSnap.val() : {};
      const uName = uData.username || (uData.email ? uData.email.split('@')[0] : 'صديق');
      const uAvatar = uData.avatarUrl || ('https://api.dicebear.com/9.x/adventurer/svg?seed=' + mUid);

      const item = document.createElement('a');
      item.href = `profile.html?uid=${mUid}`;
      item.className = 'mutual-friend-card';
      item.innerHTML = `
        <img src="${uAvatar}" alt="${escapeHtml(uName)}" class="mutual-friend-avatar">
        <div class="mutual-friend-info">
          <span class="mutual-friend-name">${escapeHtml(uName)}</span>
          <span class="mutual-friend-btn"><i class="ph ph-user"></i>عرض</span>
        </div>
      `;
      mutualContainer.appendChild(item);
    }
  } catch (err) {
    console.warn("Error loading mutual friends:", err);
    if (mutualSection) mutualSection.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', init);

