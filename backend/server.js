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

  const PORT = process.env.PORT || 5000;
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
  await closeDatabase();
  process.exit(0);
});

startServer();

module.exports = { app, server, io };
