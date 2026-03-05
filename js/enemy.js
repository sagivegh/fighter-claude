// ─── Enemy Types — Iranian Air Force ──────────────────────────────────────────

const ENEMY_DEFS = {
  f5: {
    w: 28, h: 26, hp: 1, speed: 2.0, score: 100,
    color: '#d4a84a', shootRate: 120, bulletCount: 1,
    isBoss: false, label: 'F-5',
  },
  yak130: {
    w: 34, h: 28, hp: 3, speed: 1.5, score: 220,
    color: '#c8883a', shootRate: 95, bulletCount: 2,
    isBoss: false, label: 'Yak-130',
  },
  f4: {
    w: 38, h: 30, hp: 5, speed: 1.3, score: 350,
    color: '#b87040', shootRate: 80, bulletCount: 2,
    isBoss: false, label: 'F-4',
  },
  su25: {
    w: 40, h: 32, hp: 7, speed: 0.9, score: 480,
    color: '#a06030', shootRate: 70, bulletCount: 3,
    isBoss: false, label: 'Su-25',
  },
  su24: {
    w: 42, h: 30, hp: 9, speed: 1.1, score: 600,
    color: '#8a5028', shootRate: 62, bulletCount: 3,
    isBoss: false, label: 'Su-24',
  },
  mig29: {
    w: 40, h: 34, hp: 12, speed: 2.0, score: 800,
    color: '#784020', shootRate: 50, bulletCount: 2,
    isBoss: false, label: 'MiG-29',
  },
  f14: {
    w: 88, h: 78, hp: 140, speed: 0.8, score: 2500,
    color: '#c86820', shootRate: 28, bulletCount: 5,
    isBoss: true, label: 'F-14 TOMCAT',
  },
  su35: {
    w: 100, h: 90, hp: 240, speed: 1.1, score: 4000,
    color: '#a04818', shootRate: 20, bulletCount: 7,
    isBoss: true, label: 'Su-35 FLANKER',
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
    ctx.shadowBlur = 5;

    switch (this.type) {

      case 'f5': {
        // F-5 Tiger II — small, swept wings, twin tail fins
        ctx.fillStyle = c;
        // Body
        ctx.beginPath();
        ctx.moveTo(x,      y - h/2);
        ctx.lineTo(x + 3,  y - h/4);
        ctx.lineTo(x + 4,  y + h/4);
        ctx.lineTo(x + 2,  y + h/2);
        ctx.lineTo(x - 2,  y + h/2);
        ctx.lineTo(x - 4,  y + h/4);
        ctx.lineTo(x - 3,  y - h/4);
        ctx.closePath();
        ctx.fill();
        // Swept wings
        ctx.fillStyle = '#b89040';
        ctx.beginPath();
        ctx.moveTo(x - 3,  y);
        ctx.lineTo(x - w/2, y + 6);
        ctx.lineTo(x - w/2 + 3, y + h/3);
        ctx.lineTo(x - 4,  y + h/4);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 3,  y);
        ctx.lineTo(x + w/2, y + 6);
        ctx.lineTo(x + w/2 - 3, y + h/3);
        ctx.lineTo(x + 4,  y + h/4);
        ctx.closePath();
        ctx.fill();
        // Cockpit
        ctx.fillStyle = '#224';
        ctx.beginPath();
        ctx.ellipse(x, y - h/5, 2.5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'yak130': {
        // Yak-130 — swept wings, twin engines under wings
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(x,      y - h/2);
        ctx.lineTo(x + 4,  y - h/4);
        ctx.lineTo(x + 5,  y + h/3);
        ctx.lineTo(x + 2,  y + h/2);
        ctx.lineTo(x - 2,  y + h/2);
        ctx.lineTo(x - 5,  y + h/3);
        ctx.lineTo(x - 4,  y - h/4);
        ctx.closePath();
        ctx.fill();
        // Wings (moderate sweep)
        ctx.fillStyle = '#a87030';
        ctx.beginPath();
        ctx.moveTo(x - 4,  y - h/5);
        ctx.lineTo(x - w/2, y + 4);
        ctx.lineTo(x - w/2+2, y + h/3);
        ctx.lineTo(x - 5,  y + h/4);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 4,  y - h/5);
        ctx.lineTo(x + w/2, y + 4);
        ctx.lineTo(x + w/2-2, y + h/3);
        ctx.lineTo(x + 5,  y + h/4);
        ctx.closePath();
        ctx.fill();
        // Twin engine pods
        ctx.fillStyle = '#604020';
        ctx.fillRect(x - w/2 + 2, y + 2, 5, 8);
        ctx.fillRect(x + w/2 - 7, y + 2, 5, 8);
        // Canopy (tandem)
        ctx.fillStyle = '#224';
        ctx.fillRect(x - 2, y - h/2 + 3, 4, 8);
        break;
      }

      case 'f4': {
        // F-4 Phantom II — large, bent wings, drooped stabilisers
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(x,      y - h/2);     // nose
        ctx.lineTo(x + 5,  y - h/4);
        ctx.lineTo(x + 6,  y + h/4);
        ctx.lineTo(x + 4,  y + h/2);
        ctx.lineTo(x - 4,  y + h/2);
        ctx.lineTo(x - 6,  y + h/4);
        ctx.lineTo(x - 5,  y - h/4);
        ctx.closePath();
        ctx.fill();
        // Angled wings (bent — F-4 characteristic)
        ctx.fillStyle = '#986030';
        // Left: inner flat, outer angled down → show as slightly wider
        ctx.beginPath();
        ctx.moveTo(x - 5,  y - h/6);
        ctx.lineTo(x - w/2, y + 2);
        ctx.lineTo(x - w/2 + 2, y + h/3);
        ctx.lineTo(x - 6,  y + h/5);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 5,  y - h/6);
        ctx.lineTo(x + w/2, y + 2);
        ctx.lineTo(x + w/2 - 2, y + h/3);
        ctx.lineTo(x + 6,  y + h/5);
        ctx.closePath();
        ctx.fill();
        // Drooped horizontal stabilisers (angled)
        ctx.fillStyle = '#784828';
        ctx.beginPath();
        ctx.moveTo(x - 4,  y + h/2 - 4);
        ctx.lineTo(x - w/3, y + h/2 + 4);
        ctx.lineTo(x - w/3 + 3, y + h/2 + 8);
        ctx.lineTo(x - 3,  y + h/2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 4,  y + h/2 - 4);
        ctx.lineTo(x + w/3, y + h/2 + 4);
        ctx.lineTo(x + w/3 - 3, y + h/2 + 8);
        ctx.lineTo(x + 3,  y + h/2);
        ctx.closePath();
        ctx.fill();
        // Canopy (two-seat)
        ctx.fillStyle = '#224';
        ctx.fillRect(x - 2, y - h/2 + 2, 4, 9);
        break;
      }

      case 'su25': {
        // Su-25 Frogfoot — straight wings, twin engines, stubby
        ctx.fillStyle = c;
        roundRect(ctx, x - 5, y - h/2, 10, h, 4);
        ctx.fill();
        // Straight wings
        ctx.fillStyle = '#885028';
        ctx.fillRect(x - w/2, y - h/10, w, h/3);
        // Engine nacelles under wings
        ctx.fillStyle = '#503018';
        ctx.beginPath();
        ctx.ellipse(x - w/2 + 8, y + h/8, 5, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + w/2 - 8, y + h/8, 5, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        // Hardpoints (weapons)
        ctx.fillStyle = '#333';
        for (const dx of [-16, -8, 8, 16]) {
          ctx.fillRect(x + dx - 1, y + 2, 2, 6);
        }
        // Canopy
        ctx.fillStyle = '#224';
        ctx.beginPath();
        ctx.ellipse(x, y - h/4, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'su24': {
        // Su-24 Fencer — variable sweep wing bomber (shown swept)
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(x,      y - h/2);
        ctx.lineTo(x + 5,  y - h/3);
        ctx.lineTo(x + 6,  y + h/3);
        ctx.lineTo(x + 3,  y + h/2);
        ctx.lineTo(x - 3,  y + h/2);
        ctx.lineTo(x - 6,  y + h/3);
        ctx.lineTo(x - 5,  y - h/3);
        ctx.closePath();
        ctx.fill();
        // Swept-back wings (variable geometry at max sweep)
        ctx.fillStyle = '#704020';
        ctx.beginPath();
        ctx.moveTo(x - 5,  y - h/4);
        ctx.lineTo(x - w/2, y + h/5);
        ctx.lineTo(x - w/2 + 4, y + h/2 - 4);
        ctx.lineTo(x - 6,  y + h/3);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 5,  y - h/4);
        ctx.lineTo(x + w/2, y + h/5);
        ctx.lineTo(x + w/2 - 4, y + h/2 - 4);
        ctx.lineTo(x + 6,  y + h/3);
        ctx.closePath();
        ctx.fill();
        // Tandem cockpit
        ctx.fillStyle = '#224';
        ctx.fillRect(x - 2, y - h/2 + 2, 4, 10);
        // Twin exhausts
        ctx.fillStyle = '#333';
        ctx.fillRect(x - 4, y + h/2 - 4, 3, 6);
        ctx.fillRect(x + 1, y + h/2 - 4, 3, 6);
        break;
      }

      case 'mig29': {
        // MiG-29 Fulcrum — twin engine, LERX, twin tails
        ctx.fillStyle = c;
        // Wide blended body
        ctx.beginPath();
        ctx.moveTo(x,      y - h/2);
        ctx.lineTo(x + 6,  y - h/4);
        ctx.lineTo(x + 8,  y + h/5);
        ctx.lineTo(x + 5,  y + h/2);
        ctx.lineTo(x - 5,  y + h/2);
        ctx.lineTo(x - 8,  y + h/5);
        ctx.lineTo(x - 6,  y - h/4);
        ctx.closePath();
        ctx.fill();
        // Delta wings with LERX
        ctx.fillStyle = '#603818';
        ctx.beginPath();
        ctx.moveTo(x - 6,  y - h/4);
        ctx.lineTo(x - w/2, y + h/8);
        ctx.lineTo(x - w/2 + 3, y + h/2 - 4);
        ctx.lineTo(x - 8,  y + h/5);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 6,  y - h/4);
        ctx.lineTo(x + w/2, y + h/8);
        ctx.lineTo(x + w/2 - 3, y + h/2 - 4);
        ctx.lineTo(x + 8,  y + h/5);
        ctx.closePath();
        ctx.fill();
        // Twin tail fins
        ctx.fillStyle = '#502810';
        ctx.beginPath();
        ctx.moveTo(x - 4,  y + h/4);
        ctx.lineTo(x - 9,  y + h/3);
        ctx.lineTo(x - 7,  y + h/2);
        ctx.lineTo(x - 3,  y + h/2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 4,  y + h/4);
        ctx.lineTo(x + 9,  y + h/3);
        ctx.lineTo(x + 7,  y + h/2);
        ctx.lineTo(x + 3,  y + h/2);
        ctx.closePath();
        ctx.fill();
        // Canopy
        ctx.fillStyle = '#224';
        ctx.beginPath();
        ctx.ellipse(x, y - h/4, 3, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    // Aircraft label
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,200,100,0.8)';
    ctx.font = '8px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.label || '', x, y + h / 2 + 3);
  }

  drawBoss(ctx, x, y) {
    const c = this.color;
    const w = this.w, h = this.h;
    const pulse = Math.sin(this.age * 0.08) * 0.3 + 0.7;

    ctx.shadowColor = c;
    ctx.shadowBlur = 22;

    if (this.type === 'f14') {
      // ── F-14 Tomcat — large variable-sweep wing interceptor ──────────────
      // Fuselage
      ctx.fillStyle = '#604020';
      ctx.beginPath();
      ctx.moveTo(x,      y - h/2);      // nose
      ctx.lineTo(x + 8,  y - h/4);
      ctx.lineTo(x + 10, y + h/4);
      ctx.lineTo(x + 7,  y + h/2);
      ctx.lineTo(x - 7,  y + h/2);
      ctx.lineTo(x - 10, y + h/4);
      ctx.lineTo(x - 8,  y - h/4);
      ctx.closePath();
      ctx.fill();

      // Variable-sweep wings (partially swept)
      ctx.fillStyle = '#4a3018';
      ctx.beginPath();
      ctx.moveTo(x - 8,  y - h/6);
      ctx.lineTo(x - w/2, y + h/6);
      ctx.lineTo(x - w/2 + 6, y + h/2 - 8);
      ctx.lineTo(x - 10, y + h/3);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 8,  y - h/6);
      ctx.lineTo(x + w/2, y + h/6);
      ctx.lineTo(x + w/2 - 6, y + h/2 - 8);
      ctx.lineTo(x + 10, y + h/3);
      ctx.closePath();
      ctx.fill();

      // Twin tail fins (F-14 characteristic)
      ctx.fillStyle = '#382010';
      ctx.beginPath();
      ctx.moveTo(x - 6,  y + h/4);
      ctx.lineTo(x - 14, y + h/3);
      ctx.lineTo(x - 12, y + h/2);
      ctx.lineTo(x - 5,  y + h/2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 6,  y + h/4);
      ctx.lineTo(x + 14, y + h/3);
      ctx.lineTo(x + 12, y + h/2);
      ctx.lineTo(x + 5,  y + h/2);
      ctx.closePath();
      ctx.fill();

      // Twin exhausts
      ctx.fillStyle = '#222';
      ctx.fillRect(x - 7, y + h/2 - 4, 5, 8);
      ctx.fillRect(x + 2, y + h/2 - 4, 5, 8);

      // Canopy (two-seat tandem)
      ctx.fillStyle = '#224';
      ctx.fillRect(x - 3, y - h/2 + 4, 6, 14);

      // Missile rails under wings
      ctx.fillStyle = '#888';
      for (const dx of [-w/2+10, -w/2+20, w/2-20, w/2-10]) {
        ctx.fillRect(x + dx, y + h/8, 3, 8);
      }

      // Radar glow (pulse)
      const grd = ctx.createRadialGradient(x, y - h/2, 0, x, y - h/2, 20);
      grd.addColorStop(0, `rgba(255,180,0,${pulse * 0.6})`);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y - h/2, 20, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.type === 'su35') {
      // ── Su-35 Flanker-E — super-manoeuvrable twin-engine fighter ─────────
      // Wide blended fuselage
      ctx.fillStyle = '#502818';
      ctx.beginPath();
      ctx.moveTo(x,      y - h/2);
      ctx.lineTo(x + 10, y - h/3);
      ctx.lineTo(x + 12, y + h/5);
      ctx.lineTo(x + 8,  y + h/2);
      ctx.lineTo(x - 8,  y + h/2);
      ctx.lineTo(x - 12, y + h/5);
      ctx.lineTo(x - 10, y - h/3);
      ctx.closePath();
      ctx.fill();

      // Large delta wings
      ctx.fillStyle = '#3a1e0e';
      ctx.beginPath();
      ctx.moveTo(x - 10, y - h/3);
      ctx.lineTo(x - w/2, y + h/6);
      ctx.lineTo(x - w/2 + 8, y + h/2 - 6);
      ctx.lineTo(x - 12, y + h/4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 10, y - h/3);
      ctx.lineTo(x + w/2, y + h/6);
      ctx.lineTo(x + w/2 - 8, y + h/2 - 6);
      ctx.lineTo(x + 12, y + h/4);
      ctx.closePath();
      ctx.fill();

      // Canards (forward fins)
      ctx.fillStyle = '#6a3820';
      ctx.beginPath();
      ctx.moveTo(x - 9,  y - h/3);
      ctx.lineTo(x - 20, y - h/4);
      ctx.lineTo(x - 18, y - h/8);
      ctx.lineTo(x - 10, y - h/5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 9,  y - h/3);
      ctx.lineTo(x + 20, y - h/4);
      ctx.lineTo(x + 18, y - h/8);
      ctx.lineTo(x + 10, y - h/5);
      ctx.closePath();
      ctx.fill();

      // Twin tall tail fins
      ctx.fillStyle = '#2a1008';
      ctx.beginPath();
      ctx.moveTo(x - 7,  y + h/5);
      ctx.lineTo(x - 16, y + h/3);
      ctx.lineTo(x - 13, y + h/2);
      ctx.lineTo(x - 5,  y + h/2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 7,  y + h/5);
      ctx.lineTo(x + 16, y + h/3);
      ctx.lineTo(x + 13, y + h/2);
      ctx.lineTo(x + 5,  y + h/2);
      ctx.closePath();
      ctx.fill();

      // Twin engine nozzles
      ctx.fillStyle = '#1a0a04';
      ctx.beginPath();
      ctx.ellipse(x - 6, y + h/2, 5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + 6, y + h/2, 5, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Afterburner glow
      const flame1 = ctx.createRadialGradient(x - 6, y + h/2 + 8, 0, x - 6, y + h/2 + 8, 14 * pulse);
      flame1.addColorStop(0, 'rgba(255,255,200,0.9)');
      flame1.addColorStop(0.4, 'rgba(255,120,0,0.6)');
      flame1.addColorStop(1, 'transparent');
      ctx.fillStyle = flame1;
      ctx.beginPath();
      ctx.arc(x - 6, y + h/2 + 8, 14 * pulse, 0, Math.PI * 2);
      ctx.fill();
      const flame2 = ctx.createRadialGradient(x + 6, y + h/2 + 8, 0, x + 6, y + h/2 + 8, 14 * pulse);
      flame2.addColorStop(0, 'rgba(255,255,200,0.9)');
      flame2.addColorStop(0.4, 'rgba(255,120,0,0.6)');
      flame2.addColorStop(1, 'transparent');
      ctx.fillStyle = flame2;
      ctx.beginPath();
      ctx.arc(x + 6, y + h/2 + 8, 14 * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Core radar glow
      const coreGrd = ctx.createRadialGradient(x, y, 0, x, y, 35);
      coreGrd.addColorStop(0, `rgba(255,100,0,${pulse * 0.3})`);
      coreGrd.addColorStop(1, 'transparent');
      ctx.fillStyle = coreGrd;
      ctx.beginPath();
      ctx.arc(x, y, 35, 0, Math.PI * 2);
      ctx.fill();
    }

    // Boss label
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(255,180,0,${pulse})`;
    ctx.font = 'bold 10px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.label || '', x, y + h / 2 + 4);
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
    const waves = [];
    // Aircraft unlocked progressively by level
    const roster = ['f5', 'yak130', 'f4', 'su25', 'su24', 'mig29'];
    const available = roster.slice(0, Math.min(1 + Math.floor(level * 0.8), roster.length));

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
      const bossType = level >= 6 ? 'su35' : 'f14';
      waves.push({ delay: 300, isBoss: true, enemies: [{
        type: bossType, x: CONFIG.WIDTH / 2, y: -90, pattern: 'bossHover',
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
