const User = require('../models/User');
const Item = require('../models/Item');
const Collected = require('../models/Collected');
const { getCurrentCycle, parseUserEmail } = require('../utils/helper');
const cloudinary = require('../config/cloudinary');
const { analyzeAndNotifyMatches } = require('../utils/matchingService');


// ================= CLOUDINARY IMAGE UPLOAD =================

async function uploadImageToCloudinary(file) {
  if (!file || !file.buffer) {
    return "";
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "findmything/items",
        resource_type: "image"
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve(result.secure_url);
      }
    );

    uploadStream.end(file.buffer);
  });
}


// ================= SUBMIT LOST ITEM =================

async function submitLost(req, res) {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect("/login.html");
    }

    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.redirect("/login.html");
    }

    // Upload image to Cloudinary
    let imageUrl = "";

    if (req.file) {
      imageUrl = await uploadImageToCloudinary(req.file);
    }

    const item = new Item({
      name: req.body.name,
      description: req.body.description,
      location: "MITS Admin Office",
      lostLocation: req.body.lostlocation || req.body.lostLocation || req.body.location || "MITS Campus",
      dateLost: req.body.dateLost || req.body.datelost || new Date().toISOString().split("T")[0],

      userId: req.session.userId,
      userName: user.name,
      userEmail: user.email,
      contact: req.body.contact,

      type: "lost",

      // Cloudinary URL
      image: imageUrl,

      handedBy: req.body.handedBy,
      handedTo: req.body.handedTo,

      cycle: getCurrentCycle()
    });

    await item.save();

    // Automatic weighted matching against existing active FOUND reports
    // If confidence >= MATCH_THRESHOLD (80%), notifies the LOST reporter (Student A)
    analyzeAndNotifyMatches(item).catch((err) => {
      console.error("[Item Controller] Automatic match analysis error:", err.message);
    });

    res.redirect("/items.html");

  } catch (err) {
    console.error("Submit Lost Item Error:", err);

    res.status(500).send("Submit lost item failed");
  }
}


// ================= SUBMIT FOUND ITEM =================

async function submitFound(req, res) {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect("/login.html");
    }

    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.redirect("/login.html");
    }

    const details = parseUserEmail(user.email);

    // Upload image to Cloudinary
    let imageUrl = "";

    if (req.file) {
      imageUrl = await uploadImageToCloudinary(req.file);
    }

    const item = new Item({
      name: req.body.name,
      description: req.body.description,
      location: "MITS Admin Office",
      foundLocation: req.body.foundlocation || req.body.foundLocation || req.body.location || "MITS Campus",
      dateFound: req.body.dateFound || req.body.datefound || new Date().toISOString().split("T")[0],

      userId: req.session.userId,
      userName: user.name,
      userEmail: user.email,
      contact: req.body.contact,

      type: "found",

      // Cloudinary URL
      image: imageUrl,

      handedBy: req.body.handedBy,
      handedTo: req.body.handedTo,

      cycle: getCurrentCycle(),

      department: details.department,
      branch: details.branch,
      year: details.year
    });

    await item.save();

    // Automatic weighted matching against existing active LOST reports
    // If confidence >= MATCH_THRESHOLD (80%), notifies the matching LOST reporter
    analyzeAndNotifyMatches(item).catch((err) => {
      console.error("[Item Controller] Automatic match analysis error:", err.message);
    });

    res.redirect("/items.html");

  } catch (err) {
    console.error("Submit Found Item Error:", err);

    res.status(500).send("Submit found item failed");
  }
}


// ================= GET ITEMS API =================

async function getItems(req, res) {
  try {
    const items = await Item
      .find({ cycle: getCurrentCycle() })
      .sort({ createdAt: -1 });

    res.json(items);

  } catch (err) {
    console.error("Get Items Error:", err);

    res.status(500).json({
      error: "Failed to fetch items"
    });
  }
}


// ================= GET MY ITEMS API =================

async function getMyItems(req, res) {
  try {
    const items = await Item.find({
      userId: req.session.userId,
      cycle: getCurrentCycle()
    });

    res.json(items);

  } catch (err) {
    console.error("Get My Items Error:", err);

    res.status(500).json({
      error: "Failed to fetch your items"
    });
  }
}


// ================= GET COLLECTED ITEMS API =================

async function getCollectedItems(req, res) {
  try {
    const items = await Collected
      .find({ cycle: getCurrentCycle() })
      .sort({ collectedAt: -1 });

    res.json(items);

  } catch (err) {
    console.error("Get Collected Items Error:", err);

    res.status(500).json({
      error: "Failed to fetch collected items"
    });
  }
}


// ================= EXPORT =================

module.exports = {
  submitLost,
  submitFound,
  getItems,
  getMyItems,
  getCollectedItems
};