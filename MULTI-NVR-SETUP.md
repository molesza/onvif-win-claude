# Multi-NVR Setup Guide

This guide explains how to deploy multiple NVRs using the Virtual ONVIF Server system. Each NVR can support up to 32 cameras with automatic IP and MAC address allocation.

## Overview

The system supports up to 6 NVRs, each with:
- Unique MAC address prefix
- Automatic IP address allocation (non-overlapping ranges)
- Separate Docker Compose configuration
- Individual adoption scripts for UniFi Protect

## Quick Start

### 1. Generate NVR Configuration

Use the `generate-nvr-configs.js` script to create all necessary files:

```bash
# Usage: node generate-nvr-configs.js <nvr-number> <nvr-ip> [camera-count]

# Examples:
node generate-nvr-configs.js 1 192.168.6.201 32  # NVR1 with 32 cameras
node generate-nvr-configs.js 2 192.168.6.202 16  # NVR2 with 16 cameras
node generate-nvr-configs.js 3 192.168.6.203 24  # NVR3 with 24 cameras
```

This generates:
- `configs-nvrX/` - Directory with individual camera YAML configurations
- `docker-compose-nvrX-<ip>.yml` - Docker Compose file for the NVR
- `adopt-nvrX.sh` - Adoption script for UniFi Protect

### 2. Build Docker Image

If not already built:
```bash
docker build -t onvif-server .
```

### 3. Adopt Cameras

UniFi Protect requires cameras to be adopted one at a time:

```bash
# For NVR1
sudo ./adopt-nvr1.sh

# For NVR2
sudo ./adopt-nvr2.sh
```

The script will:
1. Start camera 1
2. Wait for you to adopt it in UniFi Protect
3. Continue with camera 2 after you press Enter
4. Repeat for all cameras

### 4. Verify Deployment

After adoption, all cameras run together:
```bash
# Check status of NVR1
docker compose -f docker-compose-nvr1-192.168.6.201.yml ps

# Check status of NVR2
docker compose -f docker-compose-nvr2-192.168.6.202.yml ps
```

## IP Address Allocation

The system automatically allocates IP addresses to prevent conflicts:

| NVR | Starting IP | Ending IP | Range Size |
|-----|------------|-----------|------------|
| NVR1 | 192.168.6.11 | 192.168.6.42 | 32 IPs |
| NVR2 | 192.168.6.44 | 192.168.6.75 | 32 IPs |
| NVR3 | 192.168.6.77 | 192.168.6.108 | 32 IPs |
| NVR4 | 192.168.6.110 | 192.168.6.141 | 32 IPs |
| NVR5 | 192.168.6.143 | 192.168.6.174 | 32 IPs |
| NVR6 | 192.168.6.176 | 192.168.6.207 | 32 IPs |

Note: Even if you specify fewer cameras, the IP range is reserved to prevent future conflicts.

## MAC Address Scheme

Each NVR uses a unique MAC address prefix:

| NVR | MAC Prefix | Example MACs |
|-----|------------|--------------|
| NVR1 | a2:a2:a2:a2:01:XX | a2:a2:a2:a2:01:01 - a2:a2:a2:a2:01:20 |
| NVR2 | a2:a2:a2:a2:02:XX | a2:a2:a2:a2:02:01 - a2:a2:a2:a2:02:20 |
| NVR3 | a2:a2:a2:a2:03:XX | a2:a2:a2:a2:03:01 - a2:a2:a2:a2:03:20 |
| ... | ... | ... |

## Port Allocation

Each NVR uses a different port range for ONVIF services:

| NVR | ONVIF Port Range | Starting Port |
|-----|------------------|---------------|
| NVR1 | 8001-8032 | 8001 |
| NVR2 | 8101-8132 | 8101 |
| NVR3 | 8201-8232 | 8201 |
| ... | ... | ... |

Note: RTSP (8554) and snapshot (8580) ports are the same for all cameras as they're isolated by Docker networking.

## Managing Multiple NVRs

### Start All Cameras (After Adoption)
```bash
# Start all NVR1 cameras
docker compose -f docker-compose-nvr1-192.168.6.201.yml up -d

# Start all NVR2 cameras
docker compose -f docker-compose-nvr2-192.168.6.202.yml up -d
```

### Stop Cameras
```bash
# Stop NVR1
docker compose -f docker-compose-nvr1-192.168.6.201.yml down

# Stop NVR2
docker compose -f docker-compose-nvr2-192.168.6.202.yml down
```

### View Logs
```bash
# View logs for all NVR1 cameras
docker compose -f docker-compose-nvr1-192.168.6.201.yml logs

# View logs for specific camera
docker logs onvif-nvr1-camera1
```

### Update Configuration
1. Edit the YAML file in `configs-nvrX/`
2. Restart the specific camera:
   ```bash
   docker compose -f docker-compose-nvr1-192.168.6.201.yml restart nvr1-camera1
   ```

## Troubleshooting

### Camera Not Appearing in UniFi Protect
- Ensure only one camera is running during adoption
- Check that the camera container is running: `docker ps | grep nvr`
- Verify network connectivity to the NVR IP address

### IP Address Conflicts
- The system automatically allocates non-overlapping IP ranges
- If you need custom IPs, edit the `ipv4_address` in the Docker Compose file

### Cannot Adopt Multiple Cameras at Once
- This is a UniFi Protect limitation, not a bug
- Always use the adoption script to adopt cameras one by one
- After adoption, all cameras can run simultaneously

## Advanced Configuration

### Custom IP Ranges
To use custom IP addresses, edit the generated Docker Compose file:
```yaml
services:
  nvr1-camera1:
    networks:
      onvif-test_onvif_net:
        ipv4_address: 192.168.6.100  # Custom IP
```

### Different Camera Counts per NVR
Specify the camera count when generating configs:
```bash
node generate-nvr-configs.js 1 192.168.6.201 32  # 32 cameras
node generate-nvr-configs.js 2 192.168.6.202 16  # 16 cameras
node generate-nvr-configs.js 3 192.168.6.203 8   # 8 cameras
```

### Network Isolation
Each NVR's cameras are on the same Docker network but have unique IPs and MAC addresses, ensuring proper isolation and identification in UniFi Protect.

## Monitoring Your Deployment

Use the built-in monitoring tools to track resource usage:

```bash
# Check resource usage across all NVRs
./monitor-resources.sh

# Watch real-time statistics
./monitor-realtime.sh

# Export data for trend analysis
./export-stats.sh
```

### Resource Usage Guidelines
Based on analysis of 48 cameras (NVR1 + NVR2):
- **Per Camera**: ~100MB RAM, ~0.87% CPU
- **Raspberry Pi 5 Capacity**: 64-72 cameras recommended
- **Primary Constraint**: Memory (not CPU or network)

## Current Deployment Status

### Successfully Deployed:
- **NVR1**: 32 cameras at 192.168.6.201 (IPs: 192.168.6.11-42)
- **NVR2**: 16 cameras at 192.168.6.202 (IPs: 192.168.6.44-59)

Both NVRs are fully operational with all cameras adopted in UniFi Protect and running stably on a Raspberry Pi 5 with 8GB RAM.