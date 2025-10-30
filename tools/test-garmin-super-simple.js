import axios from 'axios';
import fs from 'fs';

console.log('1. Loading tokens...');
const oauth1 = JSON.parse(fs.readFileSync('./data/garmin-tokens/oauth1_token.json', 'utf-8'));
const oauth2 = JSON.parse(fs.readFileSync('./data/garmin-tokens/oauth2_token.json', 'utf-8'));

console.log('2. Setting up request...');
const url = 'https://connect.garmin.com/gc-api/activitylist-service/activities/search/activities?start=0&limit=5';

const headers = {
  'Authorization': `Bearer ${oauth2.access_token}`,
  'Cookie': `GARMIN-SSO-CUST-GUID=${oauth1.token}`,
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

console.log('3. Making request to:', url);

axios.get(url, { headers })
  .then(response => {
    console.log('4. Response received!');
    console.log('   Status:', response.status);
    console.log('   Data type:', typeof response.data);
    
    if (Array.isArray(response.data)) {
      console.log('   ✓ Got array with', response.data.length, 'activities');
      if (response.data.length > 0) {
        console.log('   First activity:', response.data[0].activityName);
      }
    } else {
      console.log('   Response keys:', Object.keys(response.data || {}));
    }
    process.exit(0);
  })
  .catch(error => {
    console.log('4. ERROR:', error.response?.status, error.message);
    process.exit(1);
  });

console.log('Request sent, waiting for response...');

