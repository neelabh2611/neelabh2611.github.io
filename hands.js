window.addEventListener('load', () => {
  const videoElement = document.querySelector('.input_video');
  const canvasElement = document.querySelector('.output_canvas');
  const debugEl = document.getElementById('debug');
  const ctx = canvasElement.getContext('2d');

  let canvasW = 1280, canvasH = 720;
  canvasElement.width = canvasW; canvasElement.height = canvasH;

  // style the camera preview (small mirrored box)
  videoElement.style.position = 'fixed';
  videoElement.style.right = '12px';
  videoElement.style.top = '12px';
  videoElement.style.width = '260px';
  videoElement.style.height = 'auto';
  videoElement.style.borderRadius = '8px';
  videoElement.style.boxShadow = '0 8px 30px rgba(0,0,0,0.6)';
  videoElement.style.transform = 'scaleX(-1)';
  videoElement.style.zIndex = '40';

  const sunflowers = [];
  let desiredCount = 30;
  const MAX_SUN = 300;
  let agingRate = 0; // per-frame aging adjustment
  // preloaded flower images (using Unsplash queries as examples)
  const flowerUrls = [
    'https://source.unsplash.com/collection/190727/400x400?sig=1',
    'https://source.unsplash.com/collection/190727/400x400?sig=2',
    'https://source.unsplash.com/collection/190727/400x400?sig=3',
    'https://source.unsplash.com/collection/190727/400x400?sig=4'
  ];
  const flowerImgs = [];
  for (let i=0;i<flowerUrls.length;i++){
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im._ready = false;
    im.onload = () => { im._ready = true; };
    im.onerror = () => { im._ready = false; };
    im.src = flowerUrls[i];
    flowerImgs.push(im);
  }

  // track last thumb-index lines for drawing inside drawScene
  let lastHandLines = [];

  // UI elements
  const fpsEl = document.getElementById('fps');
  const statusEl = document.getElementById('status');

  let lastFrameTime = performance.now();
  let frameCount = 0;

  function resizeCanvas() {
    const rect = canvasElement.getBoundingClientRect();
    canvasW = rect.width * devicePixelRatio;
    canvasH = (rect.width * 9/16) * devicePixelRatio;
    canvasElement.width = canvasW;
    canvasElement.height = canvasH;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  class Sunflower {
    constructor(x, y) {
      this.x = x; this.y = y;
      this.age = Math.random() * 0.2; // 0 young -> 1 old
      this.size = 28 + Math.random() * 32;
      this.sway = (Math.random() - 0.5) * 0.8;
      this.hue = 45 + Math.random()*20;
      this.img = null; // assigned later
    }
    update() {
      this.age += agingRate;
      if (this.age < 0) this.age = 0;
    }
    draw(ctx, t) {
      const a = Math.max(0, Math.min(1, this.age));
      const s = this.size * (0.6 + 0.4*(1 - a));
      const sway = Math.sin(t*0.002 + this.sway) * 6 * (1-a);
      const cx = this.x + sway;
      // draw flower image if available, otherwise fallback to simple drawing
      if (this.img && this.img._ready) {
        try {
          ctx.save();
          // aging: grayscale + sepia via filter
          const g = Math.min(100, Math.round(a*100));
          const sep = Math.min(100, Math.round(a*50));
          ctx.filter = `grayscale(${g}%) sepia(${sep}%) brightness(${1 - a*0.25})`;
          ctx.globalAlpha = 1;
          const drawSize = s * 2.2;
          ctx.drawImage(this.img, cx - drawSize/2, this.y - drawSize/2, drawSize, drawSize);
          ctx.restore();
        } catch (e) {
          // image not drawable yet or CORS issue — fallback to stylized circle and avoid repeating error
          this.img = null;
          ctx.beginPath();
          ctx.fillStyle = `hsl(${this.hue}, 85%, ${60 - a*18}%)`;
          ctx.arc(cx, this.y, s, 0, Math.PI*2);
          ctx.fill();
        }
      } else {
        // fallback stylized flower
        ctx.beginPath();
        ctx.fillStyle = `hsl(${this.hue}, 85%, ${60 - a*18}%)`;
        ctx.arc(cx, this.y, s, 0, Math.PI*2);
        ctx.fill();
      }
    }
  }

  function spawnOne() {
    const margin = 40;
    const x = margin + Math.random()*(canvasW - margin*2);
    const y = margin + Math.random()*(canvasH*0.6 - margin);
    const s = new Sunflower(x, y);
    // assign an image from preloaded list (wrap)
    s.img = flowerImgs[sunflowers.length % flowerImgs.length] || null;
    sunflowers.push(s);
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function drawScene(t) {
    ctx.clearRect(0,0,canvasW,canvasH);
    // sky background
    const g = ctx.createLinearGradient(0,0,0,canvasH);
    g.addColorStop(0,'#09192b'); g.addColorStop(1,'#12324a');
    ctx.fillStyle = g; ctx.fillRect(0,0,canvasW,canvasH);

    // adjust count towards desiredCount smoothly
    if (sunflowers.length < desiredCount) {
      const toAdd = Math.min(4, desiredCount - sunflowers.length);
      for (let i=0;i<toAdd;i++) spawnOne();
    } else if (sunflowers.length > desiredCount) {
      const toRemove = Math.min(4, sunflowers.length - desiredCount);
      sunflowers.splice(0, toRemove);
    }

    // update/draw
    for (let i=0;i<sunflowers.length;i++){
      const s = sunflowers[i];
      s.update();
      s.draw(ctx, t);
    }

    // draw thumb-index lines saved from last detection
    for (let ln of lastHandLines) {
      ctx.beginPath();
      ctx.moveTo(ln.tx, ln.ty);
      ctx.lineTo(ln.ix, ln.iy);
      ctx.lineWidth = 4;
      ctx.strokeStyle = ln.label === 'Right' ? 'rgba(255,200,40,0.95)' : 'rgba(120,200,255,0.95)';
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath(); ctx.fillStyle = 'white'; ctx.arc(ln.tx, ln.ty, 6, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.fillStyle = 'white'; ctx.arc(ln.ix, ln.iy, 6, 0, Math.PI*2); ctx.fill();
    }

    // FPS
    frameCount++;
    const now = performance.now();
    if (now - lastFrameTime > 500) {
      const fps = Math.round((frameCount*1000) / (now - lastFrameTime));
      frameCount = 0; lastFrameTime = now;
      if (fpsEl) fpsEl.innerText = `FPS: ${fps}`;
    }

    // debug
    debugEl.innerText = `flowers: ${sunflowers.length}  target: ${desiredCount}\nagingRate: ${agingRate.toFixed(4)}`;

    requestAnimationFrame(drawScene);
  }

  // MediaPipe hands setup
  const hands = new Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
  });
  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });

  let rightDistance = 0.05;
  let leftDistance = 0.05;
  let lastRightSpawn = 0;
  const RIGHT_SPAWN_COOLDOWN = 160; // ms

  hands.onResults((results) => {
    // compute which hand is which and save thumb-index lines for drawing
    lastHandLines = [];
    if (results.multiHandedness && results.multiHandLandmarks) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const label = results.multiHandedness[i].label; // 'Right' or 'Left'
        const lm = results.multiHandLandmarks[i];
        const thumb = lm[4];
        const index = lm[8];
        const dx = thumb.x - index.x;
        const dy = thumb.y - index.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (label === 'Right') rightDistance = dist;
        else leftDistance = dist;

        // convert normalized coords to canvas coords (mirror x to match video preview)
        const tx = (1 - thumb.x) * canvasW;
        const ty = thumb.y * canvasH;
        const ix = (1 - index.x) * canvasW;
        const iy = index.y * canvasH;

        lastHandLines.push({tx,ty,ix,iy,label});
      }
    }

    // Right hand: spawn near thumb when thumb-index distance increases beyond threshold
    const now = performance.now();
    const normR = clamp((rightDistance - 0.02) / 0.28, 0, 1);
    if (normR > 0.35 && (now - lastRightSpawn) > RIGHT_SPAWN_COOLDOWN) {
      // spawn at right thumb position (use lastHandLines to find it)
      const rightLine = lastHandLines.find(l=>l.label==='Right');
      if (rightLine && sunflowers.length < MAX_SUN) {
        const f = new Sunflower(rightLine.tx + (Math.random()-0.5)*80, rightLine.ty + (Math.random()-0.5)*40);
        f.img = flowerImgs[Math.floor(Math.random()*flowerImgs.length)];
        sunflowers.push(f);
        lastRightSpawn = now;
      }
    }

    // Left hand: control aging rate
    const normL = clamp((leftDistance - 0.02) / 0.28, 0, 1);
    const targetAging = (normL - 0.4) * 0.06; // tuned mapping
    agingRate = agingRate * 0.8 + targetAging * 0.2;
    if (statusEl) statusEl.innerText = `Status: flowers ${sunflowers.length}`;
  });

  // start camera
  function setStatus(msg){
    if (debugEl) debugEl.innerText = msg;
    console.log(msg);
  }

  const camera = new Camera(videoElement, {
    onFrame: async () => {
      try { await hands.send({image: videoElement}); }
      catch(e){ console.error('hands.send error', e); }
    },
    width: 1280,
    height: 720
  });

  try {
    camera.start();
    setStatus('Camera started via MediaPipe Camera.');
  } catch (err) {
    console.warn('Camera start failed, falling back to getUserMedia', err);
    setStatus('Camera start failed, trying getUserMedia fallback...');
    navigator.mediaDevices.getUserMedia({video:{width:1280,height:720}})
      .then((stream)=>{
        videoElement.srcObject = stream;
        return videoElement.play();
      })
      .then(()=>{
        setStatus('Camera started via getUserMedia fallback.');
        // simple loop to feed frames to MediaPipe
        (function frameLoop(){
          hands.send({image: videoElement}).catch(e=>console.error('hands.send error', e));
          requestAnimationFrame(frameLoop);
        })();
      })
      .catch((e)=>{
        console.error('Fallback getUserMedia failed', e);
        setStatus('Camera unavailable: ' + (e.message || e));
      });
  }

  window.addEventListener('error', (ev)=>{
    const m = ev && ev.message ? ev.message : String(ev);
    setStatus('Runtime error: '+m);
  });
  window.addEventListener('unhandledrejection', (ev)=>{
    setStatus('Promise rejection: '+(ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason)));
  });

  // prime initial flowers
  for (let i=0;i<desiredCount;i++) spawnOne();
  requestAnimationFrame(drawScene);
});
