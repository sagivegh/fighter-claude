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

  return { init, resume, shoot, enemyShoot, explosion, powerup, playerHit, levelUp, gameOver, bomb };
})();
