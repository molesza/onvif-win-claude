# ONVIF Camera Monitoring Tools

This directory contains three monitoring scripts for tracking resource usage of virtual ONVIF cameras.

## Available Scripts

### 1. monitor-resources.sh
Comprehensive resource analysis report that checks:
- System specifications and load
- Memory usage breakdown
- Container statistics by NVR
- CPU usage analysis (average, min, max)
- Network I/O statistics
- Top resource consumers
- Capacity analysis and recommendations
- Health status checks

**Usage:**
```bash
# Display report on screen
./monitor-resources.sh

# Save report to file
./monitor-resources.sh --save
```

### 2. monitor-realtime.sh
Real-time monitoring dashboard that updates every 5 seconds:
- Active camera count
- System load and memory
- Top 10 containers by CPU usage
- Average resource usage
- Color-coded health indicators

**Usage:**
```bash
./monitor-realtime.sh
# Press Ctrl+C to exit
```

### 3. export-stats.sh
Export statistics to CSV files for tracking over time:
- Creates summary and detailed CSV files
- Tracks resource usage trends
- Useful for capacity planning

**Usage:**
```bash
# Export current stats to CSV
./export-stats.sh

# Set up automated collection (cron)
*/15 * * * * /home/molesza/onvif-test/export-stats.sh
```

## Key Metrics

### Per Camera Averages (48 cameras running)
- **CPU**: ~0.8-1.0% per camera
- **Memory**: ~100MB per camera
- **Network**: Variable based on activity

### System Capacity
- **Conservative**: 64 cameras (recommended)
- **Optimal**: 72 cameras
- **Maximum**: 96 cameras (not recommended)

### Health Thresholds
- **Memory**: Warning at 80% system usage
- **CPU**: Warning at 80% per core
- **Containers**: Alert if any have stopped

## Resource Files Created

### By monitor-resources.sh
- `resource-report-YYYYMMDD-HHMMSS.log` (when using --save)

### By export-stats.sh
- `resource-logs/resource-summary-YYYY-MM-DD.csv`
- `resource-logs/resource-detail-YYYY-MM-DD.csv`
- `resource-logs/plot-data-YYYY-MM-DD.txt`

## Monitoring Best Practices

1. **Regular Checks**: Run `monitor-resources.sh` daily
2. **Trend Analysis**: Use `export-stats.sh` with cron for long-term tracking
3. **Real-time Issues**: Use `monitor-realtime.sh` when investigating problems
4. **Capacity Planning**: Review CSV exports monthly

## Interpreting Results

### Healthy System
- Memory usage < 80%
- CPU per core < 80%
- All containers running
- Load average < number of cores

### Warning Signs
- Memory usage > 80%
- CPU consistently > 80%
- Stopped containers
- High load averages

### Action Required
- Memory > 90%: Reduce camera count
- CPU > 90%: Check for runaway processes
- Multiple stopped containers: Check logs

## Example Output

```
=== CAPACITY ANALYSIS ===
Current utilization with 48 cameras:
  Average CPU per camera: 0.87%
  Estimated max cameras (CPU-limited at 80%): 368
  Estimated max cameras (Memory-limited): 65

=== HEALTH CHECK ===
✅ Memory usage is healthy
✅ CPU usage is healthy
✅ All containers are running
```

## Integration with Multi-NVR Setup

The scripts automatically detect and categorize cameras by NVR:
- NVR1: Default cameras (onvif-camera*)
- NVR2-6: Numbered cameras (onvif-nvr2-camera*)

This makes it easy to monitor resource usage per NVR deployment.