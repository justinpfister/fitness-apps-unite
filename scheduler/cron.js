import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { config, validateConfig } from '../utils/config.js';
import { SyncOrchestrator } from '../sync/orchestrator.js';

// Validate configuration
if (!validateConfig()) {
  logger.error('Configuration validation failed. Please check your .env file.');
  process.exit(1);
}

const orchestrator = new SyncOrchestrator();

/**
 * Run sync process with error handling
 */
async function runSync() {
  try {
    logger.info('Scheduler triggered sync');
    const result = await orchestrator.sync();
    logger.info('Scheduler sync completed', result);
  } catch (error) {
    logger.error('Scheduler sync failed', error);
  }
}

// Schedule the sync to run every X hours (configured in .env)
const hours = config.sync.intervalHours;
const cronExpression = `0 */${hours} * * *`; // Every X hours

logger.info('Starting scheduler', {
  interval: `${hours} hours`,
  cronExpression,
});

// Run immediately on startup
logger.info('Running initial sync on startup');
runSync().catch(error => {
  logger.error('Initial sync failed', error);
});

// Schedule recurring syncs
cron.schedule(cronExpression, () => {
  runSync();
}, {
  timezone: 'America/New_York', // Adjust to your timezone
});

logger.info('Scheduler is running. Press Ctrl+C to stop.');

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down scheduler gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down scheduler gracefully');
  process.exit(0);
});

