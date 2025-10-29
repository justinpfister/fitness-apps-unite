# Garmin Connect MFA Setup Guide

If your Garmin account requires Multi-Factor Authentication (MFA/2FA), you can use token-based authentication to bypass MFA after the initial setup.

## How It Works

1. **One-Time Login**: Login to Garmin Connect once (handling MFA manually if needed)
2. **Save Tokens**: The authentication tokens are saved to disk
3. **Future Logins**: The app uses these saved tokens without needing MFA

## Setup Instructions

### Option 1: Automatic Setup (No MFA)

If your Garmin account **does not** have MFA enabled:

1. Add your credentials to `.env`:
   ```env
   GARMIN_USERNAME=your_email@example.com
   GARMIN_PASSWORD=your_password
   GARMIN_USE_TOKENS=false
   ```

2. Run the test:
   ```bash
   npm test
   ```

3. If it works, optionally enable token caching to speed up future logins:
   ```env
   GARMIN_USE_TOKENS=true
   ```

### Option 2: Token Setup (With MFA)

If your Garmin account **has MFA enabled**:

#### Step 1: Try the Setup Script

First, try the automated setup:

```bash
npm run garmin-setup
```

This will attempt to login and save tokens automatically. **However**, the `garmin-connect` library has limited MFA support, so this may fail.

#### Step 2: Manual Token Extraction

If the automated setup fails, you'll need to manually extract tokens:

1. **Login to Garmin Connect in your browser**:
   - Go to https://connect.garmin.com
   - Login with your credentials and complete MFA

2. **Open Developer Tools**:
   - Press F12 (or right-click → Inspect)
   - Go to the "Application" or "Storage" tab
   - Find "Cookies" in the left sidebar
   - Select `https://connect.garmin.com`

3. **Find OAuth Tokens**:
   Look for these cookies (they may have slightly different names):
   - `oauth_token`
   - `oauth_token_secret`
   - `GARMIN-SSO-CUST-GUID`

4. **Create Token Files**:
   
   Create directory:
   ```bash
   mkdir -p data/garmin-tokens
   ```

   Create `data/garmin-tokens/oauth1_token.json`:
   ```json
   {
     "token": "YOUR_OAUTH_TOKEN_VALUE",
     "token_secret": "YOUR_OAUTH_TOKEN_SECRET_VALUE"
   }
   ```

   Create `data/garmin-tokens/oauth2_token.json`:
   ```json
   {
     "access_token": "YOUR_ACCESS_TOKEN",
     "refresh_token": "YOUR_REFRESH_TOKEN",
     "expires_at": 9999999999
   }
   ```

   **Note**: The exact format may vary. If this doesn't work, check the Garmin Connect cookies for additional fields.

5. **Update .env**:
   ```env
   GARMIN_USERNAME=your_email@example.com
   GARMIN_PASSWORD=your_password
   GARMIN_USE_TOKENS=true
   ```

6. **Test**:
   ```bash
   npm test
   ```

## Environment Variables

Add these to your `.env` file:

```env
# Required
GARMIN_USERNAME=your_email@example.com
GARMIN_PASSWORD=your_password

# Enable token-based authentication (for MFA accounts)
GARMIN_USE_TOKENS=true

# Optional: Custom token storage path
# GARMIN_TOKEN_PATH=./data/garmin-tokens
```

## How It Works Internally

When `GARMIN_USE_TOKENS=true`:

1. **First attempt**: App tries to load existing tokens from `data/garmin-tokens/`
2. **Token validation**: Makes a test API call to verify tokens are still valid
3. **If tokens invalid/missing**: Falls back to normal login and saves new tokens
4. **Future runs**: Uses saved tokens without password/MFA

## Token Expiration

- Tokens may expire after some time (Garmin's policy)
- If tokens expire, the app will automatically re-authenticate using your password
- For MFA accounts, you'll need to manually refresh tokens using the steps above

## Troubleshooting

### "Tokens not found" Error

- Make sure `data/garmin-tokens/` directory exists
- Check that both `oauth1_token.json` and `oauth2_token.json` files are present
- Verify the JSON files are properly formatted

### "Invalid tokens" Error

- Tokens have expired - follow the manual extraction steps again
- For MFA accounts, you'll need to refresh tokens periodically

### "Authentication failed" Error

- Double-check your username and password
- Make sure MFA is completed when logging in via browser
- Try extracting tokens again from a fresh browser session

## Alternative: Garmin Account Without MFA

**Recommended workaround**: If possible, create a secondary Garmin account without MFA specifically for this integration. You can then:

1. Share activities from your main account to the secondary account
2. Use the secondary account (without MFA) for API access
3. Avoid the complexity of token extraction

## Security Note

- Token files (`data/garmin-tokens/`) are automatically ignored by git (via `.gitignore`)
- Keep your token files secure - they provide full access to your Garmin account
- Never commit token files to version control
- Consider encrypting the token files for additional security

## Need Help?

If you continue having issues:

1. Check that your Garmin credentials work on the website
2. Try with `LOG_LEVEL=debug` to see detailed error messages
3. Review the `garmin-connect` npm package issues: https://github.com/Pythe1337N/garmin-connect/issues

