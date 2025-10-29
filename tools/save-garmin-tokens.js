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
  console.log('The garmin-connect library needs OAuth1 tokens.\n');
  console.log('WHERE TO FIND THEM:');
  console.log('1. Open DevTools → Network tab');
  console.log('2. Make an action on connect.garmin.com (refresh, navigate)');
  console.log('3. Find an XHR/Fetch request to connect.garmin.com');
  console.log('4. Click the request → Headers tab');
  console.log('5. Check "Request Headers" for:');
  console.log('   - Cookie header (expand it, look for oauth_token=... and oauth_token_secret=...)');
  console.log('   - Authorization header');
  console.log('   - Or any header with "oauth" or "token" in the name\n');
  console.log('ALTERNATIVELY: Check all cookies again (may be under different domain)\n');
  
  const proceed = await question('Ready to enter token values? (y/n): ');
  if (proceed.toLowerCase() !== 'y') {
    console.log('\nPlease check Network tab first, then run this script again.\n');
    rl.close();
    process.exit(0);
  }

  console.log('\n=== Enter OAuth1 Token Values ===\n');

  const oauthToken = await question('oauth_token (from Network headers/cookies): ').then(v => v.trim());
  const oauthTokenSecret = await question('oauth_token_secret (from Network headers/cookies): ').then(v => v.trim());

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

