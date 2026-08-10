import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut, updateEmail, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get, update, remove, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// DOM elements
const loadingState = document.getElementById('loading-state');
const settingsContent = document.getElementById('settings-content');
const userWelcome = document.getElementById('user-welcome');
const userLogoutBtn = document.getElementById('user-logout-btn');

// Profile controls
const avatarPreview = document.getElementById('avatar-preview');
const settingAvatarUrl = document.getElementById('setting-avatar-url');
const settingUsername = document.getElementById('setting-username');
const settingBio = document.getElementById('setting-bio');
const saveProfileBtn = document.getElementById('save-profile-btn');
const profileStatus = document.getElementById('profile-status');
const presetBtns = document.querySelectorAll('.preset-btn');

// Security controls
const settingEmail = document.getElementById('setting-email');
const updateEmailBtn = document.getElementById('update-email-btn');
const settingNewPassword = document.getElementById('setting-new-password');
const updatePasswordBtn = document.getElementById('update-password-btn');
const securityStatus = document.getElementById('security-status');

// Preferences controls
const settingDeckVisibility = document.getElementById('setting-deck-visibility');
const settingAllowFriendReq = document.getElementById('setting-allow-friend-req');
const settingNotifyFriendReq = document.getElementById('setting-notify-friend-req');
const settingNotifyFriendAccept = document.getElementById('setting-notify-friend-accept');
const savePreferencesBtn = document.getElementById('save-preferences-btn');
const preferencesStatus = document.getElementById('preferences-status');

// Delete Account Modal
const openDeleteModalBtn = document.getElementById('open-delete-modal-btn');
const deleteModal = document.getElementById('delete-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const deleteConfirmInput = document.getElementById('delete-confirm-input');
const modalDeleteStatus = document.getElementById('modal-delete-status');

let currentUser = null;
let userProfile = {};

function init() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      if (userWelcome) userWelcome.textContent = `مرحباً، ${user.email}`;

      await loadUserData();

      setupEventListeners();
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

async function loadUserData() {
  try {
    const userSnap = await get(ref(db, `users/${currentUser.uid}`));
    if (userSnap.exists()) {
      userProfile = userSnap.val();
    }

    if (loadingState) loadingState.style.display = 'none';
    if (settingsContent) settingsContent.style.display = 'grid';

    // Populate Profile
    const defaultAvatar = 'https://api.dicebear.com/9.x/adventurer/svg?seed=' + currentUser.uid;
    settingAvatarUrl.value = userProfile.avatarUrl || '';
    avatarPreview.src = userProfile.avatarUrl || defaultAvatar;
    settingUsername.value = userProfile.username || currentUser.email.split('@')[0];
    settingBio.value = userProfile.bio || '';

    // Populate Security
    settingEmail.value = currentUser.email || '';

    // Populate Preferences
    const settings = userProfile.settings || {};
    settingDeckVisibility.value = settings.deckVisibilityDefault || 'public';
    settingAllowFriendReq.checked = settings.allowFriendRequests !== false;
    settingNotifyFriendReq.checked = settings.notifyFriendRequests !== false;
    settingNotifyFriendAccept.checked = settings.notifyFriendAccepts !== false;

  } catch (err) {
    console.error("Error loading user settings:", err);
  }
}

function setupEventListeners() {
  // Avatar URL change preview
  settingAvatarUrl.addEventListener('input', () => {
    const url = settingAvatarUrl.value.trim();
    avatarPreview.src = url || ('https://api.dicebear.com/9.x/adventurer/svg?seed=' + currentUser.uid);
  });

  // Preset buttons
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const seed = btn.dataset.seed;
      const url = `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}`;
      settingAvatarUrl.value = url;
      avatarPreview.src = url;
    });
  });

  // 1. Save Profile
  saveProfileBtn.addEventListener('click', async () => {
    const username = settingUsername.value.trim();
    const avatarUrl = settingAvatarUrl.value.trim();
    const bio = settingBio.value.trim();

    if (!username) {
      showStatus(profileStatus, 'يرجى إدخال اسم مستخدم صحيح.', 'error');
      return;
    }

    try {
      await update(ref(db, `users/${currentUser.uid}`), {
        username,
        avatarUrl,
        bio
      });
      showStatus(profileStatus, 'تم حفظ بيانات الملف الشخصي بنجاح!', 'success');
    } catch (err) {
      console.error(err);
      showStatus(profileStatus, 'حدث خطأ أثناء حفظ البيانات.', 'error');
    }
  });

  // 2. Update Email
  updateEmailBtn.addEventListener('click', async () => {
    const newEmail = settingEmail.value.trim();
    if (!newEmail || newEmail === currentUser.email) {
      showStatus(securityStatus, 'يرجى إدخال بريد إلكتروني جديد مختلف.', 'error');
      return;
    }

    try {
      await updateEmail(currentUser, newEmail);
      await update(ref(db, `users/${currentUser.uid}`), { email: newEmail });
      showStatus(securityStatus, 'تم تحديث البريد الإلكتروني بنجاح!', 'success');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        showStatus(securityStatus, 'يتطلب هذا الإجراء تسجيل الدخول مجدداً للأمان. يرجى إعادة الدخول والمحاولة.', 'error');
      } else {
        showStatus(securityStatus, `حدث خطأ: ${err.message}`, 'error');
      }
    }
  });

  // 3. Update Password
  updatePasswordBtn.addEventListener('click', async () => {
    const newPassword = settingNewPassword.value;
    if (!newPassword || newPassword.length < 6) {
      showStatus(securityStatus, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.', 'error');
      return;
    }

    try {
      await updatePassword(currentUser, newPassword);
      settingNewPassword.value = '';
      showStatus(securityStatus, 'تم تحديث كلمة المرور بنجاح!', 'success');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        showStatus(securityStatus, 'يتطلب هذا الإجراء تسجيل الدخول مجدداً للأمان.', 'error');
      } else {
        showStatus(securityStatus, `حدث خطأ: ${err.message}`, 'error');
      }
    }
  });

  // 4. Save Preferences
  savePreferencesBtn.addEventListener('click', async () => {
    const prefs = {
      deckVisibilityDefault: settingDeckVisibility.value,
      allowFriendRequests: settingAllowFriendReq.checked,
      notifyFriendRequests: settingNotifyFriendReq.checked,
      notifyFriendAccepts: settingNotifyFriendAccept.checked
    };

    try {
      await update(ref(db, `users/${currentUser.uid}/settings`), prefs);
      showStatus(preferencesStatus, 'تم حفظ التفضيلات بنجاح!', 'success');
    } catch (err) {
      console.error(err);
      showStatus(preferencesStatus, 'حدث خطأ أثناء حفظ التفضيلات.', 'error');
    }
  });

  // 5. Delete Account Modal Trigger
  openDeleteModalBtn.addEventListener('click', () => {
    deleteModal.classList.add('active');
    deleteConfirmInput.value = '';
    confirmDeleteBtn.disabled = true;
    if (modalDeleteStatus) modalDeleteStatus.style.display = 'none';
  });

  cancelDeleteBtn.addEventListener('click', () => {
    deleteModal.classList.remove('active');
  });

  deleteConfirmInput.addEventListener('input', () => {
    confirmDeleteBtn.disabled = deleteConfirmInput.value.trim() !== 'حذف';
  });

  // Confirm Soft Delete
  confirmDeleteBtn.addEventListener('click', async () => {
    try {
      const uid = currentUser.uid;

      // Soft delete in database
      const updates = {};
      updates[`users/${uid}/status`] = 'deleted';
      updates[`users/${uid}/username`] = 'مستخدم محذوف';
      updates[`users/${uid}/bio`] = '';
      updates[`users/${uid}/avatarUrl`] = 'https://api.dicebear.com/9.x/adventurer/svg?seed=deleted';
      updates[`presence/${uid}`] = null;

      await update(ref(db), updates);

      showStatus(modalDeleteStatus, 'تم تعطيل/حذف الحساب بنجاح. جاري الخروج...', 'success');

      setTimeout(async () => {
        try {
          await currentUser.delete();
        } catch (e) {
          console.log("Auth user delete requirement:", e);
        }
        await signOut(auth);
        window.location.replace('index.html');
      }, 1500);

    } catch (err) {
      console.error("Error deleting account:", err);
      showStatus(modalDeleteStatus, 'حدث خطأ أثناء حذف الحساب.', 'error');
    }
  });
}

function showStatus(element, text, type) {
  if (!element) return;
  element.textContent = text;
  element.className = `status-msg ${type}`;
  element.style.display = 'block';

  setTimeout(() => {
    element.style.display = 'none';
  }, 5000);
}

document.addEventListener('DOMContentLoaded', init);
