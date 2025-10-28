import { logger } from '../utils/logger.js';

export class ActivityMatcher {
  constructor(timeWindowMinutes = 30) {
    this.timeWindowMinutes = timeWindowMinutes;
  }

  /**
   * Match Peloton activities with Garmin activities
   * Returns array of matches with confidence scores
   */
  matchActivities(pelotonActivities, garminActivities) {
    const matches = [];
    const usedGarminIds = new Set();

    logger.info('Matching activities', {
      pelotonCount: pelotonActivities.length,
      garminCount: garminActivities.length,
    });

    for (const peloton of pelotonActivities) {
      const candidates = this.findMatchCandidates(peloton, garminActivities, usedGarminIds);
      
      if (candidates.length > 0) {
        // Sort by score (highest first)
        candidates.sort((a, b) => b.score - a.score);
        
        const bestMatch = candidates[0];
        
        // Only accept matches with reasonable confidence
        if (bestMatch.confidence !== 'low') {
          matches.push(bestMatch);
          usedGarminIds.add(bestMatch.garminActivity.activityId);
          
          logger.info('Found match', {
            pelotonId: peloton.id,
            garminId: bestMatch.garminActivity.activityId,
            score: bestMatch.score.toFixed(2),
            confidence: bestMatch.confidence,
            timeDiff: Math.abs(peloton.startTime - bestMatch.garminActivity.startTime) / 1000 / 60,
          });
        }
      }
    }

    logger.info(`Matched ${matches.length} activities`);
    return matches;
  }

  findMatchCandidates(pelotonActivity, garminActivities, usedGarminIds) {
    const candidates = [];
    const timeWindowMs = this.timeWindowMinutes * 60 * 1000;

    for (const garmin of garminActivities) {
      // Skip already matched activities
      if (usedGarminIds.has(garmin.activityId)) {
        continue;
      }

      // Check if activities are within time window
      const timeDiff = Math.abs(pelotonActivity.startTime - garmin.startTime);
      
      if (timeDiff <= timeWindowMs) {
        const score = this.calculateMatchScore(pelotonActivity, garmin);
        const confidence = this.determineConfidence(score, timeDiff, pelotonActivity, garmin);
        
        candidates.push({
          pelotonActivity,
          garminActivity: garmin,
          score,
          timeProximity: this.scoreTimeProximity(timeDiff),
          durationSimilarity: this.scoreDurationSimilarity(pelotonActivity.duration, garmin.duration),
          confidence,
        });
      }
    }

    return candidates;
  }

  calculateMatchScore(pelotonActivity, garminActivity) {
    const timeDiff = Math.abs(pelotonActivity.startTime - garminActivity.startTime);
    const timeScore = this.scoreTimeProximity(timeDiff);
    const durationScore = this.scoreDurationSimilarity(pelotonActivity.duration, garminActivity.duration);
    
    // Weight time proximity more heavily (70%) than duration (30%)
    const score = timeScore * 0.7 + durationScore * 0.3;
    
    return score;
  }

  scoreTimeProximity(timeDiffMs) {
    // Score from 0-100 based on how close start times are
    // Perfect score for activities starting within 1 minute
    // Linear decay to 0 at timeWindowMinutes
    
    const timeDiffMinutes = timeDiffMs / 1000 / 60;
    
    if (timeDiffMinutes <= 1) {
      return 100;
    }
    
    const score = 100 - (timeDiffMinutes / this.timeWindowMinutes) * 100;
    return Math.max(0, score);
  }

  scoreDurationSimilarity(duration1, duration2) {
    // Score from 0-100 based on how similar durations are
    // Allow for some difference since user might forget to stop watch
    
    if (!duration1 || !duration2) {
      return 50; // Neutral score if duration unknown
    }

    const shorter = Math.min(duration1, duration2);
    const longer = Math.max(duration1, duration2);
    
    if (shorter === 0) {
      return 0;
    }

    const ratio = shorter / longer;
    
    // Perfect score if durations are within 5% of each other
    if (ratio >= 0.95) {
      return 100;
    }
    
    // Linear decay based on ratio
    // Even 50% match gets decent score since watch might run longer
    const score = ratio * 100;
    
    return Math.max(0, score);
  }

  determineConfidence(score, timeDiff, pelotonActivity, garminActivity) {
    const timeDiffMinutes = timeDiff / 1000 / 60;
    
    // High confidence: great score, close time, similar duration
    if (score >= 85 && timeDiffMinutes <= 5) {
      return 'high';
    }
    
    // Medium confidence: good score, reasonable time window
    if (score >= 70 && timeDiffMinutes <= 15) {
      return 'medium';
    }
    
    // Low confidence: everything else
    return 'low';
  }

  /**
   * Find standalone Peloton activities (no Garmin match)
   */
  findStandalonePelotonActivities(pelotonActivities, matches) {
    const matchedPelotonIds = new Set(matches.map(m => m.pelotonActivity.id));
    return pelotonActivities.filter(p => !matchedPelotonIds.has(p.id));
  }

  /**
   * Find standalone Garmin activities (no Peloton match)
   */
  findStandaloneGarminActivities(garminActivities, matches) {
    const matchedGarminIds = new Set(matches.map(m => m.garminActivity.activityId));
    return garminActivities.filter(g => !matchedGarminIds.has(g.activityId));
  }
}

