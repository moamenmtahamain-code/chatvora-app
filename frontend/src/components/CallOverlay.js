'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useCallStore } from '../stores/callStore';
import { useAuthStore } from '../stores/authStore';
import socketEvents from '../lib/socket';

// ─── Icons ──────────────────────────────────────────────────────────────────
const PhoneIcon = () => (
  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const PhoneOffIcon = () => (
  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const MicIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

const MicOffIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .87-.16 1.71-.46 2.49"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

const VideoIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polygon points="23 7 16 12 23 17 23 7"/>
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
  </svg>
);

const MonitorIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);

const VolumeIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
);

// ─── CALL OVERLAY COMPONENT ──────────────────────────────────────────────────

export default function CallOverlay() {
  const user = useAuthStore((s) => s.user);
  const {
    currentCall,
    callStatus,
    localStream,
    remoteStream,
    isMuted,
    isVideoEnabled,
    callDuration,
    incomingCall,
    connectionQuality,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    handleSignal,
    startCallTimer,
    stopCallTimer,
    formatDuration,
  } = useCallStore();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const timerStartedRef = useRef(false);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Start timer when connected
  useEffect(() => {
    if (callStatus === 'connected' && !timerStartedRef.current) {
      startCallTimer();
      timerStartedRef.current = true;
    }
    return () => {
      if (timerStartedRef.current) {
        stopCallTimer();
        timerStartedRef.current = false;
      }
    };
  }, [callStatus, startCallTimer, stopCallTimer]);

  // Listen for call signaling events
  useEffect(() => {
    const onAccepted = (data) => {
      if (data?.signal) {
        handleSignal(data.signal);
      }
      useCallStore.setState({ callStatus: 'connected' });
    };

    const onSignal = (data) => {
      if (data?.signal) {
        handleSignal(data.signal);
      }
    };

    const onRejected = () => {
      endCall();
    };

    const onEnded = () => {
      endCall();
    };

    socketEvents.onCallAccepted(onAccepted);
    socketEvents.onCallSignal(onSignal);
    socketEvents.onCallRejected(onRejected);
    socketEvents.onCallEnded(onEnded);

    return () => {
      socketEvents.offCallAccepted(onAccepted);
      socketEvents.offCallSignal(onSignal);
      socketEvents.offCallRejected(onRejected);
      socketEvents.offCallEnded(onEnded);
    };
  }, [handleSignal, endCall]);

  // Listen for incoming calls
  useEffect(() => {
    const onIncoming = (data) => {
      useCallStore.setState({ incomingCall: data });
    };
    socketEvents.onCallIncoming(onIncoming);
    return () => socketEvents.offCallIncoming(onIncoming);
  }, []);

  // No call state - render nothing
  if (!callStatus && !incomingCall) return null;

  // ─── INCOMING CALL ──────────────────────────────────────────────────────
  if (incomingCall && !callStatus) {
    const callerName = incomingCall.caller?.username || incomingCall.caller?.name || 'Unknown';
    const callerAvatar = incomingCall.caller?.profilePicture || incomingCall.caller?.avatar;
    const callerInitial = callerName.charAt(0).toUpperCase();
    const callType = incomingCall.type || 'audio';

    return (
      <div className="call-overlay incoming">
        <div className="incoming-call-content">
          <div className="incoming-call-avatar">
            {callerAvatar ? (
              <img src={callerAvatar} alt={callerName} className="incoming-call-avatar-img" />
            ) : (
              <div className="incoming-call-avatar-fallback">{callerInitial}</div>
            )}
          </div>
          <div className="incoming-call-name">{callerName}</div>
          <div className="incoming-call-status">
            <VolumeIcon /> {callType === 'video' ? 'Video' : 'Audio'} call incoming...
          </div>
          <div className="incoming-call-actions">
            <button className="call-btn decline" onClick={() => rejectCall(incomingCall)} title="Decline">
              <PhoneOffIcon />
              <span className="call-btn-label">Decline</span>
            </button>
            <button className="call-btn accept" onClick={() => acceptCall(incomingCall)} title="Accept">
              <PhoneIcon />
              <span className="call-btn-label">Accept</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── OUTGOING CALL (ringing) ────────────────────────────────────────────
  if (callStatus === 'calling' && currentCall) {
    const receiverName = currentCall.receiverName || 'User';
    const receiverAvatar = currentCall.receiverAvatar;
    const receiverInitial = receiverName.charAt(0).toUpperCase();
    const callType = currentCall.type || 'audio';

    return (
      <div className="call-overlay calling">
        <div className="calling-content">
          <div className="calling-avatar-ring">
            <div className="calling-avatar-pulse" />
            <div className="calling-avatar-inner">
              {receiverAvatar ? (
                <img src={receiverAvatar} alt={receiverName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                receiverInitial
              )}
            </div>
          </div>
          <div className="incoming-call-name">{receiverName}</div>
          <div className="calling-status">Calling{callType === 'video' ? ' (Video)' : ''}...</div>
          <button className="call-btn decline" onClick={endCall} title="Cancel" style={{ width: 64, height: 64 }}>
            <PhoneOffIcon />
          </button>
        </div>
      </div>
    );
  }

  // ─── ACTIVE CALL ────────────────────────────────────────────────────────
  if (callStatus === 'connected' && currentCall) {
    const isVideo = currentCall.type === 'video';
    const otherName = currentCall.caller === 'current-user'
      ? (currentCall.receiverName || 'User')
      : (currentCall.caller?.username || currentCall.caller?.name || 'User');
    const otherAvatar = currentCall.caller === 'current-user'
      ? currentCall.receiverAvatar
      : (currentCall.caller?.profilePicture || currentCall.caller?.avatar);
    const otherInitial = otherName.charAt(0).toUpperCase();

    return (
      <div className={`call-overlay active${isVideo ? ' video-active' : ''}`}>
        {/* Remote video (full screen for video calls) */}
        {isVideo && (
          <div className="remote-video-container">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="remote-video-feed"
            />
            {!remoteStream && (
              <div className="remote-waiting">
                <div className="remote-waiting-avatar">{otherInitial}</div>
                <div className="remote-waiting-text">Connecting video...</div>
              </div>
            )}
          </div>
        )}

        {/* Audio call avatar */}
        {!isVideo && (
          <div className="audio-call-content">
            <div className="audio-call-avatar-section">
              <div className="audio-call-avatar-ring">
                <div className="audio-call-avatar-inner">
                  {otherAvatar ? (
                    <img src={otherAvatar} alt={otherName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : (
                    otherInitial
                  )}
                </div>
              </div>
              <div className="audio-call-name">{otherName}</div>
              <div className="audio-call-duration">
                {formatDuration(callDuration)}
                {connectionQuality === 'poor' && ' • Poor connection'}
              </div>
            </div>
          </div>
        )}

        {/* Local video PIP */}
        {isVideo && (
          <div className="local-video-pip">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
            />
          </div>
        )}

        {/* Call duration bar for video */}
        {isVideo && (
          <div style={{ position: 'absolute', top: 60, left: 0, right: 0, textAlign: 'center', zIndex: 15 }}>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 500 }}>
              {formatDuration(callDuration)}
            </span>
          </div>
        )}

        {/* Controls */}
        <div className="call-controls-bar">
          <button
            className={`ctrl-btn${isMuted ? ' active' : ''}`}
            onClick={toggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOffIcon /> : <MicIcon />}
            <span className="ctrl-label">{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          {isVideo && (
            <button
              className={`ctrl-btn${isVideoEnabled ? '' : ' active'}`}
              onClick={toggleVideo}
              title={isVideoEnabled ? 'Stop Video' : 'Start Video'}
            >
              <VideoIcon />
              <span className="ctrl-label">Video</span>
            </button>
          )}

          {isVideo && (
            <button
              className="ctrl-btn"
              onClick={toggleScreenShare}
              title="Share Screen"
            >
              <MonitorIcon />
              <span className="ctrl-label">Share</span>
            </button>
          )}

          <button className="ctrl-btn end-call" onClick={endCall} title="End Call">
            <PhoneOffIcon />
            <span className="ctrl-label">End</span>
          </button>
        </div>
      </div>
    );
  }

  // Failed state
  if (callStatus === 'failed') {
    return (
      <div className="call-overlay calling">
        <div className="calling-content">
          <div className="incoming-call-name">Call Failed</div>
          <div className="calling-status">Connection could not be established</div>
          <button className="call-btn decline" onClick={endCall} style={{ width: 64, height: 64 }}>
            <PhoneOffIcon />
          </button>
        </div>
      </div>
    );
  }

  return null;
}