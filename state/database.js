import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

export class StateDatabase {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.data = this.load();
  }

  load() {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        const parsed = JSON.parse(raw);
        
        // Convert date strings back to Date objects
        if (parsed.lastSyncTime) {
          parsed.lastSyncTime = new Date(parsed.lastSyncTime);
        }
        if (parsed.processedActivities) {
          parsed.processedActivities = parsed.processedActivities.map(a => ({
            ...a,
            processedAt: new Date(a.processedAt),
            mergedAt: a.mergedAt ? new Date(a.mergedAt) : undefined,
            uploadedToGarmin: a.uploadedToGarmin ? new Date(a.uploadedToGarmin) : undefined,
            syncedToStrava: a.syncedToStrava ? new Date(a.syncedToStrava) : undefined,
          }));
        }

        logger.debug('Loaded state database', { activities: parsed.processedActivities?.length });
        return parsed;
      }
    } catch (error) {
      logger.error('Failed to load state database', error);
    }

    return {
      processedActivities: [],
    };
  }

  save() {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf-8');
      logger.debug('Saved state database');
    } catch (error) {
      logger.error('Failed to save state database', error);
    }
  }

  getProcessedActivities() {
    return this.data.processedActivities;
  }

  getProcessedActivityById(id) {
    return this.data.processedActivities.find(a => a.id === id);
  }

  getProcessedActivityByPelotonId(pelotonId) {
    return this.data.processedActivities.find(a => a.pelotonId === pelotonId);
  }

  getProcessedActivityByGarminId(garminId) {
    return this.data.processedActivities.find(a => a.garminId === garminId);
  }

  addProcessedActivity(activity) {
    const existing = this.data.processedActivities.findIndex(a => a.id === activity.id);
    if (existing >= 0) {
      this.data.processedActivities[existing] = activity;
    } else {
      this.data.processedActivities.push(activity);
    }
    this.save();
  }

  updateProcessedActivity(id, updates) {
    const index = this.data.processedActivities.findIndex(a => a.id === id);
    if (index >= 0) {
      this.data.processedActivities[index] = {
        ...this.data.processedActivities[index],
        ...updates,
      };
      this.save();
    }
  }

  setAuthTokens(tokens) {
    this.data.authTokens = tokens;
    this.save();
  }

  getAuthTokens() {
    return this.data.authTokens;
  }

  setStravaTokens(tokens) {
    this.data.stravaTokens = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt instanceof Date 
        ? tokens.expiresAt.toISOString() 
        : new Date(tokens.expiresAt).toISOString(),
    };
    this.save();
    logger.info('Saved Strava tokens to state database');
  }

  getStravaTokens() {
    if (!this.data.stravaTokens) {
      return null;
    }
    
    return {
      accessToken: this.data.stravaTokens.accessToken,
      refreshToken: this.data.stravaTokens.refreshToken,
      expiresAt: new Date(this.data.stravaTokens.expiresAt),
    };
  }

  setLastSyncTime(time) {
    this.data.lastSyncTime = time;
    this.save();
  }

  getLastSyncTime() {
    return this.data.lastSyncTime;
  }

  shouldSyncToStrava(activityEndTime, waitHours) {
    const now = new Date();
    const waitMillis = waitHours * 60 * 60 * 1000;
    return (now.getTime() - activityEndTime.getTime()) >= waitMillis;
  }

  getActivitiesReadyForStrava(waitHours) {
    return this.data.processedActivities.filter(a => 
      a.status === 'merged' && 
      !a.syncedToStrava
    );
  }

  setPelotonSession(session) {
    this.data.pelotonSession = {
      sessionId: session.sessionId,
      userId: session.userId,
      savedAt: new Date().toISOString(),
    };
    this.save();
    logger.info('Saved Peloton session to state database');
  }

  getPelotonSession() {
    if (!this.data.pelotonSession) {
      return null;
    }
    
    return {
      sessionId: this.data.pelotonSession.sessionId,
      userId: this.data.pelotonSession.userId,
      savedAt: new Date(this.data.pelotonSession.savedAt),
    };
  }
}

