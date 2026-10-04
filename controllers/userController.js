const path = require('path');
const User = require('../models/User');

// Serves current user session details
async function getCurrentUser(req, res) {
  try {
    if (!req.session || !req.session.userId) {
      return res.json({});
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.json({});
    }

    res.json({
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (err) {
    console.error("Get Current User Error:", err);
    res.json({});
  }
}

// Update user display name
async function changeName(req, res) {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, error: "Please log in first" });
    }

    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: "Name cannot be empty" });
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 80) {
      return res.status(400).json({ success: false, error: "Name is too long" });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    user.name = trimmedName;
    await user.save();

    return res.json({
      success: true,
      name: user.name,
      message: "Name updated successfully"
    });
  } catch (err) {
    console.error("Change Name Error:", err);
    return res.status(500).json({ success: false, error: "Failed to update name" });
  }
}

// Update user password with current password verification
async function changePassword(req, res) {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, error: "Please log in first" });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ success: false, error: "Current password is required" });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "New password must be at least 6 characters long" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: "New passwords do not match" });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    return res.json({
      success: true,
      message: "Password updated successfully"
    });
  } catch (err) {
    console.error("Change Password Error:", err);
    return res.status(500).json({ success: false, error: "Failed to update password" });
  }
}

// Serves main index page
function serveIndex(req, res) {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.sendFile(path.join(__dirname, "../views/user/index.html"));
}

// Serves authentication pages
function serveLogin(req, res) {
  res.sendFile(path.join(__dirname, "../views/auth/login.html"));
}

function serveRegister(req, res) {
  res.sendFile(path.join(__dirname, "../views/auth/register.html"));
}

function serveLoginOtp(req, res) {
  res.sendFile(path.join(__dirname, "../views/auth/login-otp.html"));
}

function serveReset(req, res) {
  res.sendFile(path.join(__dirname, "../views/auth/reset.html"));
}

// Serves user-facing lost and found catalog pages
function serveMyItems(req, res) {
  res.sendFile(path.join(__dirname, "../views/user/my-items.html"));
}

function serveReportLost(req, res) {
  res.sendFile(path.join(__dirname, "../views/user/report-lost.html"));
}

function serveReportFound(req, res) {
  res.sendFile(path.join(__dirname, "../views/user/report-found.html"));
}

function serveCollected(req, res) {
  res.sendFile(path.join(__dirname, "../views/user/collected.html"));
}

function serveItems(req, res) {
  res.sendFile(path.join(__dirname, "../views/user/items.html"));
}

// Serves administrative panels
function serveAdmin(req, res) {
  res.sendFile(path.join(__dirname, "../views/admin/admin.html"));
}

function serveAnalytics(req, res) {
  res.sendFile(path.join(__dirname, "../views/admin/analytics.html"));
}

function serveManager(req, res) {
  res.sendFile(path.join(__dirname, "../views/admin/manager.html"));
}

module.exports = {
  getCurrentUser,
  changeName,
  changePassword,
  serveIndex,
  serveLogin,
  serveRegister,
  serveLoginOtp,
  serveReset,
  serveMyItems,
  serveReportLost,
  serveReportFound,
  serveCollected,
  serveItems,
  serveAdmin,
  serveAnalytics,
  serveManager
};
