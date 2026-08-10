import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, onValue, onDisconnect, set, update, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let currentPresenceRef = null;
let lastUserSeenWrite = 0;
const THROTTLE_MS = 5 * 60 * 1000; // 5 minutes throttle

// Initialize presence system for authenticated user
onAuthStateChanged(auth, (user) => {
  if (user) {
    setupUserPresence(user.uid);
  }
});

function setupUserPresence(uid) {
  const connectedRef = ref(db, ".info/connected");
  const presenceRef = ref(db, `presence/${uid}`);
  currentPresenceRef = presenceRef;

  onValue(connectedRef, async (snap) => {
    if (snap.val() === true) {
      // 1. On disconnect handler
      const disconnectRef = onDisconnect(presenceRef);
      await disconnectRef.set({
        state: 'offline',
        lastSeen: Date.now()
      });

      // 2. Set online status
      const now = Date.now();
      await set(presenceRef, {
        state: 'online',
        lastSeen: now
      });

      // 3. Throttled update to users/{uid}/lastSeen
      if (now - lastUserSeenWrite > THROTTLE_MS) {
        lastUserSeenWrite = now;
        try {
          await update(ref(db, `users/${uid}`), { lastSeen: now });
        } catch (err) {
          console.error("Error updating user lastSeen:", err);
        }
      }
    }
  });
}

/**
 * Listen to real-time presence of a specific user
 * @param {string} uid 
 * @param {function} callback - receiving { state: 'online'|'offline', lastSeen: number }
 * @returns {function} unsubscribe function
 */
export function listenUserPresence(uid, callback) {
  if (!uid) return () => {};
  const userPresenceRef = ref(db, `presence/${uid}`);
  const unsubscribe = onValue(userPresenceRef, (snap) => {
    if (snap.exists()) {
      callback(snap.val());
    } else {
      callback({ state: 'offline', lastSeen: 0 });
    }
  });
  return unsubscribe;
}

/**
 * Format lastSeen timestamp and presence state into Arabic human readable text
 * @param {number} lastSeen 
 * @param {string} state - 'online' | 'offline'
 * @returns {string} formatted presence string
 */
export function formatPresence(lastSeen, state) {
  if (state === 'online') {
    return 'متصل الآن';
  }

  if (!lastSeen) {
    return 'غير متصل';
  }

  const diffSec = Math.floor((Date.now() - lastSeen) / 1000);

  if (diffSec < 60) {
    return 'آخر ظهور منذ لحظات';
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `آخر ظهور منذ ${diffMin} دقيقة`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `آخر ظهور منذ ${diffHours} ساعة`;
  }

  const date = new Date(lastSeen);
  const formattedDate = new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);

  return `آخر ظهور: ${formattedDate}`;
}
