import pkg from 'garmin-connect';
const { GarminConnect } = pkg;
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

export class GarminAuth {
  constructor(username, password, useTokens = false, tokenPath = './data/garmin-tokens') {
    this.username = username;
    this.password = password;
    this.useTokens = useTokens;
    this.tokenPath = tokenPath;
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

      // Try to load saved tokens first (for MFA accounts)
      if (this.useTokens && this.tokensExist()) {
        try {
          logger.info('Loading saved Garmin tokens');
          this.client.loadTokenByFile(this.tokenPath);
          
          // Test if tokens are valid by making a simple API call
          await this.client.getUserSettings();
          logger.info('Successfully authenticated using saved tokens');
          return;
        } catch (error) {
          logger.warn('Saved tokens invalid or expired, attempting normal login');
        }
      }

      // Normal login with credentials
      await this.client.login();
      
      // Save tokens for future use
      if (this.useTokens) {
        this.saveTokens();
      }
      
      logger.info('Successfully logged into Garmin Connect');
    } catch (error) {
      logger.error('Failed to login to Garmin Connect', error.message);
      throw new Error('Garmin authentication failed');
    }
  }

  tokensExist() {
    const oauth1Path = path.join(this.tokenPath, 'oauth1_token.json');
    const oauth2Path = path.join(this.tokenPath, 'oauth2_token.json');
    return fs.existsSync(oauth1Path) && fs.existsSync(oauth2Path);
  }

  saveTokens() {
    try {
      if (!fs.existsSync(this.tokenPath)) {
        fs.mkdirSync(this.tokenPath, { recursive: true });
      }
      this.client.exportTokenToFile(this.tokenPath);
      logger.info('Saved Garmin authentication tokens');
    } catch (error) {
      logger.warn('Failed to save Garmin tokens', error.message);
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

