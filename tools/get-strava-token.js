import http from 'http';
import { URL } from 'url';
import axios from 'axios';

/**
 * Helper script to get Strava OAuth tokens
 * 
 * Usage:
 * 1. Create a Strava API application at https://www.strava.com/settings/api
 * 2. Set the Authorization Callback Domain to: localhost
 * 3. Run: node tools/get-strava-token.js YOUR_CLIENT_ID YOUR_CLIENT_SECRET
 * 4. Follow the instructions
 */

const clientId = process.argv[2];
const clientSecret = process.argv[3];
const port = 8080;
const redirectUri = `http://localhost:${port}/callback`;

if (!clientId || !clientSecret) {
  console.error('Usage: node tools/get-strava-token.js CLIENT_ID CLIENT_SECRET');
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  
  if (url.pathname === '/callback') {
    const code = url.searchParams.get('code');
    
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h1>Error: No authorization code received</h1>');
      return;
    }

    try {
      // Exchange authorization code for tokens
      const response = await axios.post('https://www.strava.com/oauth/token', {
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
      });

      const { access_token, refresh_token, expires_at } = response.data;

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <h1>Success!</h1>
        <p>Copy these values to your .env file:</p>
        <pre>
STRAVA_ACCESS_TOKEN=${access_token}
STRAVA_REFRESH_TOKEN=${refresh_token}
        </pre>
        <p>Token expires at: ${new Date(expires_at * 1000).toISOString()}</p>
        <p>You can close this window now.</p>
      `);

      console.log('\n=== Strava OAuth Tokens ===');
      console.log(`STRAVA_ACCESS_TOKEN=${access_token}`);
      console.log(`STRAVA_REFRESH_TOKEN=${refresh_token}`);
      console.log(`\nToken expires at: ${new Date(expires_at * 1000).toISOString()}`);
      console.log('\nAdd these to your .env file.');
      
      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 1000);
    } catch (error) {
      console.error('Error exchanging code for tokens:', error.response?.data || error.message);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<h1>Error exchanging authorization code</h1>');
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(port, () => {
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=activity:write,activity:read_all`;
  
  console.log('\n=== Strava OAuth Setup ===');
  console.log('\n1. Make sure your Strava API application has:');
  console.log('   Authorization Callback Domain: localhost');
  console.log('\n2. Open this URL in your browser:');
  console.log(`\n${authUrl}\n`);
  console.log('3. Authorize the application');
  console.log('4. You will be redirected and your tokens will be displayed\n');
  console.log(`Waiting for authorization on http://localhost:${port}/callback...`);
});

