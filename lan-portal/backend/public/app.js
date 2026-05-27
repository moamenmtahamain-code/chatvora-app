// WebRTC + signaling app
(function(){
  const socket = io();
  const joinBtn = document.getElementById('join');
  const nameInput = document.getElementById('name');
  const usersList = document.getElementById('users-list');
  const messages = document.getElementById('messages');
  const sendBtn = document.getElementById('send');
  const msgInput = document.getElementById('message-input');
  const qrImg = document.getElementById('qr');
  const lanInfo = document.getElementById('lan-info');
  const lanUrlEl = document.getElementById('lan-url');

  // call UI elements
  const callOverlay = document.getElementById('call-overlay');
  const incoming = document.getElementById('incoming');
  const incomingFrom = document.getElementById('incoming-from');
  const acceptCallBtn = document.getElementById('acceptCall');
  const rejectCallBtn = document.getElementById('rejectCall');
  const remoteVideo = document.getElementById('remoteVideo');
  const localVideo = document.getElementById('localVideo');
  const toggleMicBtn = document.getElementById('toggleMic');
  const toggleCamBtn = document.getElementById('toggleCam');
  const endCallBtn = document.getElementById('endCall');

  let me = null;
  let localStream = null;
  let pc = null;
  let currentCall = null; // { id, peerId, initiator }

  const ICE_SERVERS = { iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ] };

  // fetch LAN URL + QR
  fetch('/api/qr').then(r=>r.json()).then(data=>{
    if (data.dataUrl) qrImg.src = data.dataUrl;
    if (data.url) {
      lanInfo.textContent = 'Open on this network:';
      lanUrlEl.textContent = data.url;
      lanUrlEl.href = data.url;
    }
  }).catch(()=>{
    lanInfo.textContent = 'Open this page on devices using this host address.';
  });

  function log(...args){ console.log('[app]',...args); }

  function renderUsers(list){
    usersList.innerHTML = '';
    (list||[]).forEach(u=>{
      const li = document.createElement('li');
      li.className = 'user-item';
      const name = document.createElement('span'); name.textContent = u.name || u.id;
      li.appendChild(name);

      if (u.id !== (me && me.id)){
        const callBtn = document.createElement('button');
        callBtn.textContent = 'Call';
        callBtn.onclick = ()=> startCall(u.id);
        li.appendChild(callBtn);
      } else {
        const you = document.createElement('em'); you.textContent = ' (you)'; li.appendChild(you);
      }

      usersList.appendChild(li);
    });
  }

  function addMessage(m){
    const div = document.createElement('div');
    div.className = 'msg';
    const who = document.createElement('div'); who.className='who'; who.textContent = m.user.name || m.user.id;
    const text = document.createElement('div'); text.className='text'; text.textContent = m.text;
    div.appendChild(who); div.appendChild(text);
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  joinBtn.addEventListener('click', ()=>{
    const name = nameInput.value.trim();
    socket.emit('join', { name });
  });

  sendBtn.addEventListener('click', ()=>{
    const text = msgInput.value.trim(); if (!text) return;
    socket.emit('message', { text });
    msgInput.value = '';
  });

  // call helpers
  function showIncoming(fromUser, callId, fromId){
    incomingFrom.textContent = `${fromUser.name || 'Caller'} is calling...`;
    incoming.classList.remove('hidden');
    // play ringtone using WebAudio
    startRingtone();
    // accept/reject handled by event listeners
  }

  function showCallOverlay(){
    callOverlay.classList.remove('hidden');
  }

  function hideCallOverlay(){
    callOverlay.classList.add('hidden');
    if (remoteVideo.srcObject) remoteVideo.srcObject = null;
    if (localVideo.srcObject) localVideo.srcObject = null;
  }

  let ringtoneOsc = null;
  function startRingtone(){
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 440; g.gain.value = 0.05;
      o.connect(g); g.connect(ctx.destination); o.start();
      ringtoneOsc = { ctx, o, g };
    }catch(e){console.warn('ringtone failed',e)}
  }
  function stopRingtone(){ if (ringtoneOsc){ try{ ringtoneOsc.o.stop(); ringtoneOsc.g.disconnect(); }catch(e){} ringtoneOsc=null;} }

  async function startCall(targetId){
    if (!targetId) return;
    const callId = `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
    currentCall = { id: callId, peerId: targetId, initiator: true };

    try{
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localVideo.srcObject = localStream;
    } catch(err){ alert('Microphone/camera access required to make calls.'); console.error(err); return; }

    pc = new RTCPeerConnection(ICE_SERVERS);
    pc.ontrack = (e)=>{ remoteVideo.srcObject = e.streams[0]; }
    pc.onicecandidate = (event)=>{ if (event.candidate){ socket.emit('call:candidate', { to: targetId, candidate: event.candidate, callId }); } };
    localStream.getTracks().forEach(t=>pc.addTrack(t, localStream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('call:offer', { to: targetId, offer: pc.localDescription, callId });

    showCallOverlay();
    setupCallControls();
  }



  function setupCallControls(){
    toggleMicBtn.onclick = ()=>{
      if (!localStream) return;
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length) {
        audioTracks[0].enabled = !audioTracks[0].enabled;
        toggleMicBtn.textContent = audioTracks[0].enabled ? 'Mute' : 'Unmute';
      }
    };
    toggleCamBtn.onclick = ()=>{
      if (!localStream) return;
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length) {
        videoTracks[0].enabled = !videoTracks[0].enabled;
        toggleCamBtn.textContent = videoTracks[0].enabled ? 'Cam' : 'Cam Off';
      }
    };
    endCallBtn.onclick = ()=>{
      if (!currentCall) return;
      socket.emit('call:hangup', { to: currentCall.peerId, callId: currentCall.id });
      cleanupCall();
    };
  }

  function cleanupCall(){
    try{ if (pc) pc.close(); }catch(e){}
    pc = null; currentCall = null;
    try{ if (localStream) localStream.getTracks().forEach(t=>t.stop()); }catch(e){}
    localStream = null;
    hideCallOverlay();
  }

  // socket handlers
  socket.on('joined', (data) => { me = data.user; renderUsers(data.users); });
  socket.on('presence', (list) => { renderUsers(list); });
  socket.on('message', (m) => { addMessage(m); });
  socket.on('notification', (n) => { if (n.type==='join') addMessage({ user:{name:'System'}, text:`${n.user.name} joined.`}); if (n.type==='leave') addMessage({ user:{name:'System'}, text:`${n.user.name} left.`}); });

  // incoming call offer
  socket.on('call:incoming', async (data) => {
    const { from, fromUser, offer, callId } = data || {};
    log('call incoming from', from, fromUser);
    // store offer in a temp place and show UI
    // create temp handler that will set remote when accept is clicked
    // Save the offer on window so acceptCall can find it
    window.__incomingOffer = { from, offer, callId };
    showIncoming(fromUser || { name: 'Caller' }, callId, from);
    // Also set remote description if user auto-accepts later (acceptCall will handle)
    // If user accepts, acceptCall will create RTCPeerConnection and then call setRemoteDescription
    // If the user declines, a hangup will be emitted by the reject button
  });

  socket.on('call:answer', async (data) => {
    const { from, answer, callId } = data || {};
    log('call:answer', from, callId);
    if (!pc) return;
    try{ await pc.setRemoteDescription(new RTCSessionDescription(answer)); }catch(e){ console.error('setRemoteDescription(answer) failed', e); }
  });

  socket.on('call:candidate', async (data) => {
    const { from, candidate, callId } = data || {};
    if (!candidate) return;
    try{
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }catch(e){ console.warn('addIceCandidate failed', e); }
  });

  socket.on('call:hangup', (data) => {
    const { from, callId } = data || {};
    log('call:hangup from', from);
    cleanupCall();
  });

  // When we accept an incoming call, set remote description and respond with answer
  // We handle the offer stored on window.__incomingOffer
  

  // Handle accept click which now needs to set remote description and send answer
  acceptCallBtn.addEventListener('click', async () => {
    const info = window.__incomingOffer; if (!info) return;
    const { from, offer, callId } = info;
    incoming.classList.add('hidden'); stopRingtone();
    // create peerconnection and set remote
    pc = new RTCPeerConnection(ICE_SERVERS);
    pc.ontrack = (e)=>{ remoteVideo.srcObject = e.streams[0]; }
    pc.onicecandidate = (event)=>{ if (event.candidate){ socket.emit('call:candidate', { to: from, candidate: event.candidate, callId }); } };

    try{
      localStream = await navigator.mediaDevices.getUserMedia({ audio:true, video:true });
      localVideo.srcObject = localStream; localStream.getTracks().forEach(t=>pc.addTrack(t, localStream));
    }catch(err){ alert('Microphone/camera access required'); socket.emit('call:hangup', { to: from, callId }); return; }

    try{
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('call:answer', { to: from, answer: pc.localDescription, callId });
      currentCall = { id: callId, peerId: from, initiator:false };
      showCallOverlay(); setupCallControls();
    }catch(e){ console.error('acceptCall error', e); }
    window.__incomingOffer = null;
  });

  // if reject button clicked
  rejectCallBtn.addEventListener('click', ()=>{ const info = window.__incomingOffer; if (!info) return; socket.emit('call:hangup', { to: info.from, callId: info.callId }); stopRingtone(); incoming.classList.add('hidden'); window.__incomingOffer=null; });

  // handle case where the incoming offer was delivered earlier and user clicks accept via acceptCallBtn handler above

  // remote offer may arrive before user accepts; ensure we store it when 'call:incoming' fires
  

  socket.on('typing', (data) => { /* optional */ });
})();
