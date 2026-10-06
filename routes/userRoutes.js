const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireLoginView, requireManagerView, requireAdminView } = require('../middleware/auth');

// Views routing
router.get("/", userController.serveIndex);
router.get("/index.html", userController.serveIndex);

router.get("/login", userController.serveLogin);
router.get("/login.html", userController.serveLogin);
router.get("/register", userController.serveRegister);
router.get("/register.html", userController.serveRegister);
router.get("/login-otp", userController.serveLoginOtp);
router.get("/login-otp.html", userController.serveLoginOtp);
router.get("/reset", userController.serveReset);
router.get("/reset.html", userController.serveReset);

router.get("/collected", userController.serveCollected);
router.get("/collected.html", userController.serveCollected);
router.get("/items", userController.serveItems);
router.get("/items.html", userController.serveItems);

// Protected user views
router.get("/my-items", requireLoginView, userController.serveMyItems);
router.get("/my-items.html", requireLoginView, userController.serveMyItems);
router.get("/report-lost", requireLoginView, userController.serveReportLost);
router.get("/report-lost.html", requireLoginView, userController.serveReportLost);
router.get("/report-found", requireLoginView, userController.serveReportFound);
router.get("/report-found.html", requireLoginView, userController.serveReportFound);
router.get("/notifications", requireLoginView, userController.serveNotifications);
router.get("/notifications.html", requireLoginView, userController.serveNotifications);
router.get("/profile", requireLoginView, userController.serveProfile);
router.get("/profile.html", requireLoginView, userController.serveProfile);

// Protected admin/manager views
router.get("/admin", requireAdminView, userController.serveAdmin);
router.get("/admin.html", requireAdminView, userController.serveAdmin);
router.get("/analytics", requireManagerView, userController.serveAnalytics);
router.get("/analytics.html", requireManagerView, userController.serveAnalytics);
router.get("/manager", requireManagerView, userController.serveManager);
router.get("/manager.html", requireManagerView, userController.serveManager);

// API user endpoints
router.get("/api/user", userController.getCurrentUser);
router.post("/api/user/change-name", userController.changeName);
router.post("/api/user/change-password", userController.changePassword);

module.exports = router;
