import fs from 'fs';
import path from 'path';
import readline from 'readline';

/**
 * Simple script to update ONLY the OAuth2 access token
 * 
 * HOW TO GET THE TOKEN:
 * 1. Go to https://connect.garmin.com (make sure you're logged in)
 * 2. Open Developer Tools (F12)
 * 3. Go to Network tab
 * 4. Filter by "Fetch/XHR"
 * 5. Refresh the page or click something
 * 6. Look for any API request (like "activities")
 * 7. Click on it → Headers → Request Headers
 * 8. Find "Authorization: Bearer <long_token>"
 * 9. Copy JUST the token part (everything after "Bearer ")
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function updateToken() {
  console.log('=== Update Garmin OAuth2 Token ===\n');
  console.log('Follow these steps to get your token:');
  console.log('1. Go to https://connect.garmin.com (logged in)');
  console.log('2. Open DevTools (F12) → Network tab');
  console.log('3. Filter by "Fetch/XHR"');
  console.log('4. Refresh page or click something');
  console.log('5. Click any API request → Headers');
  console.log('6. Find "Authorization: Bearer <token>"');
  console.log('7. Copy the token (after "Bearer ")\n');
  
  const accessToken = await question('Paste the access_token here: ');
  
  if (!accessToken.trim()) {
    console.log('\n✗ No token provided');
    rl.close();
    process.exit(1);
  }
  
  const token = accessToken.trim();
  
  // Decode JWT to get expiration
  let expiresAt;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64'));
    expiresAt = payload.exp;
    const expiresDate = new Date(expiresAt * 1000);
    console.log(`\n✓ Token valid until: ${expiresDate}`);
  } catch (error) {
    console.log('\n⚠️  Could not decode token expiration, using default');
    expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  }
  
  // Read existing token file to preserve refresh_token
  const tokenPath = './data/garmin-tokens/oauth2_token.json';
  let refreshToken;
  
  try {
    const existing = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    refreshToken = existing.refresh_token;
    console.log('✓ Preserved existing refresh_token');
  } catch (error) {
    console.log('⚠️  No existing refresh_token found');
    refreshToken = '';
  }
  
  const oauth2Token = {
    access_token: token,
    refresh_token: refreshToken || '',
    expires_at: expiresAt
  };
  
  // Save
  const tokenDir = './data/garmin-tokens';
  if (!fs.existsSync(tokenDir)) {
    fs.mkdirSync(tokenDir, { recursive: true });
  }
  
  fs.writeFileSync(tokenPath, JSON.stringify(oauth2Token, null, 2));
  console.log(`\n✓ Token saved to: ${tokenPath}`);
  console.log('\nNow run: npm run test:garmin\n');
  
  rl.close();
}

updateToken();

