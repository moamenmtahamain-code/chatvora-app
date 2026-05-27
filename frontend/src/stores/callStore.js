import { create } from 'zustand';
import socketEvents from '../lib/socket';
import {
  createPeerConnection,
  getLocalStream,
  stopStream,
  closePeerConnection,
  createQualityMonitor,
  attachStream,
} from '../lib/webrtc';

export const useCallStore = create((set, get) => ({
  currentCall: null,
  callStatus: null,
  localStream: null,
  remoteStream: null,
  remoteStreams: {},
  peers: {},
  roomId: null,
  callType: null,
  peerConnection: null,
  isMuted: false,
  isVideoEnabled: true,
  isScreenSharing: false,
  callDuration: 0,
  connectionQuality: 'good',
  incomingCall: null,
  _qualityMonitor: null,

  initiateCall: async (receiverId, type = 'audio', conversationId = null, isGroup = false) => {
    try {
      const stream = await getLocalStream(true, type === 'video');
      const pc = createPeerConnection();
      const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        set({ remoteStream: event.streams[0] });
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketEvents.sendCallSignal(receiverId, {
            type: 'candidate',
            candidate: event.candidate,
          }, callId);
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === 'failed') {
          set({ connectionQuality: 'poor' });
          pc.restartIce?.().then(offer => {
            if (offer) {
              socketEvents.sendCallSignal(receiverId, offer, callId);
            }
          });
        } else if (state === 'connected') {
          set({ connectionQuality: 'good' });
        } else if (state === 'disconnected') {
          set({ connectionQuality: 'poor' });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          set({ callStatus: 'failed', connectionQuality: 'lost' });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      set({
        currentCall: { callId, receiverId, type, conversationId, isGroup, caller: 'current-user' },
        callStatus: 'calling',
        localStream: stream,
        peerConnection: pc,
        isMuted: false,
        isVideoEnabled: type === 'video',
        callDuration: 0,
        connectionQuality: 'good',
      });

      socketEvents.initiateCall({ receiverId, type, conversationId, isGroup, callId, signal: offer });

      // Start quality monitoring
      const monitor = createQualityMonitor(pc, (q) => set({ connectionQuality: q }));
      set({ _qualityMonitor: monitor });
      monitor.start();

      return callId;
    } catch (error) {
      console.error('Error initiating call:', error);
      set({ callStatus: 'failed' });
      return null;
    }
  },

  acceptCall: async (callData) => {
    try {
      const stream = await getLocalStream(true, callData.type === 'video');
      const pc = createPeerConnection();

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        set({ remoteStream: event.streams[0] });
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketEvents.sendCallSignal(callData.caller._id, {
            type: 'candidate',
            candidate: event.candidate,
          }, callData.callId);
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected') {
          set({ connectionQuality: 'good' });
        }
      };

      if (callData.signal) {
        await pc.setRemoteDescription(new RTCSessionDescription(callData.signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketEvents.sendCallSignal(callData.caller._id, answer, callData.callId);
      }

      set({
        currentCall: {
          callId: callData.callId,
          caller: callData.caller,
          type: callData.type,
          conversationId: callData.conversationId,
          isGroup: callData.isGroup,
        },
        callStatus: 'connected',
        localStream: stream,
        peerConnection: pc,
        isMuted: false,
        isVideoEnabled: callData.type === 'video',
        callDuration: 0,
        connectionQuality: 'good',
      });

      // Start quality monitoring
      const monitor = createQualityMonitor(pc, (q) => set({ connectionQuality: q }));
      set({ _qualityMonitor: monitor });
      monitor.start();

      socketEvents.acceptCall(callData.caller._id, callData.callId);
      return true;
    } catch (error) {
      console.error('Error accepting call:', error);
      return false;
    }
  },

  rejectCall: (callData) => {
    if (callData?.caller?._id) {
      socketEvents.rejectCall(callData.caller._id, callData.callId);
    }
    set({ currentCall: null, callStatus: null, incomingCall: null });
  },

  endCall: () => {
    const { currentCall, localStream, peerConnection, _qualityMonitor } = get();

    _qualityMonitor?.stop();

    if (peerConnection) {
      closePeerConnection(peerConnection);
    }

    if (localStream) {
      stopStream(localStream);
    }

    if (currentCall) {
      const targetId = currentCall.caller === 'current-user'
        ? currentCall.receiverId
        : currentCall.caller?._id;
      socketEvents.endCall(targetId ? [targetId] : [], currentCall.callId);
    }

    set({
      currentCall: null,
      callStatus: null,
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      isMuted: false,
      isVideoEnabled: true,
      isScreenSharing: false,
      callDuration: 0,
      connectionQuality: 'good',
      _qualityMonitor: null,
      incomingCall: null,
    });
  },

  toggleMute: () => {
    const { localStream, isMuted } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      set({ isMuted: !isMuted });
    }
  },

  toggleVideo: () => {
    const { localStream, isVideoEnabled } = get();
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoEnabled;
      });
      set({ isVideoEnabled: !isVideoEnabled });
    }
  },

  toggleScreenShare: async () => {
    const { isScreenSharing, localStream, peerConnection } = get();

    if (isScreenSharing) {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = newStream.getVideoTracks()[0];
      const sender = peerConnection.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(videoTrack);
      localStream.getVideoTracks().forEach((track) => track.stop());
      localStream.addTrack(videoTrack);
      set({ localStream: newStream, isScreenSharing: false });
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnection.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(screenTrack);
        screenTrack.onended = () => { get().toggleScreenShare(); };
        set({ localStream: screenStream, isScreenSharing: true });
      } catch (error) {
        console.error('Error sharing screen:', error);
      }
    }
  },

  handleSignal: async (signal) => {
    const { peerConnection } = get();
    if (!peerConnection) return;

    try {
      if (signal.type === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        return answer;
      } else if (signal.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.type === 'candidate') {
        if (signal.candidate) {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (_) {}
        }
      }
    } catch (err) {
      console.error('[callStore] handleSignal error:', err);
    }
  },

  // ─── ROOM/GROUP CALLS (unchanged from original) ──────────────────────────

  _roomSignalHandler: null,
  _roomParticipantLeftHandler: null,

  createPeerConnectionFor: (peerId) => {
    const { localStream } = get();
    if (!peerId) return null;
    if (get().peers[peerId]) return get().peers[peerId];

    const pc = createPeerConnection();

    pc.ontrack = (event) => {
      set(state => ({
        remoteStreams: { ...state.remoteStreams, [peerId]: event.streams[0] },
      }));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const roomId = get().roomId;
        if (roomId) {
          socketEvents.sendRoomSignal(roomId, peerId, {
            type: 'candidate',
            candidate: event.candidate,
          }, get().currentCall?.callId);
        }
      }
    };

    if (localStream) {
      try {
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
      } catch (_) {}
    }

    set(state => ({ peers: { ...state.peers, [peerId]: pc } }));
    return pc;
  },

  handleRoomSignal: async (data) => {
    try {
      const { from, signal, callId } = data;
      if (!from || !signal) return;

      let pc = get().peers[from];

      if (signal.type === 'offer') {
        pc = get().createPeerConnectionFor(from);
        const localStream = get().localStream;
        if (localStream) {
          localStream.getTracks().forEach((track) => {
            try { pc.addTrack(track, localStream); } catch (_) {}
          });
        }
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketEvents.sendRoomSignal(get().roomId, from, answer, callId);
      } else if (signal.type === 'answer') {
        pc = get().peers[from];
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.type === 'candidate') {
        pc = get().peers[from];
        if (pc) {
          try { await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)); } catch (_) {}
        }
      }
    } catch (err) {
      console.error('[callStore] handleRoomSignal error:', err);
    }
  },

  joinRoom: async (roomId, type = 'audio') => {
    try {
      if (get().roomId === roomId) return true;

      const stream = await getLocalStream(true, type === 'video');
      set({ localStream: stream, callType: type, roomId, callStatus: 'connected', currentCall: { roomId, type } });

      if (!get()._roomSignalHandler) {
        const handler = (data) => { get().handleRoomSignal(data); };
        set({ _roomSignalHandler: handler });
        socketEvents.onRoomSignal(handler);
      }

      if (!get()._roomParticipantLeftHandler) {
        const handler = (data) => {
          const { userId } = data || {};
          if (userId) {
            const pc = get().peers[userId];
            if (pc) pc.close();
            set(state => {
              const { [userId]: _, ...rest } = state.peers;
              const { [userId]: __, ...restStreams } = state.remoteStreams;
              return { peers: rest, remoteStreams: restStreams };
            });
          }
        };
        set({ _roomParticipantLeftHandler: handler });
        socketEvents.onRoomParticipantLeft(handler);
      }

      socketEvents.joinRoom(roomId, async (res) => {
        const participants = res?.participants || [];
        for (const p of participants) {
          const peerId = p._id || p.userId || p.id;
          if (!peerId) continue;
          const pc = get().createPeerConnectionFor(peerId);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketEvents.sendRoomSignal(roomId, peerId, offer, get().currentCall?.callId);
          } catch (err) {
            console.error('Error creating offer for participant', peerId, err);
          }
        }
      });

      return true;
    } catch (error) {
      console.error('[callStore] joinRoom error:', error);
      return false;
    }
  },

  leaveRoom: () => {
    const { roomId, peers, localStream } = get();
    if (roomId) socketEvents.leaveRoom(roomId);
    Object.values(peers || {}).forEach(pc => { try { pc.close(); } catch (_) {} });
    if (localStream) { try { localStream.getTracks().forEach(t => t.stop()); } catch (_) {} }

    const sig = get()._roomSignalHandler;
    if (sig) { socketEvents.offRoomSignal(sig); set({ _roomSignalHandler: null }); }
    const left = get()._roomParticipantLeftHandler;
    if (left) { socketEvents.offRoomParticipantLeft(left); set({ _roomParticipantLeftHandler: null }); }

    set({ peers: {}, remoteStreams: {}, localStream: null, roomId: null, currentCall: null, callStatus: null, callType: null, connectionQuality: 'good' });
  },

  startCallTimer: () => {
    const interval = setInterval(() => {
      set((state) => ({ callDuration: state.callDuration + 1 }));
    }, 1000);
    set({ callTimer: interval });
  },

  stopCallTimer: () => {
    const { callTimer } = get();
    if (callTimer) clearInterval(callTimer);
  },

  formatDuration: (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },
}));

export default useCallStore;
