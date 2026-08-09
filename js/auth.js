import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { auth, db } from "./firebase-config.js";
import { logActivity } from "./activity-log.js";

const loginForm = document.getElementById('admin-login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

let isLoggingIn = false;

onAuthStateChanged(auth, async (user) => {
  const currentPath = window.location.pathname;
  
  if (user) {
    if (currentPath.includes('admin/login.html') && !isLoggingIn) {
      try {
        const adminRef = ref(db, `admins/${user.uid}`);
        const snapshot = await get(adminRef);
        if (snapshot.exists()) {
          window.location.replace('dashboard.html');
        } else {
          // not an admin, don't redirect
        }
      } catch (err) {
        // Handle gracefully
      }
    }
  } else {
    if (currentPath.includes('/admin/dashboard.html')) {
      window.location.replace('login.html');
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
      let errorMessage = 'حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'محاولات كثيرة خاطئة. يرجى المحاولة لاحقاً.';
      } else if (error.message === "ليس لديك صلاحية الدخول للوحة التحكم.") {
        errorMessage = error.message;
      }
      loginError.textContent = errorMessage;
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
