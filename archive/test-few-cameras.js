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
console.log(colors.bright + colors.blue + '   Test Multiple Cameras (Limited Set)' + colors.reset);
console.log(colors.bright + colors.blue + '=' .repeat(80) + colors.reset);
console.log('');

const configPath = process.argv[2] || './config.yaml';
const numCameras = parseInt(process.argv[3]) || 3;

if (!fs.existsSync(configPath)) {
    console.error(colors.red + `Config file not found: ${configPath}` + colors.reset);
    console.log(colors.yellow + 'Usage: node test-few-cameras.js [config.yaml] [number]' + colors.reset);
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

// Create limited config
const limitedConfig = {
    onvif: config.onvif.slice(0, numCameras)
};

console.log(colors.cyan + `Testing with ${numCameras} cameras:` + colors.reset);
limitedConfig.onvif.forEach((cam, i) => {
    console.log(`  ${i+1}. ${cam.name} (${cam.mac})`);
});
console.log('');

// Write temporary config
const tempConfig = '.temp-test-config.yaml';
fs.writeFileSync(tempConfig, yaml.dump(limitedConfig));

console.log(colors.green + '► Starting broadcast discovery mode with limited cameras...' + colors.reset);
console.log('');

// Start the server
const server = spawn('node', ['start-broadcast-discovery.js', tempConfig], {
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