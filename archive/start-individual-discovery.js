#!/usr/bin/env node

const fs = require('fs');
const yaml = require('js-yaml');
const onvifServer = require('./src/onvif-server');
const simpleLogger = require('simple-node-logger');
const tcpProxy = require('node-tcp-proxy');

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

function printHeader() {
    console.log(colors.bright + colors.blue + '=' .repeat(80) + colors.reset);
    console.log(colors.bright + colors.blue + '   ONVIF Servers - Individual Discovery Mode' + colors.reset);
    console.log(colors.bright + colors.blue + '=' .repeat(80) + colors.reset);
    console.log('');
}

async function main() {
    const logger = simpleLogger.createSimpleLogger();
    logger.setLevel('debug'); // Enable debug logging
    
    // Check if config file exists
    const configPath = process.argv[2] || './config.yaml';
    if (!fs.existsSync(configPath)) {
        console.error(colors.red + `✗ Config file not found: ${configPath}` + colors.reset);
        console.log(colors.yellow + 'Usage: node start-individual-discovery.js [config.yaml]' + colors.reset);
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
    
    console.log(colors.cyan + 'ℹ  This mode runs a separate discovery service on each camera\'s IP address.' + colors.reset);
    console.log(colors.cyan + '   Each camera responds to discovery requests independently.' + colors.reset);
    console.log('');
    console.log(colors.green + '► Starting ONVIF servers with individual discovery services...' + colors.reset);
    console.log('');
    
    let servers = [];
    let proxies = {};
    let successCount = 0;
    let failCount = 0;
    
    // Start each camera server
    for (let onvifConfig of config.onvif) {
        let server = onvifServer.createServer(onvifConfig, logger);
        if (server.getHostname()) {
            logger.info(`Starting ${onvifConfig.name} on ${server.getHostname()}:${onvifConfig.ports.server}`);
            
            try {
                server.startServer();
                server.startIndividualDiscovery();
                servers.push(server);
                successCount++;
                
                // Setup proxies
                if (!proxies[onvifConfig.target.hostname])
                    proxies[onvifConfig.target.hostname] = {}
                
                if (onvifConfig.ports.rtsp && onvifConfig.target.ports.rtsp)
                    proxies[onvifConfig.target.hostname][onvifConfig.ports.rtsp] = onvifConfig.target.ports.rtsp;
                if (onvifConfig.ports.snapshot && onvifConfig.target.ports.snapshot)
                    proxies[onvifConfig.target.hostname][onvifConfig.ports.snapshot] = onvifConfig.target.ports.snapshot;
                    
            } catch (err) {
                logger.error(`Failed to start ${onvifConfig.name}: ${err.message}`);
                failCount++;
            }
        } else {
            logger.error(`Failed to find IP address for MAC address ${onvifConfig.mac}`);
            failCount++;
        }
    }
    
    // Start TCP proxies
    for (let destinationAddress in proxies) {
        for (let sourcePort in proxies[destinationAddress]) {
            logger.info(`Starting tcp proxy from port ${sourcePort} to ${destinationAddress}:${proxies[destinationAddress][sourcePort]}`);
            tcpProxy.createProxy(sourcePort, destinationAddress, proxies[destinationAddress][sourcePort]);
        }
    }
    
    console.log('');
    console.log(colors.bright + colors.green + `✓ Successfully started ${successCount} cameras with individual discovery` + colors.reset);
    if (failCount > 0) {
        console.log(colors.bright + colors.red + `✗ Failed to start ${failCount} cameras` + colors.reset);
    }
    console.log('');
    console.log(colors.yellow + 'Each camera has its own discovery service on port 3702 of its IP address.' + colors.reset);
    console.log(colors.yellow + 'Cameras should appear individually in your NVR.' + colors.reset);
    console.log('');
    console.log(colors.cyan + 'Press Ctrl+C to stop all servers.' + colors.reset);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('');
        console.log(colors.yellow + 'Shutting down...' + colors.reset);
        
        // Stop all individual discovery services
        servers.forEach(server => {
            server.stopIndividualDiscovery();
        });
        
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('');
        console.log(colors.yellow + 'Shutting down...' + colors.reset);
        
        // Stop all individual discovery services
        servers.forEach(server => {
            server.stopIndividualDiscovery();
        });
        
        process.exit(0);
    });
}

// Run the main function
main().catch((error) => {
    console.error(colors.red + `✗ Fatal error: ${error.message}` + colors.reset);
    process.exit(1);
});