import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get, set, update, remove, onValue, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// DOM elements
const loadingState = document.getElementById('loading-state');
const userLogoutBtn = document.getElementById('user-logout-btn');
const userWelcome = document.getElementById('user-welcome');

const notifListContainer = document.getElementById('notif-list-container');
const filterBtns = document.querySelectorAll('.filter-btn');
const markAllReadBtn = document.getElementById('mark-all-read-btn');
const clearAllBtn = document.getElementById('clear-all-btn');
const unreadCountBadge = document.getElementById('unread-count');

let currentUser = null;
let notificationsMap = {};
let currentFilter = 'all';

function init() {
  setupFilterBtns();

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      if (userWelcome) userWelcome.textContent = `مرحباً، ${user.email}`;

      listenToNotifications();

      if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', markAllAsRead);
      }
      if (clearAllBtn) {
        clearAllBtn.addEventListener('click', clearAllNotifications);
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

// Helper: send notification to any recipient
export async function sendNotification(recipientUid, data) {
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
    console.error("Error sending notification:", err);
  }
}

function setupFilterBtns() {
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderNotifications();
    });
  });
}

function listenToNotifications() {
  const notifRef = ref(db, `notifications/${currentUser.uid}`);
  onValue(notifRef, (snapshot) => {
    if (loadingState) loadingState.style.display = 'none';

    if (snapshot.exists()) {
      notificationsMap = snapshot.val();
    } else {
      notificationsMap = {};
    }

    renderNotifications();
  });
}

function renderNotifications() {
  if (!notifListContainer) return;
  notifListContainer.innerHTML = '';

  const entries = Object.entries(notificationsMap);
  
  // Calculate unread count
  const unreadCount = entries.filter(([_, n]) => !n.read).length;
  if (unreadCountBadge) {
    if (unreadCount > 0) {
      unreadCountBadge.textContent = unreadCount;
      unreadCountBadge.style.display = 'inline-block';
    } else {
      unreadCountBadge.style.display = 'none';
    }
  }

  // Filter entries
  let filtered = entries;
  if (currentFilter === 'unread') {
    filtered = entries.filter(([_, n]) => !n.read);
  }

  // Sort descending by timestamp
  filtered.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));

  if (filtered.length === 0) {
    notifListContainer.innerHTML = `
      <div class="empty-notif">
        <i class="ph ph-bell-slash"></i>
        <p>${currentFilter === 'unread' ? 'لا توجد إشعارات غير مقروءة.' : 'لا توجد إشعارات حالياً.'}</p>
      </div>
    `;
    return;
  }

  filtered.forEach(([notifId, notif]) => {
    const card = document.createElement('div');
    card.className = `notif-card ${!notif.read ? 'unread' : ''}`;

    let iconClass = 'ph ph-bell';
    if (notif.type === 'friend_request') iconClass = 'ph ph-user-plus';
    else if (notif.type === 'friend_accept') iconClass = 'ph ph-user-check';

    const formattedTime = formatTimeAgo(notif.timestamp);

    card.innerHTML = `
      <div class="notif-icon-box">
        <i class="${iconClass}"></i>
      </div>
      <div class="notif-content">
        <div class="notif-title-row">
          <h4 class="notif-title">${notif.title || 'إشعار'}</h4>
          <span class="notif-time">${formattedTime}</span>
        </div>
        <p class="notif-message">${notif.message || ''}</p>
        <div class="notif-card-actions">
          ${!notif.read ? `<button class="btn-notif-small mark-read-btn" data-id="${notifId}"><i class="ph ph-check"></i> تحديد كمقروء</button>` : ''}
          <button class="btn-notif-small delete-notif delete-btn" data-id="${notifId}"><i class="ph ph-trash"></i> حذف</button>
        </div>
      </div>
    `;

    // Click card to navigate or mark read
    card.addEventListener('click', (e) => {
      if (e.target.closest('.delete-btn') || e.target.closest('.mark-read-btn')) return;

      if (!notif.read) {
        markAsRead(notifId);
      }

      if (notif.type === 'friend_request' || notif.type === 'friend_accept') {
        window.location.href = 'friends.html';
      }
    });

    const markReadBtn = card.querySelector('.mark-read-btn');
    if (markReadBtn) {
      markReadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        markAsRead(notifId);
      });
    }

    const deleteBtn = card.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNotification(notifId);
      });
    }

    notifListContainer.appendChild(card);
  });
}

async function markAsRead(notifId) {
  try {
    await update(ref(db, `notifications/${currentUser.uid}/${notifId}`), { read: true });
  } catch (err) {
    console.error("Error marking notification read:", err);
  }
}

async function deleteNotification(notifId) {
  try {
    await remove(ref(db, `notifications/${currentUser.uid}/${notifId}`));
  } catch (err) {
    console.error("Error deleting notification:", err);
  }
}

async function markAllAsRead() {
  if (!currentUser) return;
  const updates = {};
  Object.keys(notificationsMap).forEach(id => {
    if (!notificationsMap[id].read) {
      updates[`notifications/${currentUser.uid}/${id}/read`] = true;
    }
  });

  if (Object.keys(updates).length > 0) {
    try {
      await update(ref(db), updates);
    } catch (err) {
      console.error("Error marking all notifications read:", err);
    }
  }
}

async function clearAllNotifications() {
  if (!currentUser) return;
  if (!confirm('هل أنت تأكد من مسح جميع الإشعارات؟')) return;

  try {
    await remove(ref(db, `notifications/${currentUser.uid}`));
  } catch (err) {
    console.error("Error clearing notifications:", err);
  }
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const diffSec = Math.floor((now - timestamp) / 1000);

  if (diffSec < 60) return 'الآن';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  const diffDays = Math.floor(diffHours / 24);
  return `منذ ${diffDays} يوم`;
}

document.addEventListener('DOMContentLoaded', init);
