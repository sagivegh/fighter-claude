// ─── Game States ───────────────────────────────────────────────────────────────
const STATE = { START: 0, PLAYING: 1, PAUSED: 2, GAMEOVER: 3, LEVELUP: 4 };

// ─── Main Game ─────────────────────────────────────────────────────────────────
const Game = (() => {
  let canvas, ctx;
  let state = STATE.START;
  let lastTime = 0;
  let frameCount = 0;

  // Systems
  let bg, player, bullets, enemies, groundMgr, powerups, explosions;
  let level = 1;
  let score = 0;
  let hiscore = 0;
  let bombFlash = 0;
  let levelUpTimer = 0;
  let floatTexts = [];

  function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    canvas.width  = CONFIG.WIDTH;
    canvas.height = CONFIG.HEIGHT;

    Audio.init();

    bg         = new Background();
    player     = new Player();
    bullets    = new BulletManager();
    enemies    = new EnemyManager();
    groundMgr  = new GroundUnitManager();
    powerups   = new PowerupManager();
    explosions = new ExplosionManager();

    // Load hiscore
    try { hiscore = parseInt(localStorage.getItem('wf_hiscore') || '0'); } catch(e) {}

    bindUI();
    requestAnimationFrame(loop);
  }

  function bindUI() {
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', startGame);
    document.getElementById('resume-btn').addEventListener('click', () => setState(STATE.PLAYING));

    // Keyboard start
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' && state === STATE.START) startGame();
    });
  }

  function startGame() {
    Audio.resume();
    score = 0;
    level = 1;
    bombFlash = 0;
    floatTexts = [];
    player.reset();
    bullets.clear();
    enemies.clear();
    groundMgr.clear();
    powerups.clear();
    explosions.clear();
    enemies.setLevel(level);
    groundMgr.setLevel(level);
    showScreen(null);
    updateHUD();
    setState(STATE.PLAYING);
  }

  function loop(ts) {
    const dt = Math.min((ts - lastTime) / 16.67, 3); // cap at 3x slowdown
    lastTime = ts;
    frameCount++;

    update(dt);
    draw();
    Input.clearFrame();
    requestAnimationFrame(loop);
  }

  // ─── Update ──────────────────────────────────────────────────────────────────
  function update(dt) {
    bg.update();

    if (state === STATE.START) return;

    if (state === STATE.PAUSED) {
      if (Input.isPause()) setState(STATE.PLAYING);
      return;
    }

    if (state === STATE.GAMEOVER) {
      if (Input.isStart()) startGame();
      return;
    }

    if (state === STATE.LEVELUP) {
      levelUpTimer--;
      if (levelUpTimer <= 0) finishLevelUp();
      return;
    }

    // PLAYING
    if (Input.isPause()) {
      setState(STATE.PAUSED);
      return;
    }

    // Bomb input
    if (Input.isBomb()) {
      if (player.useBomb(bullets, enemies.enemies, explosions)) {
        bombFlash = 20;
        for (const e of enemies.enemies) {
          if (!e.isBoss) explosions.add(e.x, e.y, 'medium');
        }
        // Bomb also clears SAM missiles and damages ground units
        groundMgr.missiles = [];
        for (const u of groundMgr.units) {
          u.hp -= 15;
          explosions.add(u.x, u.y, 'big');
          if (u.hp <= 0) { u.active = false; score += u.score; }
        }
        updateHUD();
      }
    }

    // Systems
    player.handleInput(bullets);
    player.update();
    bullets.update();
    enemies.update(bullets, player.x, player.y);
    groundMgr.update(bullets, player, explosions);
    powerups.update();
    explosions.update();

    // Float texts
    floatTexts = floatTexts.filter(t => {
      t.y -= 1.2;
      t.life--;
      return t.life > 0;
    });

    if (bombFlash > 0) bombFlash--;

    // Collision detection
    if (player.alive && !player.invincible) {
      checkPlayerVsEnemyBullets();
      checkPlayerVsEnemies();
      checkPlayerVsSAMissiles();
    }
    checkPlayerBulletsVsEnemies();
    checkPlayerBulletsVsGroundUnits();
    checkPlayerVsPowerups();

    // Level progression
    checkLevelProgress();

    updateHUD();
  }

  // ─── Collision ───────────────────────────────────────────────────────────────
  function checkPlayerVsEnemyBullets() {
    const pb = player.hitbox;
    for (const b of bullets.enemyBullets) {
      if (!b.active) continue;
      if (rectsOverlap(pb, b.hitbox)) {
        b.active = false;
        if (player.takeDamage()) {
          explosions.add(player.x, player.y, 'small');
          if (player.lives <= 0) doGameOver();
        }
        break;
      }
    }
  }

  function checkPlayerVsEnemies() {
    const pb = player.hitbox;
    for (const e of enemies.enemies) {
      if (rectsOverlap(pb, e.hitbox)) {
        if (player.takeDamage()) {
          explosions.add(player.x, player.y, 'small');
          if (player.lives <= 0) doGameOver();
        }
        if (!e.isBoss) {
          e.active = false;
          explosions.add(e.x, e.y, 'medium');
        }
        break;
      }
    }
  }

  function checkPlayerBulletsVsEnemies() {
    for (const b of bullets.playerBullets) {
      if (!b.active) continue;
      for (const e of enemies.enemies) {
        if (rectsOverlap(b.hitbox, e.hitbox)) {
          b.active = false;
          const killed = e.hit(1);
          if (killed) {
            const pts = e.score;
            score += pts;
            enemies.onKill(e);
            const expType = e.isBoss ? 'boss' : e.hp > 5 ? 'big' : 'medium';
            explosions.add(e.x, e.y, expType);
            Audio.explosion(e.isBoss || e.hp > 4);

            // Powerup drop
            if (!e.isBoss && Math.random() < CONFIG.POWERUP_SPAWN_CHANCE) {
              powerups.spawn(e.x, e.y);
            } else if (e.isBoss) {
              powerups.spawn(e.x, e.y, 'POWER');
              powerups.spawn(e.x + 30, e.y, 'LIFE');
            }

            addFloat(`+${pts}`, e.x, e.y, '#ff0');
          } else {
            // Hit flash only
            addFloat('-1', e.x, e.y - 10, '#f88');
          }
          break;
        }
      }
    }
  }

  function checkPlayerVsSAMissiles() {
    const pb = player.hitbox;
    for (const m of groundMgr.missiles) {
      if (!m.active) continue;
      if (rectsOverlap(pb, m.hitbox)) {
        m.active = false;
        if (player.takeDamage()) {
          explosions.add(player.x, player.y, 'small');
          if (player.lives <= 0) doGameOver();
        }
        break;
      }
    }
  }

  function checkPlayerBulletsVsGroundUnits() {
    for (const b of bullets.playerBullets) {
      if (!b.active) continue;
      // Check against ground units
      for (const u of groundMgr.units) {
        if (rectsOverlap(b.hitbox, u.hitbox)) {
          b.active = false;
          const killed = u.hit(1);
          if (killed) {
            score += u.score;
            explosions.add(u.x, u.y, 'big');
            Audio.explosion(true);
            if (Math.random() < 0.2) powerups.spawn(u.x, u.y);
            addFloat(`+${u.score}`, u.x, u.y, '#0f0');
          } else {
            addFloat('-1', u.x, u.y - 10, '#8f8');
          }
          break;
        }
      }
      if (!b.active) continue;
      // Player bullets can also shoot down SAM missiles
      for (const m of groundMgr.missiles) {
        if (!m.active) continue;
        if (rectsOverlap(b.hitbox, m.hitbox)) {
          b.active = false;
          m.active = false;
          explosions.add(m.x, m.y, 'small');
          addFloat('MISSILE DOWN', m.x, m.y, '#0ff');
          break;
        }
      }
    }
  }

  function checkPlayerVsPowerups() {
    const pb = player.hitbox;
    for (const p of powerups.powerups) {
      if (!p.active) continue;
      if (rectsOverlap(pb, p.hitbox)) {
        p.active = false;
        player.applyPowerup(p.type);
        addFloat(p.info.desc, player.x, player.y - 20, p.info.color);
      }
    }
  }

  // ─── Level Progress ───────────────────────────────────────────────────────────
  function checkLevelProgress() {
    // Level complete if boss defeated or all waves done
    const bossDefeated = enemies.isBossDefeated();
    const wavesDone = enemies.allWavesDone();

    if (bossDefeated || (wavesDone && level < 3)) {
      if (level < CONFIG.MAX_LEVEL) {
        beginLevelUp();
      } else {
        // Game won
        doGameOver(true);
      }
    }
  }

  function beginLevelUp() {
    if (state === STATE.LEVELUP) return;
    level++;
    Audio.levelUp();
    score += level * 500; // level clear bonus
    addFloat(`LEVEL CLEAR! +${level * 500}`, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, '#0f0');
    setState(STATE.LEVELUP);
    levelUpTimer = 180;

    const el = document.getElementById('levelup-text');
    const sub = document.getElementById('levelup-sub');
    el.textContent = `LEVEL ${level}`;
    sub.textContent = level > 5 ? 'Boss incoming!' : 'Get Ready!';
    showScreen('levelup-screen');
  }

  function finishLevelUp() {
    bullets.clear();
    enemies.clear();
    groundMgr.clear();
    powerups.clear();
    enemies.setLevel(level);
    groundMgr.setLevel(level);
    showScreen(null);
    setState(STATE.PLAYING);
  }

  function doGameOver(win = false) {
    setState(STATE.GAMEOVER);
    Audio.gameOver();
    if (score > hiscore) {
      hiscore = score;
      try { localStorage.setItem('wf_hiscore', hiscore); } catch(e) {}
    }
    document.getElementById('final-score').textContent = score;
    document.getElementById('final-level').textContent = level;
    const h2 = document.querySelector('#gameover-screen h2');
    h2.textContent = win ? 'YOU WIN!' : 'GAME OVER';
    showScreen('gameover-screen');
  }

  // ─── HUD ─────────────────────────────────────────────────────────────────────
  function updateHUD() {
    document.getElementById('score').textContent    = score;
    document.getElementById('hiscore').textContent  = hiscore;
    document.getElementById('level').textContent    = level;
    document.getElementById('bombs').textContent    = player.bombs;
    document.getElementById('weapon-name').textContent = player.weaponType.toUpperCase();
    document.getElementById('power-level').textContent = player.power;
    document.getElementById('power-bar').style.width = (player.power / CONFIG.POWER_MAX * 100) + '%';

    // Lives icons
    const livesEl = document.getElementById('lives-icons');
    livesEl.innerHTML = '';
    for (let i = 0; i < player.lives; i++) {
      const icon = document.createElement('div');
      icon.className = 'life-icon';
      livesEl.appendChild(icon);
    }
  }

  function addFloat(text, x, y, color) {
    floatTexts.push({ text, x, y, color, life: 60, maxLife: 60 });
  }

  function setState(s) {
    state = s;
    Input.showTouchButtons(s === STATE.PLAYING);
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    if (id) document.getElementById(id).classList.remove('hidden');
  }

  // ─── Draw ─────────────────────────────────────────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    bg.draw(ctx);

    if (state === STATE.START) {
      drawStartBg();
      return;
    }

    // Bomb screen flash
    if (bombFlash > 0) {
      ctx.save();
      ctx.globalAlpha = (bombFlash / 20) * 0.5;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
      ctx.restore();
    }

    groundMgr.draw(ctx);
    powerups.draw(ctx);
    enemies.draw(ctx);
    bullets.draw(ctx);
    player.draw(ctx);
    explosions.draw(ctx);

    // Float texts
    for (const t of floatTexts) {
      const alpha = t.life / t.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = t.color || '#fff';
      ctx.font = 'bold 14px Courier New';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = t.color || '#fff';
      ctx.shadowBlur = 6;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }

    if (state === STATE.PAUSED) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
      ctx.restore();
    }
  }

  function drawStartBg() {
    // Animated enemy silhouettes drifting down on title screen
    ctx.save();
    ctx.globalAlpha = 0.28;
    const t = frameCount;
    const cols = ['#d4a84a', '#c8883a', '#b87040', '#a06030', '#784020'];
    for (let i = 0; i < 5; i++) {
      const x = (CONFIG.WIDTH / 5) * i + CONFIG.WIDTH / 10;
      const y = ((t * 0.6 + i * 110) % (CONFIG.HEIGHT + 100)) - 50;
      ctx.fillStyle = cols[i % cols.length];
      // Simple fighter silhouette
      ctx.beginPath();
      ctx.moveTo(x,      y - 14);
      ctx.lineTo(x + 3,  y - 4);
      ctx.lineTo(x + 16, y + 4);
      ctx.lineTo(x + 12, y + 14);
      ctx.lineTo(x + 3,  y + 10);
      ctx.lineTo(x + 2,  y + 14);
      ctx.lineTo(x - 2,  y + 14);
      ctx.lineTo(x - 3,  y + 10);
      ctx.lineTo(x - 12, y + 14);
      ctx.lineTo(x - 16, y + 4);
      ctx.lineTo(x - 3,  y - 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Start on load
  window.addEventListener('load', init);

  return { getState: () => state };
})();
