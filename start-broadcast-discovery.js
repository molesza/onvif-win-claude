#!/usr/bin/env node

const fs = require('fs');
const yaml = require('js-yaml');
const onvifServer = require('./src/onvif-server');
const BroadcastDiscoveryService = require('./src/broadcast-discovery-service');
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
    console.log(colors.bright + colors.blue + '   ONVIF Servers - Broadcast Discovery Mode' + colors.reset);
    console.log(colors.bright + colors.blue + '=' .repeat(80) + colors.reset);
    console.log('');
}

async function main() {
    const logger = simpleLogger.createSimpleLogger();
    logger.setLevel('info'); // Show info level logs
    
    // Check if config file exists
    const configPath = process.argv[2] || './config.yaml';
    if (!fs.existsSync(configPath)) {
        console.error(colors.red + `✗ Config file not found: ${configPath}` + colors.reset);
        console.log(colors.yellow + 'Usage: node start-broadcast-discovery.js [config.yaml]' + colors.reset);
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
    
    console.log(colors.cyan + 'ℹ  This mode uses a single discovery listener but sends individual responses.' + colors.reset);
    console.log(colors.cyan + '   Each camera gets its own discovery response packet.' + colors.reset);
    console.log('');
    
    // Start broadcast discovery service
    const discoveryService = new BroadcastDiscoveryService(logger);
    console.log(colors.green + '► Starting broadcast discovery service...' + colors.reset);
    discoveryService.start();
    
    console.log(colors.green + '► Starting ONVIF servers...' + colors.reset);
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
                server.enableDebugOutput(); // Enable debug logging for all servers
                
                // Register with broadcast discovery
                discoveryService.registerCamera(onvifConfig.uuid, {
                    uuid: onvifConfig.uuid,
                    name: onvifConfig.name,
                    hostname: server.getHostname(),
                    port: onvifConfig.ports.server,
                    mac: onvifConfig.mac
                });
                
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
    console.log(colors.bright + colors.green + `✓ Successfully started ${successCount} cameras` + colors.reset);
    if (failCount > 0) {
        console.log(colors.bright + colors.red + `✗ Failed to start ${failCount} cameras` + colors.reset);
    }
    console.log('');
    console.log(colors.yellow + 'Discovery sends individual responses with 50ms spacing.' + colors.reset);
    console.log(colors.yellow + 'This prevents overwhelming NVRs with large responses.' + colors.reset);
    console.log('');
    console.log(colors.cyan + 'Press Ctrl+C to stop all servers.' + colors.reset);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('');
        console.log(colors.yellow + 'Shutting down...' + colors.reset);
        
        // Unregister all cameras
        config.onvif.forEach(camera => {
            discoveryService.unregisterCamera(camera.uuid);
        });
        
        // Stop discovery service
        discoveryService.stop();
        
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('');
        console.log(colors.yellow + 'Shutting down...' + colors.reset);
        
        // Unregister all cameras
        config.onvif.forEach(camera => {
            discoveryService.unregisterCamera(camera.uuid);
        });
        
        // Stop discovery service
        discoveryService.stop();
        
        process.exit(0);
    });
}

// Run the main function
main().catch((error) => {
    console.error(colors.red + `✗ Fatal error: ${error.message}` + colors.reset);
    process.exit(1);
});