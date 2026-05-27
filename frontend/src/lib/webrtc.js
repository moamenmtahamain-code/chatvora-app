// ─── ICE SERVERS (Production-grade STUN + TURN) ────────────────────────────

export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

// TURN servers — configure in production via env
// If TURN_URL, TURN_USERNAME, TURN_CREDENTIAL are set, they'll be used
if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_TURN_URL) {
  ICE_SERVERS.iceServers.push({
    urls: process.env.NEXT_PUBLIC_TURN_URL,
    username: process.env.NEXT_PUBLIC_TURN_USERNAME || '',
    credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '',
  });
}

// ─── CONNECTION QUALITY THRESHOLDS ────────────────────────────────────────

const QUALITY = {
  GOOD: 'good',
  POOR: 'poor',
  LOST: 'lost',
};

const RTT_GOOD_THRESHOLD = 300;   // ms
const RTT_POOR_THRESHOLD = 1000;  // ms
const QUALITY_CHECK_INTERVAL = 5000; // ms

// ─── PEER CONNECTION FACTORY ───────────────────────────────────────────────

export function createPeerConnection(config = {}) {
  const pc = new RTCPeerConnection({
    ...ICE_SERVERS,
    ...config,
  });

  // Enable ICE restart support
  pc.restartIce = async function () {
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      return offer;
    } catch (err) {
      console.error('[WebRTC] ICE restart failed:', err);
      return null;
    }
  };

  return pc;
}

// ─── GET USER MEDIA (with error mapping) ───────────────────────────────────

export async function getLocalStream(audio = true, video = false) {
  try {
    const constraints = { audio, video };
    if (video) {
      constraints.video = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      };
    }
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (err) {
    const errorMap = {
      NotAllowedError: 'Microphone permission denied. Please allow access in your browser settings.',
      NotFoundError: 'No microphone found. Please connect a microphone.',
      NotReadableError: 'Microphone is in use by another application.',
      OverconstrainedError: 'Microphone does not meet the required constraints.',
      SecurityError: 'Microphone access blocked by security policy.',
      AbortError: 'Microphone access aborted.',
    };
    const message = errorMap[err.name] || `Failed to access media: ${err.message}`;
    console.error('[WebRTC] getUserMedia error:', err.name, err.message);
    throw new Error(message);
  }
}

// ─── STOP ALL TRACKS (cleanup helper) ──────────────────────────────────────

export function stopStream(stream) {
  if (!stream) return;
  try {
    stream.getTracks().forEach(t => t.stop());
  } catch (err) {
    console.error('[WebRTC] stopStream error:', err);
  }
}

// ─── CLOSE PEER CONNECTION (safe) ──────────────────────────────────────────

export function closePeerConnection(pc) {
  if (!pc) return;
  try {
    pc.getSenders().forEach(sender => {
      try { sender.track?.stop(); } catch (_) {}
    });
    pc.close();
  } catch (err) {
    console.error('[WebRTC] closePeerConnection error:', err);
  }
}

// ─── ATTACH STREAM TO VIDEO ELEMENT ────────────────────────────────────────

export function attachStream(videoEl, stream) {
  if (!videoEl || !stream) return;
  if (videoEl.srcObject !== stream) {
    videoEl.srcObject = stream;
  }
}

// ─── CONNECTION QUALITY MONITOR ────────────────────────────────────────────

export function createQualityMonitor(pc, onQualityChange) {
  if (!pc || !onQualityChange) return null;

  let interval = null;
  let lastGood = Date.now();

  const check = async () => {
    try {
      const stats = await pc.getStats();
      let currentRtt = null;

      stats.forEach(report => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          currentRtt = report.currentRoundTripTime * 1000; // convert to ms
        }
      });

      if (currentRtt !== null) {
        if (currentRtt < RTT_GOOD_THRESHOLD) {
          onQualityChange(QUALITY.GOOD);
          lastGood = Date.now();
        } else if (currentRtt < RTT_POOR_THRESHOLD) {
          onQualityChange(QUALITY.POOR);
          lastGood = Date.now();
        } else {
          onQualityChange(QUALITY.POOR);
        }
      }

      // Check if connection is lost (no good stats for 15s)
      if (Date.now() - lastGood > 15000) {
        onQualityChange(QUALITY.LOST);
      }
    } catch (err) {
      // Stats collection may fail if connection is closing
    }
  };

  return {
    start: () => {
      stop(); // avoid duplicate
      interval = setInterval(check, QUALITY_CHECK_INTERVAL);
      check(); // immediate first check
    },
    stop: () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    },
    getQuality: () => QUALITY,
  };
}

// ─── CREATE DATA CHANNEL FOR PING/PONG ─────────────────────────────────────

export function createDataChannel(pc, label = 'quality') {
  let channel = null;

  const onMessage = (handler) => {
    if (channel) {
      channel.onmessage = (event) => handler(event.data);
    }
  };

  try {
    channel = pc.createDataChannel(label, { negotiated: false });
    channel.onopen = () => console.log('[WebRTC] Data channel open');
    channel.onclose = () => console.log('[WebRTC] Data channel closed');
    channel.onerror = (err) => console.error('[WebRTC] Data channel error:', err);
  } catch (err) {
    console.warn('[WebRTC] Data channel creation failed (not critical):', err);
  }

  return {
    channel,
    send: (data) => {
      if (channel?.readyState === 'open') {
        try { channel.send(data); } catch (_) {}
      }
    },
    onMessage,
    close: () => {
      try { channel?.close(); } catch (_) {}
    },
  };
}

export { QUALITY };
export default {
  ICE_SERVERS,
  createPeerConnection,
  getLocalStream,
  stopStream,
  closePeerConnection,
  attachStream,
  createQualityMonitor,
  createDataChannel,
  QUALITY,
};
