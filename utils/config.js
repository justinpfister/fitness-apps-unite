import dotenv from 'dotenv';

dotenv.config();

export const config = {
  peloton: {
    username: process.env.PELOTON_USERNAME || '',
    password: process.env.PELOTON_PASSWORD || '',
  },
  garmin: {
    username: process.env.GARMIN_USERNAME || '',
    password: process.env.GARMIN_PASSWORD || '',
    useTokens: ['1', 'true', 'yes'].includes((process.env.GARMIN_USE_TOKENS || '').toLowerCase()),
    tokenPath: process.env.GARMIN_TOKEN_PATH || './data/garmin-tokens',
  },
  strava: {
    clientId: process.env.STRAVA_CLIENT_ID || '',
    clientSecret: process.env.STRAVA_CLIENT_SECRET || '',
    refreshToken: process.env.STRAVA_REFRESH_TOKEN || '',
    accessToken: process.env.STRAVA_ACCESS_TOKEN || '',
  },
  sync: {
    intervalHours: parseFloat(process.env.SYNC_INTERVAL_HOURS || '2'),
    stravaMinDurationMinutes: parseInt(process.env.STRAVA_MIN_DURATION_MINUTES || '25'),
    stravaWaitHours: parseFloat(process.env.STRAVA_WAIT_HOURS || '1.5'),
    matchingTimeWindowMinutes: parseInt(process.env.MATCHING_TIME_WINDOW_MINUTES || '30'),
  },
  state: {
    dbPath: process.env.STATE_DB_PATH || './data/state.json',
  },
};

export function validateConfig() {
  const required = [
    'PELOTON_USERNAME',
    'PELOTON_PASSWORD',
    'GARMIN_USERNAME',
    'GARMIN_PASSWORD',
    'STRAVA_CLIENT_ID',
    'STRAVA_CLIENT_SECRET',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    return false;
  }

  return true;
}

