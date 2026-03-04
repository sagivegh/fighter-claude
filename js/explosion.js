class Particle {
  constructor(x, y, color, vx, vy, size, life) {
    this.x = x; this.y = y;
    this.color = color;
    this.vx = vx; this.vy = vy;
    this.size = size;
    this.life = life;
    this.maxLife = life;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.08; // gravity
    this.vx *= 0.98;
    this.life--;
    return this.life > 0;
  }

  draw(ctx) {
    const alpha = this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class Explosion {
  constructor(x, y, type = 'small') {
    this.x = x;
    this.y = y;
    this.type = type;
    this.particles = [];
    this.ring = { r: 0, maxR: 0, life: 0 };
    this.frame = 0;
    this.duration = CONFIG.EXPLOSION_DURATION;
    this.done = false;
    this.spawn();
  }

  spawn() {
    const isBig = this.type === 'big' || this.type === 'boss';
    const count = isBig ? 40 : 18;
    const speed = isBig ? 4 : 2.5;
    const colors = isBig
      ? ['#ff4400', '#ff8800', '#ffcc00', '#ffffff', '#ff2200']
      : ['#ff6600', '#ffaa00', '#ffff00', '#ff4400'];

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + randFloat(-0.3, 0.3);
      const s = randFloat(0.5, speed);
      const c = colors[randInt(0, colors.length - 1)];
      const sz = randFloat(1.5, isBig ? 5 : 3);
      const life = randInt(15, isBig ? 35 : 25);
      this.particles.push(new Particle(
        this.x + randFloat(-5, 5),
        this.y + randFloat(-5, 5),
        c,
        Math.cos(angle) * s,
        Math.sin(angle) * s,
        sz,
        life
      ));
    }

    // Extra debris
    for (let i = 0; i < (isBig ? 15 : 6); i++) {
      const angle = randFloat(0, Math.PI * 2);
      const s = randFloat(1, isBig ? 6 : 3);
      this.particles.push(new Particle(
        this.x, this.y,
        '#888',
        Math.cos(angle) * s,
        Math.sin(angle) * s,
        randFloat(1, 2.5),
        randInt(20, 40)
      ));
    }

    this.ring.maxR = isBig ? 60 : 30;
    this.ring.r = 0;
    this.ring.life = isBig ? 20 : 12;
    this.duration = isBig ? 50 : CONFIG.EXPLOSION_DURATION;
  }

  update() {
    this.frame++;
    if (this.ring.life > 0) {
      this.ring.r += this.ring.maxR / (this.type === 'big' || this.type === 'boss' ? 20 : 12);
      this.ring.life--;
    }
    this.particles = this.particles.filter(p => p.update());
    if (this.frame >= this.duration && this.particles.length === 0) {
      this.done = true;
    }
  }

  draw(ctx) {
    // Shockwave ring
    if (this.ring.life > 0) {
      const alpha = this.ring.life / (this.type === 'big' || this.type === 'boss' ? 20 : 12);
      ctx.save();
      ctx.globalAlpha = alpha * 0.5;
      ctx.strokeStyle = '#ff8800';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.ring.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Flash
    if (this.frame < 5) {
      const alpha = (5 - this.frame) / 5 * 0.6;
      const r = this.type === 'big' || this.type === 'boss' ? 40 : 20;
      ctx.save();
      ctx.globalAlpha = alpha;
      const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.5, '#ffaa00');
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const p of this.particles) p.draw(ctx);
  }
}

class ExplosionManager {
  constructor() {
    this.explosions = [];
  }

  add(x, y, type = 'small') {
    this.explosions.push(new Explosion(x, y, type));
  }

  update() {
    this.explosions = this.explosions.filter(e => {
      e.update();
      return !e.done;
    });
  }

  draw(ctx) {
    for (const e of this.explosions) e.draw(ctx);
  }

  clear() {
    this.explosions = [];
  }
}
