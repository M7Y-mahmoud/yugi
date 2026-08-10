import { signInWithEmailAndPassword, signOut, onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateEmail, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { auth, db } from "./firebase-config.js";
import { logActivity } from "./activity-log.js";

const loginForm = document.getElementById('admin-login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

let isLoggingIn = false;

// قائمة الصفحات المحمية للمستخدمين العاديين
const PROTECTED_USER_ROUTES = [
  '/my-library.html',
  '/settings.html',
  '/profile.html',
  '/friends.html',
  '/favorites.html',
  '/notifications.html',
  '/account.html' // اسم مقترح للوحة تحكم المستخدم لمنع التعارض مع لوحة تحكم الإدارة
];

onAuthStateChanged(auth, async (user) => {
  const currentPath = window.location.pathname;
  
  if (user) {
    if (currentPath.includes('admin/login.html') && !isLoggingIn) {
      try {
        const adminRef = ref(db, `admins/${user.uid}`);
        const snapshot = await get(adminRef);
        if (snapshot.exists()) {
          window.location.replace('dashboard.html');
        }
      } catch (err) {
        console.error(err);
      }
    }
  } else {
    // Admin guard
    if (currentPath.includes('/admin/dashboard.html')) {
      window.location.replace('login.html');
    }
    
    // User guard
    const isProtected = PROTECTED_USER_ROUTES.some(route => currentPath.includes(route));
    if (isProtected) {
      window.location.replace('index.html'); // التوجيه للصفحة الرئيسية في حال لم يكن مسجلاً للدخول
    }
  }
});

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'جاري التحقق...';
    
    try {
      isLoggingIn = true;
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      const adminRef = ref(db, `admins/${userCredential.user.uid}`);
      const snapshot = await get(adminRef);
      if (!snapshot.exists()) {
         await signOut(auth);
         throw new Error("ليس لديك صلاحية الدخول للوحة التحكم.");
      }
      
      await logActivity('login', null, 'تم تسجيل الدخول بنجاح');
      window.location.replace('dashboard.html');
    } catch (error) {
      isLoggingIn = false;
      console.error(error);
      loginError.textContent = handleAuthError(error);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error", error);
    }
  });
}

/**
 * إعادة المصادقة للمستخدم المسجل دخوله
 * @param {string} password 
 */
export async function reauthenticateUser(password) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("لا يوجد مستخدم مسجل الدخول.");
  const credential = EmailAuthProvider.credential(user.email, password);
  return await reauthenticateWithCredential(user, credential);
}

/**
 * تغيير كلمة المرور
 * @param {string} currentPassword 
 * @param {string} newPassword 
 */
export async function changeUserPassword(currentPassword, newPassword) {
  try {
    await reauthenticateUser(currentPassword);
    await updatePassword(auth.currentUser, newPassword);
  } catch (error) {
    throw new Error(handleAuthError(error));
  }
}

/**
 * تغيير البريد الإلكتروني
 * @param {string} currentPassword 
 * @param {string} newEmail 
 */
export async function changeUserEmail(currentPassword, newEmail) {
  try {
    await reauthenticateUser(currentPassword);
    await updateEmail(auth.currentUser, newEmail);
  } catch (error) {
    throw new Error(handleAuthError(error));
  }
}

/**
 * معالجة رسائل الخطأ من Firebase بشكل موحد
 * @param {Error} error 
 * @returns {string} رسالة الخطأ بالعربية
 */
export function handleAuthError(error) {
  if (error.message === "ليس لديك صلاحية الدخول للوحة التحكم." || error.message === "لا يوجد مستخدم مسجل الدخول.") {
    return error.message;
  }
  
  switch (error.code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    case 'auth/too-many-requests':
      return 'محاولات كثيرة خاطئة. يرجى المحاولة لاحقاً.';
    case 'auth/email-already-in-use':
      return 'البريد الإلكتروني مستخدم بالفعل.';
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صحيحة.';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة. يجب أن تتكون من 6 أحرف على الأقل.';
    case 'auth/requires-recent-login':
      return 'يجب تسجيل الدخول مرة أخرى لتنفيذ هذه العملية.';
    case 'auth/operation-not-allowed':
      return 'هذه العملية غير مسموح بها حالياً.';
    default:
      return 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
  }
}

/**
 * إنشاء حساب مستخدم جديد وإعداد ملفه الشخصي في قاعدة البيانات
 * @param {string} email 
 * @param {string} password 
 */
export async function registerUser(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // إنشاء الملف الشخصي الأساسي
    const userRef = ref(db, `users/${user.uid}`);
    await set(userRef, {
      username: email.split('@')[0],
      email: email,
      avatarUrl: `https://api.dicebear.com/9.x/adventurer/svg?seed=${user.uid}`,
      bio: '',
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      settings: {
        notificationsEnabled: true,
        privacy: 'public'
      }
    });
    
    return userCredential;
  } catch (error) {
    throw error;
  }
}

/**
 * تسجيل دخول مستخدم وتحديث تاريخ آخر دخول
 * @param {string} email 
 * @param {string} password 
 */
export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // تحديث تاريخ آخر دخول
    const userRef = ref(db, `users/${user.uid}/lastLogin`);
    await set(userRef, serverTimestamp());
    
    return userCredential;
  } catch (error) {
    throw error;
  }
}
