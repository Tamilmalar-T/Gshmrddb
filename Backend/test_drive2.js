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
    const parentId = '1BnPsJbEzFhlKYmV4hUnutb3-HwDUwkRp'; // The target folder

    console.log('Uploading test file...');
    const response = await drive.files.create({
      requestBody: { name: 'test_upload.txt', parents: [parentId] },
      media: { mimeType: 'text/plain', body: 'hello world' },
      supportsAllDrives: true
    });
    console.log('Uploaded file ID:', response.data.id);

    console.log('Making public...');
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true
    });
    console.log('Successfully made public!');
  } catch (err) {
    console.error('Test Error:', err.message);
  }
}
test();
