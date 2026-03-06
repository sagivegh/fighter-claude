// ─── Air Defense Command Mini-Game ──────────────────────────────────────────
const AirDefense = (() => {
  let canvas, ctx, animId;
  let tick = 0; // seconds elapsed in game

  // ── Game state ──────────────────────────────────────────────────────────────
  let budget, score, wave, gameMode;
  let missiles, interceptors, blasts, messages;
  let selectedId, nextId;
  let cities;
  let gameOver, gameWon;
  let waveSpawnList, waveSpawnTimer, betweenWaves, betweenTimer;
  let lastTs;

  // ── Map layout ──────────────────────────────────────────────────────────────
  const MAP_H   = 500;   // map occupies top 500 px of 720
  const PANEL_Y = 500;
  const PANEL_H = 220;

  // Origin countries [x, y] in map pixels
  const ORIGINS = [
    { id:'lebanon', name:'LEBANON', x:155, y:130, color:'#f44', types:['cruise','rocket'] },
    { id:'syria',   name:'SYRIA',   x:225, y:118, color:'#f84', types:['ballistic','cruise'] },
    { id:'iraq',    name:'IRAQ',    x:305, y:158, color:'#fa4', types:['ballistic'] },
    { id:'iran',    name:'IRAN',    x:400, y:135, color:'#f22', types:['ballistic'] },
    { id:'yemen',   name:'YEMEN',   x:320, y:345, color:'#f64', types:['ballistic','drone'] },
    { id:'gaza',    name:'GAZA',    x:118, y:250, color:'#fa2', types:['rocket','drone'] },
  ];

  const CITY_DEFS = [
    { name:'HAIFA',       x:148, y:195, maxHp:3 },
    { name:'TEL AVIV',    x:142, y:233, maxHp:4 },
    { name:'JERUSALEM',   x:158, y:248, maxHp:4 },
    { name:"BE'ER SHEVA", x:146, y:272, maxHp:3 },
    { name:'EILAT',       x:150, y:342, maxHp:2 },
  ];

  // Defense systems
  const SYSTEMS = {
    arrow:  { name:'ARROW-3',       cost:200, color:'#4ff', hitChance:0.90, travelTime:2.0,
              canHit:['ballistic'],              desc:'Exo-atmos intercept' },
    dsling: { name:"DAVID'S SLING", cost:100, color:'#4af', hitChance:0.85, travelTime:1.5,
              canHit:['ballistic','cruise','drone'], desc:'Mid-range defense' },
    idome:  { name:'IRON DOME',     cost:20,  color:'#4f8', hitChance:0.90, travelTime:0.8,
              canHit:['rocket','cruise','drone'],   desc:'Short-range shield' },
  };

  // Missile type definitions
  const MISSILE_TYPES = {
    ballistic: {
      label:'BALLISTIC', color:'#f44',
      totalTime:80, arcHeight:-240, damage:2, score:300,
      phases:[{name:'boost',end:0.20},{name:'space',end:0.65},{name:'reentry',end:1.00}],
    },
    cruise: {
      label:'CRUISE', color:'#f84',
      totalTime:55, arcHeight:-55, damage:1, score:150,
      phases:[{name:'boost',end:0.12},{name:'midcourse',end:0.80},{name:'reentry',end:1.00}],
    },
    rocket: {
      label:'ROCKET', color:'#fa4',
      totalTime:18, arcHeight:-38, damage:1, score:50,
      phases:[{name:'boost',end:0.15},{name:'reentry',end:1.00}],
    },
    drone: {
      label:'DRONE', color:'#f64',
      totalTime:75, arcHeight:-18, damage:1, score:100,
      phases:[{name:'boost',end:0.08},{name:'midcourse',end:0.90},{name:'reentry',end:1.00}],
    },
  };

  // Campaign waves: array of spawn entries per wave
  const CAMPAIGN_WAVES = [
    [ // Wave 1 — simple rockets
      {origin:'gaza',    type:'rocket',    delay:0 },
      {origin:'gaza',    type:'rocket',    delay:6 },
      {origin:'lebanon', type:'cruise',    delay:12},
    ],
    [ // Wave 2
      {origin:'syria',   type:'ballistic', delay:0 },
      {origin:'gaza',    type:'rocket',    delay:4 },
      {origin:'gaza',    type:'rocket',    delay:9 },
      {origin:'lebanon', type:'cruise',    delay:7 },
    ],
    [ // Wave 3
      {origin:'iran',    type:'ballistic', delay:0 },
      {origin:'iraq',    type:'ballistic', delay:8 },
      {origin:'lebanon', type:'drone',     delay:5 },
      {origin:'gaza',    type:'rocket',    delay:3 },
      {origin:'gaza',    type:'rocket',    delay:11},
    ],
    [ // Wave 4
      {origin:'iran',    type:'ballistic', delay:0 },
      {origin:'iran',    type:'ballistic', delay:15},
      {origin:'iraq',    type:'ballistic', delay:5 },
      {origin:'syria',   type:'cruise',    delay:2 },
      {origin:'lebanon', type:'drone',     delay:8 },
      {origin:'gaza',    type:'rocket',    delay:0 },
      {origin:'gaza',    type:'rocket',    delay:6 },
      {origin:'yemen',   type:'ballistic', delay:20},
    ],
  ];

  // ── Public: init canvas ──────────────────────────────────────────────────────
  function init(canvasEl) {
    canvas = canvasEl;
    ctx    = canvas.getContext('2d');
    canvas.addEventListener('click',    onCanvasClick);
    canvas.addEventListener('touchend', onCanvasTouch, { passive: false });
  }

  function destroy() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    canvas.removeEventListener('click',    onCanvasClick);
    canvas.removeEventListener('touchend', onCanvasTouch);
  }

  // ── Start game ───────────────────────────────────────────────────────────────
  function startGame(mode) {
    gameMode      = mode;
    budget        = 2000;
    score         = 0;
    wave          = 1;
    tick          = 0;
    selectedId    = null;
    nextId        = 1;
    gameOver      = false;
    gameWon       = false;
    betweenWaves  = false;
    betweenTimer  = 0;
    missiles      = [];
    interceptors  = [];
    blasts        = [];
    messages      = [];
    cities        = CITY_DEFS.map(c => ({ ...c, hp: c.maxHp }));

    loadWave(wave);
    lastTs = performance.now();
    if (animId) cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
  }

  // ── Game loop ────────────────────────────────────────────────────────────────
  function loop(ts) {
    const dt = Math.min((ts - lastTs) / 1000, 0.1); // seconds, capped
    lastTs = ts;
    tick  += dt;

    if (!gameOver && !gameWon) update(dt);
    draw();
    animId = requestAnimationFrame(loop);
  }

  function update(dt) {
    // Between-wave delay
    if (betweenWaves) {
      betweenTimer -= dt;
      if (betweenTimer <= 0) {
        betweenWaves = false;
        loadWave(wave);
      }
      return;
    }

    updateWaveSpawns(dt);

    // Missiles
    for (const m of missiles) {
      if (!m.active) continue;
      m.elapsed  += dt;
      m.progress  = Math.min(m.elapsed / m.def.totalTime, 1);
      m.phase     = getPhase(m);
      if (m.progress >= 1) handleImpact(m);
    }

    // Interceptors
    for (const iv of interceptors) {
      if (!iv.active) continue;
      iv.elapsed += dt;
      iv.t        = Math.min(iv.elapsed / iv.sys.travelTime, 1);
      if (iv.t >= 1) attemptIntercept(iv);
    }

    // Blasts & messages
    blasts   = blasts.filter(b => { b.life -= dt; return b.life > 0; });
    messages = messages.filter(m => { m.life -= dt; return m.life > 0; });

    // Cleanup
    missiles     = missiles.filter(m => m.active);
    interceptors = interceptors.filter(iv => iv.active);

    checkWaveComplete();
    checkGameOver();
  }

  // ── Waves ────────────────────────────────────────────────────────────────────
  function loadWave(waveNum) {
    waveSpawnTimer = 0;
    let defs;
    if (gameMode === 'campaign' && waveNum <= CAMPAIGN_WAVES.length) {
      defs = CAMPAIGN_WAVES[waveNum - 1];
    } else {
      defs = generateSurvivalWave(waveNum);
    }
    waveSpawnList = defs.map(e => ({ ...e, spawned: false }));
    addMessage(`◆ WAVE ${waveNum} INCOMING — STAND BY`, '#f84');
  }

  function generateSurvivalWave(waveNum) {
    const count = Math.min(3 + waveNum, 12);
    const list  = [];
    for (let i = 0; i < count; i++) {
      const o    = ORIGINS[Math.floor(Math.random() * ORIGINS.length)];
      const type = o.types[Math.floor(Math.random() * o.types.length)];
      const gap  = Math.max(2, 8 - waveNum * 0.4);
      list.push({ origin: o.id, type, delay: i * gap });
    }
    return list;
  }

  function updateWaveSpawns(dt) {
    if (!waveSpawnList) return;
    waveSpawnTimer += dt;
    for (const e of waveSpawnList) {
      if (!e.spawned && waveSpawnTimer >= e.delay) {
        e.spawned = true;
        spawnMissile(e.origin, e.type);
      }
    }
  }

  function checkWaveComplete() {
    if (!waveSpawnList || betweenWaves) return;
    if (!waveSpawnList.every(e => e.spawned)) return;
    if (missiles.length > 0 || interceptors.length > 0) return;

    // Wave done
    if (gameMode === 'campaign' && wave >= CAMPAIGN_WAVES.length) {
      gameWon = true;
      addMessage('◆ ALL THREATS NEUTRALIZED — MISSION ACCOMPLISHED!', '#4f4');
      return;
    }

    score += wave * 500;
    addMessage(`◆ WAVE ${wave} CLEAR! BONUS +${wave * 500}`, '#4f4');
    wave++;
    waveSpawnList = null;
    betweenWaves  = true;
    betweenTimer  = 4;
  }

  function checkGameOver() {
    const dead = cities.filter(c => c.hp <= 0).length;
    if (dead >= cities.length) {
      gameOver = true;
      addMessage('◆ ALL CITIES DESTROYED — MISSION FAILED', '#f44');
    }
  }

  // ── Missiles ─────────────────────────────────────────────────────────────────
  function spawnMissile(originId, typeName) {
    const origin = ORIGINS.find(o => o.id === originId);
    const def    = MISSILE_TYPES[typeName];
    const alive  = cities.filter(c => c.hp > 0);
    const tgt    = alive[Math.floor(Math.random() * alive.length)] || cities[0];

    missiles.push({
      id: nextId++, active: true,
      type: typeName, def,
      origin: { x: origin.x, y: origin.y },
      target: { x: tgt.x, y: tgt.y },
      cityTarget: tgt,
      elapsed: 0, progress: 0, phase: def.phases[0].name,
      intercepted: false,
    });
    addMessage(`◆ THREAT DETECTED: ${def.label} FROM ${origin.name}`, def.color);
  }

  function getPhase(m) {
    for (const p of m.def.phases) {
      if (m.progress <= p.end) return p.name;
    }
    return m.def.phases[m.def.phases.length - 1].name;
  }

  function getMissilePos(m) {
    const { x: sx, y: sy } = m.origin;
    const { x: ex, y: ey } = m.target;
    const t   = m.progress;
    const mx  = (sx + ex) / 2;
    const my  = Math.min(sy, ey) + m.def.arcHeight;
    return {
      x: (1-t)*(1-t)*sx + 2*(1-t)*t*mx + t*t*ex,
      y: (1-t)*(1-t)*sy + 2*(1-t)*t*my + t*t*ey,
    };
  }

  function handleImpact(m) {
    m.active = false;
    if (m.intercepted) return;
    blasts.push({ x: m.target.x, y: m.target.y, life: 1.5, maxLife: 1.5, color: '#f84', r: 6 });
    const city = m.cityTarget;
    if (city && city.hp > 0) {
      city.hp = Math.max(0, city.hp - m.def.damage);
      addMessage(`◆ IMPACT ON ${city.name}! HP: ${city.hp}/${city.maxHp}`, '#f44');
    } else {
      addMessage('◆ IMPACT IN OPEN AREA — NO DAMAGE', '#888');
    }
  }

  // ── Interception ──────────────────────────────────────────────────────────────
  function launchInterceptor(missileId, sysKey) {
    const m   = missiles.find(x => x.id === missileId && x.active);
    const sys = SYSTEMS[sysKey];
    if (!m || !sys) return;

    if (!sys.canHit.includes(m.type)) {
      addMessage(`◆ ${sys.name} CANNOT ENGAGE ${m.def.label}`, '#f44'); return;
    }
    if (budget < sys.cost) {
      addMessage('◆ INSUFFICIENT BUDGET', '#f44'); return;
    }

    budget -= sys.cost;
    interceptors.push({
      active: true, missileId, sys, sysKey,
      startPos: { x: 148, y: 240 },
      elapsed: 0, t: 0,
    });
    addMessage(`◆ ${sys.name} LAUNCHED → M-${String(missileId).padStart(3,'0')}`, sys.color);
    selectedId = null;
  }

  function attemptIntercept(iv) {
    iv.active = false;
    const m = missiles.find(x => x.id === iv.missileId && x.active);
    if (!m) return;

    if (Math.random() < iv.sys.hitChance) {
      const pos = getMissilePos(m);
      m.active = m.intercepted = true; // mark as intercepted before setting inactive
      m.active = false;
      blasts.push({ x: pos.x, y: pos.y, life: 1.8, maxLife: 1.8, color: iv.sys.color, r: 10 });
      score += m.def.score;
      addMessage(`◆ INTERCEPT CONFIRMED — +${m.def.score} PTS`, '#4f4');
    } else {
      addMessage(`◆ ${iv.sys.name} MISSED! MISSILE CONTINUING`, '#f44');
    }
  }

  // ── Input ─────────────────────────────────────────────────────────────────────
  function getCanvasCoords(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) * (canvas.width  / r.width),
      y: (clientY - r.top)  * (canvas.height / r.height),
    };
  }

  function onCanvasClick(e) {
    handleInput(getCanvasCoords(e.clientX, e.clientY));
  }

  function onCanvasTouch(e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    handleInput(getCanvasCoords(t.clientX, t.clientY));
  }

  function handleInput(pt) {
    if (gameOver || gameWon) {
      if (typeof AirDefense._onExit === 'function') AirDefense._onExit();
      return;
    }

    // Click on a missile dot (map area)
    if (pt.y < PANEL_Y) {
      for (const m of missiles) {
        if (!m.active) continue;
        const pos  = getMissilePos(m);
        if (Math.hypot(pt.x - pos.x, pt.y - pos.y) < 20) {
          selectedId = m.id;
          addMessage(`◆ TRACKING M-${String(m.id).padStart(3,'0')} — ${m.def.label} ETA ${Math.ceil(m.def.totalTime - m.elapsed)}s`, m.def.color);
          return;
        }
      }
      selectedId = null;
      return;
    }

    // Click in panel — intercept buttons
    if (selectedId !== null) {
      const btnY  = PANEL_Y + 100;
      const btns  = [
        { key:'arrow',  x:4   },
        { key:'dsling', x:164 },
        { key:'idome',  x:324 },
      ];
      for (const b of btns) {
        if (pt.x >= b.x && pt.x <= b.x + 148 && pt.y >= btnY && pt.y <= btnY + 52) {
          launchInterceptor(selectedId, b.key);
          return;
        }
      }
    }

    // Click on threat list row
    const listY0 = PANEL_Y + 24;
    const shown  = missiles.filter(m => m.active).slice(0, 4);
    for (let i = 0; i < shown.length; i++) {
      const rowY = listY0 + i * 16;
      if (pt.y >= rowY - 10 && pt.y <= rowY + 6) {
        selectedId = shown[i].id;
        return;
      }
    }
  }

  // ── Messages ──────────────────────────────────────────────────────────────────
  function addMessage(text, color = '#0f8') {
    messages.unshift({ text, color, life: 6, maxLife: 6 });
    if (messages.length > 5) messages.length = 5;
  }

  // ── Draw ──────────────────────────────────────────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, 480, 720);
    drawBg();
    drawMapRegions();
    drawOrigins();
    drawCities();
    drawArcs();
    drawMissilesOnMap();
    drawInterceptorTrails();
    drawBlasts();
    drawHeader();
    drawPanel();
    if (betweenWaves) drawBetweenWaveBanner();
    if (gameOver || gameWon) drawEndScreen();
  }

  function drawBg() {
    // Map area dark
    const g = ctx.createLinearGradient(0, 0, 0, MAP_H);
    g.addColorStop(0, '#000510');
    g.addColorStop(1, '#001018');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 480, MAP_H);

    // Grid
    ctx.strokeStyle = 'rgba(0,200,100,0.05)';
    ctx.lineWidth   = 1;
    for (let x = 0; x <= 480; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MAP_H); ctx.stroke();
    }
    for (let y = 0; y <= MAP_H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(480, y); ctx.stroke();
    }

    // Radar sweep centred on Israel
    const cx = 148, cy = 240;
    const ang = (tick * 0.6) % (Math.PI * 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = 0.07;
    ctx.fillStyle   = '#00ff80';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 340, ang - 0.5, ang);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Panel bg
    ctx.fillStyle = '#060b0f';
    ctx.fillRect(0, PANEL_Y, 480, PANEL_H);
    ctx.strokeStyle = 'rgba(0,200,100,0.25)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(0, PANEL_Y); ctx.lineTo(480, PANEL_Y); ctx.stroke();
  }

  function poly(pts, fill, stroke, lw = 1) {
    ctx.fillStyle   = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth   = lw;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawMapRegions() {
    ctx.save();

    // Mediterranean Sea
    poly([[0,95],[148,138],[140,200],[128,258],[118,248],[104,200],[60,158],[0,148]],
      'rgba(0,25,70,0.55)', 'rgba(0,60,120,0.3)');

    // Egypt
    poly([[50,195],[140,198],[133,280],[128,342],[105,410],[50,410]],
      'rgba(80,65,15,0.28)', 'rgba(110,90,30,0.25)');

    // Lebanon
    poly([[148,138],[192,132],[204,168],[172,192],[148,190]],
      'rgba(60,35,10,0.32)', 'rgba(100,70,30,0.28)');

    // Syria
    poly([[192,100],[310,88],[328,162],[215,182],[204,168],[192,132]],
      'rgba(55,35,8,0.32)', 'rgba(90,65,25,0.28)');

    // Jordan
    poly([[172,215],[268,185],[295,295],[256,368],[175,332],[163,285],[172,260]],
      'rgba(70,50,15,0.30)', 'rgba(100,75,30,0.25)');

    // Iraq
    poly([[265,132],[430,88],[448,210],[390,295],[295,295],[268,185],[215,182],[310,88]],
      'rgba(60,42,8,0.30)', 'rgba(95,70,25,0.25)');

    // Iran
    poly([[390,72],[480,62],[480,260],[425,268],[385,205],[382,128]],
      'rgba(100,18,8,0.30)', 'rgba(140,35,20,0.28)');

    // Saudi Arabia / Gulf region
    poly([[175,332],[256,368],[330,410],[400,380],[440,310],[390,295],[295,295]],
      'rgba(75,58,18,0.25)', 'rgba(100,80,30,0.20)');

    // Yemen
    poly([[285,360],[440,342],[465,425],[305,445],[265,402]],
      'rgba(115,45,0,0.28)', 'rgba(150,65,10,0.25)');

    // Gaza Strip
    ctx.fillStyle   = 'rgba(200,70,0,0.25)';
    ctx.strokeStyle = 'rgba(255,110,0,0.50)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(118, 248, 14, 27);
    ctx.fillRect(118, 248, 14, 27);

    // Israel (bright green highlight)
    poly([
      [148,188],[170,192],[178,214],[175,260],[165,286],[155,352],
      [140,342],[132,282],[127,256],[132,228],[138,198]
    ], 'rgba(0,140,70,0.28)', 'rgba(0,255,100,0.65)', 1.5);

    ctx.restore();
  }

  function drawOrigins() {
    ctx.save();
    for (const o of ORIGINS) {
      const p = 0.5 + 0.5 * Math.sin(tick * 1.5 + ORIGINS.indexOf(o) * 1.2);
      ctx.globalAlpha = 0.75 + 0.25 * p;
      ctx.fillStyle   = o.color;
      ctx.shadowColor = o.color;
      ctx.shadowBlur  = 6;
      ctx.beginPath(); ctx.arc(o.x, o.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 0.22 * p;
      ctx.beginPath(); ctx.arc(o.x, o.y, 10 + 5 * p, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.font        = '7px Courier New';
      ctx.fillStyle   = o.color;
      ctx.textAlign   = 'center';
      ctx.fillText(o.name, o.x, o.y - 8);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawCities() {
    ctx.save();
    for (const city of cities) {
      if (city.hp <= 0) {
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath(); ctx.arc(city.x, city.y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.font      = '7px Courier New';
        ctx.fillStyle = '#555';
        ctx.textAlign = 'left';
        ctx.fillText('✕ ' + city.name, city.x + 6, city.y + 3);
        continue;
      }
      const ratio = city.hp / city.maxHp;
      const col   = ratio > 0.6 ? '#0ff' : ratio > 0.3 ? '#ff0' : '#f44';
      const p     = 0.6 + 0.4 * Math.sin(tick * 1.8 + CITY_DEFS.indexOf(CITY_DEFS.find(c => c.name === city.name)) * 0.7);
      ctx.globalAlpha = p;
      ctx.fillStyle   = col;
      ctx.shadowColor = col;
      ctx.shadowBlur  = 8;
      ctx.beginPath(); ctx.arc(city.x, city.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 0.18 * p;
      ctx.beginPath(); ctx.arc(city.x, city.y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.font        = 'bold 7px Courier New';
      ctx.fillStyle   = col;
      ctx.textAlign   = 'left';
      ctx.fillText(city.name, city.x + 6, city.y + 3);
      for (let i = 0; i < city.maxHp; i++) {
        ctx.fillStyle = i < city.hp ? col : '#252525';
        ctx.fillRect(city.x + 6 + i * 5, city.y + 5, 4, 3);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawArcs() {
    ctx.save();
    for (const m of missiles) {
      if (!m.active) continue;
      const sx = m.origin.x, sy = m.origin.y;
      const ex = m.target.x, ey = m.target.y;
      const mx = (sx + ex) / 2;
      const my = Math.min(sy, ey) + m.def.arcHeight;

      // Full dashed trajectory
      ctx.strokeStyle = m.def.color;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 7]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.stroke();

      // Traveled portion
      ctx.globalAlpha = 0.7;
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      const STEPS = 24;
      for (let i = 0; i <= STEPS; i++) {
        const t = (i / STEPS) * m.progress;
        const x = (1-t)*(1-t)*sx + 2*(1-t)*t*mx + t*t*ex;
        const y = (1-t)*(1-t)*sy + 2*(1-t)*t*my + t*t*ey;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawMissilesOnMap() {
    const PHASE_COLOR = { boost:'#ff8', space:'#88f', midcourse:'#8ff', reentry:'#f84' };
    ctx.save();
    for (const m of missiles) {
      if (!m.active) continue;
      const pos  = getMissilePos(m);
      const isSel = m.id === selectedId;
      const pc   = PHASE_COLOR[m.phase] || m.def.color;
      const p    = 0.7 + 0.3 * Math.sin(tick * 3);

      if (isSel) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth   = 1.5;
        ctx.globalAlpha = p;
        ctx.beginPath(); ctx.arc(pos.x, pos.y, 15, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle   = '#fff';
        ctx.beginPath(); ctx.arc(pos.x, pos.y, 15, 0, Math.PI * 2); ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.fillStyle   = pc;
      ctx.shadowColor = pc;
      ctx.shadowBlur  = 10;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur  = 0;

      const eta = Math.ceil(m.def.totalTime - m.elapsed);
      ctx.font      = 'bold 7px Courier New';
      ctx.fillStyle = m.def.color;
      ctx.textAlign = 'center';
      ctx.fillText(`${eta}s`, pos.x, pos.y - 9);
      ctx.font      = '6px Courier New';
      ctx.fillStyle = '#aaa';
      ctx.fillText(m.phase.toUpperCase(), pos.x, pos.y + 14);
    }
    ctx.restore();
  }

  function drawInterceptorTrails() {
    ctx.save();
    for (const iv of interceptors) {
      if (!iv.active) continue;
      const m   = missiles.find(x => x.id === iv.missileId);
      if (!m) continue;
      const tgt = getMissilePos(m);
      const sx  = iv.startPos.x, sy = iv.startPos.y;
      const x   = sx + (tgt.x - sx) * iv.t;
      const y   = sy + (tgt.y - sy) * iv.t;

      // Trail
      ctx.strokeStyle = iv.sys.color;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth   = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(x, y); ctx.stroke();
      ctx.setLineDash([]);

      // Head
      ctx.globalAlpha = 1;
      ctx.fillStyle   = iv.sys.color;
      ctx.shadowColor = iv.sys.color;
      ctx.shadowBlur  = 12;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur  = 0;
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawBlasts() {
    ctx.save();
    for (const b of blasts) {
      const t  = 1 - b.life / b.maxLife;
      const r  = b.r + t * 22;
      ctx.globalAlpha = (1 - t) * 0.85;
      ctx.fillStyle   = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur  = 18;
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur  = 0;
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawHeader() {
    ctx.font      = 'bold 10px Courier New';
    ctx.fillStyle = '#0f8';
    ctx.textAlign = 'left';
    ctx.fillText('AIR DEFENSE COMMAND', 8, 14);

    ctx.fillStyle = '#4af';
    ctx.textAlign = 'center';
    ctx.fillText(`WAVE ${wave}`, 240, 14);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff0';
    ctx.fillText(`$${budget}`, 472, 14);
    ctx.fillStyle = '#0f8';
    ctx.fillText(`SCORE: ${score}`, 472, 28);

    ctx.font      = '8px Courier New';
    ctx.fillStyle = '#555';
    ctx.textAlign = 'left';
    ctx.fillText(gameMode === 'campaign' ? 'CAMPAIGN' : 'SURVIVAL', 8, 28);
  }

  function drawPanel() {
    // ── Threat monitor ──────────────────────────────────────────────────────
    ctx.font      = 'bold 8px Courier New';
    ctx.fillStyle = '#0f8';
    ctx.textAlign = 'left';
    ctx.fillText('THREAT MONITOR', 8, PANEL_Y + 14);

    ctx.font      = '7px Courier New';
    ctx.fillStyle = '#333';
    ctx.fillText('─────────────────────────────── SELECT ▼', 8, PANEL_Y + 20);

    const shown = missiles.filter(m => m.active).slice(0, 4);
    for (let i = 0; i < shown.length; i++) {
      const m   = shown[i];
      const eta = Math.ceil(m.def.totalTime - m.elapsed);
      const y   = PANEL_Y + 30 + i * 16;
      const sel = m.id === selectedId;

      if (sel) {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(4, y - 10, 235, 14);
      }
      ctx.font      = '8px Courier New';
      ctx.fillStyle = m.def.color;
      ctx.textAlign = 'left';
      ctx.fillText(`M-${String(m.id).padStart(3,'0')} ${m.def.label}`, 8, y);
      ctx.fillStyle = '#888';
      ctx.fillText(`ETA:${eta}s`, 110, y);
      ctx.fillStyle = '#aaa';
      ctx.fillText(m.phase.toUpperCase(), 162, y);

      // Select ring
      ctx.strokeStyle = sel ? '#fff' : '#444';
      ctx.lineWidth   = 1;
      ctx.strokeRect(218, y - 9, 20, 12);
      ctx.fillStyle   = sel ? '#fff' : '#555';
      ctx.textAlign   = 'center';
      ctx.fillText('◎', 228, y);
    }
    if (shown.length === 0 && !betweenWaves) {
      ctx.font      = '8px Courier New';
      ctx.fillStyle = '#444';
      ctx.textAlign = 'left';
      ctx.fillText('NO ACTIVE THREATS', 8, PANEL_Y + 38);
    }

    // ── Intercept buttons ───────────────────────────────────────────────────
    ctx.font      = 'bold 8px Courier New';
    ctx.fillStyle = '#0f8';
    ctx.textAlign = 'left';
    ctx.fillText('INTERCEPT SYSTEM:', 8, PANEL_Y + 94);

    const sel    = selectedId !== null ? missiles.find(m => m.id === selectedId && m.active) : null;
    const btns   = [
      { key:'arrow',  x:4   },
      { key:'dsling', x:164 },
      { key:'idome',  x:324 },
    ];
    for (const b of btns) {
      const sys       = SYSTEMS[b.key];
      const canUse    = sel && sys.canHit.includes(sel.type) && budget >= sys.cost;
      const noCompat  = sel && !sys.canHit.includes(sel.type);
      const noBudget  = sel && sys.canHit.includes(sel.type) && budget < sys.cost;

      ctx.fillStyle   = noCompat ? '#1a0000' : (canUse ? 'rgba(0,22,14,0.9)' : '#0d0d0d');
      ctx.strokeStyle = noCompat ? '#3a0000' : (canUse ? sys.color : '#222');
      ctx.lineWidth   = 1;
      ctx.fillRect  (b.x, PANEL_Y + 100, 148, 52);
      ctx.strokeRect(b.x, PANEL_Y + 100, 148, 52);

      ctx.font      = 'bold 8px Courier New';
      ctx.fillStyle = canUse ? sys.color : (noCompat ? '#440000' : '#383838');
      ctx.textAlign = 'center';
      ctx.fillText(sys.name, b.x + 74, PANEL_Y + 115);

      ctx.font      = '7px Courier New';
      ctx.fillStyle = canUse ? '#0f8' : (noBudget ? '#f44' : '#333');
      ctx.fillText(`$${sys.cost}`, b.x + 74, PANEL_Y + 128);

      ctx.fillStyle = canUse ? '#aaa' : (noCompat ? '#550000' : '#2a2a2a');
      ctx.fillText(
        noCompat ? 'INCOMPATIBLE' : (noBudget ? 'NO BUDGET' : (sel ? 'TAP TO FIRE' : sys.desc)),
        b.x + 74, PANEL_Y + 141
      );
    }

    // ── Message log ─────────────────────────────────────────────────────────
    ctx.font = '7px Courier New';
    for (let i = 0; i < Math.min(messages.length, 3); i++) {
      const msg   = messages[i];
      ctx.globalAlpha = Math.min(1, msg.life / 1.5);
      ctx.fillStyle   = msg.color;
      ctx.textAlign   = 'left';
      ctx.fillText(msg.text.substring(0, 60), 4, PANEL_Y + 161 + i * 13);
    }
    ctx.globalAlpha = 1;
  }

  function drawBetweenWaveBanner() {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(60, 210, 360, 60);
    ctx.strokeStyle = '#4f4';
    ctx.lineWidth   = 1;
    ctx.strokeRect(60, 210, 360, 60);
    ctx.font        = 'bold 15px Courier New';
    ctx.fillStyle   = '#4f4';
    ctx.textAlign   = 'center';
    ctx.shadowColor = '#4f4';
    ctx.shadowBlur  = 10;
    ctx.fillText(`WAVE ${wave - 1} CLEAR — NEXT WAVE IN ${Math.ceil(betweenTimer)}s`, 240, 248);
    ctx.shadowBlur  = 0;
    ctx.restore();
  }

  function drawEndScreen() {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.80)';
    ctx.fillRect(50, 180, 380, 300);
    ctx.strokeStyle = gameWon ? '#0f8' : '#f44';
    ctx.lineWidth   = 2;
    ctx.strokeRect(50, 180, 380, 300);

    ctx.font        = 'bold 20px Courier New';
    ctx.fillStyle   = gameWon ? '#0f8' : '#f44';
    ctx.textAlign   = 'center';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur  = 14;
    ctx.fillText(gameWon ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED', 240, 228);
    ctx.shadowBlur  = 0;

    ctx.font      = '13px Courier New';
    ctx.fillStyle = '#ff0';
    ctx.fillText(`FINAL SCORE: ${score}`, 240, 268);
    ctx.fillText(`WAVE REACHED: ${wave}`, 240, 292);

    const alive   = cities.filter(c => c.hp > 0).length;
    ctx.fillStyle = alive > 0 ? '#0f8' : '#f44';
    ctx.fillText(`CITIES INTACT: ${alive} / ${cities.length}`, 240, 316);

    ctx.font      = '10px Courier New';
    ctx.fillStyle = '#888';
    ctx.fillText('TAP OR CLICK TO RETURN TO MENU', 240, 440);
    ctx.restore();
  }

  // ── Public interface ─────────────────────────────────────────────────────────
  return {
    init,
    startGame,
    destroy,
    _onExit: null,
  };
})();
