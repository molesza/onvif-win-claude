#!/usr/bin/env node

const fs = require('fs');
const yaml = require('js-yaml');

// Configuration for second NVR
const NVR2_IP = '192.168.6.202';
const START_MAC_SUFFIX = 0x21; // Start from a2:a2:a2:a2:00:21
const START_PORT = 8113;
const START_CHANNEL = 33; // Continue from camera 32

// Function to generate UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Number of channels to add (can be modified based on actual NVR)
const NUM_CHANNELS = process.argv[2] ? parseInt(process.argv[2]) : 16;

console.log(`Adding ${NUM_CHANNELS} channels from NVR at ${NVR2_IP}`);

// Load existing config
let config;
try {
    const configData = fs.readFileSync('config.yaml', 'utf8');
    config = yaml.load(configData);
} catch (error) {
    console.error('Error loading config.yaml:', error.message);
    process.exit(1);
}

// Generate new cameras
for (let i = 0; i < NUM_CHANNELS; i++) {
    const channelNum = i + 1;
    const cameraNum = START_CHANNEL + i;
    const macSuffix = (START_MAC_SUFFIX + i).toString(16).padStart(2, '0');
    
    const camera = {
        mac: `a2:a2:a2:a2:00:${macSuffix}`,
        ports: {
            server: START_PORT + i,
            rtsp: 8555, // Same RTSP proxy port for all cameras from this NVR
            snapshot: 8581 // Same snapshot proxy port for all cameras from this NVR
        },
        name: `VideoSourceConfig_Channel${channelNum}_NVR2`,
        uuid: generateUUID(),
        highQuality: {
            rtsp: `/cam/realmonitor?channel=${channelNum}&subtype=0&unicast=true&proto=Onvif`,
            snapshot: `/onvif/snapshot?channel=${channelNum}&subtype=0`,
            width: 2592,
            height: 1944,
            framerate: 12,
            bitrate: 2048,
            quality: 4
        },
        lowQuality: {
            rtsp: `/cam/realmonitor?channel=${channelNum}&subtype=1&unicast=true&proto=Onvif`,
            snapshot: `/onvif/snapshot?channel=${channelNum}&subtype=1`,
            width: 352,
            height: 288,
            framerate: 12,
            bitrate: 160,
            quality: 1
        },
        target: {
            hostname: NVR2_IP,
            ports: {
                rtsp: 554,
                snapshot: 80
            }
        }
    };
    
    config.onvif.push(camera);
    console.log(`Added camera ${cameraNum}: ${camera.name} on ${camera.mac}`);
}

// Save updated config
const updatedYaml = yaml.dump(config, { noRefs: true, lineWidth: -1 });
fs.writeFileSync('config-combined.yaml', updatedYaml);

console.log(`\nConfiguration saved to config-combined.yaml`);
console.log(`Total cameras: ${config.onvif.length}`);
console.log(`\nNext steps:`);
console.log(`1. Create virtual interfaces ${START_CHANNEL} to ${START_CHANNEL + NUM_CHANNELS - 1}:`);
console.log(`   sudo ./setup-virtual-networks.sh ${START_CHANNEL + NUM_CHANNELS - 1}`);
console.log(`2. Request DHCP addresses:`);
console.log(`   sudo ./request-dhcp.sh`);
console.log(`3. Test with a few cameras first`);
console.log(`4. Use interactive adoption for new cameras`);