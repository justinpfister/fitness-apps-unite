import { logger } from '../utils/logger.js';
import { GarminCustomAuth } from '../auth/garmin-custom.js';

/**
 * Custom Garmin client using direct OAuth token authentication
 * Replaces the garmin-connect library for MFA accounts
 */
export class GarminCustomClient {
  constructor(tokenPath = './data/garmin-tokens') {
    this.auth = new GarminCustomAuth(tokenPath);
  }

  async ensureAuthenticated() {
    if (!this.auth.isAuthenticated()) {
      this.auth.loadTokens();
    }
  }

  async getRecentActivities(limit = 10) {
    await this.ensureAuthenticated();
    
    try {
      logger.info('Fetching recent Garmin activities');
      
      // Garmin API endpoint - use exact endpoint from browser
      const activitiesData = await this.auth.get('/activitylist-service/activities/search/activities', {
        start: 0,
        limit: limit
      });
      
      logger.info('Garmin API returned data');

      // Handle different response formats
      let activities = [];
      if (Array.isArray(activitiesData)) {
        activities = activitiesData;
      } else if (activitiesData && Array.isArray(activitiesData.activities)) {
        activities = activitiesData.activities;
      } else if (activitiesData && activitiesData.activityList) {
        activities = activitiesData.activityList;
      } else if (activitiesData && typeof activitiesData === 'object') {
        // Log the structure to debug
        const keys = Object.keys(activitiesData);
        logger.info('Response object keys:', keys);
        
        // Empty object might mean no activities
        if (keys.length === 0) {
          logger.info('Empty response - likely no activities in account');
          activities = [];
        } else if (activitiesData.data) {
          activities = activitiesData.data;
        } else if (activitiesData.results) {
          activities = activitiesData.results;
        } else if (activitiesData.items) {
          activities = activitiesData.items;
        } else {
          logger.warn('Could not find activities array in response. Keys:', keys);
          logger.warn('Sample data:', JSON.stringify(activitiesData).substring(0, 500));
          // Don't throw - might just be a different format or no activities
          activities = [];
        }
      } else {
        logger.warn('Unexpected response type:', typeof activitiesData);
        activities = [];
      }

      logger.info(`Found ${activities.length} Garmin activities`);

      return activities.map(activity => this.parseActivity(activity));
    } catch (error) {
      logger.error('Failed to fetch Garmin activities', error.message);
      throw error;
    }
  }

  async getActivityDetails(activityId) {
    await this.ensureAuthenticated();
    
    try {
      const activity = await this.auth.get(`/activity-service/activity/${activityId}`);
      return activity;
    } catch (error) {
      logger.error('Failed to fetch activity details', error.message);
      return null;
    }
  }

  async getActivitySamples(activityId) {
    await this.ensureAuthenticated();
    
    try {
      // Get detailed metrics for the activity
      const details = await this.auth.get(`/activity-service/activity/${activityId}/details`);
      return this.parseSamples(details);
    } catch (error) {
      logger.error('Failed to fetch activity samples', error.message);
      return [];
    }
  }

  async uploadActivity(tcxData, activityName) {
    await this.ensureAuthenticated();
    
    try {
      logger.info('Uploading activity to Garmin Connect', { activityName });
      
      // Garmin upload endpoint
      const result = await this.auth.post('/upload-service/upload/.tcx', tcxData, {
        headers: {
          'Content-Type': 'application/xml'
        }
      });

      logger.info('Successfully uploaded activity to Garmin Connect');
      return result;
    } catch (error) {
      logger.error('Failed to upload activity to Garmin', error.message);
      throw error;
    }
  }

  parseActivity(activity) {
    const startTime = new Date(activity.startTimeGMT || activity.beginTimestamp);
    const duration = activity.duration || activity.movingDuration || 0;
    const endTime = new Date(startTime.getTime() + duration * 1000);
    
    return {
      activityId: activity.activityId?.toString(),
      activityName: activity.activityName || activity.name || 'Garmin Activity',
      startTime: startTime,
      endTime: endTime,
      duration: duration,
      activityType: activity.activityType?.typeKey || activity.sport?.typeKey || 'other',
      avgHeartRate: activity.averageHR || activity.averageHeartRate,
      maxHeartRate: activity.maxHR || activity.maxHeartRate,
      avgRunCadence: activity.averageRunningCadence || activity.averageRunCadence,
      avgCyclingCadence: activity.averageBikeCadence,
      calories: activity.calories,
      distance: activity.distance, // meters
      avgSpeed: activity.averageSpeed, // m/s
    };
  }

  parseSamples(data) {
    const samples = [];
    
    // Handle Garmin API data structure
    if (data.metricDescriptors && data.activityDetailMetrics) {
      const descriptors = data.metricDescriptors;
      const metrics = data.activityDetailMetrics;

      // Find indices for metrics we care about
      const hrIndex = descriptors.findIndex(d => d.key === 'directHeartRate' || d.key === 'heartRate');
      const cadenceIndex = descriptors.findIndex(d => d.key === 'directCadence' || d.key === 'cadence');
      const speedIndex = descriptors.findIndex(d => d.key === 'directSpeed' || d.key === 'speed');
      const powerIndex = descriptors.findIndex(d => d.key === 'directPower' || d.key === 'power');

      metrics.forEach(metric => {
        const sample = {
          timestamp: new Date(metric.timestamp || metric.startTimeGMT),
        };

        if (hrIndex >= 0 && metric.metrics[hrIndex] !== undefined) {
          sample.heartRate = metric.metrics[hrIndex];
        }
        if (cadenceIndex >= 0 && metric.metrics[cadenceIndex] !== undefined) {
          sample.cadence = metric.metrics[cadenceIndex];
        }
        if (speedIndex >= 0 && metric.metrics[speedIndex] !== undefined) {
          sample.speed = metric.metrics[speedIndex];
        }
        if (powerIndex >= 0 && metric.metrics[powerIndex] !== undefined) {
          sample.power = metric.metrics[powerIndex];
        }

        samples.push(sample);
      });
    }

    return samples;
  }
}

