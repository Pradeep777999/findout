require("dotenv").config();
const webPush = require("web-push");
const PushSubscription = require("../models/PushSubscription");

// Initialize VAPID details if keys are present
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@findmything.com";

let isVapidConfigured = false;

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    isVapidConfigured = true;
  } catch (err) {
    console.error("[Push Service] Error configuring VAPID details:", err.message);
  }
} else {
  console.warn(
    "[Push Service] Warning: VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY is missing. Push notifications disabled until configured."
  );
}

/**
 * Send Web Push notification to all subscriptions of a specific user.
 * Expired or invalidated subscriptions (404, 410) are automatically pruned.
 * Push errors never throw to protect caller operations.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {Object} payloadData
 * @param {string} payloadData.title
 * @param {string} payloadData.body
 * @param {string} [payloadData.icon]
 * @param {string} [payloadData.badge]
 * @param {string} [payloadData.url]
 * @param {string} [payloadData.type]
 * @param {string} [payloadData.itemId]
 */
async function sendPushNotification(userId, payloadData) {
  if (!isVapidConfigured) {
    return { success: false, reason: "VAPID not configured" };
  }

  if (!userId) {
    return { success: false, reason: "Missing userId" };
  }

  try {
    const subscriptions = await PushSubscription.find({ userId });
    if (!subscriptions || subscriptions.length === 0) {
      return { success: true, sentCount: 0, failedCount: 0, reason: "No active subscriptions" };
    }

    const payload = JSON.stringify({
      title: payloadData.title || "FindMyThing",
      body: payloadData.body || "New update regarding lost & found items.",
      icon: payloadData.icon || "/icons/icon-192.png",
      badge: payloadData.badge || "/icons/icon-192.png",
      url: payloadData.url || "/",
      type: payloadData.type || "general",
      itemId: payloadData.itemId ? String(payloadData.itemId) : undefined,
      timestamp: Date.now()
    });

    let sentCount = 0;
    let failedCount = 0;

    const sendPromises = subscriptions.map(async (sub) => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth
        }
      };

      try {
        await webPush.sendNotification(pushConfig, payload, {
          TTL: 86400 // 24 hours
        });
        sentCount++;
      } catch (err) {
        failedCount++;
        // Prune gone/expired subscriptions
        const statusCode = err.statusCode || (err.error && err.error.statusCode);
        if (statusCode === 404 || statusCode === 410) {
          try {
            await PushSubscription.deleteOne({ _id: sub._id });
            console.log(`[Push Service] Cleaned up expired push subscription for user ${userId}`);
          } catch (deleteErr) {
            console.error("[Push Service] Error deleting expired subscription:", deleteErr.message);
          }
        } else {
          console.error(
            `[Push Service] Push delivery failed (Status: ${statusCode || "unknown"}):`,
            err.message
          );
        }
      }
    });

    await Promise.all(sendPromises);

    return {
      success: true,
      sentCount,
      failedCount
    };
  } catch (err) {
    console.error("[Push Service] Failed to send push notification:", err.message);
    // Never rethrow - fail silently so caller operation succeeds
    return { success: false, error: err.message };
  }
}

/**
 * Send Web Push notification to multiple users
 *
 * @param {Array<string|mongoose.Types.ObjectId>} userIds
 * @param {Object} payloadData
 */
async function sendPushToUsers(userIds, payloadData) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return;
  }

  const uniqueUserIds = [...new Set(userIds.map((id) => String(id)))];
  await Promise.allSettled(
    uniqueUserIds.map((uid) => sendPushNotification(uid, payloadData))
  );
}

module.exports = {
  sendPushNotification,
  sendPushToUsers,
  isVapidConfigured: () => isVapidConfigured
};
