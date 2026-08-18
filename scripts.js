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
let audioContext;
let lastDropSound = 0;
let isRecording = false;
let isPlaying = false;
let recordStart = 0;
let recordedBeats = [];
let playbackTimer;
let voiceContext;
let voiceAnalyser;
let voiceStream;
let voiceFrame;
let voiceActive = false;
let voiceEnergy = 0;

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
  setTimeout(() => ripple.remove(), 750);
}

function playDropSound(x, y) {
  const now = performance.now();
  if (now - lastDropSound < 45) return;
  lastDropSound = now;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audioContext ??= new AudioContext();
  if (audioContext.state === 'suspended') audioContext.resume();

  const start = audioContext.currentTime;
  const horizontal = x / window.innerWidth;
  const vertical = 1 - y / window.innerHeight;
  const variation = 0.94 + Math.random() * 0.12;

  if (horizontal < 0.5) {
    const kick = audioContext.createOscillator();
    const kickGain = audioContext.createGain();
    const kickPitch = (58 + vertical * 105) * variation;
    const beatLength = 0.16 + Math.random() * 0.06;
    kick.type = 'sine';
    kick.frequency.setValueAtTime(kickPitch * 2.5, start);
    kick.frequency.exponentialRampToValueAtTime(kickPitch, start + 0.08);
    kickGain.gain.setValueAtTime(0.0001, start);
    kickGain.gain.exponentialRampToValueAtTime(0.1, start + 0.006);
    kickGain.gain.exponentialRampToValueAtTime(0.0001, start + beatLength);
    kick.connect(kickGain);
    kickGain.connect(audioContext.destination);
    kick.start(start);
    kick.stop(start + beatLength + 0.01);
    return;
  }

  const hat = audioContext.createBufferSource();
  const hatGain = audioContext.createGain();
  const noiseLength = 0.08 + (1 - vertical) * 0.07;
  const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * noiseLength, audioContext.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  const hatPitch = (420 + vertical * 1150) * variation;
  const hatTone = audioContext.createBiquadFilter();
  for (let index = 0; index < noiseData.length; index += 1) {
    const envelope = 1 - index / noiseData.length;
    noiseData[index] = (Math.random() * 2 - 1) * envelope;
  }
  hat.buffer = noiseBuffer;
  hatTone.type = 'highpass';
  hatTone.frequency.setValueAtTime(hatPitch, start);
  hatGain.gain.setValueAtTime(0.0001, start);
  hatGain.gain.exponentialRampToValueAtTime(0.025, start + 0.004);
  hatGain.gain.exponentialRampToValueAtTime(0.0001, start + noiseLength);
  hat.connect(hatTone);
  hatTone.connect(hatGain);
  hatGain.connect(audioContext.destination);
  hat.start(start);
  hat.stop(start + noiseLength + 0.01);
}

function updateBeatMachine() {
  const recordButton = document.querySelector('.beat-record');
  const playButton = document.querySelector('.beat-play');
  const status = document.querySelector('.beat-status');
  const voiceButton = document.querySelector('.voice-glow-toggle');
  if (!recordButton || !playButton || !status) return;
  recordButton.textContent = isRecording ? 'Stop recording' : 'Record';
  recordButton.classList.toggle('is-active', isRecording);
  playButton.textContent = isPlaying ? 'Stop loop' : 'Play loop';
  playButton.classList.toggle('is-active', isPlaying);
  status.textContent = recordedBeats.length
    ? `${recordedBeats.length} hit${recordedBeats.length === 1 ? '' : 's'} captured`
    : 'Tap the pond to build a beat';
  if (voiceButton) {
    voiceButton.textContent = voiceActive ? 'Disable audio glow' : 'Enable audio glow';
    voiceButton.classList.toggle('is-active', voiceActive);
  }
}

async function toggleVoiceGlow() {
  if (voiceActive) {
    voiceActive = false;
    window.cancelAnimationFrame(voiceFrame);
    voiceStream?.getTracks().forEach((track) => track.stop());
    voiceStream = null;
    voiceAnalyser = null;
    document.body.classList.remove('audio-reactive');
    document.body.style.setProperty('--voice-energy', '0');
    updateBeatMachine();
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    document.querySelector('.beat-status').textContent = 'Microphone access is unavailable';
    return;
  }
  try {
    voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    voiceContext ??= new AudioContext();
    if (voiceContext.state === 'suspended') await voiceContext.resume();
    voiceAnalyser = voiceContext.createAnalyser();
    voiceAnalyser.fftSize = 256;
    voiceAnalyser.smoothingTimeConstant = 0.86;
    voiceContext.createMediaStreamSource(voiceStream).connect(voiceAnalyser);
    voiceActive = true;
    document.body.classList.add('audio-reactive');
    updateBeatMachine();
    measureVoice();
  } catch {
    document.querySelector('.beat-status').textContent = 'Microphone permission was not granted';
  }
}

function measureVoice() {
  if (!voiceActive || !voiceAnalyser) return;
  const samples = new Uint8Array(voiceAnalyser.fftSize);
  voiceAnalyser.getByteTimeDomainData(samples);
  let total = 0;
  samples.forEach((sample) => {
    const wave = (sample - 128) / 128;
    total += wave * wave;
  });
  const level = Math.min(1, Math.sqrt(total / samples.length) * 3.2);
  voiceEnergy += (level - voiceEnergy) * 0.12;
  document.body.style.setProperty('--voice-energy', voiceEnergy.toFixed(3));
  voiceFrame = window.requestAnimationFrame(measureVoice);
}

function stopPlayback() {
  isPlaying = false;
  window.clearTimeout(playbackTimer);
  updateBeatMachine();
}

function playBeatLoop(index = 0) {
  if (!isPlaying || !recordedBeats.length) return;
  const beat = recordedBeats[index];
  playDropSound(beat.x * window.innerWidth, beat.y * window.innerHeight);
  addRipple(beat.x * window.innerWidth, beat.y * window.innerHeight);
  const nextIndex = (index + 1) % recordedBeats.length;
  const gap = nextIndex === 0
    ? Math.max(120, recordedBeats[recordedBeats.length - 1].time + 420 - beat.time)
    : Math.max(70, recordedBeats[nextIndex].time - beat.time);
  playbackTimer = window.setTimeout(() => playBeatLoop(nextIndex), gap);
}

function createBeatMachine() {
  if (document.querySelector('.beat-studio')) return;
  const machine = document.createElement('aside');
  machine.className = 'beat-machine';
  machine.innerHTML = `
    <div class="beat-machine-head">
      <span class="beat-machine-kicker">Pond sequencer</span>
      <span class="beat-status">Tap the pond to build a beat</span>
    </div>
    <div class="beat-machine-controls">
      <button class="beat-record" type="button">Record</button>
      <button class="beat-play" type="button">Play loop</button>
      <button class="beat-clear" type="button">Clear</button>
      <button class="voice-glow-toggle" type="button">Enable audio glow</button>
    </div>
  `;
  document.body.appendChild(machine);
  machine.querySelector('.beat-record').addEventListener('click', () => {
    if (isRecording) {
      isRecording = false;
    } else {
      stopPlayback();
      recordedBeats = [];
      recordStart = performance.now();
      isRecording = true;
    }
    updateBeatMachine();
  });
  machine.querySelector('.beat-play').addEventListener('click', () => {
    if (isPlaying) {
      stopPlayback();
    } else if (recordedBeats.length) {
      isPlaying = true;
      updateBeatMachine();
      playBeatLoop();
    }
  });
  machine.querySelector('.beat-clear').addEventListener('click', () => {
    stopPlayback();
    isRecording = false;
    recordedBeats = [];
    updateBeatMachine();
  });
  machine.querySelector('.voice-glow-toggle').addEventListener('click', toggleVoiceGlow);
  updateBeatMachine();
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
  if (event.target instanceof Element && event.target.closest('.beat-machine')) return;
  glow.classList.add('cursor-glow-active');
  const x = event.clientX;
  const y = event.clientY;
  moveGlow(x, y);
  if (isRecording) {
    recordedBeats.push({
      x: x / window.innerWidth,
      y: y / window.innerHeight,
      time: performance.now() - recordStart,
    });
    updateBeatMachine();
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

const padKeyMap = {
  q: 'highBass',
  e: 'highHat',
  a: 'deepBass',
  d: 'lowHat',
};

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (event.key === 'Tab') {
    document.body.classList.add('keyboard-nav');
  }
  if (event.repeat) return;
  if (padKeyMap[key]) {
    event.preventDefault();
    playSound(padKeyMap[key]);
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

createBeatMachine();
hideGlow();
