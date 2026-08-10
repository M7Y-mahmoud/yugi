import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let notifUnsubscribe = null;

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
});

function initNavbar() {
  ensureTopNavbarExists();
  setupSideMenuEvents();
  setupDropdownEvents();
  setupAuthStateListener();
}

/**
 * Creates top navbar dynamically if it doesn't exist in DOM
 */
function ensureTopNavbarExists() {
  if (document.getElementById('top-navbar')) return;

  const navbarHtml = `
    <header id="top-navbar" class="top-navbar">
      <div class="navbar-container">
        <a href="index.html" class="navbar-brand">
          <img src="public/assets/images/logo.png" alt="Yu-Gi-Oh!" class="navbar-logo">
        </a>

        <div class="navbar-nav-links">
          <a href="index.html" id="nav-home-link"><i class="ph ph-house"></i> الرئيسية</a>
          <a href="library.html" id="nav-library-link"><i class="ph ph-cards"></i> البطاقات</a>
        </div>

        <div class="navbar-user-area">
          <!-- Guest view -->
          <button id="top-login-btn" class="btn-top-login" style="display: none;">
            <i class="ph ph-sign-in"></i> تسجيل الدخول
          </button>

          <!-- User logged-in view -->
          <div id="top-user-dropdown" class="user-dropdown-container" style="display: none;">
            <button id="user-dropdown-trigger" class="dropdown-trigger">
              <img id="top-user-avatar" src="https://api.dicebear.com/9.x/adventurer/svg?seed=default" alt="User" class="nav-avatar">
              <span id="top-username" class="nav-username">المستخدم</span>
              <span id="top-notif-badge" class="nav-notif-badge" style="display: none;">0</span>
              <i class="ph ph-caret-down"></i>
            </button>

            <div id="user-dropdown-menu" class="dropdown-menu">
              <a href="account.html"><i class="ph ph-user-circle"></i> حسابي</a>
              <a href="profile.html"><i class="ph ph-user"></i> الملف الشخصي</a>
              <a href="library.html"><i class="ph ph-cards"></i> مجموعاتي</a>
              <a href="favorites.html"><i class="ph ph-star"></i> المفضلة</a>
              <a href="friends.html"><i class="ph ph-users"></i> الأصدقاء</a>
              <a href="notifications.html" class="notif-menu-item">
                <span><i class="ph ph-bell"></i> الإشعارات</span>
                <span id="menu-notif-badge" class="badge-count" style="display: none;">0</span>
              </a>
              <a href="settings.html"><i class="ph ph-gear"></i> الإعدادات</a>
              <a href="admin/dashboard.html" id="top-admin-link" style="display: none;"><i class="ph ph-shield-check"></i> الإدارة</a>
              <div class="dropdown-divider"></div>
              <button id="top-logout-btn" class="dropdown-logout-btn"><i class="ph ph-sign-out"></i> تسجيل الخروج</button>
            </div>
          </div>
        </div>
      </div>
    </header>
  `;

  document.body.insertAdjacentHTML('afterbegin', navbarHtml);

  // Set active class on current top nav links
  const currentPath = window.location.pathname;
  if (currentPath.endsWith('index.html') || currentPath === '/') {
    const homeLink = document.getElementById('nav-home-link');
    if (homeLink) homeLink.classList.add('active');
  } else if (currentPath.includes('library.html')) {
    const libLink = document.getElementById('nav-library-link');
    if (libLink) libLink.classList.add('active');
  }
}

/**
 * Handles side menu toggle logic
 */
function setupSideMenuEvents() {
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const closeMenuBtn = document.getElementById('close-menu-btn');
  const sideMenu = document.getElementById('side-menu');
  const menuOverlay = document.getElementById('menu-overlay');

  function toggleMenu() {
    if (!sideMenu || !menuOverlay) return;
    sideMenu.classList.toggle('active');
    menuOverlay.classList.toggle('active');
    
    if (sideMenu.classList.contains('active')) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  if (hamburgerBtn) hamburgerBtn.addEventListener('click', toggleMenu);
  if (closeMenuBtn) closeMenuBtn.addEventListener('click', toggleMenu);
  if (menuOverlay) menuOverlay.addEventListener('click', toggleMenu);
}

/**
 * Handles dropdown menu toggle and outside click dismiss
 */
function setupDropdownEvents() {
  const trigger = document.getElementById('user-dropdown-trigger');
  const menu = document.getElementById('user-dropdown-menu');

  if (trigger && menu) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && !trigger.contains(e.target)) {
        menu.classList.remove('active');
      }
    });
  }
}

/**
 * Firebase Auth Listener and Notification Badge Counter
 */
function setupAuthStateListener() {
  onAuthStateChanged(auth, async (user) => {
    const topLoginBtn = document.getElementById('top-login-btn');
    const topUserDropdown = document.getElementById('top-user-dropdown');
    const topUserAvatar = document.getElementById('top-user-avatar');
    const topUsername = document.getElementById('top-username');
    const topAdminLink = document.getElementById('top-admin-link');
    const topLogoutBtn = document.getElementById('top-logout-btn');

    // Side menu elements
    const sideLoginBtn = document.getElementById('user-login-btn');
    const sideProfileContainer = document.getElementById('user-profile-container');
    const sideWelcome = document.getElementById('user-welcome');
    const sideAdminLink = document.getElementById('admin-link-dropdown');
    const sideLogoutBtn = document.getElementById('user-logout-btn');

    if (user) {
      // Logged-in view
      if (topLoginBtn) topLoginBtn.style.display = 'none';
      if (sideLoginBtn) sideLoginBtn.style.display = 'none';
      if (topUserDropdown) topUserDropdown.style.display = 'block';
      if (sideProfileContainer) sideProfileContainer.style.display = 'block';

      // Load User Profile Data
      try {
        const userSnap = await get(ref(db, `users/${user.uid}`));
        const userData = userSnap.exists() ? userSnap.val() : {};
        const name = userData.username || user.email.split('@')[0];
        const avatar = userData.avatarUrl || `https://api.dicebear.com/9.x/adventurer/svg?seed=${user.uid}`;

        if (topUsername) topUsername.textContent = name;
        if (topUserAvatar) topUserAvatar.src = avatar;
        if (sideWelcome) sideWelcome.textContent = name;
      } catch (err) {
        console.error("Error loading navbar user profile:", err);
      }

      // Check Admin Role
      try {
        const adminSnap = await get(ref(db, `admins/${user.uid}`));
        if (adminSnap.exists()) {
          if (topAdminLink) topAdminLink.style.display = 'flex';
          if (sideAdminLink) sideAdminLink.style.display = 'flex';
        }
      } catch (err) {
        console.error("Error checking admin status:", err);
      }

      // Real-time Unread Notifications Counter
      setupNotificationsCounter(user.uid);

      // Logout handler
      const handleLogout = async () => {
        try {
          if (notifUnsubscribe) notifUnsubscribe();
          await signOut(auth);
          window.location.replace('index.html');
        } catch (err) {
          console.error("Error signing out:", err);
        }
      };

      if (topLogoutBtn) topLogoutBtn.onclick = handleLogout;
      if (sideLogoutBtn) sideLogoutBtn.onclick = handleLogout;

    } else {
      // Guest view
      if (topLoginBtn) topLoginBtn.style.display = 'flex';
      if (sideLoginBtn) sideLoginBtn.style.display = 'flex';
      if (topUserDropdown) topUserDropdown.style.display = 'none';
      if (sideProfileContainer) sideProfileContainer.style.display = 'none';

      if (notifUnsubscribe) {
        notifUnsubscribe();
        notifUnsubscribe = null;
      }

      // Login trigger for guests
      const openLoginModal = () => {
        ensureAuthModalExists();
        const authModal = document.getElementById('auth-modal');
        if (authModal) authModal.style.display = 'block';
      };

      if (topLoginBtn) topLoginBtn.onclick = openLoginModal;
      if (sideLoginBtn) sideLoginBtn.onclick = openLoginModal;
    }
  });
}

/**
 * Listens to unread notifications and updates badges
 */
function setupNotificationsCounter(uid) {
  const notifRef = ref(db, `notifications/${uid}`);
  notifUnsubscribe = onValue(notifRef, (snap) => {
    let unreadCount = 0;
    if (snap.exists()) {
      const data = snap.val();
      Object.values(data).forEach(item => {
        if (item.read === false) unreadCount++;
      });
    }

    const topBadge = document.getElementById('top-notif-badge');
    const menuBadge = document.getElementById('menu-notif-badge');

    if (topBadge) {
      if (unreadCount > 0) {
        topBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        topBadge.style.display = 'inline-block';
      } else {
        topBadge.style.display = 'none';
      }
    }

    if (menuBadge) {
      if (unreadCount > 0) {
        menuBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        menuBadge.style.display = 'inline-block';
      } else {
        menuBadge.style.display = 'none';
      }
    }
  });
}

/**
 * Dynamically injects Auth Modal if missing
 */
function ensureAuthModalExists() {
  if (document.getElementById('auth-modal')) return;

  const modalHtml = `
    <div id="auth-modal" class="modal" style="display: none;">
      <div class="modal-content">
        <span class="close-btn" id="close-auth-modal">&times;</span>
        <h2>تسجيل الدخول / إنشاء حساب</h2>
        <form id="auth-form">
          <input type="email" id="auth-email" placeholder="البريد الإلكتروني" required class="form-control" style="margin-bottom: 10px;">
          <input type="password" id="auth-password" placeholder="كلمة المرور" required class="form-control" style="margin-bottom: 15px;">
          <div style="display: flex; gap: 10px;">
            <button type="submit" id="auth-login-btn" style="flex: 1;">دخول</button>
            <button type="button" id="auth-register-btn" style="flex: 1; background: rgba(212, 175, 55, 0.2); color: var(--gold-bright);">تسجيل جديد</button>
          </div>
          <p id="auth-error" style="color: #e74c3c; margin-top: 10px; font-size: 0.9rem;"></p>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const authModal = document.getElementById('auth-modal');
  const closeBtn = document.getElementById('close-auth-modal');
  const authForm = document.getElementById('auth-form');
  const authEmail = document.getElementById('auth-email');
  const authPassword = document.getElementById('auth-password');
  const authRegisterBtn = document.getElementById('auth-register-btn');
  const authError = document.getElementById('auth-error');

  if (closeBtn) {
    closeBtn.onclick = () => {
      authModal.style.display = 'none';
    };
  }

  if (authForm) {
    authForm.onsubmit = async (e) => {
      e.preventDefault();
      authError.textContent = '';
      try {
        await signInWithEmailAndPassword(auth, authEmail.value.trim(), authPassword.value);
        authModal.style.display = 'none';
      } catch (err) {
        authError.textContent = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      }
    };
  }

  if (authRegisterBtn) {
    authRegisterBtn.onclick = async () => {
      authError.textContent = '';
      if (!authEmail.value || !authPassword.value) {
        authError.textContent = 'يرجى إدخال البريد الإلكتروني وكلمة المرور.';
        return;
      }
      try {
        await createUserWithEmailAndPassword(auth, authEmail.value.trim(), authPassword.value);
        authModal.style.display = 'none';
      } catch (err) {
        authError.textContent = err.message || 'حدث خطأ أثناء التسجيل.';
      }
    };
  }
}
