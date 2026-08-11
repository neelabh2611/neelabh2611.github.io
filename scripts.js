const glow = document.createElement('div');
glow.className = 'cursor-glow';
document.body.appendChild(glow);

const trail = document.createElement('div');
trail.className = 'cursor-trail';
document.body.appendChild(trail);
let lastSparkleTime = 0;

function moveGlow(x, y) {
  const offset = glow.offsetWidth / 2;
  glow.style.transform = `translate(${x - offset}px, ${y - offset}px)`;
  glow.style.opacity = '1';
}

function hideGlow() {
  glow.style.opacity = '0';
}

function addSparkle(x, y) {
  const now = performance.now();
  if (now - lastSparkleTime < 24) return;
  lastSparkleTime = now;

  const sparkle = document.createElement('span');
  sparkle.className = 'cursor-sparkle';
  sparkle.style.left = `${x}px`;
  sparkle.style.top = `${y}px`;
  sparkle.style.setProperty('--sparkle-size', `${Math.random() * 5 + 3}px`);
  sparkle.style.setProperty('--sparkle-drift-x', `${(Math.random() - 0.5) * 34}px`);
  sparkle.style.setProperty('--sparkle-drift-y', `${(Math.random() - 0.5) * 34 - 10}px`);
  sparkle.style.setProperty('--sparkle-hue', `${Math.random() * 45 + 145}`);
  trail.appendChild(sparkle);
  sparkle.addEventListener('animationend', () => sparkle.remove(), { once: true });
  setTimeout(() => sparkle.remove(), 1500);
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
  addSparkle(x, y);
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
    addSparkle(touch.clientX, touch.clientY);
  }
}, { passive: true });

document.addEventListener('touchmove', (event) => {
  const touch = event.touches[0];
  if (touch) {
    moveGlow(touch.clientX, touch.clientY);
    addSparkle(touch.clientX, touch.clientY);
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
