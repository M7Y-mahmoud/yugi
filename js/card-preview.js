let pressTimer;
let isPreviewing = false;

export function setupCardPreview(cardElement, imageUrl) {
  cardElement.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) return;
    clearTimeout(pressTimer);
    isPreviewing = false;
    
    pressTimer = setTimeout(() => {
      isPreviewing = true;
      showPreview(imageUrl);
      // Vibrate if supported to provide feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 400); 
  }, { passive: true });

  cardElement.addEventListener('touchend', (e) => {
    clearTimeout(pressTimer);
    if (isPreviewing) {
      // Prevent click if we were previewing
      if (e.cancelable) {
        e.preventDefault();
      }
      hidePreview();
      setTimeout(() => { isPreviewing = false; }, 100);
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
    // If they start scrolling, cancel the long press
    if (!isPreviewing) {
      clearTimeout(pressTimer);
    }
  }, { passive: true });
  
  // Intercept click to prevent it if we just finished previewing
  // Prevent context menu (default long press behavior)
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

function showPreview(imageUrl) {
  let overlay = document.getElementById('mobile-card-preview-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'mobile-card-preview-overlay';
    overlay.innerHTML = `<img id="mobile-card-preview-image" src="" alt="Card Preview">`;
    document.body.appendChild(overlay);
  }
  
  const img = document.getElementById('mobile-card-preview-image');
  img.src = imageUrl;
  
  // Force reflow
  void overlay.offsetWidth;
  overlay.classList.add('show');
}

function hidePreview() {
  const overlay = document.getElementById('mobile-card-preview-overlay');
  if (overlay) {
    overlay.classList.remove('show');
  }
}
