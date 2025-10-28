import axios from 'axios';
import { logger } from '../utils/logger.js';
import { PelotonAuth } from '../auth/peloton.js';

export class PelotonClient {
  constructor(username, password) {
    this.auth = new PelotonAuth();
    this.username = username;
    this.password = password;
    this.baseUrl = 'https://api.onepeloton.com';
  }

  async ensureAuthenticated() {
    if (!this.auth.isAuthenticated()) {
      await this.auth.login(this.username, this.password);
    }
  }

  async getRecentWorkouts(limit = 10) {
    await this.ensureAuthenticated();
    
    try {
      logger.info('Fetching recent Peloton workouts');
      
      const userId = this.auth.getUserId();
      const response = await axios.get(
        `${this.baseUrl}/api/user/${userId}/workouts`,
        {
          params: {
            joins: 'ride,ride.instructor',
            limit: limit,
            page: 0,
          },
          headers: {
            Cookie: `peloton_session_id=${this.auth.getSessionId()}`,
          },
        }
      );

      const workouts = response.data.data || [];
      logger.info(`Found ${workouts.length} Peloton workouts`);

      return workouts.map(workout => this.parseWorkout(workout));
    } catch (error) {
      logger.error('Failed to fetch Peloton workouts', error.response?.data || error.message);
      throw error;
    }
  }

  async getWorkoutMetrics(workoutId) {
    await this.ensureAuthenticated();
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/workout/${workoutId}/performance_graph`,
        {
          params: {
            every_n: 5, // Get data points every 5 seconds
          },
          headers: {
            Cookie: `peloton_session_id=${this.auth.getSessionId()}`,
          },
        }
      );

      return this.parseMetrics(response.data);
    } catch (error) {
      logger.error('Failed to fetch workout metrics', error.response?.data || error.message);
      return [];
    }
  }

  parseWorkout(workout) {
    const startTime = new Date(workout.created_at * 1000);
    const endTime = workout.end_time ? new Date(workout.end_time * 1000) : 
                    new Date(startTime.getTime() + (workout.ride?.duration || 0) * 1000);
    
    return {
      id: workout.id,
      workoutId: workout.id,
      startTime: startTime,
      endTime: endTime,
      duration: Math.round((endTime - startTime) / 1000),
      type: workout.fitness_discipline || workout.ride?.fitness_discipline || 'unknown',
      totalOutput: workout.total_work ? workout.total_work / 1000 : undefined, // Convert to kJ
      avgCadence: workout.average_cadence,
      avgHeartRate: workout.average_heart_rate,
      avgSpeed: workout.average_speed,
      avgPower: workout.average_power,
      calories: workout.calories,
      distance: workout.distance,
      name: workout.ride?.title || workout.name || 'Peloton Workout',
    };
  }

  parseMetrics(data) {
    const metrics = [];
    const summaries = data.summaries || [];
    const segments = data.segments || [];
    
    // Parse time-series data
    if (data.metrics && data.metrics.length > 0) {
      const metricsByType = {};
      
      data.metrics.forEach(metric => {
        metricsByType[metric.slug] = metric.values || [];
      });

      const length = Math.max(...Object.values(metricsByType).map(arr => arr.length));
      
      for (let i = 0; i < length; i++) {
        metrics.push({
          timestamp: i * data.seconds_since_pedaling_start || i * 5,
          heartRate: metricsByType.heart_rate?.[i],
          cadence: metricsByType.cadence?.[i],
          speed: metricsByType.speed?.[i],
          power: metricsByType.output?.[i],
          resistance: metricsByType.resistance?.[i],
        });
      }
    }

    return metrics;
  }
}

