// ─── Enemy Types ───────────────────────────────────────────────────────────────

const ENEMY_DEFS = {
  scout: {
    w: 28, h: 24, hp: 1, speed: 1.5, score: 100,
    color: '#f84', shootRate: 120, bulletCount: 1,
    isBoss: false,
  },
  fighter: {
    w: 32, h: 28, hp: 3, speed: 1.2, score: 250,
    color: '#f44', shootRate: 90, bulletCount: 2,
    isBoss: false,
  },
  bomber: {
    w: 40, h: 32, hp: 6, speed: 0.8, score: 400,
    color: '#f4f', shootRate: 75, bulletCount: 3,
    isBoss: false,
  },
  elite: {
    w: 36, h: 30, hp: 8, speed: 1.8, score: 600,
    color: '#f00', shootRate: 60, bulletCount: 2,
    isBoss: false,
  },
  boss1: {
    w: 80, h: 72, hp: 120, speed: 0.8, score: 2000,
    color: '#f84', shootRate: 30, bulletCount: 4,
    isBoss: true,
  },
  boss2: {
    w: 96, h: 88, hp: 200, speed: 1.0, score: 3500,
    color: '#f4f', shootRate: 22, bulletCount: 6,
    isBoss: true,
  },
};

// ─── Movement Patterns ─────────────────────────────────────────────────────────

function makePattern(type, startX) {
  switch (type) {
    case 'straight':
      return (e) => { e.y += e.speed; };
    case 'sine':
      return (e) => {
        e.y += e.speed;
        e.x = e.baseX + Math.sin(e.age * 0.04) * 60;
      };
    case 'dive':
      return (e) => {
        if (e.y < 200) { e.y += e.speed * 2; }
        else { e.y += e.speed; e.x += Math.sin(e.age * 0.03) * 1.5; }
      };
    case 'zigzag':
      return (e) => {
        e.y += e.speed;
        e.x += e.zigDir * e.speed * 1.2;
        if (e.x < 30 || e.x > CONFIG.WIDTH - 30) e.zigDir *= -1;
      };
    case 'bossHover':
      return (e) => {
        if (e.y < 120) { e.y += 1.5; }
        else {
          e.x += Math.sin(e.age * 0.02) * e.speed;
          e.x = clamp(e.x, e.w / 2, CONFIG.WIDTH - e.w / 2);
        }
      };
    default:
      return (e) => { e.y += e.speed; };
  }
}

// ─── Enemy Class ───────────────────────────────────────────────────────────────

class Enemy {
  constructor(type, x, y, pattern = 'straight') {
    const def = ENEMY_DEFS[type];
    Object.assign(this, def);
    this.type = type;
    this.x = x;
    this.y = y;
    this.baseX = x;
    this.maxHp = def.hp;
    this.shootTimer = randInt(30, def.shootRate);
    this.age = 0;
    this.active = true;
    this.zigDir = Math.random() < 0.5 ? 1 : -1;
    this.movePattern = makePattern(pattern, x);
    this.flashTimer = 0;
    // For boss phase tracking
    this.phase = 1;
  }

  get hitbox() {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }

  update(bulletMgr, playerX, playerY) {
    this.age++;
    this.movePattern(this);

    // Shoot
    this.shootTimer--;
    if (this.shootTimer <= 0) {
      this.shootTimer = this.shootRate + randInt(-10, 10);
      this.fire(bulletMgr, playerX, playerY);
    }

    // Boss phase changes
    if (this.isBoss) {
      const hpRatio = this.hp / this.maxHp;
      if (hpRatio < 0.5 && this.phase === 1) {
        this.phase = 2;
        this.shootRate = Math.floor(this.shootRate * 0.65);
        this.speed *= 1.3;
      }
    }

    if (this.flashTimer > 0) this.flashTimer--;

    // Deactivate if off screen (non-boss)
    if (!this.isBoss && this.y > CONFIG.HEIGHT + 60) this.active = false;
  }

  fire(bulletMgr, playerX, playerY) {
    const spd = CONFIG.ENEMY_BULLET_SPEED + (this.isBoss ? 1 : 0);
    const ang = angleTo(this.x, this.y, playerX, playerY);
    const color = this.isBoss ? '#ff4' : '#f44';

    if (this.bulletCount === 1) {
      bulletMgr.addEnemyBullet(this.x, this.y + this.h / 2, Math.cos(ang) * spd, Math.sin(ang) * spd, color);
    } else if (this.bulletCount === 2) {
      bulletMgr.addEnemyBullet(this.x - 6, this.y + this.h / 2, Math.cos(ang) * spd, Math.sin(ang) * spd, color);
      bulletMgr.addEnemyBullet(this.x + 6, this.y + this.h / 2, Math.cos(ang) * spd, Math.sin(ang) * spd, color);
    } else {
      // Fan pattern
      const spread = this.isBoss ? 0.35 : 0.25;
      const count = this.bulletCount;
      for (let i = 0; i < count; i++) {
        const offset = (i / (count - 1) - 0.5) * 2 * spread;
        bulletMgr.addEnemyBullet(this.x, this.y + this.h / 2,
          Math.cos(ang + offset) * spd, Math.sin(ang + offset) * spd, color);
      }
    }
    Audio.enemyShoot();
  }

  hit(damage = 1) {
    this.hp -= damage;
    this.flashTimer = 8;
    if (this.hp <= 0) {
      this.active = false;
      return true; // killed
    }
    return false;
  }

  draw(ctx) {
    const x = this.x, y = this.y;
    const flash = this.flashTimer > 0 && Math.floor(this.flashTimer / 2) % 2 === 0;

    ctx.save();
    if (flash) {
      ctx.globalAlpha = 0.5;
      ctx.filter = 'brightness(3)';
    }

    if (this.isBoss) {
      this.drawBoss(ctx, x, y);
    } else {
      this.drawEnemy(ctx, x, y);
    }

    ctx.restore();

    // HP bar for bosses
    if (this.isBoss) {
      this.drawBossHPBar(ctx);
    }
  }

  drawEnemy(ctx, x, y) {
    const c = this.color;
    const w = this.w, h = this.h;

    ctx.shadowColor = c;
    ctx.shadowBlur = 6;

    switch (this.type) {
      case 'scout': {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(x, y + h / 2);
        ctx.lineTo(x - w / 2, y - h / 2);
        ctx.lineTo(x, y - h / 4);
        ctx.lineTo(x + w / 2, y - h / 2);
        ctx.closePath();
        ctx.fill();
        // Cockpit
        ctx.fillStyle = '#ff8';
        ctx.beginPath();
        ctx.ellipse(x, y, 4, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'fighter': {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(x, y + h / 2);
        ctx.lineTo(x - w * 0.4, y);
        ctx.lineTo(x - w / 2, y - h / 2);
        ctx.lineTo(x + w / 2, y - h / 2);
        ctx.lineTo(x + w * 0.4, y);
        ctx.closePath();
        ctx.fill();
        // Details
        ctx.fillStyle = '#800';
        ctx.fillRect(x - 2, y - h / 2, 4, h * 0.6);
        // Wing cannons
        ctx.fillStyle = '#888';
        ctx.fillRect(x - w / 2 - 2, y - 2, 8, 4);
        ctx.fillRect(x + w / 2 - 6, y - 2, 8, 4);
        break;
      }
      case 'bomber': {
        ctx.fillStyle = c;
        roundRect(ctx, x - w / 2, y - h / 2, w, h, 6);
        ctx.fill();
        // Engine pods
        ctx.fillStyle = '#800';
        ctx.beginPath();
        ctx.ellipse(x - w / 2 + 5, y + h / 4, 6, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + w / 2 - 5, y + h / 4, 6, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        // Bomb bays
        ctx.fillStyle = '#600';
        for (let i = -1; i <= 1; i++) {
          ctx.fillRect(x + i * 10 - 2, y + 2, 4, 8);
        }
        break;
      }
      case 'elite': {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(x, y - h / 2);
        ctx.lineTo(x + w / 2, y);
        ctx.lineTo(x + w * 0.3, y + h / 2);
        ctx.lineTo(x - w * 0.3, y + h / 2);
        ctx.lineTo(x - w / 2, y);
        ctx.closePath();
        ctx.fill();
        // Glow core
        const grd = ctx.createRadialGradient(x, y, 0, x, y, w / 3);
        grd.addColorStop(0, '#ff8888');
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(x, y, w / 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }

  drawBoss(ctx, x, y) {
    const c = this.color;
    const w = this.w, h = this.h;
    const pulse = Math.sin(this.age * 0.08) * 0.3 + 0.7;

    ctx.shadowColor = c;
    ctx.shadowBlur = 20;

    if (this.type === 'boss1') {
      // Central body
      ctx.fillStyle = '#442200';
      roundRect(ctx, x - w / 2, y - h / 2, w, h, 10);
      ctx.fill();

      // Armor plates
      ctx.fillStyle = c;
      ctx.fillRect(x - w / 2 + 4, y - h / 2 + 4, w - 8, 14);
      ctx.fillRect(x - w / 2 + 4, y, w - 8, 14);

      // Wings
      ctx.fillStyle = '#663300';
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y - 10);
      ctx.lineTo(x - w, y + 20);
      ctx.lineTo(x - w * 0.6, y + h / 2);
      ctx.lineTo(x - w / 2, y + h / 2 - 10);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y - 10);
      ctx.lineTo(x + w, y + 20);
      ctx.lineTo(x + w * 0.6, y + h / 2);
      ctx.lineTo(x + w / 2, y + h / 2 - 10);
      ctx.closePath();
      ctx.fill();

      // Cannons
      ctx.fillStyle = '#888';
      for (let i = -2; i <= 2; i += 2) {
        ctx.fillRect(x + i * 14 - 3, y + h / 2 - 4, 6, 12);
      }

      // Eye
      ctx.fillStyle = `rgba(255,200,0,${pulse})`;
      ctx.beginPath();
      ctx.ellipse(x, y - 10, 12, 8, 0, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.type === 'boss2') {
      // Larger cruiser
      ctx.fillStyle = '#220033';
      roundRect(ctx, x - w / 2, y - h / 2, w, h, 12);
      ctx.fill();

      // Hull details
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + 4, y - h / 4);
      ctx.lineTo(x + w / 2 - 4, y - h / 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + 4, y + h / 4);
      ctx.lineTo(x + w / 2 - 4, y + h / 4);
      ctx.stroke();

      // Side wings
      ctx.fillStyle = '#440055';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + side * w / 2, y - h / 3);
        ctx.lineTo(x + side * (w / 2 + 40), y);
        ctx.lineTo(x + side * (w / 2 + 30), y + h / 3);
        ctx.lineTo(x + side * w / 2, y + h / 3);
        ctx.closePath();
        ctx.fill();
      }

      // Multiple turrets
      ctx.fillStyle = '#888';
      const turretPositions = [-30, -15, 0, 15, 30];
      for (const tx of turretPositions) {
        ctx.beginPath();
        ctx.arc(x + tx, y + h / 2 - 6, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x + tx - 2, y + h / 2 - 4, 4, 10);
      }

      // Core glow
      const grd = ctx.createRadialGradient(x, y, 0, x, y, 30);
      grd.addColorStop(0, `rgba(255,100,255,${pulse * 0.5})`);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBossHPBar(ctx) {
    const barW = CONFIG.WIDTH * 0.7;
    const barH = 14;
    const bx = (CONFIG.WIDTH - barW) / 2;
    const by = CONFIG.HEIGHT - 30;
    const pct = Math.max(0, this.hp / this.maxHp);

    ctx.save();
    // Background
    ctx.fillStyle = '#222';
    roundRect(ctx, bx - 2, by - 2, barW + 4, barH + 4, 4);
    ctx.fill();

    // Fill
    const barColor = pct > 0.5 ? '#0f0' : pct > 0.25 ? '#ff0' : '#f00';
    ctx.fillStyle = barColor;
    ctx.shadowColor = barColor;
    ctx.shadowBlur = 8;
    roundRect(ctx, bx, by, barW * pct, barH, 3);
    ctx.fill();

    // Label
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BOSS', bx - 28, by + barH / 2);
    ctx.restore();
  }
}

// ─── Wave / Spawn Manager ──────────────────────────────────────────────────────

class EnemyManager {
  constructor() {
    this.enemies = [];
    this.waveTimer = 0;
    this.waveIndex = 0;
    this.waves = [];
    this.bossActive = false;
    this.killCount = 0;
    this.level = 1;
  }

  setLevel(level) {
    this.level = level;
    this.waves = this.buildWaves(level);
    this.waveIndex = 0;
    this.waveTimer = 60;
    this.bossActive = false;
  }

  buildWaves(level) {
    // Each wave is { delay, enemies: [{type, x, y, pattern}] }
    const waves = [];
    const types = ['scout', 'scout', 'fighter', 'fighter', 'bomber', 'bomber', 'elite', 'elite'];
    const available = types.slice(0, Math.min(2 + Math.floor(level * 0.8), types.length));

    for (let w = 0; w < 6 + level * 2; w++) {
      const count = randInt(2, 3 + Math.floor(level / 2));
      const type = available[randInt(0, available.length - 1)];
      const pattern = ['straight', 'sine', 'dive', 'zigzag'][randInt(0, Math.min(3, level))];
      const entries = [];
      for (let i = 0; i < count; i++) {
        entries.push({
          type,
          x: randFloat(40, CONFIG.WIDTH - 40),
          y: -40 - i * 50,
          pattern,
        });
      }
      waves.push({ delay: 120 + w * 80, enemies: entries });
    }

    // Boss wave at level >= 3
    if (level >= 3) {
      const bossType = level >= 6 ? 'boss2' : 'boss1';
      waves.push({ delay: 300, isBoss: true, enemies: [{
        type: bossType, x: CONFIG.WIDTH / 2, y: -80, pattern: 'bossHover',
      }]});
    }

    return waves;
  }

  update(bulletMgr, playerX, playerY) {
    this.waveTimer--;

    if (this.waveTimer <= 0 && this.waveIndex < this.waves.length) {
      const wave = this.waves[this.waveIndex];
      if (!wave.isBoss || !this.bossActive) {
        for (const e of wave.enemies) {
          this.enemies.push(new Enemy(e.type, e.x, e.y, e.pattern));
          if (ENEMY_DEFS[e.type].isBoss) this.bossActive = true;
        }
        this.waveIndex++;
        this.waveTimer = wave.delay || 120;
      }
    }

    for (const enemy of this.enemies) {
      enemy.update(bulletMgr, playerX, playerY);
    }

    this.enemies = this.enemies.filter(e => e.active);
  }

  onKill(enemy) {
    if (!enemy.isBoss) this.killCount++;
  }

  draw(ctx) {
    for (const e of this.enemies) e.draw(ctx);
  }

  clear() {
    this.enemies = [];
    this.bossActive = false;
  }

  isBossDefeated() {
    return this.bossActive && !this.enemies.some(e => e.isBoss);
  }

  allWavesDone() {
    return this.waveIndex >= this.waves.length && this.enemies.length === 0;
  }
}
