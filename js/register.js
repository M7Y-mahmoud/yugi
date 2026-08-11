import { registerUser, handleAuthError } from './auth.js';
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('register-form');
  const usernameInput = document.getElementById('reg-username');
  const emailInput = document.getElementById('reg-email');
  const passwordInput = document.getElementById('reg-password');
  const togglePasswordBtn = document.getElementById('toggle-password');
  const errorMsg = document.getElementById('reg-error-msg');
  
  // التحقق إذا كان المستخدم مسجلاً بالفعل
  onAuthStateChanged(auth, (user) => {
    if (user && !window.location.pathname.includes('admin')) {
      window.location.replace('index.html');
    }
  });

  // إظهار/إخفاء كلمة المرور
  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      
      if (type === 'text') {
        togglePasswordBtn.classList.remove('ph-eye');
        togglePasswordBtn.classList.add('ph-eye-slash');
      } else {
        togglePasswordBtn.classList.remove('ph-eye-slash');
        togglePasswordBtn.classList.add('ph-eye');
      }
    });
  }

  // التعامل مع فورم التسجيل
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorMsg.textContent = '';
      
      const username = usernameInput.value.trim();
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const submitBtn = registerForm.querySelector('.btn-submit');
      
      if (password.length < 6) {
        errorMsg.textContent = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.';
        return;
      }
      
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> جاري الإنشاء...';
      
      try {
        await registerUser(email, password, username);
        // سيتم التوجيه تلقائيًا من خلال onAuthStateChanged
      } catch (error) {
        console.error(error);
        errorMsg.textContent = handleAuthError(error);
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }
});
