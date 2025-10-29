import pkg from 'garmin-connect';
const { GarminConnect } = pkg;
import { logger } from '../utils/logger.js';

export class GarminAuth {
  constructor(username, password) {
    this.username = username;
    this.password = password;
    this.client = null;
  }

  async login() {
    try {
      logger.info('Logging into Garmin Connect');
      
      // Create Garmin Connect client with credentials
      this.client = new GarminConnect({
        username: this.username,
        password: this.password,
      });

      // Login to Garmin Connect (credentials already in constructor)
      await this.client.login();
      
      logger.info('Successfully logged into Garmin Connect');
    } catch (error) {
      logger.error('Failed to login to Garmin Connect', error.message);
      throw new Error('Garmin authentication failed');
    }
  }

  getClient() {
    if (!this.client) {
      throw new Error('Not authenticated. Call login() first.');
    }
    return this.client;
  }

  isAuthenticated() {
    return !!this.client;
  }
}

