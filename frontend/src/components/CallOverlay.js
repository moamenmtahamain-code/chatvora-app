'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiMic, FiMicOff, FiVideo, FiVideoOff, FiPhoneOff,
  FiPhone, FiPhoneIncoming, FiPhoneMissed, FiUser,
  FiMaximize, FiMinimize, FiWifi, FiWifiOff, FiMonitor
} from 'react-icons/fi';
import useCallStore from '../stores/callStore';
import socketEvents from '../lib/socket';
import { playRingtone, stopRingtone, playBeep } from '../lib/ringtone';

// ─── CONNECTION QUALITY INDICATOR ──────────────────────────────────────────

function QualityBadge({ quality }) {
  const colors = { good: '#10b981', poor: '#f59e0b', lost: '#ef4444' };
  const labels = { good: 'Good connection', poor: 'Poor connection', lost: 'Connection lost' };
  const color = colors[quality] || '#10b981';

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 999,
      background: `${color}15`, border: `1px solid ${color}30`,
      fontSize: 11, fontWeight: 500, color,
    }}>
      {quality === 'lost' ? <FiWifiOff size={11} /> : <FiWifi size={11} />}
      {labels[quality] || 'Good connection'}
    </div>
  );
}

// ─── CALL DURATION ─────────────────────────────────────────────────────────

function CallTimer({ seconds }) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

// ─── CALL OVERLAY ──────────────────────────────────────────────────────────

export default function CallOverlay() {
  const {
    currentCall, callStatus, localStream, remoteStream,
    isMuted, isVideoEnabled, callDuration, connectionQuality,
    acceptCall, rejectCall, endCall, toggleMute,
    toggleVideo, startCallTimer, stopCallTimer, formatDuration,
  } = useCallStore();

  const [incomingCall, setIncomingCall] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenTrackRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const containerRef = useRef(null);

  // ─── SOCKET LISTENERS ─────────────────────────────────────────────────────
  useEffect(() => {
    const onIncoming = (callData) => {
      setIncomingCall(callData);
      playRingtone();
    };

    const onAccepted = () => {
      stopRingtone();
      playBeep(1200, 0.2, 0.15);
      startCallTimer();
    };

    const onEnded = () => {
      stopRingtone();
      playBeep(400, 0.3, 0.15);
      endCall();
      stopCallTimer();
      setIncomingCall(null);
    };

    const onRejected = () => {
      stopRingtone();
      playBeep(300, 0.4, 0.12);
      endCall();
      setIncomingCall(null);
    };

    const onSignal = async (data) => {
      if (data.signal) {
        const result = await useCallStore.getState().handleSignal(data.signal);
        if (result && data.from) {
          socketEvents.sendCallSignal(data.from, result, data.callId);
        }
      }
    };

    socketEvents.onCallIncoming(onIncoming);
    socketEvents.onConversationCallIncoming(onIncoming);
    socketEvents.onGroupCallIncoming?.(onIncoming);
    socketEvents.onCallAccepted(onAccepted);
    socketEvents.onCallRejected(onRejected);
    socketEvents.onCallEnded(onEnded);
    socketEvents.onCallSignal(onSignal);

    return () => {
      socketEvents.offCallIncoming(onIncoming);
      socketEvents.offConversationCallIncoming(onIncoming);
      socketEvents.offGroupCallIncoming?.(onIncoming);
      socketEvents.offCallAccepted(onAccepted);
      socketEvents.offCallRejected(onRejected);
      socketEvents.offCallEnded(onEnded);
      socketEvents.offCallSignal(onSignal);
      stopRingtone();
      stopCallTimer();
    };
  }, [startCallTimer, stopCallTimer, endCall]);

  // ─── ATTACH MEDIA ────────────────────────────────────────────────────────
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // ─── HANDLERS ────────────────────────────────────────────────────────────
  const handleAccept = useCallback(async () => {
    stopRingtone();
    await acceptCall(incomingCall);
    setIncomingCall(null);
    startCallTimer();
  }, [acceptCall, incomingCall, startCallTimer]);

  const handleReject = useCallback(() => {
    stopRingtone();
    rejectCall(incomingCall);
    setIncomingCall(null);
  }, [rejectCall, incomingCall]);

  const handleEndCall = useCallback(() => {
    stopRingtone();
    endCall();
    stopCallTimer();
  }, [endCall, stopCallTimer]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }
      setIsScreenSharing(false);
      return;
    }
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      });
      screenTrackRef.current = screenStream.getVideoTracks()[0];
      screenTrackRef.current.onended = () => {
        setIsScreenSharing(false);
        screenTrackRef.current = null;
      };
      setIsScreenSharing(true);
    } catch (err) {
      if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
        console.error('Screen share error:', err);
      }
    }
  }, [isScreenSharing]);

  const callerName = currentCall?.caller?.displayName
    || currentCall?.caller?.username
    || incomingCall?.caller?.displayName
    || incomingCall?.caller?.username
    || 'User';

  const callerInitial = (callerName || '?')[0].toUpperCase();
  const isVideoCall = currentCall?.type === 'video' || incomingCall?.type === 'video';
  const hasRemote = !!remoteStream;

  // ─── INCOMING CALL ───────────────────────────────────────────────────────
  if (incomingCall) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(180deg, rgba(15,15,26,0.95), rgba(26,26,46,0.98))',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
        }}
      >
        <div style={{ textAlign: 'center', padding: 24, maxWidth: 360 }}>
          {/* Avatar with ring animation */}
          <div style={{
            width: 120, height: 120, borderRadius: '50%',
            margin: '0 auto 28px', position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <motion.div
              animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.15, 0.3] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              style={{
                position: 'absolute', inset: -12, borderRadius: '50%',
                border: '2px solid rgba(99,102,241,0.2)',
              }}
            />
            <motion.div
              animate={{ scale: [1, 1.06, 1], opacity: [0.2, 0.1, 0.2] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut', delay: 0.3 }}
              style={{
                position: 'absolute', inset: -6, borderRadius: '50%',
                border: '2px solid rgba(99,102,241,0.15)',
              }}
            />
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 38, fontWeight: 700,
              boxShadow: '0 8px 32px rgba(99,102,241,0.3)',
            }}>
              {incomingCall.caller?.avatar ? (
                <img src={incomingCall.caller.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : callerInitial}
            </div>
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.01em' }}>{callerName}</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <FiPhoneIncoming size={14} />
            {isVideoCall ? 'Incoming video call…' : 'Incoming voice call…'}
          </p>

          <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={handleReject}
              style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                border: 'none', color: 'white', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, boxShadow: '0 4px 20px rgba(239,68,68,0.3)',
              }}
            >
              <FiPhoneOff size={22} />
              <span style={{ fontSize: 10, fontWeight: 600 }}>Decline</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={handleAccept}
              style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none', color: 'white', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, boxShadow: '0 4px 20px rgba(16,185,129,0.3)',
              }}
            >
              {isVideoCall ? <FiVideo size={22} /> : <FiPhone size={22} />}
              <span style={{ fontSize: 10, fontWeight: 600 }}>Accept</span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ─── CALLING (outgoing) ──────────────────────────────────────────────────
  if (callStatus === 'calling') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(180deg, rgba(15,15,26,0.95), rgba(26,26,46,0.98))',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
        }}
      >
        <div style={{ textAlign: 'center', padding: 24, maxWidth: 360 }}>
          {/* Avatar with ripple animation */}
          <div style={{
            width: 120, height: 120, borderRadius: '50%',
            margin: '0 auto 28px', position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ repeat: Infinity, duration: 2.5, delay: i * 0.4, ease: 'easeOut' }}
                style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: '2px solid rgba(99,102,241,0.15)',
                }}
              />
            ))}
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 38, fontWeight: 700,
              boxShadow: '0 8px 32px rgba(99,102,241,0.3)',
            }}>
              {callerInitial}
            </div>
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>{callerName}</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 32px' }}>
            {isVideoCall ? 'Video calling…' : 'Voice calling…'}
          </p>

          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={handleEndCall}
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              border: 'none', color: 'white', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 2, margin: '0 auto', boxShadow: '0 4px 20px rgba(239,68,68,0.3)',
            }}
          >
            <FiPhoneOff size={22} />
            <span style={{ fontSize: 10, fontWeight: 600 }}>End</span>
          </motion.button>
        </div>
      </motion.div>
    );
  }

  // ─── NO ACTIVE CALL ──────────────────────────────────────────────────────
  if (!currentCall || !callStatus) return null;

  // ─── ACTIVE CALL SCREEN ──────────────────────────────────────────────────
  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 100%)',
      }}
    >
      {/* Hidden remote audio — always rendered so audio-only calls play remote stream */}
      {!isVideoCall && (
        <audio ref={remoteVideoRef} autoPlay playsInline style={{ display: 'none' }} />
      )}

      {/* ─── VIDEO AREA ──────────────────────────────────────────── */}
      {isVideoCall ? (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Remote video */}
          {hasRemote ? (
            <video
              ref={remoteVideoRef}
              autoPlay playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 16,
            }}>
              <div style={{
                width: 100, height: 100, borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 38, fontWeight: 700,
              }}>
                {callerInitial}
              </div>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                Waiting for video…
              </span>
            </div>
          )}

          {/* Local video (PIP) */}
          {localStream && (
            <div style={{
              position: 'absolute', bottom: 100, right: 16,
              width: 140, height: 200, borderRadius: 12,
              overflow: 'hidden', border: '2px solid rgba(255,255,255,0.1)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}>
              <video ref={localVideoRef} autoPlay playsInline muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
        </div>
      ) : (
        /* ─── AUDIO CALL ──────────────────────────────────────────── */
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
          padding: '40px 24px',
        }}>
          {/* Avatar with audio animation */}
          <div style={{
            width: 120, height: 120, borderRadius: '50%',
            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {callStatus === 'connected' && (
              <>
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.05, 0.2] }}
                    transition={{ repeat: Infinity, duration: 2, delay: i * 0.3, ease: 'easeInOut' }}
                    style={{
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      border: '2px solid rgba(99,102,241,0.12)',
                    }}
                  />
                ))}
              </>
            )}
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 38, fontWeight: 700,
              boxShadow: '0 8px 32px rgba(99,102,241,0.3)',
            }}>
              {callerInitial}
            </div>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{callerName}</h2>

          {/* Timer */}
          <div style={{
            fontSize: 36, fontWeight: 300, color: 'var(--text-dark)',
            fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em',
          }}>
            <CallTimer seconds={callDuration} />
          </div>

          {/* Quality */}
          <QualityBadge quality={connectionQuality} />
        </div>
      )}

      {/* ─── CONTROLS BAR ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 24, padding: '20px 24px', paddingBottom: isVideoCall ? 20 : 40,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.3) 0%, transparent 100%)',
      }}>
        {/* Mute */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={toggleMute}
          style={{
            width: 52, height: 52, borderRadius: '50%',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
            background: isMuted
              ? 'linear-gradient(135deg, #ef4444, #dc2626)'
              : 'rgba(255,255,255,0.08)',
            color: isMuted ? 'white' : 'var(--text-dark)',
            transition: 'all 0.2s',
          }}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <FiMicOff size={20} /> : <FiMic size={20} />}
        </motion.button>

        {/* Video toggle (video calls only) */}
        {isVideoCall && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleVideo}
            style={{
              width: 52, height: 52, borderRadius: '50%',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
              background: !isVideoEnabled
                ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                : 'rgba(255,255,255,0.08)',
              color: !isVideoEnabled ? 'white' : 'var(--text-dark)',
              transition: 'all 0.2s',
            }}
            title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {isVideoEnabled ? <FiVideo size={20} /> : <FiVideoOff size={20} />}
          </motion.button>
        )}

        {/* Fullscreen (video calls only) */}
        {isVideoCall && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              if (!document.fullscreenElement) {
                containerRef.current?.requestFullscreen?.();
                setIsFullscreen(true);
              } else {
                document.exitFullscreen?.();
                setIsFullscreen(false);
              }
            }}
            style={{
              width: 52, height: 52, borderRadius: '50%',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
              background: 'rgba(255,255,255,0.08)',
              color: 'var(--text-dark)', transition: 'all 0.2s',
            }}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <FiMinimize size={20} /> : <FiMaximize size={20} />}
          </motion.button>
        )}

        {/* Screen Share */}
        {(isVideoCall || callStatus === 'connected') && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleScreenShare}
            style={{
              width: 52, height: 52, borderRadius: '50%',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
              background: isScreenSharing
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : 'rgba(255,255,255,0.08)',
              color: isScreenSharing ? 'white' : 'var(--text-dark)',
              transition: 'all 0.2s',
            }}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            <FiMonitor size={20} />
          </motion.button>
        )}

        {/* End call */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleEndCall}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: 'white',
            boxShadow: '0 4px 20px rgba(239,68,68,0.3)',
            transition: 'all 0.2s',
          }}
          title="End call"
        >
          <FiPhoneOff size={22} />
        </motion.button>
      </div>

      {/* ─── QUALITY BADGE (video overlay) ──────────────────────────── */}
      {isVideoCall && (
        <div style={{ position: 'absolute', top: 16, left: 16 }}>
          <QualityBadge quality={connectionQuality} />
        </div>
      )}
    </motion.div>
  );
}
