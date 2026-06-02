const { MongoClient } = require('mongodb');
const logger = require('../utils/logger');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'chatvora';

let client = null;
let db = null;

const connectDatabase = async () => {
  if (db) return db;

  if (!MONGO_URI) {
    throw new Error('Missing MongoDB connection string. Set MONGO_URI in backend/.env.');
  }

  client = new MongoClient(MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 20,
    retryWrites: true,
    w: 'majority'
  });

  client.on('connectionPoolCreated', () => logger.info('MongoDB connection pool created'));
  client.on('connectionPoolReady', () => logger.info('MongoDB connection pool ready'));
  client.on('connectionClosed', (e) => logger.warn('MongoDB connection closed', e));
  client.on('error', (e) => logger.error('MongoDB client error', e));

  await client.connect();
  db = client.db(DB_NAME);

  await db.command({ ping: 1 });
  logger.info(`MongoDB connected successfully to "${DB_NAME}"`);

  return db;
};

const getDb = () => {
  if (!db) throw new Error('Database not initialized. Call connectDatabase() first.');
  return db;
};

const getClient = () => {
  if (!client) throw new Error('Database client not initialized.');
  return client;
};

const closeDatabase = async () => {
  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info('MongoDB connection closed');
  }
};

const toObjectId = (id) => {
  if (!id) return null;
  const { ObjectId } = require('mongodb');
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
};

module.exports = {
  connectDatabase,
  getDb,
  getClient,
  closeDatabase,
  toObjectId
};
