import axios from 'axios';

const sessionId = 'd4878cd5c79540c49172164f291b562a';

console.log('Testing Peloton API /api/me endpoint...\n');

axios.get('https://api.onepeloton.com/api/me', {
  headers: {
    Cookie: `peloton_session_id=${sessionId}`,
  },
})
  .then(response => {
    console.log('✓ Response received');
    console.log('\nFull response data:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('\n--- Key fields ---');
    console.log('user_id:', response.data.user_id);
    console.log('id:', response.data.id);
    console.log('username:', response.data.username);
  })
  .catch(error => {
    console.log('❌ Error:', error.response?.data || error.message);
  });

