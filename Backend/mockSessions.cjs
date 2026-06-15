require("dotenv").config();
const mongoose = require("mongoose");

const activeSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  email: String,
  loginId: String,
  role: String,
  loginTime: { type: Date, default: Date.now },
  deviceInfo: String,
  ipAddress: String,
  status: { type: String, default: "active" }
});
const ActiveSession = mongoose.model("ActiveSession", activeSessionSchema);

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");

  await ActiveSession.create({
    sessionId: "mock_pooja_" + Date.now(),
    email: "pooja@gmail.com",
    loginId: "pooja",
    role: "User",
    loginTime: new Date(Date.now() - 1000 * 60 * 15), // 15 mins ago
    deviceInfo: "Safari on macOS",
    ipAddress: "192.168.1.45"
  });

  await ActiveSession.create({
    sessionId: "mock_sadhana_" + Date.now(),
    email: "sadhana@gmail.com",
    loginId: "sadhana",
    role: "User",
    loginTime: new Date(Date.now() - 1000 * 60 * 45), // 45 mins ago
    deviceInfo: "Chrome on Windows 11",
    ipAddress: "192.168.1.102"
  });

  console.log("Inserted mock sessions for pooja and sadhana!");
  process.exit(0);
}

run().catch(console.error);
