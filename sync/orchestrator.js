import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import { PelotonClient } from '../clients/peloton.js';
import { GarminClient } from '../clients/garmin.js';
import { StravaClient } from '../clients/strava.js';
import { ActivityMatcher } from '../matching/matcher.js';
import { ActivityMerger } from '../merging/merger.js';
import { StateDatabase } from '../state/database.js';

export class SyncOrchestrator {
  constructor() {
    this.pelotonClient = new PelotonClient(
      config.peloton.username,
      config.peloton.password
    );
    
    this.garminClient = new GarminClient(
      config.garmin.username,
      config.garmin.password,
      config.garmin.useTokens,
      config.garmin.tokenPath
    );
    
    this.stravaClient = new StravaClient(
      config.strava.clientId,
      config.strava.clientSecret,
      config.strava.refreshToken,
      config.strava.accessToken
    );
    
    this.matcher = new ActivityMatcher(config.sync.matchingTimeWindowMinutes);
    this.merger = new ActivityMerger();
    this.db = new StateDatabase(config.state.dbPath);
  }

  /**
   * Main sync process
   */
  async sync() {
    try {
      logger.info('Starting sync process');
      const startTime = new Date();

      // Step 1: Fetch recent activities from both sources
      const pelotonActivities = await this.pelotonClient.getRecentWorkouts(20);
      const garminActivities = await this.garminClient.getRecentActivities(20);

      // Step 2: Filter out already processed activities
      const newPelotonActivities = this.filterNewActivities(pelotonActivities, 'peloton');
      const newGarminActivities = this.filterNewActivities(garminActivities, 'garmin');

      logger.info('New activities found', {
        peloton: newPelotonActivities.length,
        garmin: newGarminActivities.length,
      });

      // Step 3: Match Peloton and Garmin activities
      const matches = this.matcher.matchActivities(newPelotonActivities, newGarminActivities);

      // Step 4: Merge matched activities
      for (const match of matches) {
        await this.processMergedActivity(match);
      }

      // Step 5: Process standalone activities (not matched)
      const standalonePeloton = this.matcher.findStandalonePelotonActivities(newPelotonActivities, matches);
      const standaloneGarmin = this.matcher.findStandaloneGarminActivities(newGarminActivities, matches);

      for (const activity of standalonePeloton) {
        await this.processStandalonePelotonActivity(activity);
      }

      for (const activity of standaloneGarmin) {
        await this.processStandaloneGarminActivity(activity);
      }

      // Step 6: Sync eligible activities to Strava (with waiting period)
      await this.syncToStrava();

      this.db.setLastSyncTime(new Date());
      
      const duration = ((new Date() - startTime) / 1000).toFixed(2);
      logger.info(`Sync completed in ${duration}s`);

      return {
        success: true,
        matched: matches.length,
        standalonePeloton: standalonePeloton.length,
        standaloneGarmin: standaloneGarmin.length,
      };
    } catch (error) {
      logger.error('Sync failed', error);
      throw error;
    }
  }

  /**
   * Process a matched Peloton/Garmin activity pair
   */
  async processMergedActivity(match) {
    const { pelotonActivity, garminActivity } = match;
    
    try {
      // Check if already processed
      const existing = this.db.getProcessedActivityByPelotonId(pelotonActivity.id);
      if (existing && existing.status === 'merged') {
        logger.debug('Activity already merged', { pelotonId: pelotonActivity.id });
        return;
      }

      // Merge the activities
      const merged = await this.merger.mergeActivities(match);

      // Generate TCX file
      const tcxData = this.merger.generateTCX(merged);

      // Upload to Garmin Connect
      try {
        await this.garminClient.uploadActivity(tcxData, merged.name);
        
        // Record in database
        this.db.addProcessedActivity({
          id: merged.id,
          pelotonId: pelotonActivity.id,
          garminId: garminActivity.activityId,
          processedAt: new Date(),
          mergedAt: new Date(),
          uploadedToGarmin: new Date(),
          status: 'merged',
        });

        logger.info('Merged activity processed successfully', {
          pelotonId: pelotonActivity.id,
          garminId: garminActivity.activityId,
        });
      } catch (uploadError) {
        logger.error('Failed to upload merged activity to Garmin', uploadError);
        
        // Still record it as merged, but not uploaded
        this.db.addProcessedActivity({
          id: merged.id,
          pelotonId: pelotonActivity.id,
          garminId: garminActivity.activityId,
          processedAt: new Date(),
          mergedAt: new Date(),
          status: 'merged',
        });
      }
    } catch (error) {
      logger.error('Failed to process merged activity', error);
    }
  }

  /**
   * Process a standalone Peloton activity (no Garmin match)
   */
  async processStandalonePelotonActivity(activity) {
    try {
      // Check if already processed
      const existing = this.db.getProcessedActivityByPelotonId(activity.id);
      if (existing) {
        return;
      }

      // Record as standalone
      this.db.addProcessedActivity({
        id: `peloton_${activity.id}`,
        pelotonId: activity.id,
        processedAt: new Date(),
        status: 'standalone',
      });

      logger.debug('Standalone Peloton activity recorded', { id: activity.id });
    } catch (error) {
      logger.error('Failed to process standalone Peloton activity', error);
    }
  }

  /**
   * Process a standalone Garmin activity (no Peloton match)
   */
  async processStandaloneGarminActivity(activity) {
    try {
      // Check if already processed
      const existing = this.db.getProcessedActivityByGarminId(activity.activityId);
      if (existing) {
        return;
      }

      // Record as standalone
      this.db.addProcessedActivity({
        id: `garmin_${activity.activityId}`,
        garminId: activity.activityId,
        processedAt: new Date(),
        status: 'standalone',
      });

      logger.debug('Standalone Garmin activity recorded', { id: activity.activityId });
    } catch (error) {
      logger.error('Failed to process standalone Garmin activity', error);
    }
  }

  /**
   * Sync eligible activities to Strava
   * Only syncs Run/Bike activities > 25 minutes that have waited the required time
   */
  async syncToStrava() {
    try {
      logger.info('Checking for activities to sync to Strava');

      const readyActivities = this.db.getActivitiesReadyForStrava(config.sync.stravaWaitHours);

      for (const processed of readyActivities) {
        // Get the full activity details
        let activity;
        
        if (processed.pelotonId) {
          // For merged or Peloton activities, check criteria
          const pelotonActivities = await this.pelotonClient.getRecentWorkouts(50);
          activity = pelotonActivities.find(a => a.id === processed.pelotonId);
          
          if (!activity) continue;

          // Check if meets Strava sync criteria
          if (!this.shouldSyncToStrava(activity)) {
            logger.debug('Activity does not meet Strava criteria', {
              id: processed.id,
              type: activity.type,
              duration: activity.duration,
            });
            continue;
          }

          // Check wait time
          if (!this.db.shouldSyncToStrava(activity.endTime, config.sync.stravaWaitHours)) {
            logger.debug('Activity not ready for Strava sync (waiting period)', {
              id: processed.id,
              endTime: activity.endTime,
            });
            continue;
          }

          // Generate TCX and upload to Strava
          const merged = {
            id: processed.id,
            name: activity.name || 'Workout',
            type: this.merger.mapActivityType(activity.type),
            startTime: activity.startTime,
            endTime: activity.endTime,
            duration: activity.duration,
            metrics: [],
            summary: {
              avgHeartRate: activity.avgHeartRate,
              avgCadence: activity.avgCadence,
              avgSpeed: activity.avgSpeed,
              avgPower: activity.avgPower,
              totalDistance: activity.distance,
              totalCalories: activity.calories,
            },
          };

          const tcxData = this.merger.generateTCX(merged);
          
          try {
            await this.stravaClient.uploadActivity(
              tcxData,
              `${activity.name}.tcx`,
              'tcx'
            );

            this.db.updateProcessedActivity(processed.id, {
              syncedToStrava: new Date(),
              status: 'synced',
            });

            logger.info('Successfully synced activity to Strava', { id: processed.id });
          } catch (uploadError) {
            logger.error('Failed to upload to Strava', uploadError);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to sync to Strava', error);
    }
  }

  /**
   * Check if an activity should be synced to Strava
   */
  shouldSyncToStrava(activity) {
    const minDurationSeconds = config.sync.stravaMinDurationMinutes * 60;
    
    // Check activity type (Run or Bike)
    const type = this.merger.mapActivityType(activity.type);
    if (type !== 'run' && type !== 'bike') {
      return false;
    }

    // Check duration
    if (activity.duration < minDurationSeconds) {
      return false;
    }

    return true;
  }

  /**
   * Filter out activities that have already been processed
   */
  filterNewActivities(activities, source) {
    const processed = this.db.getProcessedActivities();
    
    return activities.filter(activity => {
      const id = source === 'peloton' ? activity.id : activity.activityId;
      
      if (source === 'peloton') {
        return !processed.some(p => p.pelotonId === id);
      } else {
        return !processed.some(p => p.garminId === id);
      }
    });
  }
}

