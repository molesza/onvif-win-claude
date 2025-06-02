#!/usr/bin/env node

/**
 * NVR Configuration Generator with RTSP Stream Probing
 * 
 * This script uses ffprobe to directly query RTSP streams and get actual
 * video properties (resolution, framerate, bitrate) from the NVR.
 * 
 * Usage: node generate-nvr-configs-probe.js <nvr-number> <nvr-ip> <username> <password> [camera-count]
 * Example: node generate-nvr-configs-probe.js 2 192.168.6.202 admin password123 16
 */

const fs = require('fs');
const yaml = require('yaml');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 4) {
    console.error('Usage: node generate-nvr-configs-probe.js <nvr-number> <nvr-ip> <username> <password> [camera-count]');
    console.error('Example: node generate-nvr-configs-probe.js 2 192.168.6.202 admin password123 16');
    process.exit(1);
}

const NVR_NUMBER = parseInt(args[0]);
const NVR_IP = args[1];
const USERNAME = args[2];
const PASSWORD = args[3];
const CAMERA_COUNT = args[4] ? parseInt(args[4]) : 32;

if (NVR_NUMBER < 1 || NVR_NUMBER > 6) {
    console.error('NVR number must be between 1 and 6');
    process.exit(1);
}

// Configuration settings
const BASE_MAC = `a2:a2:a2:a2:${NVR_NUMBER.toString().padStart(2, '0')}:`;
const BASE_PORT = 8000 + (NVR_NUMBER * 100);
const CONFIG_DIR = `configs-nvr${NVR_NUMBER}`;
const DOCKER_COMPOSE_FILE = `docker-compose-nvr${NVR_NUMBER}-${NVR_IP}.yml`;
const BASE_IP = 10 + ((NVR_NUMBER - 1) * 33);

// Default settings if probe fails
const DEFAULTS = {
    highQuality: {
        width: 2592,
        height: 1944,
        framerate: 12,
        bitrate: 2048
    },
    lowQuality: {
        width: 352,
        height: 288,
        framerate: 12,
        bitrate: 160
    }
};

// Generate UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Parse framerate string (e.g., "25/1" -> 25)
function parseFramerate(framerateStr) {
    if (!framerateStr) return null;
    if (framerateStr.includes('/')) {
        const [num, den] = framerateStr.split('/').map(Number);
        return Math.round(num / den);
    }
    return parseInt(framerateStr);
}

// Probe RTSP stream using ffprobe
async function probeRTSPStream(channel, subtype = 0) {
    const rtspUrl = `rtsp://${USERNAME}:${PASSWORD}@${NVR_IP}:554/cam/realmonitor?channel=${channel}&subtype=${subtype}&unicast=true&proto=Onvif`;
    
    try {
        console.log(`  Probing channel ${channel} subtype ${subtype}...`);
        
        // Use ffprobe to get stream information
        const cmd = `ffprobe -v quiet -print_format json -show_streams "${rtspUrl}"`;
        const { stdout } = await execPromise(cmd, { timeout: 10000 });
        
        const data = JSON.parse(stdout);
        const videoStream = data.streams.find(s => s.codec_type === 'video');
        
        if (videoStream) {
            const width = videoStream.width;
            const height = videoStream.height;
            const framerate = parseFramerate(videoStream.r_frame_rate) || parseFramerate(videoStream.avg_frame_rate);
            const bitrate = videoStream.bit_rate ? Math.round(parseInt(videoStream.bit_rate) / 1000) : null;
            
            console.log(`    ✓ Found: ${width}x${height} @ ${framerate}fps${bitrate ? `, ${bitrate}kb/s` : ''}`);
            
            return {
                width,
                height,
                framerate: framerate || 25,
                bitrate: bitrate || (subtype === 0 ? 2048 : 160),
                codec: videoStream.codec_name
            };
        }
    } catch (error) {
        console.log(`    ✗ Failed to probe: ${error.message}`);
    }
    
    return null;
}

// Probe camera to get actual settings
async function probeCamera(channel) {
    console.log(`Probing camera ${channel}...`);
    
    // Try to probe both high and low quality streams
    const highQuality = await probeRTSPStream(channel, 0);
    const lowQuality = await probeRTSPStream(channel, 1);
    
    // Use probed values or defaults
    return {
        highQuality: highQuality || DEFAULTS.highQuality,
        lowQuality: lowQuality || DEFAULTS.lowQuality,
        probed: !!(highQuality || lowQuality)
    };
}

async function generateConfigs() {
    console.log(`\nNVR Configuration Generator with RTSP Probing`);
    console.log(`=============================================`);
    console.log(`NVR ${NVR_NUMBER} at ${NVR_IP}`);
    console.log(`Cameras to configure: ${CAMERA_COUNT}`);
    console.log('');

    // Create config directory
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
        console.log(`Created directory: ${CONFIG_DIR}`);
    }

    console.log('\nProbing RTSP streams to detect actual settings...');
    console.log('(This may take a moment)\n');

    // Probe first few cameras to detect pattern
    const probedSettings = [];
    const samplesToProbe = Math.min(3, CAMERA_COUNT); // Probe first 3 cameras
    
    for (let i = 1; i <= samplesToProbe; i++) {
        const settings = await probeCamera(i);
        probedSettings.push(settings);
    }

    // Determine if all cameras have same settings
    let commonSettings = null;
    if (probedSettings.every(s => s.probed)) {
        // Check if all probed cameras have same settings
        const first = probedSettings[0];
        const allSame = probedSettings.every(s => 
            s.highQuality.width === first.highQuality.width &&
            s.highQuality.height === first.highQuality.height &&
            s.highQuality.framerate === first.highQuality.framerate
        );
        
        if (allSame) {
            commonSettings = first;
            console.log(`\n✓ All probed cameras have identical settings`);
            console.log(`  Using: ${first.highQuality.width}x${first.highQuality.height} @ ${first.highQuality.framerate}fps`);
        }
    }

    // Generate configurations
    console.log(`\nGenerating camera configurations...`);
    console.log(`MAC address range: ${BASE_MAC}01 - ${BASE_MAC}${CAMERA_COUNT.toString(16).padStart(2, '0')}`);
    console.log(`Port range: ${BASE_PORT + 1} - ${BASE_PORT + CAMERA_COUNT}`);
    console.log(`IP range: 192.168.6.${BASE_IP + 1} - 192.168.6.${BASE_IP + CAMERA_COUNT}\n`);

    for (let i = 1; i <= CAMERA_COUNT; i++) {
        // Use common settings or probe individually
        let cameraSettings;
        if (commonSettings) {
            cameraSettings = commonSettings;
        } else if (i <= samplesToProbe) {
            cameraSettings = probedSettings[i - 1];
        } else {
            // For remaining cameras, use common settings or defaults
            cameraSettings = commonSettings || { 
                highQuality: DEFAULTS.highQuality, 
                lowQuality: DEFAULTS.lowQuality,
                probed: false
            };
        }
        
        const cameraConfig = {
            mac: BASE_MAC + i.toString(16).padStart(2, '0'),
            ports: {
                server: BASE_PORT + i,
                rtsp: 8554,
                snapshot: 8580
            },
            name: `NVR${NVR_NUMBER}-Camera-${i.toString().padStart(2, '0')}`,
            uuid: generateUUID(),
            highQuality: {
                rtsp: `/cam/realmonitor?channel=${i}&subtype=0&unicast=true&proto=Onvif`,
                snapshot: `/onvif/snapshot?channel=${i}&subtype=0`,
                width: cameraSettings.highQuality.width,
                height: cameraSettings.highQuality.height,
                framerate: cameraSettings.highQuality.framerate,
                bitrate: cameraSettings.highQuality.bitrate,
                quality: 4
            },
            lowQuality: {
                rtsp: `/cam/realmonitor?channel=${i}&subtype=1&unicast=true&proto=Onvif`,
                snapshot: `/onvif/snapshot?channel=${i}&subtype=1`,
                width: cameraSettings.lowQuality.width,
                height: cameraSettings.lowQuality.height,
                framerate: cameraSettings.lowQuality.framerate,
                bitrate: cameraSettings.lowQuality.bitrate,
                quality: 1
            },
            target: {
                hostname: NVR_IP,
                ports: {
                    rtsp: 554,
                    snapshot: 80
                }
            }
        };
        
        // Wrap in onvif array to match expected format
        const config = {
            onvif: [cameraConfig]
        };
        
        const configPath = path.join(CONFIG_DIR, `camera${i}.yaml`);
        fs.writeFileSync(configPath, yaml.stringify(config));
        
        const probedIndicator = cameraSettings.probed ? '✓' : '○';
        console.log(`${probedIndicator} Created: ${configPath} (${cameraSettings.highQuality.width}x${cameraSettings.highQuality.height} @ ${cameraSettings.highQuality.framerate}fps)`);
    }

    // Generate Docker Compose file
    console.log(`\nGenerating Docker Compose file: ${DOCKER_COMPOSE_FILE}...`);

    const dockerCompose = {
        version: '3.8',
        services: {},
        networks: {
            'onvif-test_onvif_net': {
                external: true
            }
        }
    };

    // Add camera services
    for (let i = 1; i <= CAMERA_COUNT; i++) {
        const serviceName = `nvr${NVR_NUMBER}-camera${i}`;
        dockerCompose.services[serviceName] = {
            build: '.',
            container_name: `onvif-${serviceName}`,
            mac_address: BASE_MAC + i.toString(16).padStart(2, '0'),
            networks: {
                'onvif-test_onvif_net': {
                    ipv4_address: `192.168.6.${BASE_IP + i}`
                }
            },
            volumes: [
                `./${CONFIG_DIR}/camera${i}.yaml:/onvif.yaml:ro`
            ],
            restart: 'unless-stopped'
        };
    }

    fs.writeFileSync(DOCKER_COMPOSE_FILE, yaml.stringify(dockerCompose));
    console.log(`Created: ${DOCKER_COMPOSE_FILE}`);

    // Generate adoption script
    const adoptionScript = `#!/bin/bash
# Adoption script for NVR ${NVR_NUMBER} (${NVR_IP})
# Generated with RTSP stream probing

echo "Starting adoption process for NVR ${NVR_NUMBER}"
echo "This will start cameras one by one for UniFi Protect adoption"
echo ""

for i in {1..${CAMERA_COUNT}}; do
    echo "Starting camera $i..."
    docker compose -f ${DOCKER_COMPOSE_FILE} up -d nvr${NVR_NUMBER}-camera$i
    
    echo "Camera $i started. Please adopt it in UniFi Protect."
    echo "Press Enter when adoption is complete..."
    read
    
    echo "Continuing to camera $((i+1))..."
    echo ""
done

echo "All cameras have been adopted!"
echo "All cameras are now running."
`;

    const adoptionScriptPath = `adopt-nvr${NVR_NUMBER}.sh`;
    fs.writeFileSync(adoptionScriptPath, adoptionScript);
    fs.chmodSync(adoptionScriptPath, '755');
    console.log(`\nCreated adoption script: ${adoptionScriptPath}`);

    // Print summary
    console.log(`
========================================
Setup Complete for NVR ${NVR_NUMBER}
========================================

NVR IP: ${NVR_IP}
Config Directory: ${CONFIG_DIR}
Docker Compose File: ${DOCKER_COMPOSE_FILE}
Adoption Script: ${adoptionScriptPath}
Camera Count: ${CAMERA_COUNT}

MAC Address Range: ${BASE_MAC}01 - ${BASE_MAC}${CAMERA_COUNT.toString(16).padStart(2, '0')}
Port Range: ${BASE_PORT + 1} - ${BASE_PORT + CAMERA_COUNT}
IP Range: 192.168.6.${BASE_IP + 1} - 192.168.6.${BASE_IP + CAMERA_COUNT}

Legend:
  ✓ = Settings detected from RTSP stream
  ○ = Using default settings

Next Steps:
1. Build Docker image (if not already done):
   docker build -t onvif-server .

2. Run adoption script:
   ./${adoptionScriptPath}

3. Or start all cameras at once (after adoption):
   docker compose -f ${DOCKER_COMPOSE_FILE} up -d

4. Check status:
   docker compose -f ${DOCKER_COMPOSE_FILE} ps
`);
}

// Check if ffprobe is available
async function checkDependencies() {
    try {
        await execPromise('which ffprobe');
    } catch (error) {
        console.error('Error: ffprobe is not installed.');
        console.error('Please install ffmpeg/ffprobe:');
        console.error('  sudo apt-get install ffmpeg');
        process.exit(1);
    }
}

// Run the generator
async function main() {
    await checkDependencies();
    await generateConfigs();
}

main().catch(err => {
    console.error('Error generating configurations:', err);
    process.exit(1);
});