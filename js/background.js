class Background {
  constructor() {
    this.scrollY = 0;
    this.dustClouds = [];
    this.duneLines = [];
    this.rockPatches = [];
    this.roads = [];
    this.initTerrain();
  }

  initTerrain() {
    // Dune ridge lines — long diagonal streaks of shadow/highlight
    for (let i = 0; i < 30; i++) {
      this.duneLines.push(this.makeDuneLine(true));
    }
    // Rocky patches
    for (let i = 0; i < 18; i++) {
      this.rockPatches.push(this.makeRock(true));
    }
    // Dust clouds (aerial haze)
    for (let i = 0; i < 8; i++) {
      this.dustClouds.push(this.makeDust(true));
    }
    // Road/trail
    this.roads.push({ x: randFloat(80, 160), scrollY: 0 });
    this.roads.push({ x: randFloat(300, 400), scrollY: CONFIG.HEIGHT * 0.5 });
  }

  makeDuneLine(random = false) {
    const layer = randInt(0, 2);
    const speeds = [0.4, 0.9, 1.8];
    return {
      x: randFloat(-40, CONFIG.WIDTH + 40),
      y: random ? randFloat(0, CONFIG.HEIGHT) : -60,
      w: randFloat(60, 220),
      angle: randFloat(-0.25, 0.25),
      layer,
      speed: speeds[layer],
      color: ['#b8936a', '#c9a57a', '#dbb882'][layer],
      shadowColor: ['#8a6040', '#a07848', '#b89060'][layer],
      alpha: randFloat(0.5, 1.0),
    };
  }

  makeRock(random = false) {
    return {
      x: randFloat(20, CONFIG.WIDTH - 20),
      y: random ? randFloat(0, CONFIG.HEIGHT) : -50,
      rx: randFloat(8, 28),
      ry: randFloat(5, 18),
      rot: randFloat(0, Math.PI),
      speed: randFloat(0.6, 1.4),
      color: `hsl(${randInt(25, 40)},${randInt(20, 35)}%,${randInt(28, 42)}%)`,
      alpha: randFloat(0.5, 0.9),
    };
  }

  makeDust(random = false) {
    return {
      x: randFloat(0, CONFIG.WIDTH),
      y: random ? randFloat(0, CONFIG.HEIGHT) : -120,
      r: randFloat(40, 120),
      speed: randFloat(0.3, 0.7),
      alpha: randFloat(0.04, 0.10),
    };
  }

  update() {
    // Scroll terrain elements downward
    for (const d of this.duneLines) {
      d.y += d.speed;
      if (d.y > CONFIG.HEIGHT + 80) {
        Object.assign(d, this.makeDuneLine(false));
        d.y = -60;
      }
    }
    for (const r of this.rockPatches) {
      r.y += r.speed;
      if (r.y > CONFIG.HEIGHT + 60) {
        Object.assign(r, this.makeRock(false));
        r.y = -50;
      }
    }
    for (const dc of this.dustClouds) {
      dc.y += dc.speed;
      if (dc.y > CONFIG.HEIGHT + 140) {
        Object.assign(dc, this.makeDust(false));
        dc.y = -120;
      }
    }
    for (const road of this.roads) {
      road.scrollY = (road.scrollY + 1.2) % CONFIG.HEIGHT;
    }
  }

  draw(ctx) {
    // Base desert sand
    const baseGrad = ctx.createLinearGradient(0, 0, 0, CONFIG.HEIGHT);
    baseGrad.addColorStop(0,   '#c8a46a');
    baseGrad.addColorStop(0.4, '#d4b07a');
    baseGrad.addColorStop(0.7, '#c09060');
    baseGrad.addColorStop(1,   '#b88050');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    // Sandy texture variation (subtle)
    this.drawSandTexture(ctx);

    // Rock patches (deepest layer)
    for (const r of this.rockPatches) {
      ctx.save();
      ctx.globalAlpha = r.alpha;
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.rx, r.ry, r.rot, 0, Math.PI * 2);
      ctx.fill();
      // Shadow
      ctx.globalAlpha = r.alpha * 0.4;
      ctx.fillStyle = '#3a2510';
      ctx.beginPath();
      ctx.ellipse(r.x + 3, r.y + 4, r.rx * 0.8, r.ry * 0.5, r.rot, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Dune ridge lines
    for (const d of this.duneLines) {
      ctx.save();
      ctx.globalAlpha = d.alpha * 0.6;
      ctx.translate(d.x + d.w / 2, d.y);
      ctx.rotate(d.angle);
      // Highlight
      ctx.fillStyle = d.color;
      ctx.fillRect(-d.w / 2, -2, d.w, 3);
      // Shadow below ridge
      ctx.globalAlpha = d.alpha * 0.35;
      ctx.fillStyle = d.shadowColor;
      ctx.fillRect(-d.w / 2, 1, d.w, 5);
      ctx.restore();
    }

    // Roads / desert trails
    for (const road of this.roads) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#a07840';
      ctx.lineWidth = 5;
      ctx.setLineDash([30, 20]);
      ctx.lineDashOffset = -road.scrollY;
      ctx.beginPath();
      ctx.moveTo(road.x, 0);
      ctx.lineTo(road.x, CONFIG.HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Dust/haze clouds
    for (const dc of this.dustClouds) {
      ctx.save();
      ctx.globalAlpha = dc.alpha;
      const grd = ctx.createRadialGradient(dc.x, dc.y, 0, dc.x, dc.y, dc.r);
      grd.addColorStop(0,   'rgba(220,185,130,0.8)');
      grd.addColorStop(0.6, 'rgba(200,165,110,0.3)');
      grd.addColorStop(1,   'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(dc.x, dc.y, dc.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Heat shimmer overlay at top (distant horizon haze)
    const hazeGrad = ctx.createLinearGradient(0, 0, 0, 80);
    hazeGrad.addColorStop(0,   'rgba(180,210,240,0.18)');
    hazeGrad.addColorStop(1,   'transparent');
    ctx.fillStyle = hazeGrad;
    ctx.fillRect(0, 0, CONFIG.WIDTH, 80);
  }

  drawSandTexture(ctx) {
    // Subtle noise-like variation using thin semi-transparent strips
    ctx.save();
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 6; i++) {
      const y = (i / 6) * CONFIG.HEIGHT;
      ctx.fillStyle = i % 2 === 0 ? '#fff' : '#000';
      ctx.fillRect(0, y, CONFIG.WIDTH, CONFIG.HEIGHT / 12);
    }
    ctx.restore();
  }
}
