const studio = {
  audio: null,
  master: null,
  pattern: Array.from({ length: 4 }, () => Array(16).fill(false)),
  currentStep: -1,
  playing: false,
  timer: null,
  bpm: 104,
  sample: null,
  sampleBuffer: null,
  pianoSource: 'synth',
  synth: 'lead',
  recorder: null,
  recordingChunks: [],
  microphoneStream: null,
  heldNotes: new Map(),
};

const trackNames = ['highBass', 'highHat', 'deepBass', 'lowHat'];
const pianoNotes = [
  ['C4', 'a'], ['C#4', 'w'], ['D4', 's'], ['D#4', 'e'], ['E4', 'd'], ['F4', 'f'],
  ['F#4', 't'], ['G4', 'g'], ['G#4', 'y'], ['A4', 'h'], ['A#4', 'u'], ['B4', 'j'], ['C5', 'k'],
];

function getStudioAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  studio.audio ??= new AudioContext();
  if (studio.audio.state === 'suspended') studio.audio.resume();
  studio.master ??= studio.audio.createGain();
  studio.master.gain.value = Number(document.querySelector('.master-volume').value);
  studio.master.connect(studio.audio.destination);
  return studio.audio;
}

function tone(frequency, duration, type = 'sine', volume = 0.1, filterFrequency = null) {
  const audio = getStudioAudio();
  if (!audio) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const filter = filterFrequency ? audio.createBiquadFilter() : null;
  const start = audio.currentTime;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  if (filter) {
    filter.type = 'lowpass';
    filter.frequency.value = filterFrequency;
    gain.connect(filter);
    filter.connect(studio.master);
  } else {
    gain.connect(studio.master);
  }
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function punchBass(frequency, duration, volume) {
  const audio = getStudioAudio();
  if (!audio) return;
  const start = audio.currentTime;
  const sub = audio.createOscillator();
  const subGain = audio.createGain();
  const punch = audio.createOscillator();
  const punchGain = audio.createGain();
  const lowpass = audio.createBiquadFilter();

  sub.type = 'sine';
  sub.frequency.setValueAtTime(frequency * 1.8, start);
  sub.frequency.exponentialRampToValueAtTime(frequency, start + 0.07);
  subGain.gain.setValueAtTime(0.0001, start);
  subGain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  subGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  punch.type = 'triangle';
  punch.frequency.setValueAtTime(frequency * 5.5, start);
  punch.frequency.exponentialRampToValueAtTime(frequency * 1.5, start + 0.055);
  punchGain.gain.setValueAtTime(0.0001, start);
  punchGain.gain.exponentialRampToValueAtTime(volume * 0.7, start + 0.003);
  punchGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.075);

  lowpass.type = 'lowpass';
  lowpass.frequency.value = 700;
  sub.connect(subGain);
  punch.connect(punchGain);
  subGain.connect(lowpass);
  punchGain.connect(lowpass);
  lowpass.connect(studio.master);
  sub.start(start);
  punch.start(start);
  sub.stop(start + duration + 0.02);
  punch.stop(start + 0.09);
}

function playSound(name) {
  const sounds = {
    highBass: [86, 0.2, 0.2],
    deepBass: [38, 0.34, 0.28],
    highHat: [1450, 0.07, 'square', 0.035],
    lowHat: [620, 0.11, 'triangle', 0.06],
  };
  const sound = sounds[name];
  if (name === 'highBass' || name === 'deepBass') {
    punchBass(...sound);
  } else if (sound) {
    tone(...sound);
  }
  const pad = document.querySelector(`[data-sound="${name}"]`);
  pad?.classList.add('is-hit');
  window.setTimeout(() => pad?.classList.remove('is-hit'), 120);
}

function updateStatus(message) {
  document.querySelector('.studio-status').textContent = message;
}

function renderSteps() {
  const grid = document.querySelector('.step-grid');
  grid.innerHTML = '';
  trackNames.forEach((name, trackIndex) => {
    const row = document.createElement('div');
    row.className = 'step-row';
    row.innerHTML = `<span class="track-label">${name.replace('Bass', ' bass').replace('Hat', ' hat')}</span>`;
    for (let step = 0; step < 16; step += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'step-button';
      button.dataset.track = trackIndex;
      button.dataset.step = step;
      button.setAttribute('aria-label', `${name}, step ${step + 1}`);
      button.classList.toggle('is-on', studio.pattern[trackIndex][step]);
      button.addEventListener('click', () => {
        studio.pattern[trackIndex][step] = !studio.pattern[trackIndex][step];
        renderSteps();
        updateCount();
      });
      row.appendChild(button);
    }
    grid.appendChild(row);
  });
}

function updateCount() {
  const count = studio.pattern.flat().filter(Boolean).length;
  document.querySelector('.step-count').textContent = `${count} / 64`;
}

function markStep(step) {
  document.querySelectorAll('.step-button').forEach((button) => {
    button.classList.toggle('is-current', Number(button.dataset.step) === step);
  });
}

function getLoopStartStep() {
  const activeSteps = [];
  studio.pattern.forEach((track) => {
    track.forEach((isOn, step) => {
      if (isOn) activeSteps.push(step);
    });
  });

  if (!activeSteps.length) return 0;
  const lastStep = Math.max(...activeSteps);
  return ((Math.floor(lastStep / 4) + 1) % 4) * 4;
}

function playStep() {
  studio.currentStep = (studio.currentStep + 1) % 16;
  markStep(studio.currentStep);
  studio.pattern.forEach((track, index) => {
    if (track[studio.currentStep]) playSound(trackNames[index]);
  });
  const interval = 60000 / studio.bpm / 4;
  studio.timer = window.setTimeout(playStep, interval);
}

function stopLoop() {
  studio.playing = false;
  window.clearTimeout(studio.timer);
  studio.currentStep = -1;
  markStep(-1);
  document.querySelector('.studio-play').textContent = 'Play';
  document.querySelector('.transport-light').classList.remove('is-on');
}

function toggleLoop() {
  if (studio.playing) {
    stopLoop();
    updateStatus('Loop paused');
    return;
  }
  studio.playing = true;
  studio.currentStep = getLoopStartStep() - 1;
  document.querySelector('.studio-play').textContent = 'Pause';
  document.querySelector('.transport-light').classList.add('is-on');
  updateStatus('Loop running');
  playStep();
}

function createPiano() {
  const piano = document.querySelector('.piano-keys');
  pianoNotes.forEach(([note, key]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = note.includes('#') ? 'piano-key black-key' : 'piano-key';
    button.dataset.note = note;
    button.innerHTML = `<span>${note}</span><kbd>${key.toUpperCase()}</kbd>`;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      startNote(note, button);
    });
    button.addEventListener('pointerup', (event) => {
      if (button.hasPointerCapture?.(event.pointerId)) {
        button.releasePointerCapture?.(event.pointerId);
      }
      releaseNote(note, button);
    });
    button.addEventListener('pointerleave', (event) => {
      if (button.hasPointerCapture?.(event.pointerId)) return;
      if (event.pressure === 0 || event.buttons === 0) {
        releaseNote(note, button);
      }
    });
    button.addEventListener('pointercancel', (event) => {
      if (button.hasPointerCapture?.(event.pointerId)) {
        button.releasePointerCapture?.(event.pointerId);
      }
      releaseNote(note, button);
    });
    piano.appendChild(button);
  });
}

async function unlockStudioAudio() {
  const audio = getStudioAudio();
  if (!audio) return false;
  if (audio.state === 'suspended') await audio.resume();
  return true;
}

async function startNote(note, button) {
  if (studio.heldNotes.has(note)) return;
  const audioReady = await unlockStudioAudio();
  if (!audioReady) return;
  const frequencies = { C4: 261.63, 'C#4': 277.18, D4: 293.66, 'D#4': 311.13, E4: 329.63, F4: 349.23, 'F#4': 369.99, G4: 392, 'G#4': 415.3, A4: 440, 'A#4': 466.16, B4: 493.88, C5: 523.25 };
  if (studio.pianoSource === 'sample' && studio.sampleBuffer) {
    playSampleChop(note, button);
    return;
  }

  const audio = getStudioAudio();
  const noteFrequency = frequencies[note];
  const primary = audio.createOscillator();
  const harmonic = audio.createOscillator();
  const gain = audio.createGain();
  const filterNode = audio.createBiquadFilter();
  const outputNode = studio.master ?? audio.destination;
  const start = audio.currentTime;

  primary.type = 'triangle';
  harmonic.type = 'sine';

  primary.frequency.setValueAtTime(noteFrequency, start);
  harmonic.frequency.setValueAtTime(noteFrequency * 2, start);

  filterNode.type = 'lowpass';
  filterNode.frequency.value = 6200;
  filterNode.Q.value = 0.65;

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.85, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.22, start + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.1);

  primary.connect(gain);
  harmonic.connect(gain);
  gain.connect(filterNode);
  filterNode.connect(outputNode);

  primary.start(start);
  harmonic.start(start);
  studio.heldNotes.set(note, { oscillator: primary, extraOscillators: [harmonic], gain, filterNode });
  button.classList.add('is-pressed');
}

async function playSampleChop(note, button) {
  const audio = getStudioAudio();
  if (!audio || !studio.sampleBuffer) return;
  if (audio.state === 'suspended') await audio.resume();
  const noteIndex = pianoNotes.findIndex(([name]) => name === note);
  const source = audio.createBufferSource();
  const gain = audio.createGain();
  const sliceLength = Math.min(0.42, studio.sampleBuffer.duration / pianoNotes.length);
  const offset = Math.min(noteIndex * sliceLength, Math.max(0, studio.sampleBuffer.duration - 0.04));
  source.buffer = studio.sampleBuffer;
  source.playbackRate.value = 0.82 + noteIndex * 0.045;
  gain.gain.setValueAtTime(0.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.75, audio.currentTime + 0.008);
  source.connect(gain);
  gain.connect(studio.master);
  source.start(audio.currentTime, offset, sliceLength);
  studio.heldNotes.set(note, { source, gain, sample: true });
  button.classList.add('is-pressed');
}

function releaseNote(note, button) {
  const voice = studio.heldNotes.get(note);
  if (!voice) {
    button?.classList.remove('is-pressed');
    return;
  }
  const now = studio.audio?.currentTime ?? 0;
  if (voice.gain) {
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0.0001, now, 0.045);
  }
  if (voice.extraOscillators?.length) {
    voice.extraOscillators.forEach((osc) => osc.stop(now + 0.18));
  }
  if (voice.oscillator) voice.oscillator.stop(now + 0.18);
  if (voice.source && voice.sample) voice.source.stop(now + 0.18);
  studio.heldNotes.delete(note);
  button?.classList.remove('is-pressed');
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    updateStatus('Microphone recording is not supported here');
    return;
  }
  try {
    studio.microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    studio.recordingChunks = [];
    studio.recorder = new MediaRecorder(studio.microphoneStream);
    studio.recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size) studio.recordingChunks.push(event.data);
    });
    studio.recorder.addEventListener('stop', finishRecording, { once: true });
    studio.recorder.start();
    document.querySelector('.sample-record').disabled = true;
    document.querySelector('.sample-stop').disabled = false;
    updateStatus('Recording microphone');
  } catch {
    updateStatus('Microphone permission was not granted');
  }
}

async function finishRecording() {
  const blob = new Blob(studio.recordingChunks, { type: studio.recorder.mimeType || 'audio/webm' });
  studio.sample?.pause();
  studio.sample = new Audio(URL.createObjectURL(blob));
  await decodeSample(blob);
  document.querySelector('.sample-name').textContent = 'Microphone take';
  document.querySelector('.sample-play').disabled = false;
  document.querySelector('.source-choice[data-source="sample"]').disabled = false;
  document.querySelector('.sample-record').disabled = false;
  document.querySelector('.sample-stop').disabled = true;
  studio.microphoneStream?.getTracks().forEach((track) => track.stop());
  studio.microphoneStream = null;
  updateStatus('Microphone take ready');
}

function stopRecording() {
  if (studio.recorder?.state === 'recording') studio.recorder.stop();
}

function loadSample(event) {
  const file = event.target.files[0];
  if (!file) return;
  studio.sample?.pause();
  studio.sample = new Audio(URL.createObjectURL(file));
  decodeSample(file);
  document.querySelector('.sample-name').textContent = file.name;
  document.querySelector('.sample-play').disabled = false;
  document.querySelector('.source-choice[data-source="sample"]').disabled = false;
  updateStatus('Sample loaded');
}

async function decodeSample(file) {
  const audio = getStudioAudio();
  if (!audio) return;
  const arrayBuffer = await file.arrayBuffer();
  studio.sampleBuffer = await audio.decodeAudioData(arrayBuffer);
  updateStatus('Sample chopped across piano keys');
}

function initStudio() {
  renderSteps();
  updateCount();
  createPiano();
  document.querySelector('.studio-play').addEventListener('click', toggleLoop);
  document.querySelector('.studio-stop').addEventListener('click', () => { stopLoop(); updateStatus('Stopped'); });
  document.querySelector('.studio-clear').addEventListener('click', () => {
    stopLoop();
    studio.pattern = Array.from({ length: 4 }, () => Array(16).fill(false));
    renderSteps();
    updateCount();
    updateStatus('Pattern cleared');
  });
  document.querySelector('.tempo-input').addEventListener('input', (event) => {
    studio.bpm = Math.min(180, Math.max(60, Number(event.target.value) || 104));
  });
  document.querySelector('.master-volume').addEventListener('input', (event) => {
    if (studio.master) studio.master.gain.value = Number(event.target.value);
  });
  document.querySelectorAll('.sound-pad').forEach((pad) => pad.addEventListener('pointerdown', () => playSound(pad.dataset.sound)));
  document.querySelectorAll('.synth-choice').forEach((choice) => choice.addEventListener('click', () => {
    studio.synth = choice.dataset.synth;
    document.querySelectorAll('.synth-choice').forEach((item) => item.classList.toggle('is-selected', item === choice));
    updateStatus(`${choice.textContent} selected`);
  }));
  document.querySelectorAll('.source-choice').forEach((choice) => choice.addEventListener('click', () => {
    if (choice.disabled) return;
    studio.pianoSource = choice.dataset.source;
    document.querySelectorAll('.source-choice').forEach((item) => item.classList.toggle('is-selected', item === choice));
    updateStatus(studio.pianoSource === 'sample' ? 'Piano playing sample chops' : 'Piano playing synth voice');
  }));
  document.querySelector('.sample-input').addEventListener('change', loadSample);
  document.querySelector('.sample-play').addEventListener('click', () => studio.sample?.play());
  document.querySelector('.sample-record').addEventListener('click', startRecording);
  document.querySelector('.sample-stop').addEventListener('click', stopRecording);
  document.addEventListener('pointerdown', () => {
    unlockStudioAudio();
  }, { passive: true });
  document.addEventListener('keydown', (event) => {
    const match = pianoNotes.find(([, key]) => key === event.key.toLowerCase());
    if (match && !event.repeat) {
      unlockStudioAudio();
      startNote(match[0], document.querySelector(`[data-note="${match[0]}"]`));
    }
  });
  document.addEventListener('keyup', (event) => {
    const match = pianoNotes.find(([, key]) => key === event.key.toLowerCase());
    if (match) releaseNote(match[0], document.querySelector(`[data-note="${match[0]}"]`));
  });
  window.addEventListener('blur', () => {
    studio.heldNotes.forEach((_, note) => releaseNote(note, document.querySelector(`[data-note="${note}"]`)));
  });
}

initStudio();
