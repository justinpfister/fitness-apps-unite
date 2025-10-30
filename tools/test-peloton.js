import { config, validateConfig } from '../utils/config.js';
import { PelotonClient } from '../clients/peloton.js';
import { StateDatabase } from '../state/database.js';

async function main() {
  console.log('=== Peloton Connection Test ===');

  if (!validateConfig()) {
    console.error('✗ Configuration validation failed');
    process.exit(1);
  }

  console.log('\n--- Testing Peloton Connection ---');
  try {
    const stateDb = new StateDatabase(config.state.dbPath);
    const client = new PelotonClient(config.peloton.username, config.peloton.password, stateDb);
    const workouts = await client.getRecentWorkouts(5);
    console.log('✓ Successfully connected to Peloton');
    console.log(`  Found ${workouts.length} recent workouts`);
    if (workouts.length > 0) {
      const first = workouts[0];
      console.log(`  Most recent: ${first.name} on ${first.startTime.toLocaleDateString()}`);
    }
    process.exit(0);
  } catch (error) {
    console.error('✗ Failed to connect to Peloton:', error.message);
    process.exit(1);
  }
}

main();


