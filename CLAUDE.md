# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Virtual ONVIF Server that creates virtual ONVIF-compatible devices from RTSP streams. It's primarily designed to work around limitations in third-party camera support (e.g., Unifi Protect) by splitting multi-channel ONVIF devices into individual virtual devices.

## Key Architecture

### Core Components

1. **main.js** - Entry point that handles:
   - Command-line argument parsing
   - Configuration loading (YAML format)
   - Starting the master discovery service
   - Starting virtual ONVIF servers
   - Setting up TCP proxies for RTSP/snapshot streams
   - Graceful shutdown with camera unregistration

2. **src/onvif-server.js** - Main ONVIF server implementation:
   - Creates SOAP services for ONVIF Device and Media services
   - Registers with the master discovery service instead of individual discovery
   - Manages video profiles and configurations
   - Implements ONVIF Profile S (streaming) functionality

3. **src/discovery-service.js** - Master discovery service:
   - Binds to UDP port 3702 for WS-Discovery
   - Maintains registry of all virtual cameras
   - Responds to discovery probes with all camera information
   - Handles multicast group membership

4. **src/camera-registry.js** - Camera registry:
   - Stores information about registered cameras
   - Provides methods to register/unregister cameras
   - Tracks camera metadata (UUID, name, hostname, port, etc.)

5. **src/config-builder.js** - Auto-generates configuration:
   - Connects to real ONVIF devices
   - Extracts stream profiles and settings
   - Creates YAML configuration templates

6. **generate-nvr-configs.js** - Multi-NVR configuration generator:
   - Creates configurations for multiple NVRs (1-6)
   - Automatically allocates non-overlapping IP ranges
   - Generates Docker Compose files with unique MAC addresses
   - Creates adoption scripts for each NVR
   - Supports variable camera counts per NVR

7. **generate-nvr-smart.js** - Intelligent NVR configuration generator:
   - Automatically detects highest IP in use across all NVRs
   - Probes NVR streams with ffprobe to detect actual resolutions
   - Corrects framerate reporting (100fps → 15fps)
   - Creates configurations with proper IP sequencing
   - Generates docker-compose with shared network
   - Auto-detects active camera channels

8. **adopt-nvr.sh** - Universal adoption script:
   - Works with any NVR configuration
   - Auto-detects camera count from docker-compose
   - Provides skip option for failed cameras
   - Shows clear progress and camera names
   - Ensures clean adoption process

### Monitoring Tools

1. **monitor-resources.sh** - Comprehensive resource analysis:
   - System specifications and current load
   - Per-camera CPU and memory usage
   - Network I/O statistics
   - Capacity analysis and recommendations
   - Health status checks

2. **monitor-realtime.sh** - Live monitoring dashboard:
   - Updates every 5 seconds
   - Color-coded health indicators
   - Top resource consumers
   - System resource overview

3. **export-stats.sh** - Statistics export:
   - Exports to CSV for trend analysis
   - Summary and detailed metrics
   - Designed for cron automation

### Dependencies
- **soap**: SOAP server/client implementation
- **node-tcp-proxy**: Proxies RTSP and snapshot streams
- **xml2js**: XML parsing for ONVIF messages
- **yaml**: Configuration file parsing
- **simple-node-logger**: Logging functionality

## Common Commands

### Running the Server
```bash
# Install dependencies
npm install

# Create configuration from existing ONVIF device
node main.js --create-config

# Run server with configuration
node main.js ./config.yaml

# Run with debug output
node main.js --debug ./config.yaml
```

### Docker Usage (Recommended)
```bash
# Build the Docker image
docker build -t onvif-server .

# Method 1: Generate configuration for an NVR (legacy)
node generate-nvr-configs.js <nvr-number> <nvr-ip> [camera-count]

# Method 2: Smart generation with auto-detection (recommended)
node generate-nvr-smart.js <nvr-ip> <username> <password> <nvr-name>

# Example: NVR3 with automatic detection
node generate-nvr-smart.js 192.168.6.204 admin password123 nvr3

# Adopt cameras using the universal script
./adopt-nvr.sh docker-compose-nvr3-192.168.6.204.yml nvr3

# Run all cameras after adoption
docker compose -f docker-compose-nvr3-192.168.6.204.yml up -d
```

## Configuration Structure

The server uses YAML configuration with this structure:
- **mac**: MAC address for virtual network interface
- **ports**: Server (ONVIF), RTSP, and snapshot ports
- **name**: Device name
- **uuid**: Unique device identifier
- **highQuality/lowQuality**: Stream configurations
  - rtsp: Path to RTSP stream
  - snapshot: Path to snapshot endpoint
  - width/height: Resolution
  - framerate: FPS
  - bitrate: kb/s
  - quality: 1-5 scale
- **target**: Real device connection info

## Network Requirements

### Docker (Recommended)
Docker Compose automatically handles network isolation using macvlan networking. Each container gets:
- A unique MAC address (defined in docker-compose.yml)
- Automatic DHCP IP assignment
- Proper network isolation

### Manual Setup (Alternative)
For non-Docker deployments, create virtual interfaces manually:
```bash
sudo ip link add [NAME] link [INTERFACE] address [MAC] type macvlan mode bridge
```

## WSDL Files

The `wsdl/` directory contains ONVIF service definitions:
- **device_service.wsdl**: Device management service
- **media_service.wsdl**: Media streaming service

These define the SOAP interface for ONVIF compatibility.

## Important Lessons Learned

### UniFi Protect Adoption Limitation
UniFi Protect can only adopt one virtual camera at a time when multiple cameras are running on the same host. This is NOT a bug in our implementation - it's a limitation/security feature of UniFi's discovery and adoption process. The system works perfectly when cameras are adopted one by one using the `interactive-adoption.js` script.

### Working Architecture
1. **Virtual Network Interfaces**: Each camera needs its own MAC address and IP address obtained via DHCP
2. **Master Discovery Service**: A single discovery service handles WS-Discovery for all cameras to avoid port conflicts  
3. **Individual ONVIF Services**: Each camera runs its own ONVIF service on a unique port (8081-8112)
4. **One-by-One Adoption**: Use the interactive adoption script to adopt cameras sequentially

### What Doesn't Work
- Running all cameras simultaneously during initial adoption in UniFi Protect
- Trying to make cameras appear completely unique during adoption (even with different manufacturers/models)

### What Works

#### Docker Workflow (Recommended)
1. Build and start containers: `docker compose up -d`
2. Adopt cameras one by one in UniFi Protect
3. All cameras run together after adoption

#### Manual Workflow
1. Create virtual network interfaces: `sudo ./setup-virtual-networks.sh`
2. Request DHCP addresses: `sudo ./request-dhcp.sh`  
3. Adopt cameras one by one: `node interactive-adoption.js config.yaml`
4. After adoption, run all cameras: `node main.js config.yaml`

## Success Story

Successfully deployed multiple NVRs on a Raspberry Pi:
- **NVR1**: 32 cameras at 192.168.6.201 (IPs: 192.168.6.11-42)
- **NVR2**: 16 cameras at 192.168.6.202 (IPs: 192.168.6.44-59)
- **NVR3**: 32 cameras at 192.168.6.204 (IPs: 192.168.6.60-91)
- All cameras adopted into UniFi Protect (one by one during adoption)
- System runs stably with all 80 cameras active simultaneously
- **Docker with macvlan networking and automated configuration generation proved to be the most reliable solution**

### Multi-NVR Architecture
- Automatic IP allocation prevents conflicts between NVRs
- Each NVR gets unique MAC address prefix (a2:a2:a2:a2:XX:YY)
- Port ranges allocated per NVR (8001-8032, 8101-8132, etc.)
- Single Docker network shared by all NVRs
- Scalable to 6 NVRs (192 total cameras)

### Docker Advantages
- Automatic network isolation with macvlan
- Easy management with separate docker-compose files per NVR
- No manual virtual interface management
- Containers restart automatically on system reboot
- Clean separation between NVRs and cameras

This confirms the architecture is sound and scalable - the only limitation is UniFi's adoption process, which requires adopting cameras one at a time.

## Future Improvements

### Adoption Process Enhancement
The current adoption process requires manual intervention for each camera. Potential improvements:
- Investigate UniFi Protect API for automated adoption
- Create a web interface for adoption management
- Implement batch adoption with configurable delays
- Add adoption status tracking and retry logic
- Consider ONVIF device emulation improvements to speed up discovery

### Stream Detection Improvements
- Cache ffprobe results to speed up configuration generation
- Add support for detecting codec information
- Implement automatic bitrate optimization based on resolution
- Add H.265/HEVC stream support detection