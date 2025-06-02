# Virtual ONVIF Camera Resource Analysis Report

## System Specifications
- **Device**: Raspberry Pi 5
- **CPU**: 4 cores
- **RAM**: 8GB (8,253,120 KB)
- **Current Load**: 48 virtual ONVIF cameras (32 from NVR1 + 16 from NVR2)

## Current Resource Usage (48 Cameras)

### Memory Usage
- **Total System Memory**: 7.9GB
- **Used Memory**: 4.2GB (53% of total)
- **Available Memory**: 3.7GB
- **Average per Camera**: ~87MB

### CPU Usage
- **System Load Average**: 1.14 (28.5% of 4 cores)
- **Average CPU per Camera**: 0.7-1.0%
- **Total CPU Usage**: ~35-45% across all cores

### Network Bandwidth
- **Average Network I/O per Camera**: ~171MB cumulative
- **Observed Bandwidth Range**: 
  - Low activity cameras: 80-200MB
  - High activity cameras: 400-800MB
  - NVR1 cameras (longer runtime): 1.9-2.2GB cumulative

## Resource Breakdown Per Camera

### Minimal Requirements (Per Camera)
- **CPU**: 0.7-1.0%
- **Memory**: 87MB average
- **Network**: Variable based on stream quality and client connections

### Peak Requirements (Per Camera)
- **CPU**: Up to 1.15% during active streaming
- **Memory**: ~100MB with buffers
- **Network**: Depends on stream bitrate (2048 kb/s for high quality)

## Capacity Analysis

### Current Utilization (48 cameras)
- **CPU**: ~35-45% (comfortable headroom)
- **Memory**: 53% (4.2GB of 8GB)
- **Network**: Well within gigabit ethernet capacity

### Theoretical Maximum Capacity

Based on current usage patterns:

#### CPU-Limited Scenario
- Current: 48 cameras using ~40% CPU
- Maximum: ~96-100 cameras (at 80% CPU target)

#### Memory-Limited Scenario
- Current: 48 cameras using 4.2GB
- Available for cameras: ~6.5GB (leaving 1.5GB for system)
- Maximum: ~75 cameras (at 87MB per camera)

#### Practical Recommendation
- **Safe Maximum**: 64-72 cameras
- **Leaves headroom for**: 
  - System processes
  - Streaming spikes
  - UniFi Protect connections
  - System stability

## Network Considerations

### Bandwidth Requirements
- **Per Camera Stream**: 2048 kb/s (high) + 160 kb/s (low) = ~2.2 Mb/s
- **48 Cameras Total**: ~106 Mb/s theoretical maximum
- **Gigabit Network**: 1000 Mb/s capacity (10% utilization)

### Network Scaling
- Network is not a limiting factor
- Can easily support 100+ cameras from bandwidth perspective

## Optimization Opportunities

### Memory Optimization
1. Each container uses minimal memory (~87MB)
2. Node.js processes are efficient
3. No memory leaks observed

### CPU Optimization
1. Low CPU usage per camera (< 1%)
2. Load distributed across cores
3. Efficient RTSP proxying

### Potential Improvements
1. Container resource limits could be set to prevent runaway processes
2. Memory limits: 128MB per container
3. CPU limits: 0.5 CPU shares per container

## Conclusions

### Current State
- System is running efficiently with 48 cameras
- Resource usage is well-balanced
- No bottlenecks identified

### Maximum Capacity
- **Conservative Estimate**: 64 cameras
- **Optimal Target**: 72 cameras  
- **Theoretical Maximum**: 96 cameras (not recommended)

### Recommendations
1. **64 cameras** provides comfortable operation with headroom
2. Monitor memory usage as primary constraint
3. CPU and network have significant spare capacity
4. Consider 2 NVRs × 32 cameras = 64 total as optimal configuration

## Monitoring Commands

```bash
# Real-time resource monitoring
docker stats

# System overview
htop

# Memory details
free -h

# Network statistics
iftop

# Container resource limits
docker inspect <container> | grep -A 10 "HostConfig"
```

## Future Scaling Options

If more cameras needed beyond 64-72:
1. Add more Raspberry Pi units
2. Upgrade to 16GB RAM model
3. Implement container resource limits
4. Optimize streaming parameters (lower bitrate/resolution)