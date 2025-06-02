#!/usr/bin/env node

const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

const configPath = process.argv[2] || './config.yaml';

console.log('='.repeat(80));
console.log('Port Conflict Analysis and Fix');
console.log('='.repeat(80));
console.log('');

// Load config
let config;
try {
    const configData = fs.readFileSync(configPath, 'utf8');
    config = yaml.load(configData);
} catch (error) {
    console.error(`Failed to read config: ${error.message}`);
    process.exit(1);
}

// Analyze current port usage
console.log('Current port configuration:');
console.log('-'.repeat(80));

const portUsage = {
    server: {},
    rtsp: {},
    snapshot: {}
};

let hasConflicts = false;

config.onvif.forEach((camera, index) => {
    console.log(`Camera ${index + 1}: ${camera.name}`);
    console.log(`  Server:   ${camera.ports.server}`);
    console.log(`  RTSP:     ${camera.ports.rtsp}`);
    console.log(`  Snapshot: ${camera.ports.snapshot}`);
    
    // Track port usage
    ['server', 'rtsp', 'snapshot'].forEach(type => {
        const port = camera.ports[type];
        if (!portUsage[type][port]) {
            portUsage[type][port] = [];
        }
        portUsage[type][port].push(camera.name);
    });
    
    console.log('');
});

// Check for conflicts
console.log('Port conflict analysis:');
console.log('-'.repeat(80));

['rtsp', 'snapshot'].forEach(type => {
    Object.entries(portUsage[type]).forEach(([port, cameras]) => {
        if (cameras.length > 1) {
            hasConflicts = true;
            console.log(`⚠️  ${type.toUpperCase()} port ${port} is used by ${cameras.length} cameras:`);
            cameras.forEach(cam => console.log(`    - ${cam}`));
        }
    });
});

if (!hasConflicts) {
    console.log('✓ No port conflicts found!');
    process.exit(0);
}

console.log('');
console.log('This is the issue! When multiple cameras share RTSP/snapshot ports,');
console.log('the TCP proxy can only create one instance, making all cameras');
console.log('appear to serve the same stream.');
console.log('');

// Ask user if they want to fix
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('Do you want to fix this by assigning unique ports to each camera? (y/n): ', (answer) => {
    if (answer.toLowerCase() !== 'y') {
        console.log('Exiting without changes.');
        rl.close();
        process.exit(0);
    }
    
    // Create backup
    const backupPath = configPath + '.backup-' + Date.now();
    fs.copyFileSync(configPath, backupPath);
    console.log(`\nBacked up original config to: ${backupPath}`);
    
    // Fix ports
    console.log('\nAssigning unique ports:');
    console.log('-'.repeat(80));
    
    const BASE_SERVER = 8081;
    const BASE_RTSP = 8554;
    const BASE_SNAPSHOT = 8580;
    
    config.onvif.forEach((camera, index) => {
        const newPorts = {
            server: BASE_SERVER + index,
            rtsp: BASE_RTSP + index,
            snapshot: BASE_SNAPSHOT + index
        };
        
        console.log(`Camera ${index + 1}: ${camera.name}`);
        console.log(`  Server:   ${camera.ports.server} -> ${newPorts.server}`);
        console.log(`  RTSP:     ${camera.ports.rtsp} -> ${newPorts.rtsp}`);
        console.log(`  Snapshot: ${camera.ports.snapshot} -> ${newPorts.snapshot}`);
        console.log('');
        
        camera.ports = newPorts;
    });
    
    // Save updated config
    fs.writeFileSync(configPath, yaml.dump(config));
    console.log(`Updated configuration saved to: ${configPath}`);
    console.log('');
    console.log('✓ Port conflicts resolved!');
    console.log('');
    console.log('Each camera now has unique ports, allowing separate TCP proxy instances.');
    console.log('This should allow UniFi Protect to see each camera as truly independent.');
    
    rl.close();
});