const { getDb, toObjectId } = require('../database/database');
const logger = require('../utils/logger');

const CLEANUP_INTERVAL_MS = 60 * 1000; // run every 60 seconds

let intervalId = null;

async function deleteExpiredMessages() {
  try {
    const db = getDb();
    const now = new Date();
    const result = await db.collection('messages').deleteMany({
      disappearAt: { $lte: now },
    });
    if (result.deletedCount > 0) {
      logger.info(`[DisappearingMessages] Cleaned up ${result.deletedCount} expired messages`);
    }
  } catch (err) {
    logger.error('[DisappearingMessages] Cleanup error:', err.message);
  }
}

function start() {
  if (intervalId) return;
  logger.info('[DisappearingMessages] Starting cleanup scheduler');
  deleteExpiredMessages(); // immediate first run
  intervalId = setInterval(deleteExpiredMessages, CLEANUP_INTERVAL_MS);
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[DisappearingMessages] Cleanup scheduler stopped');
  }
}

module.exports = { start, stop };
