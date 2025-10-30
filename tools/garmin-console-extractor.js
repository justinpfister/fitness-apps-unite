// ==============================================================
// GARMIN TOKEN EXTRACTOR - Run this in browser console
// ==============================================================
// 
// INSTRUCTIONS:
// 1. Go to: https://connect.garmin.com (log in with MFA)
// 2. Press F12 to open DevTools
// 3. Click "Console" tab
// 4. Copy and paste this ENTIRE file into the console
// 5. Press Enter
// 6. Copy the JSON outputs it shows
//
// ==============================================================

(async function() {
  console.clear();
  console.log('%c🏃 GARMIN TOKEN EXTRACTOR', 'font-size: 20px; font-weight: bold; color: #007bff;');
  console.log('%c════════════════════════════════════════\n', 'color: #007bff;');
  
  // Extract cookies
  const cookies = document.cookie.split(';').reduce((acc, c) => {
    const [k, v] = c.trim().split('=');
    if (k) acc[k] = v;
    return acc;
  }, {});
  
  console.log('📋 Checking cookies...');
  
  // Find OAuth1 token
  const oauth1Token = cookies['GARMIN-SSO-CUST-GUID'] || 
                      cookies['oauth_token'] ||
                      cookies['GARMIN_SSO_GUID'];
  
  if (!oauth1Token) {
    console.log('%c❌ ERROR: OAuth1 token not found in cookies', 'color: red; font-weight: bold;');
    console.log('\nAvailable cookies:', Object.keys(cookies));
    console.log('\nTroubleshooting:');
    console.log('1. Make sure you are on connect.garmin.com (check URL)');
    console.log('2. Make sure you are logged in (see your name/dashboard?)');
    console.log('3. Try logging out and back in');
    console.log('4. Try a different browser (Chrome recommended)');
    return;
  }
  
  console.log('✓ Found OAuth1 token in cookies');
  
  // Also capture SESSIONID and session cookies
  const sessionId = cookies['SESSIONID'];
  const sessionCookie = cookies['session'];
  
  if (sessionId) {
    console.log('✓ Found SESSIONID cookie');
  }
  if (sessionCookie) {
    console.log('✓ Found session cookie');
  }
  
  // Try to get OAuth2 token
  console.log('\n📡 Attempting to capture OAuth2 token...');
  
  let oauth2Token = null;
  let refreshToken = null;
  let expiresAt = Math.floor(Date.now() / 1000) + 3600;
  
  // Method 1: Make an API call and check response
  try {
    const response = await fetch('https://connect.garmin.com/modern/proxy/userprofile-service/userprofile', {
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      console.log('✓ API call successful');
      
      // The token might be in the request (not response)
      // Let's check localStorage instead
    }
  } catch(e) {
    console.log('⚠️ API call failed:', e.message);
  }
  
  // Method 2: Check localStorage for tokens
  console.log('\n🔍 Searching localStorage...');
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    
    // Look for JWT tokens (start with "ey")
    if (value && typeof value === 'string' && value.startsWith('ey') && value.split('.').length === 3) {
      try {
        const parts = value.split('.');
        const payload = JSON.parse(atob(parts[1]));
        
        if (payload.garmin_guid || payload.client_id === 'CONNECT_WEB') {
          oauth2Token = value;
          if (payload.exp) expiresAt = payload.exp;
          refreshToken = value; // Often same for Garmin
          console.log('✓ Found OAuth2 token in localStorage:', key);
          console.log('  Expires:', new Date(expiresAt * 1000).toLocaleString());
          break;
        }
      } catch(e) {}
    }
    
    // Look for JSON objects with access_token
    if (value && value.includes('access_token')) {
      try {
        const parsed = JSON.parse(value);
        if (parsed.access_token) {
          oauth2Token = parsed.access_token;
          refreshToken = parsed.refresh_token || parsed.access_token;
          expiresAt = parsed.expires_at || parsed.exp || expiresAt;
          console.log('✓ Found OAuth2 token in localStorage:', key);
          break;
        }
      } catch(e) {}
    }
  }
  
  if (!oauth2Token) {
    console.log('⚠️ Could not auto-extract OAuth2 token from localStorage');
    console.log('   Will provide a placeholder - you may need to extract manually');
  }
  
  // Build output
  const oauth1Json = {
    token: oauth1Token,
    token_secret: oauth1Token
  };
  
  const oauth2Json = {
    access_token: oauth2Token || 'MANUAL_EXTRACTION_NEEDED',
    refresh_token: refreshToken || oauth2Token || 'MANUAL_EXTRACTION_NEEDED',
    expires_at: expiresAt,
    session_id: sessionId || '',
    session: sessionCookie || ''
  };
  
  // Display results
  console.log('\n\n%c════════════════════════════════════════', 'color: green; font-weight: bold;');
  console.log('%c✅ OAUTH1 TOKEN - COPY THIS JSON:', 'color: green; font-weight: bold; font-size: 14px;');
  console.log('%c════════════════════════════════════════', 'color: green; font-weight: bold;');
  console.log('%cSave to: data/garmin-tokens/oauth1_token.json\n', 'color: #666; font-style: italic;');
  console.log(JSON.stringify(oauth1Json, null, 2));
  
  console.log('\n\n%c════════════════════════════════════════', 'color: blue; font-weight: bold;');
  console.log('%c✅ OAUTH2 TOKEN - COPY THIS JSON:', 'color: blue; font-weight: bold; font-size: 14px;');
  console.log('%c════════════════════════════════════════', 'color: blue; font-weight: bold;');
  console.log('%cSave to: data/garmin-tokens/oauth2_token.json\n', 'color: #666; font-style: italic;');
  console.log(JSON.stringify(oauth2Json, null, 2));
  
  console.log('\n\n%c════════════════════════════════════════', 'color: orange; font-weight: bold;');
  console.log('%c📋 NEXT STEPS:', 'color: orange; font-weight: bold; font-size: 14px;');
  console.log('%c════════════════════════════════════════', 'color: orange; font-weight: bold;');
  console.log('1. Copy the OAuth1 JSON above');
  console.log('2. Paste into: data/garmin-tokens/oauth1_token.json');
  console.log('3. Copy the OAuth2 JSON above');
  console.log('4. Paste into: data/garmin-tokens/oauth2_token.json');
  console.log('5. Run: npm test');
  
  if (oauth2Token) {
    console.log('\n%c✅ SUCCESS! Both tokens extracted.', 'color: green; font-weight: bold; font-size: 16px;');
  } else {
    console.log('\n%c⚠️ OAuth1 extracted, OAuth2 needs manual extraction', 'color: orange; font-weight: bold;');
    console.log('\nTo get OAuth2 manually:');
    console.log('1. Stay on this page');
    console.log('2. Click "Network" tab (next to Console)');
    console.log('3. Refresh the page (F5)');
    console.log('4. Click any request to "connectapi.garmin.com"');
    console.log('5. Scroll down to "Request Headers"');
    console.log('6. Find "Authorization: Bearer eyJ..."');
    console.log('7. Copy everything after "Bearer " (the long eyJ... string)');
    console.log('8. Replace "MANUAL_EXTRACTION_NEEDED" with that token');
  }
  
  console.log('\n\n');
  
  // Also return the objects for easy copying
  return {
    oauth1: oauth1Json,
    oauth2: oauth2Json
  };
})();

