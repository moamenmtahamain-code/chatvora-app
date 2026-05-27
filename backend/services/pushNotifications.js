const logger = require('../utils/logger');
const User = require('../models/User');

let webPush = null;
try {
  webPush = require('web-push');
} catch (e) {
  logger.warn('[Push] web-push not available, push notifications disabled');
}

function configureWebPush() {
  if (!webPush) return;
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (publicKey && privateKey) {
      webPush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:chatwave@app.com',
        publicKey,
        privateKey
      );
      logger.info('[Push] Web-Push configured');
    } else {
      logger.warn('[Push] VAPID keys not configured');
    }
  } catch (e) {
    logger.warn('[Push] Web-Push configuration error:', e.message);
  }
}

configureWebPush();

async function sendPushNotification(userId, title, body, data = {}) {
  if (!webPush) return;
  try {
    const user = await User.findById(userId);
    if (!user?.pushSubscriptions?.length) return;

    const payload = JSON.stringify({
      title,
      body,
      tag: data.tag || 'chatwave-notification',
      data: {
        url: data.url || '/',
        conversationId: data.conversationId
      }
    });

    for (const subscription of user.pushSubscriptions) {
      try {
        await webPush.sendNotification(subscription, payload);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await User.findByIdAndUpdate(userId, {
            $pull: { pushSubscriptions: { endpoint: subscription.endpoint } }
          });
        }
        logger.warn('[Push] Send error:', err.message);
      }
    }
  } catch (e) {
    logger.error('[Push] Error:', e.message);
  }
}

function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

module.exports = {
  sendPushNotification,
  getVapidPublicKey
};
