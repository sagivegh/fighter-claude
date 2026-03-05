// ─── Tehran Cityscape Background ─────────────────────────────────────────────
// Top-down bird's-eye view of an urban environment scrolling south → north.

class Background {
  constructor() {
    this.scrollY = 0;

    // ── Layout constants ──────────────────────────────────────────────────────
    this.ROW_H          = 110;  // height of one city block row (buildings + h-road)
    this.H_ROAD_W       = 10;   // minor horizontal road width
    this.MAJOR_H_ROAD_W = 20;   // major horizontal boulevard width
    this.MAJOR_H_EVERY  = 4;    // every Nth row is a major road

    // ── Fixed vertical road layout (x positions, widths) ─────────────────────
    // Inspired by Tehran's major N–S arteries:
    // Chamran Expressway, Modares Expressway, Vali-e-Asr Ave
    this.vRoads = [
      { x: 0,   w: 0,  major: false },   // left canvas edge (no road drawn)
      { x: 48,  w: 18, major: true  },   // Chamran-like expressway
      { x: 118, w: 9,  major: false },   // secondary street
      { x: 172, w: 9,  major: false },
      { x: 224, w: 22, major: true  },   // Modares-like expressway
      { x: 312, w: 9,  major: false },
      { x: 362, w: 9,  major: false },
      { x: 412, w: 20, major: true  },   // Vali-e-Asr-like avenue
      { x: 480, w: 0,  major: false },   // right canvas edge
    ];

    // ── Traffic ───────────────────────────────────────────────────────────────
    this.cars = [];
    this._initCars();

    // ── Tehran smog / haze blobs ──────────────────────────────────────────────
    this.smog = [];
    for (let i = 0; i < 6; i++) this.smog.push(this._makeSmog(true));
  }

  // ── Deterministic hash [0,1) from two integers ───────────────────────────
  _hash(a, b) {
    const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123;
    return Math.abs(v - Math.floor(v));
  }

  // ── Traffic helpers ───────────────────────────────────────────────────────
  _carColor() {
    const palette = ['#e8e8e4', '#ffffff', '#cc4433', '#ffcc33',
                     '#4488cc', '#888888', '#ddddcc', '#88aacc'];
    return palette[randInt(0, palette.length - 1)];
  }

  _initCars() {
    // Seed the vertical-road cars that persist for the whole game
    for (const road of this.vRoads) {
      if (road.w < 8) continue;
      const count = road.major ? 6 : 3;
      for (let i = 0; i < count; i++) {
        const goDown = Math.random() < 0.5;
        this.cars.push({
          type: 'v',
          x: road.x + (goDown ? road.w * 0.28 : road.w * 0.72),
          worldY: this.scrollY + randFloat(0, CONFIG.HEIGHT),
          vy: (goDown ? 1 : -1) * randFloat(1.4, 3.2),
          goDown,
          color: this._carColor(),
          len: randInt(6, 11),
          w: 4,
        });
      }
    }
  }

  _spawnHCar() {
    // Spawn a car on a horizontal road entering from the top of the screen
    const topRow = Math.floor(-this.scrollY / this.ROW_H);
    const row    = topRow - randInt(0, 2);
    const isMaj  = row % this.MAJOR_H_EVERY === 0;
    const rW     = isMaj ? this.MAJOR_H_ROAD_W : this.H_ROAD_W;
    const goRight = Math.random() < 0.5;

    this.cars.push({
      type: 'h',
      x: goRight ? -14 : CONFIG.WIDTH + 14,
      worldY: row * this.ROW_H + rW * 0.5,
      vy: 0,
      vx: (goRight ? 1 : -1) * randFloat(2.0, 4.0),
      goRight,
      color: this._carColor(),
      len: randInt(6, 10),
      w: 4,
      alive: true,
    });
  }

  _makeSmog(random) {
    return {
      x: randFloat(0, CONFIG.WIDTH),
      y: random ? randFloat(0, CONFIG.HEIGHT) : -120,
      r: randFloat(55, 130),
      speed: randFloat(0.25, 0.6),
      alpha: randFloat(0.04, 0.10),
      brown: Math.random() < 0.4,
    };
  }

  // ── Update ────────────────────────────────────────────────────────────────
  update() {
    this.scrollY -= 1.0;

    // V-road cars
    for (const c of this.cars) {
      if (c.type === 'v') {
        c.worldY += c.vy; // own speed (terrain scroll is now automatic via scrollY)
        const sy = c.worldY - this.scrollY;
        if (sy > CONFIG.HEIGHT + 20) c.worldY = this.scrollY - 20;
        if (sy < -20)                c.worldY = this.scrollY + CONFIG.HEIGHT + 20;
      } else {
        // H-road cars stay on their world-Y row; terrain scroll is automatic
        c.x += c.vx;
        const sy  = c.worldY - this.scrollY;
        if (c.x > CONFIG.WIDTH + 20 || c.x < -20 || sy > CONFIG.HEIGHT + 20) {
          c.alive = false;
        }
      }
    }
    this.cars = this.cars.filter(c => c.alive !== false);

    // Occasionally spawn a horizontal car
    if (Math.random() < 0.04) this._spawnHCar();

    // Smog
    for (const s of this.smog) {
      s.y += s.speed + 1.0;
      if (s.y > CONFIG.HEIGHT + 150) {
        Object.assign(s, this._makeSmog(false));
        s.y = -120;
      }
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  draw(ctx) {
    // ── 1. Concrete base ─────────────────────────────────────────────────────
    ctx.fillStyle = '#585450';
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    // ── 2. City block rows (buildings + horizontal roads) ─────────────────────
    const firstRow = Math.floor(-this.scrollY / this.ROW_H) - 1;
    const lastRow  = Math.ceil((-this.scrollY + CONFIG.HEIGHT) / this.ROW_H) + 1;

    for (let row = firstRow; row <= lastRow; row++) {
      const sy      = row * this.ROW_H - this.scrollY;
      const isMajH  = row % this.MAJOR_H_EVERY === 0;
      const hRoadW  = isMajH ? this.MAJOR_H_ROAD_W : this.H_ROAD_W;
      const blockY  = sy + hRoadW;
      const blockH  = this.ROW_H - hRoadW;

      // Building blocks
      for (let col = 0; col < this.vRoads.length - 1; col++) {
        const road     = this.vRoads[col];
        const nextRoad = this.vRoads[col + 1];
        const bx = road.x + road.w;
        const bw = nextRoad.x - bx;
        if (bw < 3) continue;
        this._drawBlock(ctx, row, col, bx, blockY, bw, blockH);
      }

      // Horizontal road (drawn over buildings)
      ctx.fillStyle = isMajH ? '#28281e' : '#34332a';
      ctx.fillRect(0, sy, CONFIG.WIDTH, hRoadW);

      // Sidewalk / kerb line
      ctx.fillStyle = '#6a6258';
      ctx.fillRect(0, sy + hRoadW - 1, CONFIG.WIDTH, 1);

      if (isMajH) {
        // Yellow centre-line dashes (scroll with road)
        ctx.save();
        ctx.strokeStyle = '#ccaa00';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([14, 10]);
        ctx.lineDashOffset = this.scrollY % 24;
        ctx.beginPath();
        ctx.moveTo(0, sy + hRoadW / 2);
        ctx.lineTo(CONFIG.WIDTH, sy + hRoadW / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // ── 3. Vertical roads (expressways & streets) ─────────────────────────────
    for (const road of this.vRoads) {
      if (road.w <= 0) continue;

      ctx.fillStyle = road.major ? '#242420' : '#302e26';
      ctx.fillRect(road.x, 0, road.w, CONFIG.HEIGHT);

      // Kerb lines
      ctx.fillStyle = '#5a5850';
      ctx.fillRect(road.x - 1, 0, 1, CONFIG.HEIGHT);
      ctx.fillRect(road.x + road.w, 0, 1, CONFIG.HEIGHT);

      if (road.major) {
        ctx.save();
        ctx.strokeStyle = '#ccaa00';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([14, 10]);
        ctx.lineDashOffset = this.scrollY % 24;
        ctx.beginPath();
        ctx.moveTo(road.x + road.w / 2, 0);
        ctx.lineTo(road.x + road.w / 2, CONFIG.HEIGHT);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // ── 4. Traffic ────────────────────────────────────────────────────────────
    for (const c of this.cars) {
      const sy = c.worldY - this.scrollY;
      if (sy < -14 || sy > CONFIG.HEIGHT + 14) continue;

      ctx.fillStyle = c.color;
      if (c.type === 'v') {
        ctx.fillRect(c.x - c.w / 2, sy - c.len / 2, c.w, c.len);
        // Lights
        ctx.fillStyle = c.goDown ? '#ff3333' : '#ffffcc';
        const ly = c.goDown ? sy + c.len / 2 - 2 : sy - c.len / 2;
        ctx.fillRect(c.x - c.w / 2, ly, c.w, 2);
      } else {
        ctx.fillRect(c.x - c.len / 2, sy - c.w / 2, c.len, c.w);
        ctx.fillStyle = c.goRight ? '#ffffcc' : '#ff3333';
        const lx = c.goRight ? c.x + c.len / 2 - 2 : c.x - c.len / 2;
        ctx.fillRect(lx, sy - c.w / 2, 2, c.w);
      }
    }

    // ── 5. Tehran smog / air-pollution haze ───────────────────────────────────
    for (const s of this.smog) {
      ctx.save();
      ctx.globalAlpha = s.alpha;
      const col0 = s.brown ? 'rgba(175,135,85' : 'rgba(155,148,138';
      const grd  = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      grd.addColorStop(0, `${col0},0.85)`);
      grd.addColorStop(1, `${col0},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── 6. Vignette ───────────────────────────────────────────────────────────
    const vign = ctx.createRadialGradient(
      CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, CONFIG.HEIGHT * 0.22,
      CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, CONFIG.HEIGHT * 0.82
    );
    vign.addColorStop(0, 'transparent');
    vign.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = vign;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  }

  // ── Draw one building block (between two vertical roads, below an h-road) ──
  _drawBlock(ctx, row, col, bx, by, bw, bh) {
    if (bw < 3 || bh < 3) return;

    const p1 = this._hash(row, col);
    const p2 = this._hash(row + 500, col + 250);
    const p3 = this._hash(row * 3,   col * 7);

    // ── Green space / park ─────────────────────────────────────────────────
    if (p1 < 0.08) {
      ctx.fillStyle = p2 < 0.5 ? '#3a5a26' : '#486830';
      ctx.fillRect(bx, by, bw, bh);
      // Trees (dark circles)
      const tCount = Math.floor(p3 * 5) + 3;
      ctx.fillStyle = '#28401a';
      for (let t = 0; t < tCount; t++) {
        const tx = bx + this._hash(row * 11 + t, col * 13    ) * bw;
        const ty = by + this._hash(row * 7  + t, col * 17 + t) * bh;
        const tr = this._hash(row * 5 + t, col * 9) * 3 + 2;
        ctx.beginPath();
        ctx.arc(tx, ty, tr, 0, Math.PI * 2);
        ctx.fill();
      }
      // Paths (light tan lines)
      if (bw > 30 && bh > 30) {
        ctx.strokeStyle = '#8a7a5a';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(bx + bw * 0.5, by);
        ctx.lineTo(bx + bw * 0.5, by + bh);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      return;
    }

    // ── Building block ─────────────────────────────────────────────────────
    // Tehran rooftop palette: flat roofs in beige/tan/grey — very uniform
    const palette = [
      '#c8b89a', '#bca88a', '#d2c2a8', '#c2b29c',
      '#b6a68e', '#aaa084', '#ccbca6', '#b4a48e',
    ];
    const shadows = ['#8a7a62', '#7e6e58', '#968272', '#8e7e6a'];

    const baseColor = palette[Math.floor(p1 * palette.length)];
    const shadColor = shadows[Math.floor(p2 * shadows.length)];

    // Block fill
    ctx.fillStyle = baseColor;
    ctx.fillRect(bx, by, bw, bh);

    // Sub-divide into individual buildings with narrow alley gaps
    const numB  = Math.floor(p3 * 3) + 2;          // 2–4 buildings per block
    const bldW  = (bw - 2) / numB;

    for (let b = 0; b < numB; b++) {
      const bx2     = bx + 1 + b * bldW;
      const bColor  = palette[Math.floor(
        this._hash(row * 5 + b, col * 8 + b) * palette.length
      )];

      ctx.fillStyle = bColor;
      ctx.fillRect(bx2 + 1, by + 1, bldW - 2, bh - 3);

      // Shadow on east & south face (simulated depth)
      ctx.fillStyle = shadColor;
      ctx.fillRect(bx2 + bldW - 3, by + 1, 2, bh - 3); // east
      ctx.fillRect(bx2 + 1, by + bh - 4, bldW - 2, 3); // south

      // Rooftop water tank / HVAC box
      if (this._hash(row * 17 + b, col * 13 + 7) > 0.38) {
        ctx.fillStyle = '#9c8c78';
        const dtx = bx2 + 2 + this._hash(row + b, col * 3) * Math.max(1, bldW - 8);
        ctx.fillRect(dtx, by + 3, Math.max(3, bldW * 0.35), 3);
      }
    }

    // Central courtyard (for larger blocks only — common in Tehran apartments)
    if (p1 > 0.70 && bw > 48 && bh > 44) {
      const cw = bw * 0.28, ch = bh * 0.3;
      ctx.fillStyle = '#3c5222';
      ctx.fillRect(bx + (bw - cw) / 2, by + (bh - ch) / 2, cw, ch);
    }
  }
}
