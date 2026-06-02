require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const logger = require('./utils/logger');
const { getLocalIPv4, isPrivateIPv4 } = require('./utils/network');
const { connectDatabase, closeDatabase } = require('./database/database');
const { setupWebSocket } = require('./services/websocket');
const disappearingMessages = require('./services/disappearingMessages');
const { authLimiter, generalLimiter } = require('./middleware/rateLimiter');
const apiRoutes = require('./routes');

const app = express();
const server = http.createServer(app);
const localIPv4 = getLocalIPv4();

const configuredOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const isAllowedLanOrigin = (origin) => {
  if (!origin) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    const normalizedHost = hostname.replace(/^\[|\]$/g, '');
    const isHttp = protocol === 'http:' || protocol === 'https:';
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(normalizedHost);
    return isHttp && (isLocalhost || isPrivateIPv4(normalizedHost) || configuredOrigins.includes(origin));
  } catch (error) {
    return false;
  }
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedLanOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin not allowed by LAN CORS policy: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true
};

const io = new Server(server, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000
});

app.set('io', io);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const uploadsDir = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
['images', 'videos', 'audio', 'documents'].forEach(dir => {
  const dirPath = path.join(uploadsDir, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── ROOT WELCOME PAGE ───────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Chatvora</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0f;
      color: #e0e0e0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container { text-align: center; padding: 40px 20px; max-width: 600px; }
    .logo { font-size: 4rem; margin-bottom: 16px; }
    h1 {
      font-size: 2.5rem;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 12px;
    }
    .subtitle { color: #888; font-size: 1.1rem; margin-bottom: 48px; }
    .cards { display: flex; gap: 24px; justify-content: center; flex-wrap: wrap; }
    .card {
      background: #151520;
      border: 1px solid #222;
      border-radius: 16px;
      padding: 32px 28px;
      width: 240px;
      text-decoration: none;
      color: #e0e0e0;
      transition: transform 0.2s, border-color 0.2s, background 0.2s;
    }
    .card:hover {
      transform: translateY(-4px);
      border-color: #667eea;
      background: #1a1a2e;
    }
    .card .icon { font-size: 2.5rem; margin-bottom: 16px; }
    .card .title { font-size: 1.2rem; font-weight: 600; margin-bottom: 8px; }
    .card .desc { font-size: 0.9rem; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">💬</div>
    <h1>Chatvora</h1>
    <p class="subtitle">Real-time messaging platform</p>
    <div class="cards">
      <a class="card" href="/api">
        <div class="icon">📡</div>
        <div class="title">API Endpoints</div>
        <div class="desc">View available API routes and documentation</div>
      </a>
      <a class="card" href="/leaderboard">
        <div class="icon">🏆</div>
        <div class="title">Leaderboard</div>
        <div class="desc">See the top contributors in the community</div>
      </a>
    </div>
  </div>
</body>
</html>`);
});

// ─── LEADERBOARD HTML PAGE ───────────────────────────────────────────────────
app.get('/leaderboard', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Chatvora — Leaderboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0f;
      color: #e0e0e0;
      min-height: 100vh;
    }
    .container { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 40px; }
    .header h1 {
      font-size: 2.5rem;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    .header p { color: #888; font-size: 1.1rem; }
    .stats-bar {
      display: flex; gap: 20px; justify-content: center;
      margin-bottom: 30px; flex-wrap: wrap;
    }
    .stat-card {
      background: #151520; border: 1px solid #222; border-radius: 12px;
      padding: 16px 28px; text-align: center; min-width: 140px;
    }
    .stat-card .number { font-size: 1.8rem; font-weight: 700; color: #667eea; }
    .stat-card .label { font-size: 0.85rem; color: #888; margin-top: 4px; }
    .leaderboard-table { width: 100%; border-collapse: separate; border-spacing: 0 8px; }
    .leaderboard-table th {
      text-align: left; padding: 12px 16px; color: #888;
      font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;
    }
    .leaderboard-table tr.row {
      background: #151520; border-radius: 12px;
      transition: transform 0.2s, background 0.2s;
    }
    .leaderboard-table tr.row:hover {
      background: #1a1a2e; transform: scale(1.01);
    }
    .leaderboard-table td { padding: 14px 16px; }
    .leaderboard-table td:first-child { border-radius: 12px 0 0 12px; }
    .leaderboard-table td:last-child { border-radius: 0 12px 12px 0; }
    .rank {
      width: 40px; height: 40px; display: inline-flex;
      align-items: center; justify-content: center;
      border-radius: 50%; font-weight: 700; font-size: 0.95rem;
    }
    .rank.gold { background: linear-gradient(135deg, #f5af19, #f12711); color: #fff; }
    .rank.silver { background: linear-gradient(135deg, #bdc3c7, #9ca3af); color: #fff; }
    .rank.bronze { background: linear-gradient(135deg, #b87333, #cd7f32); color: #fff; }
    .rank.normal { background: #222; color: #888; }
    .user-info { display: flex; align-items: center; gap: 12px; }
    .avatar {
      width: 42px; height: 42px; border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      display: flex; align-items: center; justify-content: center;
      font-weight: 600; font-size: 1.1rem; color: #fff; flex-shrink: 0;
    }
    .name { font-weight: 600; font-size: 1rem; }
    .username { color: #888; font-size: 0.85rem; }
    .online-dot {
      display: inline-block; width: 8px; height: 8px;
      border-radius: 50%; background: #22c55e; margin-left: 6px;
    }
    .offline-dot {
      display: inline-block; width: 8px; height: 8px;
      border-radius: 50%; background: #555; margin-left: 6px;
    }
    .msg-count { font-weight: 700; color: #667eea; font-size: 1.1rem; }
    .msg-label { font-size: 0.75rem; color: #888; }
    .loading {
      text-align: center; padding: 60px 20px; color: #888;
    }
    .loading .spinner {
      display: inline-block; width: 40px; height: 40px;
      border: 3px solid #222; border-top-color: #667eea;
      border-radius: 50%; animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-msg { text-align: center; padding: 40px; color: #ef4444; }
    @media (max-width: 600px) {
      .container { padding: 20px 12px; }
      .header h1 { font-size: 1.8rem; }
      .leaderboard-table th:nth-child(4),
      .leaderboard-table td:nth-child(4) { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏆 Chatvora Leaderboard</h1>
      <p>Top contributors in the community</p>
    </div>
    <div class="stats-bar">
      <div class="stat-card">
        <div class="number" id="total-users">—</div>
        <div class="label">Total Users</div>
      </div>
      <div class="stat-card">
        <div class="number" id="total-messages">—</div>
        <div class="label">Total Messages</div>
      </div>
    </div>
    <div id="leaderboard-body">
      <div class="loading">
        <div class="spinner"></div>
        <p style="margin-top: 16px;">Loading leaderboard...</p>
      </div>
    </div>
  </div>
  <script>
    async function loadLeaderboard() {
      try {
        const res = await fetch('/api/leaderboard?limit=50');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();

        document.getElementById('total-users').textContent = data.totalUsers;
        const totalMsgs = data.leaderboard.reduce((s, u) => s + u.messageCount, 0);
        document.getElementById('total-messages').textContent = totalMsgs.toLocaleString();

        if (data.leaderboard.length === 0) {
          document.getElementById('leaderboard-body').innerHTML =
            '<div class="loading"><p>No users yet. Be the first to join Chatvora! 🚀</p></div>';
          return;
        }

        let html = '<table class="leaderboard-table"><thead><tr>';
        html += '<th>Rank</th><th>User</th><th>Messages</th><th>Contacts</th>';
        html += '</tr></thead><tbody>';

        data.leaderboard.forEach(user => {
          const rankClass = user.rank === 1 ? 'gold' : user.rank === 2 ? 'silver' : user.rank === 3 ? 'bronze' : 'normal';
          const initial = (user.displayName || user.username || '?')[0].toUpperCase();
          const statusDot = user.isOnline ? '<span class="online-dot"></span>' : '<span class="offline-dot"></span>';

          html += '<tr class="row">';
          html += '<td><span class="rank ' + rankClass + '">' + user.rank + '</span></td>';
          html += '<td><div class="user-info">';
          html += '<div class="avatar">' + initial + '</div>';
          html += '<div><div class="name">' + (user.displayName || 'Unknown') + statusDot + '</div>';
          html += '<div class="username">@' + user.username + '</div></div>';
          html += '</div></td>';
          html += '<td><div class="msg-count">' + user.messageCount.toLocaleString() + '</div>';
          html += '<div class="msg-label">messages</div></td>';
          html += '<td style="color:#aaa;">' + user.contactCount + '</td>';
          html += '</tr>';
        });

        html += '</tbody></table>';
        document.getElementById('leaderboard-body').innerHTML = html;
      } catch (err) {
        document.getElementById('leaderboard-body').innerHTML =
          '<div class="error-msg"><p>⚠️ Failed to load leaderboard. Please try again later.</p></div>';
      }
    }
    loadLeaderboard();
  </script>
</body>
</html>`);
});

app.get('/api', (req, res) => {
  res.json({
    app: 'Chatvora API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      conversations: '/api/conversations',
      messages: '/api/messages',
      groups: '/api/groups',
      calls: '/api/calls',
      stories: '/api/stories',
      notifications: '/api/notifications',
      upload: '/api/upload',
      admin: '/api/admin',
      ai: '/api/ai',
      leaderboard: '/api/leaderboard'
    },
    health: '/health',
    leaderboard_page: '/leaderboard'
  });
});

app.use('/api', generalLimiter, apiRoutes);

if (process.env.NODE_ENV !== 'production') {
  app.use((err, req, res, next) => {
    logger.error('API error:', err.stack || err);
    res.status(err.status || 500).json({ message: err.message || 'Server error', stack: err.stack });
  });
}

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

async function startServer() {
  // ─── CONNECT TO MONGODB ─────────────────────────────────────────────
  try {
    await connectDatabase();
  } catch (err) {
    logger.error('MongoDB connection error:', err);
    if (process.env.NODE_ENV !== 'production') {
      logger.info('Attempting in-memory MongoDB for development...');
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create();
        process.env.MONGO_URI = mongod.getUri();
        const { connectDatabase } = require('./database/database');
        await connectDatabase();
      } catch (memErr) {
        logger.error('In-memory MongoDB failed:', memErr);
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }

  // Ensure indexes
  try {
    const models = ['User', 'Message', 'Conversation', 'Group', 'GroupMember', 'Call', 'Notification', 'Story', 'Channel', 'GroupInvite'];
    for (const m of models) {
      const mod = require(`./models/${m}`);
      if (mod.indexes) await mod.indexes();
    }
    logger.info('All indexes ensured');
  } catch (err) {
    logger.warn('Index creation error (non-fatal):', err.message);
  }

  // Setup Socket.IO (MUST happen after DB is connected)
  setupWebSocket(io);

  // Start disappearing messages cleanup scheduler
  disappearingMessages.start();

  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || '0.0.0.0';
  server.listen(PORT, HOST, () => {
    logger.info(`API and Socket.IO listening on http://${HOST}:${PORT}`);
    logger.info(`LAN backend URL: http://${localIPv4}:${PORT}`);
    logger.info(`Open the app from another device at: http://${localIPv4}:3000`);
  });
}

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  disappearingMessages.stop();
  await closeDatabase();
  process.exit(0);
});

startServer();

module.exports = { app, server, io };
