# Garmin Setup Guide - Easy MFA Bypass

Since Garmin requires MFA (Multi-Factor Authentication), we can't use the traditional username/password login. Instead, we'll extract your session from the browser once, then reuse it.

## Why This is Needed

Garmin's API blocks automated logins when MFA is enabled. The solution is to:
1. Log in manually in your browser (handling MFA yourself)
2. Extract the authentication tokens from that session  
3. Save them so the app can reuse them automatically

This is a **one-time setup** - once tokens are saved, everything runs automatically.

---

## Quick Setup (Recommended)

### Step 1: Update .env

Add this line to your `.env` file:

```env
GARMIN_USE_TOKENS=true
```

### Step 2: Run the Extractor

We have **two methods** - try Method A first (it's easier):

---

## Method A: Console Script (Easiest)

### 1. Open Garmin in Browser

```
Human: I think the problem might be that I don't have a Garmin account
