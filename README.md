# fitness-apps-unite

Weave up the ultimate combination of Peloton, Strava and Garmin activities. Automatically sync and merge your fitness data!

## Overview

This tool automatically:
- Fetches activities from Peloton and Garmin Connect
- Intelligently matches activities using timestamp and duration analysis
- Merges data (prioritizing Peloton sensors, supplementing with Garmin metrics)
- Uploads merged activities back to Garmin Connect
- Selectively syncs qualifying activities to Strava (Run/Bike + >25min only)

## Features

- **Smart Matching**: Matches Peloton and Garmin activities based on start time proximity and duration similarity
- **Intelligent Merging**: Prioritizes Peloton data (power, speed, heart rate) and supplements with Garmin metrics (cadence, GPS)
- **Duplicate Prevention**: Waits 1.5 hours before syncing to Strava to ensure proper matching
- **Selective Sync**: Only syncs Run/Bike activities over 25 minutes to Strava
- **Automated Scheduling**: Runs every 2 hours (configurable) to keep data fresh
- **State Tracking**: Prevents duplicate processing and maintains sync history

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

- **Peloton**: Your Peloton username and password
- **Garmin**: Your Garmin Connect email and password
- **Strava**: Strava API credentials (see Strava Setup below)

### 3. Strava API Setup

1. Go to https://www.strava.com/settings/api
2. Create an application
   - Set Authorization Callback Domain to: `localhost`
3. Note your Client ID and Client Secret
4. Get your OAuth tokens using the included helper:
   ```bash
   npm run strava-auth YOUR_CLIENT_ID YOUR_CLIENT_SECRET
   ```
5. Follow the instructions to authorize and copy the tokens to your `.env` file

### 4. Test Your Setup

Verify all connections are working:

```bash
npm test
```

This will test connections to Peloton, Garmin Connect, and Strava without making any changes.

## Usage

### Manual Sync

Run a one-time sync:

```bash
npm start
```

### Automated Scheduling

Start the scheduler to run syncs automatically every 2 hours:

```bash
npm run scheduler
```

The scheduler will:
- Run an initial sync on startup
- Continue running syncs every X hours (configured in `.env`)
- Run in the foreground (use a process manager like PM2 for background operation)

### Configuration Options

Edit `.env` to customize behavior:

- `SYNC_INTERVAL_HOURS`: How often to run syncs (default: 2)
- `STRAVA_MIN_DURATION_MINUTES`: Minimum activity duration to sync to Strava (default: 25)
- `STRAVA_WAIT_HOURS`: How long to wait before syncing to Strava (default: 1.5)
- `MATCHING_TIME_WINDOW_MINUTES`: Time window for matching activities (default: 30)

## How It Works

### Matching Algorithm

Activities are matched based on:
- **Time Proximity** (70% weight): Activities starting within 30 minutes of each other
- **Duration Similarity** (30% weight): Similar activity lengths

The algorithm accounts for edge cases like forgetting to stop your watch.

### Merging Strategy

When merging Peloton and Garmin data:
1. Use Peloton as the source of truth for: power, speed, heart rate, workout structure
2. Supplement with Garmin data for: running cadence, GPS data, advanced metrics
3. Generate TCX file with combined data
4. Upload to Garmin Connect

### Strava Sync Flow

1. Activity completes on Peloton and/or Garmin
2. Sync process matches and merges activities
3. Merged activity uploaded to Garmin Connect
4. Wait 1.5 hours (configurable)
5. If activity meets criteria (Run/Bike + >25min), sync to Strava

This delay prevents duplicates by giving time to find matching pairs before pushing to Strava.

## Project Structure

```
fitness-apps-unite/
├── auth/               # Authentication for each service
│   ├── peloton.js
│   ├── garmin.js
│   └── strava.js
├── clients/            # API clients for fetching/uploading data
│   ├── peloton.js
│   ├── garmin.js
│   └── strava.js
├── matching/           # Smart activity matching algorithm
│   └── matcher.js
├── merging/            # Data merging and TCX generation
│   └── merger.js
├── scheduler/          # Automated scheduling
│   └── cron.js
├── state/              # State persistence and tracking
│   └── database.js
├── sync/               # Main orchestration logic
│   └── orchestrator.js
├── utils/              # Utilities and configuration
│   ├── config.js
│   └── logger.js
├── data/               # State database (auto-created)
├── index.js            # Manual sync entry point
├── package.json
└── .env                # Configuration (create from .env.example)
```

## Troubleshooting

### Authentication Issues

- **Peloton**: Verify username/password are correct
- **Garmin**: Garmin authentication can be complex; ensure credentials are correct
- **Strava**: Make sure your refresh token is valid and has `activity:write` scope

### No Matches Found

- Check that activities occurred within the time window (default 30 minutes)
- Verify activities are being fetched from both services
- Review matching scores in logs (set `LOG_LEVEL=debug`)

### Duplicate Strava Activities

- Ensure `STRAVA_WAIT_HOURS` is set appropriately (1.5+ hours recommended)
- Check that Garmin auto-sync to Strava is not creating duplicates for short activities

## License

MIT
