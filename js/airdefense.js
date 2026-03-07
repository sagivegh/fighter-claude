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
  let lastRadarAngle = 0;
  let budgetWarned = false;

  // ── Map layout ──────────────────────────────────────────────────────────────
  const MAP_H   = 500;   // map occupies top 500 px of 720
  const PANEL_Y = 500;
  const PANEL_H = 220;

  // ── Geographic projection ────────────────────────────────────────────────────
  // Mercator-lite: lon [30,62] → x [0,480],  lat [12,40] → y [0,500]
  const GEO = { lon0:30, lon1:62, lat0:12, lat1:40 };
  function px(lat, lon) {
    return [
      (lon - GEO.lon0) / (GEO.lon1 - GEO.lon0) * 480,
      (GEO.lat1 - lat) / (GEO.lat1 - GEO.lat0) * MAP_H,
    ];
  }

  // Origin countries — real geographic positions
  const ORIGINS = [
    { id:'lebanon', name:'LEBANON', ...pxObj(33.89, 35.50), color:'#f44', types:['cruise','rocket'] },
    { id:'syria',   name:'SYRIA',   ...pxObj(33.51, 36.29), color:'#f84', types:['ballistic','cruise'] },
    { id:'iraq',    name:'IRAQ',    ...pxObj(33.34, 44.40), color:'#fa4', types:['ballistic'] },
    { id:'iran',    name:'IRAN',    ...pxObj(35.69, 51.39), color:'#f22', types:['ballistic'] },
    { id:'yemen',   name:'YEMEN',   ...pxObj(15.37, 44.19), color:'#f64', types:['ballistic','drone'] },
    { id:'gaza',    name:'GAZA',    ...pxObj(31.50, 34.47), color:'#fa2', types:['rocket','drone'] },
  ];
  function pxObj(lat, lon) { const [x,y] = px(lat,lon); return {x,y}; }

  const CITY_DEFS = [
    { name:'HAIFA',       ...pxObj(32.82, 34.99), maxHp:3 },
    { name:'TEL AVIV',    ...pxObj(32.08, 34.78), maxHp:4 },
    { name:'JERUSALEM',   ...pxObj(31.78, 35.23), maxHp:4 },
    { name:"BE'ER SHEVA", ...pxObj(31.25, 34.79), maxHp:3 },
    { name:'EILAT',       ...pxObj(29.56, 34.95), maxHp:2 },
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
    Audio.resume();
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

    // Radar ping on each sweep completion
    const radarAngle = (tick * 0.6) % (Math.PI * 2);
    if (radarAngle < lastRadarAngle) Audio.adRadarPing();
    lastRadarAngle = radarAngle;

    // Budget warning once when low
    if (budget < 200 && !budgetWarned) {
      budgetWarned = true;
      Audio.adBudgetWarning();
    }
    if (budget >= 200) budgetWarned = false;

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
    Audio.adWaveAlert();
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
      Audio.adVictory();
      return;
    }

    score += wave * 500;
    addMessage(`◆ WAVE ${wave} CLEAR! BONUS +${wave * 500}`, '#4f4');
    Audio.adWaveClear();
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
      Audio.adDefeat();
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
    Audio.adThreatDetected();
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
      Audio.adCityImpact();
    } else {
      addMessage('◆ IMPACT IN OPEN AREA — NO DAMAGE', '#888');
      Audio.adOpenImpact();
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
      startPos: { x: px(31.5,35.1)[0], y: px(31.5,35.1)[1] },
      elapsed: 0, t: 0,
    });
    addMessage(`◆ ${sys.name} LAUNCHED → M-${String(missileId).padStart(3,'0')}`, sys.color);
    Audio.adLaunch(sysKey);
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
      Audio.adIntercept();
    } else {
      addMessage(`◆ ${iv.sys.name} MISSED! MISSILE CONTINUING`, '#f44');
      Audio.adMiss();
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
    const [cx, cy] = px(31.5, 35.1);
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

  // Draw a country polygon from [[lat,lon],...] pairs
  function geoPoly(latLons, fill, stroke, lw = 0.8) {
    ctx.fillStyle   = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth   = lw;
    ctx.beginPath();
    for (let i = 0; i < latLons.length; i++) {
      const [x, y] = px(latLons[i][0], latLons[i][1]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // ── Real geo-projected country outlines ──────────────────────────────────────
  // All coordinates are [lat°N, lon°E]  (simplified but geographically accurate)

  // Turkey (southern portion visible lat≤40)
  const C_TURKEY = [
    [40,30],[40,44.8],[37.4,44.8],[37.2,41.3],[36.8,38.8],
    [36.5,36.2],[36.1,35.9],[36.6,35.5],[36.2,33.9],[36.0,32.5],[36.5,30],[40,30],
  ];
  // Cyprus
  const C_CYPRUS = [
    [35.7,32.3],[34.6,32.3],[34.5,33.3],[34.7,34.6],[35.2,34.6],[35.7,33.5],[35.7,32.3],
  ];
  // Egypt — includes Sinai, Red Sea coast on east side (creates Red Sea gap vs Saudi)
  const C_EGYPT = [
    [31.5,30.0],[31.5,32.2],[30.9,32.4],         // Med coast → Suez Canal
    [31.1,34.2],[29.5,34.9],[27.8,34.5],          // Sinai (Rafah → Eilat → Sharm)
    [25.0,35.5],[23.5,36.5],[22.0,37.0],          // Red Sea coast going south
    [22.0,30.0],[31.5,30.0],                       // W border
  ];
  // Sudan / Eritrea — traces Red Sea W coast
  const C_SUDAN = [
    [22.0,30.0],[22.0,37.0],[19.6,37.2],[15.0,41.5],[12.0,43.5],[12.0,30.0],[22.0,30.0],
  ];
  // Saudi Arabia — proper Red Sea coast on west side, Gulf coast on east
  const C_SAUDI = [
    [29.5,35.0],[29.2,38.7],[30.0,42.5],          // N border (Aqaba → Iraq)
    [29.1,46.5],[28.5,50.0],[27.0,52.0],           // NE border / Gulf coast
    [26.5,56.3],[22.0,59.0],                       // E coast → Oman
    [18.0,55.0],[15.0,43.0],                       // Yemen border
    [16.8,42.6],[19.0,41.0],                       // Red Sea coast N from Yemen
    [21.5,39.2],[24.5,37.5],[27.0,36.0],[28.5,35.5],[29.5,35.0], // Red Sea → Aqaba
  ];
  // Yemen
  const C_YEMEN = [
    [18.0,42.5],[15.0,43.0],[12.6,44.0],[12.0,45.5],
    [13.0,48.0],[15.5,50.5],[18.0,55.0],[18.0,42.5],
  ];
  // Oman / UAE
  const C_OMAN = [
    [26.5,56.3],[24.5,54.5],[23.5,51.5],[22.0,59.0],
    [25.1,61.0],[31.0,62.0],[31.0,61.5],[26.5,56.3],
  ];
  // Iran — routes along S Caspian coast (leaves Caspian as visible gap at top)
  const C_IRAN = [
    [37.4,44.8],[37.0,49.0],[36.7,50.8],[36.6,54.0], // NW → S Caspian coast
    [36.0,60.0],[31.0,61.5],[25.1,61.0],[22.0,59.0],  // E border
    [26.5,56.3],[27.0,52.0],[28.5,50.0],              // Gulf of Oman / Persian Gulf
    [30.0,48.5],[33.6,46.1],[35.1,45.7],[37.4,44.8],  // Iraq border
  ];
  // Kuwait
  const C_KUWAIT = [
    [30.1,48.0],[29.1,48.0],[29.1,46.5],[29.5,46.5],[30.1,47.7],[30.1,48.0],
  ];
  // Iraq
  const C_IRAQ = [
    [37.0,42.4],[37.4,44.8],[35.1,45.7],[33.6,46.1],[30.0,48.0],
    [29.1,48.0],[29.1,46.5],[30.0,42.5],[29.2,38.7],[33.4,38.8],
    [33.8,40.7],[36.8,38.8],[37.0,42.4],
  ];
  // Syria
  const C_SYRIA = [
    [37.0,42.4],[37.2,41.3],[36.8,38.8],[33.8,40.7],[33.4,38.8],
    [32.3,36.8],[32.7,35.8],[33.1,35.7],[33.3,35.6],[33.7,36.0],
    [34.7,36.6],[36.6,36.2],[36.8,38.8],[37.0,42.4],
  ];
  // Jordan
  const C_JORDAN = [
    [32.7,35.8],[33.4,38.8],[29.2,38.7],[29.5,35.0],
    [30.0,35.0],[31.1,35.4],[31.5,35.5],[31.9,35.5],[32.6,35.6],[32.7,35.8],
  ];
  // Lebanon
  const C_LEBANON = [
    [33.1,35.1],[33.3,35.6],[33.7,36.0],[34.7,36.6],
    [34.5,36.0],[34.2,35.7],[33.7,35.6],[33.1,35.1],
  ];
  // Israel
  const C_ISRAEL = [
    [33.3,35.6],[33.1,35.7],[32.7,35.8],[32.6,35.6],[31.9,35.5],
    [31.5,35.5],[31.1,35.4],[30.0,35.0],[29.6,35.0],[29.5,34.8],
    [30.3,34.5],[31.2,34.2],[31.6,34.5],[32.1,34.8],[32.5,34.9],
    [32.8,35.0],[33.1,35.1],[33.3,35.6],
  ];
  // Gaza Strip
  const C_GAZA = [[31.6,34.5],[31.2,34.2],[31.2,34.5],[31.6,34.5]];

  // ── Inland water bodies ────────────────────────────────────────────────────
  // Caspian Sea (S portion visible at top of map, lat 36.5–40°N)
  const C_CASPIAN = [
    [40.0,49.2],[40.0,54.2],
    [37.8,54.0],[36.8,52.5],[36.7,50.5],[37.0,49.2],[38.5,48.9],[40.0,49.2],
  ];
  // Dead Sea (Israel/Jordan border, small sliver)
  const C_DEAD_SEA = [
    [31.78,35.45],[31.50,35.50],[31.05,35.40],[31.30,35.30],[31.78,35.35],
  ];
  // Sea of Galilee / Kinneret
  const C_GALILEE = [
    [32.90,35.50],[32.70,35.48],[32.70,35.63],[32.90,35.65],
  ];

  function drawMapRegions() {
    ctx.save();

    // 1. Ocean base
    ctx.fillStyle = 'rgba(0,20,60,0.80)';
    ctx.fillRect(0, 0, 480, MAP_H);

    // 2. Land masses — back to front
    const SAND  = 'rgba(58,46,18,0.88)';
    const SBORD = 'rgba(88,70,30,0.60)';
    geoPoly(C_SUDAN,  SAND, SBORD);
    geoPoly(C_EGYPT,  SAND, SBORD);
    geoPoly(C_TURKEY, 'rgba(52,46,20,0.88)', 'rgba(82,72,32,0.60)');
    geoPoly(C_CYPRUS, SAND, SBORD);
    geoPoly(C_SAUDI,  'rgba(68,52,14,0.88)', 'rgba(102,80,26,0.60)');
    geoPoly(C_YEMEN,  'rgba(85,52,8,0.88)',  'rgba(118,72,18,0.65)');
    geoPoly(C_OMAN,   SAND, SBORD);
    geoPoly(C_IRAN,   'rgba(88,14,8,0.88)',  'rgba(128,26,16,0.60)');
    geoPoly(C_KUWAIT, SAND, SBORD);
    geoPoly(C_IRAQ,   'rgba(70,46,6,0.88)',  'rgba(102,70,16,0.65)');
    geoPoly(C_SYRIA,  'rgba(60,38,6,0.88)',  'rgba(92,62,18,0.65)');
    geoPoly(C_JORDAN, SAND, SBORD);
    geoPoly(C_LEBANON,'rgba(66,36,8,0.88)',  'rgba(98,58,20,0.65)');

    // Gaza — hostile highlight
    geoPoly(C_GAZA, 'rgba(160,55,0,0.50)', 'rgba(255,100,0,0.70)', 1.2);

    // Israel — friendly highlight
    geoPoly(C_ISRAEL, 'rgba(0,120,55,0.35)', 'rgba(0,255,90,0.75)', 1.5);

    // 3. Inland water bodies (drawn on top of land)
    const SEA  = 'rgba(0,45,110,0.85)';
    const SEBR = 'rgba(0,80,160,0.60)';
    geoPoly(C_CASPIAN,  SEA, SEBR, 1.0);
    geoPoly(C_DEAD_SEA, 'rgba(0,55,130,0.90)', 'rgba(0,100,180,0.70)', 0.8);
    geoPoly(C_GALILEE,  'rgba(0,55,130,0.90)', 'rgba(0,100,180,0.70)', 0.8);

    // 4. Country labels
    ctx.font      = '7px Courier New';
    ctx.textAlign = 'center';
    const labels = [
      { t:'TURKEY',       lat:38.0, lon:36.0, c:'rgba(190,170,90,0.80)'  },
      { t:'SYRIA',        lat:34.8, lon:38.5, c:'rgba(205,148,65,0.80)'  },
      { t:'IRAQ',         lat:33.2, lon:43.5, c:'rgba(195,155,45,0.80)'  },
      { t:'IRAN',         lat:32.5, lon:53.5, c:'rgba(225,65,55,0.80)'   },
      { t:'SAUDI',        lat:26.0, lon:44.5, c:'rgba(175,145,55,0.75)'  },
      { t:'ARABIA',       lat:24.5, lon:44.5, c:'rgba(175,145,55,0.75)'  },
      { t:'YEMEN',        lat:15.5, lon:47.5, c:'rgba(205,115,35,0.75)'  },
      { t:'JORDAN',       lat:31.0, lon:36.8, c:'rgba(165,135,55,0.75)'  },
      { t:'EGYPT',        lat:27.5, lon:31.5, c:'rgba(165,135,45,0.70)'  },
      { t:'OMAN',         lat:22.5, lon:58.0, c:'rgba(160,130,45,0.70)'  },
      { t:'CASPIAN',      lat:38.5, lon:51.5, c:'rgba(80,160,220,0.75)'  },
      { t:'SEA',          lat:37.5, lon:51.5, c:'rgba(80,160,220,0.75)'  },
    ];
    for (const lb of labels) {
      const [lx, ly] = px(lb.lat, lb.lon);
      ctx.fillStyle = lb.c;
      ctx.fillText(lb.t, lx, ly);
    }

    // 5. Water body labels
    ctx.font = '6px Courier New';
    const wlabels = [
      { t:'RED SEA',       lat:21.0, lon:38.0, c:'rgba(80,150,220,0.70)' },
      { t:'PERSIAN GULF',  lat:27.0, lon:50.5, c:'rgba(80,150,220,0.65)' },
      { t:'MED. SEA',      lat:34.0, lon:31.5, c:'rgba(80,150,220,0.70)' },
    ];
    for (const lb of wlabels) {
      const [lx, ly] = px(lb.lat, lb.lon);
      ctx.fillStyle = lb.c;
      ctx.fillText(lb.t, lx, ly);
    }

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
