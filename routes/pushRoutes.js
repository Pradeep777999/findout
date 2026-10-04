const express = require("express");
const router = express.Router();
const PushSubscription = require("../models/PushSubscription");
const { sendPushNotification } = require("../utils/pushNotificationService");

// Middleware to ensure user is logged in
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      error: "Authentication required to manage push notifications"
    });
  }
  next();
}

/**
 * GET /api/push/public-key
 * Return ONLY the public VAPID key. Never expose the private key.
 */
router.get("/api/push/public-key", (req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  if (!publicKey) {
    return res.status(503).json({
      success: false,
      error: "Push notifications are not configured on this server."
    });
  }

  res.json({
    publicKey
  });
});

/**
 * GET /api/push/status
 * Check if the currently authenticated user has active push subscriptions.
 */
router.get("/api/push/status", async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.json({
        authenticated: false,
        subscribed: false,
        deviceCount: 0
      });
    }

    const count = await PushSubscription.countDocuments({
      userId: req.session.userId
    });

    res.json({
      authenticated: true,
      subscribed: count > 0,
      deviceCount: count
    });
  } catch (err) {
    console.error("[Push Routes] Error checking status:", err.message);
    res.status(500).json({ error: "Failed to check subscription status" });
  }
});

/**
 * POST /api/push/subscribe
 * Register or update a Web Push subscription for the authenticated user.
 */
router.post("/api/push/subscribe", requireAuth, async (req, res) => {
  try {
    const { subscription, userAgent } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({
        success: false,
        error: "Invalid subscription data received."
      });
    }

    const { p256dh, auth } = subscription.keys;
    if (!p256dh || !auth) {
      return res.status(400).json({
        success: false,
        error: "Subscription keys (p256dh and auth) are required."
      });
    }

    const clientUserAgent =
      userAgent || req.headers["user-agent"] || "Unknown Device";

    // Upsert subscription tied securely to req.session.userId
    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        userId: req.session.userId,
        endpoint: subscription.endpoint,
        keys: {
          p256dh,
          auth
        },
        userAgent: clientUserAgent,
        updatedAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: "Push notifications enabled successfully."
    });
  } catch (err) {
    console.error("[Push Routes] Error subscribing:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to save push subscription."
    });
  }
});

/**
 * POST /api/push/unsubscribe
 * Remove the specified push subscription for the authenticated user.
 */
router.post("/api/push/unsubscribe", requireAuth, async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        error: "Endpoint is required to unsubscribe."
      });
    }

    // Only delete the subscription if it belongs to the current authenticated user
    const result = await PushSubscription.deleteOne({
      endpoint,
      userId: req.session.userId
    });

    res.json({
      success: true,
      message: "Push subscription removed successfully.",
      deleted: result.deletedCount > 0
    });
  } catch (err) {
    console.error("[Push Routes] Error unsubscribing:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to remove push subscription."
    });
  }
});

/**
 * POST /api/push/test
 * Send a verification system push notification to the current user's active device(s).
 */
router.post("/api/push/test", requireAuth, async (req, res) => {
  try {
    const result = await sendPushNotification(req.session.userId, {
      title: "FindMyThing 🔔",
      body: "System notifications are active! You will receive timely alerts for item updates.",
      url: "/",
      type: "test"
    });

    if (!result.success && result.reason === "No active subscriptions") {
      return res.status(404).json({
        success: false,
        message: "No active push subscription found on this account. Please enable notifications first."
      });
    }

    res.json({
      success: true,
      message: "Test push notification dispatched to your device(s).",
      details: result
    });
  } catch (err) {
    console.error("[Push Routes] Error sending test notification:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to dispatch test notification."
    });
  }
});

module.exports = router;
