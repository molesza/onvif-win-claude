# Virtual Onvif Server
This is a simple Virtual Onvif Server that was originally developed to work around limitations in the third party support of Unifi Protect.
It takes an existing RTSP Stream and builds a virtual Onvif device for it, so the stream can be consumed by Onvif compatible clients.

Currently only Onvif Profile S (Live Streaming) is implemented with limited functionality.

## 🆕 Web Interface Available!
A modern web-based management interface is now available for easier camera management. See [WEB-INTERFACE-QUICKSTART.md](WEB-INTERFACE-QUICKSTART.md) for setup instructions.

**✅ Tested and Working**: Successfully deployed with multiple NVRs on a Raspberry Pi:
- NVR1: 32 cameras at 192.168.6.201 (IPs: 192.168.6.11-42)
- NVR2: 16 cameras at 192.168.6.202 (IPs: 192.168.6.44-59)
- NVR3: 32 cameras at 192.168.6.204 (IPs: 192.168.6.60-91)
- Total: 80 cameras running simultaneously
- Scalable to support up to 6 NVRs with automatic IP allocation

# Unifi Protect
Unifi Protect 5.0 introduced support for third party cameras that allow the user to add Onvif compatible cameras to their Unifi Protect system.

At the time of writing this, version 5.0.34 of Unifi Protect unfortunately has some limitations and does only support cameras with a single high- and low quality stream. Unfortunately video recorders that output multiple cameras (e.g. Hikvision / Dahua XVR) or cameras with multiple internal cameras are not properly supported.

Run this tool on a Raspberry Pi or similar to split up a multi-channel Onvif device into multiple virtual Onvif devices that work well with Unifi Protect 5.0.

## Raspberry Pi Setup

### Prerequisites
Ensure you are running Rapsberry OS 11 (Bullseye) or newer and have Node.js v16 or higher installed.

To check your version of Node.js run this command:
```bash
node -v
```

To install Node.js run these commands:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash

# Open a new Terminal / SSH connection
nvm install --lts
```

### Installation
To install all required dependencies run:
```bash
cd /path/to/onvif-server/
npm install
```

### Architecture Overview

### Master Discovery Service
This Virtual Onvif Server implements a centralized discovery architecture to handle multiple virtual cameras efficiently. When running multiple virtual ONVIF cameras, a single master discovery service handles WS-Discovery for all devices, eliminating port conflicts that would occur if each camera tried to bind to the same UDP port (3702).

Key components:
- **Master Discovery Service**: A single service that listens on UDP port 3702 and responds to discovery probes with information about all registered cameras
- **Camera Registry**: Maintains information about all active virtual cameras
- **Individual ONVIF Services**: Each virtual camera runs its own ONVIF service on a unique port (e.g., 8081-8112) but registers with the central discovery service

This architecture allows the system to scale to any number of virtual cameras without port conflicts, similar to how real multi-channel NVRs operate.

## Deployment Options

### Docker (Recommended)

The recommended way to run multiple virtual ONVIF cameras is using Docker containers with macvlan networking. This approach provides better isolation and easier management.

#### Quick Start with Docker

1. **Build the Docker image:**
   ```bash
   docker build -t onvif-server .
   ```

2. **Generate configurations for your NVR:**
   ```bash
   # For NVR1 (32 cameras at 192.168.6.201)
   node generate-nvr-configs.js 1 192.168.6.201 32
   
   # For NVR2 (16 cameras at 192.168.6.202)
   node generate-nvr-configs.js 2 192.168.6.202 16
   ```

3. **Adopt cameras using the generated script:**
   ```bash
   # For NVR1
   sudo ./adopt-nvr1.sh
   
   # For NVR2
   sudo ./adopt-nvr2.sh
   ```

The Docker setup automatically:
- Creates a macvlan network for proper camera isolation
- Assigns unique MAC addresses to each container
- Manages cameras with automatic IP assignment via DHCP
- Generates separate Docker Compose files for each NVR

#### Example Docker Compose Configuration

Each camera is defined as a service with its own MAC address:
```yaml
services:
  camera1:
    build: .
    container_name: onvif-camera1
    mac_address: a2:a2:a2:a2:00:01
    networks:
      onvif_net:
        ipv4_address: 192.168.6.11  # Optional: fixed IP
    volumes:
      - ./configs/camera1.yaml:/onvif.yaml:ro
    restart: unless-stopped
```

### Virtual Network Interfaces (Alternative)

For systems where Docker is not available, you can create virtual network interfaces manually:

```bash
ip link add [NAME] link [INTERFACE] address [MAC_ADDRESS] type macvlan mode bridge
```

> [!TIP]
> It is recommended to reserve fixed IP addresses in your DHCP server for your virtual networks.

Replace `[NAME]` with a name of your choosing (e.g. `onvif-proxy-1`) and `[MAC_ADDRESS]` with a locally administered MAC address[^2] (e.g. `a2:a2:a2:a2:a2:a1`) and `[INTERFACE]` with the name of the parent network interface (e.g. `eth0`).

> [!IMPORTANT]
> All virtual network settings will be lost when you reboot the server and will need to be redone!

## Configure Virtual Onvif Devices
The configuration can be automatically created by running:
```bash
node main.js --create-config
```
Enter the hostname and credentials of your real Onvif Camera server and copy/paste the generated configuration into a new file `config.yaml` and change the `<ONVIF PROXY MAC ADDRESS HERE>` fields to one of your virtual network MAC addresses each.

## Example Configuration
```yaml
onvif:
  - mac: a2:a2:a2:a2:a2:a1
    ports:
      server: 8081
      rtsp: 8554
      snapshot: 8580
    name: Channel1
    uuid: 15b21259-77d9-441f-9913-3ccd8a82e430
    highQuality:
      rtsp: /cam/realmonitor?channel=1&subtype=0&unicast=true&proto=Onvif
      snapshot: /onvif/snapshot?channel=1&subtype=0
      width: 2592
      height: 1944
      framerate: 12
      bitrate: 2048
      quality: 4
    lowQuality:
      rtsp: /cam/realmonitor?channel=1&subtype=1&unicast=true&proto=Onvif
      snapshot: /onvif/snapshot?channel=1&subtype=1
      width: 352
      height: 288
      framerate: 12
      bitrate: 160
      quality: 1
    target:
      hostname: 192.168.1.152
      ports:
        rtsp: 554
        snapshot: 80
```

The above configuration creates a virtual Onvif device that listens on port 8081 of the `a2:a2:a2:a2:a2:a1` virtual network and forwards the RTSP video streams and snapshots from `192.168.1.152` (the real Onvif server).

## Start Virtual Onvif Servers
Finally, to start the virtual Onvif devices run:
```bash
node main.js ./config.yaml
```

When starting, the application will:
1. Start a single master discovery service on UDP port 3702
2. Create virtual ONVIF servers for each camera defined in the configuration
3. Register each camera with the discovery service
4. Set up TCP proxies for RTSP streams and snapshots

Your Virtual Onvif Devices should now automatically show up for adoption in Unifi Protect as "Onvif Cardinal" device. The username and password are the same as on the real Onvif device.

### Important Note for UniFi Protect Users
UniFi Protect can only adopt one virtual camera at a time when multiple cameras are running on the same host. This is a limitation of UniFi's discovery and adoption process. 

#### Docker Workflow:
1. Use the universal adoption script:
   ```bash
   # For any NVR configuration
   ./adopt-nvr.sh docker-compose-nvr3-192.168.6.204.yml nvr3
   ```
   
   The script will:
   - Start cameras one at a time
   - Guide you through adoption for each camera
   - Auto-detect total camera count
   - Allow skipping failed cameras
   - Start all cameras after adoption

2. After all cameras are adopted, they will all run together automatically

#### Non-Docker Workflow:
1. Use the interactive adoption script:
   ```bash
   node interactive-adoption.js config.yaml
   ```

2. After adoption, run all cameras:
   ```bash
   node main.js config.yaml
   ```


## Resource Monitoring

Monitor your ONVIF camera deployment with built-in tools:

```bash
# Comprehensive resource report
./monitor-resources.sh

# Real-time monitoring dashboard
./monitor-realtime.sh

# Export statistics to CSV
./export-stats.sh
```

See [MONITORING-TOOLS.md](MONITORING-TOOLS.md) for detailed usage.

## Multi-NVR Support

This system supports multiple NVRs with automatic configuration generation:

### Method 1: Generate NVR Configuration (Legacy)
```bash
# Usage: node generate-nvr-configs.js <nvr-number> <nvr-ip> [camera-count]
# NVR numbers 1-6 are supported

# Example for NVR3 with 24 cameras at 192.168.6.203
node generate-nvr-configs.js 3 192.168.6.203 24
```

### Method 2: Smart NVR Configuration (Recommended)
```bash
# Usage: node generate-nvr-smart.js <nvr-ip> <username> <password> <nvr-name>

# Example for NVR3 with automatic detection
node generate-nvr-smart.js 192.168.6.204 admin password123 nvr3
```

Smart generation features:
- Automatically detects next available IP address
- Probes NVR streams to detect actual resolutions
- Auto-detects number of active cameras
- Corrects framerate reporting issues
- Creates proper sequential IP addressing

Both methods generate:
- `configs-nvrX/` directory with camera configurations
- `docker-compose-nvrX-<ip>.yml` Docker Compose file
- Compatible with universal adoption script

### IP Address Allocation
The system automatically allocates IP addresses to avoid conflicts:
- NVR1: 192.168.6.11-42 (32 addresses starting at .11)
- NVR2: 192.168.6.44-75 (32 addresses starting at .44)
- NVR3: 192.168.6.77-108 (32 addresses starting at .77)
- And so on...

### MAC Address Scheme
Each NVR uses a unique MAC address prefix:
- NVR1: `a2:a2:a2:a2:01:XX`
- NVR2: `a2:a2:a2:a2:02:XX`
- NVR3: `a2:a2:a2:a2:03:XX`
- And so on...

## Single Camera with Docker

For testing or single camera setups:
```bash
docker run --rm -it -v /path/to/my/config.yaml:/onvif.yaml ghcr.io/daniela-hase/onvif-server:latest
```

## Creating Configuration Inside Docker

To create the configuration from inside the docker container:
```bash
docker run --rm -it --entrypoint /bin/sh ghcr.io/daniela-hase/onvif-server:latest

# Once inside the container, run:
node main.js --create-config
```

# Wrapping an RTSP Stream
This tool can also be used to create Onvif devices from regular RTSP streams by creating the configuration manually.

**RTSP Example:**
Assume you have this RTSP stream:
```txt
rtsp://192.168.1.32:554/cam/stream
       \__________/ \_/\_________/
            |       Port    |
         Hostname           |
                          Path
```
If your RTSP url does not have a port it uses the default port 554.

Your RTSP url may contain a username and password - those should not be included in the config file.
Instead you will have to enter them in the software that you plan on consuming this Onvif camera in, for example during adoption in Unifi Protect.

Next you need to figure out the resolution and framerate for the stream. If you don't know them, you can use VLC to open the RTSP stream and check the _Media Information_ (Window -> Media Information) for the _"Video Resolution"_ and _"Frame rate"_ on the _"Codec Details"_ page, and the _"Stream bitrate"_ on the _"Statistics"_ page. The bitrate will fluctuate quite a bit most likely, so just pick a number that is close to it (e.g. 1024, 2048, 4096 ..).

Let's assume the resolution is 1920x1080 with 30 fps and a bitrate of 1024 kb/s, then the `config.yaml` for that stream would look as follows:

```yaml
onvif:
  - mac: a2:a2:a2:a2:a2:a1                        # The MAC address for the server to run on
    ports:
      server: 8081                                # The port for the server to run on
      rtsp: 8554                                  # The port for the stream passthrough, leave this at 8554
    name: MyRTSPStream                            # A user define name
    uuid: 1714a629-ebe5-4bb8-a430-c18ffd8fa5f6    # A randomly chosen UUID (see below)
    highQuality:
      rtsp: /cam/stream                           # The RTSP Path
      width: 1920                                 # The Video Width
      height: 1080                                # The Video Height
      framerate: 30                               # The Video Framerate/FPS
      bitrate: 1024                               # The Video Bitrate in kb/s
      quality: 4                                  # Quality, leave this as 4 for the high quality stream.
    lowQuality:
      rtsp: /cam/stream                           # The RTSP Path
      width: 1920                                 # The Video Width
      height: 1080                                # The Video Height
      framerate: 30                               # The Video Framerate/FPS
      bitrate: 1024                               # The Video Bitrate in kb/s
      quality: 1                                  # Quality, leave this as 1 for the low quality stream.
    target:
      hostname: 192.168.1.32                      # The Hostname of the RTSP stream
      ports:
        rtsp: 554                                 # The Port of the RTSP stream
```

You can either randomly change a few numbers of the UUID, or use a UUIDv4 generator[^3].

If you have a separate low-quality RTSP stream available, fill in the information for the `lowQuality` section above. Otherwise just copy the `highQualtiy` settings.

> [!NOTE]
> Since we don't provide a snapshot url you will onyl see the Onvif logo in certain places in Unifi Protect where it does not show the livestream.

# Troubleshooting

- **All cameras show the same video stream in Unifi Protect**

Unifi Protect identifies cameras by their MAC address - if multiple cameras have the same MAC address they will be treated as the same.
It is possible your system is configured for all virtual network interfaces to report the same MAC address, to prevent this run these commands[^4]:
```bash
sudo sysctl -w net.ipv4.conf.all.arp_ignore=1
sudo sysctl -w net.ipv4.conf.all.arp_announce=2
```

- **Error: Wsse authorized time check failed.**

Try updating the date/time on your Onvif device to the current time.

- **I only see snapshots, no live-stream.**

Are you capturing the RTSP streams of your cameras elsewhere already? It is possible that you hit the maximum concurrent RTSP streams that your camera supports.

Unifi Protect also seems to only support h264 video streams at the moment. So ensure your real Onvif camera encodes videos with h264.


[^1]: [What is MacVLAN?](https://ipwithease.com/what-is-macvlan)
[^2]: [Wikipedia: Locally Administered MAC Address](https://en.wikipedia.org/wiki/MAC_address#:~:text=Locally%20administered%20addresses%20are%20distinguished,how%20the%20address%20is%20administered.)
[^3]: [UUIDv4 Generator](https://www.uuidgenerator.net/)
[^4]: [Virtual Interfaces with different MAC addresses](https://serverfault.com/questions/682311/virtual-interfaces-with-different-mac-addresses)