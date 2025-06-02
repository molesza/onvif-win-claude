#!/usr/bin/env node

const fs = require('fs');
const yaml = require('js-yaml');
const { spawn } = require('child_process');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m'
};

console.log(colors.bright + colors.blue + '=' .repeat(80) + colors.reset);
console.log(colors.bright + colors.blue + '   Test Specific Camera Range' + colors.reset);
console.log(colors.bright + colors.blue + '=' .repeat(80) + colors.reset);
console.log('');

const configPath = process.argv[2] || './config.yaml';
const startIndex = parseInt(process.argv[3]) || 1;
const count = parseInt(process.argv[4]) || 5;

if (!fs.existsSync(configPath)) {
    console.error(colors.red + `Config file not found: ${configPath}` + colors.reset);
    console.log(colors.yellow + 'Usage: node test-camera-range.js [config.yaml] [start_index] [count]' + colors.reset);
    console.log(colors.yellow + 'Example: node test-camera-range.js config.yaml 11 5' + colors.reset);
    console.log(colors.yellow + '(This would test cameras 11-15)' + colors.reset);
    process.exit(1);
}

// Load config
let config;
try {
    const configData = fs.readFileSync(configPath, 'utf8');
    config = yaml.load(configData);
} catch (error) {
    console.error(colors.red + `Failed to read config: ${error.message}` + colors.reset);
    process.exit(1);
}

// Validate range
const totalCameras = config.onvif.length;
if (startIndex < 1 || startIndex > totalCameras) {
    console.error(colors.red + `Invalid start index: ${startIndex}. Must be between 1 and ${totalCameras}` + colors.reset);
    process.exit(1);
}

const endIndex = Math.min(startIndex + count - 1, totalCameras);
const actualCount = endIndex - startIndex + 1;

// Create config with selected range (convert to 0-based index)
const rangeConfig = {
    onvif: config.onvif.slice(startIndex - 1, endIndex)
};

console.log(colors.cyan + `Testing cameras ${startIndex} through ${endIndex} (${actualCount} cameras):` + colors.reset);
rangeConfig.onvif.forEach((cam, i) => {
    console.log(`  ${startIndex + i}. ${cam.name} (${cam.mac})`);
});
console.log('');

// Write temporary config
const tempConfig = '.temp-range-config.yaml';
fs.writeFileSync(tempConfig, yaml.dump(rangeConfig));

console.log(colors.green + '► Starting servers with proper proxies...' + colors.reset);
console.log('');

// Start the server with proper proxies
const server = spawn('node', ['start-proper-proxies.js', tempConfig], {
    cwd: __dirname,
    stdio: 'inherit'
});

server.on('error', (error) => {
    console.error(colors.red + `Failed to start: ${error.message}` + colors.reset);
    cleanup();
});

server.on('exit', (code) => {
    cleanup();
    process.exit(code || 0);
});

function cleanup() {
    if (fs.existsSync(tempConfig)) {
        fs.unlinkSync(tempConfig);
    }
}

process.on('SIGINT', () => {
    console.log('\n' + colors.yellow + 'Shutting down...' + colors.reset);
    cleanup();
});