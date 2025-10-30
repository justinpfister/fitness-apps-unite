import axios from 'axios';
import fs from 'fs';

// Direct test of Garmin API with your tokens
const oauth1 = JSON.parse(fs.readFileSync('./data/garmin-tokens/oauth1_token.json', 'utf-8'));
const oauth2 = JSON.parse(fs.readFileSync('./data/garmin-tokens/oauth2_token.json', 'utf-8'));

const baseURL = 'https://connect.garmin.com/modern/proxy';

const headers = {
  'Authorization': `Bearer ${oauth2.access_token}`,
  'Cookie': `GARMIN-SSO-CUST-GUID=${oauth1.token}`,
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://connect.garmin.com/modern/',
};

async function testEndpoints() {
  const endpoints = [
    '/activitylist-service/activities?start=0&limit=5',
    '/activitylist-service/activities?limit=5',
    '/usersummary-service/usersummary/daily/lastweek',
    '/userprofile-service/userprofile',
    '/activitylist-service/activities/search/activities?start=0&limit=5',
  ];

  for (const endpoint of endpoints) {
    console.log(`\n=== Testing: ${endpoint} ===`);
    try {
      const response = await axios.get(`${baseURL}${endpoint}`, { headers });
      console.log('✓ Status:', response.status);
      console.log('Response type:', typeof response.data);
      
      if (Array.isArray(response.data)) {
        console.log('Array length:', response.data.length);
        if (response.data.length > 0) {
          console.log('First item keys:', Object.keys(response.data[0]));
        }
      } else if (typeof response.data === 'object') {
        console.log('Object keys:', Object.keys(response.data));
        console.log('Sample:', JSON.stringify(response.data).substring(0, 200));
      }
    } catch (error) {
      console.log('✗ Error:', error.response?.status, error.message);
    }
  }
}

testEndpoints();

