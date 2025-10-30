import pkg from 'garmin-connect';
const { GarminConnect } = pkg;
import { config } from '../utils/config.js';
import fs from 'fs';
import path from 'path';

/**
 * Attempt to refresh OAuth2 token using existing OAuth1 token
 * This mimics what the library does internally
 */

async function refreshTokens() {
  console.log('=== Garmin OAuth2 Token Refresher ===\n');
  
  const tokenDir = config.garmin.tokenPath || './data/garmin-tokens';
  const oauth1Path = path.join(tokenDir, 'oauth1_token.json');
  const oauth2Path = path.join(tokenDir, 'oauth2_token.json');
  
  // Check if OAuth1 token exists
  if (!fs.existsSync(oauth1Path)) {
    console.log('✗ OAuth1 token not found at:', oauth1Path);
    console.log('\nYou need to extract OAuth1 tokens first.');
    console.log('Run the browser console script from: tools/garmin-simple-setup.md\n');
    process.exit(1);
  }
  
  console.log('Found OAuth1 token file');
  console.log('Attempting fresh login to get new OAuth2 token...\n');
  
  try {
    // Create client
    const client = new GarminConnect({
      username: config.garmin.username,
      password: config.garmin.password
    });
    
    // Try to login (this will fail with MFA but might give us info)
    try {
      await client.login();
      console.log('✓ Login successful! Exporting tokens...');
      
      // Export tokens
      client.exportTokenToFile(tokenDir);
      
      console.log('✓ Tokens saved to:', tokenDir);
      console.log('\nNow test with: npm run test:garmin\n');
      process.exit(0);
      
    } catch (loginError) {
      console.log('Login failed (expected with MFA):', loginError.message);
      console.log('\nThe OAuth1 token method won\'t work for MFA accounts.');
      console.log('\nAlternative approach needed...\n');
    }
    
  } catch (error) {
    console.log('✗ Error:', error.message);
  }
  
  console.log('\n=== Alternative: Get Fresh Tokens from Browser ===\n');
  console.log('Since your account has MFA, you need to extract BOTH tokens from browser:\n');
  console.log('1. Log into connect.garmin.com (complete MFA)');
  console.log('2. Open DevTools → Application → Local Storage');
  console.log('3. Look for a key like "token" or "auth-token"');
  console.log('4. Copy the entire value (it will be a long JWT string)');
  console.log('5. Decode it at jwt.io to see if it has "garmin_guid"');
  console.log('\nOR try the Network tab method:');
  console.log('1. DevTools → Network tab');
  console.log('2. Refresh the page');
  console.log('3. Click any request to "connectapi.garmin.com"');
  console.log('4. Check Authorization header (should have "Bearer ey...")');
  console.log('5. That Bearer token is your OAuth2 access_token\n');
}

refreshTokens();

