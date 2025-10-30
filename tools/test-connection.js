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

async function testPeloton(stateDb) {
  console.log('\n--- Testing Peloton Connection ---');
  try {
    const client = new PelotonClient(config.peloton.username, config.peloton.password, stateDb);
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
  
  // Check if Garmin is configured
  if (!config.garmin.username || !config.garmin.password) {
    console.log('⊘ Garmin not configured (skipped)');
    console.log('  Add GARMIN_USERNAME and GARMIN_PASSWORD to .env to enable');
    return null;  // null = skipped, not failed
  }
  
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

  // Create state database for tests
  const stateDb = new StateDatabase(config.state.dbPath);

  // Test each service
  const results = {
    peloton: await testPeloton(stateDb),
    garmin: await testGarmin(),
    strava: await testStrava(),
  };

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Peloton: ${results.peloton ? '✓ Connected' : '✗ Failed'}`);
  console.log(`Garmin:  ${results.garmin === null ? '⊘ Skipped' : results.garmin ? '✓ Connected' : '✗ Failed'}`);
  console.log(`Strava:  ${results.strava ? '✓ Connected' : '✗ Failed'}`);

  // Count configured and successful services
  const configuredServices = [
    results.peloton !== null,
    results.garmin !== null,
    results.strava !== null
  ].filter(Boolean).length;
  
  const successfulServices = [
    results.peloton === true,
    results.garmin === true,
    results.strava === true
  ].filter(Boolean).length;
  
  const failedServices = [
    results.peloton === false,
    results.garmin === false,
    results.strava === false
  ].filter(Boolean).length;

  if (failedServices === 0 && configuredServices > 0) {
    console.log(`\n✓ All configured services connected successfully! (${successfulServices}/${configuredServices})`);
    console.log('  You can now run: npm start (manual sync) or npm run scheduler (automated)');
  } else if (failedServices > 0) {
    console.log(`\n✗ Some services failed to connect (${successfulServices} working, ${failedServices} failed).`);
    console.log('  Please check your credentials for failed services.');
  } else {
    console.log('\n⚠️  No services configured. Please add credentials to .env');
  }

  process.exit(failedServices > 0 ? 1 : 0);
}

main();

