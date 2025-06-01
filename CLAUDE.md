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

### Docker Usage
```bash
# Run with mounted config
docker run --rm -it -v /path/to/config.yaml:/onvif.yaml ghcr.io/daniela-hase/onvif-server:latest

# Create config inside container
docker run --rm -it --entrypoint /bin/sh ghcr.io/daniela-hase/onvif-server:latest
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

Each virtual device requires a unique MAC address, typically created using MacVLAN:
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
- Docker containers with macvlan networking (UniFi still sees them as duplicates)
- Trying to make cameras appear completely unique (even with different manufacturers/models)

### What Works
1. Create virtual network interfaces: `sudo ./setup-virtual-networks.sh`
2. Request DHCP addresses: `sudo ./request-dhcp.sh`  
3. Adopt cameras one by one: `node interactive-adoption.js config.yaml`
4. After adoption, run all cameras: `node main.js config.yaml`

## Success Story

Successfully deployed and tested with 32 virtual ONVIF cameras on a Raspberry Pi:
- All 32 cameras adopted into UniFi Protect using the interactive adoption script
- Each camera maintains its own unique identity and streams independently
- System runs stably with all cameras active simultaneously (after initial adoption)
- Virtual network interfaces with DHCP work perfectly for camera isolation

This confirms the architecture is sound - the only limitation is UniFi's adoption process, which is easily handled by the interactive script.