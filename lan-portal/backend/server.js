require('dotenv').config();
const express = require('express');
const http = require('http');
const os = require('os');
const path = require('path');
const qrcode = require('qrcode');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

function getLocalIPs() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results;
}

app.get('/api/lan', (req, res) => {
  const ips = getLocalIPs();
  const urls = ips.map(ip => `http://${ip}:${PORT}`);
  res.json({ ips, urls });
});

app.get('/api/qr', async (req, res) => {
  try {
    const ips = getLocalIPs();
    const target = ips[0] || '127.0.0.1';
    const url = `http://${target}:${PORT}`;
    const dataUrl = await qrcode.toDataURL(url);
    res.json({ url, dataUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// fallback for SPA / static files
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const users = new Map(); // socketId -> { id, name, avatar }

io.on('connection', (socket) => {
  console.log('Client connected', socket.id);

  socket.on('join', (payload) => {
    const name = (payload && payload.name) ? payload.name : `Guest-${socket.id.slice(0,5)}`;
    const avatar = payload && payload.avatar ? payload.avatar : '';
    const user = { id: socket.id, name, avatar };
    users.set(socket.id, user);

    // send joined confirmation
    socket.emit('joined', { user, users: Array.from(users.values()) });

    // broadcast presence
    io.emit('presence', Array.from(users.values()));
    socket.broadcast.emit('notification', { type: 'join', user });
  });

  socket.on('message', (msg) => {
    const user = users.get(socket.id) || { id: socket.id, name: 'Guest' };
    const payload = { id: socket.id, user, text: msg.text, ts: Date.now() };
    io.emit('message', payload);
  });

  socket.on('typing', (isTyping) => {
    const user = users.get(socket.id) || { id: socket.id, name: 'Guest' };
    socket.broadcast.emit('typing', { user, typing: !!isTyping });
  });

  // WebRTC signaling relay
  socket.on('call:offer', (data) => {
    try {
      const { to, offer, callId } = data || {};
      if (!to) return;
      const fromUser = users.get(socket.id) || { id: socket.id, name: 'Guest' };
      io.to(to).emit('call:incoming', { from: socket.id, fromUser, offer, callId });
    } catch (err) {
      console.error('call:offer error', err);
    }
  });

  socket.on('call:answer', (data) => {
    try {
      const { to, answer, callId } = data || {};
      if (!to) return;
      io.to(to).emit('call:answer', { from: socket.id, answer, callId });
    } catch (err) {
      console.error('call:answer error', err);
    }
  });

  socket.on('call:candidate', (data) => {
    try {
      const { to, candidate, callId } = data || {};
      if (!to) return;
      io.to(to).emit('call:candidate', { from: socket.id, candidate, callId });
    } catch (err) {
      console.error('call:candidate error', err);
    }
  });

  socket.on('call:hangup', (data) => {
    try {
      const { to, callId } = data || {};
      if (!to) return;
      io.to(to).emit('call:hangup', { from: socket.id, callId });
    } catch (err) {
      console.error('call:hangup error', err);
    }
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      io.emit('presence', Array.from(users.values()));
      socket.broadcast.emit('notification', { type: 'leave', user });
      console.log('Client disconnected', socket.id);
    }
  });
});

// attempt to advertise on mDNS/Bonjour if available
try {
  const bonjour = require('bonjour')();
  bonjour.publish({ name: 'LAN Portal', type: 'http', port: PORT });
  console.log('mDNS: Bonjour service published (LAN Portal)');
} catch (err) {
  console.log('mDNS: bonjour not available or failed to publish (optional)');
}

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  console.log('\nLAN Portal listening on:');
  if (ips.length === 0) console.log(` - http://localhost:${PORT}`);
  ips.forEach(ip => console.log(` - http://${ip}:${PORT}`));
  console.log(`QR endpoint: http://localhost:${PORT}/api/qr`);
  console.log('Open any device on the same Wi‑Fi and visit one of the addresses above.');
});
