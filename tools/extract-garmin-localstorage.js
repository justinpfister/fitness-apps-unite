import fs from 'fs';
import path from 'path';
import readline from 'readline';

/**
 * Helper script to save Garmin tokens extracted from LocalStorage
 * 
 * Instructions:
 * 1. Open https://connect.garmin.com in your browser (logged in with MFA)
 * 2. Open DevTools (F12) → Application → Local Storage → https://connect.garmin.com
 * 3. Find the "token" key (and optionally "HereToken" or "JetLagToken")
 * 4. Copy the entire value (it's a JSON string)
 * 5. Run this script and paste the value when prompted
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

async function saveTokens() {
  console.log('=== Garmin LocalStorage Token Extractor ===\n');
  console.log('INSTRUCTIONS:');
  console.log('1. Open DevTools (F12) on connect.garmin.com');
  console.log('2. Go to Application → Local Storage → https://connect.garmin.com');
  console.log('3. Find the "token" key');
  console.log('4. Double-click the value to select all, then copy\n');

  const tokenValue = await question('Paste the "token" value (or press Enter to skip): ');
  
  if (!tokenValue || tokenValue.trim() === '') {
    console.log('\nNo token provided. Exiting.\n');
    rl.close();
    process.exit(0);
  }

  let tokenData;
  try {
    // Parse the JSON value from localStorage
    tokenData = JSON.parse(tokenValue.trim());
  } catch (error) {
    console.error('\n✗ Error: Invalid JSON. Make sure you copied the entire value.');
    console.error('Expected format: {"access_token":"..."} or similar\n');
    rl.close();
    process.exit(1);
  }

  console.log('\nFound token data:', Object.keys(tokenData));
  
  // Extract access_token
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    console.error('\n✗ Error: No access_token found in the token data.');
    console.error('Token keys found:', Object.keys(tokenData));
    console.error('\nYou may need to look for different values in LocalStorage.\n');
    rl.close();
    process.exit(1);
  }

  console.log(`✓ Found access_token (length: ${accessToken.length})`);

  // Check for refresh_token or other tokens
  const refreshToken = tokenData.refresh_token || tokenData.refreshToken || null;
  const expiresAt = tokenData.expires_at || tokenData.expiresAt || 9999999999;

  // Create directory if it doesn't exist
  const tokenDir = './data/garmin-tokens';
  if (!fs.existsSync(tokenDir)) {
    fs.mkdirSync(tokenDir, { recursive: true });
    console.log(`✓ Created directory: ${tokenDir}`);
  }

  // The garmin-connect library typically expects OAuth1 tokens, but we can try OAuth2 format
  // Let's check if we need OAuth1 format by trying to decode the JWT or use it directly
  
  // For OAuth2 format
  if (refreshToken || accessToken) {
    const oauth2Token = {
      access_token: accessToken,
      refresh_token: refreshToken || accessToken, // Use access_token as fallback
      expires_at: typeof expiresAt === 'number' ? expiresAt : parseInt(expiresAt) || 9999999999
    };

    const oauth2Path = path.join(tokenDir, 'oauth2_token.json');
    fs.writeFileSync(oauth2Path, JSON.stringify(oauth2Token, null, 2));
    console.log(`✓ Saved: ${oauth2Path}`);
  }

  // For OAuth1 format, we might need to extract from the JWT or use a workaround
  // Some libraries can work with just the access_token in OAuth1 format
  // Let's create a minimal OAuth1 token file
  
  // Try to extract token/secret from JWT header/payload if possible
  // For now, we'll create a basic structure that some implementations accept
  const oauth1Token = {
    token: accessToken.substring(0, 50), // First part (might need adjustment)
    token_secret: accessToken.substring(accessToken.length - 50) // Last part
  };

  // Actually, for JWT tokens, we might need a different approach
  // Let's ask if they have oauth_token and oauth_token_secret cookies or need to try something else
  
  console.log('\n⚠️  Note: The garmin-connect library expects OAuth1 tokens (token + token_secret).');
  console.log('LocalStorage tokens are typically OAuth2/JWT format.');
  console.log('\nAttempting to create OAuth1 format from OAuth2 token...');
  
  const oauth1Path = path.join(tokenDir, 'oauth1_token.json');
  
  // Try a different approach - check Network tab for actual OAuth1 tokens
  console.log('\nIf this doesn\'t work, you may need to:');
  console.log('1. Check Network tab in DevTools');
  console.log('2. Find an API request (XHR/Fetch)');
  console.log('3. Look at Request Headers for OAuth tokens\n');

  // Save what we have
  fs.writeFileSync(oauth1Path, JSON.stringify(oauth1Token, null, 2));
  console.log(`✓ Saved: ${oauth1Path}`);
  console.log('\n⚠️  Warning: This OAuth1 token may not work. You may need actual OAuth1 tokens from cookies/network.');

  console.log('\n=== Setup Complete! ===');
  console.log('Tokens have been saved to:', tokenDir);
  console.log('\nNext steps:');
  console.log('1. Update your .env file:');
  console.log('   GARMIN_USE_TOKENS=true');
  console.log('2. Test the connection:');
  console.log('   npm test');
  console.log('\nIf it fails, check the Network tab in DevTools for actual OAuth1 tokens.\n');

  rl.close();
}

saveTokens();

