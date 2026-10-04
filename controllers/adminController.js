const fs = require('fs');
const path = require('path');
const Item = require('../models/Item');
const Collected = require('../models/Collected');
const { getCurrentCycle, parseUserEmail } = require('../utils/helper');
const { createDualNotification } = require('../utils/notificationService');

// Mark Item as Collected
async function markCollected(req, res) {
  try {
    const item = await Item.findById(req.body.itemId);

    if (!item) {
      return res.send("Item not found");
    }

    const collected = new Collected({
      name: item.name,
      description: item.description,
      location: item.location,
      lostLocation: item.lostLocation,
      foundLocation: item.foundLocation,
      userName: item.userName,
      userEmail: item.userEmail,
      type: item.type,
      image: item.image,
      handedBy: item.handedBy,
      handedTo: item.handedTo,
      cycle: item.cycle,
      dateFound: item.dateFound,
      dateLost: item.dateLost,
      department: item.department,
      branch: item.branch,
      year: item.year
    });

    await collected.save();
    await Item.findByIdAndDelete(req.body.itemId);

    // Notify user that their item has been collected (Dual Notification: In-App + System Push)
    if (item.userId) {
      const matchKey = `item_collected_${item._id}_${item.userId}`;
      createDualNotification({
        userId: item.userId,
        title: "Item Collected 📦",
        message: `Your item "${item.name}" has been marked as collected.`,
        type: "item_collected",
        matchKey,
        url: "/collected.html"
      }).catch((e) => console.error("[Admin Controller] Collected notification error:", e.message));
    }

    res.redirect("/manager.html");
  } catch (err) {
    console.error("Mark Collected Error:", err);
    res.status(500).send("Failed to mark item as collected");
  }
}

// Delete Collected Item (from Admin view)
async function deleteCollected(req, res) {
  try {
    await Collected.findByIdAndDelete(req.body.itemId);
    res.redirect("/admin.html");
  } catch (err) {
    console.error("Delete Collected Error:", err);
    res.status(500).send("Failed to delete collected item");
  }
}

const User = require('../models/User');

// Delete Record and associated file (supports both active Items and Collected records)
async function clearRecord(req, res) {
  try {
    const { record_id } = req.params;
    let record = await Item.findById(record_id);
    let isItem = true;

    if (!record) {
      record = await Collected.findById(record_id);
      isItem = false;
    }

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record not found"
      });
    }

    if (record.image) {
      const imagePath = path.join(__dirname, "../public/uploads", record.image);
      try {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      } catch (err) {
        console.log("Image not found or already deleted:", err.message);
      }
    }

    if (isItem) {
      await Item.findByIdAndDelete(record_id);
    } else {
      await Collected.findByIdAndDelete(record_id);
    }

    res.json({
      success: true,
      message: "Deleted successfully"
    });
  } catch (err) {
    console.error("Clear Record Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
}

// Delete Active Item POST (from Admin view)
async function deleteItem(req, res) {
  try {
    const itemId = req.body.itemId || req.body.id;
    const record = await Item.findById(itemId);
    if (record && record.image) {
      const imagePath = path.join(__dirname, "../public/uploads", record.image);
      try {
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      } catch (e) {}
    }
    await Item.findByIdAndDelete(itemId);
    res.redirect("/admin.html");
  } catch (err) {
    console.error("Delete Item Error:", err);
    res.status(500).send("Failed to delete item");
  }
}

// Get All Users API (Admin only)
async function getUsers(req, res) {
  try {
    const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error("Get Users Error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
}

// Delete User POST (Admin only)
async function deleteUser(req, res) {
  try {
    const userId = req.body.itemId || req.body.userId || req.body.id;
    await User.findByIdAndDelete(userId);
    res.redirect("/admin.html");
  } catch (err) {
    console.error("Delete User Error:", err);
    res.status(500).send("Failed to delete user");
  }
}

// Update User Role POST (Admin only)
async function updateRole(req, res) {
  try {
    const { userId, role } = req.body;
    if (!["user", "manager", "admin"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role specified" });
    }
    await User.findByIdAndUpdate(userId, { role });
    res.json({ success: true, message: "Role updated successfully" });
  } catch (err) {
    console.error("Update Role Error:", err);
    res.status(500).json({ success: false, message: "Failed to update role" });
  }
}

// Get Stats (total items vs collected items count)
async function getStats(req, res) {
  try {
    const totalItems = await Item.countDocuments({ cycle: getCurrentCycle() });
    const totalCollected = await Collected.countDocuments({ cycle: getCurrentCycle() });

    res.json({ totalItems, totalCollected });
  } catch (err) {
    console.error("Get Stats Error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
}

// Found Items Analytics calculation
async function getAnalytics(req, res) {
  try {
    let { startDate, endDate, department, branch, year, sort, search } = req.query;

    if (!startDate) startDate = "2025-08-14";
    if (!endDate) endDate = "2026-01-26";

    const start = new Date(startDate + "T00:00:00.000Z");
    const end = new Date(endDate + "T23:59:59.999Z");

    const itemMatch = {
      type: "found",
      $or: [
        { dateFound: { $gte: startDate, $lte: endDate } },
        {
          dateFound: { $exists: false },
          createdAt: { $gte: start, $lte: end }
        }
      ]
    };

    const collectedMatch = {
      type: "found",
      $or: [
        { dateFound: { $gte: startDate, $lte: endDate } },
        {
          dateFound: { $exists: false },
          collectedAt: { $gte: start, $lte: end }
        }
      ]
    };

    const unionMatch = {};
    if (department) unionMatch.department = department;
    if (branch) unionMatch.branch = branch;
    if (year) unionMatch.year = year;
    if (search) {
      unionMatch.$or = [
        { userName: { $regex: search, $options: "i" } },
        { userEmail: { $regex: search, $options: "i" } }
      ];
    }

    const rawItemsPipeline = [
      { $match: itemMatch },
      {
        $project: {
          userName: 1,
          userEmail: 1,
          department: 1,
          branch: 1,
          year: 1,
          submissionDate: { $ifNull: [ "$dateFound", { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } ] },
          name: 1
        }
      },
      {
        $unionWith: {
          coll: "collecteds",
          pipeline: [
            { $match: collectedMatch },
            {
              $project: {
                userName: 1,
                userEmail: 1,
                department: 1,
                branch: 1,
                year: 1,
                submissionDate: { $ifNull: [ "$dateFound", { $dateToString: { format: "%Y-%m-%d", date: "$collectedAt" } } ] },
                name: 1
              }
            }
          ]
        }
      }
    ];

    if (Object.keys(unionMatch).length > 0) {
      rawItemsPipeline.push({ $match: unionMatch });
    }

    const allRecords = await Item.aggregate(rawItemsPipeline);

    if (allRecords.length === 0) {
      return res.json({
        success: true,
        summary: {
          totalFoundItems: 0,
          totalUsers: 0,
          topContributor: { name: "N/A", submissions: 0 },
          quickStats: {
            avgSubmissionsPerUser: 0,
            highestDay: "N/A",
            highestMonth: "N/A",
            lowestMonth: "N/A",
            growthPercentage: 0
          }
        },
        monthlyData: [],
        userStatistics: []
      });
    }

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    const userGroups = {};
    const dayCounts = {};
    const monthCounts = {};

    allRecords.forEach(rec => {
      const email = rec.userEmail || "unknown@mits.ac.in";
      const name = rec.userName || rec.userEmail || "Anonymous";
      
      let dept = rec.department;
      let branchVal = rec.branch;
      let yr = rec.year;
      if (!dept || !branchVal || !yr || dept === "N/A" || branchVal === "N/A" || yr === "N/A") {
        const details = parseUserEmail(email);
        dept = (dept && dept !== "N/A") ? dept : details.department;
        branchVal = (branchVal && branchVal !== "N/A") ? branchVal : details.branch;
        yr = (yr && yr !== "N/A") ? yr : details.year;
      }
      const date = rec.submissionDate;
      const dateStr = new Date(date).toISOString().split('T')[0];
      const monthIndex = new Date(date).getUTCMonth();
      const monthName = monthNames[monthIndex];

      dayCounts[dateStr] = (dayCounts[dateStr] || 0) + 1;
      monthCounts[monthName] = (monthCounts[monthName] || 0) + 1;

      if (!userGroups[email]) {
        userGroups[email] = {
          name,
          email,
          department: dept,
          branch: branchVal,
          year: yr,
          count: 0,
          lastSubmission: date,
          submissionDates: []
        };
      }

      const group = userGroups[email];
      group.count++;
      if (new Date(date) > new Date(group.lastSubmission)) {
        group.lastSubmission = date;
      }
      group.submissionDates.push(date);
    });

    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.max(1, Math.round(diffDays / 30));

    let userStatistics = Object.values(userGroups).map(u => {
      const avg = (u.count / diffMonths).toFixed(1);
      
      const userMonthly = {};
      monthNames.forEach(m => { userMonthly[m] = 0; });
      u.submissionDates.forEach(date => {
        const mName = monthNames[new Date(date).getUTCMonth()];
        userMonthly[mName]++;
      });

      return {
        name: u.name,
        email: u.email,
        department: u.department,
        branch: u.branch,
        year: u.year,
        count: u.count,
        lastSubmission: new Date(u.lastSubmission).toISOString().split('T')[0],
        avgPerMonth: `${avg}/month`,
        status: "Active",
        monthlyBreakdown: userMonthly
      };
    });

    if (sort === "highest") {
      userStatistics.sort((a, b) => b.count - a.count);
    } else if (sort === "lowest") {
      userStatistics.sort((a, b) => a.count - b.count);
    } else if (sort === "alphabetical") {
      userStatistics.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "newest") {
      userStatistics.sort((a, b) => new Date(b.lastSubmission) - new Date(a.lastSubmission));
    } else if (sort === "oldest") {
      userStatistics.sort((a, b) => new Date(a.lastSubmission) - new Date(b.lastSubmission));
    } else {
      userStatistics.sort((a, b) => b.count - a.count);
    }

    userStatistics.forEach((u, i) => {
      u.rank = i + 1;
    });

    const totalFoundItems = allRecords.length;
    const totalUsers = Object.keys(userGroups).length;
    
    const topUser = [...userStatistics].sort((a, b) => b.count - a.count)[0];
    const topContributor = topUser ? { name: topUser.name, submissions: topUser.count } : { name: "N/A", submissions: 0 };

    let highestDay = "N/A";
    let maxDayCount = 0;
    Object.entries(dayCounts).forEach(([day, cnt]) => {
      if (cnt > maxDayCount) {
        maxDayCount = cnt;
        highestDay = day;
      }
    });

    let highestMonth = "N/A";
    let maxMonthCount = 0;
    let lowestMonth = "N/A";
    let minMonthCount = Infinity;

    const targetMonths = ["August", "September", "October", "November", "December", "January"];
    
    targetMonths.forEach(m => {
      const cnt = monthCounts[m] || 0;
      if (cnt > maxMonthCount) {
        maxMonthCount = cnt;
        highestMonth = m;
      }
      if (cnt < minMonthCount) {
        minMonthCount = cnt;
        lowestMonth = m;
      }
    });

    if (minMonthCount === Infinity) minMonthCount = 0;

    const monthlyData = targetMonths.map(m => ({
      month: m,
      count: monthCounts[m] || 0
    }));

    let growthPercentage = 0;
    const activeMonthsWithData = targetMonths.filter(m => (monthCounts[m] || 0) > 0);
    if (activeMonthsWithData.length >= 2) {
      const latestMonth = activeMonthsWithData[activeMonthsWithData.length - 1];
      const prevMonth = activeMonthsWithData[activeMonthsWithData.length - 2];
      const latestCount = monthCounts[latestMonth] || 0;
      const prevCount = monthCounts[prevMonth] || 0;
      if (prevCount > 0) {
        growthPercentage = parseFloat((((latestCount - prevCount) / prevCount) * 100).toFixed(1));
      } else {
        growthPercentage = latestCount * 100;
      }
    }

    res.json({
      success: true,
      summary: {
        totalFoundItems,
        totalUsers,
        topContributor,
        quickStats: {
          avgSubmissionsPerUser: parseFloat((totalFoundItems / totalUsers).toFixed(1)),
          highestDay,
          highestMonth,
          lowestMonth,
          growthPercentage
        }
      },
      monthlyData,
      userStatistics
    });

  } catch (err) {
    console.error("Analytics API Error:", err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
}

module.exports = {
  markCollected,
  deleteCollected,
  deleteItem,
  getUsers,
  deleteUser,
  updateRole,
  clearRecord,
  getStats,
  getAnalytics
};
