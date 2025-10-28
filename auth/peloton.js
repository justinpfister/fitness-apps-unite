import axios from 'axios';
import { logger } from '../utils/logger.js';

export class PelotonAuth {
  constructor() {
    this.baseUrl = 'https://api.onepeloton.com';
    this.sessionId = null;
    this.userId = null;
  }

  async login(username, password) {
    try {
      logger.info('Logging into Peloton');
      
      const response = await axios.post(`${this.baseUrl}/auth/login`, {
        username_or_email: username,
        password: password,
      });

      this.sessionId = response.data.session_id;
      this.userId = response.data.user_id;

      logger.info('Successfully logged into Peloton', { userId: this.userId });

      return {
        sessionId: this.sessionId,
        userId: this.userId,
      };
    } catch (error) {
      logger.error('Failed to login to Peloton', error.response?.data || error.message);
      throw new Error('Peloton authentication failed');
    }
  }

  getSessionId() {
    return this.sessionId;
  }

  getUserId() {
    return this.userId;
  }

  setAuth(token) {
    this.sessionId = token.sessionId;
    this.userId = token.userId;
  }

  isAuthenticated() {
    return !!this.sessionId && !!this.userId;
  }
}

