#!/usr/bin/env npx tsx
/**
 * Gmail OAuth authentication script.
 * Generates auth URL, waits for code, saves tokens.
 *
 * Usage:
 *   npx tsx scripts/gmail-auth.ts
 *
 * Prereqs:
 *   1. Download OAuth Desktop client JSON from GCP Console
 *   2. Save as ~/.gmail-mcp/gcp-oauth.keys.json
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';

import { google } from 'googleapis';

const CRED_DIR = path.join(os.homedir(), '.gmail-mcp');
const KEYS_PATH = path.join(CRED_DIR, 'gcp-oauth.keys.json');
const TOKENS_PATH = path.join(CRED_DIR, 'credentials.json');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/contacts',
];

async function main() {
  if (!fs.existsSync(KEYS_PATH)) {
    console.error(
      `\nError: ${KEYS_PATH} not found.\n` +
        'Download your OAuth Desktop client JSON from GCP Console and save it there.\n',
    );
    process.exit(1);
  }

  const keys = JSON.parse(fs.readFileSync(KEYS_PATH, 'utf-8'));
  const clientConfig = keys.installed || keys.web || keys;
  const { client_id, client_secret, redirect_uris } = clientConfig;

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris?.[0] || 'urn:ietf:wg:oauth:2.0:oob',
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\n=== Google Workspace OAuth ===\n');
  console.log('Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\nAfter authorizing, paste the code below.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise<string>((resolve) => {
    rl.question('Authorization code: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  const { tokens } = await oauth2Client.getToken(code);
  fs.mkdirSync(CRED_DIR, { recursive: true });
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
  console.log(`\nTokens saved to ${TOKENS_PATH}`);

  // Also save for Google Workspace MCP
  const gwsDir = path.join(os.homedir(), '.google-workspace-mcp');
  fs.mkdirSync(gwsDir, { recursive: true });
  fs.copyFileSync(KEYS_PATH, path.join(gwsDir, 'credentials.json'));
  fs.writeFileSync(path.join(gwsDir, 'token.json'), JSON.stringify(tokens, null, 2));
  console.log(`Tokens also saved to ${gwsDir}/token.json`);

  // Verify
  oauth2Client.setCredentials(tokens);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const profile = await gmail.users.getProfile({ userId: 'me' });
  console.log(`Authenticated as: ${profile.data.emailAddress}`);
  console.log('\nGmail channel is ready. Restart NanoClaw to activate it.\n');
}

main().catch((err) => {
  console.error('Auth failed:', err.message);
  process.exit(1);
});
