import fs from 'fs';
import path from 'path';
import readline from 'readline';

/**
 * Helper script to save Garmin tokens
 * 
 * The garmin-connect library needs OAuth1 tokens:
 * - oauth_token
 * - oauth_token_secret
 * 
 * These might be found in:
 * 1. Network tab → Request Headers → Cookie header (oauth_token, oauth_token_secret)
 * 2. Application → Cookies (though often not visible)
 * 3. Network → Request payload or Authorization header
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
  console.log('=== Garmin Token Saver ===\n');
  console.log('First, follow the instructions in: tools/garmin-simple-setup.md\n');
  console.log('This script will save the tokens you extracted.\n');
  
  const method = await question('How do you want to enter tokens?\n  1. Paste JSON (from console script)\n  2. Enter manually\nChoice (1 or 2): ');
  
  let oauthToken, oauthTokenSecret;
  
  if (method.trim() === '1') {
    console.log('\nPaste the JSON output from the browser console script:');
    console.log('(should look like: {"token": "...", "token_secret": "..."})\n');
    
    const jsonInput = await question('Paste JSON: ');
    
    try {
      const tokens = JSON.parse(jsonInput.trim());
      oauthToken = tokens.token;
      oauthTokenSecret = tokens.token_secret;
      
      if (!oauthToken || oauthToken === 'NOT_FOUND') {
        console.log('\n⚠️  Token extraction failed.');
        console.log('Try the manual method or check the setup guide.\n');
        rl.close();
        process.exit(1);
      }
    } catch (error) {
      console.log('\n✗ Failed to parse JSON:', error.message);
      console.log('Make sure you copied the complete JSON object.\n');
      rl.close();
      process.exit(1);
    }
  } else {
    console.log('\n=== Enter OAuth1 Token Values Manually ===\n');
    oauthToken = await question('oauth_token (or GARMIN-SSO-CUST-GUID): ').then(v => v.trim());
    oauthTokenSecret = await question('oauth_token_secret (or same as token): ').then(v => v.trim());
    
    if (!oauthTokenSecret) {
      console.log('Using token as secret (common for Garmin SSO cookies)');
      oauthTokenSecret = oauthToken;
    }
  }

  if (!oauthToken || !oauthTokenSecret) {
    console.log('\n⚠️  Warning: Missing token values.');
    console.log('\nIf you only have LocalStorage tokens (JWT format), those won\'t work.');
    console.log('You need to find the actual OAuth1 tokens in Network request headers.\n');
    
    const continueAnyway = await question('Continue anyway? (y/n): ');
    if (continueAnyway.toLowerCase() !== 'y') {
      rl.close();
      process.exit(0);
    }
  }

  // Create directory if it doesn't exist
  const tokenDir = './data/garmin-tokens';
  if (!fs.existsSync(tokenDir)) {
    fs.mkdirSync(tokenDir, { recursive: true });
    console.log(`\n✓ Created directory: ${tokenDir}`);
  }

  // Save oauth1_token.json
  if (oauthToken && oauthTokenSecret) {
    const oauth1Token = {
      token: oauthToken,
      token_secret: oauthTokenSecret
    };

    const oauth1Path = path.join(tokenDir, 'oauth1_token.json');
    fs.writeFileSync(oauth1Path, JSON.stringify(oauth1Token, null, 2));
    console.log(`✓ Saved: ${oauth1Path}`);
  } else {
    console.log('\n⚠️  Could not create oauth1_token.json - missing values');
  }

  // OAuth2 tokens (optional - from LocalStorage)
  console.log('\n=== OAuth2 Tokens (Optional - from LocalStorage) ===');
  console.log('If you have the LocalStorage "token" value, we can save it as OAuth2:');
  const localStorageToken = await question('Paste LocalStorage "token" value (or Enter to skip): ').then(v => v.trim());
  
  if (localStorageToken) {
    try {
      const tokenData = JSON.parse(localStorageToken);
      if (tokenData.access_token) {
        const oauth2Token = {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || tokenData.access_token,
          expires_at: tokenData.expires_at || 9999999999
        };

        const oauth2Path = path.join(tokenDir, 'oauth2_token.json');
        fs.writeFileSync(oauth2Path, JSON.stringify(oauth2Token, null, 2));
        console.log(`✓ Saved: ${oauth2Path}`);
        console.log('\n⚠️  Note: OAuth2 tokens may not work with garmin-connect library.');
        console.log('The library primarily uses OAuth1 tokens.\n');
      }
    } catch (error) {
      console.log('✗ Could not parse LocalStorage token:', error.message);
    }
  }

  console.log('\n=== Setup Complete! ===');
  console.log('Tokens saved to:', tokenDir);
  console.log('\nNext steps:');
  console.log('1. Update your .env: GARMIN_USE_TOKENS=true');
  console.log('2. Test: npm test');
  console.log('\nIf it fails, the tokens might not be in the right format.');
  console.log('Check Network tab in DevTools for actual OAuth1 tokens.\n');

  rl.close();
}

saveTokens();

