const Notification = require("../models/Notification");
const { sendPushNotification } = require("./pushNotificationService");

/**
 * Dispatches a dual notification:
 * 1. Creates a persistent MongoDB in-app notification for the user.
 * 2. Sends a real Web Push mobile system notification to the user's active device(s).
 *
 * Guaranteed duplicate protection using deterministic matchKey and unique index constraint.
 *
 * @param {Object} options
 * @param {string|mongoose.Types.ObjectId} options.userId - Recipient user ID
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification message body
 * @param {string} [options.type="possible_match"] - Notification event type
 * @param {string} [options.matchKey] - Deterministic unique identifier for match deduplication
 * @param {string|mongoose.Types.ObjectId} [options.lostItemId] - Associated lost item
 * @param {string|mongoose.Types.ObjectId} [options.foundItemId] - Associated found item
 * @param {string} [options.url="/items.html"] - Deep link URL
 * @returns {Promise<Object>} Result of notification creation
 */
async function createDualNotification({
  userId,
  title = "Possible Match Found",
  message,
  type = "possible_match",
  itemName,
  location,
  date,
  matchProbability,
  matchScore = 0,
  matchKey,
  lostItemId,
  foundItemId,
  targetUrl = "/items.html",
  url = "/items.html"
}) {
  if (!userId) {
    return { success: false, reason: "Missing recipient userId" };
  }

  const finalScore = Number(matchProbability || matchScore || 0);
  const finalUrl = targetUrl || url || "/items.html";

  try {
    // 1. Duplicate check via deterministic matchKey
    if (matchKey) {
      const existing = await Notification.findOne({ matchKey });
      if (existing) {
        return {
          success: true,
          isDuplicate: true,
          message: "Notification already sent for this match event.",
          notification: existing
        };
      }
    }

    // 2. Persist In-App Notification in MongoDB
    let notification;
    try {
      notification = new Notification({
        userId,
        title,
        message,
        type,
        itemName: itemName || undefined,
        location: location || undefined,
        date: date || undefined,
        matchProbability: finalScore,
        matchScore: finalScore,
        matchKey: matchKey || undefined,
        lostItemId: lostItemId || undefined,
        foundItemId: foundItemId || undefined,
        relatedLostItemId: lostItemId || undefined,
        relatedFoundItemId: foundItemId || undefined,
        targetUrl: finalUrl,
        url: finalUrl,
        isRead: false
      });

      await notification.save();
    } catch (saveErr) {
      // Catch unique index violation (race condition / concurrent duplicate)
      if (saveErr.code === 11000) {
        return {
          success: true,
          isDuplicate: true,
          message: "Duplicate notification prevented by index."
        };
      }
      console.error("[Notification Service] Error persisting in-app notification:", saveErr.message);
    }

    // 3. Dispatch Mobile/System Push Notification via Web Push
    try {
      const pushBody = itemName
        ? `${itemName}\n📍 ${location || "MITS Campus"}\n📊 Matching Probability: ${finalScore}%\nTap to check it out.`
        : message;

      await sendPushNotification(userId, {
        title,
        body: pushBody,
        type,
        itemId: foundItemId || lostItemId,
        url: finalUrl,
        tag: matchKey || (foundItemId ? `item-${foundItemId}` : undefined)
      });
    } catch (pushErr) {
      console.error("[Notification Service] Push delivery error:", pushErr.message);
    }

    return {
      success: true,
      notification
    };
  } catch (err) {
    console.error("[Notification Service] Error creating dual notification:", err.message);
    // Never rethrow - fail safely so main business operation succeeds
    return { success: false, error: err.message };
  }
}

module.exports = {
  createDualNotification
};
