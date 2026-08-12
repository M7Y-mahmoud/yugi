export function attachMillenniumEffect() {
  if (document.getElementById('millennium-flash-overlay')) return; // Already attached

  // Inject the CSS
  if (!document.getElementById('millennium-effect-css')) {
    const link = document.createElement('link');
    link.id = 'millennium-effect-css';
    link.rel = 'stylesheet';
    link.href = 'css/millennium-effect.css';
    document.head.appendChild(link);
  }

  // Create the overlay elements
  let overlay = document.createElement('div');
  overlay.id = 'millennium-flash-overlay';
  overlay.className = 'millennium-flash-overlay';
  
  // The Logo Image
  overlay.innerHTML = `
    <img src="public/assets/images/logo.png" class="millennium-eye-symbol" alt="Yu-Gi-Oh! Logo">
  `;
  document.body.appendChild(overlay);

  // Web Audio Synth for the effect (Fallback if no audio file is provided)
  const playSynthEffect = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      
      // High-pitched magical ring
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 1.5);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.5);

      // Deep rumble/gong
      const rumble = ctx.createOscillator();
      const rumbleGain = ctx.createGain();
      rumble.type = 'triangle';
      rumble.frequency.setValueAtTime(150, ctx.currentTime);
      rumble.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 1.5);
      
      rumbleGain.gain.setValueAtTime(0, ctx.currentTime);
      rumbleGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.05);
      rumbleGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
      
      rumble.connect(rumbleGain);
      rumbleGain.connect(ctx.destination);
      rumble.start();
      rumble.stop(ctx.currentTime + 1.5);
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  };

  // Find all logo links that go to index.html
  const triggerLinks = document.querySelectorAll('a[href="index.html"].navbar-brand, a[href="index.html"].logo-link, a.back-home-link, img.side-logo');
  
  triggerLinks.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Play Audio (Attempt to play a file first, fallback to synth)
      const audio = new Audio('public/assets/audio/yugi yo_[cut_2sec].mp3');
      audio.volume = 1.0;
      audio.play().catch(() => {
        // Fallback if the file doesn't exist
        playSynthEffect();
      });

      // Trigger visual flash
      overlay.classList.add('active');

      // Redirect after animation
      setTimeout(() => {
        window.location.href = trigger.href || 'index.html';
      }, 1500);
    });
  });
}

// Ensure execution depending on readyState
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(attachMillenniumEffect, 500);
  });
} else {
  setTimeout(attachMillenniumEffect, 500);
}
