const Item = require("../models/Item");
const { createDualNotification } = require("./notificationService");

// Configurable match threshold (percentage 0-100, default 70)
const MATCH_THRESHOLD = parseInt(process.env.MATCH_THRESHOLD, 10) || 70;

// Common stop words to filter during tokenization
const STOP_WORDS = new Set([
  "a", "an", "the", "my", "of", "in", "at", "on", "with", "and", "or",
  "is", "was", "for", "to", "from", "it", "this", "that", "near", "by",
  "some", "inside", "area", "please", "found", "lost", "item", "room"
]);

// Campus item taxonomy mapped to canonical categories for intelligent matching
const CANONICAL_CATEGORIES = {
  wallet: ["wallet", "purse", "pouch", "billfold"],
  card: ["card", "id", "idcard", "license", "badge", "admit"],
  keys: ["keys", "key", "keychain", "ring"],
  phone: ["phone", "mobile", "iphone", "samsung", "android", "smartphone", "cell"],
  laptop: ["laptop", "macbook", "notebook", "thinkpad", "dell", "hp"],
  audio: ["earphones", "headphones", "airpods", "buds", "earbuds"],
  watch: ["watch", "smartwatch", "fitbit", "titan", "casio"],
  bottle: ["bottle", "flask", "sipper", "milton"],
  bag: ["bag", "backpack", "sack", "duffel"],
  umbrella: ["umbrella"],
  glasses: ["glasses", "spectacles", "sunglasses", "shades"],
  clothing: ["jacket", "hoodie", "sweater", "coat", "cap", "blazer"],
  accessory: ["charger", "cable", "adapter", "pen", "calculator"]
};

/**
 * Normalize string by converting to lower case, trimming, and removing non-alphanumeric punctuation.
 */
function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Extract meaningful word tokens from text.
 */
function extractTokens(str) {
  const norm = normalizeText(str);
  if (!norm) return new Set();
  const words = norm.split(" ").filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  return new Set(words);
}

/**
 * Detect primary canonical category from item name, description, and optional explicit category.
 */
function detectCategory(name, desc, category) {
  const text = `${name || ""} ${desc || ""} ${category || ""}`.toLowerCase();
  for (const [canonical, aliases] of Object.entries(CANONICAL_CATEGORIES)) {
    for (const alias of aliases) {
      const regex = new RegExp(`\\b${alias}\\b`, "i");
      if (regex.test(text)) {
        return canonical;
      }
    }
  }
  return null;
}

/**
 * 1. Item Name Similarity Scoring (30 points max)
 */
function calculateNameScore(lostItem, foundItem) {
  const normLostName = normalizeText(lostItem.name);
  const normFoundName = normalizeText(foundItem.name);

  if (!normLostName || !normFoundName) {
    return 0;
  }

  if (normLostName === normFoundName) {
    return 30;
  }

  if (normLostName.includes(normFoundName) || normFoundName.includes(normLostName)) {
    return 27;
  }

  const lostTokens = extractTokens(lostItem.name);
  const foundTokens = extractTokens(foundItem.name);

  let intersection = 0;
  for (const t of lostTokens) {
    if (foundTokens.has(t)) intersection++;
  }

  const union = new Set([...lostTokens, ...foundTokens]).size;
  if (union > 0) {
    const jaccard = intersection / union;
    let score = Math.round(jaccard * 30);
    if (intersection >= 1) {
      score = Math.max(score, 20);
    }
    return score;
  }

  return 0;
}

/**
 * 2. Location Similarity Scoring (25 points max)
 */
function calculateLocationScore(lostItem, foundItem) {
  const lostLoc = normalizeText(lostItem.lostLocation || lostItem.location);
  const foundLoc = normalizeText(foundItem.foundLocation || foundItem.location);

  if (!lostLoc || !foundLoc || lostLoc === "mits admin office" || foundLoc === "mits admin office") {
    // If specific location field is available, use it
    const specificLost = normalizeText(lostItem.lostLocation);
    const specificFound = normalizeText(foundItem.foundLocation);
    if (!specificLost || !specificFound) {
      return 12; // Neutral if unrecorded
    }
  }

  const l1 = normalizeText(lostItem.lostLocation || lostItem.location);
  const l2 = normalizeText(foundItem.foundLocation || foundItem.location);

  if (l1 === l2) {
    return 25;
  }

  if (l1.includes(l2) || l2.includes(l1)) {
    return 22; // Substring inclusion (e.g. "Central Library" vs "Library")
  }

  const lostTokens = extractTokens(l1);
  const foundTokens = extractTokens(l2);
  let intersection = 0;
  for (const t of lostTokens) {
    if (foundTokens.has(t)) intersection++;
  }

  if (intersection > 0) {
    return 18; // Shared landmark tokens
  }

  return 0; // Distinct specified locations
}

/**
 * 3. Date Proximity Scoring (20 points max)
 */
function calculateDateScore(lostItem, foundItem) {
  const dateLostStr = lostItem.dateLost || lostItem.date;
  const dateFoundStr = foundItem.dateFound || foundItem.date;

  if (!dateLostStr || !dateFoundStr) {
    return 10; // Neutral if date omitted
  }

  const d1 = new Date(dateLostStr);
  const d2 = new Date(dateFoundStr);

  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
    return 10;
  }

  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 20;
  if (diffDays === 1) return 18;
  if (diffDays <= 3) return 14;
  if (diffDays <= 7) return 10;
  if (diffDays <= 14) return 6;
  return 3;
}

/**
 * 4. Category Similarity Scoring (15 points max)
 */
function calculateCategoryScore(lostItem, foundItem) {
  const normLostName = normalizeText(lostItem.name);
  const normFoundName = normalizeText(foundItem.name);

  // If items have explicit category fields
  if (lostItem.category && foundItem.category) {
    const normLostCat = normalizeText(lostItem.category);
    const normFoundCat = normalizeText(foundItem.category);
    if (normLostCat && normFoundCat) {
      if (normLostCat === normFoundCat) return 15;
      if (normLostCat.includes(normFoundCat) || normFoundCat.includes(normLostCat)) return 13;
    }
  }

  const lostCat = detectCategory(lostItem.name, lostItem.description, lostItem.category);
  const foundCat = detectCategory(foundItem.name, foundItem.description, foundItem.category);

  // Severe category conflict check (e.g., wallet vs laptop)
  const isSevereConflict =
    lostCat &&
    foundCat &&
    lostCat !== foundCat &&
    normLostName !== normFoundName &&
    !normLostName.includes(normFoundName) &&
    !normFoundName.includes(normLostName);

  if (isSevereConflict) {
    return 0;
  }

  if (lostCat && foundCat && lostCat === foundCat) {
    return 15;
  }

  if (!lostCat && !foundCat) {
    return 10; // Neutral baseline if unclassified
  }

  return 8; // One classified, other neutral
}

/**
 * 5. Description Similarity Scoring (10 points max)
 */
function calculateDescriptionScore(lostItem, foundItem) {
  const lostTokens = extractTokens(lostItem.description);
  const foundTokens = extractTokens(foundItem.description);

  if (lostTokens.size === 0 && foundTokens.size === 0) {
    return 6; // Both descriptions omitted: neutral baseline
  }

  if (lostTokens.size === 0 || foundTokens.size === 0) {
    return 5; // One description omitted: neutral
  }

  let intersection = 0;
  for (const t of lostTokens) {
    if (foundTokens.has(t)) intersection++;
  }

  const minTokens = Math.min(lostTokens.size, foundTokens.size);
  if (minTokens > 0) {
    const overlapRatio = intersection / minTokens;
    return Math.round(overlapRatio * 10);
  }

  return 0;
}

/**
 * Calculate transparent weighted match score between a LOST item and a FOUND item.
 *
 * Weight Distribution:
 * - Item Name:   30%
 * - Location:    25%
 * - Date:        20%
 * - Category:    15%
 * - Description: 10%
 * ───────────────────
 * Total:        100%
 *
 * @param {Object} lostItem
 * @param {Object} foundItem
 * @returns {{ score: number, breakdown: Object }}
 */
function calculateMatchScore(lostItem, foundItem) {
  if (!lostItem || !foundItem) {
    return { score: 0, breakdown: {} };
  }

  // Edge Case: Never match a report against itself
  if (
    lostItem._id &&
    foundItem._id &&
    lostItem._id.toString() === foundItem._id.toString()
  ) {
    return { score: 0, breakdown: { selfMatch: true } };
  }

  const nameScore = calculateNameScore(lostItem, foundItem);
  const locationScore = calculateLocationScore(lostItem, foundItem);
  const dateScore = calculateDateScore(lostItem, foundItem);
  const categoryScore = calculateCategoryScore(lostItem, foundItem);
  const descriptionScore = calculateDescriptionScore(lostItem, foundItem);

  let totalScore = nameScore + locationScore + dateScore + categoryScore + descriptionScore;

  // Severe category conflict penalty
  if (categoryScore === 0 && nameScore < 15) {
    totalScore = Math.min(totalScore, 25);
  }

  totalScore = Math.min(100, Math.max(0, Math.round(totalScore)));

  const lostCat = detectCategory(lostItem.name, lostItem.description, lostItem.category);
  const foundCat = detectCategory(foundItem.name, foundItem.description, foundItem.category);

  return {
    score: totalScore,
    breakdown: {
      nameScore,
      locationScore,
      dateScore,
      categoryScore,
      descriptionScore,
      lostCategory: lostCat,
      foundCategory: foundCat
    }
  };
}

/**
 * Automatically analyze a newly submitted item against opposite-type active reports.
 * Whenever a match >= MATCH_THRESHOLD is detected, dispatches a dual notification
 * strictly to the person who submitted the LOST report.
 *
 * Supports both directions:
 * - When LOST item is submitted: searches existing active FOUND items.
 * - When FOUND item is submitted: searches existing active LOST items.
 *
 * Logs clear server-side diagnostic information per prompt requirements.
 *
 * @param {Object} newItem - The recently saved Item mongoose document
 */
async function analyzeAndNotifyMatches(newItem) {
  if (!newItem || !newItem._id || !newItem.type) {
    return { matchesFound: 0 };
  }

  const reportType = String(newItem.type).toLowerCase();
  const isLostNew = reportType === "lost";
  const oppositeType = isLostNew ? "found" : "lost";

  console.log("\n====================================");
  console.log("FINDMYTHING MATCH ENGINE");
  console.log("====================================");
  console.log(`New report:`);
  console.log(`Type: ${reportType.toUpperCase()}`);
  console.log(`ID: ${newItem._id}`);
  console.log(`Name: ${newItem.name}`);
  console.log(`\nOpposite type:\n${oppositeType.toUpperCase()}\n`);

  let matchesCount = 0;

  try {
    // Query all active reports of opposite type (case-insensitive, available status)
    const candidateFilter = {
      type: new RegExp(`^${oppositeType}$`, "i"),
      $or: [
        { status: { $in: ["Available", "available"] } },
        { status: { $exists: false } },
        { status: null }
      ]
    };

    const candidates = await Item.find(candidateFilter).lean();
    console.log(`Candidates found:\n${candidates.length}\n`);

    for (const candidate of candidates) {
      // 1. Edge case: Never match against itself
      if (candidate._id.toString() === newItem._id.toString()) {
        continue;
      }

      // Determine LOST item vs FOUND item
      const lostItem = isLostNew ? newItem : candidate;
      const foundItem = isLostNew ? candidate : newItem;

      // If same user reported both items, log notice but still deliver to lostItem.userId (supports testing)
      if (
        lostItem.userId &&
        foundItem.userId &&
        lostItem.userId.toString() === foundItem.userId.toString()
      ) {
        console.log(`[Notice] Same user test detected -> notification will be delivered to LOST reporter (${lostItem.userId}).`);
      }

      const { score, breakdown } = calculateMatchScore(lostItem, foundItem);

      console.log(`Checking candidate:`);
      console.log(`${oppositeType.toUpperCase()} ID: ${candidate._id}`);
      console.log(`Name score: ${breakdown.nameScore}/30`);
      console.log(`Location score: ${breakdown.locationScore}/25`);
      console.log(`Date score: ${breakdown.dateScore}/20`);
      console.log(`Category score: ${breakdown.categoryScore}/15`);
      console.log(`Description score: ${breakdown.descriptionScore}/10`);
      console.log(`\nFINAL MATCH PROBABILITY: ${score}%`);
      console.log(`THRESHOLD: ${MATCH_THRESHOLD}%\n`);

      if (score >= MATCH_THRESHOLD) {
        console.log(`RESULT: MATCH FOUND`);
        console.log(`LOST OWNER: ${lostItem.userId}`);

        matchesCount++;
        const matchKey = `lost_${lostItem._id}_found_${foundItem._id}`;

        const itemName = foundItem.name || lostItem.name;
        const itemLocation = foundItem.foundLocation || foundItem.location || lostItem.lostLocation || "MITS Campus";
        const itemDate = foundItem.dateFound || lostItem.dateLost || "";
        const targetUrl = `/items.html?search=${encodeURIComponent(foundItem.name || "")}&id=${foundItem._id}`;

        const notifResult = await createDualNotification({
          userId: lostItem.userId,
          title: "Possible Match Found",
          itemName,
          location: itemLocation,
          date: itemDate,
          matchProbability: score,
          matchScore: score,
          message: `A found report may match your lost item: "${lostItem.name}".`,
          type: "possible_match",
          lostItemId: lostItem._id,
          foundItemId: foundItem._id,
          matchKey,
          targetUrl,
          url: targetUrl
        });

        if (notifResult.isDuplicate) {
          console.log(`IN-APP NOTIFICATION: SKIPPED (Duplicate prevention)`);
        } else {
          console.log(`IN-APP NOTIFICATION: CREATED`);
          console.log(`PUSH NOTIFICATION: DISPATCHED`);
        }
      } else {
        console.log(`RESULT: NO MATCH (Below threshold: ${MATCH_THRESHOLD}%)`);
      }
      console.log("------------------------------------\n");
    }

    console.log(`[Matching Summary] Total matches detected: ${matchesCount}`);
    console.log("====================================\n");
    return { matchesFound: matchesCount };
  } catch (err) {
    console.error("[Matching Engine] Error during match analysis:", err.message);
    console.log("====================================\n");
    // Fail safely - matching error must never throw or disrupt caller report submission
    return { matchesFound: matchesCount, error: err.message };
  }
}

module.exports = {
  MATCH_THRESHOLD,
  normalizeText,
  calculateNameScore,
  calculateLocationScore,
  calculateDateScore,
  calculateCategoryScore,
  calculateDescriptionScore,
  calculateMatchScore,
  analyzeAndNotifyMatches
};
