import readline from 'readline';
import { StateDatabase } from '../state/database.js';
import { config } from '../utils/config.js';
import axios from 'axios';

/**
 * Helper script to save Peloton session
 * 
 * Since Peloton's /auth/login endpoint is deprecated/blocked, we need to:
 * 1. Log in manually via browser
 * 2. Extract the session cookie
 * 3. Save it for automated use
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

async function saveSession() {
  console.log('=== Peloton Session Saver ===\n');
  console.log('Peloton\'s API login endpoint is no longer accepting automated requests.');
  console.log('We need to extract your session cookie from a browser login.\n');
  
  console.log('WHERE TO FIND YOUR SESSION COOKIE:');
  console.log('1. Open your browser and go to: https://members.onepeloton.com');
  console.log('2. Log in with your Peloton credentials');
  console.log('3. Open DevTools (F12 or Right-click → Inspect)');
  console.log('4. Go to: Application tab → Cookies → https://members.onepeloton.com');
  console.log('5. Find the cookie named: peloton_session_id');
  console.log('6. Copy its Value\n');
  
  const proceed = await question('Ready to enter your session cookie? (y/n): ');
  if (proceed.toLowerCase() !== 'y') {
    console.log('\nPlease complete the steps above, then run this script again.\n');
    rl.close();
    process.exit(0);
  }

  console.log('\n=== Enter Session Cookie ===\n');

  const sessionId = await question('peloton_session_id (from browser cookies): ').then(v => v.trim());

  if (!sessionId) {
    console.log('\n✗ Error: Session ID is required');
    rl.close();
    process.exit(1);
  }

  // Verify the session and fetch user ID
  console.log('\n--- Verifying Session ---');
  try {
    const response = await axios.get('https://api.onepeloton.com/api/me', {
      headers: {
        Cookie: `peloton_session_id=${sessionId}`,
      },
      validateStatus: (s) => s < 500,
    });

    if (response.status !== 200 || !response.data?.user_id) {
      console.log('✗ Session validation failed');
      console.log('  Status:', response.status);
      console.log('  Response:', response.data);
      console.log('\nThe session cookie might be invalid or expired.');
      console.log('Please log in again and copy a fresh session cookie.\n');
      rl.close();
      process.exit(1);
    }

    const userId = response.data.id;  // Peloton uses "id" not "user_id"
    const username = response.data.username;
    
    console.log('✓ Session is valid!');
    console.log(`  User ID: ${userId}`);
    console.log(`  Username: ${username}`);

    // Save to state database
    console.log('\n--- Saving to database ---');
    console.log('Database path:', config.state.dbPath);
    const stateDb = new StateDatabase(config.state.dbPath);
    stateDb.setPelotonSession({
      sessionId: sessionId,
      userId: userId,
    });
    
    // Verify it was saved
    const saved = stateDb.getPelotonSession();
    if (saved && saved.sessionId === sessionId) {
      console.log('✓ Session successfully saved and verified');
    } else {
      console.log('⚠️  Warning: Session may not have been saved correctly');
    }

    console.log('\n=== Setup Complete! ===');
    console.log(`Session saved to: ${config.state.dbPath}`);
    console.log('\nNext steps:');
    console.log('1. Test: npm run test:peloton');
    console.log('2. Run full test: npm test');
    console.log('3. Start syncing: npm start\n');
    console.log('Note: Sessions may expire. If you get authentication errors in the future,');
    console.log('run this script again to save a fresh session.\n');

  } catch (error) {
    console.log('✗ Failed to verify session:', error.message);
    console.log('\nPlease check:');
    console.log('- You copied the full session cookie value');
    console.log('- Your internet connection is working');
    console.log('- The session hasn\'t expired (try logging in again)\n');
    process.exit(1);
  }

  rl.close();
}

saveSession();

