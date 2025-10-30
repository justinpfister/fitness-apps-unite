import { PelotonClient } from '../clients/peloton.js';
import { GarminClient } from '../clients/garmin.js';
import { StravaClient } from '../clients/strava.js';
import { StateDatabase } from '../state/database.js';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';

/**
 * Test script to examine the data structure from each service
 */

async function testDataStructures() {
  console.log('=== Testing Data Structures ===\n');
  
  const stateDb = new StateDatabase('./data/state.json');
  
  // Test Peloton
  console.log('--- PELOTON DATA STRUCTURE ---');
  try {
    const peloton = new PelotonClient(config.peloton.username, config.peloton.password, stateDb);
    const workouts = await peloton.getRecentWorkouts(2); // Get just 2 for inspection
    
    console.log(`\nFetched ${workouts.length} workouts`);
    if (workouts.length > 0) {
      console.log('\nFirst workout sample:');
      console.log(JSON.stringify(workouts[0], null, 2));
      
      console.log('\n✓ Key fields present:');
      const workout = workouts[0];
      console.log(`  - ID: ${workout.id || 'MISSING'}`);
      console.log(`  - Created: ${workout.created_at || workout.created || 'MISSING'}`);
      console.log(`  - Name: ${workout.ride?.title || workout.name || 'MISSING'}`);
      console.log(`  - Type: ${workout.fitness_discipline || workout.ride?.fitness_discipline || 'MISSING'}`);
      console.log(`  - Duration: ${workout.ride?.duration || workout.duration || 'MISSING'} seconds`);
      console.log(`  - Distance: ${workout.total_work || workout.distance || 'MISSING'}`);
    }
  } catch (error) {
    console.error('✗ Failed to test Peloton:', error.message);
  }
  
  console.log('\n\n--- GARMIN DATA STRUCTURE ---');
  try {
    const garmin = new GarminClient(config.garmin.username, config.garmin.password);
    const activities = await garmin.getRecentActivities(2);
    
    console.log(`\nFetched ${activities.length} activities`);
    if (activities.length > 0) {
      console.log('\nFirst activity sample:');
      console.log(JSON.stringify(activities[0], null, 2));
      
      console.log('\n✓ Key fields present:');
      const activity = activities[0];
      console.log(`  - ID: ${activity.activityId || activity.id || 'MISSING'}`);
      console.log(`  - Start Time: ${activity.startTimeLocal || activity.startTime || 'MISSING'}`);
      console.log(`  - Name: ${activity.activityName || activity.name || 'MISSING'}`);
      console.log(`  - Type: ${activity.activityType?.typeKey || activity.type || 'MISSING'}`);
      console.log(`  - Duration: ${activity.duration || activity.movingDuration || 'MISSING'} seconds`);
      console.log(`  - Distance: ${activity.distance || 'MISSING'} meters`);
    }
  } catch (error) {
    console.error('✗ Failed to test Garmin:', error.message);
  }
  
  console.log('\n\n--- STRAVA DATA STRUCTURE ---');
  try {
    const strava = new StravaClient(
      config.strava.clientId,
      config.strava.clientSecret,
      config.strava.refreshToken,
      config.strava.accessToken,
      stateDb
    );
    const activities = await strava.getRecentActivities(2);
    
    console.log(`\nFetched ${activities.length} activities`);
    if (activities.length > 0) {
      console.log('\nFirst activity sample:');
      console.log(JSON.stringify(activities[0], null, 2));
      
      console.log('\n✓ Key fields present:');
      const activity = activities[0];
      console.log(`  - ID: ${activity.id || 'MISSING'}`);
      console.log(`  - Start Time: ${activity.start_date || activity.start_date_local || 'MISSING'}`);
      console.log(`  - Name: ${activity.name || 'MISSING'}`);
      console.log(`  - Type: ${activity.type || activity.sport_type || 'MISSING'}`);
      console.log(`  - Duration: ${activity.moving_time || activity.elapsed_time || 'MISSING'} seconds`);
      console.log(`  - Distance: ${activity.distance || 'MISSING'} meters`);
    }
  } catch (error) {
    console.error('✗ Failed to test Strava:', error.message);
  }
  
  console.log('\n\n=== Data Structure Test Complete ===');
  console.log('\nNext: Review the data structures above to ensure our sync logic');
  console.log('will correctly map fields from Peloton/Garmin to Strava format.');
}

testDataStructures().catch(console.error);

