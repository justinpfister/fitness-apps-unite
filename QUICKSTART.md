# Quick Start Guide

Get up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Active accounts on Peloton, Garmin Connect, and Strava
- Recent workout data in Peloton and/or Garmin

## Installation

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env
```

## Configuration

Edit `.env` and add your credentials:

### Peloton
```
PELOTON_USERNAME=your_email@example.com
PELOTON_PASSWORD=your_password
```

### Garmin Connect
```
GARMIN_USERNAME=your_garmin_email@example.com
GARMIN_PASSWORD=your_garmin_password
```

### Strava

First, create a Strava API application:
1. Go to https://www.strava.com/settings/api
2. Create a new application
3. Set Authorization Callback Domain to: `localhost`
4. Copy your Client ID and Client Secret

Then get your OAuth tokens:
```bash
npm run strava-auth YOUR_CLIENT_ID YOUR_CLIENT_SECRET
```

Open the URL in your browser, authorize, and copy the tokens to `.env`:
```
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_ACCESS_TOKEN=your_access_token
STRAVA_REFRESH_TOKEN=your_refresh_token
```

## Test Setup

Verify everything is configured correctly:

```bash
npm test
```

You should see green checkmarks (✓) for all three services.

## Usage

### Option 1: Manual Sync (Run Once)

```bash
npm start
```

This will:
- Fetch recent activities from Peloton and Garmin
- Match and merge activities
- Upload merged activities to Garmin Connect
- Sync eligible activities to Strava (after waiting period)

### Option 2: Automated Sync (Recommended)

```bash
npm run scheduler
```

This will:
- Run an initial sync immediately
- Continue running syncs every 2 hours automatically
- Keep running until you stop it (Ctrl+C)

For 24/7 operation, consider using PM2:
```bash
npm install -g pm2
pm2 start scheduler/cron.js --name fitness-sync
pm2 startup  # Enable auto-start on boot
pm2 save     # Save current configuration
```

## What Happens?

### Matching Process
The system looks for Peloton and Garmin activities that:
- Started within 30 minutes of each other
- Have similar durations
- Score high on the matching algorithm

### Merging Process
When matched:
1. Uses Peloton data for power, speed, heart rate
2. Supplements with Garmin data for cadence, GPS
3. Generates TCX file with combined data
4. Uploads to Garmin Connect

### Strava Sync
Activities are synced to Strava if they:
- Are Run or Bike type
- Are longer than 25 minutes
- Have waited at least 1.5 hours (to ensure matching is complete)

This prevents duplicates from Garmin's auto-sync.

## Customization

Edit `.env` to adjust behavior:

```env
# Run sync every X hours (default: 2)
SYNC_INTERVAL_HOURS=2

# Only sync activities longer than X minutes to Strava (default: 25)
STRAVA_MIN_DURATION_MINUTES=25

# Wait X hours before syncing to Strava (default: 1.5)
STRAVA_WAIT_HOURS=1.5

# Match activities within X minutes window (default: 30)
MATCHING_TIME_WINDOW_MINUTES=30

# Logging level: debug, info, warn, error (default: info)
LOG_LEVEL=info
```

## Monitoring

Check the logs to see what's happening:
- Green messages indicate success
- Yellow warnings indicate potential issues
- Red errors indicate failures (check credentials)

For detailed debugging:
```env
LOG_LEVEL=debug
```

## Common Scenarios

### Scenario 1: Peloton Run + Garmin Watch
You do a Peloton treadmill run while wearing your Garmin watch for cadence data.

**Result**: Merged activity with Peloton's power/speed plus Garmin's running cadence, uploaded to Garmin Connect and (if >25min) synced to Strava.

### Scenario 2: Peloton Bike Only
You do a Peloton cycling class without any other device.

**Result**: Peloton activity recorded as standalone. If >25min, synced to Strava after waiting period.

### Scenario 3: Garmin Outdoor Run Only
You go for an outdoor run with just your Garmin watch.

**Result**: Garmin activity recorded as standalone. Garmin's auto-sync to Strava handles it (since it's not a combo activity).

### Scenario 4: Short Yoga Class
You do a 20-minute Peloton yoga class.

**Result**: Recorded but NOT synced to Strava (below 25-minute threshold).

## Troubleshooting

### "Failed to connect to Peloton"
- Check username/password in `.env`
- Try logging into Peloton website manually

### "Failed to connect to Garmin"  
- Verify credentials are correct
- Garmin auth is complex; check NOTES.md for details

### "Failed to connect to Strava"
- Re-run the OAuth flow: `npm run strava-auth ...`
- Ensure tokens are copied correctly to `.env`

### No activities found
- Make sure you have recent workouts (last few days)
- Check that you're logged into the correct accounts

### Activities not matching
- Try `LOG_LEVEL=debug` to see matching scores
- Check that activities started within 30 minutes of each other
- Verify both activities are being fetched

## Next Steps

- Review `README.md` for detailed documentation
- Check `NOTES.md` for implementation details and limitations
- Adjust configuration in `.env` to match your preferences
- Set up PM2 for always-on automated syncing

## Need Help?

Check the full documentation in README.md or review the logs with `LOG_LEVEL=debug` enabled.

Happy syncing! 🚴‍♂️🏃‍♂️

