import { logger } from '../utils/logger.js';
import { GarminAuth } from '../auth/garmin.js';

export class GarminClient {
  constructor(username, password, useTokens = false, tokenPath = './data/garmin-tokens') {
    this.auth = new GarminAuth(username, password, useTokens, tokenPath);
    this.username = username;
    this.password = password;
  }

  async ensureAuthenticated() {
    if (!this.auth.isAuthenticated()) {
      await this.auth.login();
    }
  }

  async getRecentActivities(limit = 10) {
    await this.ensureAuthenticated();
    
    try {
      logger.info('Fetching recent Garmin activities');
      
      const client = this.auth.getClient();
      const activities = await client.getActivities(0, limit);

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
      const client = this.auth.getClient();
      const activity = await client.getActivity(activityId);
      return activity;
    } catch (error) {
      logger.error('Failed to fetch activity details', error.message);
      return null;
    }
  }

  async getActivitySamples(activityId) {
    await this.ensureAuthenticated();
    
    try {
      const client = this.auth.getClient();
      const activity = await client.getActivity(activityId);
      return this.parseSamples(activity);
    } catch (error) {
      logger.error('Failed to fetch activity samples', error.message);
      return [];
    }
  }

  async uploadActivity(tcxData, activityName) {
    await this.ensureAuthenticated();
    
    try {
      logger.info('Uploading activity to Garmin Connect', { activityName });
      
      const client = this.auth.getClient();
      const result = await client.uploadActivity(tcxData);

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
    
    // Handle garmin-connect library data structure
    if (data.metricDescriptors && data.activityDetailMetrics) {
      const descriptors = data.metricDescriptors;
      const metrics = data.activityDetailMetrics;

      // Find indices for metrics we care about
      const hrIndex = descriptors.findIndex(d => d.key === 'directHeartRate');
      const cadenceIndex = descriptors.findIndex(d => d.key === 'directCadence');
      const speedIndex = descriptors.findIndex(d => d.key === 'directSpeed');
      const powerIndex = descriptors.findIndex(d => d.key === 'directPower');

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
    } else if (data.samples) {
      // Handle simplified sample format if available
      data.samples.forEach(sample => {
        samples.push({
          timestamp: new Date(sample.time),
          heartRate: sample.heartRate,
          cadence: sample.cadence,
          speed: sample.speed,
          power: sample.power,
        });
      });
    }

    return samples;
  }
}

