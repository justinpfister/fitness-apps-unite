/**
 * INSTRUCTIONS:
 * 
 * 1. Go to https://connect.garmin.com in your browser
 * 2. Make sure you're LOGGED IN (you should see your dashboard)
 * 3. Open Developer Tools (F12)
 * 4. Go to the "Network" tab
 * 5. Filter by "XHR" or "Fetch/XHR"
 * 6. Click on any activity or refresh the page
 * 7. Look for a request to "activities" or any API call
 * 8. Click on it and go to "Headers" tab
 * 9. Find the "Authorization" header - it will look like:
 *    Authorization: Bearer eyJhbGc...
 * 10. Copy JUST the token part (everything after "Bearer ")
 * 11. Also find the Cookie header and copy the GARMIN-SSO-CUST-GUID value
 * 
 * Then run: node tools/save-garmin-tokens.js
 * And paste those values when prompted
 */

console.log('See instructions in this file');
console.log('Run: node tools/save-garmin-tokens.js');

