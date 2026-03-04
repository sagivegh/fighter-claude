const Input = (() => {
  const keys = {};
  const justPressed = {};
  const justReleased = {};

  // Touch state
  let touchX = null, touchY = null;
  let touchActive = false;

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

  // Canvas touch — move + shoot
  const canvas = document.getElementById('gameCanvas');

  function getTouchCanvasPos(touch) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (touch.clientX - rect.left) * (CONFIG.WIDTH  / rect.width),
      y: (touch.clientY - rect.top)  * (CONFIG.HEIGHT / rect.height),
    };
  }

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const pos = getTouchCanvasPos(e.touches[0]);
    touchX = pos.x;
    touchY = pos.y;
    touchActive = true;
    justPressed['TouchShoot'] = true;
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const pos = getTouchCanvasPos(e.touches[0]);
    touchX = pos.x;
    touchY = pos.y;
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    touchActive = false;
  }, { passive: false });

  // On-screen button touch handlers
  const bombBtn  = document.getElementById('touch-bomb-btn');
  const pauseBtn = document.getElementById('touch-pause-btn');
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
  }

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

  function getTouchMoveDelta(playerX, playerY) {
    if (!touchActive || touchX === null) return { dx: 0, dy: 0 };
    const ddx = touchX - playerX;
    const ddy = touchY - playerY;
    const d = Math.sqrt(ddx * ddx + ddy * ddy);
    if (d < 4) return { dx: 0, dy: 0 }; // dead zone
    // Proportional speed: 20% of distance per frame, capped at 2.5× player speed
    const maxSpd = CONFIG.PLAYER_SPEED * 2.5;
    const spd = Math.min(d * 0.2, maxSpd);
    return { dx: (ddx / d) * spd, dy: (ddy / d) * spd };
  }

  function isTouchActive() { return touchActive; }

  return {
    isDown, wasPressed, wasReleased, clearFrame,
    isMoveUp, isMoveDown, isMoveLeft, isMoveRight,
    isShoot, isBomb, isPause, isStart,
    getTouchMoveDelta, isTouchActive, showTouchButtons,
  };
})();
