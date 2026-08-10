import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const userLogoutBtn = document.getElementById('user-logout-btn');
const userWelcome = document.getElementById('user-welcome');

function init() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      userWelcome.textContent = `مرحباً، ${user.email}`;
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

document.addEventListener('DOMContentLoaded', init);
