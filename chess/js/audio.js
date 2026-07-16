/**
 * Nocturne Chess — 简易音效（Web Audio，无音频文件）
 * 走子 thrump + 将军「登登」双音
 */
(() => {
  "use strict";

  const KEY = "nocturne_chess_audio_v1";
  let enabled = true;
  let unlocked = false;
  let ctx = null;
  let master = null;
  let gen = 0;

  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "0" || raw === "false") enabled = false;
  } catch (_) {/* ignore */}

  function ensureCtx() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      if (!ctx) ctx = new AC();
      if (!master || master.context !== ctx) {
        master = ctx.createGain();
        master.gain.value = 1;
        master.connect(ctx.destination);
      }
      return ctx;
    } catch (_) {
      return null;
    }
  }

  function kickSilent(c) {
    try {
      const buf = c.createBuffer(1, 1, c.sampleRate || 22050);
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start(0);
    } catch (_) {/* ignore */}
  }

  function resumeCtx(c) {
    if (!c || c.state !== "suspended") return Promise.resolve(c);
    try {
      return c.resume().then(() => c).catch(() => c);
    } catch (_) {
      return Promise.resolve(c);
    }
  }

  function withLive(fn) {
    if (!enabled || !unlocked) return;
    const c = ensureCtx();
    if (!c) return;
    const run = () => {
      if (!enabled || !unlocked || !master) return;
      try {
        master.gain.cancelScheduledValues(c.currentTime);
        master.gain.setValueAtTime(1, c.currentTime);
        fn(c);
      } catch (_) {/* ignore */}
    };
    if (c.state === "suspended") {
      kickSilent(c);
      resumeCtx(c).then(run);
      return;
    }
    run();
  }

  function init() {
    unlocked = true;
    const c = ensureCtx();
    if (c) {
      kickSilent(c);
      if (master) {
        try {
          master.gain.cancelScheduledValues(c.currentTime);
          master.gain.setValueAtTime(1, c.currentTime);
        } catch (_) {/* ignore */}
      }
      resumeCtx(c);
    }
    return true;
  }

  function setEnabled(next) {
    enabled = !!next;
    try {
      localStorage.setItem(KEY, enabled ? "1" : "0");
    } catch (_) {/* ignore */}
    if (!enabled) {
      gen += 1;
      if (master) {
        try {
          const now = master.context.currentTime;
          master.gain.cancelScheduledValues(now);
          master.gain.setValueAtTime(0.0001, now);
        } catch (_) {/* ignore */}
      }
      return;
    }
    init();
  }

  function noiseClack(when, opts) {
    const c = ensureCtx();
    if (!c || !master) return;
    const dur = opts.dur || 0.04;
    const size = Math.max(1, Math.floor(c.sampleRate * dur));
    const buffer = c.createBuffer(1, size, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (size * (opts.decay || 0.2)));
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = opts.freq || 900;
    filter.Q.value = opts.q || 1.1;
    const gain = c.createGain();
    const peak = opts.vol || 0.25;
    gain.gain.setValueAtTime(peak, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(when);
    src.stop(when + dur + 0.02);
  }

  function tone(when, freq, dur, vol) {
    const c = ensureCtx();
    if (!c || !master) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(vol, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(when);
    osc.stop(when + dur + 0.03);
  }

  /** 走子 / 落子：木质短顿响 */
  function playMove(isCapture) {
    withLive((c) => {
      const now = c.currentTime;
      if (isCapture) {
        noiseClack(now, { freq: 620, dur: 0.05, vol: 0.32, decay: 0.22, q: 0.9 });
        noiseClack(now + 0.03, { freq: 1100, dur: 0.035, vol: 0.2, decay: 0.15, q: 1.2 });
      } else {
        noiseClack(now, { freq: 880 + Math.random() * 400, dur: 0.038, vol: 0.26, decay: 0.18, q: 1.0 });
      }
    });
  }

  /** 将军：登登 双音提示 */
  function playCheck() {
    withLive((c) => {
      const now = c.currentTime;
      tone(now, 587.33, 0.14, 0.3); // D5
      tone(now + 0.17, 440.0, 0.2, 0.34); // A4
    });
  }

  /** 将死：登登略强 + 低音一记 */
  function playCheckmate() {
    withLive((c) => {
      const now = c.currentTime;
      tone(now, 587.33, 0.14, 0.32);
      tone(now + 0.16, 440.0, 0.16, 0.34);
      tone(now + 0.34, 277.18, 0.28, 0.28); // C#4
    });
  }

  window.ChessAudio = {
    init,
    setEnabled,
    isEnabled: () => enabled,
    playMove,
    playCheck,
    playCheckmate
  };
})();
