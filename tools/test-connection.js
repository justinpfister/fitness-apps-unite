import { logger } from '../utils/logger.js';
import { config, validateConfig } from '../utils/config.js';
import { PelotonClient } from '../clients/peloton.js';
import { GarminClient } from '../clients/garmin.js';
import { StravaClient } from '../clients/strava.js';
import { StateDatabase } from '../state/database.js';

/**
 * Test script to verify API connections
 * Usage: node tools/test-connection.js
 */

async function testPeloton() {
  console.log('\n--- Testing Peloton Connection ---');
  try {
    const client = new PelotonClient(config.peloton.username, config.peloton.password);
    const workouts = await client.getRecentWorkouts(5);
    console.log(`✓ Successfully connected to Peloton`);
    console.log(`  Found ${workouts.length} recent workouts`);
    if (workouts.length > 0) {
      console.log(`  Most recent: ${workouts[0].name} on ${workouts[0].startTime.toLocaleDateString()}`);
    }
    return true;
  } catch (error) {
    console.error(`✗ Failed to connect to Peloton:`, error.message);
    return false;
  }
}

async function testGarmin() {
  console.log('\n--- Testing Garmin Connection ---');
  try {
    const client = new GarminClient(
      config.garmin.username, 
      config.garmin.password,
      config.garmin.useTokens,
      config.garmin.tokenPath
    );
    const activities = await client.getRecentActivities(5);
    console.log(`✓ Successfully connected to Garmin Connect`);
    console.log(`  Found ${activities.length} recent activities`);
    if (activities.length > 0) {
      console.log(`  Most recent: ${activities[0].activityName} on ${activities[0].startTime.toLocaleDateString()}`);
    }
    return true;
  } catch (error) {
    console.error(`✗ Failed to connect to Garmin:`, error.message);
    return false;
  }
}

async function testStrava() {
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
    console.log(`✓ Successfully connected to Strava`);
    console.log(`  Found ${activities.length} recent activities`);
    if (activities.length > 0) {
      console.log(`  Most recent: ${activities[0].name} on ${new Date(activities[0].start_date).toLocaleDateString()}`);
    }
    return true;
  } catch (error) {
    console.error(`✗ Failed to connect to Strava:`, error.message);
    return false;
  }
}

async function main() {
  console.log('=== Fitness Apps Unite - Connection Test ===');
  
  // Validate config
  console.log('\n--- Validating Configuration ---');
  if (!validateConfig()) {
    console.error('✗ Configuration validation failed');
    console.error('  Please check your .env file and ensure all required variables are set');
    process.exit(1);
  }
  console.log('✓ Configuration validated');

  // Test each service
  const results = {
    peloton: await testPeloton(),
    garmin: await testGarmin(),
    strava: await testStrava(),
  };

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Peloton: ${results.peloton ? '✓ Connected' : '✗ Failed'}`);
  console.log(`Garmin:  ${results.garmin ? '✓ Connected' : '✗ Failed'}`);
  console.log(`Strava:  ${results.strava ? '✓ Connected' : '✗ Failed'}`);

  const allPassed = results.peloton && results.garmin && results.strava;
  
  if (allPassed) {
    console.log('\n✓ All services connected successfully!');
    console.log('  You can now run: npm start (manual sync) or npm run scheduler (automated)');
  } else {
    console.log('\n✗ Some services failed to connect. Please check your credentials.');
  }

  process.exit(allPassed ? 0 : 1);
}

main();

