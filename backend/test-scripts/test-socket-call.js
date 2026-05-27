const io = require('socket.io-client');
const fetch = global.fetch || require('node-fetch');
const API = 'http://localhost:5000/api';

const unique = Date.now();

async function register(email, username) {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: '123456', username })
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Register failed: ' + JSON.stringify(data));
  return data;
}

async function login(email) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: '123456' })
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Login failed: ' + JSON.stringify(data));
  return data;
}

async function main() {
  const e1 = `calltest_caller_${unique}@example.com`;
  const e2 = `calltest_receiver_${unique}@example.com`;
  console.log('Registering users', e1, e2);
  try {
    await register(e1, 'caller' + unique);
  } catch (e) {
    console.log('register caller error', e.toString());
  }
  try {
    await register(e2, 'receiver' + unique);
  } catch (e) {
    console.log('register receiver error', e.toString());
  }

  const login1 = await login(e1);
  const login2 = await login(e2);
  const token1 = login1.accessToken;
  const token2 = login2.accessToken;
  const user1 = login1.user;
  const user2 = login2.user;
  console.log('Users logged in', user1._id, user2._id);

  const socket1 = io('http://localhost:5000', { auth: { token: token1 }, transports: ['websocket', 'polling'] });
  const socket2 = io('http://localhost:5000', { auth: { token: token2 }, transports: ['websocket', 'polling'] });

  socket1.on('connect', () => console.log('socket1 connected', socket1.id));
  socket2.on('connect', () => console.log('socket2 connected', socket2.id));

  socket2.on('call:incoming', (data) => console.log('socket2 call:incoming', data));
  socket2.on('call:signal', (data) => {
    console.log('socket2 call:signal', data);
    if (data.signal && data.signal.type === 'offer') {
      const answer = { type: 'answer', sdp: 'dummy-answer-sdp' };
      console.log('socket2 sending answer via call:signal to', data.from);
      socket2.emit('call:signal', { targetUserId: data.from, signal: answer, callId: data.callId });
    }
  });

  socket1.on('call:accepted', (data) => console.log('socket1 call:accepted', data));
  socket1.on('call:signal', (data) => console.log('socket1 call:signal', data));

  await new Promise((res) => setTimeout(res, 1500));
  const callId = `testcall-${Date.now()}`;
  console.log('socket1 initiating call to', user2._id);
  socket1.emit('call:initiate', { receiverId: user2._id, type: 'audio', callId, conversationId: null, signal: { type: 'offer', sdp: 'dummy-offer-sdp' } });

  await new Promise((res) => setTimeout(res, 3000));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
