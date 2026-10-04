const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Notification = require("../models/Notification");

// Middleware to ensure user is logged in
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      error: "Authentication required to access notifications."
    });
  }
  next();
}

// Helper to match userId whether stored as String or ObjectId
function getUserFilter(userId) {
  if (!userId) return { userId: null };
  const str = String(userId);
  if (mongoose.Types.ObjectId.isValid(str)) {
    return {
      $or: [
        { userId: str },
        { userId: new mongoose.Types.ObjectId(str) }
      ]
    };
  }
  return { userId: str };
}

/**
 * GET /api/notifications
 * Fetch user's in-app notifications and unread count.
 */
router.get("/api/notifications", requireAuth, async (req, res) => {
  try {
    const userFilter = getUserFilter(req.session.userId);

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(userFilter)
        .sort({ createdAt: -1 })
        .limit(30)
        .lean(),
      Notification.countDocuments({ ...userFilter, isRead: false })
    ]);

    res.json({
      success: true,
      notifications,
      unreadCount
    });
  } catch (err) {
    console.error("[Notification Routes] Error fetching notifications:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch notifications."
    });
  }
});

/**
 * GET /api/notifications/unread-count
 * Quick polling endpoint for badge updates.
 */
router.get("/api/notifications/unread-count", async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.json({ success: true, unreadCount: 0 });
    }

    const userFilter = getUserFilter(req.session.userId);
    const unreadCount = await Notification.countDocuments({
      ...userFilter,
      isRead: false
    });

    res.json({
      success: true,
      unreadCount
    });
  } catch (err) {
    console.error("[Notification Routes] Error counting unread:", err.message);
    res.status(500).json({ success: false, unreadCount: 0 });
  }
});

/**
 * POST /api/notifications/read/:id
 * Mark a single notification as read.
 */
router.post("/api/notifications/read/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userFilter = getUserFilter(req.session.userId);

    await Notification.findOneAndUpdate(
      { _id: id, ...userFilter },
      { isRead: true }
    );

    const unreadCount = await Notification.countDocuments({
      ...userFilter,
      isRead: false
    });

    res.json({
      success: true,
      unreadCount
    });
  } catch (err) {
    console.error("[Notification Routes] Error marking notification as read:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to mark notification as read."
    });
  }
});

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read for current user.
 */
router.post("/api/notifications/mark-all-read", requireAuth, async (req, res) => {
  try {
    const userFilter = getUserFilter(req.session.userId);

    await Notification.updateMany(
      { ...userFilter, isRead: false },
      { isRead: true }
    );

    res.json({
      success: true,
      unreadCount: 0
    });
  } catch (err) {
    console.error("[Notification Routes] Error marking all as read:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to mark all notifications as read."
    });
  }
});

module.exports = router;
