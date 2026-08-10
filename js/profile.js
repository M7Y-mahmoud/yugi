import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { listenUserPresence, formatPresence } from "./presence.js";

const loadingState = document.getElementById('loading-state');
const profileContainer = document.getElementById('profile-container');
const profileAvatar = document.getElementById('profile-avatar');
const profileName = document.getElementById('profile-name');
const profileJoinDate = document.getElementById('profile-join-date');
const profileLastSeen = document.getElementById('profile-last-seen');
const profileBio = document.getElementById('profile-bio');
const statDecks = document.getElementById('stat-decks');
const statFavorites = document.getElementById('stat-favorites');
const statFriends = document.getElementById('stat-friends');
const userLogoutBtn = document.getElementById('user-logout-btn');
const userWelcome = document.getElementById('user-welcome');

let currentUser = null;

function init() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      userWelcome.textContent = `مرحباً، ${user.email}`;
      loadUserProfile();
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

function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

async function loadUserProfile() {
  const userRef = ref(db, `users/${currentUser.uid}`);
  
  onValue(userRef, async (snapshot) => {
    loadingState.style.display = 'none';
    profileContainer.style.display = 'block';
    
    if (snapshot.exists()) {
      const userData = snapshot.val();
      
      profileName.textContent = userData.username || currentUser.email.split('@')[0];
      profileAvatar.src = userData.avatarUrl || 'https://api.dicebear.com/9.x/adventurer/svg?seed=' + currentUser.uid;
      profileBio.textContent = userData.bio || 'لا توجد نبذة شخصية.';
      profileJoinDate.textContent = formatDate(userData.createdAt);
      
      // Listen to real-time presence
      listenUserPresence(currentUser.uid, (pData) => {
        if (profileLastSeen) {
          profileLastSeen.textContent = formatPresence(pData.lastSeen, pData.state);
        }
      });
      
      // Load Decks count
      const decksRef = ref(db, `users/${currentUser.uid}/decks`);
      const decksSnapshot = await get(decksRef);
      if (decksSnapshot.exists()) {
        statDecks.textContent = Object.keys(decksSnapshot.val()).length;
      }
      
      // Load Favorites count
      const favsRef = ref(db, `favorites/${currentUser.uid}`);
      const favsSnapshot = await get(favsRef);
      if (favsSnapshot.exists()) {
        statFavorites.textContent = Object.keys(favsSnapshot.val()).length;
      }
      
      // Load Friends count
      const friendsRef = ref(db, `friends/${currentUser.uid}`);
      const friendsSnapshot = await get(friendsRef);
      if (friendsSnapshot.exists()) {
        statFriends.textContent = Object.keys(friendsSnapshot.val()).length;
      }
      
    } else {
      profileName.textContent = currentUser.email.split('@')[0];
      profileJoinDate.textContent = 'جديد';
      profileLastSeen.textContent = 'متصل الآن';
    }
  }, (error) => {
    console.error("Error loading profile:", error);
    loadingState.innerHTML = '<span style="color:var(--accent-wine);">حدث خطأ أثناء تحميل الملف الشخصي.</span>';
  });
}

document.addEventListener('DOMContentLoaded', init);
