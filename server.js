const dns = require("dns");

// Use public DNS servers safely (for SRV lookup support)
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Ignore if custom DNS cannot be set by environment
}

const express = require("express");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const helmet = require("helmet");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

// Load environment variables
dotenv.config();

// Database
const connectDB = require("./config/db");

// Helpers
const {
  runStartupMigration,
  getCurrentCycle
} = require("./utils/helper");

// Models
const Item = require("./models/Item");
const Collected = require("./models/Collected");

// Routes
const authRoutes = require("./routes/authRoutes");
const itemRoutes = require("./routes/itemRoutes");
const adminRoutes = require("./routes/adminRoutes");
const userRoutes = require("./routes/userRoutes");
const pushRoutes = require("./routes/pushRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

// Error handler
const errorHandler = require("./middleware/errorHandler");

// ======================================================
// EXPRESS APP
// ======================================================

const app = express();

const PORT = process.env.PORT || 3000;

const mongoUri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  (isProduction ? "" : "mongodb://127.0.0.1:27017/findmything");

const isProduction =
  process.env.NODE_ENV === "production";

// ======================================================
// TRUST PROXY
// ======================================================

app.set("trust proxy", 1);

// ======================================================
// SECURITY HEADERS
// ======================================================

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// ======================================================
// BASIC MIDDLEWARE
// ======================================================

app.use(
  express.urlencoded({
    extended: true
  })
);

app.use(express.json());

// ======================================================
// UPLOADS DIRECTORY
// ======================================================

const uploadsDir = path.join(
  __dirname,
  "public/uploads"
);

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, {
    recursive: true
  });
}

// ======================================================
// SESSION
// ======================================================

const sessionConfig = {
  secret:
    process.env.SESSION_SECRET ||
    "findmything_session_secret_default_key",

  resave: false,

  saveUninitialized: false,

  cookie: {
    httpOnly: true,

    secure: isProduction,

    sameSite: "lax",

    maxAge: 7 * 24 * 60 * 60 * 1000
  }
};

if (mongoUri) {
  sessionConfig.store = MongoStore.create({
    mongoUrl: mongoUri,
    dbName: "findmything",
    collectionName: "sessions",
    ttl: 7 * 24 * 60 * 60,
    autoRemove: "native"
  });
}

app.use(session(sessionConfig));

// ======================================================
// STATIC FILES
// ======================================================

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

app.use(
  "/uploads",
  express.static(
    path.join(__dirname, "public/uploads")
  )
);

// Serve favicon explicitly to prevent 404s
app.get(["/favicon.ico", "/favicon.png"], (req, res) => {
  const faviconPath = path.join(__dirname, "public/favicon.ico");
  if (fs.existsSync(faviconPath)) {
    return res.sendFile(faviconPath);
  }
  return res.status(204).end();
});

// ======================================================
// DATABASE CONNECTION MIDDLEWARE (SERVERLESS SAFE)
// ======================================================

app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch (err) {
    console.error("Database connection unavailable for request:", err.message);
  }
  next();
});

// ======================================================
// ROUTES
// ======================================================

app.use(authRoutes);

app.use(itemRoutes);

app.use(adminRoutes);

app.use(userRoutes);

app.use(pushRoutes);

app.use(notificationRoutes);

// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================

app.use(errorHandler);

// ======================================================
// LOCAL SERVER & BACKGROUND TASKS
// ======================================================

// Start local server and background timers ONLY when running directly
if (require.main === module) {

  connectDB()
    .then(() => {

      console.log("Database connection initialized.");

      // Run migration after database connection
      setTimeout(() => {
        runStartupMigration();
      }, 1000);

      app.listen(PORT, () => {

        console.log(
          `Server running in ${isProduction
            ? "production"
            : "development"
          } mode on port ${PORT}`
        );

      });

    })
    .catch((err) => {

      console.error(
        "Failed to initialize database:",
        err
      );

    });

  // AUTO DELETE OLD COLLECTED ITEMS (Persistent server only)
  setInterval(async () => {

    try {

      const date = new Date();

      date.setMonth(
        date.getMonth() - 1
      );

      await Collected.deleteMany({
        collectedAt: {
          $lt: date
        }
      });

      console.log(
        "Auto delete: Old collected items checked."
      );

    } catch (err) {

      console.error(
        "Auto delete collected interval error:",
        err.message
      );

    }

  }, 86400000);

  // AUTO CYCLE RESET (Persistent server only)
  let lastCycle = getCurrentCycle();

  setInterval(async () => {

    try {

      const currentCycle =
        getCurrentCycle();

      if (currentCycle !== lastCycle) {

        console.log(
          "🔄 Cycle Changed → Resetting Data"
        );

        await Item.deleteMany({
          cycle: lastCycle
        });

        await Collected.deleteMany({
          cycle: lastCycle
        });

        lastCycle = currentCycle;

      }

    } catch (err) {

      console.error(
        "Auto cycle reset interval error:",
        err.message
      );

    }

  }, 86400000);

}

// ======================================================
// EXPORT FOR VERCEL
// ======================================================

module.exports = app;