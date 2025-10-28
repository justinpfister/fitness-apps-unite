import axios from 'axios';
import { logger } from '../utils/logger.js';

export class GarminAuth {
  constructor() {
    this.baseUrl = 'https://connect.garmin.com';
    this.sessionCookie = null;
  }

  async login(username, password) {
    try {
      logger.info('Logging into Garmin Connect');
      
      // Note: Garmin authentication is complex and may require using garmin-connect library
      // For now, we'll use a simplified version with session-based auth
      
      // Step 1: Get CSRF token
      const initResponse = await axios.get(`${this.baseUrl}/signin`, {
        maxRedirects: 0,
        validateStatus: (status) => status < 400,
      });

      // Step 2: Authenticate
      const authResponse = await axios.post(
        `${this.baseUrl}/signin`,
        {
          username: username,
          password: password,
          embed: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          maxRedirects: 0,
          validateStatus: (status) => status < 400,
        }
      );

      // Extract session cookie
      const cookies = authResponse.headers['set-cookie'];
      if (cookies) {
        this.sessionCookie = cookies.join('; ');
        logger.info('Successfully logged into Garmin Connect');
      } else {
        throw new Error('No session cookie received');
      }
    } catch (error) {
      logger.error('Failed to login to Garmin Connect', error.response?.data || error.message);
      throw new Error('Garmin authentication failed');
    }
  }

  getSessionCookie() {
    return this.sessionCookie;
  }

  isAuthenticated() {
    return !!this.sessionCookie;
  }
}

