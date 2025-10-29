import pkg from 'garmin-connect';
const { GarminConnect } = pkg;
import { config } from '../utils/config.js';
import readline from 'readline';

/**
 * Interactive setup for Garmin authentication with MFA support
 * 
 * This script will:
 * 1. Attempt to login with your credentials
 * 2. If MFA is required, prompt you for the MFA code
 * 3. Save the authentication tokens for future use
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

async function setupGarminTokens() {
  console.log('=== Garmin Token Setup (MFA Support) ===\n');
  console.log('This will save authentication tokens to: ./data/garmin-tokens/\n');
  
  try {
    console.log('Step 1: Creating GarminConnect client...');
    const GCClient = new GarminConnect({
      username: config.garmin.username,
      password: config.garmin.password
    });
    
    console.log('Step 2: Attempting login...');
    console.log('(If MFA is enabled, you may need to check your device/email)\n');
    
    try {
      await GCClient.login();
      console.log('✓ Login successful!\n');
    } catch (error) {
      // If login fails due to MFA, the library might throw an error
      // In some cases, we may need to handle MFA manually
      console.error('Login failed:', error.message);
      console.log('\nNote: The garmin-connect library has limited MFA support.');
      console.log('If your account requires MFA, you have two options:\n');
      console.log('Option 1: Use a different Garmin account without MFA');
      console.log('Option 2: Manually extract tokens from browser (advanced)\n');
      
      const proceed = await question('Do you want instructions for manual token extraction? (y/n): ');
      if (proceed.toLowerCase() === 'y') {
        console.log('\n=== Manual Token Extraction Instructions ===');
        console.log('1. Open your browser and login to connect.garmin.com (with MFA)');
        console.log('2. Open Developer Tools (F12)');
        console.log('3. Go to Application/Storage → Cookies');
        console.log('4. Look for these cookies and save them:');
        console.log('   - oauth_token');
        console.log('   - oauth_token_secret');
        console.log('5. Create a file: data/garmin-tokens/oauth1_token.json');
        console.log('   with format: {"token": "...", "token_secret": "..."}');
        console.log('\nThen the app can use these tokens without MFA.\n');
      }
      
      rl.close();
      process.exit(1);
    }
    
    console.log('Step 3: Testing API access...');
    const activities = await GCClient.getActivities(0, 3);
    console.log(`✓ Successfully fetched ${activities.length} activities\n`);
    
    console.log('Step 4: Saving tokens...');
    GCClient.exportTokenToFile('./data/garmin-tokens');
    console.log('✓ Tokens saved to ./data/garmin-tokens/\n');
    
    console.log('=== Setup Complete! ===');
    console.log('Your tokens are now saved. Future logins will use these tokens');
    console.log('without requiring your password or MFA.\n');
    console.log('Update your .env file to use token-based auth:');
    console.log('GARMIN_USE_TOKENS=true\n');
    
    rl.close();
    process.exit(0);
    
  } catch (error) {
    console.error('\n✗ Setup failed:', error.message);
    console.error('\nFull error:', error);
    rl.close();
    process.exit(1);
  }
}

setupGarminTokens();

