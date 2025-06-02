#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// NVR3 configuration
const NVR_IP = '192.168.6.204';
const NVR_USERNAME = 'admin';
const NVR_PASSWORD = 'Nespnp@123';
const CAMERA_COUNT = 32;

// Special resolution cameras
const SPECIAL_RESOLUTION_CHANNELS = [4, 15];

// Base ports for NVR3 (starting at 8301)
const BASE_SERVER_PORT = 8301;

// MAC address prefix for NVR3
const MAC_PREFIX = 'a3:a3:a3:a3:03:';

// Ensure configs-nvr3 directory exists
const configDir = path.join(__dirname, 'configs-nvr3');
if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir);
}

function generateUUID() {
    return crypto.randomUUID();
}

function generateCameraConfig(cameraNum) {
    const paddedNum = cameraNum.toString().padStart(2, '0');
    const hexNum = cameraNum.toString(16).padStart(2, '0');
    
    // Determine resolution based on channel
    let width = 1920;
    let height = 1080;
    if (SPECIAL_RESOLUTION_CHANNELS.includes(cameraNum)) {
        width = 1280;
        height = 1440;
    }
    
    const config = {
        onvif: [{
            mac: `${MAC_PREFIX}${hexNum}`,
            ports: {
                server: BASE_SERVER_PORT + (cameraNum - 1),
                rtsp: 8554,
                snapshot: 8580
            },
            name: `NVR3-Camera-${paddedNum}`,
            uuid: generateUUID(),
            highQuality: {
                rtsp: `/cam/realmonitor?channel=${cameraNum}&subtype=0&unicast=true&proto=Onvif`,
                snapshot: `/onvif/snapshot?channel=${cameraNum}&subtype=0`,
                width: width,
                height: height,
                framerate: 15,  // Using 15fps instead of reported 100fps
                bitrate: 2048,
                quality: 4
            },
            lowQuality: {
                rtsp: `/cam/realmonitor?channel=${cameraNum}&subtype=1&unicast=true&proto=Onvif`,
                snapshot: `/onvif/snapshot?channel=${cameraNum}&subtype=1`,
                width: 352,
                height: 288,
                framerate: 15,  // Using 15fps instead of reported 100fps
                bitrate: 160,
                quality: 1
            },
            target: {
                hostname: NVR_IP,
                ports: {
                    rtsp: 554,
                    snapshot: 80
                }
            }
        }]
    };
    
    return config;
}

console.log('Generating NVR3 configurations...');
console.log(`NVR IP: ${NVR_IP}`);
console.log(`Number of cameras: ${CAMERA_COUNT}`);
console.log(`Special resolution channels (1280x1440): ${SPECIAL_RESOLUTION_CHANNELS.join(', ')}`);
console.log(`Regular resolution channels (1920x1080): All others`);
console.log('');

// Generate individual camera configs
for (let i = 1; i <= CAMERA_COUNT; i++) {
    const config = generateCameraConfig(i);
    const yamlContent = require('js-yaml').dump(config, { lineWidth: -1 });
    const filename = path.join(configDir, `camera${i}.yaml`);
    
    fs.writeFileSync(filename, yamlContent);
    console.log(`Created ${filename}`);
}

console.log('\nConfiguration generation complete!');
console.log(`Generated ${CAMERA_COUNT} camera configurations in ${configDir}/`);