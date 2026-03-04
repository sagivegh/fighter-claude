const POWERUP_TYPES = {
  POWER:  { label: 'P', color: '#ff0',  desc: 'Power Up'     },
  SHIELD: { label: 'S', color: '#4af',  desc: 'Shield'       },
  BOMB:   { label: 'B', color: '#f84',  desc: 'Bomb'         },
  SPREAD: { label: 'W', color: '#0f0',  desc: 'Spread Shot'  },
  LASER:  { label: 'L', color: '#f4f',  desc: 'Laser'        },
  LIFE:   { label: '♥', color: '#f44',  desc: 'Extra Life'   },
};

class Powerup {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.info = POWERUP_TYPES[type];
    this.vy = CONFIG.POWERUP_SPEED;
    this.vx = 0;
    this.active = true;
    this.size = 16;
    this.bobOffset = randFloat(0, Math.PI * 2);
    this.age = 0;
    this.lifetime = 420; // 7 seconds at 60fps
  }

  get hitbox() {
    return {
      x: this.x - this.size,
      y: this.y - this.size,
      w: this.size * 2,
      h: this.size * 2,
    };
  }

  update() {
    this.y += this.vy;
    this.x += this.vx;
    this.age++;

    // Bob side to side gently
    this.vx = Math.sin(this.age * 0.05) * 0.5;

    if (this.y > CONFIG.HEIGHT + 30) this.active = false;
    if (this.age > this.lifetime) this.active = false;
  }

  draw(ctx) {
    const bob = Math.sin(this.age * 0.1 + this.bobOffset) * 3;
    const x = this.x, y = this.y + bob;
    const s = this.size;
    const color = this.info.color;

    // Fading when about to expire
    const alphaFade = this.age > this.lifetime - 90
      ? Math.abs(Math.sin(this.age * 0.2))
      : 1;

    ctx.save();
    ctx.globalAlpha = alphaFade;

    // Outer glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;

    // Rotating diamond shape
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.age * 0.04);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // Label
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.font = `bold ${s}px Courier New`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.info.label, x, y);

    ctx.restore();
  }
}

class PowerupManager {
  constructor() {
    this.powerups = [];
  }

  spawn(x, y, type = null) {
    if (!type) {
      const types = Object.keys(POWERUP_TYPES);
      // Weighted: power is more common
      const weights = [4, 2, 2, 3, 2, 1];
      const total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) { idx = i; break; }
      }
      type = types[idx];
    }
    this.powerups.push(new Powerup(x, y, type));
  }

  update() {
    this.powerups = this.powerups.filter(p => { p.update(); return p.active; });
  }

  draw(ctx) {
    for (const p of this.powerups) p.draw(ctx);
  }

  clear() {
    this.powerups = [];
  }
}
