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
      const delta = Input.getTouchMoveDelta(this.x, this.y);
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

    // Engine glow
    const engineOn = this.engineFlicker < 4;
    if (engineOn) {
      ctx.shadowColor = '#4af';
      ctx.shadowBlur = 12;
    }

    // Main body
    ctx.fillStyle = '#c8dcf0';
    ctx.beginPath();
    ctx.moveTo(x, y - 20);         // nose
    ctx.lineTo(x + 12, y + 5);
    ctx.lineTo(x + 8, y + 20);
    ctx.lineTo(x - 8, y + 20);
    ctx.lineTo(x - 12, y + 5);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.fillStyle = '#4af';
    ctx.beginPath();
    ctx.ellipse(x, y - 8, 5, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wings
    ctx.fillStyle = '#8aaac8';
    // Left wing
    ctx.beginPath();
    ctx.moveTo(x - 12, y + 5);
    ctx.lineTo(x - 24, y + 15);
    ctx.lineTo(x - 20, y + 20);
    ctx.lineTo(x - 8, y + 20);
    ctx.closePath();
    ctx.fill();

    // Right wing
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 5);
    ctx.lineTo(x + 24, y + 15);
    ctx.lineTo(x + 20, y + 20);
    ctx.lineTo(x + 8, y + 20);
    ctx.closePath();
    ctx.fill();

    // Wing tips
    ctx.fillStyle = '#f84';
    ctx.fillRect(x - 26, y + 13, 4, 4);
    ctx.fillRect(x + 22, y + 13, 4, 4);

    // Engine flame
    if (engineOn) {
      const flameH = randInt(8, 14);
      const grad = ctx.createLinearGradient(x, y + 20, x, y + 20 + flameH);
      grad.addColorStop(0, '#4af');
      grad.addColorStop(0.5, '#fff');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(x, y + 22, 4, flameH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Weapon color accent
    if (this.weaponType === 'spread') {
      ctx.fillStyle = '#0f8';
      ctx.fillRect(x - 14, y + 3, 4, 4);
      ctx.fillRect(x + 10, y + 3, 4, 4);
    } else if (this.weaponType === 'laser') {
      ctx.fillStyle = '#f4f';
      ctx.shadowColor = '#f4f';
      ctx.shadowBlur = 8;
      ctx.fillRect(x - 3, y - 24, 6, 6);
    }

    ctx.restore();
  }

  drawShield(ctx, x, y) {
    const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
    ctx.save();
    ctx.globalAlpha = pulse * 0.4;
    ctx.strokeStyle = '#4af';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#4af';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.ellipse(x, y, 32, 36, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = pulse * 0.1;
    ctx.fillStyle = '#4af';
    ctx.fill();
    ctx.restore();
  }

  drawTrail(ctx) {
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      if (t.life <= 0) continue;
      const alpha = (t.life / 10) * 0.5;
      const size = (t.life / 10) * 3;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#4af';
      ctx.beginPath();
      ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
