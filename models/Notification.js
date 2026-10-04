const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      default: "possible_match",
      index: true
    },
    lostItemId: {
      type: mongoose.Schema.Types.Mixed,
      ref: "Item"
    },
    foundItemId: {
      type: mongoose.Schema.Types.Mixed,
      ref: "Item"
    },
    relatedLostItemId: {
      type: mongoose.Schema.Types.Mixed,
      ref: "Item"
    },
    relatedFoundItemId: {
      type: mongoose.Schema.Types.Mixed,
      ref: "Item"
    },
    matchKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    itemName: {
      type: String,
      trim: true
    },
    location: {
      type: String,
      trim: true
    },
    date: {
      type: String,
      trim: true
    },
    matchProbability: {
      type: Number,
      default: 0
    },
    matchScore: {
      type: Number,
      default: 0
    },
    targetUrl: {
      type: String,
      default: "/items.html"
    },
    url: {
      type: String,
      default: "/items.html"
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for user notification feeds
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
