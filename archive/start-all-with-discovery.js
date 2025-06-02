#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m'
};

function printHeader() {
    console.log(colors.bright + colors.blue + '=' .repeat(80) + colors.reset);
    console.log(colors.bright + colors.blue + '   ONVIF Servers - Full Discovery Mode (All 32 Cameras)' + colors.reset);
    console.log(colors.bright + colors.blue + '=' .repeat(80) + colors.reset);
    console.log('');
}

async function main() {
    // Check if config file exists
    const configPath = process.argv[2] || './config.yaml';
    if (!fs.existsSync(configPath)) {
        console.error(colors.red + `✗ Config file not found: ${configPath}` + colors.reset);
        console.log(colors.yellow + 'Usage: node start-all-with-discovery.js [config.yaml]' + colors.reset);
        process.exit(1);
    }
    
    console.clear();
    printHeader();
    
    console.log(colors.yellow + '⚠  WARNING: This will start all 32 cameras with discovery enabled!' + colors.reset);
    console.log(colors.yellow + '   This may cause issues with some NVR systems that cannot handle' + colors.reset);
    console.log(colors.yellow + '   large discovery responses (>30KB).' + colors.reset);
    console.log('');
    console.log(colors.green + 'ℹ  If cameras don\'t appear in your NVR, try:' + colors.reset);
    console.log('   1. The interactive adoption tool (one camera at a time)');
    console.log('   2. The manual addition mode (no discovery)');
    console.log('');
    console.log(colors.bright + '► Starting all ONVIF servers with discovery enabled...' + colors.reset);
    console.log('');
    
    // Start the main server normally (with discovery)
    const serverProcess = spawn('node', ['main.js', configPath], {
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