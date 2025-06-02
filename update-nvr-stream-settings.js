#!/usr/bin/env node

/**
 * Update NVR Stream Settings
 * 
 * This script updates only the stream settings (resolution, framerate, etc.) 
 * while preserving existing UUID, MAC addresses, and other configuration.
 * It can also record samples to analyze actual FPS.
 * 
 * Usage: node update-nvr-stream-settings.js <nvr-number> <nvr-ip> <username> <password> [--record-samples]
 * Example: node update-nvr-stream-settings.js 2 192.168.6.202 admin password123 --record-samples
 */

const fs = require('fs');
const yaml = require('yaml');
const path = require('path');
const { exec, spawn } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 4) {
    console.error('Usage: node update-nvr-stream-settings.js <nvr-number> <nvr-ip> <username> <password> [--record-samples]');
    console.error('Example: node update-nvr-stream-settings.js 2 192.168.6.202 admin password123 --record-samples');
    process.exit(1);
}

const NVR_NUMBER = parseInt(args[0]);
const NVR_IP = args[1];
const USERNAME = args[2];
const PASSWORD = args[3];
const RECORD_SAMPLES = args.includes('--record-samples');

const CONFIG_DIR = `configs-nvr${NVR_NUMBER}`;

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

// Parse framerate string (e.g., "25/1" -> 25)
function parseFramerate(framerateStr) {
    if (!framerateStr) return null;
    if (framerateStr.includes('/')) {
        const [num, den] = framerateStr.split('/').map(Number);
        return Math.round(num / den);
    }
    return parseInt(framerateStr);
}

// Record a sample and analyze actual FPS
async function recordAndAnalyzeFPS(channel, subtype = 0, duration = 3) {
    const rtspUrl = `rtsp://${USERNAME}:${PASSWORD}@${NVR_IP}:554/cam/realmonitor?channel=${channel}&subtype=${subtype}&unicast=true&proto=Onvif`;
    const outputFile = `/tmp/sample_ch${channel}_sub${subtype}.mp4`;
    
    try {
        console.log(`    Recording ${duration}s sample...`);
        
        // Record sample using ffmpeg
        await new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', [
                '-y',
                '-rtsp_transport', 'tcp',
                '-i', rtspUrl,
                '-t', duration.toString(),
                '-c', 'copy',
                outputFile
            ], { stdio: 'pipe' });
            
            ffmpeg.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`ffmpeg exited with code ${code}`));
            });
            
            ffmpeg.on('error', reject);
        });
        
        // Analyze the recorded file
        const cmd = `ffprobe -v error -select_streams v:0 -show_entries stream=nb_frames,duration -of default=noprint_wrappers=1 "${outputFile}"`;
        const { stdout } = await execPromise(cmd);
        
        // Parse output
        const lines = stdout.trim().split('\n');
        let frames = 0;
        let duration_sec = 0;
        
        for (const line of lines) {
            if (line.startsWith('nb_frames=')) {
                frames = parseInt(line.split('=')[1]);
            } else if (line.startsWith('duration=')) {
                duration_sec = parseFloat(line.split('=')[1]);
            }
        }
        
        const actualFPS = Math.round(frames / duration_sec);
        console.log(`    ✓ Actual FPS: ${actualFPS} (${frames} frames in ${duration_sec.toFixed(1)}s)`);
        
        // Clean up
        try {
            fs.unlinkSync(outputFile);
        } catch (e) {}
        
        return actualFPS;
    } catch (error) {
        console.log(`    ✗ Failed to record/analyze: ${error.message}`);
        return null;
    }
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
            let framerate = parseFramerate(videoStream.r_frame_rate) || parseFramerate(videoStream.avg_frame_rate);
            const bitrate = videoStream.bit_rate ? Math.round(parseInt(videoStream.bit_rate) / 1000) : null;
            
            console.log(`    ✓ Found: ${width}x${height} @ ${framerate}fps${bitrate ? `, ${bitrate}kb/s` : ''}`);
            
            // If recording samples, get actual FPS
            if (RECORD_SAMPLES && framerate > 30) { // Only check if reported FPS seems high
                const actualFPS = await recordAndAnalyzeFPS(channel, subtype);
                if (actualFPS && actualFPS !== framerate) {
                    console.log(`    📊 Using actual FPS (${actualFPS}) instead of reported (${framerate})`);
                    framerate = actualFPS;
                }
            }
            
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

// Load existing configuration
function loadExistingConfig(cameraNum) {
    const configPath = path.join(CONFIG_DIR, `camera${cameraNum}.yaml`);
    if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        return yaml.parse(content);
    }
    return null;
}

// Update stream settings while preserving other config
async function updateCameraConfig(cameraNum) {
    const existingConfig = loadExistingConfig(cameraNum);
    if (!existingConfig || !existingConfig.onvif || !existingConfig.onvif[0]) {
        console.log(`  ✗ No existing config found for camera ${cameraNum}`);
        return false;
    }
    
    const camera = existingConfig.onvif[0];
    console.log(`\nUpdating camera ${cameraNum} (${camera.name})...`);
    console.log(`  Preserving MAC: ${camera.mac}, UUID: ${camera.uuid}`);
    
    // Probe streams
    const highQuality = await probeRTSPStream(cameraNum, 0);
    const lowQuality = await probeRTSPStream(cameraNum, 1);
    
    // Update only stream settings if probed successfully
    if (highQuality) {
        camera.highQuality.width = highQuality.width;
        camera.highQuality.height = highQuality.height;
        camera.highQuality.framerate = highQuality.framerate;
        if (highQuality.bitrate) {
            camera.highQuality.bitrate = highQuality.bitrate;
        }
    }
    
    if (lowQuality) {
        camera.lowQuality.width = lowQuality.width;
        camera.lowQuality.height = lowQuality.height;
        camera.lowQuality.framerate = lowQuality.framerate;
        if (lowQuality.bitrate) {
            camera.lowQuality.bitrate = lowQuality.bitrate;
        }
    }
    
    // Save updated config
    const configPath = path.join(CONFIG_DIR, `camera${cameraNum}.yaml`);
    fs.writeFileSync(configPath, yaml.stringify(existingConfig));
    
    const updated = !!(highQuality || lowQuality);
    console.log(`  ${updated ? '✓' : '○'} Config ${updated ? 'updated' : 'unchanged'}`);
    
    return updated;
}

async function main() {
    console.log(`\nNVR Stream Settings Updater`);
    console.log(`===========================`);
    console.log(`NVR ${NVR_NUMBER} at ${NVR_IP}`);
    console.log(`Config directory: ${CONFIG_DIR}`);
    if (RECORD_SAMPLES) {
        console.log(`Recording samples for FPS analysis: YES`);
    }
    console.log('');

    // Check if config directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
        console.error(`Error: Config directory ${CONFIG_DIR} does not exist`);
        console.error('Please run generate-nvr-configs.js first to create initial configuration');
        process.exit(1);
    }

    // Count camera configs
    const configFiles = fs.readdirSync(CONFIG_DIR).filter(f => f.match(/^camera\d+\.yaml$/));
    const cameraCount = configFiles.length;
    
    console.log(`Found ${cameraCount} camera configurations to update\n`);

    // Update each camera
    let updatedCount = 0;
    for (let i = 1; i <= cameraCount; i++) {
        if (await updateCameraConfig(i)) {
            updatedCount++;
        }
    }

    console.log(`\n========================================`);
    console.log(`Update Complete`);
    console.log(`========================================`);
    console.log(`Updated: ${updatedCount} cameras`);
    console.log(`Unchanged: ${cameraCount - updatedCount} cameras`);
    
    if (updatedCount > 0) {
        console.log(`\nNext steps:`);
        console.log(`1. Restart the affected camera containers to apply changes`);
        console.log(`2. Monitor logs to ensure cameras are working correctly`);
    }
}

// Check if ffprobe is available
async function checkDependencies() {
    try {
        await execPromise('which ffprobe');
        if (RECORD_SAMPLES) {
            await execPromise('which ffmpeg');
        }
    } catch (error) {
        console.error('Error: ffprobe/ffmpeg is not installed.');
        console.error('Please install ffmpeg:');
        console.error('  sudo apt-get install ffmpeg');
        process.exit(1);
    }
}

// Run the updater
async function run() {
    await checkDependencies();
    await main();
}

run().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});