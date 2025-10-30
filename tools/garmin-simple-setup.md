# Garmin Token Setup - Simple Method

## The Problem
Garmin has MFA (Multi-Factor Authentication) enabled on your account, so we can't do automated password login. We need to extract authentication tokens from your browser session.

## The Solution (5 minutes)

### Step 1: Login to Garmin

1. Open Chrome or Edge browser
2. Go to: **https://connect.garmin.com**
3. Log in with your credentials (complete MFA if prompted)
4. Make sure you're fully logged in and can see your dashboard

### Step 2: Open Developer Tools

Press **F12** (or Right-click → Inspect)

### Step 3: Get OAuth Tokens

Click the **Console** tab at the top of Developer Tools

### Step 4: Run This Script

Copy and paste this entire block into the Console and press Enter:

```javascript
// Run this in the Garmin Connect console
(async function() {
  console.clear();
  console.log('🔍 Searching for Garmin OAuth tokens...\n');
  
  // Method 1: Check cookies
  const cookies = document.cookie.split(';').reduce((acc, c) => {
    const [k, v] = c.trim().split('=');
    if (k) acc[k] = v;
    return acc;
  }, {});
  
  // Method 2: Check localStorage
  const storage = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    storage[key] = localStorage.getItem(key);
  }
  
  // Method 3: Make a test request and intercept headers
  console.log('Making test API call to capture tokens...');
  try {
    const response = await fetch('https://connect.garmin.com/modern/proxy/userprofile-service/userprofile', {
      credentials: 'include'
    });
    console.log('✓ API call successful\n');
  } catch(e) {
    console.log('⚠️ API call failed, but that\'s OK\n');
  }
  
  // Extract likely tokens
  const oauth_token = cookies['GARMIN-SSO-CUST-GUID'] || cookies['oauth_token'] || storage['oauth_token'];
  const oauth_secret = cookies['oauth_token_secret'] || storage['oauth_token_secret'];
  
  // Output results
  console.log('═══════════════════════════════════════');
  console.log('COPY THE JSON BELOW (between the lines)');
  console.log('═══════════════════════════════════════\n');
  
  const tokens = {
    token: oauth_token || 'NOT_FOUND',
    token_secret: oauth_secret || oauth_token || 'NOT_FOUND'
  };
  
  console.log(JSON.stringify(tokens, null, 2));
  
  console.log('\n═══════════════════════════════════════');
  
  if (oauth_token) {
    console.log('\n✓ Tokens found! Copy the JSON above.');
  } else {
    console.log('\n⚠️ Tokens not found automatically.');
    console.log('\nTry this instead:');
    console.log('1. Click "Network" tab in DevTools');
    console.log('2. Refresh the page (F5)');
    console.log('3. Click any request to "connect.garmin.com"');
    console.log('4. Look in "Request Headers" for:');
    console.log('   - Cookie header (look for oauth or SSO)');
    console.log('   - DI-Backend header');
    console.log('   - Authorization header');
  }
})();
```

### Step 5: Copy the Output

You'll see JSON output like:
```json
{
  "token": "abc123...",
  "token_secret": "xyz789..."
}
```

Copy everything between the `═══` lines (including the `{` and `}`)

### Step 6: Save the Tokens

Run this command in your terminal:

```bash
node tools/save-garmin-tokens.js
```

When prompted, paste the JSON you copied.

### Step 7: Test

```bash
npm run test:garmin
```

If it works, you're done! If not, read the troubleshooting section below.

---

## Alternative: Manual Cookie Extraction

If the script above doesn't find tokens, you can extract them manually:

### Method A: From Cookies

1. In DevTools, click **Application** tab
2. Expand **Cookies** in left sidebar  
3. Click **https://connect.garmin.com**
4. Look for these cookies:
   - `GARMIN-SSO-CUST-GUID`
   - `oauth_token`
   - `oauth_token_secret`
   - `DI-Backend`

### Method B: From Network Tab

1. In DevTools, click **Network** tab
2. Refresh the page (F5)
3. Click any XHR request to `connect.garmin.com` or `connectapi.garmin.com`
4. Click **Headers** tab
5. Scroll to **Request Headers**
6. Look for the **Cookie** header
7. Find values with "oauth" or "SSO" in them

---

## Troubleshooting

### "Tokens not found"

The console script couldn't auto-detect tokens. This happens because Garmin's token format changes. Use the manual methods above.

### "Authentication failed" after saving tokens

The tokens expired or are invalid. Garmin tokens can expire. Solutions:
- Log out of Garmin completely, log back in, and extract fresh tokens
- Make sure you completed MFA when logging in
- Try using a different browser (Chrome recommended)

### Still not working?

Garmin's authentication is complex. If you continue having issues:

1. **Option A**: Create a second Garmin account without MFA for API access
2. **Option B**: Skip Garmin entirely - the app works with just Peloton + Strava

---

## What These Tokens Do

These OAuth tokens allow the app to authenticate as you without needing your password or MFA each time. They're like a "remember me" token that lasts for weeks/months.

The app will:
- Load tokens from `data/garmin-tokens/oauth1_token.json`
- Use them to access your Garmin data
- You won't need to re-authenticate unless tokens expire

---

## Security Note

Keep your token files private! They provide full access to your Garmin account. The files are automatically excluded from git via `.gitignore`.

