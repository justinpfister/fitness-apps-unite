import readline from 'readline';
import { StateDatabase } from '../state/database.js';
import { config } from '../utils/config.js';
import axios from 'axios';

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
  console.log('=== Manual Peloton Session Entry ===\n');
  
  const sessionId = await question('Enter your peloton_session_id: ');
  
  if (!sessionId || sessionId.trim().length === 0) {
    console.log('❌ No session ID provided');
    rl.close();
    process.exit(1);
  }

  console.log('\nValidating session...');
  
  try {
    const response = await axios.get('https://api.onepeloton.com/api/me', {
      headers: {
        Cookie: `peloton_session_id=${sessionId.trim()}`,
      },
    });

    const userId = response.data.id;  // Peloton uses "id" not "user_id"
    const username = response.data.username;
    
    console.log('✓ Session is valid!');
    console.log(`  User: ${username}`);
    console.log(`  User ID: ${userId}`);

    const stateDb = new StateDatabase(config.state.dbPath);
    stateDb.setPelotonSession({
      sessionId: sessionId.trim(),
      userId: userId,
    });

    // Verify
    const saved = stateDb.getPelotonSession();
    console.log('\n✓ Session saved to database!');
    console.log('  Path:', config.state.dbPath);
    
    console.log('\nNow run: npm run test:peloton');
    
  } catch (error) {
    console.log('❌ Failed to validate session');
    console.log('Error:', error.response?.data || error.message);
    console.log('\nMake sure you:');
    console.log('1. Copied the FULL session cookie value');
    console.log('2. Are currently logged in to Peloton in your browser');
  }

  rl.close();
}

main();

