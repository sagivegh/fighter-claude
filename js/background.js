class Background {
  constructor() {
    this.stars = [];
    this.clouds = [];
    this.initStars();
    this.initClouds();
  }

  initStars() {
    this.stars = [];
    // 3 layers of stars: far (dim/slow), mid, near (bright/fast)
    const counts = [60, 30, 15];
    const speeds = [0.3, 0.8, 1.8];
    const sizes  = [1, 1.5, 2.5];
    const alphas = [0.3, 0.6, 1.0];

    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < counts[layer]; i++) {
        this.stars.push({
          x: randFloat(0, CONFIG.WIDTH),
          y: randFloat(0, CONFIG.HEIGHT),
          speed: speeds[layer],
          size: sizes[layer],
          alpha: randFloat(alphas[layer] * 0.5, alphas[layer]),
          twinkle: randFloat(0, Math.PI * 2),
          twinkleSpeed: randFloat(0.02, 0.06),
        });
      }
    }
  }

  initClouds() {
    this.clouds = [];
    for (let i = 0; i < 5; i++) {
      this.clouds.push(this.makeCloud(true));
    }
  }

  makeCloud(randomY = false) {
    return {
      x: randFloat(0, CONFIG.WIDTH),
      y: randomY ? randFloat(0, CONFIG.HEIGHT) : -80,
      w: randFloat(60, 140),
      h: randFloat(20, 45),
      speed: randFloat(0.4, 1.0),
      alpha: randFloat(0.04, 0.12),
    };
  }

  update() {
    for (const s of this.stars) {
      s.y += s.speed;
      s.twinkle += s.twinkleSpeed;
      if (s.y > CONFIG.HEIGHT) {
        s.y = 0;
        s.x = randFloat(0, CONFIG.WIDTH);
      }
    }

    for (let i = this.clouds.length - 1; i >= 0; i--) {
      this.clouds[i].y += this.clouds[i].speed;
      if (this.clouds[i].y > CONFIG.HEIGHT + 100) {
        this.clouds.splice(i, 1);
        this.clouds.push(this.makeCloud(false));
      }
    }
  }

  draw(ctx) {
    // Deep space gradient
    const grad = ctx.createLinearGradient(0, 0, 0, CONFIG.HEIGHT);
    grad.addColorStop(0, '#050010');
    grad.addColorStop(0.5, '#020820');
    grad.addColorStop(1, '#000510');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    // Nebula effect
    this.drawNebula(ctx);

    // Clouds (atmospheric)
    for (const c of this.clouds) {
      ctx.save();
      ctx.globalAlpha = c.alpha;
      ctx.fillStyle = '#4488ff';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Stars
    for (const s of this.stars) {
      const twinkleAlpha = s.alpha * (0.7 + 0.3 * Math.sin(s.twinkle));
      ctx.save();
      ctx.globalAlpha = twinkleAlpha;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawNebula(ctx) {
    // Static nebula blobs (just decorative)
    ctx.save();
    ctx.globalAlpha = 0.03;
    const grd = ctx.createRadialGradient(160, 200, 0, 160, 200, 180);
    grd.addColorStop(0, '#6600ff');
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    const grd2 = ctx.createRadialGradient(320, 500, 0, 320, 500, 150);
    grd2.addColorStop(0, '#0044ff');
    grd2.addColorStop(1, 'transparent');
    ctx.fillStyle = grd2;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    ctx.restore();
  }
}
