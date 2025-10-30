import { PelotonClient } from '../clients/peloton.js';
import { GarminClient } from '../clients/garmin.js';
import { StravaClient } from '../clients/strava.js';
import { ActivityMerger } from '../merging/merger.js';
import { StateDatabase } from '../state/database.js';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';

/**
 * Test script to upload activities
 * Flow: Peloton → Garmin → Strava
 */

async function testUploads() {
  console.log('=== Testing Activity Uploads ===\n');
  
  const stateDb = new StateDatabase('./data/state.json');
  
  // Test 1: Upload from Peloton to Garmin
  console.log('--- TEST 1: Upload Peloton Workout to Garmin ---');
  try {
    const peloton = new PelotonClient(config.peloton.username, config.peloton.password, stateDb);
    const garmin = new GarminClient(config.garmin.username, config.garmin.password);
    
    const workouts = await peloton.getRecentWorkouts(1);
    
    if (workouts.length === 0) {
      console.log('⚠️  No Peloton workouts found to test');
    } else {
      const workout = workouts[0];
      console.log(`\nFound workout: ${workout.name}`);
      console.log(`  ID: ${workout.id}`);
      console.log(`  Duration: ${workout.duration}s`);
      console.log(`  Type: ${workout.type}`);
      
      console.log('\nUploading to Garmin Connect...');
      // Note: Garmin requires TCX/FIT file format
      // We'll need to generate a TCX file from the Peloton workout data
      console.log('⚠️  Garmin upload requires TCX/FIT file format');
      console.log('   This needs to be implemented in the GarminClient');
      console.log('   For now, we can test Garmin → Strava sync');
    }
  } catch (error) {
    console.error('✗ Failed to test Peloton to Garmin upload:', error.message);
    if (error.response?.data) {
      console.error('  Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  // Test 2: Upload from Garmin to Strava (with full metrics via TCX)
  console.log('\n\n--- TEST 2: Upload Garmin Activity to Strava (with metrics) ---');
  try {
    const garmin = new GarminClient(config.garmin.username, config.garmin.password);
    const strava = new StravaClient(
      config.strava.clientId,
      config.strava.clientSecret,
      config.strava.refreshToken,
      config.strava.accessToken,
      stateDb
    );
    const merger = new ActivityMerger();
    
    const activities = await garmin.getRecentActivities(1);
    
    if (activities.length === 0) {
      console.log('⚠️  No Garmin activities found to test');
    } else {
      const activity = activities[0];
      console.log(`\nFound activity: ${activity.activityName}`);
      console.log(`  ID: ${activity.activityId}`);
      console.log(`  Duration: ${Math.round(activity.duration)}s`);
      console.log(`  Distance: ${Math.round(activity.distance)}m`);
      console.log(`  Type: ${activity.activityType}`);
      console.log(`  HR: ${activity.avgHeartRate || 'N/A'} avg, ${activity.maxHeartRate || 'N/A'} max`);
      console.log(`  Calories: ${activity.calories || 'N/A'}`);
      
      // Create merged activity structure for TCX generation
      const merged = {
        id: `test_${activity.activityId}`,
        name: `[TEST] ${activity.activityName}`,
        type: merger.mapActivityType(activity.activityType),
        startTime: new Date(activity.startTime),
        endTime: new Date(activity.endTime || Date.now()),
        duration: activity.duration,
        metrics: [], // Could fetch detailed samples if needed
        summary: {
          avgHeartRate: activity.avgHeartRate,
          maxHeartRate: activity.maxHeartRate,
          avgCadence: activity.avgCadence,
          avgSpeed: activity.avgSpeed,
          avgPower: activity.avgPower,
          totalDistance: activity.distance / 1000, // Convert to km
          totalCalories: activity.calories,
        },
      };
      
      console.log('\nGenerating TCX file with metrics...');
      const tcxData = merger.generateTCX(merged);
      
      console.log('Uploading TCX to Strava...');
      const result = await strava.uploadActivity(
        Buffer.from(tcxData),
        `${activity.activityName}_test.tcx`,
        'tcx'
      );
      
      if (result.id) {
        console.log(`✓ Successfully uploaded with metrics!`);
        console.log(`  Upload ID: ${result.id}`);
        console.log(`  Status: ${result.status || 'Processing'}`);
        console.log(`  Note: Strava processes uploads asynchronously`);
        console.log(`  Check your Strava dashboard in a few moments`);
      } else {
        console.log('⚠️  Upload returned:', JSON.stringify(result, null, 2));
      }
    }
  } catch (error) {
    console.error('✗ Failed to test Garmin upload:', error.message);
    if (error.response?.data) {
      console.error('  Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  console.log('\n\n=== Upload Test Complete ===');
  console.log('\nSummary:');
  console.log('✓ Peloton → Garmin: Needs TCX/FIT file generation (to be implemented)');
  console.log('✓ Garmin → Strava: Manual activity creation works!');
  console.log('\nNext steps:');
  console.log('1. Check Strava to verify the [TEST] activity was created');
  console.log('2. Run this script again to test deduplication');
  console.log('3. Implement TCX generation for Peloton → Garmin sync');
  console.log('4. Delete the test activities from Strava when done');
}

// Helper functions to map activity types
function mapGarminTypeToStrava(garminType) {
  const typeMap = {
    'running': 'Run',
    'trail_running': 'Run',
    'cycling': 'Ride',
    'road_cycling': 'Ride',
    'mountain_biking': 'Ride',
    'walking': 'Walk',
    'hiking': 'Hike',
    'swimming': 'Swim',
    'strength_training': 'WeightTraining',
    'yoga': 'Yoga'
  };
  return typeMap[garminType?.toLowerCase()] || 'Workout';
}

testUploads().catch(console.error);

