import { logger } from '../utils/logger.js';

export class ActivityMerger {
  /**
   * Merge Peloton and Garmin activities
   * Prioritizes Peloton data, supplements with Garmin
   */
  async mergeActivities(matchedPair) {
    const { pelotonActivity, garminActivity, confidence } = matchedPair;
    
    logger.info('Merging activities', {
      pelotonId: pelotonActivity.id,
      garminId: garminActivity.activityId,
      confidence,
    });

    // Use Peloton start time as authoritative
    const startTime = pelotonActivity.startTime;
    const endTime = pelotonActivity.endTime;
    const duration = pelotonActivity.duration;

    // Build summary with Peloton data first, Garmin as fallback
    const summary = {
      avgHeartRate: pelotonActivity.avgHeartRate || garminActivity.avgHeartRate,
      maxHeartRate: garminActivity.maxHeartRate,
      avgCadence: pelotonActivity.avgCadence || garminActivity.avgRunCadence || garminActivity.avgCyclingCadence,
      avgSpeed: pelotonActivity.avgSpeed || garminActivity.avgSpeed,
      avgPower: pelotonActivity.avgPower,
      totalDistance: pelotonActivity.distance || (garminActivity.distance / 1000), // Convert m to km
      totalCalories: pelotonActivity.calories || garminActivity.calories,
      totalOutput: pelotonActivity.totalOutput,
    };

    const merged = {
      id: `merged_${pelotonActivity.id}_${garminActivity.activityId}`,
      name: pelotonActivity.name || garminActivity.activityName,
      type: this.mapActivityType(pelotonActivity.type),
      startTime,
      endTime,
      duration,
      pelotonId: pelotonActivity.id,
      garminId: garminActivity.activityId,
      metrics: [],
      summary,
    };

    logger.info('Successfully merged activities', { mergedId: merged.id });
    return merged;
  }

  /**
   * Merge time-series metrics from both sources
   */
  mergeMetrics(pelotonMetrics, garminSamples, startTime) {
    const merged = [];
    
    // Create a map of timestamp to metrics
    const metricsByTime = new Map();

    // Add Peloton metrics (priority)
    pelotonMetrics.forEach(metric => {
      const timestamp = new Date(startTime.getTime() + metric.timestamp * 1000);
      metricsByTime.set(timestamp.getTime(), {
        timestamp,
        heartRate: metric.heartRate,
        cadence: metric.cadence,
        speed: metric.speed,
        power: metric.power,
      });
    });

    // Supplement with Garmin data where Peloton data is missing
    garminSamples.forEach(sample => {
      const time = sample.timestamp.getTime();
      const existing = metricsByTime.get(time);
      
      if (existing) {
        // Fill in any missing Peloton data with Garmin data
        if (!existing.heartRate && sample.heartRate) {
          existing.heartRate = sample.heartRate;
        }
        if (!existing.cadence && sample.cadence) {
          existing.cadence = sample.cadence;
        }
        if (!existing.speed && sample.speed) {
          existing.speed = sample.speed;
        }
      } else {
        // Add Garmin sample if no Peloton data at this timestamp
        metricsByTime.set(time, {
          timestamp: sample.timestamp,
          heartRate: sample.heartRate,
          cadence: sample.cadence,
          speed: sample.speed,
          power: sample.power,
          altitude: sample.altitude,
        });
      }
    });

    // Convert map to sorted array
    const sorted = Array.from(metricsByTime.values()).sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    return sorted;
  }

  /**
   * Map Peloton activity types to standard types
   */
  mapActivityType(pelotonType) {
    const typeMap = {
      'running': 'run',
      'cycling': 'bike',
      'bike': 'bike',
      'run': 'run',
      'walking': 'walk',
      'strength': 'workout',
      'stretching': 'workout',
      'cardio': 'workout',
      'yoga': 'yoga',
      'meditation': 'meditation',
    };

    const normalized = pelotonType.toLowerCase();
    return typeMap[normalized] || 'workout';
  }

  /**
   * Generate TCX file from merged activity
   */
  generateTCX(mergedActivity) {
    const { name, type, startTime, metrics, summary } = mergedActivity;
    
    // TCX header
    let tcx = '<?xml version="1.0" encoding="UTF-8"?>\n';
    tcx += '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">\n';
    tcx += '  <Activities>\n';
    tcx += `    <Activity Sport="${this.getTCXSport(type)}">\n`;
    tcx += `      <Id>${startTime.toISOString()}</Id>\n`;
    
    // Lap
    tcx += `      <Lap StartTime="${startTime.toISOString()}">\n`;
    tcx += `        <TotalTimeSeconds>${mergedActivity.duration}</TotalTimeSeconds>\n`;
    
    if (summary.totalDistance) {
      tcx += `        <DistanceMeters>${summary.totalDistance * 1000}</DistanceMeters>\n`;
    }
    if (summary.totalCalories) {
      tcx += `        <Calories>${Math.round(summary.totalCalories)}</Calories>\n`;
    }
    if (summary.avgHeartRate) {
      tcx += `        <AverageHeartRateBpm><Value>${Math.round(summary.avgHeartRate)}</Value></AverageHeartRateBpm>\n`;
    }
    if (summary.maxHeartRate) {
      tcx += `        <MaximumHeartRateBpm><Value>${Math.round(summary.maxHeartRate)}</Value></MaximumHeartRateBpm>\n`;
    }
    
    tcx += '        <Intensity>Active</Intensity>\n';
    tcx += '        <TriggerMethod>Manual</TriggerMethod>\n';
    
    // Track with trackpoints
    if (metrics && metrics.length > 0) {
      tcx += '        <Track>\n';
      
      metrics.forEach(metric => {
        tcx += '          <Trackpoint>\n';
        tcx += `            <Time>${metric.timestamp.toISOString()}</Time>\n`;
        
        if (metric.lat && metric.lon) {
          tcx += '            <Position>\n';
          tcx += `              <LatitudeDegrees>${metric.lat}</LatitudeDegrees>\n`;
          tcx += `              <LongitudeDegrees>${metric.lon}</LongitudeDegrees>\n`;
          tcx += '            </Position>\n';
        }
        
        if (metric.altitude !== undefined) {
          tcx += `            <AltitudeMeters>${metric.altitude}</AltitudeMeters>\n`;
        }
        
        if (metric.distance !== undefined) {
          tcx += `            <DistanceMeters>${metric.distance * 1000}</DistanceMeters>\n`;
        }
        
        if (metric.heartRate) {
          tcx += '            <HeartRateBpm>\n';
          tcx += `              <Value>${Math.round(metric.heartRate)}</Value>\n`;
          tcx += '            </HeartRateBpm>\n';
        }
        
        if (metric.cadence) {
          tcx += `            <Cadence>${Math.round(metric.cadence)}</Cadence>\n`;
        }
        
        if (metric.speed) {
          tcx += '            <Extensions>\n';
          tcx += '              <ns3:TPX xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2">\n';
          tcx += `                <ns3:Speed>${metric.speed}</ns3:Speed>\n`;
          if (metric.power) {
            tcx += `                <ns3:Watts>${Math.round(metric.power)}</ns3:Watts>\n`;
          }
          tcx += '              </ns3:TPX>\n';
          tcx += '            </Extensions>\n';
        }
        
        tcx += '          </Trackpoint>\n';
      });
      
      tcx += '        </Track>\n';
    }
    
    tcx += '      </Lap>\n';
    tcx += '    </Activity>\n';
    tcx += '  </Activities>\n';
    tcx += '</TrainingCenterDatabase>\n';
    
    return tcx;
  }

  getTCXSport(type) {
    const sportMap = {
      'run': 'Running',
      'bike': 'Biking',
      'walk': 'Walking',
      'other': 'Other',
    };
    
    return sportMap[type] || 'Other';
  }
}

