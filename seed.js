const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/findmything";

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB for seeding...");

    // Clear existing items and collecteds (only for found items to keep it clean)
    await mongoose.connection.db.collection('items').deleteMany({ type: "found" });
    await mongoose.connection.db.collection('collecteds').deleteMany({ type: "found" });
    console.log("Cleared existing found items.");

    // Define users
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash("password", 10);

    const mockUsers = [
      { name: "Pradeep Kumar", email: "22691A0501@mits.ac.in", password: hashedPassword, role: "user", is_verified: true },
      { name: "Rahul Sharma", email: "23691A0412@mits.ac.in", password: hashedPassword, role: "user", is_verified: true },
      { name: "Anil Verma", email: "24691A0305@mits.ac.in", password: hashedPassword, role: "user", is_verified: true },
      { name: "Siri Reddy", email: "24691A2803@mits.ac.in", password: hashedPassword, role: "user", is_verified: true },
      { name: "Keerthi Naidu", email: "25691A0102@mits.ac.in", password: hashedPassword, role: "user", is_verified: true },
      { name: "Divya Teja", email: "23691A3215@mits.ac.in", password: hashedPassword, role: "user", is_verified: true },
      { name: "Sandeep Rao", email: "22691A0210@mits.ac.in", password: hashedPassword, role: "user", is_verified: true },
      { name: "Pooja Hegde", email: "25691A3105@mits.ac.in", password: hashedPassword, role: "user", is_verified: true },
      { name: "Ravi Teja", email: "staff_ravi@mits.ac.in", password: hashedPassword, role: "user", is_verified: true },
      { name: "External Guest", email: "guest@gmail.com", password: hashedPassword, role: "user", is_verified: true }
    ];

    // Insert or update mock users in the users collection
    for (const u of mockUsers) {
      await mongoose.connection.db.collection('users').updateOne(
        { email: u.email },
        { $set: u },
        { upsert: true }
      );
    }
    console.log("Mock users upserted with hashed passwords.");

    // Helper to parse MITS email details (same as what backend will use)
    function parseEmail(email) {
      if (!email) return { department: "N/A", branch: "N/A", year: "N/A" };
      const match = email.match(/^(\d{2})691A(\d{2})[A-Z0-9]{2}@mits\.ac\.in$/i);
      if (match) {
        const yearDigits = parseInt(match[1]);
        const branchCode = match[2];
        const admissionYear = 2000 + yearDigits;
        const currentYear = 2026;
        let diff = currentYear - admissionYear;
        // Assume July start
        diff += 1;
        
        let yearName = "N/A";
        if (diff === 1) yearName = "1st Year";
        else if (diff === 2) yearName = "2nd Year";
        else if (diff === 3) yearName = "3rd Year";
        else if (diff === 4) yearName = "4th Year";
        else if (diff > 4) yearName = "Alumni";

        let branchName = "N/A";
        let deptName = "N/A";
        const branchMap = {
          "05": { dept: "CSE", branch: "Computer Science" },
          "04": { dept: "ECE", branch: "Electronics" },
          "03": { dept: "ME", branch: "Mechanical" },
          "02": { dept: "EEE", branch: "Electrical" },
          "01": { dept: "CE", branch: "Civil" },
          "28": { dept: "CST", branch: "Computer Science & Technology" },
          "32": { dept: "CSE-DS", branch: "Data Science" },
          "31": { dept: "CSE-AI", branch: "Artificial Intelligence" }
        };

        if (branchMap[branchCode]) {
          deptName = branchMap[branchCode].dept;
          branchName = branchMap[branchCode].branch;
        }

        return { department: deptName, branch: branchName, year: yearName };
      }
      if (email.endsWith("@mits.ac.in")) {
        return { department: "Administration", branch: "Staff", year: "N/A" };
      }
      return { department: "External", branch: "N/A", year: "N/A" };
    }

    // Found item submission configuration: User -> count of submissions
    const submissionCounts = {
      "22691A0501@mits.ac.in": 24, // Pradeep
      "23691A0412@mits.ac.in": 18, // Rahul
      "24691A0305@mits.ac.in": 13, // Anil
      "24691A2803@mits.ac.in": 9,  // Siri
      "25691A0102@mits.ac.in": 6,  // Keerthi
      "23691A3215@mits.ac.in": 5,  // Divya Teja
      "22691A0210@mits.ac.in": 4,  // Sandeep Rao
      "25691A3105@mits.ac.in": 3,  // Pooja Hegde
      "staff_ravi@mits.ac.in": 2,  // Ravi Teja
      "guest@gmail.com": 1         // Guest
    };

    const itemTitles = [
      "Water Bottle", "Math Textbook", "Lab Coat", "Keys", "Scientific Calculator", 
      "Pen Drive", "Watch", "Spectacles", "Earphones", "ID Card", 
      "Notebook", "Umbrella", "Wallet", "Lunch Box", "File Folder"
    ];

    const locations = [
      "MITS Admin Office", "CSE Lab 3", "Library", "Mechanical Seminar Hall", 
      "Canteen", "Grounds", "Block B Seminar Hall", "ECE Lab 1"
    ];

    const categories = ["Electronics", "Books", "Clothing", "Personal Items", "Documents", "Others"];

    // Date generation helper: Random date between August 14, 2025 and January 26, 2026
    const startDate = new Date("2025-08-14T00:00:00");
    const endDate = new Date("2026-01-26T23:59:59");
    const timeRange = endDate.getTime() - startDate.getTime();

    function getRandomDate() {
      return new Date(startDate.getTime() + Math.random() * timeRange);
    }

    const itemsToInsert = [];
    const collectedsToInsert = [];

    for (const [email, count] of Object.entries(submissionCounts)) {
      const user = mockUsers.find(u => u.email === email);
      const details = parseEmail(email);

      for (let i = 0; i < count; i++) {
        const itemDate = getRandomDate();
        const itemTitle = itemTitles[Math.floor(Math.random() * itemTitles.length)];
        const category = categories[Math.floor(Math.random() * categories.length)];
        const loc = locations[Math.floor(Math.random() * locations.length)];
        
        // Distribute some as active Items and some as Collected items to test union aggregation
        const isCollected = Math.random() < 0.4; 

        const record = {
          name: `${itemTitle} ${i + 1}`,
          description: `A lost and found ${itemTitle.toLowerCase()} of category ${category.toLowerCase()}.`,
          location: "MITS Admin Office",
          foundLocation: loc,
          dateFound: itemDate.toISOString().split('T')[0],
          userId: email, 
          userName: user.name,
          userEmail: email,
          contact: "9876543210",
          type: "found",
          image: "default_item.jpg",
          handedBy: "Staff / Student",
          handedTo: "Admin Office",
          cycle: "CYCLE_2",
          status: isCollected ? "Collected" : "Available",
          department: details.department,
          branch: details.branch,
          year: details.year
        };

        if (isCollected) {
          collectedsToInsert.push({
            ...record,
            collectedAt: new Date(itemDate.getTime() + 2 * 24 * 60 * 60 * 1000) 
          });
        } else {
          itemsToInsert.push({
            ...record,
            createdAt: itemDate
          });
        }
      }
    }

    if (itemsToInsert.length > 0) {
      await mongoose.connection.db.collection('items').insertMany(itemsToInsert);
      console.log(`Inserted ${itemsToInsert.length} active found items.`);
    }
    if (collectedsToInsert.length > 0) {
      await mongoose.connection.db.collection('collecteds').insertMany(collectedsToInsert);
      console.log(`Inserted ${collectedsToInsert.length} collected found items.`);
    }

    console.log("Seeding completed successfully!");
    await mongoose.disconnect();
  } catch (err) {
    console.error("Seeding error:", err);
  }
}

seed();
