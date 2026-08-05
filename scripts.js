const glow = document.createElement('div');
glow.className = 'cursor-glow';
document.body.appendChild(glow);

let pointerVisible = false;

function moveGlow(x, y) {
  glow.style.transform = `translate(${x}px, ${y}px)`;
  glow.style.opacity = '1';
  pointerVisible = true;
}

function hideGlow() {
  glow.style.opacity = '0';
  pointerVisible = false;
}

document.addEventListener('pointermove', (event) => {
  const x = event.clientX;
  const y = event.clientY;
  moveGlow(x - 120, y - 120);
});

document.addEventListener('pointerdown', (event) => {
  glow.classList.add('cursor-glow-active');
  const x = event.clientX;
  const y = event.clientY;
  moveGlow(x - 120, y - 120);
});

document.addEventListener('pointerup', () => {
  glow.classList.remove('cursor-glow-active');
});

document.addEventListener('pointerleave', hideGlow);

document.addEventListener('touchstart', (event) => {
  const touch = event.touches[0];
  if (touch) {
    moveGlow(touch.clientX - 120, touch.clientY - 120);
  }
}, { passive: true });

document.addEventListener('touchmove', (event) => {
  const touch = event.touches[0];
  if (touch) {
    moveGlow(touch.clientX - 120, touch.clientY - 120);
  }
}, { passive: true });

document.addEventListener('touchend', hideGlow);

document.querySelectorAll('a, button, .primary-btn, .secondary-btn, .header-text, main').forEach((element) => {
  element.addEventListener('pointerenter', () => {
    glow.classList.add('cursor-glow-hover');
  });

  element.addEventListener('pointerleave', () => {
    glow.classList.remove('cursor-glow-hover');
  });
});

hideGlow();
