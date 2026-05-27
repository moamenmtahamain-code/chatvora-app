/**
 * Programmatic ringtone generator using Web Audio API.
 * No external audio files needed — works in all modern browsers.
 */

let _ctx = null;
let _gain = null;
let _osc1 = null;
let _osc2 = null;
let _timeout = null;
let _isPlaying = false;

function getContext() {
  if (!_ctx) {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_ctx.state === 'suspended') {
    _ctx.resume();
  }
  return _ctx;
}

/**
 * Play a two-tone phone ringtone pattern repeatedly.
 * Pattern: 440Hz (0.5s) -> silent (0.3s) -> 480Hz (0.5s) -> silent (0.3s)
 */
export function playRingtone() {
  if (_isPlaying) return;
  _isPlaying = true;

  const ctx = getContext();
  _gain = ctx.createGain();
  _gain.gain.value = 0.3;
  _gain.connect(ctx.destination);

  function playCycle() {
    if (!_isPlaying) return;

    const now = ctx.currentTime;

    // First tone: 440Hz for 500ms
    _osc1 = ctx.createOscillator();
    _osc1.type = 'sine';
    _osc1.frequency.value = 440;
    _osc1.connect(_gain);
    _osc1.start(now);
    _osc1.stop(now + 0.5);

    // Second tone: 480Hz for 500ms (starts after 800ms gap)
    _osc2 = ctx.createOscillator();
    _osc2.type = 'sine';
    _osc2.frequency.value = 480;
    _osc2.connect(_gain);
    _osc2.start(now + 0.8);
    _osc2.stop(now + 1.3);

    // Schedule next cycle after 1.6s (total cycle time)
    _timeout = setTimeout(playCycle, 1600);
  }

  playCycle();
}

/**
 * Stop the ringtone immediately.
 */
export function stopRingtone() {
  _isPlaying = false;
  if (_timeout) {
    clearTimeout(_timeout);
    _timeout = null;
  }
  try { _osc1?.stop(); } catch (_) {}
  try { _osc2?.stop(); } catch (_) {}
  _osc1 = null;
  _osc2 = null;
  _gain = null;
}

/**
 * Play a short single-beep for call connected/disconnected sounds.
 */
export function playBeep(frequency = 800, duration = 0.15, volume = 0.2) {
  try {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    g.gain.value = volume;
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (_) {}
}
