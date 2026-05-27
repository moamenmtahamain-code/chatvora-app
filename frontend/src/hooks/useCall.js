'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import socketEvents from '../lib/socket';
import {
  createPeerConnection,
  getLocalStream,
  stopStream,
  closePeerConnection,
  attachStream,
  createQualityMonitor,
} from '../lib/webrtc';

// ─── STATES ────────────────────────────────────────────────────────────────

const CALL_STATUS = {
  IDLE: null,
  CALLING: 'calling',
  RINGING: 'ringing',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ENDED: 'ended',
  REJECTED: 'rejected',
  FAILED: 'failed',
};

// ─── HOOK ──────────────────────────────────────────────────────────────────

export default function useCall() {
  const [callStatus, setCallStatus] = useState(CALL_STATUS.IDLE);
  const [currentCall, setCurrentCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState('good');
  const [incomingCall, setIncomingCall] = useState(null);

  const pcRef = useRef(null);
  const qualityMonitorRef = useRef(null);
  const timerRef = useRef(null);
  const callIdRef = useRef(null);
  const receiverIdRef = useRef(null);

  // ─── TIMER ───────────────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    stopTimer();
    setCallDuration(0);
    timerRef.current = setInterval(() => {
      setCallDuration(d => d + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const formatDuration = useCallback((seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, []);

  // ─── CLEANUP ─────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    qualityMonitorRef.current?.stop();
    qualityMonitorRef.current = null;
    closePeerConnection(pcRef.current);
    pcRef.current = null;
    stopStream(localStream);
    stopStream(remoteStream);
    stopTimer();

    setLocalStream(null);
    setRemoteStream(null);
    setCallDuration(0);
    setConnectionQuality('good');
  }, [localStream, remoteStream, stopTimer]);

  // ─── START CALL (outgoing) ───────────────────────────────────────────────

  const startCall = useCallback(async (receiverId, type = 'audio', conversationId = null) => {
    try {
      // Clean up any previous call state
      cleanup();

      const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      callIdRef.current = callId;
      receiverIdRef.current = receiverId;

      // Request mic/camera
      const stream = await getLocalStream(true, type === 'video');
      setLocalStream(stream);
      setIsMuted(false);
      setIsVideoEnabled(type === 'video');

      // Create peer connection
      const pc = createPeerConnection();
      pcRef.current = pc;

      // Add local tracks
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Handle remote track
      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && receiverId) {
          socketEvents.sendCallSignal(receiverId, {
            type: 'candidate',
            candidate: event.candidate,
          }, callId);
        }
      };

      // Monitor ICE connection state
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === 'disconnected' || state === 'failed') {
          setConnectionQuality('poor');
          // Auto ICE restart
          if (state === 'failed') {
            pc.restartIce?.().then(offer => {
              if (offer && receiverId) {
                socketEvents.sendCallSignal(receiverId, offer, callId);
              }
            });
          }
        } else if (state === 'connected') {
          setConnectionQuality('good');
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'failed') {
          setCallStatus(CALL_STATUS.FAILED);
          cleanup();
        }
      };

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      setCallStatus(CALL_STATUS.CALLING);
      setCurrentCall({ callId, receiverId, type, conversationId, isGroup: false });

      socketEvents.initiateCall({ receiverId, type, conversationId, callId, signal: offer });

      return callId;
    } catch (err) {
      console.error('[useCall] startCall error:', err);
      setCallStatus(CALL_STATUS.FAILED);
      cleanup();
      return null;
    }
  }, [cleanup]);

  // ─── ACCEPT CALL (incoming) ──────────────────────────────────────────────

  const acceptCall = useCallback(async (callData) => {
    try {
      cleanup();

      const stream = await getLocalStream(true, callData.type === 'video');
      setLocalStream(stream);
      setIsMuted(false);
      setIsVideoEnabled(callData.type === 'video');

      const pc = createPeerConnection();
      pcRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const callerId = callData.caller?._id;
          if (callerId) {
            socketEvents.sendCallSignal(callerId, {
              type: 'candidate',
              candidate: event.candidate,
            }, callData.callId);
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected') {
          setConnectionQuality('good');
        }
      };

      // Handle incoming offer
      if (callData.signal) {
        await pc.setRemoteDescription(new RTCSessionDescription(callData.signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const callerId = callData.caller?._id;
        if (callerId) {
          socketEvents.sendCallSignal(callerId, answer, callData.callId);
        }
      }

      setCallStatus(CALL_STATUS.CONNECTED);
      setCurrentCall(callData);
      callIdRef.current = callData.callId;
      startTimer();

      // Start quality monitoring
      const monitor = createQualityMonitor(pc, setConnectionQuality);
      qualityMonitorRef.current = monitor;
      monitor.start();

      socketEvents.acceptCall(callData.caller?._id, callData.callId);

      return true;
    } catch (err) {
      console.error('[useCall] acceptCall error:', err);
      setCallStatus(CALL_STATUS.FAILED);
      cleanup();
      return false;
    }
  }, [cleanup, startTimer]);

  // ─── REJECT CALL ─────────────────────────────────────────────────────────

  const rejectCall = useCallback((callData) => {
    if (callData?.caller?._id) {
      socketEvents.rejectCall(callData.caller._id, callData.callId);
    }
    setCallStatus(CALL_STATUS.IDLE);
    setCurrentCall(null);
    setIncomingCall(null);
    cleanup();
  }, [cleanup]);

  // ─── END CALL ────────────────────────────────────────────────────────────

  const endCall = useCallback(() => {
    const receiverId = receiverIdRef.current || currentCall?.receiverId || currentCall?.caller?._id;
    const callId = callIdRef.current || currentCall?.callId;

    if (callId) {
      socketEvents.endCall(receiverId ? [receiverId] : [], callId);
    }

    setCallStatus(CALL_STATUS.ENDED);
    setCurrentCall(null);
    setIncomingCall(null);
    cleanup();

    // Reset status after a brief moment
    setTimeout(() => setCallStatus(CALL_STATUS.IDLE), 500);
  }, [currentCall, cleanup]);

  // ─── TOGGLE MUTE ─────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = track.enabled === false;
      });
      setIsMuted(m => !m);
    }
  }, [localStream]);

  // ─── TOGGLE VIDEO ────────────────────────────────────────────────────────

  const toggleVideo = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = track.enabled === false;
      });
      setIsVideoEnabled(v => !v);
    }
  }, [localStream]);

  // ─── SOCKET LISTENERS ────────────────────────────────────────────────────

  useEffect(() => {
    const onIncoming = (data) => {
      setIncomingCall(data);
      setCallStatus(CALL_STATUS.RINGING);
      setCurrentCall(data);
      callIdRef.current = data.callId;
    };

    const onAccepted = () => {
      setCallStatus(CALL_STATUS.CONNECTED);
      startTimer();

      // Start quality monitoring on the existing PC
      if (pcRef.current) {
        const monitor = createQualityMonitor(pcRef.current, setConnectionQuality);
        qualityMonitorRef.current = monitor;
        monitor.start();
      }
    };

    const onRejected = () => {
      setCallStatus(CALL_STATUS.REJECTED);
      cleanup();
      setTimeout(() => setCallStatus(CALL_STATUS.IDLE), 1000);
    };

    const onEnded = () => {
      setCallStatus(CALL_STATUS.ENDED);
      setIncomingCall(null);
      cleanup();
      setTimeout(() => setCallStatus(CALL_STATUS.IDLE), 500);
    };

    const onSignal = async (data) => {
      if (!data.signal) return;
      const pc = pcRef.current;
      if (!pc) return;

      try {
        const signal = data.signal;

        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (data.from) {
            socketEvents.sendCallSignal(data.from, answer, data.callId);
          }
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
        } else if (signal.type === 'candidate') {
          if (signal.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (err) {
              console.warn('[useCall] ICE candidate rejected (likely stale):', err.message);
            }
          }
        }
      } catch (err) {
        console.error('[useCall] Signal handling error:', err);
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
    };
  }, [startTimer, cleanup]);

  // ─── CLEANUP ON UNMOUNT ──────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    // State
    callStatus,
    currentCall,
    localStream,
    remoteStream,
    isMuted,
    isVideoEnabled,
    callDuration,
    connectionQuality,
    incomingCall,
    CALL_STATUS,

    // Actions
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    formatDuration,
    setIncomingCall,
  };
}

export { CALL_STATUS };
