const glow = document.createElement('div');
glow.className = 'cursor-glow';
document.body.appendChild(glow);

const blossomLayer = document.createElement('div');
blossomLayer.className = 'blossom-layer';
for (let index = 0; index < 18; index += 1) {
  const blossom = document.createElement('span');
  blossom.className = 'cherry-blossom';
  blossom.style.left = `${Math.random() * 100}%`;
  blossom.style.setProperty('--blossom-size', `${Math.random() * 11 + 10}px`);
  blossom.style.setProperty('--blossom-duration', `${Math.random() * 8 + 10}s`);
  blossom.style.setProperty('--blossom-delay', `${Math.random() * -18}s`);
  blossom.style.setProperty('--blossom-sway', `${(Math.random() - 0.5) * 160}px`);
  blossom.style.setProperty('--blossom-spin', `${Math.random() * 720 - 360}deg`);
  blossomLayer.appendChild(blossom);
}
document.body.appendChild(blossomLayer);

const trail = document.createElement('div');
trail.className = 'cursor-trail';
document.body.appendChild(trail);

let lastTrailBlossom = 0;
let lastTrailX = 0;
let lastTrailY = 0;

function moveGlow(x, y) {
  const offset = glow.offsetWidth / 2;
  glow.style.transform = `translate(${x - offset}px, ${y - offset}px)`;
  glow.style.opacity = '1';
}

function hideGlow() {
  glow.style.opacity = '0';
}

function addTrailBlossom(x, y) {
  const now = performance.now();
  const distance = Math.hypot(x - lastTrailX, y - lastTrailY);
  if (now - lastTrailBlossom < 42 && distance < 18) return;
  lastTrailBlossom = now;
  lastTrailX = x;
  lastTrailY = y;

  const flower = document.createElement('span');
  flower.className = 'cursor-trail-blossom';
  flower.style.left = `${x + (Math.random() - 0.5) * 14}px`;
  flower.style.top = `${y + (Math.random() - 0.5) * 14}px`;
  flower.style.setProperty('--trail-size', `${Math.random() * 5 + 6}px`);
  flower.style.setProperty('--trail-drift', `${(Math.random() - 0.5) * 52}px`);
  flower.style.setProperty('--trail-fall', `${Math.random() * 42 + 28}px`);
  flower.style.setProperty('--trail-spin', `${Math.random() * 300 - 150}deg`);
  trail.appendChild(flower);

  while (trail.querySelectorAll('.cursor-trail-blossom').length > 32) {
    trail.querySelector('.cursor-trail-blossom')?.remove();
  }
  flower.addEventListener('animationend', () => flower.remove(), { once: true });
}

function addRipple(x, y, width = 44, height = 44) {
  const ripple = document.createElement('span');
  ripple.className = 'cursor-focus-ripple';
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  ripple.style.width = `${Math.max(width, 44)}px`;
  ripple.style.height = `${Math.max(height, 44)}px`;
  trail.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
}

function addFocusRipple(element) {
  const bounds = element.getBoundingClientRect();
  addRipple(
    bounds.left + bounds.width / 2,
    bounds.top + bounds.height / 2,
    bounds.width,
    bounds.height,
  );
}

function setCursorMode(mode) {
  document.body.classList.remove('link-cursor', 'text-cursor');
  if (mode) {
    document.body.classList.add(mode);
  }
}

document.addEventListener('pointermove', (event) => {
  const x = event.clientX;
  const y = event.clientY;
  moveGlow(x, y);
  addTrailBlossom(x, y);
});

document.addEventListener('pointerdown', (event) => {
  glow.classList.add('cursor-glow-active');
  const x = event.clientX;
  const y = event.clientY;
  moveGlow(x, y);
  if (event.pointerType === 'touch') {
    addRipple(x, y);
  }
});

document.addEventListener('pointerup', () => {
  glow.classList.remove('cursor-glow-active');
});

document.addEventListener('pointerleave', hideGlow);

document.addEventListener('touchstart', (event) => {
  const touch = event.touches[0];
  if (touch) {
    moveGlow(touch.clientX, touch.clientY);
    addTrailBlossom(touch.clientX, touch.clientY);
  }
}, { passive: true });

document.addEventListener('touchmove', (event) => {
  const touch = event.touches[0];
  if (touch) {
    moveGlow(touch.clientX, touch.clientY);
    addTrailBlossom(touch.clientX, touch.clientY);
  }
}, { passive: true });

document.addEventListener('touchend', hideGlow);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Tab') {
    document.body.classList.add('keyboard-nav');
  }
});

document.addEventListener('pointerdown', () => {
  document.body.classList.remove('keyboard-nav');
});

document.querySelectorAll('a, button, .primary-btn, .secondary-btn, .header-text').forEach((element) => {
  element.addEventListener('pointerenter', () => {
    setCursorMode('link-cursor');
    glow.classList.add('cursor-glow-hover');
  });

  element.addEventListener('pointerleave', () => {
    setCursorMode('');
    glow.classList.remove('cursor-glow-hover');
  });

  element.addEventListener('focus', () => {
    if (document.body.classList.contains('keyboard-nav')) {
      addFocusRipple(element);
    }
  });
});

document.querySelectorAll('input, textarea, select').forEach((element) => {
  element.addEventListener('focus', () => setCursorMode('text-cursor'));
  element.addEventListener('blur', () => setCursorMode(''));
});

hideGlow();
