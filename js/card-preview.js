import { auth, db } from "./firebase-config.js";
import { ref, get, set, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let pressTimer;
let isPreviewing = false;
let currentPreviewCardId = null;

export function setupCardPreview(cardElement, cardOrUrl, explicitCardId = null) {
  if (!cardElement) return;
  let imageUrl = typeof cardOrUrl === 'string' 
    ? cardOrUrl 
    : (cardOrUrl?.imageUrl || cardOrUrl?.image || 'https://via.placeholder.com/220x320?text=No+Image');
  let cardId = typeof cardOrUrl === 'string' ? explicitCardId : cardOrUrl?.id;

  
  cardElement.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) return;
    clearTimeout(pressTimer);
    isPreviewing = false;
    
    pressTimer = setTimeout(() => {
      isPreviewing = true;
      showPreview(imageUrl, cardId);
      // Vibrate if supported to provide feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 400); 
  }, { passive: true });

  cardElement.addEventListener('touchend', (e) => {
    clearTimeout(pressTimer);
    if (isPreviewing) {
      if (e.cancelable) {
        e.preventDefault();
      }
      // hidePreview(); // We let them close it manually if we added buttons?
      // Wait, if it has a heart button, they need to tap it. So we shouldn't hide it immediately on touchend?
      // But this is just a quick preview... Oh, "Add to favorite" in a mobile overlay.
      // If we don't hide it, how do they close it? Let's hide it on click outside or something.
    }
  });
  
  cardElement.addEventListener('touchcancel', () => {
    clearTimeout(pressTimer);
    if (isPreviewing) {
      hidePreview();
      isPreviewing = false;
    }
  });
  
  cardElement.addEventListener('touchmove', () => {
    if (!isPreviewing) {
      clearTimeout(pressTimer);
    }
  }, { passive: true });
  
  cardElement.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  cardElement.addEventListener('click', (e) => {
    if (isPreviewing) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
}

function showPreview(imageUrl, cardId) {
  currentPreviewCardId = cardId;
  let overlay = document.getElementById('mobile-card-preview-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'mobile-card-preview-overlay';
    // Adding heart button
    overlay.innerHTML = `
      <div style="position: relative; display: inline-block;">
        <img id="mobile-card-preview-image" src="" alt="Card Preview">
        <button id="preview-fav-btn" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.6); border: none; border-radius: 50%; padding: 10px; font-size: 24px; color: white; cursor: pointer;">
          <i class="ph ph-heart"></i>
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
    
    // Close when tapping outside image
    overlay.addEventListener('click', (e) => {
      if (e.target.id === 'mobile-card-preview-overlay') {
        hidePreview();
      }
    });
    
    // Fav button logic
    const favBtn = document.getElementById('preview-fav-btn');
    favBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!auth.currentUser) {
        alert('يجب تسجيل الدخول لإضافة الكارت للمفضلة');
        return;
      }
      
      const uid = auth.currentUser.uid;
      const favRef = ref(db, `favorites/${uid}/${currentPreviewCardId}`);
      
      try {
        const snapshot = await get(favRef);
        if (snapshot.exists()) {
           await remove(favRef);
           favBtn.innerHTML = '<i class="ph ph-heart"></i>';
           favBtn.style.color = 'white';
        } else {
           await set(favRef, true);
           favBtn.innerHTML = '<i class="ph-fill ph-heart"></i>';
           favBtn.style.color = '#e74c3c';
        }
      } catch (err) {
        console.error(err);
      }
    });
  }
  
  const img = document.getElementById('mobile-card-preview-image');
  img.src = imageUrl;
  
  // Check fav status
  const favBtn = document.getElementById('preview-fav-btn');
  if (auth.currentUser && currentPreviewCardId) {
    const favRef = ref(db, `favorites/${auth.currentUser.uid}/${currentPreviewCardId}`);
    get(favRef).then(snapshot => {
      if (snapshot.exists()) {
        favBtn.innerHTML = '<i class="ph-fill ph-heart"></i>';
        favBtn.style.color = '#e74c3c';
      } else {
        favBtn.innerHTML = '<i class="ph ph-heart"></i>';
        favBtn.style.color = 'white';
      }
    }).catch(console.error);
  }
  
  void overlay.offsetWidth;
  overlay.classList.add('show');
}

function hidePreview() {
  const overlay = document.getElementById('mobile-card-preview-overlay');
  if (overlay) {
    overlay.classList.remove('show');
    isPreviewing = false;
  }
}
