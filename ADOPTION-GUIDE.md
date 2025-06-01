# UniFi Protect Adoption Guide

This guide explains how to successfully adopt multiple virtual ONVIF cameras into UniFi Protect.

**✅ Proven Method**: This process has been successfully used to adopt all 32 virtual cameras into UniFi Protect on a Raspberry Pi.

## The Challenge

UniFi Protect has a limitation where it can only adopt one virtual camera at a time when multiple cameras are running on the same host. This is a security/discovery feature of UniFi, not a bug in the virtual ONVIF server.

## Prerequisites

1. Raspberry Pi or Linux system with the virtual ONVIF server installed
2. Network interfaces created and DHCP addresses assigned
3. Configuration file (`config.yaml`) with all your cameras defined
4. UniFi Protect system on the same network

## Step-by-Step Adoption Process

### 1. Create Virtual Network Interfaces

First, create the virtual network interfaces for all cameras:

```bash
sudo ./setup-virtual-networks.sh
```

This creates 32 virtual interfaces (onvif-proxy-1 through onvif-proxy-32) with unique MAC addresses.

### 2. Request DHCP Addresses

Get IP addresses from your router's DHCP server:

```bash
sudo ./request-dhcp.sh
```

Verify all interfaces have IP addresses. You should see output like:
```
onvif-proxy-1: 192.168.6.233
onvif-proxy-2: 192.168.6.234
...
```

### 3. Run the Interactive Adoption Script

This is the key to successful adoption:

```bash
node interactive-adoption.js config.yaml
```

The script will:
1. Show you how many cameras are configured
2. Start camera 1 and display its details (IP, port, MAC)
3. Wait for you to adopt it in UniFi Protect
4. Once adopted, stop camera 1 and start camera 2
5. Repeat until all cameras are adopted

### 4. Adopting in UniFi Protect

For each camera:
1. Open UniFi Protect
2. Go to Settings → Devices
3. Click "Add Device" 
4. The virtual camera should appear in discovery
5. Click "Adopt" on the camera
6. Enter the username/password from your real ONVIF device
7. Wait for adoption to complete
8. Return to the terminal and press Enter to continue

### 5. Running All Cameras

After all cameras are adopted, you can run them all together:

```bash
node main.js config.yaml
```

Or create a systemd service for automatic startup:

```bash
sudo cp onvif-proxy.service /etc/systemd/system/
sudo systemctl enable onvif-proxy
sudo systemctl start onvif-proxy
```

## Troubleshooting

### Camera doesn't appear in UniFi discovery
- Check the camera is running: Look for "Started!" messages in the terminal
- Verify network connectivity: Can you ping the camera's IP?
- Check UniFi is on the same subnet

### Adoption fails
- Verify the username/password matches your real ONVIF device
- Check the RTSP stream is accessible
- Look at the terminal output for error messages

### Multiple cameras show as one device
- This means you're running multiple cameras at once during adoption
- Stop all cameras and use the interactive script
- Adopt one at a time

### Cameras work initially but fail after reboot
- Make sure virtual interfaces are persistent
- Use the systemd service for automatic startup
- Check DHCP leases haven't expired

## Network Architecture

Each virtual camera has:
- Unique MAC address (a2:a2:a2:a2:00:01 through a2:a2:a2:a2:00:20)
- DHCP-assigned IP address 
- Its own ONVIF service port (8081-8112)
- TCP proxy for RTSP streams

The master discovery service coordinates all cameras but each operates independently once adopted.

## Best Practices

1. **Always adopt one camera at a time** using the interactive script
2. **Document your camera mappings** (which virtual camera corresponds to which channel)
3. **Reserve DHCP addresses** in your router for consistent IPs
4. **Monitor the first few cameras** before adopting all 32
5. **Test camera streams** in VLC before adoption to verify connectivity

## Quick Reference

```bash
# Setup (run once)
sudo ./setup-virtual-networks.sh
sudo ./request-dhcp.sh

# Adoption (one time per camera)
node interactive-adoption.js config.yaml

# Normal operation (after adoption)
node main.js config.yaml

# View logs
journalctl -u onvif-proxy -f
```

## Post-Adoption Success

Once all cameras are adopted using the interactive script:
- All 32 cameras can run simultaneously without issues
- Each camera streams independently to UniFi Protect
- The system is stable and can handle reboots (with proper systemd service)
- UniFi Protect treats each camera as a separate device

The key is patience during the initial adoption process - once that's complete, the system works flawlessly!