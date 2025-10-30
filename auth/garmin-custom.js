import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Custom Garmin authentication using OAuth tokens directly
 * Bypasses the garmin-connect library which has MFA issues
 */
export class GarminCustomAuth {
  constructor(tokenPath = './data/garmin-tokens') {
    this.tokenPath = tokenPath;
    this.oauth1Token = null;
    this.oauth2Token = null;
    this.baseUrl = 'https://connect.garmin.com/gc-api';
    
    // Create axios instance
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'NK': 'NT', // Garmin-specific header
      }
    });
    
    // Add response interceptor for auth errors and token refresh
    this.client.interceptors.response.use(
      response => response,
      async error => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          logger.warn('Garmin OAuth2 token expired, attempting refresh');
          
          try {
            await this.refreshToken();
            // Retry the original request with new token
            originalRequest.headers = this.getAuthHeaders();
            return this.client(originalRequest);
          } catch (refreshError) {
            logger.error('Token refresh failed:', refreshError.message);
            return Promise.reject(refreshError);
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  loadTokens() {
    try {
      const oauth1Path = path.join(this.tokenPath, 'oauth1_token.json');
      const oauth2Path = path.join(this.tokenPath, 'oauth2_token.json');
      
      if (!fs.existsSync(oauth1Path) || !fs.existsSync(oauth2Path)) {
        throw new Error('Token files not found');
      }
      
      this.oauth1Token = JSON.parse(fs.readFileSync(oauth1Path, 'utf-8'));
      this.oauth2Token = JSON.parse(fs.readFileSync(oauth2Path, 'utf-8'));
      
      logger.info('Loaded Garmin OAuth tokens from files');
      
      // Check if OAuth2 token is expired
      if (this.oauth2Token.expires_at) {
        const now = Math.floor(Date.now() / 1000);
        if (now > this.oauth2Token.expires_at) {
          logger.warn('OAuth2 token has expired');
          throw new Error('OAuth2 token expired - please extract fresh tokens');
        }
        const minutesLeft = Math.floor((this.oauth2Token.expires_at - now) / 60);
        logger.info(`OAuth2 token expires in ${minutesLeft} minutes`);
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to load tokens:', error.message);
      throw error;
    }
  }

  isAuthenticated() {
    return !!(this.oauth1Token && this.oauth2Token && this.oauth2Token.access_token);
  }

  async refreshToken() {
    if (!this.oauth2Token || !this.oauth2Token.refresh_token) {
      throw new Error('No refresh token available');
    }

    logger.info('Refreshing Garmin OAuth2 token');

    try {
      // Garmin's token refresh endpoint
      const response = await axios.post('https://connect.garmin.com/modern/di-oauth/exchange', 
        {
          refresh_token: this.oauth2Token.refresh_token,
          grant_type: 'refresh_token'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `GARMIN-SSO-CUST-GUID=${this.oauth1Token.token}`,
          }
        }
      );

      if (response.data && response.data.access_token) {
        this.oauth2Token.access_token = response.data.access_token;
        
        // Update expiration if provided
        if (response.data.expires_in) {
          this.oauth2Token.expires_at = Math.floor(Date.now() / 1000) + response.data.expires_in;
        }
        
        // Update refresh token if new one provided
        if (response.data.refresh_token) {
          this.oauth2Token.refresh_token = response.data.refresh_token;
        }

        // Save updated tokens
        const oauth2Path = path.join(this.tokenPath, 'oauth2_token.json');
        fs.writeFileSync(oauth2Path, JSON.stringify(this.oauth2Token, null, 2));
        
        logger.info('Successfully refreshed Garmin OAuth2 token');
        return true;
      }
      
      throw new Error('Invalid refresh response');
    } catch (error) {
      logger.error('Token refresh failed:', error.response?.data || error.message);
      throw error;
    }
  }

  getAuthHeaders() {
    if (!this.oauth2Token || !this.oauth2Token.access_token) {
      throw new Error('No OAuth2 token available');
    }
    
    // Check if token is expired
    if (this.oauth2Token.expires_at && Date.now() / 1000 > this.oauth2Token.expires_at) {
      logger.warn('OAuth2 token expired according to expires_at');
    }
    
    const headers = {
      'Authorization': `Bearer ${this.oauth2Token.access_token}`,
      'DI-Backend': 'connectapi.garmin.com',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.9',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://connect.garmin.com/modern/',
      'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
    };
    
    // Build cookie string with multiple required cookies
    const cookies = [];
    
    if (this.oauth1Token && this.oauth1Token.token) {
      cookies.push(`GARMIN-SSO-CUST-GUID=${this.oauth1Token.token}`);
      cookies.push(`GARMIN-SSO=1`);
    }
    
    // Add session cookies if available from oauth2 token
    if (this.oauth2Token.session_id) {
      cookies.push(`SESSIONID=${this.oauth2Token.session_id}`);
    }
    
    if (this.oauth2Token.session) {
      cookies.push(`session=${this.oauth2Token.session}`);
    }
    
    if (cookies.length > 0) {
      headers['Cookie'] = cookies.join('; ');
    }
    
    return headers;
  }

  async get(url, params = {}) {
    if (!this.isAuthenticated()) {
      this.loadTokens();
    }
    
    try {
      const response = await this.client.get(url, {
        params,
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      logger.error(`Garmin API GET ${url} failed:`, error.response?.statusText || error.message);
      if (error.response?.data) {
        logger.error(`Response body:`, error.response.data);
      }
      throw error;
    }
  }

  async post(url, data, config = {}) {
    if (!this.isAuthenticated()) {
      this.loadTokens();
    }
    
    try {
      const response = await this.client.post(url, data, {
        ...config,
        headers: {
          ...this.getAuthHeaders(),
          ...config.headers
        }
      });
      return response.data;
    } catch (error) {
      logger.error(`Garmin API POST ${url} failed:`, error.response?.data || error.message);
      throw error;
    }
  }
}

