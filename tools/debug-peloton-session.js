import { StateDatabase } from '../state/database.js';
import { config } from '../utils/config.js';

console.log('=== Peloton Session Debug ===\n');
console.log('Database path:', config.state.dbPath);

const stateDb = new StateDatabase(config.state.dbPath);
const session = stateDb.getPelotonSession();

console.log('\nPeloton session in database:');
console.log(JSON.stringify(session, null, 2));

if (!session) {
  console.log('\n❌ No Peloton session found in database');
  console.log('Run: npm run peloton-setup');
} else {
  console.log('\n✓ Session found!');
  console.log('Session ID:', session.sessionId?.substring(0, 20) + '...');
  console.log('User ID:', session.userId);
  console.log('Saved at:', session.savedAt);
}

