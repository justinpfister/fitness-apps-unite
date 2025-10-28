import axios from 'axios';
import { logger } from '../utils/logger.js';

export class StravaAuth {
  constructor() {
    this.baseUrl = 'https://www.strava.com/api/v3';
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = null;
  }

  async refreshAccessToken(clientId, clientSecret, refreshToken) {
    try {
      logger.info('Refreshing Strava access token');
      
      const response = await axios.post('https://www.strava.com/oauth/token', {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      this.expiresAt = new Date(response.data.expires_at * 1000);

      logger.info('Successfully refreshed Strava access token');

      return {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiresAt: this.expiresAt,
      };
    } catch (error) {
      logger.error('Failed to refresh Strava token', error.response?.data || error.message);
      throw new Error('Strava token refresh failed');
    }
  }

  setAuth(token) {
    this.accessToken = token.accessToken;
    this.refreshToken = token.refreshToken;
    this.expiresAt = token.expiresAt;
  }

  getAccessToken() {
    return this.accessToken;
  }

  isAuthenticated() {
    if (!this.accessToken || !this.expiresAt) {
      return false;
    }
    return new Date() < this.expiresAt;
  }

  needsRefresh() {
    if (!this.expiresAt) {
      return true;
    }
    // Refresh if token expires in less than 1 hour
    const oneHour = 60 * 60 * 1000;
    return (this.expiresAt.getTime() - Date.now()) < oneHour;
  }
}

