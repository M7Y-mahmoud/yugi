import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get, set, update, remove, onValue, query, orderByChild, equalTo, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { listenUserPresence, formatPresence } from "./presence.js";

// DOM elements
const loadingState = document.getElementById('loading-state');
const userLogoutBtn = document.getElementById('user-logout-btn');
const userWelcome = document.getElementById('user-welcome');
const friendsTotalCount = document.getElementById('friends-total-count');

const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

const badgeIncoming = document.getElementById('badge-incoming');
const badgeOutgoing = document.getElementById('badge-outgoing');

const friendsListContainer = document.getElementById('friends-list-container');
const incomingRequestsContainer = document.getElementById('incoming-requests-container');
const outgoingRequestsContainer = document.getElementById('outgoing-requests-container');
const searchResultsContainer = document.getElementById('searchResultsContainer') || document.getElementById('search-results-container');
const userSearchInput = document.getElementById('user-search-input');
const userSearchBtn = document.getElementById('user-search-btn');

let currentUser = null;
let currentProfile = {};
let myFriends = {};
let myIncomingRequests = {};
let myOutgoingRequests = {};

function init() {
  setupTabs();

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      if (userWelcome) userWelcome.textContent = `مرحباً، ${user.email}`;

      // Load user profile
      const userRef = ref(db, `users/${user.uid}`);
      get(userRef).then(snap => {
        if (snap.exists()) {
          currentProfile = snap.val();
        } else {
          currentProfile = { username: user.email.split('@')[0], avatarUrl: '' };
        }
      });

      // Start Realtime Listeners
      listenToFriends();
      listenToFriendRequests();

      if (userSearchBtn) {
        userSearchBtn.addEventListener('click', () => searchUsers());
      }
      if (userSearchInput) {
        userSearchInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') searchUsers();
        });
      }

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

// 1. Setup Tab Switching
function setupTabs() {
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const contentEl = document.getElementById(targetTab);
      if (contentEl) contentEl.classList.add('active');
    });
  });
}

// 2. Realtime Listener for Friends List
function listenToFriends() {
  const friendsRef = ref(db, `friends/${currentUser.uid}`);
  onValue(friendsRef, async (snapshot) => {
    loadingState.style.display = 'none';
    friendsListContainer.innerHTML = '';
    myFriends = snapshot.exists() ? snapshot.val() : {};

    const friendUids = Object.keys(myFriends);
    friendsTotalCount.textContent = `${friendUids.length} صديق`;

    if (friendUids.length === 0) {
      friendsListContainer.innerHTML = '<div class="empty-msg">لا يوجد لديك أصدقاء حالياً. يمكنك البحث عن مستخدمين وإرسال طلبات صداقة!</div>';
      return;
    }

    // Fetch friend profiles
    for (const friendUid of friendUids) {
      const friendData = myFriends[friendUid];
      let name = friendData.username || 'مستخدم';
      let avatar = friendData.avatarUrl || 'https://api.dicebear.com/9.x/adventurer/svg?seed=' + friendUid;
      let bio = 'صديق في اللعبة';

      // Get fresh profile details if available
      try {
        const uSnap = await get(ref(db, `users/${friendUid}`));
        if (uSnap.exists()) {
          const uVal = uSnap.val();
          if (uVal.username) name = uVal.username;
          if (uVal.avatarUrl) avatar = uVal.avatarUrl;
          if (uVal.bio) bio = uVal.bio;
        }
      } catch(e) {
        console.error(e);
      }

      const cardEl = document.createElement('div');
      cardEl.className = 'user-card';
      cardEl.innerHTML = `
        <div style="position: relative; display: inline-block;">
          <img src="${avatar}" alt="${name}" class="user-avatar">
          <span id="presence-dot-${friendUid}" style="position: absolute; bottom: 4px; left: 4px; width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--bg-void); background: #7f8c8d;"></span>
        </div>
        <div class="user-info">
          <h3 class="user-name">${name}</h3>
          <p id="presence-status-${friendUid}" style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 6px 0;">جاري التحقق...</p>
          <p class="user-bio">${bio}</p>
        </div>
        <div class="card-actions">
          <button class="btn-action btn-danger remove-friend-btn" data-uid="${friendUid}">
            <i class="ph ph-user-minus"></i> إزالة صديق
          </button>
        </div>
      `;

      friendsListContainer.appendChild(cardEl);

      // Listen to real-time presence
      listenUserPresence(friendUid, (pData) => {
        const dotEl = cardEl.querySelector(`#presence-dot-${friendUid}`);
        const statusEl = cardEl.querySelector(`#presence-status-${friendUid}`);
        if (pData.state === 'online') {
          if (dotEl) dotEl.style.background = '#2ecc71';
          if (statusEl) {
            statusEl.textContent = '🟢 متصل الآن';
            statusEl.style.color = '#2ecc71';
          }
        } else {
          if (dotEl) dotEl.style.background = '#7f8c8d';
          if (statusEl) {
            statusEl.textContent = formatPresence(pData.lastSeen, pData.state);
            statusEl.style.color = 'var(--text-muted)';
          }
        }
      });

      const removeBtn = cardEl.querySelector('.remove-friend-btn');
      removeBtn.addEventListener('click', () => removeFriend(friendUid, name));
    }
  });
}

// 3. Realtime Listener for Friend Requests
function listenToFriendRequests() {
  const reqRef = ref(db, 'friendRequests');
  onValue(reqRef, (snapshot) => {
    incomingRequestsContainer.innerHTML = '';
    outgoingRequestsContainer.innerHTML = '';

    myIncomingRequests = {};
    myOutgoingRequests = {};

    if (snapshot.exists()) {
      const allRequests = snapshot.val();

      Object.entries(allRequests).forEach(([reqId, req]) => {
        if (req.status !== 'pending') return;

        if (req.toUid === currentUser.uid) {
          myIncomingRequests[reqId] = req;
        } else if (req.fromUid === currentUser.uid) {
          myOutgoingRequests[reqId] = req;
        }
      });
    }

    // Update Badges
    const incomingCount = Object.keys(myIncomingRequests).length;
    const outgoingCount = Object.keys(myOutgoingRequests).length;

    if (incomingCount > 0) {
      badgeIncoming.textContent = incomingCount;
      badgeIncoming.style.display = 'inline-block';
    } else {
      badgeIncoming.style.display = 'none';
    }

    if (outgoingCount > 0) {
      badgeOutgoing.textContent = outgoingCount;
      badgeOutgoing.style.display = 'inline-block';
    } else {
      badgeOutgoing.style.display = 'none';
    }

    // Render Incoming
    if (incomingCount === 0) {
      incomingRequestsContainer.innerHTML = '<div class="empty-msg">لا توجد طلبات صداقة واردة.</div>';
    } else {
      Object.entries(myIncomingRequests).forEach(([reqId, req]) => {
        const name = req.fromUsername || 'مستخدم';
        const avatar = req.fromAvatar || 'https://api.dicebear.com/9.x/adventurer/svg?seed=' + req.fromUid;

        const cardEl = document.createElement('div');
        cardEl.className = 'user-card';
        cardEl.innerHTML = `
          <img src="${avatar}" alt="${name}" class="user-avatar">
          <div class="user-info">
            <h3 class="user-name">${name}</h3>
            <p class="user-bio">يرغب في إضافتك كصديق</p>
          </div>
          <div class="card-actions">
            <button class="btn-action btn-primary accept-req-btn" data-id="${reqId}">
              <i class="ph ph-check"></i> قبول
            </button>

            <button class="btn-action btn-danger reject-req-btn" data-id="${reqId}">
              <i class="ph ph-x"></i> رفض
            </button>
          </div>
        `;
        incomingRequestsContainer.appendChild(cardEl);

        cardEl.querySelector('.accept-req-btn').addEventListener('click', () => acceptRequest(reqId, req));
        cardEl.querySelector('.reject-req-btn').addEventListener('click', () => rejectRequest(reqId));
      });
    }

    // Render Outgoing
    if (outgoingCount === 0) {
      outgoingRequestsContainer.innerHTML = '<div class="empty-msg">لا توجد طلبات صداقة صادرة معلقة.</div>';
    } else {
      Object.entries(myOutgoingRequests).forEach(([reqId, req]) => {
        const name = req.toUsername || 'مستخدم';
        const avatar = req.toAvatar || 'https://api.dicebear.com/9.x/adventurer/svg?seed=' + req.toUid;

        const cardEl = document.createElement('div');
        cardEl.className = 'user-card';
        cardEl.innerHTML = `
          <img src="${avatar}" alt="${name}" class="user-avatar">
          <div class="user-info">
            <h3 class="user-name">${name}</h3>
            <p class="user-bio">في انتظار الرد...</p>
          </div>
          <div class="card-actions">
            <button class="btn-action btn-secondary cancel-req-btn" data-id="${reqId}">
              <i class="ph ph-x-circle"></i> إلغاء الطلب
            </button>
          </div>
        `;
        outgoingRequestsContainer.appendChild(cardEl);

        cardEl.querySelector('.cancel-req-btn').addEventListener('click', () => cancelRequest(reqId));
      });
    }
  });
}

// Helper to create notifications
async function createNotification(recipientUid, data) {
  if (!recipientUid) return;
  try {
    const notifRef = push(ref(db, `notifications/${recipientUid}`));
    await set(notifRef, {
      type: data.type || 'info',
      title: data.title || 'إشعار جديد',
      message: data.message || '',
      fromUid: data.fromUid || '',
      fromUsername: data.fromUsername || '',
      fromAvatar: data.fromAvatar || '',
      read: false,
      timestamp: Date.now()
    });
  } catch (err) {
    console.error("Error creating notification:", err);
  }
}

// 4. Accept Friend Request
async function acceptRequest(reqId, req) {
  try {
    const updates = {};
    // 1. Update request status
    updates[`friendRequests/${reqId}/status`] = 'accepted';

    // 2. Add dual friend records
    updates[`friends/${currentUser.uid}/${req.fromUid}`] = {
      addedAt: Date.now(),
      username: req.fromUsername || 'مستخدم',
      avatarUrl: req.fromAvatar || ''
    };
    updates[`friends/${req.fromUid}/${currentUser.uid}`] = {
      addedAt: Date.now(),
      username: currentProfile.username || currentUser.email.split('@')[0],
      avatarUrl: currentProfile.avatarUrl || ''
    };

    await update(ref(db), updates);

    // 3. Send Notification to Requester
    const myName = currentProfile.username || currentUser.email.split('@')[0];
    createNotification(req.fromUid, {
      type: 'friend_accept',
      title: 'تم قبول طلب الصداقة',
      message: `وافق ${myName} على طلب الصداقة. أصبحتم أصدقاء الآن!`,
      fromUid: currentUser.uid,
      fromUsername: myName,
      fromAvatar: currentProfile.avatarUrl || ''
    });

  } catch (err) {
    console.error("Error accepting friend request:", err);
    alert("حدث خطأ أثناء قبول الطلب.");
  }
}

// 5. Reject Friend Request
async function rejectRequest(reqId) {
  try {
    const updates = {};
    updates[`friendRequests/${reqId}/status`] = 'rejected';
    await update(ref(db), updates);
  } catch (err) {
    console.error("Error rejecting friend request:", err);
    alert("حدث خطأ أثناء رفض الطلب.");
  }
}

// 6. Cancel Sent Friend Request
async function cancelRequest(reqId) {
  try {
    const updates = {};
    updates[`friendRequests/${reqId}/status`] = 'rejected';
    await update(ref(db), updates);
  } catch (err) {
    console.error("Error canceling request:", err);
    alert("حدث خطأ أثناء إلغاء الطلب.");
  }
}

// 7. Remove Friend
async function removeFriend(friendUid, friendName) {
  if (!confirm(`هل أنت تأكد من إزالة ${friendName} من قائمة أصدقائك؟`)) return;

  try {
    const updates = {};
    updates[`friends/${currentUser.uid}/${friendUid}`] = null;
    updates[`friends/${friendUid}/${currentUser.uid}`] = null;
    await update(ref(db), updates);
  } catch (err) {
    console.error("Error removing friend:", err);
    alert("حدث خطأ أثناء إزالة الصديق.");
  }
}

// 8. Search Users by Username
async function searchUsers() {
  const searchTerm = userSearchInput.value.trim().toLowerCase();
  if (!searchTerm) {
    searchResultsContainer.innerHTML = '<div class="empty-msg">يرجى كتابة اسم المستخدم للبحث.</div>';
    return;
  }

  searchResultsContainer.innerHTML = '<div class="empty-msg">جاري البحث...</div>';

  try {
    const usersSnap = await get(ref(db, 'users'));
    if (!usersSnap.exists()) {
      searchResultsContainer.innerHTML = '<div class="empty-msg">لم يتم العثور على نتائج.</div>';
      return;
    }

    const allUsers = usersSnap.val();
    const matchingUsers = [];

    Object.entries(allUsers).forEach(([uid, userData]) => {
      const username = (userData.username || '').toLowerCase();
      const email = (userData.email || '').toLowerCase();

      if (username.includes(searchTerm) || email.includes(searchTerm)) {
        matchingUsers.push({ uid, ...userData });
      }
    });

    if (matchingUsers.length === 0) {
      searchResultsContainer.innerHTML = `<div class="empty-msg">لا يوجد مستخدم باسم "${searchTerm}".</div>`;
      return;
    }

    searchResultsContainer.innerHTML = '';

    matchingUsers.forEach(u => {
      const name = u.username || u.email.split('@')[0];
      const avatar = u.avatarUrl || 'https://api.dicebear.com/9.x/adventurer/svg?seed=' + u.uid;
      const bio = u.bio || 'لا توجد نبذة شخصية.';

      const cardEl = document.createElement('div');
      cardEl.className = 'user-card';

      let actionButtonHtml = '';

      if (u.uid === currentUser.uid) {
        actionButtonHtml = `<button class="btn-action btn-disabled"><i class="ph ph-user"></i> أنت</button>`;
      } else if (myFriends[u.uid]) {
        actionButtonHtml = `<button class="btn-action btn-disabled"><i class="ph ph-user-check"></i> صديق بالفعل</button>`;
      } else {
        // Check if there is a pending request
        const requestId1 = `${currentUser.uid}_${u.uid}`;
        const requestId2 = `${u.uid}_${currentUser.uid}`;

        const isOutgoing = myOutgoingRequests[requestId1] || myOutgoingRequests[requestId2];
        const isIncoming = myIncomingRequests[requestId1] || myIncomingRequests[requestId2];

        if (isOutgoing) {
          actionButtonHtml = `<button class="btn-action btn-disabled"><i class="ph ph-clock"></i> طلب معلق</button>`;
        } else if (isIncoming) {
          actionButtonHtml = `<button class="btn-action btn-primary accept-search-btn" data-id="${requestId2}">
            <i class="ph ph-check"></i> قبول الطلب
          </button>`;
        } else {
          actionButtonHtml = `<button class="btn-action btn-primary send-req-btn" data-uid="${u.uid}" data-name="${name}" data-avatar="${avatar}">
            <i class="ph ph-user-plus"></i> إرسال طلب صداقة
          </button>`;
        }
      }

      cardEl.innerHTML = `
        <img src="${avatar}" alt="${name}" class="user-avatar">
        <div class="user-info">
          <h3 class="user-name">${name}</h3>
          <p class="user-bio">${bio}</p>
        </div>
        <div class="card-actions">
          ${actionButtonHtml}
        </div>
      `;

      searchResultsContainer.appendChild(cardEl);

      const sendBtn = cardEl.querySelector('.send-req-btn');
      if (sendBtn) {
        sendBtn.addEventListener('click', () => sendFriendRequest(u.uid, name, avatar));
      }

      const acceptBtn = cardEl.querySelector('.accept-search-btn');
      if (acceptBtn) {
        const reqId = acceptBtn.dataset.id;
        const reqData = myIncomingRequests[reqId];
        if (reqData) {
          acceptBtn.addEventListener('click', () => acceptRequest(reqId, reqData));
        }
      }
    });

  } catch (err) {
    console.error("Error searching users:", err);
    searchResultsContainer.innerHTML = '<div class="empty-msg">حدث خطأ أثناء البحث.</div>';
  }
}

// 9. Send Friend Request
async function sendFriendRequest(targetUid, targetName, targetAvatar) {
  const requestId = `${currentUser.uid}_${targetUid}`;
  const requestRef = ref(db, `friendRequests/${requestId}`);

  const requestData = {
    fromUid: currentUser.uid,
    fromUsername: currentProfile.username || currentUser.email.split('@')[0],
    fromAvatar: currentProfile.avatarUrl || '',
    toUid: targetUid,
    toUsername: targetName,
    toAvatar: targetAvatar,
    status: 'pending',
    timestamp: Date.now()
  };

  try {
    await set(requestRef, requestData);

    // Send Notification to recipient
    const myName = currentProfile.username || currentUser.email.split('@')[0];
    createNotification(targetUid, {
      type: 'friend_request',
      title: 'طلب صداقة جديد',
      message: `أرسل لك ${myName} طلب صداقة.`,
      fromUid: currentUser.uid,
      fromUsername: myName,
      fromAvatar: currentProfile.avatarUrl || ''
    });

    alert(`تم إرسال طلب الصداقة إلى ${targetName} بنجاح!`);
    searchUsers(); // Refresh search UI
  } catch (err) {
    console.error("Error sending friend request:", err);
    alert("حدث خطأ أثناء إرسال طلب الصداقة.");
  }
}

document.addEventListener('DOMContentLoaded', init);
