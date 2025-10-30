import axios from 'axios';
import { logger } from '../utils/logger.js';

export class PelotonAuth {
  constructor(stateDatabase = null) {
    this.baseUrl = 'https://api.onepeloton.com';
    this.sessionId = null;
    this.userId = null;
    this.stateDatabase = stateDatabase;
  }

  async login(username, password) {
    try {
      logger.info('Logging into Peloton');
      
      // Priority 1: Try loading session from state database
      if (this.stateDatabase) {
        const savedSession = this.stateDatabase.getPelotonSession();
        if (savedSession && savedSession.sessionId && savedSession.userId) {
          logger.info('Loading Peloton session from state database');
          // Verify session is still valid
          try {
            const meResp = await axios.get(`${this.baseUrl}/api/me`, {
              headers: { Cookie: `peloton_session_id=${savedSession.sessionId}` },
              validateStatus: (s) => s < 500,
            });
            if (meResp.status === 200 && meResp.data?.id) {
              this.sessionId = savedSession.sessionId;
              this.userId = savedSession.userId || meResp.data.id;
              logger.info('Successfully authenticated with saved Peloton session', { userId: this.userId });
              return {
                sessionId: this.sessionId,
                userId: this.userId,
              };
            }
          } catch {
            logger.warn('Saved Peloton session is invalid or expired');
          }
        }
      }
      
      // Priority 2: Try environment variables
      if (process.env.PELOTON_SESSION_ID) {
        this.sessionId = process.env.PELOTON_SESSION_ID;
        this.userId = process.env.PELOTON_USER_ID || null;

        // If user id not provided, fetch it using the session cookie
        if (!this.userId) {
          try {
            const meResp = await axios.get(`${this.baseUrl}/api/me`, {
              headers: { Cookie: `peloton_session_id=${this.sessionId}` },
              validateStatus: (s) => s < 500,
            });
            if (meResp.status === 200 && meResp.data?.id) {
              this.userId = meResp.data.id;
            }
          } catch {}
        }

        if (this.userId) {
          logger.info('Using provided Peloton session from environment', { userId: this.userId });
          // Save to state database for future use
          if (this.stateDatabase) {
            this.stateDatabase.setPelotonSession({
              sessionId: this.sessionId,
              userId: this.userId,
            });
          }
          return {
            sessionId: this.sessionId,
            userId: this.userId,
          };
        }
        logger.warn('Peloton session provided but user id could not be resolved; falling back to legacy login.');
      }
      
      const response = await axios.post(`${this.baseUrl}/auth/login`, {
        username_or_email: username,
        password: password,
      }, {
        // Some environments require realistic headers; keep lightweight here
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Content-Type': 'application/json',
        },
        validateStatus: (status) => status < 500, // surface 4xx
      });

      if (response.status !== 200 || !response.data?.session_id) {
        logger.error('Peloton login endpoint returned non-200 or missing session', response.data || response.status);
        throw new Error('Peloton authentication failed');
      }

      this.sessionId = response.data.session_id;
      this.userId = response.data.user_id || response.data.id;

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

