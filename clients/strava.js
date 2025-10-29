import axios from 'axios';
import { logger } from '../utils/logger.js';
import { StravaAuth } from '../auth/strava.js';

export class StravaClient {
  constructor(clientId, clientSecret, refreshToken, accessToken, stateDatabase = null) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.stateDatabase = stateDatabase;
    // Store env refresh token as fallback
    this.envRefreshToken = refreshToken;
    
    // Set up persistence callback
    const persistTokens = async (tokens) => {
      if (this.stateDatabase) {
        this.stateDatabase.setStravaTokens(tokens);
      }
    };
    
    this.auth = new StravaAuth(persistTokens);
    this.baseUrl = 'https://www.strava.com/api/v3';
    
    // Load tokens from state database first, then fallback to provided params (from env)
    let tokens = null;
    if (this.stateDatabase) {
      tokens = this.stateDatabase.getStravaTokens();
    }
    
    if (tokens && tokens.accessToken && tokens.refreshToken) {
      // Use tokens from state database
      logger.info('Loading Strava tokens from state database');
      this.auth.setAuth(tokens);
      // If no refresh token in loaded tokens, use env fallback
      if (!this.auth.refreshToken && this.envRefreshToken) {
        this.auth.refreshToken = this.envRefreshToken;
      }
    } else if (accessToken && refreshToken) {
      // Use tokens from constructor params (env vars)
      logger.info('Loading Strava tokens from environment variables');
      // Note: We don't know the exact expiration, so we'll need to refresh if needed
      this.auth.setAuth({
        accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // Assume 6 hours, will refresh if needed
      });
      // Save initial tokens to database
      if (this.stateDatabase) {
        this.stateDatabase.setStravaTokens({
          accessToken,
          refreshToken,
          expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
        });
      }
    } else if (refreshToken) {
      // Only refresh token available, set it for later use
      this.auth.refreshToken = refreshToken;
    }
  }

  async ensureAuthenticated() {
    const isAuth = this.auth.isAuthenticated();
    const needsRefresh = this.auth.needsRefresh();
    
    logger.debug('Authentication check', {
      isAuthenticated: isAuth,
      needsRefresh: needsRefresh,
      hasAccessToken: !!this.auth.accessToken,
      hasRefreshToken: !!this.auth.refreshToken,
      expiresAt: this.auth.expiresAt,
      currentTime: new Date(),
    });
    
    if (!isAuth || needsRefresh) {
      logger.info('Token needs refresh', { isAuthenticated: isAuth, needsRefresh });
      const refreshTokenToUse = this.auth.refreshToken || this.envRefreshToken;
      
      if (!refreshTokenToUse) {
        throw new Error('No refresh token available to refresh Strava access token');
      }
      
      try {
        await this.auth.refreshAccessToken(
          this.clientId,
          this.clientSecret,
          refreshTokenToUse
        );
      } catch (error) {
        // If refresh fails with stored token, try env refresh token if different
        if (this.envRefreshToken && this.auth.refreshToken !== this.envRefreshToken) {
          logger.info('Retrying token refresh with environment refresh token');
          await this.auth.refreshAccessToken(
            this.clientId,
            this.clientSecret,
            this.envRefreshToken
          );
        } else {
          throw error;
        }
      }
    } else {
      logger.debug('Token is valid, no refresh needed');
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
      // If we get a 401, the token is invalid - force refresh and retry once
      if (error.response?.status === 401) {
        logger.warn('Received 401 error, forcing token refresh and retrying');
        
        const refreshTokenToUse = this.auth.refreshToken || this.envRefreshToken;
        if (refreshTokenToUse) {
          try {
            // Force refresh
            await this.auth.refreshAccessToken(
              this.clientId,
              this.clientSecret,
              refreshTokenToUse
            );
            
            // Retry the request
            logger.info('Retrying request with refreshed token');
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
          } catch (refreshError) {
            // If refresh with stored token fails, try env token if different
            if (this.envRefreshToken && this.auth.refreshToken !== this.envRefreshToken) {
              logger.info('Retrying token refresh with environment refresh token');
              await this.auth.refreshAccessToken(
                this.clientId,
                this.clientSecret,
                this.envRefreshToken
              );
              
              // Retry the request
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
            }
            throw refreshError;
          }
        }
      }
      
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

