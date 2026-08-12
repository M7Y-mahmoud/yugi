import { loginUser, handleAuthError, resetPassword } from './auth.js';
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const togglePasswordBtn = document.getElementById('toggle-password');
  const errorMsg = document.getElementById('login-error-msg');
  
  const forgotPasswordLink = document.querySelector('.forgot-password');
  const forgotModal = document.getElementById('forgot-password-modal');
  const closeForgotModal = document.querySelector('.auth-modal-close');
  const forgotForm = document.getElementById('forgot-password-form');
  const forgotEmailInput = document.getElementById('forgot-email-input');
  const forgotErrorMsg = document.getElementById('forgot-error-msg');
  const forgotSuccessMsg = document.getElementById('forgot-success-msg');
  
  // التحقق إذا كان المستخدم مسجلاً بالفعل، يتم تحويله للرئيسية
  onAuthStateChanged(auth, (user) => {
    if (user && !window.location.pathname.includes('admin')) {
      window.location.replace('index.html');
    }
  });

  // Modal استعادة كلمة المرور
  if (forgotPasswordLink && forgotModal) {
    forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      forgotModal.style.display = 'flex';
      if (emailInput && emailInput.value) {
        forgotEmailInput.value = emailInput.value;
      }
    });
  }

  if (closeForgotModal) {
    closeForgotModal.addEventListener('click', () => {
      forgotModal.style.display = 'none';
      forgotErrorMsg.textContent = '';
      forgotSuccessMsg.style.display = 'none';
    });
  }

  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      forgotErrorMsg.textContent = '';
      forgotSuccessMsg.style.display = 'none';
      
      const email = forgotEmailInput.value.trim();
      const submitBtn = forgotForm.querySelector('.btn-submit');
      const originalText = submitBtn.textContent;
      
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> جاري الإرسال...';
      
      try {
        await resetPassword(email);
        forgotSuccessMsg.textContent = 'تم إرسال رابط إعادة التعيين بنجاح. يرجى مراجعة صندوق البريد الخاص بك (بما في ذلك صندوق المهملات/Spam).';
        forgotSuccessMsg.style.display = 'block';
        forgotForm.reset();
      } catch (error) {
        console.error(error);
        forgotErrorMsg.textContent = handleAuthError(error);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

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

  // التعامل مع فورم الدخول
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorMsg.textContent = '';
      
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const submitBtn = loginForm.querySelector('.btn-submit');
      
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> جاري التحقق...';
      
      try {
        await loginUser(email, password);
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
import './millennium-effect.js';
