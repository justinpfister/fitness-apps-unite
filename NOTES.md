# Implementation Notes

## Architecture Decisions

### JavaScript over TypeScript
- Using vanilla JavaScript with ES modules for simplicity
- No build step required - runs directly with Node.js
- Easier to modify and debug for single-user application

### Authentication Strategy
- **Peloton**: Session-based authentication with username/password
- **Garmin**: Session cookie authentication (note: Garmin has complex auth, may need enhancement)
- **Strava**: OAuth 2.0 with refresh token management

### Data Prioritization
When merging Peloton and Garmin data:
1. **Peloton takes priority for**:
   - Power (watts) - Peloton's power sensors are primary
   - Speed - from bike/tread metrics
   - Heart rate - if available from Peloton
   - Workout structure and intervals

2. **Garmin supplements with**:
   - Running cadence (more accurate from watch)
   - GPS data (if outdoor activity)
   - Max heart rate
   - Additional advanced metrics

### Matching Algorithm
The matcher uses a weighted scoring system:
- **70% weight**: Time proximity (start time within 30-minute window)
- **30% weight**: Duration similarity (accounting for forgotten watch stops)

Confidence levels:
- **High**: Score ≥85 and time diff ≤5 minutes
- **Medium**: Score ≥70 and time diff ≤15 minutes  
- **Low**: Everything else (not used for matching)

### State Management
- JSON file-based state storage (`data/state.json`)
- Tracks processed activities to prevent duplicates
- Records sync history and status
- Persists authentication tokens (consider encryption for production)

## Known Limitations

### 1. Garmin Authentication
Garmin Connect authentication is notoriously complex:
- Current implementation uses simplified session-based auth
- May need to use third-party library like `garmin-connect` for production
- Session cookies may expire and require re-authentication

### 2. API Rate Limits
- Peloton: No documented rate limits, but use caution
- Garmin: Rate limits not well documented
- Strava: 100 requests per 15 minutes, 1000 per day
  - Current implementation doesn't track rate limits

### 3. Time Series Data Merging
- Current implementation does basic metric merging
- Could be enhanced to interpolate missing data points
- GPS track merging not fully implemented

### 4. TCX File Generation
- Manual TCX XML generation
- Limited to basic metrics (HR, cadence, speed, power)
- Could add more Garmin-specific extensions

### 5. No Activity Deletion from Garmin
- If a merge fails or needs to be redone, manual cleanup required
- Could add functionality to delete/update existing Garmin activities

## Future Enhancements

### Short Term
1. **Better error handling and retry logic**
   - Exponential backoff for API failures
   - Queue system for failed uploads

2. **Enhanced logging**
   - Structured logging with levels
   - Log rotation
   - Optional file-based logging

3. **Notification system**
   - Email/SMS alerts for sync failures
   - Summary reports

### Medium Term
1. **Web UI/Dashboard**
   - View sync status and history
   - Manual match/unmatch activities
   - Configure settings via UI

2. **More sophisticated matching**
   - ML-based matching using activity patterns
   - Manual review interface for low-confidence matches
   - Activity type matching (only match runs with runs, etc.)

3. **Database upgrade**
   - SQLite or PostgreSQL for better querying
   - Activity metadata storage
   - Sync analytics

### Long Term
1. **Multi-user support**
   - User accounts and authentication
   - Per-user configuration
   - Hosted service option

2. **Additional integrations**
   - Zwift
   - TrainingPeaks
   - Wahoo
   - Apple Health

3. **Advanced features**
   - Activity splitting/combining
   - Custom metric calculations
   - Training load analysis
   - Calendar integration

## Testing Strategy

### Manual Testing Checklist
- [ ] Peloton connection and activity fetch
- [ ] Garmin connection and activity fetch  
- [ ] Strava connection and activity fetch
- [ ] Activity matching with known pairs
- [ ] Merge and upload to Garmin
- [ ] Selective Strava sync
- [ ] Standalone activity handling
- [ ] Scheduler execution
- [ ] State persistence across restarts

### Test Scenarios
1. **Perfect match**: Peloton and Garmin start within 1 minute, same duration
2. **Delayed start**: Garmin started 5 minutes after Peloton
3. **Forgot to stop**: Garmin activity 10 minutes longer than Peloton
4. **Standalone Peloton**: No Garmin activity (strength class)
5. **Standalone Garmin**: No Peloton activity (outdoor run)
6. **Short activity**: < 25 minutes, should not sync to Strava
7. **Non-cardio**: Yoga, should not sync to Strava

## Deployment Options

### Local Machine (Development)
```bash
npm install
npm test
npm run scheduler
```

### Background Service with PM2
```bash
npm install -g pm2
pm2 start scheduler/cron.js --name fitness-sync
pm2 startup
pm2 save
```

### Docker (Future)
Could containerize for easier deployment:
- Multi-stage build
- Volume for state persistence
- Environment variable configuration
- Health checks

### Cloud Options
- AWS Lambda with EventBridge (scheduled)
- Google Cloud Functions with Cloud Scheduler
- Heroku with Heroku Scheduler addon
- DigitalOcean App Platform

## Security Considerations

### Current Implementation
- Credentials stored in `.env` file
- `.env` excluded from git
- State file contains activity IDs (not sensitive)

### Production Recommendations
1. **Encrypt sensitive data**
   - Use encryption for stored credentials
   - Consider using OS keychain/credential manager

2. **Secure token refresh**
   - Auto-refresh tokens before expiration
   - Handle refresh failures gracefully

3. **API key rotation**
   - Regular rotation of API keys
   - Monitor for unauthorized access

4. **Network security**
   - HTTPS only for all API calls
   - Validate SSL certificates
   - Use secure DNS

## Performance Considerations

### Current Performance
- Sync time: ~5-10 seconds for typical sync
- Scales linearly with number of activities
- No caching (fetches fresh data each time)

### Optimization Opportunities
1. **Caching**
   - Cache activity lists with TTL
   - Reduce API calls for unchanged data

2. **Parallel processing**
   - Fetch from all services concurrently
   - Upload to Garmin/Strava in parallel

3. **Incremental sync**
   - Only process activities since last sync
   - Use lastSyncTime more effectively

4. **Batch operations**
   - Group uploads when possible
   - Reduce overhead per activity

## Troubleshooting Common Issues

### "Garmin authentication failed"
- Verify credentials are correct
- Try logging into Garmin Connect website manually
- Check if account requires 2FA (not currently supported)
- May need to use `garmin-connect` npm package

### "No matches found" despite concurrent activities
- Check LOG_LEVEL=debug to see matching scores
- Verify time window is appropriate (default 30 min)
- Ensure activities are being fetched correctly
- Check activity timestamps in logs

### "Duplicate activities on Strava"
- Increase STRAVA_WAIT_HOURS (try 2-3 hours)
- Disable Garmin auto-sync to Strava
- Manually delete duplicates from Strava
- Check processed activities in state.json

### "Rate limit exceeded"
- Wait and try again later
- Reduce SYNC_INTERVAL_HOURS
- Reduce number of activities fetched per sync

## Contributing

### Code Style
- Use ES6+ features
- Async/await over promises
- Descriptive variable names
- Comments for complex logic

### Git Workflow
- Feature branches for new features
- Descriptive commit messages
- Test before committing

### Adding New Integrations
1. Create auth module in `auth/`
2. Create API client in `clients/`
3. Update orchestrator to include new service
4. Add configuration to `.env.example`
5. Update README with setup instructions

