const Input = (() => {
  const keys = {};
  const justPressed = {};
  const justReleased = {};

  // Joystick state
  let joyDx = 0, joyDy = 0;   // normalised [-1..1]
  let joyActive = false;
  let joyId = null;
  let joyBaseCX = 0, joyBaseCY = 0; // base centre in zone-local px
  let rightTouchActive = false;
  const JOY_RADIUS = 55;

  document.addEventListener('keydown', (e) => {
    if (!keys[e.code]) {
      justPressed[e.code] = true;
    }
    keys[e.code] = true;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
      e.preventDefault();
    }
  });

  document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    justReleased[e.code] = true;
  });

  // DOM refs
  const canvas    = document.getElementById('gameCanvas');
  const joyZone   = document.getElementById('joystick-zone');
  const joyBase   = document.getElementById('joystick-base');
  const joyKnob   = document.getElementById('joystick-knob');

  // ── Joystick zone listeners ──────────────────────────────────────────────
  joyZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (joyActive) return; // already tracking
    const touch = e.changedTouches[0];
    joyId = touch.identifier;
    joyActive = true;
    justPressed['TouchShoot'] = true;

    // Position base centred on touch, clamped inside zone
    const rect = joyZone.getBoundingClientRect();
    const lx = touch.clientX - rect.left;
    const ly = touch.clientY - rect.top;
    const half = 55; // base radius
    const cx = clamp(lx, half, rect.width  - half);
    const cy = clamp(ly, half, rect.height - half);
    joyBaseCX = cx;
    joyBaseCY = cy;

    joyBase.style.left = (cx - half) + 'px';
    joyBase.style.top  = (cy - half) + 'px';
    joyBase.style.display = 'block';

    // Reset knob to centre
    joyKnob.style.left = '50%';
    joyKnob.style.top  = '50%';
    joyKnob.style.transform = 'translate(-50%,-50%)';
    joyDx = 0; joyDy = 0;
  }, { passive: false });

  joyZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier !== joyId) continue;
      const rect = joyZone.getBoundingClientRect();
      const lx = touch.clientX - rect.left;
      const ly = touch.clientY - rect.top;
      let ox = lx - joyBaseCX;
      let oy = ly - joyBaseCY;
      const dist = Math.sqrt(ox * ox + oy * oy);
      if (dist > JOY_RADIUS) {
        ox = (ox / dist) * JOY_RADIUS;
        oy = (oy / dist) * JOY_RADIUS;
      }
      joyDx = ox / JOY_RADIUS;
      joyDy = oy / JOY_RADIUS;

      // Move knob visually (offset from base centre = 50%+offset)
      const half = 55;
      joyKnob.style.left = (half + ox) + 'px';
      joyKnob.style.top  = (half + oy) + 'px';
      joyKnob.style.transform = 'translate(-50%,-50%)';
    }
  }, { passive: false });

  function resetJoy() {
    joyActive = false;
    joyId = null;
    joyDx = 0; joyDy = 0;
    joyBase.style.display = 'none';
    joyKnob.style.left = '50%';
    joyKnob.style.top  = '50%';
    joyKnob.style.transform = 'translate(-50%,-50%)';
  }

  joyZone.addEventListener('touchend',    (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === joyId) resetJoy(); }, { passive: false });
  joyZone.addEventListener('touchcancel', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === joyId) resetJoy(); }, { passive: false });

  // ── Right-side canvas: tap/hold to shoot ────────────────────────────────
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      const rect = canvas.getBoundingClientRect();
      const cx = (touch.clientX - rect.left) * (CONFIG.WIDTH / rect.width);
      if (cx > CONFIG.WIDTH / 2) {
        rightTouchActive = true;
        justPressed['TouchShoot'] = true;
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    // Only clear if no right-side touches remain
    let anyRight = false;
    for (const touch of e.targetTouches) {
      const rect = canvas.getBoundingClientRect();
      const cx = (touch.clientX - rect.left) * (CONFIG.WIDTH / rect.width);
      if (cx > CONFIG.WIDTH / 2) anyRight = true;
    }
    rightTouchActive = anyRight;
  }, { passive: false });

  canvas.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    rightTouchActive = false;
  }, { passive: false });

  // ── On-screen button touch handlers ──────────────────────────────────────
  const bombBtn   = document.getElementById('touch-bomb-btn');
  const pauseBtn  = document.getElementById('touch-pause-btn');
  const resumeBtn = document.getElementById('resume-btn');

  bombBtn.addEventListener('touchstart',  (e) => { e.stopPropagation(); e.preventDefault(); justPressed['TouchBomb']  = true; }, { passive: false });
  pauseBtn.addEventListener('touchstart', (e) => { e.stopPropagation(); e.preventDefault(); justPressed['TouchPause'] = true; }, { passive: false });
  bombBtn.addEventListener('mousedown',  () => { justPressed['TouchBomb']  = true; });
  pauseBtn.addEventListener('mousedown', () => { justPressed['TouchPause'] = true; });
  resumeBtn.addEventListener('touchstart', (e) => { e.preventDefault(); justPressed['TouchPause'] = true; }, { passive: false });
  resumeBtn.addEventListener('mousedown', () => { justPressed['TouchPause'] = true; });

  function showTouchButtons(visible) {
    bombBtn.classList.toggle('hidden', !visible);
    pauseBtn.classList.toggle('hidden', !visible);
    joyZone.classList.toggle('hidden', !visible);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  function isDown(code) { return !!keys[code]; }
  function wasPressed(code) { return !!justPressed[code]; }
  function wasReleased(code) { return !!justReleased[code]; }

  function clearFrame() {
    for (const k in justPressed)  delete justPressed[k];
    for (const k in justReleased) delete justReleased[k];
  }

  function isMoveUp()    { return isDown('ArrowUp')    || isDown('KeyW'); }
  function isMoveDown()  { return isDown('ArrowDown')  || isDown('KeyS'); }
  function isMoveLeft()  { return isDown('ArrowLeft')  || isDown('KeyA'); }
  function isMoveRight() { return isDown('ArrowRight') || isDown('KeyD'); }
  function isShoot()     { return isDown('Space') || isDown('KeyZ'); }
  function isBomb()      { return wasPressed('KeyX') || wasPressed('ShiftLeft') || wasPressed('TouchBomb'); }
  function isPause()     { return wasPressed('KeyP') || wasPressed('Escape') || wasPressed('TouchPause'); }
  function isStart()     { return wasPressed('Enter') || wasPressed('Space') || wasPressed('TouchShoot'); }

  function isTouchActive() { return joyActive || rightTouchActive; }

  function getTouchMoveDelta() {
    if (!joyActive) return { dx: 0, dy: 0 };
    return { dx: joyDx * CONFIG.PLAYER_SPEED, dy: joyDy * CONFIG.PLAYER_SPEED };
  }

  return {
    isDown, wasPressed, wasReleased, clearFrame,
    isMoveUp, isMoveDown, isMoveLeft, isMoveRight,
    isShoot, isBomb, isPause, isStart,
    getTouchMoveDelta, isTouchActive, showTouchButtons,
  };
})();
