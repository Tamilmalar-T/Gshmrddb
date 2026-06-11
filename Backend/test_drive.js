import { google } from 'googleapis';
import fs from 'fs';
const TOKEN_PATH = 'token.json';
const credentials = JSON.parse(fs.readFileSync('credentials.json'));
const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
const drive = google.drive({ version: 'v3', auth: oAuth2Client });
async function test() {
  try {
    const parentId = '1BnPsJbEzFhlKYmV4hUnutb3-HwDUwkRp';
    let query = `mimeType='application/vnd.google-apps.folder' and name='2026' and trashed=false and '${parentId}' in parents`;
    const res = await drive.files.list({ q: query, fields: 'files(id, name)', spaces: 'drive', supportsAllDrives: true, includeItemsFromAllDrives: true });
    console.log('List results:', res.data.files);
    
    // Also test creating the folder
    if (res.data.files.length === 0) {
      console.log('Creating 2026 folder...');
      const folder = await drive.files.create({
        requestBody: { name: '2026', mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
        fields: 'id',
        supportsAllDrives: true
      });
      console.log('Created folder ID:', folder.data.id);
    }
  } catch (err) {
    console.error('Test Error:', err.message);
  }
}
test();
