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

// ─── ROOT: REDIRECT TO FRONTEND OR SHOW WELCOME ──────────────────────────────
app.get('/', (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    return res.redirect(frontendUrl);
  }
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
    .hint { margin-top: 40px; padding: 16px; background: #151520; border-radius: 12px; border: 1px solid #222; }
    .hint code { color: #667eea; background: #1a1a2e; padding: 2px 8px; border-radius: 4px; font-size: 0.85rem; }
    .hint p { color: #888; font-size: 0.9rem; line-height: 1.6; }
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
    </div>
    <div class="hint">
      <p>💡 <strong>Tip:</strong> Deploy the frontend on Vercel and set <code>FRONTEND_URL</code> env var on Render to auto-redirect visitors to the chat app.</p>
    </div>
  </div>
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
      premium: '/api/premium'
    },
    health: '/health'
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
    const models = ['User', 'Message', 'Conversation', 'Group', 'GroupMember', 'Call', 'Notification', 'Story', 'Channel', 'GroupInvite', 'FriendRequest', 'Poll'];
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
