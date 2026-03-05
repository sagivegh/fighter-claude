class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = CONFIG.PLAYER_START_X;
    this.y = CONFIG.PLAYER_START_Y;
    this.w = 36;
    this.h = 40;
    this.speed = CONFIG.PLAYER_SPEED;
    this.lives = CONFIG.PLAYER_MAX_LIVES;
    this.power = 1;            // 1-5
    this.weaponType = 'normal';// normal, spread, laser
    this.weaponTimer = 0;      // how long special weapon lasts
    this.shield = false;
    this.shieldTimer = 0;
    this.invincible = false;
    this.invincibleTimer = 0;
    this.shootTimer = 0;
    this.bombs = 3;
    this.score = 0;
    this.alive = true;
    this.deathTimer = 0;
    this.engineFlicker = 0;
    this.trail = [];
  }

  get hitbox() {
    return { x: this.x - 10, y: this.y - 12, w: 20, h: 24 };
  }

  shoot(bulletMgr) {
    if (!this.alive) return;
    this.shootTimer--;
    if (this.shootTimer > 0) return;
    const rate = CONFIG.POWER_SHOOT_RATES[this.power - 1];
    this.shootTimer = rate;
    Audio.shoot();

    if (this.weaponType === 'laser') {
      this.fireLaser(bulletMgr);
    } else if (this.weaponType === 'spread' || this.power >= 3) {
      this.fireSpread(bulletMgr);
    } else {
      this.fireNormal(bulletMgr);
    }
  }

  fireNormal(bulletMgr) {
    if (this.power === 1) {
      bulletMgr.addPlayerBullet(this.x, this.y - 16);
    } else {
      bulletMgr.addPlayerBullet(this.x - 7, this.y - 12);
      bulletMgr.addPlayerBullet(this.x + 7, this.y - 12);
    }
  }

  fireSpread(bulletMgr) {
    const spd = CONFIG.PLAYER_BULLET_SPEED;
    const angles = this.power >= 4
      ? [-0.35, -0.17, 0, 0.17, 0.35]
      : [-0.25, 0, 0.25];
    for (const a of angles) {
      bulletMgr.addPlayerBullet(
        this.x, this.y - 16,
        Math.sin(a) * spd,
        -Math.cos(a) * spd,
        '#0f8'
      );
    }
  }

  fireLaser(bulletMgr) {
    // Fast narrow laser
    const color = '#f4f';
    bulletMgr.addPlayerBullet(this.x - 2, this.y - 16, 0, -18, color);
    bulletMgr.addPlayerBullet(this.x + 2, this.y - 16, 0, -18, color);
  }

  useBomb(bulletMgr, enemies, explosions) {
    if (this.bombs <= 0 || !this.alive) return false;
    this.bombs--;
    Audio.bomb();
    // Screen flash effect handled in game.js
    // Kill all on-screen enemies (or damage bosses)
    for (const enemy of enemies) {
      if (enemy.isBoss) {
        enemy.hp -= 30;
      } else {
        enemy.hp = 0;
      }
    }
    // Clear enemy bullets
    bulletMgr.enemyBullets = [];
    return true;
  }

  update() {
    if (!this.alive) {
      this.deathTimer--;
      if (this.deathTimer <= 0) this.alive = true;
      return;
    }

    // Invincibility countdown
    if (this.invincible) {
      this.invincibleTimer--;
      if (this.invincibleTimer <= 0) {
        this.invincible = false;
        this.shield = false;
      }
    }

    // Shield timer
    if (this.shieldTimer > 0) {
      this.shieldTimer--;
      if (this.shieldTimer <= 0) this.shield = false;
    }

    // Weapon timer
    if (this.weaponTimer > 0) {
      this.weaponTimer--;
      if (this.weaponTimer <= 0) this.weaponType = 'normal';
    }

    // Engine flicker
    this.engineFlicker = (this.engineFlicker + 1) % 6;

    // Trail
    this.trail.push({ x: this.x, y: this.y + this.h / 2, life: 10 });
    if (this.trail.length > 15) this.trail.shift();
    for (const t of this.trail) t.life--;
  }

  handleInput(bulletMgr) {
    if (!this.alive) return;

    let dx = 0, dy = 0;

    if (Input.isTouchActive()) {
      const delta = Input.getTouchMoveDelta();
      dx = delta.dx;
      dy = delta.dy;
    } else {
      if (Input.isMoveLeft())  dx -= this.speed;
      if (Input.isMoveRight()) dx += this.speed;
      if (Input.isMoveUp())    dy -= this.speed;
      if (Input.isMoveDown())  dy += this.speed;

      // Diagonal normalization
      if (dx !== 0 && dy !== 0) {
        dx *= 0.707;
        dy *= 0.707;
      }
    }

    this.x = clamp(this.x + dx, this.w / 2, CONFIG.WIDTH - this.w / 2);
    this.y = clamp(this.y + dy, this.h / 2, CONFIG.HEIGHT - this.h / 2);

    if (Input.isShoot() || Input.isTouchActive()) {
      this.shoot(bulletMgr);
    }
  }

  takeDamage() {
    if (this.invincible || this.shield) {
      if (this.shield) {
        this.shield = false;
        this.shieldTimer = 0;
        this.invincible = true;
        this.invincibleTimer = 60;
      }
      return false;
    }
    this.lives--;
    Audio.playerHit();
    this.invincible = true;
    this.invincibleTimer = CONFIG.PLAYER_INVINCIBLE_TIME;
    this.weaponType = 'normal';
    this.weaponTimer = 0;
    if (this.power > 1) this.power--;
    return true; // took damage
  }

  applyPowerup(type) {
    Audio.powerup();
    switch (type) {
      case 'POWER':
        this.power = Math.min(this.power + 1, CONFIG.POWER_MAX);
        break;
      case 'SHIELD':
        this.shield = true;
        this.shieldTimer = 600;
        this.invincible = false;
        break;
      case 'BOMB':
        this.bombs = Math.min(this.bombs + 1, 9);
        break;
      case 'SPREAD':
        this.weaponType = 'spread';
        this.weaponTimer = 600;
        break;
      case 'LASER':
        this.weaponType = 'laser';
        this.weaponTimer = 420;
        break;
      case 'LIFE':
        this.lives = Math.min(this.lives + 1, 5);
        break;
    }
  }

  draw(ctx) {
    if (!this.alive) return;

    // Invincibility flicker
    if (this.invincible && Math.floor(this.invincibleTimer / 5) % 2 === 0) return;

    const x = this.x, y = this.y;

    // Draw engine trail
    this.drawTrail(ctx);

    // Draw shield
    if (this.shield) {
      this.drawShield(ctx, x, y);
    }

    ctx.save();

    const engineOn = this.engineFlicker < 4;

    // ── F-35 Lightning II — top-down silhouette ──────────────────────────────
    // Blended delta wing-body (one unified shape — F-35 has no distinct separate wings)
    ctx.fillStyle = '#8c9482'; // stealth grey-green
    ctx.beginPath();
    ctx.moveTo(x,      y - 22); // sharp nose
    ctx.lineTo(x + 5,  y - 12); // chine right
    ctx.lineTo(x + 26, y + 6);  // wingtip leading edge
    ctx.lineTo(x + 22, y + 18); // wingtip trailing
    ctx.lineTo(x + 7,  y + 22); // tail right shoulder
    ctx.lineTo(x + 5,  y + 26); // tail right
    ctx.lineTo(x,      y + 28); // tail centre
    ctx.lineTo(x - 5,  y + 26); // tail left
    ctx.lineTo(x - 7,  y + 22); // tail left shoulder
    ctx.lineTo(x - 22, y + 18); // wingtip trailing
    ctx.lineTo(x - 26, y + 6);  // wingtip leading edge
    ctx.lineTo(x - 5,  y - 12); // chine left
    ctx.closePath();
    ctx.fill();

    // Wing undersurface shading (slightly darker)
    ctx.fillStyle = '#727a68';
    ctx.beginPath();
    ctx.moveTo(x + 5,  y - 2);
    ctx.lineTo(x + 26, y + 6);
    ctx.lineTo(x + 22, y + 18);
    ctx.lineTo(x + 8,  y + 20);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 5,  y - 2);
    ctx.lineTo(x - 26, y + 6);
    ctx.lineTo(x - 22, y + 18);
    ctx.lineTo(x - 8,  y + 20);
    ctx.closePath();
    ctx.fill();

    // Canted V-tail fins
    ctx.fillStyle = '#606858';
    // Left fin
    ctx.beginPath();
    ctx.moveTo(x - 5,  y + 18);
    ctx.lineTo(x - 13, y + 22);
    ctx.lineTo(x - 10, y + 28);
    ctx.lineTo(x - 5,  y + 26);
    ctx.closePath();
    ctx.fill();
    // Right fin
    ctx.beginPath();
    ctx.moveTo(x + 5,  y + 18);
    ctx.lineTo(x + 13, y + 22);
    ctx.lineTo(x + 10, y + 28);
    ctx.lineTo(x + 5,  y + 26);
    ctx.closePath();
    ctx.fill();

    // DSI inlet bump (left side of fuselage)
    ctx.fillStyle = '#6e766a';
    ctx.beginPath();
    ctx.ellipse(x - 5, y + 2, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Panel / seam lines (stealth facet borders)
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    // Nose chines
    ctx.moveTo(x, y - 22); ctx.lineTo(x + 5, y - 12);
    ctx.moveTo(x, y - 22); ctx.lineTo(x - 5, y - 12);
    // Mid-body panel
    ctx.moveTo(x + 5, y - 12); ctx.lineTo(x + 8, y + 12);
    ctx.moveTo(x - 5, y - 12); ctx.lineTo(x - 8, y + 12);
    // Wing fold line
    ctx.moveTo(x + 8, y + 4); ctx.lineTo(x + 22, y + 18);
    ctx.moveTo(x - 8, y + 4); ctx.lineTo(x - 22, y + 18);
    ctx.stroke();

    // Canopy (dark tinted bubble)
    ctx.fillStyle = '#1e3a52';
    ctx.beginPath();
    ctx.ellipse(x, y - 10, 3.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Canopy highlight
    ctx.fillStyle = 'rgba(150,200,255,0.2)';
    ctx.beginPath();
    ctx.ellipse(x - 0.5, y - 12, 1.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Engine exhaust nozzle
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.ellipse(x, y + 27, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.ellipse(x, y + 27, 3, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Engine flame (afterburner)
    if (engineOn) {
      const flameH = randInt(10, 18);
      const grad = ctx.createLinearGradient(x, y + 28, x, y + 28 + flameH);
      grad.addColorStop(0,   '#fff');
      grad.addColorStop(0.3, '#f80');
      grad.addColorStop(0.7, '#f40');
      grad.addColorStop(1,   'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(x, y + 30, 4, flameH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Weapon type glow accent
    if (this.weaponType === 'spread') {
      ctx.fillStyle = '#0f8';
      ctx.fillRect(x - 25, y + 6, 3, 5);
      ctx.fillRect(x + 22, y + 6, 3, 5);
    } else if (this.weaponType === 'laser') {
      ctx.fillStyle = '#f4f';
      ctx.beginPath();
      ctx.arc(x, y - 22, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawShield(ctx, x, y) {
    const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
    ctx.save();
    ctx.globalAlpha = pulse * 0.4;
    ctx.strokeStyle = '#0f8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y, 34, 36, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = pulse * 0.08;
    ctx.fillStyle = '#0f8';
    ctx.fill();
    ctx.restore();
  }

  drawTrail(ctx) {
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      if (t.life <= 0) continue;
      const alpha = (t.life / 10) * 0.45;
      const size  = (t.life / 10) * 3;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#f80';
      ctx.beginPath();
      ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
