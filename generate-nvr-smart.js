#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const yaml = require('js-yaml');
const execPromise = promisify(exec);

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 4) {
    console.error('Usage: node generate-nvr-smart.js <NVR_IP> <USERNAME> <PASSWORD> <NVR_NAME>');
    console.error('Example: node generate-nvr-smart.js 192.168.6.204 admin password123 nvr3');
    process.exit(1);
}

const [NVR_IP, USERNAME, PASSWORD, NVR_NAME] = args;

// Function to find the highest IP in use
async function findHighestUsedIP() {
    try {
        const { stdout } = await execPromise('docker network inspect onvif-test_onvif_net | grep -E "\\"IPv4Address\\":" | grep -oE "192\\.168\\.6\\.[0-9]+" | sort -V | tail -1');
        const lastIP = stdout.trim();
        if (lastIP) {
            const parts = lastIP.split('.');
            return parseInt(parts[3]);
        }
    } catch (error) {
        console.log('No existing containers found, starting from default');
    }
    return 10; // Default starting point if no containers exist
}

// Function to probe RTSP stream
async function probeRTSPStream(channel, subtype = 0) {
    const rtspUrl = `rtsp://${USERNAME}:${PASSWORD}@${NVR_IP}:554/cam/realmonitor?channel=${channel}&subtype=${subtype}&unicast=true&proto=Onvif`;
    
    try {
        const cmd = `ffprobe -v quiet -print_format json -show_streams "${rtspUrl}"`;
        const { stdout } = await execPromise(cmd, { timeout: 10000 });
        const data = JSON.parse(stdout);
        
        if (data.streams && data.streams.length > 0) {
            const videoStream = data.streams.find(s => s.codec_type === 'video');
            if (videoStream) {
                // Parse framerate - handle both fraction and decimal formats
                let fps = 15; // Default
                if (videoStream.r_frame_rate) {
                    fps = eval(videoStream.r_frame_rate);
                } else if (videoStream.avg_frame_rate) {
                    fps = eval(videoStream.avg_frame_rate);
                }
                
                // If fps is 100, assume it's actually 15
                if (fps === 100 || fps > 30) {
                    fps = 15;
                }
                
                return {
                    width: videoStream.width,
                    height: videoStream.height,
                    fps: fps,
                    codec: videoStream.codec_name
                };
            }
        }
    } catch (error) {
        // Silent fail - camera might not be active
    }
    
    return null;
}

// Function to probe NVR and find active channels
async function probeNVR() {
    console.log(`Probing ${NVR_NAME.toUpperCase()} at ${NVR_IP}...`);
    console.log('This may take a few minutes...\n');
    
    const channels = {};
    
    // Test up to 64 channels (common max)
    for (let channel = 1; channel <= 64; channel++) {
        process.stdout.write(`Checking channel ${channel}... `);
        
        const mainStream = await probeRTSPStream(channel, 0);
        const subStream = await probeRTSPStream(channel, 1);
        
        if (mainStream) {
            channels[channel] = {
                main: mainStream,
                sub: subStream
            };
            console.log(`Active - ${mainStream.width}x${mainStream.height}@${mainStream.fps}fps`);
        } else {
            console.log('Not active');
            // After 3 consecutive inactive channels, assume we've found all
            if (channel > 3 && !channels[channel] && !channels[channel-1] && !channels[channel-2]) {
                console.log('\nNo more active channels found.');
                break;
            }
        }
    }
    
    return channels;
}

// Function to generate UUID
function generateUUID() {
    return crypto.randomUUID();
}

// Function to determine base port for NVR
function getBasePort(nvrName) {
    const portMap = {
        'nvr1': 8081,
        'nvr2': 8201,
        'nvr3': 8301,
        'nvr4': 8401,
        'nvr5': 8501
    };
    return portMap[nvrName.toLowerCase()] || 8601;
}

// Function to generate MAC prefix
function getMACPrefix(nvrName) {
    const macMap = {
        'nvr1': 'a1:a1:a1:a1:01:',
        'nvr2': 'a2:a2:a2:a2:02:',
        'nvr3': 'a3:a3:a3:a3:03:',
        'nvr4': 'a4:a4:a4:a4:04:',
        'nvr5': 'a5:a5:a5:a5:05:'
    };
    return macMap[nvrName.toLowerCase()] || 'a6:a6:a6:a6:06:';
}

// Function to generate camera configuration
function generateCameraConfig(cameraNum, channelInfo, basePort, macPrefix) {
    const paddedNum = cameraNum.toString().padStart(2, '0');
    const hexNum = cameraNum.toString(16).padStart(2, '0');
    
    // Use probed resolution or defaults
    let width = 1920;
    let height = 1080;
    let framerate = 15;
    
    if (channelInfo && channelInfo.main) {
        width = channelInfo.main.width;
        height = channelInfo.main.height;
        framerate = channelInfo.main.fps;
    }
    
    const config = {
        onvif: [{
            mac: `${macPrefix}${hexNum}`,
            ports: {
                server: basePort + (cameraNum - 1),
                rtsp: 8554,
                snapshot: 8580
            },
            name: `${NVR_NAME.toUpperCase()}-Camera-${paddedNum}`,
            uuid: generateUUID(),
            highQuality: {
                rtsp: `/cam/realmonitor?channel=${cameraNum}&subtype=0&unicast=true&proto=Onvif`,
                snapshot: `/onvif/snapshot?channel=${cameraNum}&subtype=0`,
                width: width,
                height: height,
                framerate: framerate,
                bitrate: 2048,
                quality: 4
            },
            lowQuality: {
                rtsp: `/cam/realmonitor?channel=${cameraNum}&subtype=1&unicast=true&proto=Onvif`,
                snapshot: `/onvif/snapshot?channel=${cameraNum}&subtype=1`,
                width: 352,
                height: 288,
                framerate: framerate,
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

// Function to generate docker-compose
function generateDockerCompose(cameraCount, startingIP, nvrName) {
    let compose = `version: '3.8'

services:
`;

    for (let i = 1; i <= cameraCount; i++) {
        const ipAddress = `192.168.6.${startingIP + i - 1}`;
        compose += `  ${nvrName}-camera${i}:
    image: onvif-server
    container_name: onvif-${nvrName}-camera${i}
    build: .
    networks:
      onvif-test_onvif_net:
        ipv4_address: ${ipAddress}
    volumes:
      - ./configs-${nvrName}/camera${i}.yaml:/onvif.yaml:ro
    restart: unless-stopped

`;
    }

    compose += `networks:
  onvif-test_onvif_net:
    external: true
`;

    return compose;
}

// Main function
async function main() {
    try {
        // Find the highest IP in use
        const highestIP = await findHighestUsedIP();
        const startingIP = highestIP + 1;
        
        console.log(`Current highest IP in use: 192.168.6.${highestIP}`);
        console.log(`${NVR_NAME.toUpperCase()} will start at: 192.168.6.${startingIP}\n`);
        
        // Probe the NVR
        const channels = await probeNVR();
        const cameraCount = Object.keys(channels).length;
        
        if (cameraCount === 0) {
            console.error('No active channels found!');
            process.exit(1);
        }
        
        console.log(`\n=== ${NVR_NAME.toUpperCase()} Summary ===`);
        console.log(`Active channels: ${cameraCount}`);
        console.log(`IP range: 192.168.6.${startingIP} - 192.168.6.${startingIP + cameraCount - 1}`);
        
        // Get configuration parameters
        const basePort = getBasePort(NVR_NAME);
        const macPrefix = getMACPrefix(NVR_NAME);
        
        // Create configs directory
        const configDir = path.join(__dirname, `configs-${NVR_NAME}`);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir);
        }
        
        // Generate individual camera configs
        console.log(`\nGenerating configurations...`);
        for (const [channelStr, channelInfo] of Object.entries(channels)) {
            const channel = parseInt(channelStr);
            const config = generateCameraConfig(channel, channelInfo, basePort, macPrefix);
            const yamlContent = yaml.dump(config, { lineWidth: -1 });
            const filename = path.join(configDir, `camera${channel}.yaml`);
            
            fs.writeFileSync(filename, yamlContent);
            console.log(`Created ${filename}`);
        }
        
        // Generate docker-compose
        const dockerComposeFile = `docker-compose-${NVR_NAME}-${NVR_IP}.yml`;
        const dockerComposeContent = generateDockerCompose(cameraCount, startingIP, NVR_NAME);
        fs.writeFileSync(dockerComposeFile, dockerComposeContent);
        console.log(`\nCreated ${dockerComposeFile}`);
        
        console.log('\n=== Setup Complete! ===');
        console.log(`Generated ${cameraCount} camera configurations`);
        console.log(`\nTo start the containers:`);
        console.log(`  docker compose -f ${dockerComposeFile} up -d`);
        
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();