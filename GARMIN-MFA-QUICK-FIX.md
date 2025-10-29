# Quick Fix for Garmin MFA Setup

Since OAuth1 tokens aren't available in the browser, here's the easiest solution:

## Option 1: Temporarily Disable MFA (Recommended - Takes 2 minutes)

1. **Disable MFA:**
   - Go to https://connect.garmin.com/modern/settings/account/security
   - Log in if needed
   - Disable Multi-Factor Authentication

2. **Run the setup:**
   ```bash
   npm run garmin-setup
   ```
   This will login and save both OAuth1 and OAuth2 tokens automatically.

3. **Re-enable MFA:**
   - Go back to security settings
   - Re-enable Multi-Factor Authentication

4. **Test:**
   ```bash
   npm test
   ```
   Should work now with saved tokens!

## Option 2: Try With Just OAuth2 (May not work)

The `garmin-connect` library typically requires OAuth1 tokens for initial authentication. 
However, since you have valid OAuth2 tokens, we could try creating a workaround,
but this is unlikely to work as the library's authentication flow depends on OAuth1.

## Why This Works

When MFA is disabled, the library can:
- Login with username/password
- Authenticate successfully
- Save both OAuth1 and OAuth2 tokens to disk

Once tokens are saved, MFA can be re-enabled because:
- The library will use saved tokens instead of logging in
- Tokens persist across MFA changes
- No password/MFA needed for future API calls

**Security Note:** The tokens provide access to your account, but they're stored locally in `data/garmin-tokens/` which is git-ignored.

