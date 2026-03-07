const Audio = (() => {
  let ctx = null;
  let enabled = true;

  function init() {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      enabled = false;
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function playTone(freq, type, duration, vol = 0.15, startFreq = null, fadeOut = true) {
    if (!ctx || !enabled) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(startFreq || freq, ctx.currentTime);
      if (startFreq) osc.frequency.exponentialRampToValueAtTime(freq, ctx.currentTime + duration * 0.5);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      if (fadeOut) gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }

  function shoot() {
    playTone(800, 'square', 0.08, 0.1, 1200);
  }

  function enemyShoot() {
    playTone(300, 'sawtooth', 0.1, 0.05, 400);
  }

  function explosion(big = false) {
    if (!ctx || !enabled) return;
    try {
      const bufSize = ctx.sampleRate * (big ? 0.5 : 0.25);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
      }
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(big ? 800 : 500, ctx.currentTime);
      src.buffer = buf;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(big ? 0.4 : 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (big ? 0.5 : 0.25));
      src.start();
    } catch (e) {}
  }

  function powerup() {
    playTone(880, 'sine', 0.3, 0.15, 440);
  }

  function playerHit() {
    playTone(150, 'sawtooth', 0.3, 0.2, 300);
  }

  function levelUp() {
    if (!ctx || !enabled) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 'square', 0.2, 0.12), i * 120);
    });
  }

  function gameOver() {
    if (!ctx || !enabled) return;
    const notes = [400, 350, 300, 200];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 'sawtooth', 0.3, 0.15), i * 150);
    });
  }

  function bomb() {
    if (!ctx || !enabled) return;
    explosion(true);
    setTimeout(() => playTone(200, 'sine', 0.4, 0.1, 800), 100);
  }

  // ── Air Defense mini-game sounds ────────────────────────────────────────────

  // Radar ping — short soft blip (called periodically from the sweep)
  function adRadarPing() {
    playTone(1200, 'sine', 0.12, 0.04, 1400, true);
  }

  // New threat detected — sharp two-tone alert
  function adThreatDetected() {
    if (!ctx || !enabled) return;
    playTone(880, 'square', 0.10, 0.08);
    setTimeout(() => playTone(1100, 'square', 0.12, 0.08), 120);
  }

  // Interceptor launch — ascending sweep, pitch differs by system
  function adLaunch(sysKey) {
    if (!ctx || !enabled) return;
    const cfg = {
      arrow:  { start: 300, end: 1800, dur: 0.40, vol: 0.12, type: 'sawtooth' },
      dsling: { start: 400, end: 1200, dur: 0.28, vol: 0.10, type: 'sawtooth' },
      idome:  { start: 600, end: 1000, dur: 0.16, vol: 0.09, type: 'square'   },
    };
    const c = cfg[sysKey] || cfg.idome;
    playTone(c.end, c.type, c.dur, c.vol, c.start, true);
  }

  // Successful intercept — rising arpeggio + sharp crack
  function adIntercept() {
    if (!ctx || !enabled) return;
    [784, 988, 1319].forEach((f, i) =>
      setTimeout(() => playTone(f, 'square', 0.14, 0.10), i * 70)
    );
    setTimeout(() => {
      // Sharp crack (filtered noise burst)
      try {
        const buf  = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++)
          data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src  = ctx.createBufferSource();
        const gain = ctx.createGain();
        const filt = ctx.createBiquadFilter();
        filt.type = 'highpass'; filt.frequency.value = 2000;
        src.buffer = buf;
        src.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        src.start();
      } catch (e) {}
    }, 200);
  }

  // Interceptor missed — descending disappointed tone
  function adMiss() {
    if (!ctx || !enabled) return;
    playTone(300, 'sawtooth', 0.35, 0.10, 600, true);
  }

  // Impact on city — deep low explosion boom
  function adCityImpact() {
    if (!ctx || !enabled) return;
    explosion(true);
    playTone(80, 'sine', 0.5, 0.18, 180, true);
  }

  // Impact in open area — quiet thud
  function adOpenImpact() {
    if (!ctx || !enabled) return;
    explosion(false);
    playTone(120, 'sine', 0.2, 0.06, 200, true);
  }

  // Wave incoming alarm — pulsing siren
  function adWaveAlert() {
    if (!ctx || !enabled) return;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => playTone(660, 'sawtooth', 0.18, 0.10, 440, true), i * 240);
    }
  }

  // Wave cleared — short upbeat jingle
  function adWaveClear() {
    if (!ctx || !enabled) return;
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => playTone(f, 'square', 0.18, 0.10), i * 100)
    );
  }

  // Budget low warning — urgent double-beep
  function adBudgetWarning() {
    if (!ctx || !enabled) return;
    playTone(440, 'square', 0.10, 0.08);
    setTimeout(() => playTone(440, 'square', 0.10, 0.08), 160);
  }

  // Victory fanfare — ascending triumphant arpeggio
  function adVictory() {
    if (!ctx || !enabled) return;
    [523, 659, 784, 988, 1319].forEach((f, i) =>
      setTimeout(() => playTone(f, 'square', 0.30, 0.12), i * 130)
    );
  }

  // Mission failed — dramatic descending sequence
  function adDefeat() {
    if (!ctx || !enabled) return;
    [400, 337, 280, 200, 150].forEach((f, i) =>
      setTimeout(() => playTone(f, 'sawtooth', 0.28, 0.14), i * 160)
    );
  }

  return {
    init, resume, shoot, enemyShoot, explosion, powerup, playerHit, levelUp, gameOver, bomb,
    adRadarPing, adThreatDetected, adLaunch, adIntercept, adMiss,
    adCityImpact, adOpenImpact, adWaveAlert, adWaveClear, adBudgetWarning,
    adVictory, adDefeat,
  };
})();
