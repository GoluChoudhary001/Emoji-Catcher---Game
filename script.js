// Emoji Catcher - simple frontend game (HTML/CSS/JS)

(() => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const startBtn = document.getElementById('startBtn');
    const restartBtn = document.getElementById('restartBtn');
    const helpBtn = document.getElementById('helpBtn');
    const helpEl = document.getElementById('help');
    const closeHelpBtn = document.getElementById('closeHelpBtn');
    const pauseEl = document.getElementById('pause');
    const resumeBtn = document.getElementById('resumeBtn');
    const countdownEl = document.getElementById('countdown');
    const countNum = document.getElementById('countNum');
    const muteBtn = document.getElementById('muteBtn');
    const streakBox = document.getElementById('streakBox');
    const multEl = document.getElementById('mult');
    const themeBtn = document.getElementById('themeBtn');
    const leftBtn = document.getElementById('leftBtn');
    const rightBtn = document.getElementById('rightBtn');
    const touchControls = document.getElementById('touchControls');
    const shareBtn = document.getElementById('shareBtn');
    const shareOverBtn = document.getElementById('shareOverBtn');
    const toast = document.getElementById('toast');
    const menu = document.getElementById('menu');
    const gameoverEl = document.getElementById('gameover');
    const finalScore = document.getElementById('finalScore');
    const scoreEl = document.getElementById('score');
    const highEl = document.getElementById('highScore');
  const shieldCountEl = document.getElementById('shieldCount');
  const newHighBadge = document.getElementById('newHighBadge');
  const leaderBtn = document.getElementById('leaderBtn');
  const leaderboardEl = document.getElementById('leaderboard');
  const leaderList = document.getElementById('leaderList');
  const closeLeaderBtn = document.getElementById('closeLeaderBtn');
  const resetHighBtn = document.getElementById('resetHighBtn');
  const goalText = document.getElementById('goalText');
  const goalFill = document.getElementById('goalFill');
  const dailyText = document.getElementById('dailyText');
  const dailyFill = document.getElementById('dailyFill');
  
    let dpr = window.devicePixelRatio || 1;
    let W = window.innerWidth;
    let H = Math.min(window.innerHeight, 760);
  
    function updateBucketSize(){
      const newW = Math.max(90, Math.min(180, Math.floor(W / 5)));
      const newH = Math.max(24, Math.min(40, Math.floor(newW * 0.27)));
      const centerX = bucket.x + bucket.w / 2;
      bucket.w = newW;
      bucket.h = newH;
      bucket.x = centerX - bucket.w / 2;
    }

    function resize(){
      W = window.innerWidth;
      H = Math.min(window.innerHeight, 760);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(1,0,0,1,0,0); // reset
      ctx.scale(dpr, dpr);
      bucket.y = H - 60;
      updateBucketSize();
      // clamp x on resize
      if (bucket.x < 0) bucket.x = 0;
      if (bucket.x + bucket.w > W) bucket.x = W - bucket.w;
    }
    window.addEventListener('resize', resize);
  
    const bucket = { x: Math.floor(W/2 - 60/2), y: H - 60, w: 120, h: 32, vx: 0 };
    const input = { left: false, right: false };
  
  let items = [];
    let floats = [];
    let score = 0;
    let highScore = parseInt(localStorage.getItem('emojiCatcherHighScore') || '0', 10);
    let lastTime = 0;
    let spawnTimer = 0;
    let spawnInterval = 900; // ms
    let baseSpeed = 160; // px/sec
    let difficultyTimer = 0;
    let gameState = 'menu';
    let dragging = false;
    let paused = false;
  let pausedByVisibility = false;
    let soundsEnabled = true;
    let combo = 0;
    let multiplier = 1;
    let themeNeon = true;
    let particles = [];
  let countUpRaf = 0; // RAF id for gameover score count-up
  let runs = []; // local leaderboard
  let dailyProgress = { date: '', target: 50, count: 0 };
  let nextGoalTarget = 50;
  // power-ups state
  let shieldCount = 0; // consumes on bomb
  let slowMoTimer = 0; // seconds remaining
  let magnetTimer = 0; // seconds remaining
  
  const goodEmojis = ['😃','🍕','❤️','🪙','🍩','⭐','🍎','🍪'];
  const badEmojis = ['💣','☠️','🔥','⚠️'];
  const powerEmojis = { shield: '🛡️', slow: '⏱️', magnet: '🧲' };

  function updateShieldUI(){
      if (!shieldCountEl) return;
      shieldCountEl.textContent = String(shieldCount);
    }
  
  function startGame(){
      items = [];
      score = 0;
      scoreEl.textContent = score;
      spawnTimer = 0;
      spawnInterval = 900;
      baseSpeed = 160;
      difficultyTimer = 0;
      combo = 0; multiplier = 1; updateStreakUI();
      shieldCount = 0; slowMoTimer = 0; magnetTimer = 0;
      updateShieldUI();
      updateGoalUI();
      updateDailyUI();
      // cancel any ongoing score count-up and reset text
      if (countUpRaf) { cancelAnimationFrame(countUpRaf); countUpRaf = 0; }
      if (finalScore) finalScore.textContent = 'Score: 0';
      if (newHighBadge) { newHighBadge.classList.add('hidden'); newHighBadge.classList.remove('show'); }
      gameState = 'playing'; paused = false; pauseEl.classList.add('hidden');
      menu.classList.add('hidden');
      gameoverEl.classList.add('hidden');
      lastTime = performance.now();
      requestAnimationFrame(loop);
    }
  
    function endGame(){
      gameState = 'gameover';
      // animate final score count-up for psychological reward
      countUpScore(score, 900);
      gameoverEl.classList.remove('hidden');
      if (score > highScore) {
        celebrateNewHigh();
        highScore = score;
        localStorage.setItem('emojiCatcherHighScore', String(highScore));
        highEl.textContent = highScore;
      }
      // record run
      try {
        runs.push({ score, ts: Date.now() });
        runs.sort((a,b) => b.score - a.score);
        runs = runs.slice(0, 5);
        localStorage.setItem('emojiCatcherRuns', JSON.stringify(runs));
      } catch(_) {}
    }

    function countUpScore(target, durationMs = 800){
      if (!finalScore) return;
      if (countUpRaf) { cancelAnimationFrame(countUpRaf); countUpRaf = 0; }
      finalScore.textContent = 'Score: 0';
      const start = performance.now();
      const animate = (now) => {
        const t = Math.min(1, (now - start) / durationMs);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - t, 3);
        const current = Math.round(eased * target);
        finalScore.textContent = `Score: ${current}`;
        if (t < 1) {
          countUpRaf = requestAnimationFrame(animate);
        } else {
          countUpRaf = 0;
        }
      };
      countUpRaf = requestAnimationFrame(animate);
    }

    function celebrateNewHigh(){
      // badge pop-in
      if (newHighBadge) {
        newHighBadge.classList.remove('hidden');
        // force reflow to restart animation if needed
        void newHighBadge.offsetWidth;
        newHighBadge.classList.add('show');
      }
      // confetti + emoji burst
      spawnConfettiBurst(W * 0.5, H * 0.35, 140);
      spawnConfettiBurst(W * 0.2, H * 0.38, 80);
      spawnConfettiBurst(W * 0.8, H * 0.38, 80);
      spawnEmojiBurst(W * 0.5, H * 0.32, ['🎉','✨','🏆','🎊','🌟'], 24, 80);
      // fanfare
      playFanfare();
    }

    function spawnConfettiBurst(cx, cy, count){
      const colors = ['#ff4d6d','#ffd43b','#4dabf7','#69db7c','#b197fc','#ff922b'];
      for (let i = 0; i < count; i++){
        const angle = (Math.random() * Math.PI) + Math.PI; // mostly downward spread
        const speed = 220 + Math.random()*420;
        const color = colors[Math.floor(Math.random()*colors.length)];
        particles.push({
          x: cx + (Math.random()*80 - 40),
          y: cy + (Math.random()*40 - 20),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color,
          size: 2 + Math.random()*3,
          life: 1.2 + Math.random()*0.8
        });
      }
    }

    function spawnEmojiBurst(cx, cy, emojis, size, count){
      for (let i = 0; i < count; i++){
        const e = emojis[Math.floor(Math.random()*emojis.length)];
        floats.push({ x: cx + (Math.random()*160 - 80), y: cy + (Math.random()*80 - 40), text: e, color: '#ffffff', life: 1.4 + Math.random()*0.6 });
      }
    }

    function playFanfare(){
      if (!soundsEnabled) return;
      const ctxA = getCtx();
      const now = ctxA.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const o = ctxA.createOscillator();
        const g = ctxA.createGain();
        o.type = 'square';
        o.frequency.value = freq;
        g.gain.value = 0.0001; // start silent
        o.connect(g); g.connect(ctxA.destination);
        const t0 = now + i * 0.08;
        const t1 = t0 + 0.22;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t1);
        o.start(t0);
        o.stop(t1 + 0.02);
      });
      // add a short noise burst for sparkle
      try {
        const bufferSize = 0.2;
        const sampleRate = ctxA.sampleRate;
        const buffer = ctxA.createBuffer(1, sampleRate * bufferSize, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random()*2 - 1) * (1 - i/data.length);
        const noise = ctxA.createBufferSource();
        noise.buffer = buffer;
        const g = ctxA.createGain();
        g.gain.value = 0.08;
        noise.connect(g); g.connect(ctxA.destination);
        noise.start(now + 0.05);
        noise.stop(now + 0.25);
      } catch(_) {}
    }
  
  function spawnItem(){
      const powerChance = 0.07; // 7% chance to spawn a power-up
      const base = Math.max(24, Math.min(48, Math.floor(W / 20)));
      const size = base + Math.floor(Math.random()*Math.max(10, Math.floor(W/40)));
      const x = 20 + Math.random()*(W-40);
      const vy = baseSpeed + Math.random()*120 + difficultyTimer*10;
      if (Math.random() < powerChance) {
        const types = ['shield','slow','magnet'];
        const p = types[Math.floor(Math.random()*types.length)];
        const emoji = powerEmojis[p];
        items.push({ x, y: -size, size, vy, emoji, good: false, kind: 'power', power: p });
        return;
      }
      const isGood = Math.random() < 0.85;
      const emoji = isGood ? goodEmojis[Math.floor(Math.random()*goodEmojis.length)] : badEmojis[Math.floor(Math.random()*badEmojis.length)];
      items.push({ x, y: -size, size, vy, emoji, good: isGood, kind: isGood ? 'good' : 'bad' });
    }
  
  function update(dt){
      if (gameState !== 'playing') return;
      // update active power-up timers
      if (slowMoTimer > 0) slowMoTimer = Math.max(0, slowMoTimer - dt);
      if (magnetTimer > 0) magnetTimer = Math.max(0, magnetTimer - dt);
      const speedMul = slowMoTimer > 0 ? 0.5 : 1;
      spawnTimer += dt*1000;
      difficultyTimer += dt;
      if (spawnTimer > spawnInterval) {
        spawnItem();
        spawnTimer = 0;
        if (spawnInterval > 350) spawnInterval -= 12;
        baseSpeed += 2;
      }
  
      for (let i = items.length - 1; i >= 0; --i){
        const it = items[i];
        // magnet attraction (horizontal) for good items only
        if (magnetTimer > 0 && (it.kind === 'good' || (it.good && !it.kind))) {
          const bucketCenter = bucket.x + bucket.w/2;
          const dx = bucketCenter - it.x;
          const pull = Math.max(-220, Math.min(220, dx)) * 0.8; // limit pull
          it.x += pull * dt;
        }
        it.y += it.vy * dt * speedMul;
  
        // collision (AABB precise): item rect vs bucket rect
        const itemLeft = it.x - it.size/2;
        const itemRight = it.x + it.size/2;
        const itemTop = it.y - it.size/2;
        const itemBottom = it.y + it.size/2;

        const bucketLeft = bucket.x;
        const bucketRight = bucket.x + bucket.w;
        const bucketTop = bucket.y;
        const bucketBottom = bucket.y + bucket.h;

        const isOverlap = itemLeft < bucketRight && itemRight > bucketLeft && itemTop < bucketBottom && itemBottom > bucketTop;

        if (isOverlap) {
          if (it.kind === 'power') {
            // activate power-up
            if (it.power === 'shield') {
              shieldCount = Math.min(3, shieldCount + 1);
              floats.push({ x: it.x, y: bucket.y - 10, text: 'Shield +1', color: '#00ffd5', life: 1.0 });
              showToast('Shield acquired');
              updateShieldUI();
            } else if (it.power === 'slow') {
              slowMoTimer = 3.0; // 3 seconds
              floats.push({ x: it.x, y: bucket.y - 10, text: 'Slow-mo!', color: '#6ae2ff', life: 1.0 });
              showToast('Slow-mo for 3s');
            } else if (it.power === 'magnet') {
              magnetTimer = 4.0; // 4 seconds
              floats.push({ x: it.x, y: bucket.y - 10, text: 'Magnet!', color: '#ffd54a', life: 1.0 });
              showToast('Magnet on');
            }
            playPop();
            items.splice(i,1);
          } else if (it.good) {
            combo += 1;
            multiplier = 1 + Math.floor(combo / 5); // every 5 streaks
            score += 1 * multiplier;
            scoreEl.textContent = score;
            updateGoalUI();
            updateDailyOnCatch(it);
            updateStreakUI();
            floats.push({ x: it.x, y: bucket.y - 10, text: 'Right +1', color: '#00ffd5', life: 1.0 });
            spawnParticles(it.x, bucket.y, '#00eaff');
            playPop();
            items.splice(i,1);
          } else {
            // bad item (bomb etc.)
            if (shieldCount > 0) {
              shieldCount -= 1;
              combo = 0; multiplier = 1; updateStreakUI();
              floats.push({ x: it.x, y: bucket.y - 10, text: 'Shield!', color: '#46ffb8', life: 1.0 });
              spawnParticles(it.x, bucket.y, '#7dffda');
              playPop();
              items.splice(i,1);
              updateShieldUI();
              return;
            } else {
              combo = 0; multiplier = 1; updateStreakUI();
              floats.push({ x: it.x, y: bucket.y - 10, text: 'Wrong!', color: '#b00020', life: 1.0 });
              spawnParticles(it.x, bucket.y, '#ff355e');
              playBoom();
              items.splice(i,1);
              endGame();
              return;
            }
          }
        } else if (it.y - it.size/2 > H) {
          // off-screen
          items.splice(i,1);
        }
      }

      // update floating feedbacks
      for (let i = floats.length - 1; i >= 0; --i) {
        const f = floats[i];
        f.y -= 40 * dt;
        f.life -= dt; // 1 second lifespan
        if (f.life <= 0) floats.splice(i,1);
      }

      // update particles
      for (let i = particles.length - 1; i >= 0; --i){
        const p = particles[i];
        p.vx *= 0.98; p.vy += 400 * dt; // gravity
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i,1);
      }

      // smooth movement physics for bucket
      const accel = 1200; // px/s^2
      const maxSpeed = 650; // px/s
      const friction = 1600; // px/s^2
      if (dragging) {
        bucket.vx = 0;
      } else {
        if (input.left && !input.right) bucket.vx -= accel * dt;
        else if (input.right && !input.left) bucket.vx += accel * dt;
        else {
          if (bucket.vx > 0) bucket.vx = Math.max(0, bucket.vx - friction * dt);
          if (bucket.vx < 0) bucket.vx = Math.min(0, bucket.vx + friction * dt);
        }
        if (bucket.vx > maxSpeed) bucket.vx = maxSpeed;
        if (bucket.vx < -maxSpeed) bucket.vx = -maxSpeed;
        bucket.x += bucket.vx * dt;
      }

      // keep bucket inside screen
      if (bucket.x < 0) { bucket.x = 0; bucket.vx = 0; }
      if (bucket.x + bucket.w > W) { bucket.x = W - bucket.w; bucket.vx = 0; }
    }
  
    function drawRoundedRect(x,y,w,h,r){
      ctx.beginPath();
      ctx.moveTo(x+r,y);
      ctx.arcTo(x+w,y,x+w,y+h,r);
      ctx.arcTo(x+w,y+h,x,y+h,r);
      ctx.arcTo(x,y+h,x,y,r);
      ctx.arcTo(x,y,x+w,y,r);
      ctx.closePath();
      ctx.fill();
    }
  
    function draw(){
      // clear
      ctx.clearRect(0,0,W,H);
  
      // background (neon/dark gradient)
      const g = ctx.createLinearGradient(0,0,0,H);
      if (themeNeon) { g.addColorStop(0,'#0a0f16'); g.addColorStop(1,'#08101c'); }
      else { g.addColorStop(0,'#e0f7ff'); g.addColorStop(1,'#bdefff'); }
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
  
      // items (emojis)
      for (const it of items){
        ctx.font = `${it.size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(it.emoji, it.x, it.y);
      }
  
      // bucket (visual polish)
      const bg = ctx.createLinearGradient(0, bucket.y, 0, bucket.y + bucket.h);
      bg.addColorStop(0, '#2f3742');
      bg.addColorStop(1, '#454f5b');
      ctx.save();
      ctx.fillStyle = bg;
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 2;
      drawRoundedRect(bucket.x, bucket.y, bucket.w, bucket.h, 10);
      ctx.restore();
      ctx.font = '22px serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🧺', bucket.x + bucket.w/2, bucket.y + bucket.h/2);

      // particles
      for (const p of particles){
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // floating feedback texts
      for (const f of floats) {
        ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
        ctx.fillStyle = f.color;
        ctx.font = 'bold 18px Segoe UI, Arial';
        ctx.fillText(f.text, f.x, f.y);
        ctx.globalAlpha = 1;
      }
    }

    function spawnParticles(x, y, color){
      for (let i = 0; i < 16; i++){
        const angle = Math.random() * Math.PI * 2;
        const speed = 150 + Math.random()*250;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color,
          size: 2 + Math.random()*2,
          life: 0.6 + Math.random()*0.4
        });
      }
    }
  
    function loop(ts){
      const dt = (ts - lastTime) / 1000;
      lastTime = ts;
      if (!paused) update(dt);
      draw();
      if (gameState === 'playing') requestAnimationFrame(loop);
    }

    function updateStreakUI(){
      if (multiplier > 1) {
        multEl.textContent = multiplier;
        streakBox.classList.remove('hidden');
      } else {
        streakBox.classList.add('hidden');
        multEl.textContent = '1';
      }
    }

    function doCountdownAndResume(){
      let n = 3;
      countNum.textContent = String(n);
      countdownEl.classList.remove('hidden');
      paused = true;
      const tick = () => {
        n -= 1;
        if (n > 0){
          countNum.textContent = String(n);
          setTimeout(tick, 700);
        } else {
          countdownEl.classList.add('hidden');
          paused = false;
        }
      };
      setTimeout(tick, 700);
    }

    function togglePause(){
      if (gameState !== 'playing') return;
      paused = !paused;
      if (paused) pauseEl.classList.remove('hidden');
      else pauseEl.classList.add('hidden');
    }

    // HUD: Next Goal progress based on milestones (50, 100, 250, 500, 1000 ...)
    function getNextGoalTarget(sc){
      const milestones = [50, 100, 250, 500, 1000, 2000, 5000];
      for (const m of milestones){ if (sc < m) return m; }
      return Math.ceil((sc + 1000) / 1000) * 1000; // keep scaling
    }
    function updateGoalUI(){
      nextGoalTarget = getNextGoalTarget(score);
      if (goalText) goalText.textContent = `Next: ${nextGoalTarget}`;
      const pct = Math.max(0, Math.min(100, (score / nextGoalTarget) * 100));
      if (goalFill) goalFill.style.width = pct + '%';
    }

    // Daily challenge: count catches of red-themed emojis today (simplified: heart emoji ❤️)
    function loadDaily(){
      try {
        const d = JSON.parse(localStorage.getItem('emojiCatcherDaily') || 'null');
        const today = new Date().toISOString().slice(0,10);
        if (!d || d.date !== today) {
          dailyProgress = { date: today, target: 50, count: 0 };
          localStorage.setItem('emojiCatcherDaily', JSON.stringify(dailyProgress));
        } else {
          dailyProgress = d;
        }
      } catch(_) {
        const today = new Date().toISOString().slice(0,10);
        dailyProgress = { date: today, target: 50, count: 0 };
      }
    }
    function updateDailyUI(){
      if (dailyText) dailyText.textContent = `Daily: ${dailyProgress.count}/${dailyProgress.target} ❤️`;
      const pct = Math.max(0, Math.min(100, (dailyProgress.count / dailyProgress.target) * 100));
      if (dailyFill) dailyFill.style.width = pct + '%';
    }
    function updateDailyOnCatch(it){
      // treat ❤️ as red catch for the daily example
      if (it.emoji === '❤️') {
        dailyProgress.count = Math.min(dailyProgress.target, dailyProgress.count + 1);
        try { localStorage.setItem('emojiCatcherDaily', JSON.stringify(dailyProgress)); } catch(_) {}
        updateDailyUI();
        if (dailyProgress.count === dailyProgress.target) {
          showToast('Daily complete!');
          spawnConfettiBurst(W*0.5, H*0.3, 100);
        }
      }
    }

    // Leaderboard modal
    function loadRuns(){
      try { runs = JSON.parse(localStorage.getItem('emojiCatcherRuns') || '[]') || []; }
      catch(_) { runs = []; }
    }
    function renderRuns(){
      if (!leaderList) return;
      leaderList.innerHTML = '';
      runs.forEach((r, idx) => {
        const li = document.createElement('li');
        const date = new Date(r.ts).toLocaleDateString();
        li.textContent = `#${idx+1} — ${r.score} pts — ${date}`;
        leaderList.appendChild(li);
      });
    }

    if (leaderBtn && leaderboardEl && closeLeaderBtn){
      leaderBtn.addEventListener('click', () => {
        renderRuns();
        leaderboardEl.classList.remove('hidden');
        setTimeout(() => { closeLeaderBtn.focus(); }, 0);
      });
      closeLeaderBtn.addEventListener('click', () => {
        leaderboardEl.classList.add('hidden');
        setTimeout(() => { leaderBtn.focus(); }, 0);
      });
      leaderboardEl.addEventListener('click', (e) => {
        if (e.target === leaderboardEl) leaderboardEl.classList.add('hidden');
      });
    }

    // Reset High Score
    if (resetHighBtn){
      resetHighBtn.addEventListener('click', () => {
        try {
          // High score reset
          localStorage.removeItem('emojiCatcherHighScore');
          highScore = 0;
          highEl.textContent = '0';
          showToast('High score reset');

          // Daily task reset
          const today = new Date().toISOString().slice(0,10);
          dailyProgress = { date: today, target: 50, count: 0 };
          localStorage.setItem('emojiCatcherDaily', JSON.stringify(dailyProgress));
          updateDailyUI();
        } catch(_) {}
      });
    }

  function updateMuteUI(){
      // aria-pressed indicates sound ON state for simplicity
      muteBtn.setAttribute('aria-pressed', String(soundsEnabled));
      muteBtn.textContent = soundsEnabled ? '🔊' : '🔇';
    }
    function toggleMute(){
      soundsEnabled = !soundsEnabled;
      try { localStorage.setItem('emojiCatcherMuted', String(!soundsEnabled)); } catch(_) {}
      updateMuteUI();
    }

  function updateThemeUI(){
      themeBtn.setAttribute('aria-pressed', String(themeNeon));
      themeBtn.textContent = themeNeon ? 'Neon' : 'Light';
    }
    function toggleTheme(){
      themeNeon = !themeNeon;
      try { localStorage.setItem('emojiCatcherThemeNeon', String(themeNeon)); } catch(_) {}
      updateThemeUI();
    }

    // simple SFX using WebAudio or fallback HTMLAudio
    let audioCtx;
    function getCtx(){
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      return audioCtx;
    }
    function beep(frequency, duration, type='sine', volume=0.2){
      if (!soundsEnabled) return;
      const ctxA = getCtx();
      const o = ctxA.createOscillator();
      const g = ctxA.createGain();
      o.type = type;
      o.frequency.value = frequency;
      g.gain.value = volume;
      o.connect(g); g.connect(ctxA.destination);
      o.start();
      setTimeout(() => { o.stop(); }, duration);
    }
    function vibrate(pattern){
      if (navigator.vibrate) {
        try { navigator.vibrate(pattern); } catch(_) {}
      }
    }
    function playPop(){ beep(700, 100, 'triangle', 0.15); vibrate(20); }
    function playBoom(){ beep(120, 250, 'sawtooth', 0.2); vibrate([40, 40, 60]); }
  
    // pointer controls (drag bucket)
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      bucket.x = x - bucket.w/2;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      bucket.x = x - bucket.w/2;
    });
    window.addEventListener('pointerup', () => dragging = false);
  
    // keyboard
    window.addEventListener('keydown', (e) => {
      if (e.key === 'p' || e.key === 'P') {
        togglePause();
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        toggleMute();
        return;
      }
      if (e.key === ' ' || e.key === 'Spacebar') {
        // start from menu or gameover with space
        if (gameState === 'menu' || gameState === 'gameover') {
          e.preventDefault();
          startGame();
          return;
        }
      }
      if (gameState !== 'playing') return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault();
      if (e.key === 'ArrowLeft') input.left = true;
      if (e.key === 'ArrowRight') input.right = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft') input.left = false;
      if (e.key === 'ArrowRight') input.right = false;
    });
  
    // buttons
    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);
    helpBtn.addEventListener('click', () => {
      helpEl.classList.remove('hidden');
      // focus management
      setTimeout(() => { if (closeHelpBtn) closeHelpBtn.focus(); }, 0);
    });
    closeHelpBtn.addEventListener('click', () => {
      helpEl.classList.add('hidden');
      // restore focus to trigger button
      setTimeout(() => { if (helpBtn) helpBtn.focus(); }, 0);
    });
    // Close help on Escape and click-outside
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !helpEl.classList.contains('hidden')) {
        helpEl.classList.add('hidden');
        setTimeout(() => { if (helpBtn) helpBtn.focus(); }, 0);
      }
    });
    helpEl.addEventListener('click', (e) => {
      if (e.target === helpEl) {
        helpEl.classList.add('hidden');
        setTimeout(() => { if (helpBtn) helpBtn.focus(); }, 0);
      }
    });
    resumeBtn.addEventListener('click', () => { pauseEl.classList.add('hidden'); doCountdownAndResume(); });
    muteBtn.addEventListener('click', toggleMute);
    themeBtn.addEventListener('click', toggleTheme);
    shareBtn.addEventListener('click', doShare);
    if (shareOverBtn) shareOverBtn.addEventListener('click', doShare);

    // Basic mobile detection for showing touch controls
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouch) {
      touchControls.classList.remove('hidden');
      const setLeft = (v) => { input.left = v; if (v) input.right = false; };
      const setRight = (v) => { input.right = v; if (v) input.left = false; };
      leftBtn.addEventListener('pointerdown', () => setLeft(true));
      leftBtn.addEventListener('pointerup', () => setLeft(false));
      leftBtn.addEventListener('pointerleave', () => setLeft(false));
      rightBtn.addEventListener('pointerdown', () => setRight(true));
      rightBtn.addEventListener('pointerup', () => setRight(false));
      rightBtn.addEventListener('pointerleave', () => setRight(false));
    }

    // Auto-pause on tab hide; resume with countdown on show
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (gameState === 'playing' && !paused) {
          paused = true;
          pausedByVisibility = true;
          pauseEl.classList.remove('hidden');
        }
      } else {
        if (gameState === 'playing' && paused && pausedByVisibility) {
          pausedByVisibility = false;
          pauseEl.classList.add('hidden');
          doCountdownAndResume();
        }
      }
    });

    function showToast(msg){
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 1800);
    }

    async function doShare(){
      const shareData = {
        title: 'Emoji Catcher',
        text: 'Catch the emojis! Can you beat my score?',
        url: window.location.href
      };
      if (navigator.share) {
        try { await navigator.share(shareData); }
        catch(e) { /* user cancelled */ }
      } else {
        try {
          await navigator.clipboard.writeText(shareData.url);
          showToast('Link copied!');
        } catch(e){
          showToast('Copy failed');
        }
      }
    }
  
    // init
    // Restore preferences
    try {
      const storedMuted = localStorage.getItem('emojiCatcherMuted');
      if (storedMuted === 'true') soundsEnabled = false;
      const storedTheme = localStorage.getItem('emojiCatcherThemeNeon');
      if (storedTheme === 'true') themeNeon = true;
      if (storedTheme === 'false') themeNeon = false;
    } catch(_) {}
    updateMuteUI();
    updateThemeUI();
    loadRuns();
    loadDaily();

    resize();
    scoreEl.textContent = score;
    highEl.textContent = highScore;
    updateShieldUI();
    updateGoalUI();
    updateDailyUI();
  })();

// Canvas par touch drag se bucket move karne ka logic
canvas.addEventListener('touchstart', function(e) {
  if (gameState !== 'play') return;
  dragging = true;
  handleTouchMove(e);
}, { passive: false });

canvas.addEventListener('touchmove', function(e) {
  if (!dragging || gameState !== 'play') return;
  handleTouchMove(e);
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', function(e) {
  dragging = false;
}, { passive: false });

function handleTouchMove(e) {
  if (!e.touches || e.touches.length === 0) return;
  const touch = e.touches[0];
  // Canvas ki position nikalna
  const rect = canvas.getBoundingClientRect();
  const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
  // Bucket ko center align karna touch position par
  bucket.x = Math.max(0, Math.min(W - bucket.w, x - bucket.w/2));
}
