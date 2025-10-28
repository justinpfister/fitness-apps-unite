import { logger } from './utils/logger.js';
import { validateConfig } from './utils/config.js';
import { SyncOrchestrator } from './sync/orchestrator.js';

/**
 * Main entry point for manual sync
 * Usage: node index.js
 */

async function main() {
  try {
    logger.info('Fitness Apps Unite - Manual Sync');
    
    // Validate configuration
    if (!validateConfig()) {
      logger.error('Configuration validation failed. Please check your .env file.');
      process.exit(1);
    }

    // Create orchestrator and run sync
    const orchestrator = new SyncOrchestrator();
    const result = await orchestrator.sync();

    logger.info('Sync completed successfully', result);
    process.exit(0);
  } catch (error) {
    logger.error('Sync failed', error);
    process.exit(1);
  }
}

main();

