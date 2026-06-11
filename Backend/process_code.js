import { google } from 'googleapis';
import fs from 'fs';
import { URL } from 'url';

const SCOPES = ["https://www.googleapis.com/auth/drive"];
const TOKEN_PATH = "token.json";

try {
  // Read credentials
  const content = fs.readFileSync("credentials.json");
  const credentials = JSON.parse(content);

  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  let codeInput = fs.readFileSync("code.txt", "utf8").trim();
  if (!codeInput) {
    console.error("Error: code.txt is empty. Please paste your authorization code or redirect URL in code.txt");
    process.exit(1);
  }

  // If the user pasted the entire redirect URL, extract the code
  if (codeInput.includes("code=")) {
    if (!codeInput.startsWith("http")) {
      codeInput = "http://localhost/" + codeInput;
    }
    const urlObj = new URL(codeInput);
    codeInput = urlObj.searchParams.get("code");
  }

  console.log("Exchanging authorization code for OAuth token...");

  oAuth2Client.getToken(codeInput, (err, token) => {
    if (err) {
      console.error("❌ Google OAuth Error:", err.message);
      process.exit(1);
    }
    oAuth2Client.setCredentials(token);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
    console.log("🎉 SUCCESS! token.json has been successfully created and saved in Backend/token.json!");
    
    // Clean up code.txt
    try {
      fs.unlinkSync("code.txt");
    } catch (_) {}
    
    process.exit(0);
  });
} catch (e) {
  console.error("❌ Processing Error:", e.message);
  process.exit(1);
}
