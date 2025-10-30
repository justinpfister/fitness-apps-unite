import readline from 'readline';
import { StateDatabase } from '../state/database.js';
import { config } from '../utils/config.js';
import fs from 'fs';
import path from 'path';

/**
 * Simplified Garmin token extractor
 * Similar approach to Peloton - extract from browser and save
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

async function main() {
  console.log('=== Garmin Token Extractor (Simplified) ===\n');
  console.log('This tool will help you extract Garmin authentication tokens');
  console.log('from your browser session to bypass MFA.\n');
  
  console.log('STEP-BY-STEP INSTRUCTIONS:\n');
  console.log('1. Open Chrome/Edge and go to: https://connect.garmin.com');
  console.log('2. Log in with your Garmin credentials (complete MFA if prompted)');
  console.log('3. Once logged in, press F12 to open Developer Tools');
  console.log('4. Click the "Console" tab at the top');
  console.log('5. Copy and paste this command into the console:\n');
  
  console.log('─'.repeat(70));
  console.log(`
// Copy everything between these lines (including the lines themselves)
(function() {
  const cookies = document.cookie.split(';').reduce((acc, c) => {
    const [k,v] = c.trim().split('='); 
    acc[k] = v; 
    return acc;
  }, {});
  
  const tokens = {
    oauth_token: cookies.oauth_token || cookies.GARMIN_SSO_GUID,
    oauth_token_secret: cookies.oauth_token_secret,
    session_id: cookies['connect.sid'] || cookies.GARMIN_SESSION_GUID
  };
  
  console.log('\\n=== COPY THE JSON BELOW ===');
  console.log(JSON.stringify(tokens, null, 2));
  console.log('=== END OF JSON ===\\n');
  
  return tokens;
})();
`);
  console.log('─'.repeat(70));
  
  console.log('\n6. The console will print JSON with your tokens');
  console.log('7. Copy the JSON output (the part between the === markers)');
  console.log('8. Come back here and paste it when prompted\n');
  
  const proceed = await question('Ready to paste your tokens? (y/n): ');
  if (proceed.toLowerCase() !== 'y') {
    console.log('\nNo problem! Run this script again when you have the tokens.\n');
    rl.close();
    process.exit(0);
  }

  console.log('\nPaste the entire JSON object here (it should start with { and end with }):');
  console.log('Then press Enter twice:\n');
  
  let jsonInput = '';
  rl.on('line', (line) => {
    if (line.trim() === '' && jsonInput.includes('}')) {
      rl.close();
      processTokens(jsonInput);
    } else {
      jsonInput += line + '\n';
    }
  });
}

function processTokens(jsonInput) {
  try {
    const tokens = JSON.parse(jsonInput);
    
    console.log('\n--- Validating tokens ---');
    console.log('oauth_token:', tokens.oauth_token ? '✓ Found' : '✗ Missing');
    console.log('oauth_token_secret:', tokens.oauth_token_secret ? '✓ Found' : '✗ Missing');
    
    if (!tokens.oauth_token) {
      console.log('\n⚠️  Warning: oauth_token not found');
      console.log('The extraction script may not have found all tokens.');
      console.log('\nTrying alternative approach...');
      console.log('Please check your browser cookies manually:');
      console.log('1. In DevTools, go to Application → Cookies → https://connect.garmin.com');
      console.log('2. Look for any cookie with "oauth" or "token" in the name');
      console.log('3. Run: node tools/save-garmin-tokens.js (for manual entry)\n');
      process.exit(1);
    }

    // Create directory
    const tokenDir = './data/garmin-tokens';
    if (!fs.existsSync(tokenDir)) {
      fs.mkdirSync(tokenDir, { recursive: true });
    }

    // Save OAuth1 tokens
    const oauth1Token = {
      token: tokens.oauth_token,
      token_secret: tokens.oauth_token_secret || tokens.oauth_token  // Fallback
    };

    const oauth1Path = path.join(tokenDir, 'oauth1_token.json');
    fs.writeFileSync(oauth1Path, JSON.stringify(oauth1Token, null, 2));
    
    console.log('\n✓ Tokens saved successfully!');
    console.log('  Location:', oauth1Path);
    
    console.log('\n=== Next Steps ===');
    console.log('1. Make sure your .env has: GARMIN_USE_TOKENS=true');
    console.log('2. Test: npm run test:garmin');
    console.log('3. If it works: npm test (to test all services)\n');

    process.exit(0);
    
  } catch (error) {
    console.log('\n✗ Failed to parse JSON:', error.message);
    console.log('\nMake sure you copied the entire JSON object.');
    console.log('It should look like: { "oauth_token": "...", ... }\n');
    process.exit(1);
  }
}

main();

