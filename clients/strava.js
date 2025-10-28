import axios from 'axios';
import { logger } from '../utils/logger.js';
import { StravaAuth } from '../auth/strava.js';

export class StravaClient {
  constructor(clientId, clientSecret, refreshToken, accessToken) {
    this.auth = new StravaAuth();
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    
    if (accessToken && refreshToken) {
      this.auth.setAuth({
        accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // Assume 6 hours
      });
    } else if (refreshToken) {
      this.auth.refreshToken = refreshToken;
    }
    
    this.baseUrl = 'https://www.strava.com/api/v3';
  }

  async ensureAuthenticated() {
    if (!this.auth.isAuthenticated() || this.auth.needsRefresh()) {
      await this.auth.refreshAccessToken(
        this.clientId,
        this.clientSecret,
        this.auth.refreshToken
      );
    }
  }

  async getRecentActivities(limit = 30) {
    await this.ensureAuthenticated();
    
    try {
      logger.info('Fetching recent Strava activities');
      
      const response = await axios.get(`${this.baseUrl}/athlete/activities`, {
        params: {
          per_page: limit,
          page: 1,
        },
        headers: {
          Authorization: `Bearer ${this.auth.getAccessToken()}`,
        },
      });

      logger.info(`Found ${response.data.length} Strava activities`);
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch Strava activities', error.response?.data || error.message);
      throw error;
    }
  }

  async uploadActivity(fileData, fileName, dataType = 'tcx') {
    await this.ensureAuthenticated();
    
    try {
      logger.info('Uploading activity to Strava', { fileName, dataType });
      
      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('file', fileData, {
        filename: fileName,
        contentType: dataType === 'tcx' ? 'application/xml' : 'application/fit',
      });
      form.append('data_type', dataType);

      const response = await axios.post(
        `${this.baseUrl}/uploads`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${this.auth.getAccessToken()}`,
          },
        }
      );

      logger.info('Successfully uploaded activity to Strava', { uploadId: response.data.id });
      return response.data;
    } catch (error) {
      logger.error('Failed to upload activity to Strava', error.response?.data || error.message);
      throw error;
    }
  }

  async updateActivity(activityId, updates) {
    await this.ensureAuthenticated();
    
    try {
      logger.info('Updating Strava activity', { activityId });
      
      const response = await axios.put(
        `${this.baseUrl}/activities/${activityId}`,
        updates,
        {
          headers: {
            Authorization: `Bearer ${this.auth.getAccessToken()}`,
          },
        }
      );

      logger.info('Successfully updated Strava activity');
      return response.data;
    } catch (error) {
      logger.error('Failed to update Strava activity', error.response?.data || error.message);
      throw error;
    }
  }

  async deleteActivity(activityId) {
    await this.ensureAuthenticated();
    
    try {
      logger.info('Deleting Strava activity', { activityId });
      
      await axios.delete(`${this.baseUrl}/activities/${activityId}`, {
        headers: {
          Authorization: `Bearer ${this.auth.getAccessToken()}`,
        },
      });

      logger.info('Successfully deleted Strava activity');
    } catch (error) {
      logger.error('Failed to delete Strava activity', error.response?.data || error.message);
      throw error;
    }
  }
}

