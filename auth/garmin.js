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
      
      // Provide helpful error message for MFA issues
      if (error.message && (error.message.includes('MFA') || error.message.includes('Ticket not found'))) {
        if (this.useTokens) {
          throw new Error('Garmin authentication failed: MFA is enabled. You need to extract valid OAuth1 tokens from your browser. Run: node tools/save-garmin-tokens.js');
        } else {
          throw new Error('Garmin authentication failed: MFA is enabled. Set GARMIN_USE_TOKENS=true in .env and extract tokens using: node tools/save-garmin-tokens.js');
        }
      }
      
      throw new Error('Garmin authentication failed');
    }
  }

  tokensExist() {
    const oauth1Path = path.join(this.tokenPath, 'oauth1_token.json');
    const oauth2Path = path.join(this.tokenPath, 'oauth2_token.json');
    
    // At minimum, we need OAuth2 token (access_token)
    // OAuth1 is preferred but OAuth2 might work on its own
    if (!fs.existsSync(oauth2Path)) {
      return false;
    }
    
    // Check if OAuth2 file has valid content
    try {
      const oauth2Content = fs.readFileSync(oauth2Path, 'utf-8').trim();
      
      if (!oauth2Content) {
        logger.warn('OAuth2 token file exists but is empty');
        return false;
      }
      
      const oauth2 = JSON.parse(oauth2Content);
      
      // OAuth2 needs access_token
      if (!oauth2.access_token) {
        logger.warn('OAuth2 token file is missing access_token');
        return false;
      }
      
      // Check if OAuth1 exists and is valid (optional but preferred)
      if (fs.existsSync(oauth1Path)) {
        const oauth1Content = fs.readFileSync(oauth1Path, 'utf-8').trim();
        if (oauth1Content) {
          const oauth1 = JSON.parse(oauth1Content);
          // If OAuth1 has placeholder values, treat as missing
          if (oauth1.token === 'placeholder' || oauth1.token_secret === 'placeholder') {
            logger.warn('OAuth1 token file exists but contains placeholder values');
          } else if (oauth1.token && oauth1.token_secret) {
            // Both OAuth1 and OAuth2 are present and valid
            return true;
          }
        }
      }
      
      // OAuth2 alone might work - let the library try it
      logger.info('Using OAuth2 tokens only (OAuth1 not available)');
      return true;
    } catch (error) {
      logger.warn('Token files exist but are invalid JSON', error.message);
      return false;
    }
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

