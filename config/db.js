const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

async function initializeDatabase(db) {
  const requiredCollections = [
    "archives",
    "claims",
    "collecteds",
    "items",
    "users"
  ];

  try {
    const collections = await db.listCollections().toArray();
    const existingNames = collections.map(col => col.name);

    for (const colName of requiredCollections) {
      if (!existingNames.includes(colName)) {
        await db.createCollection(colName);
        console.log(`[Database Init] Created collection: ${colName}`);
      } else {
        console.log(`[Database Init] Collection already exists: ${colName}`);
      }
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    const managerEmail = process.env.MANAGER_EMAIL;
    const managerPassword = process.env.MANAGER_PASSWORD;

    if (adminEmail && adminPassword) {
      const adminExists = await db
        .collection("users")
        .findOne({ email: adminEmail });

      if (!adminExists) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        await db.collection("users").insertOne({
          name: "Admin",
          email: adminEmail,
          password: hashedPassword,
          role: "admin",
          is_verified: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        console.log(`[Database Init] Admin created: ${adminEmail}`);
      }
    }

    if (managerEmail && managerPassword) {
      const managerExists = await db
        .collection("users")
        .findOne({ email: managerEmail });

      if (!managerExists) {
        const hashedPassword = await bcrypt.hash(managerPassword, 10);

        await db.collection("users").insertOne({
          name: "Manager",
          email: managerEmail,
          password: hashedPassword,
          role: "manager",
          is_verified: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        console.log(`[Database Init] Manager created: ${managerEmail}`);
      }
    }

    console.log(
      "[Database Init] Database structure verified and initialized successfully."
    );

  } catch (err) {
    console.error("[Database Init] Error:", err);
    throw err;
  }
}

// Global connection cache for serverless environments (Vercel)
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

let dbInitialized = false;

async function connectDB() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not configured in environment variables");
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        dbName: "findmything",
        serverSelectionTimeoutMS: 15000,
        maxPoolSize: 10
      })
      .then(async (m) => {
        console.log(`MongoDB Connected: ${m.connection.name}`);
        if (!dbInitialized) {
          try {
            await initializeDatabase(m.connection.db);
            dbInitialized = true;
          } catch (initErr) {
            console.error("[Database Init] Warning:", initErr.message);
          }
        }
        return m;
      })
      .catch((err) => {
        cached.promise = null; // Clear so subsequent requests can retry
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}

module.exports = connectDB;