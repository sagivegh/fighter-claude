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

    // Rotate 180° so nose faces up (toward top of screen)
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI);
    ctx.translate(-x, -y);

    switch (this.type) {

      case 'f5': {
        // F-5 Tiger II — small nimble fighter, swept wings, twin tail fins
        // Fuselage
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(x,      y - h/2);    // sharp nose
        ctx.lineTo(x + 3,  y - h/4);
        ctx.lineTo(x + 4,  y + h/4);
        ctx.lineTo(x + 2,  y + h/2);
        ctx.lineTo(x - 2,  y + h/2);
        ctx.lineTo(x - 4,  y + h/4);
        ctx.lineTo(x - 3,  y - h/4);
        ctx.closePath();
        ctx.fill();
        // Swept wings (wider than before)
        ctx.fillStyle = '#c09040';
        ctx.beginPath();
        ctx.moveTo(x - 3,  y - h/8);
        ctx.lineTo(x - w/2 - 1, y + 4);
        ctx.lineTo(x - w/2 + 2, y + h/3 + 1);
        ctx.lineTo(x - 4,  y + h/4);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 3,  y - h/8);
        ctx.lineTo(x + w/2 + 1, y + 4);
        ctx.lineTo(x + w/2 - 2, y + h/3 + 1);
        ctx.lineTo(x + 4,  y + h/4);
        ctx.closePath();
        ctx.fill();
        // Twin small tail fins
        ctx.fillStyle = '#a07828';
        ctx.beginPath();
        ctx.moveTo(x - 2, y + h/3);
        ctx.lineTo(x - 7, y + h/2 - 2);
        ctx.lineTo(x - 5, y + h/2);
        ctx.lineTo(x - 2, y + h/2 - 1);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 2, y + h/3);
        ctx.lineTo(x + 7, y + h/2 - 2);
        ctx.lineTo(x + 5, y + h/2);
        ctx.lineTo(x + 2, y + h/2 - 1);
        ctx.closePath();
        ctx.fill();
        // Panel lines
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x, y - h/2); ctx.lineTo(x - 3, y - h/4);
        ctx.moveTo(x, y - h/2); ctx.lineTo(x + 3, y - h/4);
        ctx.moveTo(x - 3, y - h/4); ctx.lineTo(x - w/2 - 1, y + 4);
        ctx.moveTo(x + 3, y - h/4); ctx.lineTo(x + w/2 + 1, y + 4);
        ctx.stroke();
        // Canopy
        ctx.fillStyle = '#1a2a44';
        ctx.beginPath();
        ctx.ellipse(x, y - h/5, 2.5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'yak130': {
        // Yak-130 — trainer jet, swept wings, side-by-side engines
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(x,      y - h/2);
        ctx.lineTo(x + 5,  y - h/4);
        ctx.lineTo(x + 6,  y + h/4);
        ctx.lineTo(x + 3,  y + h/2);
        ctx.lineTo(x - 3,  y + h/2);
        ctx.lineTo(x - 6,  y + h/4);
        ctx.lineTo(x - 5,  y - h/4);
        ctx.closePath();
        ctx.fill();
        // Moderately swept wings
        ctx.fillStyle = '#b87a38';
        ctx.beginPath();
        ctx.moveTo(x - 5,  y - h/6);
        ctx.lineTo(x - w/2, y + 2);
        ctx.lineTo(x - w/2 + 3, y + h/3);
        ctx.lineTo(x - 6,  y + h/5);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 5,  y - h/6);
        ctx.lineTo(x + w/2, y + 2);
        ctx.lineTo(x + w/2 - 3, y + h/3);
        ctx.lineTo(x + 6,  y + h/5);
        ctx.closePath();
        ctx.fill();
        // Underslung engine pods
        ctx.fillStyle = '#704a20';
        ctx.beginPath();
        ctx.ellipse(x - 8, y + h/8, 4, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + 8, y + h/8, 4, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        // Engine nozzles
        ctx.fillStyle = '#333';
        ctx.fillRect(x - 10, y + h/4, 4, 4);
        ctx.fillRect(x + 6,  y + h/4, 4, 4);
        // Panel lines
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x, y - h/2); ctx.lineTo(x + 5, y - h/4);
        ctx.moveTo(x, y - h/2); ctx.lineTo(x - 5, y - h/4);
        ctx.moveTo(x + 5, y - h/4); ctx.lineTo(x + w/2, y + 2);
        ctx.moveTo(x - 5, y - h/4); ctx.lineTo(x - w/2, y + 2);
        ctx.stroke();
        // Tandem canopy
        ctx.fillStyle = '#1a2a44';
        ctx.fillRect(x - 3, y - h/2 + 3, 6, 9);
        break;
      }

      case 'f4': {
        // F-4 Phantom II — bent outer wing panels, drooped tailplanes
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(x,      y - h/2);    // nose
        ctx.lineTo(x + 5,  y - h/4);
        ctx.lineTo(x + 6,  y + h/5);
        ctx.lineTo(x + 5,  y + h/2);
        ctx.lineTo(x - 5,  y + h/2);
        ctx.lineTo(x - 6,  y + h/5);
        ctx.lineTo(x - 5,  y - h/4);
        ctx.closePath();
        ctx.fill();
        // Bent wings — inner swept section
        ctx.fillStyle = '#a86832';
        ctx.beginPath();
        ctx.moveTo(x - 5,  y - h/6);
        ctx.lineTo(x - w/3, y + 2);      // wing bend point
        ctx.lineTo(x - w/3, y + h/4);
        ctx.lineTo(x - 6,  y + h/5);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 5,  y - h/6);
        ctx.lineTo(x + w/3, y + 2);
        ctx.lineTo(x + w/3, y + h/4);
        ctx.lineTo(x + 6,  y + h/5);
        ctx.closePath();
        ctx.fill();
        // Outer wing panels (angled up/drooped slightly — shows as wider)
        ctx.fillStyle = '#985a28';
        ctx.beginPath();
        ctx.moveTo(x - w/3, y + 2);
        ctx.lineTo(x - w/2 - 1, y + 6);
        ctx.lineTo(x - w/2 + 2, y + h/3);
        ctx.lineTo(x - w/3, y + h/4);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + w/3, y + 2);
        ctx.lineTo(x + w/2 + 1, y + 6);
        ctx.lineTo(x + w/2 - 2, y + h/3);
        ctx.lineTo(x + w/3, y + h/4);
        ctx.closePath();
        ctx.fill();
        // All-moving drooped stabilisers (angled down — F-4 distinctive)
        ctx.fillStyle = '#804a20';
        ctx.beginPath();
        ctx.moveTo(x - 5,  y + h/2 - 3);
        ctx.lineTo(x - w/3, y + h/2 + 5);
        ctx.lineTo(x - w/3 + 4, y + h/2 + 9);
        ctx.lineTo(x - 4,  y + h/2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 5,  y + h/2 - 3);
        ctx.lineTo(x + w/3, y + h/2 + 5);
        ctx.lineTo(x + w/3 - 4, y + h/2 + 9);
        ctx.lineTo(x + 4,  y + h/2);
        ctx.closePath();
        ctx.fill();
        // Panel lines
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x, y - h/2); ctx.lineTo(x + 5, y - h/4);
        ctx.moveTo(x, y - h/2); ctx.lineTo(x - 5, y - h/4);
        ctx.moveTo(x - w/3, y + 2); ctx.lineTo(x - w/2 - 1, y + 6); // wing bend
        ctx.moveTo(x + w/3, y + 2); ctx.lineTo(x + w/2 + 1, y + 6);
        ctx.stroke();
        // Two-seat canopy
        ctx.fillStyle = '#1a2a44';
        ctx.fillRect(x - 3, y - h/2 + 2, 6, 10);
        break;
      }

      case 'su25': {
        // Su-25 Frogfoot — straight wings, twin engines under wings, armoured
        // Rounded fuselage
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(x,      y - h/2);
        ctx.lineTo(x + 4,  y - h/3);
        ctx.lineTo(x + 5,  y + h/3);
        ctx.lineTo(x + 3,  y + h/2);
        ctx.lineTo(x - 3,  y + h/2);
        ctx.lineTo(x - 5,  y + h/3);
        ctx.lineTo(x - 4,  y - h/3);
        ctx.closePath();
        ctx.fill();
        // Straight wings (minimal sweep)
        ctx.fillStyle = '#906030';
        ctx.beginPath();
        ctx.moveTo(x - 5,  y - h/8);
        ctx.lineTo(x - w/2, y - h/10);
        ctx.lineTo(x - w/2, y + h/4);
        ctx.lineTo(x - 5,  y + h/5);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 5,  y - h/8);
        ctx.lineTo(x + w/2, y - h/10);
        ctx.lineTo(x + w/2, y + h/4);
        ctx.lineTo(x + 5,  y + h/5);
        ctx.closePath();
        ctx.fill();
        // Engine nacelles (large, under-wing mounted)
        ctx.fillStyle = '#603a1a';
        ctx.beginPath();
        ctx.ellipse(x - 12, y + h/10, 5, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + 12, y + h/10, 5, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        // Weapon hardpoints (missiles under wings)
        ctx.fillStyle = '#2a2a2a';
        for (const dx of [-18, -11, 11, 18]) {
          ctx.fillRect(x + dx - 1, y + 2, 2, 7);
        }
        // Panel lines
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x, y - h/2); ctx.lineTo(x - 4, y - h/3);
        ctx.moveTo(x, y - h/2); ctx.lineTo(x + 4, y - h/3);
        ctx.moveTo(x - 4, y - h/3); ctx.lineTo(x - w/2, y - h/10);
        ctx.moveTo(x + 4, y - h/3); ctx.lineTo(x + w/2, y - h/10);
        ctx.stroke();
        // Canopy
        ctx.fillStyle = '#1a2a44';
        ctx.beginPath();
        ctx.ellipse(x, y - h/4, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'su24': {
        // Su-24 Fencer — variable-sweep side-by-side cockpit bomber
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(x,      y - h/2);
        ctx.lineTo(x + 5,  y - h/3);
        ctx.lineTo(x + 7,  y + h/4);
        ctx.lineTo(x + 4,  y + h/2);
        ctx.lineTo(x - 4,  y + h/2);
        ctx.lineTo(x - 7,  y + h/4);
        ctx.lineTo(x - 5,  y - h/3);
        ctx.closePath();
        ctx.fill();
        // Variable-sweep wings (swept back for high speed)
        ctx.fillStyle = '#784832';
        ctx.beginPath();
        ctx.moveTo(x - 5,  y - h/4);
        ctx.lineTo(x - w/2, y + h/6);
        ctx.lineTo(x - w/2 + 5, y + h/2 - 4);
        ctx.lineTo(x - 7,  y + h/3);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 5,  y - h/4);
        ctx.lineTo(x + w/2, y + h/6);
        ctx.lineTo(x + w/2 - 5, y + h/2 - 4);
        ctx.lineTo(x + 7,  y + h/3);
        ctx.closePath();
        ctx.fill();
        // Wing-pivot fairings
        ctx.fillStyle = '#603820';
        ctx.fillRect(x - 8, y - h/4, 5, 6);
        ctx.fillRect(x + 3, y - h/4, 5, 6);
        // Panel lines
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x, y - h/2); ctx.lineTo(x + 5, y - h/3);
        ctx.moveTo(x, y - h/2); ctx.lineTo(x - 5, y - h/3);
        ctx.moveTo(x - 7, y + h/4); ctx.lineTo(x - w/2, y + h/6);
        ctx.moveTo(x + 7, y + h/4); ctx.lineTo(x + w/2, y + h/6);
        ctx.stroke();
        // Side-by-side tandem canopy (wide)
        ctx.fillStyle = '#1a2a44';
        ctx.fillRect(x - 4, y - h/2 + 2, 8, 9);
        // Twin exhausts
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(x - 5, y + h/2 - 5, 4, 6);
        ctx.fillRect(x + 1, y + h/2 - 5, 4, 6);
        break;
      }

      case 'mig29': {
        // MiG-29 Fulcrum — twin engine blended body, LERX, twin fins
        ctx.fillStyle = c;
        // Wide blended fuselage
        ctx.beginPath();
        ctx.moveTo(x,      y - h/2);
        ctx.lineTo(x + 5,  y - h/4);
        ctx.lineTo(x + 8,  y + h/8);
        ctx.lineTo(x + 6,  y + h/2);
        ctx.lineTo(x - 6,  y + h/2);
        ctx.lineTo(x - 8,  y + h/8);
        ctx.lineTo(x - 5,  y - h/4);
        ctx.closePath();
        ctx.fill();
        // Delta wings with strong LERX (root extension visible)
        ctx.fillStyle = '#683820';
        ctx.beginPath();
        ctx.moveTo(x - 5,  y - h/4);
        ctx.lineTo(x - w/2, y + h/10);
        ctx.lineTo(x - w/2 + 4, y + h/2 - 4);
        ctx.lineTo(x - 8,  y + h/8);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 5,  y - h/4);
        ctx.lineTo(x + w/2, y + h/10);
        ctx.lineTo(x + w/2 - 4, y + h/2 - 4);
        ctx.lineTo(x + 8,  y + h/8);
        ctx.closePath();
        ctx.fill();
        // Twin vertical tail fins (slightly canted out)
        ctx.fillStyle = '#582a10';
        ctx.beginPath();
        ctx.moveTo(x - 4,  y + h/6);
        ctx.lineTo(x - 10, y + h/3);
        ctx.lineTo(x - 8,  y + h/2);
        ctx.lineTo(x - 4,  y + h/2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 4,  y + h/6);
        ctx.lineTo(x + 10, y + h/3);
        ctx.lineTo(x + 8,  y + h/2);
        ctx.lineTo(x + 4,  y + h/2);
        ctx.closePath();
        ctx.fill();
        // Twin engine nozzles
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath();
        ctx.ellipse(x - 4, y + h/2, 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + 4, y + h/2, 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Panel lines
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x, y - h/2); ctx.lineTo(x + 5, y - h/4);
        ctx.moveTo(x, y - h/2); ctx.lineTo(x - 5, y - h/4);
        ctx.moveTo(x - 5, y - h/4); ctx.lineTo(x - w/2, y + h/10);
        ctx.moveTo(x + 5, y - h/4); ctx.lineTo(x + w/2, y + h/10);
        ctx.stroke();
        // Canopy
        ctx.fillStyle = '#1a2a44';
        ctx.beginPath();
        ctx.ellipse(x, y - h/4, 3.5, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    ctx.restore(); // end rotation

    // Aircraft label
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

    if (this.type === 'f14') {
      // ── F-14 Tomcat — large variable-sweep wing interceptor ──────────────
      // Fuselage (twin-boom body)
      ctx.fillStyle = '#705030';
      ctx.beginPath();
      ctx.moveTo(x,      y - h/2);     // nose
      ctx.lineTo(x + 8,  y - h/3);
      ctx.lineTo(x + 10, y + h/5);
      ctx.lineTo(x + 8,  y + h/2);
      ctx.lineTo(x - 8,  y + h/2);
      ctx.lineTo(x - 10, y + h/5);
      ctx.lineTo(x - 8,  y - h/3);
      ctx.closePath();
      ctx.fill();

      // Variable-sweep main wings (partially swept back)
      ctx.fillStyle = '#553820';
      ctx.beginPath();
      ctx.moveTo(x - 8,  y - h/5);
      ctx.lineTo(x - w/2, y + h/8);
      ctx.lineTo(x - w/2 + 8, y + h/2 - 8);
      ctx.lineTo(x - 10, y + h/4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 8,  y - h/5);
      ctx.lineTo(x + w/2, y + h/8);
      ctx.lineTo(x + w/2 - 8, y + h/2 - 8);
      ctx.lineTo(x + 10, y + h/4);
      ctx.closePath();
      ctx.fill();

      // Wing-pivot fairings (rounded boxes between wings)
      ctx.fillStyle = '#604028';
      ctx.fillRect(x - 10, y - h/5, 6, 8);
      ctx.fillRect(x + 4,  y - h/5, 6, 8);

      // Twin vertical tail fins
      ctx.fillStyle = '#402810';
      ctx.beginPath();
      ctx.moveTo(x - 6,  y + h/5);
      ctx.lineTo(x - 16, y + h/3);
      ctx.lineTo(x - 13, y + h/2);
      ctx.lineTo(x - 5,  y + h/2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 6,  y + h/5);
      ctx.lineTo(x + 16, y + h/3);
      ctx.lineTo(x + 13, y + h/2);
      ctx.lineTo(x + 5,  y + h/2);
      ctx.closePath();
      ctx.fill();

      // Horizontal tailplanes (between fins)
      ctx.fillStyle = '#4a3018';
      ctx.beginPath();
      ctx.moveTo(x - 8,  y + h/3);
      ctx.lineTo(x - w/3, y + h/2 + 4);
      ctx.lineTo(x - w/3 + 6, y + h/2 + 6);
      ctx.lineTo(x - 6,  y + h/2 - 2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 8,  y + h/3);
      ctx.lineTo(x + w/3, y + h/2 + 4);
      ctx.lineTo(x + w/3 - 6, y + h/2 + 6);
      ctx.lineTo(x + 6,  y + h/2 - 2);
      ctx.closePath();
      ctx.fill();

      // Twin engine exhausts
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.ellipse(x - 5, y + h/2 + 2, 5, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + 5, y + h/2 + 2, 5, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Canopy (two-seat tandem, long)
      ctx.fillStyle = '#1a2a44';
      ctx.beginPath();
      ctx.ellipse(x, y - h/3, 4, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Missile rails under wings (AIM-54 Phoenix)
      ctx.fillStyle = '#aaa';
      for (const dx of [-w/2 + 12, -w/2 + 24, w/2 - 24, w/2 - 12]) {
        ctx.fillRect(x + dx - 1, y + h/10, 3, 10);
      }

      // Panel lines
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y - h/2); ctx.lineTo(x + 8, y - h/3);
      ctx.moveTo(x, y - h/2); ctx.lineTo(x - 8, y - h/3);
      ctx.moveTo(x - 8, y - h/5); ctx.lineTo(x - w/2, y + h/8);
      ctx.moveTo(x + 8, y - h/5); ctx.lineTo(x + w/2, y + h/8);
      ctx.moveTo(x - 10, y + h/5); ctx.lineTo(x - 10, y + h/2);
      ctx.moveTo(x + 10, y + h/5); ctx.lineTo(x + 10, y + h/2);
      ctx.stroke();

      // Afterburner glow (twin)
      const f14f1 = ctx.createRadialGradient(x - 5, y + h/2 + 10, 0, x - 5, y + h/2 + 10, 16 * pulse);
      f14f1.addColorStop(0, 'rgba(255,220,100,0.9)');
      f14f1.addColorStop(0.4, 'rgba(255,100,0,0.6)');
      f14f1.addColorStop(1, 'transparent');
      ctx.fillStyle = f14f1;
      ctx.beginPath(); ctx.arc(x - 5, y + h/2 + 10, 16 * pulse, 0, Math.PI * 2); ctx.fill();
      const f14f2 = ctx.createRadialGradient(x + 5, y + h/2 + 10, 0, x + 5, y + h/2 + 10, 16 * pulse);
      f14f2.addColorStop(0, 'rgba(255,220,100,0.9)');
      f14f2.addColorStop(0.4, 'rgba(255,100,0,0.6)');
      f14f2.addColorStop(1, 'transparent');
      ctx.fillStyle = f14f2;
      ctx.beginPath(); ctx.arc(x + 5, y + h/2 + 10, 16 * pulse, 0, Math.PI * 2); ctx.fill();

      // AWG-9 Radar glow at nose
      const grd = ctx.createRadialGradient(x, y - h/2, 0, x, y - h/2, 24);
      grd.addColorStop(0, `rgba(255,180,0,${pulse * 0.7})`);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y - h/2, 24, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.type === 'su35') {
      // ── Su-35 Flanker-E — super-manoeuvrable twin-engine fighter ─────────
      // Wide blended fuselage (Flanker's signature broad body)
      ctx.fillStyle = '#603028';
      ctx.beginPath();
      ctx.moveTo(x,      y - h/2);
      ctx.lineTo(x + 10, y - h/3);
      ctx.lineTo(x + 14, y + h/6);
      ctx.lineTo(x + 9,  y + h/2);
      ctx.lineTo(x - 9,  y + h/2);
      ctx.lineTo(x - 14, y + h/6);
      ctx.lineTo(x - 10, y - h/3);
      ctx.closePath();
      ctx.fill();

      // Large swept delta wings
      ctx.fillStyle = '#482010';
      ctx.beginPath();
      ctx.moveTo(x - 10, y - h/3);
      ctx.lineTo(x - w/2, y + h/8);
      ctx.lineTo(x - w/2 + 10, y + h/2 - 4);
      ctx.lineTo(x - 14, y + h/6);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 10, y - h/3);
      ctx.lineTo(x + w/2, y + h/8);
      ctx.lineTo(x + w/2 - 10, y + h/2 - 4);
      ctx.lineTo(x + 14, y + h/6);
      ctx.closePath();
      ctx.fill();

      // Canards (distinctive Flanker forward fins)
      ctx.fillStyle = '#7a3e20';
      ctx.beginPath();
      ctx.moveTo(x - 10, y - h/3);
      ctx.lineTo(x - 24, y - h/5);
      ctx.lineTo(x - 22, y - h/8);
      ctx.lineTo(x - 12, y - h/5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 10, y - h/3);
      ctx.lineTo(x + 24, y - h/5);
      ctx.lineTo(x + 22, y - h/8);
      ctx.lineTo(x + 12, y - h/5);
      ctx.closePath();
      ctx.fill();

      // Twin large vertical tail fins
      ctx.fillStyle = '#301408';
      ctx.beginPath();
      ctx.moveTo(x - 7,  y + h/6);
      ctx.lineTo(x - 18, y + h/3);
      ctx.lineTo(x - 15, y + h/2);
      ctx.lineTo(x - 6,  y + h/2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 7,  y + h/6);
      ctx.lineTo(x + 18, y + h/3);
      ctx.lineTo(x + 15, y + h/2);
      ctx.lineTo(x + 6,  y + h/2);
      ctx.closePath();
      ctx.fill();

      // Twin engine nozzles (large AL-41 engines)
      ctx.fillStyle = '#1a0a04';
      ctx.beginPath();
      ctx.ellipse(x - 6, y + h/2 + 4, 6, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + 6, y + h/2 + 4, 6, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Canopy (single seat but large bubble)
      ctx.fillStyle = '#1a2a44';
      ctx.beginPath();
      ctx.ellipse(x, y - h/3, 4, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Panel lines
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y - h/2); ctx.lineTo(x + 10, y - h/3);
      ctx.moveTo(x, y - h/2); ctx.lineTo(x - 10, y - h/3);
      ctx.moveTo(x - 10, y - h/3); ctx.lineTo(x - w/2, y + h/8);
      ctx.moveTo(x + 10, y - h/3); ctx.lineTo(x + w/2, y + h/8);
      ctx.moveTo(x - 14, y + h/6); ctx.lineTo(x - 14, y + h/2);
      ctx.moveTo(x + 14, y + h/6); ctx.lineTo(x + 14, y + h/2);
      ctx.stroke();

      // Afterburner glow (twin, large)
      const flame1 = ctx.createRadialGradient(x - 6, y + h/2 + 12, 0, x - 6, y + h/2 + 12, 18 * pulse);
      flame1.addColorStop(0, 'rgba(255,255,200,0.95)');
      flame1.addColorStop(0.3, 'rgba(255,130,0,0.7)');
      flame1.addColorStop(1, 'transparent');
      ctx.fillStyle = flame1;
      ctx.beginPath(); ctx.arc(x - 6, y + h/2 + 12, 18 * pulse, 0, Math.PI * 2); ctx.fill();
      const flame2 = ctx.createRadialGradient(x + 6, y + h/2 + 12, 0, x + 6, y + h/2 + 12, 18 * pulse);
      flame2.addColorStop(0, 'rgba(255,255,200,0.95)');
      flame2.addColorStop(0.3, 'rgba(255,130,0,0.7)');
      flame2.addColorStop(1, 'transparent');
      ctx.fillStyle = flame2;
      ctx.beginPath(); ctx.arc(x + 6, y + h/2 + 12, 18 * pulse, 0, Math.PI * 2); ctx.fill();

      // IRBIS-E radar glow (phased array)
      const coreGrd = ctx.createRadialGradient(x, y - h/2, 0, x, y - h/2, 28);
      coreGrd.addColorStop(0, `rgba(255,80,0,${pulse * 0.65})`);
      coreGrd.addColorStop(1, 'transparent');
      ctx.fillStyle = coreGrd;
      ctx.beginPath();
      ctx.arc(x, y - h/2, 28, 0, Math.PI * 2);
      ctx.fill();
    }

    // Boss label
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
    roundRect(ctx, bx, by, barW * pct, barH, 3);
    ctx.fill();

    // Label
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
