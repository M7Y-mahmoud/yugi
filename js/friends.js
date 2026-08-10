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

// Chat Modal DOM
const friendChatModal = document.getElementById('friend-chat-modal');
const chatFriendAvatar = document.getElementById('chat-friend-avatar');
const chatFriendName = document.getElementById('chat-friend-name');
const chatFriendStatus = document.getElementById('chat-friend-status');
const closeChatModal = document.getElementById('close-chat-modal');
const chatMessagesContainer = document.getElementById('chat-messages-container');
const chatMessageInput = document.getElementById('chat-message-input');
const chatSendBtn = document.getElementById('chat-send-btn');

// Group Chat DOM
const openCreateGroupBtn = document.getElementById('open-create-group-btn');
const createGroupModal = document.getElementById('create-group-modal');
const closeCreateGroupModal = document.getElementById('close-create-group-modal');
const newGroupNameInput = document.getElementById('new-group-name-input');
const groupFriendsChecklist = document.getElementById('group-friends-checklist');
const submitCreateGroupBtn = document.getElementById('submit-create-group-btn');
const groupChatsContainer = document.getElementById('group-chats-container');
const badgeGroups = document.getElementById('badge-groups');

let currentUser = null;
let currentProfile = {};
let myFriends = {};
let myIncomingRequests = {};
let myOutgoingRequests = {};

let activeChatId = null;
let activeChatType = 'direct'; // 'direct' or 'group'
let activeChatFriendUid = null;
let activeChatUnsubscribe = null;
let activeGroupData = null;

// ==========================================
// Custom In-App Toasts & Custom Dialog Modals
// ==========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `custom-toast toast-${type}`;

  let iconClass = 'ph-info';
  if (type === 'success') iconClass = 'ph-check-circle';
  if (type === 'error') iconClass = 'ph-x-circle';

  toast.innerHTML = `
    <i class="ph ${iconClass}" style="font-size: 1.2rem;"></i>
    <span style="flex:1;">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function showCustomConfirm(title, message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('custom-confirm-modal');
    const titleEl = document.getElementById('custom-confirm-title');
    const msgEl = document.getElementById('custom-confirm-message');
    const okBtn = document.getElementById('custom-confirm-ok-btn');
    const cancelBtn = document.getElementById('custom-confirm-cancel-btn');

    if (!modal) {
      resolve(confirm(message));
      return;
    }

    if (titleEl) titleEl.innerHTML = `<i class="ph ph-warning-circle"></i> ${escapeHtml(title)}`;
    if (msgEl) msgEl.textContent = message;

    modal.style.display = 'flex';

    const cleanup = () => {
      modal.style.display = 'none';
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
    };

    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}

function showCustomPrompt(title, defaultValue = '', placeholder = '') {
  return new Promise((resolve) => {
    const modal = document.getElementById('custom-prompt-modal');
    const titleEl = document.getElementById('custom-prompt-title');
    const inputEl = document.getElementById('custom-prompt-input');
    const okBtn = document.getElementById('custom-prompt-confirm-btn');
    const cancelBtn = document.getElementById('custom-prompt-cancel-btn');

    if (!modal) {
      resolve(prompt(title, defaultValue));
      return;
    }

    if (titleEl) titleEl.innerHTML = `<i class="ph ph-pencil"></i> ${escapeHtml(title)}`;
    if (inputEl) {
      inputEl.value = defaultValue;
      inputEl.placeholder = placeholder;
    }

    modal.style.display = 'flex';
    if (inputEl) inputEl.focus();

    const cleanup = () => {
      modal.style.display = 'none';
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
    };

    const onOk = () => {
      const val = inputEl ? inputEl.value : '';
      cleanup();
      resolve(val);
    };
    const onCancel = () => {
      cleanup();
      resolve(null);
    };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}

function init() {
  setupTabs();
  setupChatEvents();
  setupGroupModalEvents();
  setupGroupInfoEvents();

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
      listenToGroupChats();

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
          <a href="profile.html?uid=${friendUid}" class="btn-action btn-secondary view-profile-btn" style="text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
            <i class="ph ph-user"></i> الملف الشخصي
          </a>
          <button class="btn-action btn-primary open-chat-btn" data-uid="${friendUid}">
            <i class="ph ph-chat-circle-dots"></i> محادثة
          </button>
          <button class="btn-action btn-danger remove-friend-btn" data-uid="${friendUid}">
            <i class="ph ph-user-minus"></i> إزالة
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

      const openChatBtn = cardEl.querySelector('.open-chat-btn');
      if (openChatBtn) {
        openChatBtn.addEventListener('click', () => openChatModal(friendUid, name, avatar));
      }

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
    showToast("حدث خطأ أثناء قبول الطلب.", 'error');
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
    showToast("حدث خطأ أثناء رفض الطلب.", 'error');
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
    showToast("حدث خطأ أثناء إلغاء الطلب.", 'error');
  }
}

// 7. Remove Friend
async function removeFriend(friendUid, friendName) {
  const confirmed = await showCustomConfirm("إزالة صديق", `هل أنت تأكد من إزالة ${friendName} من قائمة أصدقائك؟`);
  if (!confirmed) return;

  try {
    const updates = {};
    updates[`friends/${currentUser.uid}/${friendUid}`] = null;
    updates[`friends/${friendUid}/${currentUser.uid}`] = null;
    await update(ref(db), updates);
    showToast(`تمت إزالة ${friendName} من قائمة أصدقائك.`, 'info');
  } catch (err) {
    console.error("Error removing friend:", err);
    showToast("حدث خطأ أثناء إزالة الصديق.", 'error');
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
          <a href="profile.html?uid=${u.uid}" class="btn-action btn-secondary view-profile-btn" style="text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
            <i class="ph ph-user"></i> الملف الشخصي
          </a>
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

    showToast(`تم إرسال طلب الصداقة إلى ${targetName} بنجاح!`, 'success');
    searchUsers(); // Refresh search UI
  } catch (err) {
    console.error("Error sending friend request:", err);
    showToast("حدث خطأ أثناء إرسال طلب الصداقة.", 'error');
  }
}

// Group Chat Modal Events
function setupGroupModalEvents() {
  if (openCreateGroupBtn) {
    openCreateGroupBtn.addEventListener('click', () => {
      populateGroupFriendsChecklist();
      if (createGroupModal) createGroupModal.style.display = 'flex';
    });
  }
  if (closeCreateGroupModal) {
    closeCreateGroupModal.addEventListener('click', () => {
      if (createGroupModal) createGroupModal.style.display = 'none';
    });
  }
  if (createGroupModal) {
    createGroupModal.addEventListener('click', (e) => {
      if (e.target === createGroupModal) createGroupModal.style.display = 'none';
    });
  }
  if (submitCreateGroupBtn) {
    submitCreateGroupBtn.addEventListener('click', createGroupChat);
  }
}

function populateGroupFriendsChecklist() {
  if (!groupFriendsChecklist) return;
  groupFriendsChecklist.innerHTML = '';

  const friendUids = Object.keys(myFriends);
  if (friendUids.length === 0) {
    groupFriendsChecklist.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:10px;">ليس لديك أصدقاء حالياً لإضافتهم إلى الجروب.</div>';
    return;
  }

  friendUids.forEach(async (fUid) => {
    const fData = myFriends[fUid];
    let name = fData.username || 'صديق';
    let avatar = fData.avatarUrl || ('https://api.dicebear.com/9.x/adventurer/svg?seed=' + fUid);

    try {
      const uSnap = await get(ref(db, `users/${fUid}`));
      if (uSnap.exists()) {
        const uVal = uSnap.val();
        if (uVal.username) name = uVal.username;
        if (uVal.avatarUrl) avatar = uVal.avatarUrl;
      }
    } catch(e){}

    const label = document.createElement('label');
    label.className = 'group-friend-item';
    label.innerHTML = `
      <input type="checkbox" value="${fUid}">
      <img src="${avatar}" alt="${escapeHtml(name)}" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--gold-primary); object-fit:cover;">
      <span style="color:#fff; font-size:0.95rem; font-weight:bold;">${escapeHtml(name)}</span>
    `;
    groupFriendsChecklist.appendChild(label);
  });
}

async function createGroupChat() {
  if (!currentUser || !newGroupNameInput) return;
  const groupName = newGroupNameInput.value.trim();
  if (!groupName) {
    showToast("يرجى إدخال اسم الجروب.", 'error');
    return;
  }

  const checkedInputs = groupFriendsChecklist.querySelectorAll('input[type="checkbox"]:checked');
  const selectedFriendUids = Array.from(checkedInputs).map(i => i.value);

  const groupId = 'group_' + Date.now();
  const membersMap = {};
  membersMap[currentUser.uid] = true;
  selectedFriendUids.forEach(uid => membersMap[uid] = true);

  const newGroup = {
    isGroup: true,
    groupId: groupId,
    groupName: groupName,
    groupAvatar: 'https://api.dicebear.com/9.x/shapes/svg?seed=' + groupId,
    groupDesc: '',
    createdBy: currentUser.uid,
    createdAt: Date.now(),
    admins: {
      [currentUser.uid]: true
    },
    members: membersMap,
    lastMessage: {
      text: 'تم إنشاء الجروب',
      senderUid: currentUser.uid,
      senderName: currentProfile.username || currentUser.email.split('@')[0],
      timestamp: Date.now()
    }
  };

  try {
    const updates = {};
    updates[`chats/${groupId}`] = newGroup;
    Object.keys(membersMap).forEach(mUid => {
      updates[`userGroups/${mUid}/${groupId}`] = true;
    });

    await update(ref(db), updates);

    if (createGroupModal) createGroupModal.style.display = 'none';
    newGroupNameInput.value = '';

    // Notify members
    selectedFriendUids.forEach(fUid => {
      createNotification(fUid, {
        type: 'group_invite',
        title: `تمت إضافتك إلى جروب "${groupName}"`,
        message: `قام ${currentProfile.username || 'مستخدم'} بإضافتك إلى المجموعة.`,
        fromUid: currentUser.uid
      });
    });

    showToast("تم إنشاء جروب الشات بنجاح!", 'success');

    // Switch to Group Chats tab
    const groupTabBtn = document.querySelector('.tab-btn[data-tab="tab-group-chats"]');
    if (groupTabBtn) groupTabBtn.click();
  } catch(err) {
    console.error("Error creating group chat:", err);
    showToast("تعذر إنشاء الجروب: " + err.message, 'error');
  }
}

function listenToGroupChats() {
  if (!groupChatsContainer || !currentUser) return;
  const userGroupsRef = ref(db, `userGroups/${currentUser.uid}`);

  onValue(userGroupsRef, async (snapshot) => {
    groupChatsContainer.innerHTML = '';
    if (!snapshot.exists()) {
      renderEmptyGroupChats();
      return;
    }

    const groupIdsObj = snapshot.val();
    const groupIds = Object.keys(groupIdsObj);

    if (groupIds.length === 0) {
      renderEmptyGroupChats();
      return;
    }

    // Fetch details for each group
    const myGroups = [];
    for (const gId of groupIds) {
      try {
        const gSnap = await get(ref(db, `chats/${gId}`));
        if (gSnap.exists()) {
          myGroups.push(gSnap.val());
        }
      } catch (e) {
        console.error("Error loading group " + gId, e);
      }
    }

    if (badgeGroups) {
      if (myGroups.length > 0) {
        badgeGroups.textContent = myGroups.length;
        badgeGroups.style.display = 'inline-block';
      } else {
        badgeGroups.style.display = 'none';
      }
    }

    if (myGroups.length === 0) {
      renderEmptyGroupChats();
      return;
    }

    myGroups.sort((a, b) => ((b.lastMessage?.timestamp) || b.createdAt || 0) - ((a.lastMessage?.timestamp) || a.createdAt || 0));

    groupChatsContainer.innerHTML = '';
    myGroups.forEach(group => {
      const memberCount = Object.keys(group.members || {}).length;
      const lastMsg = group.lastMessage?.text || 'لا توجد رسائل بعد';

      const card = document.createElement('div');
      card.className = 'user-card';
      card.innerHTML = `
        <img src="${group.groupAvatar}" alt="${escapeHtml(group.groupName)}" class="user-avatar" style="border-radius:12px;">
        <div class="user-info">
          <h3 class="user-name">${escapeHtml(group.groupName)}</h3>
          <p class="user-bio"><i class="ph ph-users"></i> ${memberCount} أعضاء • ${escapeHtml(lastMsg)}</p>
        </div>
        <div class="card-actions">
          <button class="btn-action btn-primary open-group-chat-btn">
            <i class="ph ph-chat-circle-dots"></i> دخول المحادثة
          </button>
        </div>
      `;

      const openBtn = card.querySelector('.open-group-chat-btn');
      openBtn.addEventListener('click', () => {
        openGroupChatModal(group.groupId, group);
      });

      groupChatsContainer.appendChild(card);
    });
  }, (err) => {
    console.error("Error loading group chats:", err);
    renderEmptyGroupChats();
  });
}

function renderEmptyGroupChats() {
  if (groupChatsContainer) {
    groupChatsContainer.innerHTML = '<div class="empty-msg">لم تنضم إلى أي جروب شات بعد. اضغط على "إنشاء جروب شات" للبدء! 💬</div>';
  }
  if (badgeGroups) badgeGroups.style.display = 'none';
}

function openGroupChatModal(groupId, group) {
  if (!currentUser) return;
  activeChatId = groupId;
  activeChatType = 'group';
  activeChatFriendUid = null;
  activeGroupData = group;

  if (chatFriendAvatar) chatFriendAvatar.src = group.groupAvatar || ('https://api.dicebear.com/9.x/shapes/svg?seed=' + groupId);
  if (chatFriendName) chatFriendName.textContent = group.groupName;
  if (chatFriendStatus) {
    const mCount = Object.keys(group.members || {}).length;
    chatFriendStatus.textContent = `👥 جروب جماعي • ${mCount} أعضاء`;
    chatFriendStatus.style.color = 'var(--gold-primary)';
  }

  const groupInfoBtn = document.getElementById('group-info-btn');
  if (groupInfoBtn) groupInfoBtn.style.display = 'inline-flex';

  if (friendChatModal) friendChatModal.style.display = 'flex';
  if (chatMessageInput) chatMessageInput.focus();

  loadChatMessages(groupId);
}

// ==========================================
// Group Info & Management Logic
// ==========================================
function setupGroupInfoEvents() {
  const groupInfoBtn = document.getElementById('group-info-btn');
  const groupInfoModal = document.getElementById('group-info-modal');
  const closeGroupInfoModal = document.getElementById('close-group-info-modal');
  const btnToggleEditGroup = document.getElementById('btn-toggle-edit-group');
  const editGroupFormContainer = document.getElementById('edit-group-form-container');
  const editGroupNameInput = document.getElementById('edit-group-name-input');
  const editGroupAvatarInput = document.getElementById('edit-group-avatar-input');
  const editGroupDescInput = document.getElementById('edit-group-desc-input');
  const saveGroupEditBtn = document.getElementById('save-group-edit-btn');
  const cancelGroupEditBtn = document.getElementById('cancel-group-edit-btn');

  const btnToggleAddMember = document.getElementById('btn-toggle-add-member');
  const addMemberFormContainer = document.getElementById('add-member-form-container');
  const submitAddMembersBtn = document.getElementById('submit-add-members-btn');
  const cancelAddMembersBtn = document.getElementById('cancel-add-members-btn');

  const leaveGroupBtn = document.getElementById('leave-group-btn');
  const groupMembersList = document.getElementById('group-members-list');

  if (groupInfoBtn) {
    groupInfoBtn.addEventListener('click', loadGroupInfoModal);
  }
  if (closeGroupInfoModal) {
    closeGroupInfoModal.addEventListener('click', () => {
      if (groupInfoModal) groupInfoModal.style.display = 'none';
    });
  }
  if (groupInfoModal) {
    groupInfoModal.addEventListener('click', (e) => {
      if (e.target === groupInfoModal) groupInfoModal.style.display = 'none';
    });
  }

  if (btnToggleEditGroup) {
    btnToggleEditGroup.addEventListener('click', () => {
      if (activeGroupData) {
        if (editGroupNameInput) editGroupNameInput.value = activeGroupData.groupName || '';
        if (editGroupAvatarInput) editGroupAvatarInput.value = activeGroupData.groupAvatar || '';
        if (editGroupDescInput) editGroupDescInput.value = activeGroupData.groupDesc || '';
      }
      if (editGroupFormContainer) editGroupFormContainer.style.display = 'block';
    });
  }

  if (cancelGroupEditBtn) {
    cancelGroupEditBtn.addEventListener('click', () => {
      if (editGroupFormContainer) editGroupFormContainer.style.display = 'none';
    });
  }

  if (saveGroupEditBtn) {
    saveGroupEditBtn.addEventListener('click', async () => {
      if (!activeChatId || !editGroupNameInput) return;
      const newName = editGroupNameInput.value.trim();
      const newAvatar = editGroupAvatarInput ? editGroupAvatarInput.value.trim() : '';
      const newDesc = editGroupDescInput ? editGroupDescInput.value.trim() : '';

      if (!newName) {
        showToast("يرجى إدخال اسم الجروب.", 'error');
        return;
      }

      try {
        const updates = {};
        updates[`chats/${activeChatId}/groupName`] = newName;
        if (newAvatar) updates[`chats/${activeChatId}/groupAvatar`] = newAvatar;
        updates[`chats/${activeChatId}/groupDesc`] = newDesc;

        await update(ref(db), updates);

        showToast("تم تحديث بيانات الجروب بنجاح!", 'success');
        if (editGroupFormContainer) editGroupFormContainer.style.display = 'none';

        if (chatFriendName) chatFriendName.textContent = newName;
        if (chatFriendAvatar && newAvatar) chatFriendAvatar.src = newAvatar;

        loadGroupInfoModal();
      } catch(err) {
        console.error("Error updating group info:", err);
        showToast("تعذر تحديث بيانات الجروب.", 'error');
      }
    });
  }

  if (btnToggleAddMember) {
    btnToggleAddMember.addEventListener('click', populateAddMemberChecklist);
  }

  if (cancelAddMembersBtn) {
    cancelAddMembersBtn.addEventListener('click', () => {
      if (addMemberFormContainer) addMemberFormContainer.style.display = 'none';
    });
  }

  if (submitAddMembersBtn) {
    submitAddMembersBtn.addEventListener('click', async () => {
      const addMemberChecklist = document.getElementById('add-member-checklist');
      if (!activeChatId || !addMemberChecklist) return;

      const checkedInputs = addMemberChecklist.querySelectorAll('input[type="checkbox"]:checked');
      const selectedUids = Array.from(checkedInputs).map(i => i.value);

      if (selectedUids.length === 0) {
        showToast("يرجى اختيار عضو واحد على الأقل لإضافته.", 'error');
        return;
      }

      try {
        const updates = {};
        selectedUids.forEach(uid => {
          updates[`chats/${activeChatId}/members/${uid}`] = true;
          updates[`userGroups/${uid}/${activeChatId}`] = true;
        });

        await update(ref(db), updates);

        showToast("تمت إضافة الأعضاء بنجاح!", 'success');
        if (addMemberFormContainer) addMemberFormContainer.style.display = 'none';

        const groupName = activeGroupData ? activeGroupData.groupName : 'الجروب';
        selectedUids.forEach(uid => {
          createNotification(uid, {
            type: 'group_invite',
            title: `تمت إضافتك إلى جروب "${groupName}"`,
            message: `قام ${currentProfile.username || 'مشرف الجروب'} بإضافتك إلى الجروب.`,
            fromUid: currentUser.uid
          });
        });

        loadGroupInfoModal();
      } catch(err) {
        console.error("Error adding members:", err);
        showToast("تعذر إضافة الأعضاء.", 'error');
      }
    });
  }

  if (groupMembersList) {
    groupMembersList.addEventListener('click', async (e) => {
      const makeAdminBtn = e.target.closest('.make-admin-btn');
      const removeAdminBtn = e.target.closest('.remove-admin-btn');
      const kickMemberBtn = e.target.closest('.kick-member-btn');

      if (makeAdminBtn) {
        const targetUid = makeAdminBtn.dataset.uid;
        if (!targetUid || !activeChatId) return;

        const confirmed = await showCustomConfirm("ترقية إلى أدمن", "هل تريد ترقية هذا العضو إلى مشرف (أدمن) بالجروب؟");
        if (!confirmed) return;

        try {
          await update(ref(db, `chats/${activeChatId}/admins`), { [targetUid]: true });
          showToast("تم ترقية العضو إلى أدمن بنجاح!", 'success');
          loadGroupInfoModal();
        } catch(err) {
          console.error("Error making admin:", err);
          showToast("تعذر ترقية العضو.", 'error');
        }
      }

      if (removeAdminBtn) {
        const targetUid = removeAdminBtn.dataset.uid;
        if (!targetUid || !activeChatId) return;

        const confirmed = await showCustomConfirm("سحب صلاحية الأدمن", "هل تريد سحب صلاحية المشرف من هذا العضو؟");
        if (!confirmed) return;

        try {
          await remove(ref(db, `chats/${activeChatId}/admins/${targetUid}`));
          showToast("تم سحب صلاحية الأدمن.", 'success');
          loadGroupInfoModal();
        } catch(err) {
          console.error("Error removing admin:", err);
          showToast("تعذر سحب الأدمن.", 'error');
        }
      }

      if (kickMemberBtn) {
        const targetUid = kickMemberBtn.dataset.uid;
        const targetName = kickMemberBtn.dataset.name || 'العضو';
        if (!targetUid || !activeChatId) return;

        const confirmed = await showCustomConfirm("طرد من الجروب", `هل أنت تأكد من طرد ${targetName} من الجروب؟`);
        if (!confirmed) return;

        try {
          const updates = {};
          updates[`chats/${activeChatId}/members/${targetUid}`] = null;
          updates[`chats/${activeChatId}/admins/${targetUid}`] = null;
          updates[`userGroups/${targetUid}/${activeChatId}`] = null;

          await update(ref(db), updates);
          showToast(`تم طرد ${targetName} من الجروب.`, 'success');
          loadGroupInfoModal();
        } catch(err) {
          console.error("Error kicking member:", err);
          showToast("تعذر طرد العضو.", 'error');
        }
      }
    });
  }

  if (leaveGroupBtn) {
    leaveGroupBtn.addEventListener('click', async () => {
      if (!activeChatId || !currentUser) return;

      const confirmed = await showCustomConfirm("مغادرة الجروب", "هل أنت تأكد من مغادرة هذا الجروب؟ لن تتمكن من رؤية الرسائل إلا إذا تم إعادة إضافتك.");
      if (!confirmed) return;

      try {
        const updates = {};
        updates[`chats/${activeChatId}/members/${currentUser.uid}`] = null;
        updates[`chats/${activeChatId}/admins/${currentUser.uid}`] = null;
        updates[`userGroups/${currentUser.uid}/${activeChatId}`] = null;

        await update(ref(db), updates);

        showToast("لقد غادرت الجروب بنجاح.", 'info');

        if (groupInfoModal) groupInfoModal.style.display = 'none';
        closeChat();
      } catch(err) {
        console.error("Error leaving group:", err);
        showToast("تعذر مغادرة الجروب.", 'error');
      }
    });
  }
}

async function loadGroupInfoModal() {
  if (!activeChatId || activeChatType !== 'group') return;

  try {
    const gSnap = await get(ref(db, `chats/${activeChatId}`));
    if (!gSnap.exists()) return;
    const group = gSnap.val();
    activeGroupData = group;

    const groupInfoAvatarImg = document.getElementById('group-info-avatar-img');
    const groupInfoDisplayName = document.getElementById('group-info-display-name');
    const groupInfoDisplayDesc = document.getElementById('group-info-display-desc');
    const groupInfoMembersCount = document.getElementById('group-info-members-count');
    const btnToggleEditGroup = document.getElementById('btn-toggle-edit-group');
    const btnToggleAddMember = document.getElementById('btn-toggle-add-member');
    const groupMembersList = document.getElementById('group-members-list');
    const editGroupFormContainer = document.getElementById('edit-group-form-container');
    const addMemberFormContainer = document.getElementById('add-member-form-container');

    if (editGroupFormContainer) editGroupFormContainer.style.display = 'none';
    if (addMemberFormContainer) addMemberFormContainer.style.display = 'none';

    if (groupInfoAvatarImg) groupInfoAvatarImg.src = group.groupAvatar || ('https://api.dicebear.com/9.x/shapes/svg?seed=' + group.groupId);
    if (groupInfoDisplayName) groupInfoDisplayName.textContent = group.groupName;
    if (groupInfoDisplayDesc) groupInfoDisplayDesc.textContent = group.groupDesc || 'لا يوجد وصف للجروب';

    const memberUids = Object.keys(group.members || {});
    if (groupInfoMembersCount) groupInfoMembersCount.textContent = memberUids.length;

    const isCreator = group.createdBy === currentUser.uid;
    const isAdmin = isCreator || Boolean(group.admins && group.admins[currentUser.uid]);

    if (btnToggleEditGroup) btnToggleEditGroup.style.display = isAdmin ? 'inline-flex' : 'none';
    if (btnToggleAddMember) btnToggleAddMember.style.display = isAdmin ? 'inline-flex' : 'none';

    if (groupMembersList) {
      groupMembersList.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:10px;">جاري تحميل قائمة الأعضاء...</div>';

      const memberCards = [];
      for (const mUid of memberUids) {
        let name = 'عضو';
        let avatar = 'https://api.dicebear.com/9.x/adventurer/svg?seed=' + mUid;
        try {
          const uSnap = await get(ref(db, `users/${mUid}`));
          if (uSnap.exists()) {
            const uVal = uSnap.val();
            if (uVal.username) name = uVal.username;
            if (uVal.avatarUrl) avatar = uVal.avatarUrl;
          }
        } catch(e){}

        const isMemberCreator = group.createdBy === mUid;
        const isMemberAdmin = isMemberCreator || Boolean(group.admins && group.admins[mUid]);

        let badgeHtml = '<span class="group-member-badge">عضو</span>';
        if (isMemberCreator) {
          badgeHtml = '<span class="group-member-badge creator"><i class="ph ph-crown"></i> منشئ الجروب</span>';
        } else if (isMemberAdmin) {
          badgeHtml = '<span class="group-member-badge"><i class="ph ph-shield-check"></i> أدمن</span>';
        }

        let actionBtnsHtml = '';
        if (isAdmin && mUid !== currentUser.uid && !isMemberCreator) {
          if (!isMemberAdmin) {
            actionBtnsHtml += `<button class="chat-action-btn make-admin-btn" data-uid="${mUid}" title="تعيين كأدمن"><i class="ph ph-shield-plus"></i> ترقية لأدمن</button>`;
          } else if (isCreator) {
            actionBtnsHtml += `<button class="chat-action-btn remove-admin-btn" data-uid="${mUid}" title="إزالة الأدمن"><i class="ph ph-shield-slash"></i> سحب الأدمن</button>`;
          }
          actionBtnsHtml += `<button class="chat-action-btn delete-btn kick-member-btn" data-uid="${mUid}" data-name="${escapeHtml(name)}" title="إزالة من الجروب"><i class="ph ph-user-minus"></i> طرد</button>`;
        }

        const item = document.createElement('div');
        item.className = 'group-member-item';
        item.innerHTML = `
          <div class="group-member-info">
            <img src="${avatar}" alt="${escapeHtml(name)}" style="width:36px; height:36px; border-radius:50%; border:1px solid var(--gold-primary); object-fit:cover;">
            <div>
              <div style="color:#fff; font-weight:bold; font-size:0.9rem;">${escapeHtml(name)} ${mUid === currentUser.uid ? '<span style="color:var(--text-muted); font-size:0.75rem;">(أنت)</span>' : ''}</div>
              ${badgeHtml}
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            ${actionBtnsHtml}
          </div>
        `;
        memberCards.push(item);
      }

      groupMembersList.innerHTML = '';
      memberCards.forEach(c => groupMembersList.appendChild(c));
    }

    const groupInfoModal = document.getElementById('group-info-modal');
    if (groupInfoModal) groupInfoModal.style.display = 'flex';

  } catch (err) {
    console.error("Error loading group info:", err);
    showToast("حدث خطأ أثناء تحميل معلومات الجروب.", 'error');
  }
}

function populateAddMemberChecklist() {
  const addMemberChecklist = document.getElementById('add-member-checklist');
  const addMemberFormContainer = document.getElementById('add-member-form-container');
  if (!addMemberChecklist || !activeGroupData) return;
  addMemberChecklist.innerHTML = '';

  const currentMemberUids = Object.keys(activeGroupData.members || {});
  const friendUids = Object.keys(myFriends).filter(fUid => !currentMemberUids.includes(fUid));

  if (friendUids.length === 0) {
    addMemberChecklist.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:6px; font-size:0.85rem;">كل أصدقائك موجودون بالفعل في هذا الجروب.</div>';
  } else {
    friendUids.forEach(async (fUid) => {
      const fData = myFriends[fUid];
      let name = fData.username || 'صديق';
      let avatar = fData.avatarUrl || ('https://api.dicebear.com/9.x/adventurer/svg?seed=' + fUid);

      try {
        const uSnap = await get(ref(db, `users/${fUid}`));
        if (uSnap.exists()) {
          const uVal = uSnap.val();
          if (uVal.username) name = uVal.username;
          if (uVal.avatarUrl) avatar = uVal.avatarUrl;
        }
      } catch(e){}

      const label = document.createElement('label');
      label.className = 'group-friend-item';
      label.style.padding = '4px 8px';
      label.innerHTML = `
        <input type="checkbox" value="${fUid}">
        <img src="${avatar}" alt="${escapeHtml(name)}" style="width:28px; height:28px; border-radius:50%; border:1px solid var(--gold-primary); object-fit:cover;">
        <span style="color:#fff; font-size:0.88rem;">${escapeHtml(name)}</span>
      `;
      addMemberChecklist.appendChild(label);
    });
  }

  if (addMemberFormContainer) addMemberFormContainer.style.display = 'block';
}

// 10. Chat Event Setup & Realtime Messaging
function setupChatEvents() {
  if (closeChatModal) {
    closeChatModal.addEventListener('click', closeChat);
  }
  if (friendChatModal) {
    friendChatModal.addEventListener('click', (e) => {
      if (e.target === friendChatModal) closeChat();
    });
  }
  if (chatSendBtn) {
    chatSendBtn.addEventListener('click', sendMessage);
  }
  if (chatMessageInput) {
    chatMessageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  if (chatMessagesContainer) {
    chatMessagesContainer.addEventListener('click', handleChatMessageActions);
  }
}

async function handleChatMessageActions(e) {
  const editBtn = e.target.closest('.edit-msg-btn');
  const deleteBtn = e.target.closest('.delete-msg-btn');

  if (editBtn) {
    const msgKey = editBtn.dataset.msgKey;
    if (!msgKey || !activeChatId) return;

    try {
      const msgSnap = await get(ref(db, `chats/${activeChatId}/messages/${msgKey}`));
      if (!msgSnap.exists()) return;
      const msgVal = msgSnap.val();

      const newText = await showCustomPrompt("تعديل الرسالة", msgVal.text, "اكتب النص الجديد للرسالة...");
      if (newText !== null && newText.trim() !== '' && newText.trim() !== msgVal.text) {
        await update(ref(db, `chats/${activeChatId}/messages/${msgKey}`), {
          text: newText.trim(),
          edited: true,
          editedAt: Date.now()
        });
        showToast("تم تعديل الرسالة بنجاح.", 'success');
      }
    } catch(err) {
      console.error("Error editing message:", err);
      showToast("تعذر تعديل الرسالة.", 'error');
    }
  }

  if (deleteBtn) {
    const msgKey = deleteBtn.dataset.msgKey;
    if (!msgKey || !activeChatId) return;

    const confirmed = await showCustomConfirm("حذف الرسالة", "هل أنت تأكد من حذف هذه الرسالة؟");
    if (confirmed) {
      try {
        await update(ref(db, `chats/${activeChatId}/messages/${msgKey}`), {
          text: "تم حذف هذه الرسالة",
          deleted: true,
          deletedAt: Date.now()
        });
        showToast("تم حذف الرسالة.", 'info');
      } catch(err) {
        console.error("Error deleting message:", err);
        showToast("تعذر حذف الرسالة.", 'error');
      }
    }
  }
}

function openChatModal(friendUid, friendName, friendAvatar) {
  if (!currentUser) return;
  activeChatFriendUid = friendUid;
  activeChatType = 'direct';
  activeChatId = [currentUser.uid, friendUid].sort().join('_');
  activeGroupData = null;

  const groupInfoBtn = document.getElementById('group-info-btn');
  if (groupInfoBtn) groupInfoBtn.style.display = 'none';

  if (chatFriendAvatar) chatFriendAvatar.src = friendAvatar || ('https://api.dicebear.com/9.x/adventurer/svg?seed=' + friendUid);
  if (chatFriendName) chatFriendName.textContent = friendName || 'صديق';
  if (chatFriendStatus) chatFriendStatus.textContent = 'جاري التحقق...';

  // Listen to presence of friend for header
  listenUserPresence(friendUid, (pData) => {
    if (!chatFriendStatus) return;
    if (pData.state === 'online') {
      chatFriendStatus.textContent = '🟢 متصل الآن';
      chatFriendStatus.style.color = '#2ecc71';
    } else {
      chatFriendStatus.textContent = formatPresence(pData.lastSeen, pData.state);
      chatFriendStatus.style.color = 'var(--text-muted)';
    }
  });

  if (friendChatModal) friendChatModal.style.display = 'flex';
  if (chatMessageInput) chatMessageInput.focus();

  loadChatMessages(activeChatId);
}

function loadChatMessages(chatId) {
  const messagesRef = ref(db, `chats/${chatId}/messages`);

  if (chatMessagesContainer) {
    chatMessagesContainer.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding: 30px;">جاري تحميل المحادثة...</div>';
  }

  if (activeChatUnsubscribe) {
    activeChatUnsubscribe();
  }

  activeChatUnsubscribe = onValue(messagesRef, (snapshot) => {
    if (!chatMessagesContainer) return;
    chatMessagesContainer.innerHTML = '';

    if (!snapshot.exists()) {
      chatMessagesContainer.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding: 30px;">لا توجد رسائل سابقة. ابدأ المحادثة الآن! 👋</div>';
      return;
    }

    const messagesObj = snapshot.val();
    const entries = Object.entries(messagesObj).sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));

    entries.forEach(([msgKey, msg]) => {
      const isSentByMe = msg.senderUid === currentUser.uid;
      const msgEl = document.createElement('div');
      msgEl.className = `chat-message-item ${isSentByMe ? 'sent' : 'received'}`;

      let senderHeaderHtml = '';
      if (activeChatType === 'group' && !isSentByMe) {
        senderHeaderHtml = `<div class="chat-sender-header"><i class="ph ph-user"></i> ${escapeHtml(msg.senderName || 'عضو')}</div>`;
      }

      let textContentHtml = '';
      if (msg.deleted) {
        textContentHtml = `<div style="font-style: italic; opacity: 0.6; color: rgba(255,255,255,0.6);"><i class="ph ph-prohibit"></i> تم حذف هذه الرسالة</div>`;
      } else {
        textContentHtml = `<div>${escapeHtml(msg.text)}</div>`;
      }

      const timeStr = msg.timestamp
        ? new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        : '';

      let actionsHtml = '';
      if (isSentByMe && !msg.deleted) {
        actionsHtml = `
          <div class="chat-msg-actions">
            <button class="chat-action-btn edit-msg-btn" data-msg-key="${msgKey}" title="تعديل"><i class="ph ph-pencil"></i></button>
            <button class="chat-action-btn delete-btn delete-msg-btn" data-msg-key="${msgKey}" title="حذف"><i class="ph ph-trash"></i></button>
          </div>
        `;
      }

      let editedTag = msg.edited ? `<span style="font-size:0.7rem; color:var(--gold-primary); margin-left:4px; font-style:italic;">(مُعدّلة)</span>` : '';

      msgEl.innerHTML = `
        ${senderHeaderHtml}
        ${textContentHtml}
        <div class="chat-message-time">
          <span>${timeStr} ${editedTag}</span>
          ${actionsHtml}
        </div>
      `;
      chatMessagesContainer.appendChild(msgEl);
    });

    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  });
}

async function sendMessage() {
  if (!currentUser || !activeChatId) return;
  const text = chatMessageInput.value.trim();
  if (!text) return;

  const messagesRef = ref(db, `chats/${activeChatId}/messages`);
  const myName = currentProfile.username || currentUser.email.split('@')[0];

  chatMessageInput.value = '';

  try {
    const newMsgRef = push(messagesRef);
    await set(newMsgRef, {
      senderUid: currentUser.uid,
      senderName: myName,
      senderAvatar: currentProfile.avatarUrl || '',
      text: text,
      timestamp: Date.now()
    });

    // Update last message in chat info
    await update(ref(db, `chats/${activeChatId}`), {
      lastMessage: {
        text: text,
        senderUid: currentUser.uid,
        senderName: myName,
        timestamp: Date.now()
      }
    });

    // Notify friend if direct chat
    if (activeChatType === 'direct' && activeChatFriendUid) {
      createNotification(activeChatFriendUid, {
        type: 'chat_message',
        title: `رسالة جديدة من ${myName}`,
        message: text.length > 50 ? text.substring(0, 50) + '...' : text,
        fromUid: currentUser.uid,
        fromUsername: myName,
        fromAvatar: currentProfile.avatarUrl || ''
      });
    }

  } catch (err) {
    console.error("Error sending message:", err);
    showToast("حدث خطأ أثناء إرسال الرسالة.", 'error');
  }
}

function closeChat() {
  if (friendChatModal) friendChatModal.style.display = 'none';
  activeChatFriendUid = null;
  activeChatId = null;
  if (activeChatUnsubscribe) {
    activeChatUnsubscribe();
    activeChatUnsubscribe = null;
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

document.addEventListener('DOMContentLoaded', init);
