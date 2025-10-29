import pkg from 'garmin-connect';
const { GarminConnect } = pkg;
import { config } from '../utils/config.js';

async function testGarmin() {
  console.log('=== Testing Garmin Connect Library ===');
  console.log('Username:', config.garmin.username);
  console.log('Password length:', config.garmin.password?.length || 0);
  console.log('');
  
  try {
    console.log('Step 1: Creating GarminConnect client...');
    const GCClient = new GarminConnect({
      username: config.garmin.username,
      password: config.garmin.password
    });
    
    console.log('Step 2: Logging in...');
    await GCClient.login();
    
    console.log('Step 3: Fetching activities...');
    const activities = await GCClient.getActivities(0, 5);
    
    console.log('✓ SUCCESS! Found', activities.length, 'activities');
    if (activities.length > 0) {
      console.log('Most recent:', activities[0].activityName);
    }
    process.exit(0);
  } catch (error) {
    console.error('\n✗ FAILED at authentication');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error response:', error.response?.data);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

testGarmin();

