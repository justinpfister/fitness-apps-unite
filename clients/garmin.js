import axios from 'axios';
import { logger } from '../utils/logger.js';
import { GarminAuth } from '../auth/garmin.js';

export class GarminClient {
  constructor(username, password) {
    this.auth = new GarminAuth();
    this.username = username;
    this.password = password;
    this.baseUrl = 'https://connect.garmin.com';
  }

  async ensureAuthenticated() {
    if (!this.auth.isAuthenticated()) {
      await this.auth.login(this.username, this.password);
    }
  }

  async getRecentActivities(limit = 10) {
    await this.ensureAuthenticated();
    
    try {
      logger.info('Fetching recent Garmin activities');
      
      const response = await axios.get(
        `${this.baseUrl}/activitylist-service/activities/search/activities`,
        {
          params: {
            limit: limit,
            start: 0,
          },
          headers: {
            Cookie: this.auth.getSessionCookie(),
          },
        }
      );

      const activities = response.data || [];
      logger.info(`Found ${activities.length} Garmin activities`);

      return activities.map(activity => this.parseActivity(activity));
    } catch (error) {
      logger.error('Failed to fetch Garmin activities', error.response?.data || error.message);
      throw error;
    }
  }

  async getActivityDetails(activityId) {
    await this.ensureAuthenticated();
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/activity-service/activity/${activityId}`,
        {
          headers: {
            Cookie: this.auth.getSessionCookie(),
          },
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to fetch activity details', error.response?.data || error.message);
      return null;
    }
  }

  async getActivitySamples(activityId) {
    await this.ensureAuthenticated();
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/activity-service/activity/${activityId}/details`,
        {
          headers: {
            Cookie: this.auth.getSessionCookie(),
          },
        }
      );

      return this.parseSamples(response.data);
    } catch (error) {
      logger.error('Failed to fetch activity samples', error.response?.data || error.message);
      return [];
    }
  }

  async uploadActivity(tcxData, activityName) {
    await this.ensureAuthenticated();
    
    try {
      logger.info('Uploading activity to Garmin Connect', { activityName });
      
      const response = await axios.post(
        `${this.baseUrl}/upload-service/upload`,
        tcxData,
        {
          headers: {
            Cookie: this.auth.getSessionCookie(),
            'Content-Type': 'application/octet-stream',
          },
        }
      );

      logger.info('Successfully uploaded activity to Garmin Connect');
      return response.data;
    } catch (error) {
      logger.error('Failed to upload activity to Garmin', error.response?.data || error.message);
      throw error;
    }
  }

  parseActivity(activity) {
    const startTime = new Date(activity.startTimeGMT || activity.beginTimestamp);
    const duration = activity.duration || activity.movingDuration || 0;
    const endTime = new Date(startTime.getTime() + duration * 1000);
    
    return {
      activityId: activity.activityId?.toString(),
      activityName: activity.activityName || 'Garmin Activity',
      startTime: startTime,
      endTime: endTime,
      duration: duration,
      activityType: activity.activityType?.typeKey || 'other',
      avgHeartRate: activity.averageHeartRate,
      maxHeartRate: activity.maxHeartRate,
      avgRunCadence: activity.averageRunCadence,
      avgCyclingCadence: activity.averageBikeCadence,
      calories: activity.calories,
      distance: activity.distance, // meters
      avgSpeed: activity.averageSpeed, // m/s
    };
  }

  parseSamples(data) {
    const samples = [];
    
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

        if (hrIndex >= 0 && metric.metrics[hrIndex]) {
          sample.heartRate = metric.metrics[hrIndex];
        }
        if (cadenceIndex >= 0 && metric.metrics[cadenceIndex]) {
          sample.cadence = metric.metrics[cadenceIndex];
        }
        if (speedIndex >= 0 && metric.metrics[speedIndex]) {
          sample.speed = metric.metrics[speedIndex];
        }
        if (powerIndex >= 0 && metric.metrics[powerIndex]) {
          sample.power = metric.metrics[powerIndex];
        }

        samples.push(sample);
      });
    }

    return samples;
  }
}

