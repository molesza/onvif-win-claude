#!/usr/bin/env node

const fs = require('fs');
const yaml = require('js-yaml');
const { spawn } = require('child_process');
const os = require('os');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

function getIpAddressFromMac(macAddress) {
    let networkInterfaces = os.networkInterfaces();
    for (let interface in networkInterfaces)
        for (let network of networkInterfaces[interface])
            if (network.family == 'IPv4' && network.mac.toLowerCase() == macAddress.toLowerCase())
                return network.address;
    return null;
}

function printHeader() {
    console.log(colors.bright + colors.blue + '=' .repeat(80) + colors.reset);
    console.log(colors.bright + colors.blue + '   ONVIF Servers - Manual Addition Mode (No Discovery)' + colors.reset);
    console.log(colors.bright + colors.blue + '=' .repeat(80) + colors.reset);
    console.log('');
}

function printCameraTable(cameras) {
    console.log(colors.bright + colors.cyan + 'Camera Connection Information:' + colors.reset);
    console.log(colors.bright + '─'.repeat(80) + colors.reset);
    console.log(colors.bright + 
        'Ch'.padEnd(4) + 
        'Camera Name'.padEnd(30) + 
        'IP Address'.padEnd(16) + 
        'Port'.padEnd(6) + 
        'ONVIF URL' + 
        colors.reset
    );
    console.log('─'.repeat(80));
    
    cameras.forEach((camera, index) => {
        const ip = camera.hostname || getIpAddressFromMac(camera.mac);
        if (ip) {
            console.log(
                colors.yellow + (index + 1).toString().padEnd(4) + colors.reset +
                camera.name.padEnd(30) +
                colors.green + ip.padEnd(16) + colors.reset +
                camera.ports.server.toString().padEnd(6) +
                colors.cyan + `http://${ip}:${camera.ports.server}/onvif/device_service` + colors.reset
            );
        } else {
            console.log(
                colors.yellow + (index + 1).toString().padEnd(4) + colors.reset +
                camera.name.padEnd(30) +
                colors.red + 'No IP found for MAC: ' + camera.mac + colors.reset
            );
        }
    });
    console.log('─'.repeat(80));
}


async function main() {
    // Check if config file exists
    const configPath = process.argv[2] || './config.yaml';
    if (!fs.existsSync(configPath)) {
        console.error(colors.red + `✗ Config file not found: ${configPath}` + colors.reset);
        console.log(colors.yellow + 'Usage: node start-without-discovery.js [config.yaml]' + colors.reset);
        process.exit(1);
    }
    
    // Load configuration
    let config;
    try {
        const configData = fs.readFileSync(configPath, 'utf8');
        config = yaml.load(configData);
    } catch (error) {
        console.error(colors.red + `✗ Failed to read config file: ${error.message}` + colors.reset);
        process.exit(1);
    }
    
    console.clear();
    printHeader();
    
    // Display camera information
    printCameraTable(config.onvif);
    
    console.log('');
    console.log(colors.yellow + 'ℹ To add cameras manually in Unifi Protect:' + colors.reset);
    console.log('  1. Go to Unifi Protect > Settings > Devices');
    console.log('  2. Click "Add Device" > "Add by IP Address"');
    console.log('  3. Enter the IP address and port from above');
    console.log('  4. Select "ONVIF" as the protocol');
    console.log('  5. Enter your camera credentials');
    console.log('');
    
    console.log(colors.green + '► Starting all ONVIF servers without discovery...' + colors.reset);
    console.log('');
    
    // Start the main server with --no-discovery flag
    const serverProcess = spawn('node', ['main.js', '--no-discovery', configPath], {
        cwd: __dirname,
        stdio: 'inherit'
    });
    
    serverProcess.on('error', (error) => {
        console.error(colors.red + `✗ Failed to start server: ${error.message}` + colors.reset);
        process.exit(1);
    });
    
    serverProcess.on('exit', (code) => {
        process.exit(code || 0);
    });
}

// Handle cleanup on exit
process.on('SIGINT', () => {
    console.log('');
    console.log(colors.yellow + 'ℹ Shutting down...' + colors.reset);
    process.exit(0);
});

// Run the main function
main().catch((error) => {
    console.error(colors.red + `✗ Fatal error: ${error.message}` + colors.reset);
    process.exit(1);
});