document.addEventListener('DOMContentLoaded', () => {
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const closeMenuBtn = document.getElementById('close-menu-btn');
  const sideMenu = document.getElementById('side-menu');
  const menuOverlay = document.getElementById('menu-overlay');

  // وظيفة لفتح وإغلاق القائمة
  function toggleMenu() {
    sideMenu.classList.toggle('active');
    menuOverlay.classList.toggle('active');
    
    // منع التمرير في الموقع عند فتح القائمة
    if (sideMenu.classList.contains('active')) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  // ربط الأزرار بالوظيفة
  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', toggleMenu);
  }

  if (closeMenuBtn) {
    closeMenuBtn.addEventListener('click', toggleMenu);
  }

  // إغلاق القائمة عند الضغط على الطبقة الضبابية خارجها
  if (menuOverlay) {
    menuOverlay.addEventListener('click', toggleMenu);
  }
});