#!/usr/bin/env node

/**
 * Enhanced NVR Configuration Generator with ONVIF Probing
 * 
 * This script combines the automatic ONVIF discovery from config-builder.js
 * with the multi-NVR configuration generation capabilities.
 * 
 * Usage: node generate-nvr-configs-auto.js <nvr-number> <nvr-ip> <username> <password> [camera-count]
 * Example: node generate-nvr-configs-auto.js 2 192.168.6.202 admin password123 16
 */

const fs = require('fs');
const yaml = require('yaml');
const path = require('path');
const configBuilder = require('./src/config-builder');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 4) {
    console.error('Usage: node generate-nvr-configs-auto.js <nvr-number> <nvr-ip> <username> <password> [camera-count]');
    console.error('Example: node generate-nvr-configs-auto.js 2 192.168.6.202 admin password123 16');
    process.exit(1);
}

const NVR_NUMBER = parseInt(args[0]);
const NVR_IP = args[1];
const USERNAME = args[2];
const PASSWORD = args[3];
const CAMERA_COUNT = args[4] ? parseInt(args[4]) : null; // If not specified, will be determined by probing

if (NVR_NUMBER < 1 || NVR_NUMBER > 6) {
    console.error('NVR number must be between 1 and 6');
    process.exit(1);
}

// Configuration settings
const BASE_MAC = `a2:a2:a2:a2:${NVR_NUMBER.toString().padStart(2, '0')}:`;
const BASE_PORT = 8000 + (NVR_NUMBER * 100);
const CONFIG_DIR = `configs-nvr${NVR_NUMBER}`;
const DOCKER_COMPOSE_FILE = `docker-compose-nvr${NVR_NUMBER}-${NVR_IP}.yml`;
const BASE_IP = 10 + ((NVR_NUMBER - 1) * 33); // NVR1 starts at .11, NVR2 at .43, etc.

// Generate UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function generateConfigs() {
    console.log(`\nAttempting to probe NVR ${NVR_NUMBER} at ${NVR_IP}...`);
    console.log('Username:', USERNAME);
    console.log('');

    let probedConfig = null;
    let cameraProfiles = [];
    
    try {
        // Try to probe the NVR using ONVIF
        probedConfig = await configBuilder.createConfig(NVR_IP, USERNAME, PASSWORD);
        
        if (probedConfig && probedConfig.onvif && probedConfig.onvif.length > 0) {
            console.log(`✅ Successfully probed NVR! Found ${probedConfig.onvif.length} cameras`);
            
            // Extract camera profiles from probed config
            cameraProfiles = probedConfig.onvif;
            
            // If camera count was specified and differs from probed, show warning
            if (CAMERA_COUNT && CAMERA_COUNT !== cameraProfiles.length) {
                console.log(`⚠️  Warning: Requested ${CAMERA_COUNT} cameras but NVR reported ${cameraProfiles.length}`);
                console.log(`   Using actual count from NVR: ${cameraProfiles.length}`);
            }
        } else {
            throw new Error('No cameras found in probed configuration');
        }
    } catch (err) {
        console.log(`⚠️  Could not probe NVR: ${err.message || err}`);
        console.log('   Falling back to manual configuration...\n');
        
        // Fallback to manual configuration
        const manualCameraCount = CAMERA_COUNT || 32;
        console.log(`Using manual configuration for ${manualCameraCount} cameras`);
        
        // Create default camera profiles
        for (let i = 1; i <= manualCameraCount; i++) {
            cameraProfiles.push({
                name: `Channel ${i}`,
                highQuality: {
                    rtsp: `/cam/realmonitor?channel=${i}&subtype=0&unicast=true&proto=Onvif`,
                    snapshot: `/onvif/snapshot?channel=${i}&subtype=0`,
                    width: 2592,
                    height: 1944,
                    framerate: 12,
                    bitrate: 2048,
                    quality: 4
                },
                lowQuality: {
                    rtsp: `/cam/realmonitor?channel=${i}&subtype=1&unicast=true&proto=Onvif`,
                    snapshot: `/onvif/snapshot?channel=${i}&subtype=1`,
                    width: 352,
                    height: 288,
                    framerate: 12,
                    bitrate: 160,
                    quality: 1
                }
            });
        }
    }

    // Create config directory
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
        console.log(`\nCreated directory: ${CONFIG_DIR}`);
    }

    // Generate camera configurations
    const actualCameraCount = cameraProfiles.length;
    console.log(`\nGenerating configurations for ${actualCameraCount} cameras...`);
    console.log(`MAC address range: ${BASE_MAC}01 - ${BASE_MAC}${actualCameraCount.toString(16).padStart(2, '0')}`);
    console.log(`Port range: ${BASE_PORT + 1} - ${BASE_PORT + actualCameraCount}`);
    console.log(`IP range: 192.168.6.${BASE_IP + 1} - 192.168.6.${BASE_IP + actualCameraCount}\n`);

    for (let i = 0; i < actualCameraCount; i++) {
        const cameraNum = i + 1;
        const profile = cameraProfiles[i];
        
        const cameraConfig = {
            mac: BASE_MAC + cameraNum.toString(16).padStart(2, '0'),
            ports: {
                server: BASE_PORT + cameraNum,
                rtsp: 8554,
                snapshot: 8580
            },
            name: `NVR${NVR_NUMBER}-Camera-${cameraNum.toString().padStart(2, '0')}`,
            uuid: generateUUID(),
            highQuality: {
                rtsp: profile.highQuality.rtsp,
                snapshot: profile.highQuality.snapshot,
                width: profile.highQuality.width,
                height: profile.highQuality.height,
                framerate: profile.highQuality.framerate,
                bitrate: profile.highQuality.bitrate,
                quality: profile.highQuality.quality || 4
            },
            lowQuality: {
                rtsp: profile.lowQuality.rtsp,
                snapshot: profile.lowQuality.snapshot,
                width: profile.lowQuality.width,
                height: profile.lowQuality.height,
                framerate: profile.lowQuality.framerate,
                bitrate: profile.lowQuality.bitrate,
                quality: profile.lowQuality.quality || 1
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
        
        const configPath = path.join(CONFIG_DIR, `camera${cameraNum}.yaml`);
        fs.writeFileSync(configPath, yaml.stringify(config));
        console.log(`Created: ${configPath} (${profile.highQuality.width}x${profile.highQuality.height} @ ${profile.highQuality.framerate}fps)`);
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
    for (let i = 1; i <= actualCameraCount; i++) {
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
# Generated from ONVIF probe data

echo "Starting adoption process for NVR ${NVR_NUMBER}"
echo "This will start cameras one by one for UniFi Protect adoption"
echo ""

for i in {1..${actualCameraCount}}; do
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

    // Print summary with actual camera details if probed
    console.log(`
========================================
Setup Complete for NVR ${NVR_NUMBER}
========================================

NVR IP: ${NVR_IP}
Config Directory: ${CONFIG_DIR}
Docker Compose File: ${DOCKER_COMPOSE_FILE}
Adoption Script: ${adoptionScriptPath}
Camera Count: ${actualCameraCount}

MAC Address Range: ${BASE_MAC}01 - ${BASE_MAC}${actualCameraCount.toString(16).padStart(2, '0')}
Port Range: ${BASE_PORT + 1} - ${BASE_PORT + actualCameraCount}
IP Range: 192.168.6.${BASE_IP + 1} - 192.168.6.${BASE_IP + actualCameraCount}
`);

    if (probedConfig) {
        console.log('Camera Details (from ONVIF probe):');
        for (let i = 0; i < Math.min(5, actualCameraCount); i++) {
            const profile = cameraProfiles[i];
            console.log(`  Camera ${i + 1}: ${profile.highQuality.width}x${profile.highQuality.height} @ ${profile.highQuality.framerate}fps, ${profile.highQuality.bitrate}kb/s`);
        }
        if (actualCameraCount > 5) {
            console.log(`  ... and ${actualCameraCount - 5} more cameras`);
        }
    }

    console.log(`
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

// Run the generator
generateConfigs().catch(err => {
    console.error('Error generating configurations:', err);
    process.exit(1);
});