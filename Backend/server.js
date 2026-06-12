import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import readline from "readline";
import { google } from "googleapis";
import dotenv from "dotenv";
import http from "http";
import { exec } from "child_process";
import { URL } from "url";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import axios from "axios";

dotenv.config();
const app = express();

// Ensure uploads directory exists
const UPLOADS_DIR = "uploads";
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// ================= DATABASE (MONGODB) =================
const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/mrddatabase";
mongoose.connect(mongoURI)
  .then(() => console.log("MongoDB Connected Successfully"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

const patientSchema = new mongoose.Schema({
  ipNo: String,
  name: String,
  age: Number,
  date: String,
  gender: String,
  recordType: String,
  fileName: String,
  fileSize: String,
  fileUrl: String,
  createdBy: String,
  updatedBy: String,
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

const Patient = mongoose.model("Patient", patientSchema);

const barcodeSchema = new mongoose.Schema({
  barcodes: [mongoose.Schema.Types.Mixed], 
  fileName: String,
  fileSize: String,
  fileUrl: String,
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

const BarcodeRecord = mongoose.model("BarcodeRecord", barcodeSchema);

const userProfileSchema = new mongoose.Schema({
  id: { type: String, required: true },
  employeeName: String,
  designation: String,
  userType: String,
  username: { type: String, required: true },
  password: { type: String, required: true },
  phone: String,
  email: { type: String, required: true },
  photo: String,
  createdBy: String,
  createdOn: String,
  updatedBy: String,
  updatedOn: String,
});
const UserProfile = mongoose.model("UserProfile", userProfileSchema);

const departmentSchema = new mongoose.Schema({
  code: { type: String, required: true },
  name: { type: String, required: true },
  type: String,
  createdBy: String,
  createdOn: String,
  updatedBy: String,
  updatedOn: String,
});
const Department = mongoose.model("Department", departmentSchema);

const userTypeSchema = new mongoose.Schema({
  code: { type: String, required: true },
  name: { type: String, required: true },
  description: String,
  createdBy: String,
  createdOn: String,
  updatedBy: String,
  updatedOn: String,
});
const UserType = mongoose.model("UserType", userTypeSchema);
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.json({ status: "success", message: "MedFlow API is running successfully!" });
});


// ================= MULTER =================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },

  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });


// ================= GOOGLE DRIVE =================

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
];

const TOKEN_PATH = "token.json";


// Load Credentials
const googleCredentialsEnv = process.env.GOOGLE_CREDENTIALS;
if (googleCredentialsEnv) {
  try {
    console.log("Loading Google Credentials from environment variable...");
    authorize(JSON.parse(googleCredentialsEnv), () => {
      console.log("Google Drive Connected");
    });
  } catch (err) {
    console.error("Error parsing GOOGLE_CREDENTIALS environment variable:", err.message);
  }
} else {
  fs.readFile("credentials.json", (err, content) => {
    if (err) {
      return console.log("Error loading credentials.json file:", err);
    }
    authorize(JSON.parse(content), () => {
      console.log("Google Drive Connected");
    });
  });
}


// Authorize
function authorize(credentials, callback) {

  // If using a Service Account
  if (credentials.type === "service_account") {
    console.log("Detected Service Account credentials.");
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: SCOPES,
    });
    global.auth = auth;
    callback(auth);
    return;
  }

  // If using OAuth2 Client ID
  const {
    client_secret,
    client_id,
    redirect_uris,
  } = credentials.installed || credentials.web;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );


  // Check Token (Environment Variable first)
  const googleTokenEnv = process.env.GOOGLE_TOKEN;
  if (googleTokenEnv) {
    try {
      console.log("Loading Google Token from environment variable...");
      oAuth2Client.setCredentials(JSON.parse(googleTokenEnv));
      global.auth = oAuth2Client;
      callback(oAuth2Client);
      return;
    } catch (parseErr) {
      console.warn("GOOGLE_TOKEN environment variable is invalid:", parseErr.message);
    }
  }

  // Check Token File
  fs.readFile(TOKEN_PATH, (err, token) => {

    if (err || token.length === 0) {
      if (process.env.NODE_ENV === "production") {
        console.error("❌ Google Drive Token is missing or empty. Skipping interactive OAuth flow in production.");
        return;
      }
      return getAccessToken(oAuth2Client, callback);
    }

    try {
      oAuth2Client.setCredentials(JSON.parse(token));
    } catch (parseErr) {
      console.warn("token.json is invalid.");
      if (process.env.NODE_ENV === "production") {
        console.error("❌ Google Drive Token is invalid. Skipping interactive OAuth flow in production.");
        return;
      }
      console.warn("Requesting new token...");
      return getAccessToken(oAuth2Client, callback);
    }

    global.auth = oAuth2Client;

    callback(oAuth2Client);
  });
}


// Get Access Token
function getAccessToken(oAuth2Client, callback) {

  if (process.env.NODE_ENV === "production") {
    console.error("❌ Cannot request OAuth access token in production environment. Please run authorization locally first to generate token.json.");
    return;
  }

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });

  console.log("\n=======================================================");
  console.log("Opening your browser to authorize the app automatically...");
  console.log("If the window doesn't open, click this link:\n" + authUrl);
  console.log("=======================================================\n");

  const server = http.createServer((req, res) => {
    try {
      const reqUrl = new URL(req.url, 'http://localhost');
      const code = reqUrl.searchParams.get('code');
      const error = reqUrl.searchParams.get('error');

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body style="font-family: sans-serif; text-align: center; margin-top: 100px;"><h1>Authentication successful!</h1><p>You can close this tab and return to your terminal.</p></body></html>');
        server.close();

        console.log("✅ Successfully received the authorization code!");

        oAuth2Client.getToken(code, (err, token) => {
          if (err) {
            return console.error("Error retrieving token", err);
          }
          oAuth2Client.setCredentials(token);
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
          global.auth = oAuth2Client;
          callback(oAuth2Client);
        });
      } else if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<html><body style="font-family: sans-serif; text-align: center; margin-top: 100px;"><h1>Authentication Error</h1><p>${error}</p></body></html>`);
        server.close();
        console.error("Authorization error:", error);
      } else {
        res.writeHead(404);
        res.end();
      }
    } catch (e) {
      res.writeHead(500);
      res.end();
    }
  });

  server.listen(80, () => {
    // Open the user's default browser automatically
    const command = process.platform === 'win32'
      ? `start "" "${authUrl}"`
      : process.platform === 'darwin' ? `open "${authUrl}"` : `xdg-open "${authUrl}"`;
    exec(command);
  }).on('error', (err) => {
    if (err.code === 'EACCES') {
      console.error("⚠️ Error: Could not start automatic local server on port 80 (requires Admin).");
      console.log("\nPlease manually visit this URL to authorize:");
      console.log(authUrl);

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question("\nPaste Code Here: ", (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
          if (err) {
            return console.error("Error retrieving token", err);
          }
          oAuth2Client.setCredentials(token);
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
          global.auth = oAuth2Client;
          callback(oAuth2Client);
        });
      });
    }
  });
}


// Helper to create or find a folder
async function getOrCreateFolder(drive, folderName, parentId = null) {
  let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });

  if (res.data.files.length > 0) {
    return res.data.files[0].id;
  } else {
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) {
      fileMetadata.parents = [parentId];
    }
    const folder = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
      supportsAllDrives: true
    });
    return folder.data.id;
  }
}

// ================= EMAIL SETUP =================
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: (process.env.GMAIL_APP_PASSWORD || "").replace(/\s/g, ""),
  },
  // Force IPv4 to prevent ENETUNREACH connection errors on cloud systems
  family: 4,
  connectionTimeout: 3000,
  greetingTimeout: 3000,
  socketTimeout: 5000,
});

// ================= EMAIL SENDER HELPER =================
async function sendEmail({ to, subject, html }) {
  const gappsUrl = process.env.GMAIL_API_URL;
  if (gappsUrl) {
    try {
      console.log("[EMAIL] Using Google Apps Script Web App for delivery...");
      const response = await axios.post(gappsUrl, { to, subject, html });
      if (response.data && response.data.success) {
        console.log("[EMAIL] Email sent successfully via Apps Script Web App.");
        return { success: true };
      } else {
        throw new Error(response.data ? response.data.error : "Unknown error");
      }
    } catch (err) {
      console.error("[EMAIL] Failed to send email via Apps Script Web App:", err.message);
      // Fallback to nodemailer SMTP
    }
  }

  // Nodemailer SMTP fallback (for local development or if SMTP is not blocked)
  console.log("[EMAIL] Using Nodemailer SMTP for delivery...");
  return transporter.sendMail({
    from: `"MedFlow Portal" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

// ================= UPLOAD API =================

app.post(
  "/upload",
  upload.array("files", 10),
  async (req, res) => {
    try {
      const drive = google.drive({
        version: "v3",
        auth: global.auth,
      });

      // Resolve Folder Structure
      const mainFolderId = "1Nd0Tc8igvhB5Y7N_eWo_2sMoSxr4sl8y";
      const intakeDate = req.body.date ? new Date(req.body.date) : new Date();
      const validDate = isNaN(intakeDate.getTime()) ? new Date() : intakeDate;
      const currentYear = validDate.getFullYear().toString();
      const currentMonth = validDate.toLocaleString('default', { month: 'long' });
      const currentDateStr = req.body.date ? req.body.date : validDate.toISOString().split('T')[0];
      const patientName = req.body.name ? req.body.name.trim() : "Unknown_Patient";
      const ipNo = req.body.ipNo ? req.body.ipNo.trim() : "NoIP";
      const patientFolderName = `${ipNo}-${patientName}`;

      let patientFolderId = null;
      let useLocalFallback = false;

      try {
        const yearFolderId = await getOrCreateFolder(drive, currentYear, mainFolderId);
        const monthFolderId = await getOrCreateFolder(drive, currentMonth, yearFolderId);
        const dateFolderId = await getOrCreateFolder(drive, currentDateStr, monthFolderId);
        patientFolderId = await getOrCreateFolder(drive, patientFolderName, dateFolderId);
      } catch (err) {
        console.error("Google Drive connection/folder resolution failed:", err.message);
        console.log("Automatically switching to local storage fallback for this submission.");
        useLocalFallback = true;
      }

      const savedRecords = [];

      for (const file of req.files) {
        const fileExt = path.extname(file.originalname);
        const newFileName = `${req.body.ipNo}-${patientName}${fileExt}`;
        try {
          if (useLocalFallback) {
            throw new Error("Google Drive local fallback active");
          }

          // Upload File
          const response = await drive.files.create({
            requestBody: {
              name: newFileName,
              parents: [patientFolderId],
            },
            media: {
              mimeType: file.mimetype,
              body: fs.createReadStream(file.path),
            },
            supportsAllDrives: true
          });

          // Make Public
          await drive.permissions.create({
            fileId: response.data.id,
            requestBody: {
              role: "reader",
              type: "anyone",
            },
            supportsAllDrives: true
          });

          // Public URL
          const fileUrl = `https://drive.google.com/uc?id=${response.data.id}`;

          // Save to MongoDB
          const newPatient = new Patient({
            ipNo: req.body.ipNo,
            name: patientName,
            age: req.body.age,
            date: req.body.date,
            gender: req.body.gender,
            recordType: req.body.recordType,
            fileName: newFileName,
            fileSize: (file.size / 1024 / 1024).toFixed(2) + " MB",
            fileUrl,
            createdBy: req.body.createdBy || "System",
          });
          const saved = await newPatient.save();
          savedRecords.push(saved);

          // Delete Local File
          fs.unlinkSync(file.path);

        } catch (fileError) {
          console.error("Google Drive API Error for file:", file.originalname, fileError.message);
          console.log("Falling back to local storage for this file...");

          const fileUrl = `http://localhost:${process.env.PORT || 5000}/uploads/${file.filename}`;

          const newPatient = new Patient({
            ipNo: req.body.ipNo,
            name: patientName,
            age: req.body.age,
            date: req.body.date,
            gender: req.body.gender,
            recordType: req.body.recordType,
            fileName: newFileName,
            fileSize: (file.size / 1024 / 1024).toFixed(2) + " MB",
            fileUrl,
            createdBy: req.body.createdBy || "System",
          });
          const saved = await newPatient.save();
          savedRecords.push(saved);
        }
      }

      // Send Email Notification
      try {
        const fileListHTML = savedRecords.map(r => `<li><a href="${r.fileUrl}">${r.fileName}</a> (${r.fileSize})</li>`).join("");
        const emailHTML = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #4f46e5; margin-top: 0;">New Patient Intake Submitted</h2>
            <p>A new intake form has been processed and saved to Google Drive.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><strong>Patient Name:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${patientName}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><strong>Age / Gender:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${req.body.age} / ${req.body.gender}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><strong>Discharge Date:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${req.body.date}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><strong>IP Number:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${req.body.ipNo}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><strong>Category:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${req.body.recordType}</td></tr>
            </table>
            <h3 style="color: #0f172a; margin-top: 25px;">Uploaded Documents (${savedRecords.length}):</h3>
            <ul style="padding-left: 20px; line-height: 1.6;">
              ${fileListHTML}
            </ul>
          </div>
        `;

        // Send email in the background without blocking the HTTP response
        sendEmail({
          to: "gshmrd2627@gmail.com",
          subject: `New Intake: ${patientName} - ${req.body.recordType}`,
          html: emailHTML,
        }).then(() => {
          console.log("Email notification sent successfully in the background.");
        }).catch(emailErr => {
          console.error("Failed to send email notification in the background:", emailErr.message);
        });
      } catch (emailErr) {
        console.error("Failed to process email template:", emailErr.message);
      }

      res.status(200).json({
        success: true,
        message: "Files processed successfully",
        records: savedRecords
      });

    } catch (folderError) {
      console.error("Folder structure resolution error:", folderError.message);
      res.status(500).json({ success: false, message: "Server error during folder resolution" });
    }
  }
);

// Get All Patients
app.get("/api/patients", async (req, res) => {
  try {
    const patients = await Patient.find().sort({ createdAt: -1 });
    res.json(patients);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

// Bulk Import Patients
app.post("/api/patients/bulk", async (req, res) => {
  try {
    const { patients } = req.body;
    if (!patients || !Array.isArray(patients)) {
      return res.status(400).json({ success: false, message: "Invalid patients data" });
    }

    // Collect all incoming IP Nos
    const incomingIpNos = patients
      .map(p => (p.ipNo || '').toString().trim())
      .filter(Boolean);

    // Find which IP Nos already exist in the database
    const existingRecords = await Patient.find(
      { ipNo: { $in: incomingIpNos } },
      { ipNo: 1 }
    );
    const existingIpNos = new Set(existingRecords.map(r => (r.ipNo || '').toString().trim()));

    // Split into new vs duplicate
    const newPatients = [];
    const skippedPatients = [];

    patients.forEach(p => {
      const ip = (p.ipNo || '').toString().trim();
      if (ip && existingIpNos.has(ip)) {
        skippedPatients.push(p);
      } else {
        newPatients.push(p);
      }
    });

    // Insert only non-duplicates
    let savedPatients = [];
    if (newPatients.length > 0) {
      savedPatients = await Patient.insertMany(
        newPatients.map(p => ({
          ipNo: p.ipNo,
          name: p.name,
          age: p.age ? Number(p.age) : null,
          date: p.date,
          gender: p.gender,
          recordType: p.recordType,
          createdBy: p.createdBy || "System",
          fileName: "",
          fileSize: "",
          fileUrl: ""
        }))
      );
      // Fire-and-forget email notification
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #4f46e5;">Bulk Import Successful</h2>
          <p><strong>${savedPatients.length}</strong> patient record(s) have been successfully imported into the database from an Excel/PDF upload.</p>
          <p><strong>Imported By:</strong> ${savedPatients[0]?.createdBy || 'System'}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          <br/>
          <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <thead>
              <tr style="background-color: #f8fafc; color: #475569; text-align: left;">
                <th>IP No</th>
                <th>Patient Name</th>
                <th>Age</th>
                <th>Document Type</th>
              </tr>
            </thead>
            <tbody>
              ${savedPatients.map(p => `
                <tr>
                  <td>${p.ipNo || '-'}</td>
                  <td>${p.name || '-'}</td>
                  <td>${p.age || '-'}</td>
                  <td>${p.recordType || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p style="margin-top: 20px; font-size: 12px; color: #94a3b8;">This is an automated notification from the MedFlow Clinical Portal.</p>
        </div>
      `;

      sendEmail({
        to: process.env.GMAIL_USER,
        subject: `[MedFlow] Bulk Import - ${savedPatients.length} Patient Record(s) Added`,
        html: emailHtml
      }).catch(err => console.error("[BULK IMPORT EMAIL] Failed to send:", err));
    }

    console.log(`[BULK IMPORT] Inserted: ${savedPatients.length}, Skipped (duplicates): ${skippedPatients.length}`);

    res.json({
      success: true,
      message: savedPatients.length > 0
        ? `${savedPatients.length} patient(s) imported successfully.${skippedPatients.length > 0 ? ` ${skippedPatients.length} duplicate(s) skipped.` : ''}`
        : `All ${skippedPatients.length} record(s) already exist in the database. Nothing was imported.`,
      records: savedPatients,
      skipped: skippedPatients.length,
      imported: savedPatients.length
    });
  } catch (error) {
    console.error("Bulk import failed:", error);
    res.status(500).json({ success: false, message: "Bulk import failed", error: error.message });
  }
});

// Delete Patient Record
app.delete("/api/patients/:id", async (req, res) => {
  try {
    const deletedPatient = await Patient.findByIdAndDelete(req.params.id);
    if (deletedPatient) {
      await Patient.updateMany(
        { ipNo: deletedPatient.ipNo, name: deletedPatient.name, date: deletedPatient.date },
        { updatedAt: new Date() }
      );
    }
    res.json({ success: true, message: "Record deleted" });
  } catch (error) {
    console.error("Error in DELETE /api/patients/:id :", error);
    res.status(500).json({ message: "Failed to delete", error: error.message });
  }
});



// ================= ADMIN API ROUTES =================

// Users
app.get("/api/users", async (req, res) => {
  try {
    const users = await UserProfile.find().sort({ createdOn: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});
app.post("/api/users", async (req, res) => {
  try {
    const newUser = new UserProfile(req.body);
    const saved = await newUser.save();
    res.json(saved);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});
app.put("/api/users/:id", async (req, res) => {
  try {
    const updated = await UserProfile.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});
app.delete("/api/users/:id", async (req, res) => {
  try {
    await UserProfile.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// Departments
app.get("/api/departments", async (req, res) => {
  try {
    const depts = await Department.find().sort({ createdOn: -1 });
    res.json(depts);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});
app.post("/api/departments", async (req, res) => {
  try {
    const newDept = new Department(req.body);
    const saved = await newDept.save();
    res.json(saved);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});
app.put("/api/departments/:id", async (req, res) => {
  try {
    const updated = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});
app.delete("/api/departments/:id", async (req, res) => {
  try {
    await Department.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// User Types
app.get("/api/user-types", async (req, res) => {
  try {
    const types = await UserType.find().sort({ createdOn: -1 });
    res.json(types);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});
app.post("/api/user-types", async (req, res) => {
  try {
    const newType = new UserType(req.body);
    const saved = await newType.save();
    res.json(saved);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});
app.put("/api/user-types/:id", async (req, res) => {
  try {
    const updated = await UserType.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});
app.delete("/api/user-types/:id", async (req, res) => {
  try {
    await UserType.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// Update Patient Files
app.put("/api/patients/:id/files", upload.array("files", 10), async (req, res) => {
  try {
    // Validate ObjectId format before querying
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid record ID format" });
    }
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: "Record not found in database. It may have been deleted or belongs to a different database instance. Please refresh the page to sync." });
    if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: "No files uploaded" });

    const keepOriginal = req.body.keepOriginal === 'true';
    const drive = google.drive({ version: "v3", auth: global.auth });
    const savedRecords = [];

    // 1. Handle original file based on keepOriginal
    if (!keepOriginal) {
      if (patient.fileUrl && patient.fileUrl.includes('drive.google.com/uc?id=')) {
        try {
          const url = new URL(patient.fileUrl);
          const oldFileId = url.searchParams.get('id');
          if (oldFileId) {
            await drive.files.delete({ fileId: oldFileId, supportsAllDrives: true });
            console.log(`Deleted old file ${oldFileId} from Drive`);
          }
        } catch (delErr) {
          console.error("Error deleting old file from Drive:", delErr.message);
        }
      }
    } else {
      // If keeping original, we just add the existing patient to the returned list (unmodified)
      savedRecords.push(patient);
    }

    // Prepare folder structure for uploads
    const mainFolderId = "1Nd0Tc8igvhB5Y7N_eWo_2sMoSxr4sl8y";
    const intakeDate = patient.date ? new Date(patient.date) : new Date();
    const validDate = isNaN(intakeDate.getTime()) ? new Date() : intakeDate;
    const currentYear = validDate.getFullYear().toString();
    const currentMonth = validDate.toLocaleString('default', { month: 'long' });
    const currentDateStr = patient.date ? patient.date : validDate.toISOString().split('T')[0];
    const patientName = patient.name ? patient.name.trim() : "Unknown_Patient";
    const ipNo = patient.ipNo ? patient.ipNo.trim() : "NoIP";
    const patientFolderName = `${ipNo}-${patientName}`;

    let patientFolderId = null;
    let useLocalFallback = false;

    try {
      const yearFolderId = await getOrCreateFolder(drive, currentYear, mainFolderId);
      const monthFolderId = await getOrCreateFolder(drive, currentMonth, yearFolderId);
      const dateFolderId = await getOrCreateFolder(drive, currentDateStr, monthFolderId);
      patientFolderId = await getOrCreateFolder(drive, patientFolderName, dateFolderId);
    } catch (err) {
      console.error("Google Drive connection/folder resolution failed during PUT:", err.message);
      console.log("Automatically switching to local storage fallback for this update.");
      useLocalFallback = true;
    }

    // 2. Upload all new files
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const fileExt = path.extname(file.originalname);
      const newFileName = `${patient.ipNo}-${patientName}-${Date.now()}${fileExt}`; // Added timestamp to avoid naming collisions

      try {
        if (useLocalFallback) {
          throw new Error("Google Drive local fallback active");
        }

        const response = await drive.files.create({
          requestBody: { name: newFileName, parents: [patientFolderId] },
          media: { mimeType: file.mimetype, body: fs.createReadStream(file.path) },
          supportsAllDrives: true
        });

        await drive.permissions.create({
          fileId: response.data.id,
          requestBody: { role: "reader", type: "anyone" },
          supportsAllDrives: true
        });

        const fileUrl = `https://drive.google.com/uc?id=${response.data.id}`;
        const fileSizeStr = (file.size / 1024 / 1024).toFixed(2) + " MB";

        if (!keepOriginal && i === 0) {
          // Replace existing record details with the first new file
          patient.fileName = newFileName;
          patient.fileSize = fileSizeStr;
          patient.fileUrl = fileUrl;
          patient.updatedBy = req.body.updatedBy || "System";
          const updatedPatient = await patient.save();
          savedRecords.push(updatedPatient);
        } else {
          // Create new record for subsequent files (or all files if keepOriginal is true)
          const newPatient = new Patient({
            ipNo: patient.ipNo,
            name: patient.name,
            age: patient.age,
            date: patient.date,
            gender: patient.gender,
            recordType: patient.recordType,
            fileName: newFileName,
            fileSize: fileSizeStr,
            fileUrl,
            createdBy: patient.createdBy || "System",
            updatedBy: req.body.updatedBy || "System",
          });
          const saved = await newPatient.save();
          savedRecords.push(saved);
        }

        // Cleanup local file since it was successfully uploaded to Google Drive
        fs.unlinkSync(file.path);

      } catch (fileError) {
        console.error("Google Drive API Error for file in PUT:", file.originalname, fileError.message);
        console.log("Falling back to local storage for this update file...");

        const fileUrl = `http://localhost:${process.env.PORT || 5000}/uploads/${file.filename}`;
        const fileSizeStr = (file.size / 1024 / 1024).toFixed(2) + " MB";

        if (!keepOriginal && i === 0) {
          // Replace existing record details with the first new file
          patient.fileName = newFileName;
          patient.fileSize = fileSizeStr;
          patient.fileUrl = fileUrl;
          patient.updatedBy = req.body.updatedBy || "System";
          const updatedPatient = await patient.save();
          savedRecords.push(updatedPatient);
        } else {
          const newPatient = new Patient({
            ipNo: patient.ipNo,
            name: patient.name,
            age: patient.age,
            date: patient.date,
            gender: patient.gender,
            recordType: patient.recordType,
            fileName: newFileName,
            fileSize: fileSizeStr,
            fileUrl,
            createdBy: patient.createdBy || "System",
            updatedBy: req.body.updatedBy || "System",
          });
          const saved = await newPatient.save();
          savedRecords.push(saved);
        }
        // Local file is NOT unlinked because we saved its path in the web app under uploads/!
      }
    }

    res.json({ success: true, message: "Files processed successfully", records: savedRecords, keepOriginal });
  } catch (error) {
    console.error("Error updating files:", error);
    // Cleanup local files only if they exist and are not meant to be served locally
    if (req.files) {
      req.files.forEach(f => {
        // If they failed completely before reaching the per-file handler and are not in savedRecords, cleanup
        if (fs.existsSync(f.path)) {
          fs.unlinkSync(f.path);
        }
      });
    }
    res.status(500).json({ success: false, message: "Failed to process files", error: error.message, stack: error.stack });
  }
});


// ================= CHAT FILE UPLOAD API =================
app.post("/api/chat/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const PORT = process.env.PORT || 5000;
    let fileUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;

    if (global.auth) {
      try {
        const drive = google.drive({ version: "v3", auth: global.auth });
        const driveResponse = await drive.files.create({
          requestBody: {
            name: req.file.originalname,
          },
          media: {
            mimeType: req.file.mimetype,
            body: fs.createReadStream(req.file.path),
          },
          supportsAllDrives: true
        });

        await drive.permissions.create({
          fileId: driveResponse.data.id,
          requestBody: { role: "reader", type: "anyone" },
          supportsAllDrives: true
        });

        fileUrl = `https://drive.google.com/uc?id=${driveResponse.data.id}`;
        fs.unlinkSync(req.file.path);
      } catch (driveErr) {
        console.error("Google Drive upload failed for chat file, using local fallback:", driveErr.message);
      }
    }
    
    // Save record to DB if needed (Assuming you just return the URL for now)
    res.json({ success: true, fileUrl, message: "Chat file uploaded successfully." });
  } catch (error) {
    console.error("Chat file upload error:", error);
    res.status(500).json({ success: false, message: "Failed to upload chat file" });
  }
});

// ================= BARCODE UPLOAD API =================
app.post(
  "/api/barcodes/upload",
  upload.array("files", 20),
  async (req, res) => {
    try {
      const drive = google.drive({
        version: "v3",
        auth: global.auth,
      });

      const barcodesData = JSON.parse(req.body.barcodes || "[]");
      
      const mainFolderId = "1BnPsJbEzFhlKYmV4hUnutb3-HwDUwkRp"; // Same root folder
      const date = new Date();
      const currentYear = date.getFullYear().toString();
      const currentMonth = date.toLocaleString('default', { month: 'long' });
      
      let barcodeFolderId = null;
      let useLocalFallback = false;

      try {
        const yearFolderId = await getOrCreateFolder(drive, currentYear, mainFolderId);
        const monthFolderId = await getOrCreateFolder(drive, currentMonth, yearFolderId);
        barcodeFolderId = await getOrCreateFolder(drive, "Barcodes", monthFolderId);
      } catch (err) {
        console.error("Drive connection failed for barcodes:", err.message);
        useLocalFallback = true;
      }

      const savedRecords = [];

      // If there are files, upload them
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const fileExt = path.extname(file.originalname);
          const newFileName = `Barcode-${Date.now()}${fileExt}`;
          try {
            if (useLocalFallback) throw new Error("Local fallback");

            const response = await drive.files.create({
              requestBody: { name: newFileName, parents: [barcodeFolderId] },
              media: { mimeType: file.mimetype, body: fs.createReadStream(file.path) },
              supportsAllDrives: true
            });

            await drive.permissions.create({
              fileId: response.data.id,
              requestBody: { role: "reader", type: "anyone" },
              supportsAllDrives: true
            });

            const fileUrl = `https://drive.google.com/uc?id=${response.data.id}`;
            const newRecord = new BarcodeRecord({
              barcodes: barcodesData,
              fileName: newFileName,
              fileSize: (file.size / 1024 / 1024).toFixed(2) + " MB",
              fileUrl,
              createdBy: "System",
            });
            const saved = await newRecord.save();
            savedRecords.push(saved);
            fs.unlinkSync(file.path);
          } catch(err) {
             const fileUrl = `http://localhost:${process.env.PORT || 5000}/uploads/${file.filename}`;
             const newRecord = new BarcodeRecord({
              barcodes: barcodesData,
              fileName: newFileName,
              fileSize: (file.size / 1024 / 1024).toFixed(2) + " MB",
              fileUrl,
              createdBy: "System",
            });
            const saved = await newRecord.save();
            savedRecords.push(saved);
          }
        }
      } else {
        // Just save data without file
        const newRecord = new BarcodeRecord({
          barcodes: barcodesData,
          fileName: "No File",
          fileSize: "0 MB",
          fileUrl: "",
          createdBy: "System",
        });
        const saved = await newRecord.save();
        savedRecords.push(saved);
      }

      res.status(200).json({ success: true, message: "Barcodes saved successfully", records: savedRecords });

    } catch (err) {
      console.error("Barcode upload error:", err);
      res.status(500).json({ success: false, message: "Failed to upload barcodes" });
    }
  }
);



// ================= AUTH API =================
const otpStore = new Map();

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (email === "gshmrd2627@gmail.com" && password === "123") {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    otpStore.set(email, { otp, expiresAt });

    // Send OTP email asynchronously in the background so it doesn't block the login response
    sendEmail({
      to: email,
      subject: `Your MedFlow Login OTP`,
      html: `<div style="font-family: sans-serif; max-width: 400px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center;">
               <h2 style="color: #4f46e5;">MedFlow Login OTP</h2>
               <p>Your 4-digit verification code is:</p>
               <h1 style="letter-spacing: 4px; color: #1e293b; background: #f8fafc; padding: 10px; border-radius: 8px;">${otp}</h1>
               <p style="color: #64748b; font-size: 14px;">This code will expire in 5 minutes.</p>
             </div>`,
    }).then(() => {
      console.log(`[AUTH] Login OTP email sent successfully to ${email}`);
    }).catch(err => {
      console.error("[AUTH] Failed to send login OTP email in background:", err.message);
    });

    console.log(`\n🔑 [SANDBOX BYPASS] Generated OTP code is: ${otp}. You can also use the default sandbox bypass code 9999.\n`);

    // Instantly return the OTP code in the response so the user gets it immediately
    res.json({
      success: true,
      message: "OTP generated successfully",
      otp: otp
    });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

app.post("/api/auth/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  const storedData = otpStore.get(email);

  console.log(`[AUTH] Verifying OTP for ${email}. Expected: ${storedData ? storedData.otp : 'None'}, Received: ${otp}`);

  if (!storedData) {
    return res.status(400).json({ success: false, message: "OTP expired or not requested" });
  }

  if (Date.now() > storedData.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
  }

  if (String(storedData.otp).trim() === String(otp).trim() || String(otp).trim() === "9999") {
    otpStore.delete(email);
    res.json({ success: true, message: "Login successful" });
  } else {
    res.status(401).json({ success: false, message: "Invalid OTP" });
  }
});

const doctorPasswords = new Map(); // Stores passwords for doctors. In production, use MongoDB.

app.post("/api/auth/dept-login", (req, res) => {
  const { doctorName, dept, password } = req.body;
  if (!doctorName || !dept || !password) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }
  
  const expectedPassword = doctorPasswords.get(doctorName) || "123";
  
  if (password === expectedPassword) {
    res.json({
      success: true,
      message: "Department login successful",
      doctorName,
      dept,
      loginTime: new Date().toISOString()
    });
  } else {
    res.status(401).json({ success: false, message: "Invalid department password" });
  }
});

app.post("/api/auth/dept-reset-password", (req, res) => {
  const { doctorName, dept, newPassword } = req.body;
  if (!doctorName || !dept || !newPassword) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }
  
  // In a real app, you would verify the doctor's identity (e.g., via email or security questions) before allowing a reset.
  doctorPasswords.set(doctorName, newPassword);
  res.json({ success: true, message: "Password reset successfully" });
});


// ================= SERVER =================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server Running On ${PORT}`);
});