// ─── Ground AA Unit Definitions ───────────────────────────────────────────────

const GROUND_DEFS = {
  zsu23: {
    w: 24, h: 24, hp: 3, score: 150,
    bodyColor: '#4a6a2a', turretColor: '#3a5a1e',
    label: 'ZSU-23', fireMode: 'burst',
    shootRate: 50, range: 270, scrollSpeed: 1.0,
  },
  sa13: {
    w: 30, h: 26, hp: 6, score: 320,
    bodyColor: '#3e5e22', turretColor: '#2e4818',
    label: 'SA-13', fireMode: 'sam',
    shootRate: 130, range: 370, scrollSpeed: 0.9,
    samSpeed: 3.2, samTurn: 0.06,
  },
  sa11: {
    w: 38, h: 34, hp: 14, score: 600,
    bodyColor: '#324e18', turretColor: '#243810',
    label: 'SA-11 BUK', fireMode: 'sam',
    shootRate: 170, range: 500, scrollSpeed: 0.85,
    samSpeed: 4.5, samTurn: 0.09,
  },
  s300: {
    w: 46, h: 42, hp: 30, score: 1100,
    bodyColor: '#263c10', turretColor: '#1c2c08',
    label: 'S-300', fireMode: 'lrsam',
    shootRate: 250, range: 800, scrollSpeed: 0.8,
    samSpeed: 6.5, samTurn: 0.05,
  },
};

// ─── Homing SAM Missile ───────────────────────────────────────────────────────

class SAMissile {
  constructor(x, y, player, speed, turnRate, color) {
    this.x = x;
    this.y = y;
    this.player   = player;   // live reference — tracked every frame
    this.speed    = speed;
    this.turnRate = turnRate;
    this.color    = color || '#ff4';
    this.angle    = -Math.PI / 2;
    this.active   = true;
    this.age      = 0;
    this.trail    = [];
  }

  get hitbox() {
    return { x: this.x - 5, y: this.y - 5, w: 10, h: 10 };
  }

  update() {
    this.age++;

    if (this.player && this.player.alive) {
      const ta = angleTo(this.x, this.y, this.player.x, this.player.y);
      let da = ta - this.angle;
      while (da >  Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      this.angle += clamp(da, -this.turnRate, this.turnRate);
    }

    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    this.trail.push({ x: this.x, y: this.y, life: 20 });
    if (this.trail.length > 24) this.trail.shift();
    for (const t of this.trail) t.life--;

    if (this.x < -60 || this.x > CONFIG.WIDTH + 60 ||
        this.y < -60 || this.y > CONFIG.HEIGHT + 60) {
      this.active = false;
    }
  }

  draw(ctx) {
    // Smoke trail
    for (const t of this.trail) {
      if (t.life <= 0) continue;
      const a = t.life / 20;
      ctx.save();
      ctx.globalAlpha = a * 0.45;
      ctx.fillStyle = '#ccc';
      ctx.beginPath();
      ctx.arc(t.x, t.y, a * 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Missile body
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle + Math.PI / 2);
    // Body
    ctx.fillStyle = '#888';
    ctx.fillRect(-2, -8, 4, 14);
    // Pointed nose
    ctx.fillStyle = '#aaa';
    ctx.beginPath();
    ctx.moveTo(-2, -8);
    ctx.lineTo(0,  -14);
    ctx.lineTo(2,  -8);
    ctx.closePath();
    ctx.fill();
    // Fins
    ctx.fillStyle = '#666';
    ctx.fillRect(-4, 4, 2, 5);
    ctx.fillRect(2,  4, 2, 5);
    // Exhaust glow
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, 7, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ─── Ground Unit ─────────────────────────────────────────────────────────────

class GroundUnit {
  constructor(type, x, y) {
    const def = GROUND_DEFS[type];
    Object.assign(this, def);
    this.type        = type;
    this.x           = x;
    this.y           = y;
    this.maxHp       = def.hp;
    this.active      = true;
    this.shootTimer  = randInt(40, def.shootRate);
    this.turretAngle = -Math.PI / 2;
    this.flashTimer  = 0;
    this.age         = 0;
    this.radarAngle  = 0;
    this.burstLeft   = 0;
    this.burstTimer  = 0;
  }

  get hitbox() {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }

  update(bulletMgr, outMissiles, player) {
    this.age++;
    this.y += this.scrollSpeed;
    this.radarAngle += 0.05;
    if (this.flashTimer > 0) this.flashTimer--;

    const px = player.x, py = player.y;

    // Rotate turret toward player
    const ta = angleTo(this.x, this.y, px, py);
    let da = ta - this.turretAngle;
    while (da >  Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    this.turretAngle += clamp(da, -0.06, 0.06);

    const inRange = dist(this.x, this.y, px, py) <= this.range && player.alive;

    if (inRange) {
      if (this.fireMode === 'burst') {
        // ZSU-23: 4-shot burst
        if (this.burstLeft > 0) {
          this.burstTimer--;
          if (this.burstTimer <= 0) {
            const spd = 6.5;
            bulletMgr.addEnemyBullet(
              this.x + Math.cos(this.turretAngle) * 14,
              this.y + Math.sin(this.turretAngle) * 14,
              Math.cos(this.turretAngle) * spd,
              Math.sin(this.turretAngle) * spd,
              '#ffe066'
            );
            Audio.enemyShoot();
            this.burstLeft--;
            this.burstTimer = 7;
          }
        } else {
          this.shootTimer--;
          if (this.shootTimer <= 0) {
            this.shootTimer = this.shootRate;
            this.burstLeft  = 4;
            this.burstTimer = 1;
          }
        }
      } else {
        // SAM launch
        this.shootTimer--;
        if (this.shootTimer <= 0) {
          this.shootTimer = this.shootRate;
          const color = this.fireMode === 'lrsam' ? '#f4f' : '#ff4';
          outMissiles.push(new SAMissile(
            this.x, this.y - this.h / 2,
            player, this.samSpeed, this.samTurn, color
          ));
          Audio.enemyShoot();
        }
      }
    }

    if (this.y > CONFIG.HEIGHT + 70) this.active = false;
  }

  hit(dmg = 1) {
    this.hp -= dmg;
    this.flashTimer = 8;
    if (this.hp <= 0) { this.active = false; return true; }
    return false;
  }

  draw(ctx) {
    const x = this.x, y = this.y;
    const flash = this.flashTimer > 0 && Math.floor(this.flashTimer / 2) % 2 === 0;
    ctx.save();
    if (flash) { ctx.filter = 'brightness(3)'; ctx.globalAlpha = 0.6; }

    switch (this.type) {
      case 'zsu23': this._drawZSU(ctx, x, y);  break;
      case 'sa13':  this._drawSA13(ctx, x, y); break;
      case 'sa11':  this._drawSA11(ctx, x, y); break;
      case 's300':  this._drawS300(ctx, x, y); break;
    }
    ctx.restore();

    // Label
    ctx.fillStyle = 'rgba(120,255,80,0.75)';
    ctx.font = '8px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.label, x, y + this.h / 2 + 2);

    // HP bar (for units with more than 3 hp)
    if (this.maxHp > 3) {
      const bw = this.w;
      const pct = Math.max(0, this.hp / this.maxHp);
      ctx.fillStyle = '#111';
      ctx.fillRect(x - bw / 2, y + this.h / 2 + 12, bw, 3);
      ctx.fillStyle = pct > 0.5 ? '#0f0' : pct > 0.25 ? '#ff0' : '#f00';
      ctx.fillRect(x - bw / 2, y + this.h / 2 + 12, bw * pct, 3);
    }
  }

  _drawZSU(ctx, x, y) {
    const w = this.w, h = this.h;
    // Hull
    ctx.fillStyle = this.bodyColor;
    roundRect(ctx, x - w/2, y - h/2, w, h, 3);
    ctx.fill();
    // Track detail strips
    ctx.fillStyle = '#2a3a14';
    ctx.fillRect(x - w/2,     y - h/2, 4, h);
    ctx.fillRect(x + w/2 - 4, y - h/2, 4, h);
    // Turret ring
    ctx.fillStyle = this.turretColor;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    // 4 × 23 mm gun barrels fanning out toward target
    ctx.strokeStyle = '#151e0a';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = this.turretAngle + (i - 1.5) * 0.2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9);
      ctx.lineTo(x + Math.cos(a) * 19, y + Math.sin(a) * 19);
      ctx.stroke();
    }
    // Spinning radar dish
    ctx.save();
    ctx.translate(x + w/4, y - h/2 + 4);
    ctx.rotate(this.radarAngle);
    ctx.strokeStyle = '#7aaa4a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI);
    ctx.moveTo(-5, 0); ctx.lineTo(5, 0);
    ctx.stroke();
    ctx.restore();
  }

  _drawSA13(ctx, x, y) {
    const w = this.w, h = this.h;
    // Wheeled chassis
    ctx.fillStyle = this.bodyColor;
    roundRect(ctx, x - w/2, y - h/2, w, h, 4);
    ctx.fill();
    // Wheels
    ctx.fillStyle = '#181e0a';
    for (const dx of [-w/2 + 5, w/2 - 5]) {
      for (const dy of [-h/4, h/4]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Rotating dual launcher arm
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.turretAngle + Math.PI / 2);
    ctx.fillStyle = this.turretColor;
    ctx.fillRect(-3, -h/2 + 2, 6, h/2);
    // 2 box launch pods each side
    ctx.fillStyle = '#8aaa5a';
    ctx.fillRect(-11, -h/2 + 2, 7, 11);
    ctx.fillRect(  4, -h/2 + 2, 7, 11);
    // Missile ends
    ctx.fillStyle = '#ccc';
    ctx.fillRect(-10, -h/2 + 2, 5, 4);
    ctx.fillRect(  5, -h/2 + 2, 5, 4);
    ctx.restore();
  }

  _drawSA11(ctx, x, y) {
    const w = this.w, h = this.h;
    // Tracked hull
    ctx.fillStyle = this.bodyColor;
    roundRect(ctx, x - w/2, y - h/2, w, h, 4);
    ctx.fill();
    ctx.fillStyle = '#1a280a';
    ctx.fillRect(x - w/2,     y - h/2, 5, h);
    ctx.fillRect(x + w/2 - 5, y - h/2, 5, h);
    // Spinning cross-shaped radar
    ctx.save();
    ctx.translate(x - w/4, y - h/2 + 5);
    ctx.rotate(this.radarAngle * 1.4);
    ctx.strokeStyle = '#8abb5a';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7);
      ctx.stroke();
    }
    ctx.restore();
    // 4-missile launch arm (rotating)
    ctx.save();
    ctx.translate(x + 4, y);
    ctx.rotate(this.turretAngle + Math.PI / 2);
    ctx.fillStyle = this.turretColor;
    ctx.fillRect(-4, -h/2 + 2, 8, h/2 + 4);
    // 4 missile tubes
    ctx.fillStyle = '#bbb';
    for (const mx of [-7, -2, 3, 8]) {
      ctx.fillRect(mx, -h/2 + 2, 3, 11);
      ctx.fillStyle = '#eee';
      ctx.fillRect(mx, -h/2 + 2, 3, 3);
      ctx.fillStyle = '#bbb';
    }
    ctx.restore();
  }

  _drawS300(ctx, x, y) {
    const w = this.w, h = this.h;
    // Long truck body
    ctx.fillStyle = this.bodyColor;
    roundRect(ctx, x - w/2, y - h/2, w, h, 5);
    ctx.fill();
    // Axle lines
    ctx.strokeStyle = '#1a2c08';
    ctx.lineWidth = 2;
    for (const dy of [-h/3, 0, h/3]) {
      ctx.beginPath();
      ctx.moveTo(x - w/2 + 2, y + dy);
      ctx.lineTo(x + w/2 - 2, y + dy);
      ctx.stroke();
    }
    // 6 vertical VLS canisters (2 × 3 grid)
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const cx = x - 12 + c * 12;
        const cy = y - 10 + r * 18;
        ctx.fillStyle = '#4a6230';
        ctx.fillRect(cx - 4, cy - 7, 8, 13);
        // Missile top (ready glow)
        ctx.fillStyle = this.hp > this.maxHp * 0.5 ? '#ccddaa' : '#555';
        ctx.fillRect(cx - 3, cy - 7, 6, 4);
      }
    }
    // Phased-array radar panel on side
    ctx.fillStyle = '#1e3008';
    ctx.fillRect(x - w/2 - 9, y - 12, 9, 24);
    ctx.strokeStyle = '#4a6a28';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(x - w/2 - 9, y - 12 + i * 6);
      ctx.lineTo(x - w/2,     y - 12 + i * 6);
      ctx.stroke();
    }
    // Radar active pulse
    const pulse = Math.sin(this.age * 0.12) * 0.5 + 0.5;
    ctx.save();
    ctx.globalAlpha = pulse * 0.35;
    ctx.fillStyle = '#00ff44';
    ctx.fillRect(x - w/2 - 9, y - 12, 9, 24);
    ctx.restore();
  }
}

// ─── Ground Unit Manager ──────────────────────────────────────────────────────

class GroundUnitManager {
  constructor() {
    this.units    = [];
    this.missiles = [];
    this.spawnTimer = 100;
    this.level = 1;
  }

  setLevel(level) {
    this.level    = level;
    this.spawnTimer = 80;
  }

  update(bulletMgr, player, explosions) {
    this.spawnTimer--;
    if (this.spawnTimer <= 0) {
      this._spawnRandom();
      this.spawnTimer = Math.max(55, 190 - this.level * 14);
    }

    for (const u of this.units) {
      const newMissiles = [];
      u.update(bulletMgr, newMissiles, player);
      for (const m of newMissiles) this.missiles.push(m);
    }

    for (const m of this.missiles) m.update();

    this.units    = this.units.filter(u => u.active);
    this.missiles = this.missiles.filter(m => m.active);
  }

  _spawnRandom() {
    const roster = ['zsu23', 'zsu23', 'sa13', 'sa13', 'sa11', 's300'];
    const avail  = roster.slice(0, Math.min(2 + this.level, roster.length));
    const type   = avail[randInt(0, avail.length - 1)];
    this.units.push(new GroundUnit(type, randFloat(30, CONFIG.WIDTH - 30), -55));
  }

  draw(ctx) {
    for (const u of this.units)    u.draw(ctx);
    for (const m of this.missiles) m.draw(ctx);
  }

  clear() {
    this.units    = [];
    this.missiles = [];
    this.spawnTimer = 100;
  }
}
