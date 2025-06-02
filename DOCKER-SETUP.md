# Docker Setup Guide

This guide provides detailed instructions for deploying virtual ONVIF cameras using Docker, including support for multiple NVRs.

## Why Docker?

Docker provides the best deployment experience for virtual ONVIF cameras:
- **Automatic network isolation** with macvlan networking
- **No manual interface management** - Docker handles everything
- **Easy scaling** to 32+ cameras
- **Persistent across reboots** with auto-restart
- **Simple management** with docker-compose

## Prerequisites

1. Docker and Docker Compose installed
2. Access to your router's DHCP server (for IP assignment)
3. The ONVIF server repository cloned locally

## Quick Start

### 1. Build the Docker Image

```bash
cd /path/to/onvif-test
docker build -t onvif-server .
```

### 2. Generate NVR Configuration

Use the automated script to generate all necessary files:

```bash
# Generate configuration for NVR with specified camera count
node generate-nvr-configs.js <nvr-number> <nvr-ip> [camera-count]

# Examples:
node generate-nvr-configs.js 1 192.168.6.201 32  # NVR1: 32 cameras
node generate-nvr-configs.js 2 192.168.6.202 16  # NVR2: 16 cameras
```

This creates:
- `configs-nvrX/` directory with camera configurations
- `docker-compose-nvrX-<ip>.yml` file
- `adopt-nvrX.sh` adoption script

### 3. Adopt Cameras in UniFi Protect

Use the generated adoption script for easy one-by-one adoption:

```bash
# For NVR1
sudo ./adopt-nvr1.sh

# For NVR2
sudo ./adopt-nvr2.sh
```

The script will:
1. Start each camera individually
2. Wait for you to adopt it in UniFi Protect
3. Continue to the next camera when you press Enter

### 4. Run All Cameras

After adoption is complete, all cameras run together:

```bash
# Start all NVR1 cameras
docker compose -f docker-compose-nvr1-192.168.6.201.yml up -d

# Start all NVR2 cameras
docker compose -f docker-compose-nvr2-192.168.6.202.yml up -d

# View status
docker compose -f docker-compose-nvr1-192.168.6.201.yml ps
```

## Docker Compose Configuration

The generated Docker Compose files use a consistent structure:

```yaml
version: '3.8'

services:
  nvr1-camera1:
    build: .
    container_name: onvif-nvr1-camera1
    mac_address: a2:a2:a2:a2:01:01  # Unique per NVR and camera
    networks:
      onvif-test_onvif_net:
        ipv4_address: 192.168.6.11  # Auto-allocated by script
    volumes:
      - ./configs-nvr1/camera1.yaml:/onvif.yaml:ro
    restart: unless-stopped

networks:
  onvif-test_onvif_net:
    external: true  # Created by first deployment
```

### MAC Address Scheme
- Format: `a2:a2:a2:a2:XX:YY`
- `XX` = NVR number (01-06)
- `YY` = Camera number (01-20 hex)

### IP Allocation
- NVR1: 192.168.6.11-42
- NVR2: 192.168.6.44-75
- NVR3: 192.168.6.77-108
- And so on...

## Network Architecture

Docker's macvlan network driver provides:
- Each container gets its own MAC address
- Containers appear as physical devices on the network
- DHCP server assigns IPs to each container
- Complete network isolation between cameras

## Managing Multiple NVRs

### Start/Stop NVR Cameras
```bash
# Start all cameras for an NVR
docker compose -f docker-compose-nvr1-192.168.6.201.yml up -d

# Stop all cameras for an NVR
docker compose -f docker-compose-nvr1-192.168.6.201.yml down

# Restart specific camera
docker compose -f docker-compose-nvr1-192.168.6.201.yml restart nvr1-camera5
```

### View Status
```bash
# Check all running cameras
docker ps | grep onvif

# Count cameras per NVR
docker ps | grep onvif-nvr1 | wc -l
docker ps | grep onvif-nvr2 | wc -l

# View logs for specific NVR
docker compose -f docker-compose-nvr1-192.168.6.201.yml logs
```

### Update Configuration
1. Edit the YAML file in `configs-nvrX/`
2. Restart the specific camera:
   ```bash
   docker compose -f docker-compose-nvr1-192.168.6.201.yml restart nvr1-camera1
   ```

## Troubleshooting

### Container won't start
- Check logs: `docker compose -f docker-compose-nvrX-<ip>.yml logs <service-name>`
- Verify MAC address is unique across all NVRs
- Ensure the external network exists: `docker network ls | grep onvif`

### Can't access camera
- Verify container is running: `docker ps | grep nvr`
- Check IP assignment: `docker inspect onvif-nvr1-camera1 | grep IPAddress`
- Test connectivity: `ping <camera-ip>`

### UniFi Protect adoption issues
- Only run one camera at a time during adoption
- Use the adoption script for systematic adoption
- After adoption, all cameras can run simultaneously

### Network issues
- The macvlan network is created automatically by Docker
- All NVRs share the same network (onvif-test_onvif_net)
- MAC addresses must be unique across all NVRs

## Best Practices

1. **Use the generation script** for consistent configuration
2. **Adopt cameras systematically** using the provided scripts
3. **Monitor resource usage** with `docker stats` when running many cameras
4. **Keep track of NVR assignments** in documentation
5. **Regular backups** of all `configs-nvrX/` directories
6. **Test with one NVR** before deploying multiple

## Advanced Configuration

### Custom Network Settings
Modify the network section in `docker-compose.yml`:

```yaml
networks:
  onvif_net:
    driver: macvlan
    driver_opts:
      parent: eth0
    ipam:
      config:
        - subnet: 10.0.0.0/24
          gateway: 10.0.0.1
          ip_range: 10.0.0.128/25  # Limit DHCP range
```

### Resource Limits
Add limits to prevent resource exhaustion:

```yaml
services:
  camera1:
    # ... other settings ...
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
```

### Health Checks
Add health monitoring:

```yaml
services:
  camera1:
    # ... other settings ...
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8081"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Current Deployment Status

### Successfully Running:
- **NVR1**: 32 cameras at 192.168.6.201
- **NVR2**: 16 cameras at 192.168.6.202

Both NVRs are fully operational on a Raspberry Pi with all cameras adopted in UniFi Protect.

## Conclusion

Docker deployment with automated configuration generation provides the most reliable solution for running multiple virtual ONVIF cameras across multiple NVRs. The macvlan networking ensures proper isolation while the generation script handles all the complexity of MAC/IP allocation and configuration.