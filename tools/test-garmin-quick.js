import { GarminCustomClient } from '../clients/garmin-custom.js';

async function test() {
  console.log('Testing Garmin with new endpoint...\n');
  
  try {
    console.log('Creating client...');
    const client = new GarminCustomClient('./data/garmin-tokens');
    console.log('Fetching activities...');
    const activities = await client.getRecentActivities(5);
    console.log('Got response!');
    
    console.log(`\n✓ SUCCESS! Found ${activities.length} activities`);
    
    if (activities.length > 0) {
      console.log('\nFirst activity:');
      console.log('  Name:', activities[0].activityName);
      console.log('  Date:', activities[0].startTime);
      console.log('  Duration:', activities[0].duration, 'seconds');
    }
    
    process.exit(0);
  } catch (error) {
    console.log('\n✗ FAILED:', error.message);
    console.log('Stack:', error.stack);
    process.exit(1);
  }
}

test();

