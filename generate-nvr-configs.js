#!/usr/bin/env node

/**
 * Generate Docker Compose and configuration files for multiple NVRs
 * Usage: node generate-nvr-configs.js <nvr-number> <nvr-ip>
 * Example: node generate-nvr-configs.js 2 192.168.6.202
 */

const fs = require('fs');
const yaml = require('yaml');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('Usage: node generate-nvr-configs.js <nvr-number> <nvr-ip> [camera-count]');
    console.error('Example: node generate-nvr-configs.js 2 192.168.6.202 16');
    process.exit(1);
}

const NVR_NUMBER = parseInt(args[0]);
const NVR_IP = args[1];
const CAMERA_COUNT = args[2] ? parseInt(args[2]) : 32; // Default to 32 if not specified

if (NVR_NUMBER < 1 || NVR_NUMBER > 6) {
    console.error('NVR number must be between 1 and 6');
    process.exit(1);
}

// Configuration settings
const BASE_MAC = `a2:a2:a2:a2:${NVR_NUMBER.toString().padStart(2, '0')}:`;
const BASE_PORT = 8000 + (NVR_NUMBER * 100);
const CONFIG_DIR = `configs-nvr${NVR_NUMBER}`;
const DOCKER_COMPOSE_FILE = `docker-compose-nvr${NVR_NUMBER}-${NVR_IP}.yml`;
const BASE_IP = 10 + ((NVR_NUMBER - 1) * 33); // NVR1 starts at .11, NVR2 at .43 (11+32), etc.

// Create config directory
if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    console.log(`Created directory: ${CONFIG_DIR}`);
}

// Generate UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Generate camera configurations
console.log(`\nGenerating camera configurations for NVR ${NVR_NUMBER} (${NVR_IP})...`);
console.log(`Number of cameras: ${CAMERA_COUNT}`);
console.log(`MAC address range: ${BASE_MAC}01 - ${BASE_MAC}${CAMERA_COUNT.toString(16).padStart(2, '0')}`);
console.log(`Port range: ${BASE_PORT + 1} - ${BASE_PORT + CAMERA_COUNT}`);
console.log(`IP range: 192.168.6.${BASE_IP + 1} - 192.168.6.${BASE_IP + CAMERA_COUNT}\n`);

for (let i = 1; i <= CAMERA_COUNT; i++) {
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
    console.log(`Created: ${configPath}`);
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

MAC Address Range: ${BASE_MAC}01 - ${BASE_MAC}20
Port Range: ${BASE_PORT + 1} - ${BASE_PORT + 32}

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