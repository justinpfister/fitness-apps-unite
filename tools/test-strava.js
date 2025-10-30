import { config, validateConfig } from '../utils/config.js';
import { StateDatabase } from '../state/database.js';
import { StravaClient } from '../clients/strava.js';

async function main() {
  console.log('=== Strava Connection Test ===');

  if (!validateConfig()) {
    console.error('✗ Configuration validation failed');
    process.exit(1);
  }

  console.log('\n--- Testing Strava Connection ---');
  try {
    const stateDb = new StateDatabase(config.state.dbPath);
    const client = new StravaClient(
      config.strava.clientId,
      config.strava.clientSecret,
      config.strava.refreshToken,
      config.strava.accessToken,
      stateDb
    );
    const activities = await client.getRecentActivities(5);
    console.log('✓ Successfully connected to Strava');
    console.log(`  Found ${activities.length} recent activities`);
    if (activities.length > 0) {
      const first = activities[0];
      console.log(`  Most recent: ${first.name} on ${new Date(first.start_date).toLocaleDateString()}`);
    }
    process.exit(0);
  } catch (error) {
    console.error('✗ Failed to connect to Strava:', error.message);
    process.exit(1);
  }
}

main();


