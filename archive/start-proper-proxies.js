#!/usr/bin/env node

const fs = require('fs');
const yaml = require('js-yaml');
const onvifServer = require('./src/onvif-server');
const BroadcastDiscoveryService = require('./src/broadcast-discovery-service');
const simpleLogger = require('simple-node-logger');
const net = require('net');

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
    console.log(colors.bright + colors.blue + '   ONVIF Servers - With Proper Per-Camera Proxies' + colors.reset);
    console.log(colors.bright + colors.blue + '=' .repeat(80) + colors.reset);
    console.log('');
}

// Create a TCP proxy that binds to a specific IP
function createBoundProxy(sourceIP, sourcePort, targetHost, targetPort, logger) {
    const server = net.createServer((clientSocket) => {
        logger.debug(`Proxy connection from ${clientSocket.remoteAddress} to ${sourceIP}:${sourcePort}`);
        
        const targetSocket = net.createConnection({
            host: targetHost,
            port: targetPort
        });
        
        targetSocket.on('connect', () => {
            logger.debug(`Connected to target ${targetHost}:${targetPort}`);
        });
        
        // Pipe data between client and target
        clientSocket.pipe(targetSocket);
        targetSocket.pipe(clientSocket);
        
        // Handle errors
        clientSocket.on('error', (err) => {
            logger.debug(`Client socket error: ${err.message}`);
            targetSocket.destroy();
        });
        
        targetSocket.on('error', (err) => {
            logger.debug(`Target socket error: ${err.message}`);
            clientSocket.destroy();
        });
        
        // Clean up on close
        clientSocket.on('close', () => {
            targetSocket.destroy();
        });
        
        targetSocket.on('close', () => {
            clientSocket.destroy();
        });
    });
    
    server.listen(sourcePort, sourceIP, () => {
        logger.info(`TCP proxy listening on ${sourceIP}:${sourcePort} -> ${targetHost}:${targetPort}`);
    });
    
    server.on('error', (err) => {
        logger.error(`Proxy error on ${sourceIP}:${sourcePort}: ${err.message}`);
    });
    
    return server;
}

async function main() {
    const logger = simpleLogger.createSimpleLogger();
    logger.setLevel('info');
    
    // Check if config file exists
    const configPath = process.argv[2] || './config.yaml';
    if (!fs.existsSync(configPath)) {
        console.error(colors.red + `✗ Config file not found: ${configPath}` + colors.reset);
        console.log(colors.yellow + 'Usage: node start-proper-proxies.js [config.yaml]' + colors.reset);
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
    
    console.log(colors.cyan + 'ℹ  This mode creates separate TCP proxies for each camera IP.' + colors.reset);
    console.log(colors.cyan + '   Each camera\'s RTSP and snapshot ports are bound to its own IP.' + colors.reset);
    console.log('');
    
    // Start broadcast discovery service
    const discoveryService = new BroadcastDiscoveryService(logger);
    console.log(colors.green + '► Starting broadcast discovery service...' + colors.reset);
    discoveryService.start();
    
    console.log(colors.green + '► Starting ONVIF servers...' + colors.reset);
    console.log('');
    
    let servers = [];
    let allProxies = [];
    let successCount = 0;
    let failCount = 0;
    
    // Start each camera server
    for (let onvifConfig of config.onvif) {
        let server = onvifServer.createServer(onvifConfig, logger);
        if (server.getHostname()) {
            const cameraIP = server.getHostname();
            logger.info(`Starting ${onvifConfig.name} on ${cameraIP}:${onvifConfig.ports.server}`);
            
            try {
                server.startServer();
                server.enableDebugOutput();
                
                // Register with broadcast discovery
                discoveryService.registerCamera(onvifConfig.uuid, {
                    uuid: onvifConfig.uuid,
                    name: onvifConfig.name,
                    hostname: cameraIP,
                    port: onvifConfig.ports.server,
                    mac: onvifConfig.mac
                });
                
                // Create proxies bound to this camera's IP
                if (onvifConfig.ports.rtsp && onvifConfig.target.ports.rtsp) {
                    const rtspProxy = createBoundProxy(
                        cameraIP,
                        onvifConfig.ports.rtsp,
                        onvifConfig.target.hostname,
                        onvifConfig.target.ports.rtsp,
                        logger
                    );
                    allProxies.push(rtspProxy);
                }
                
                if (onvifConfig.ports.snapshot && onvifConfig.target.ports.snapshot) {
                    const snapshotProxy = createBoundProxy(
                        cameraIP,
                        onvifConfig.ports.snapshot,
                        onvifConfig.target.hostname,
                        onvifConfig.target.ports.snapshot,
                        logger
                    );
                    allProxies.push(snapshotProxy);
                }
                
                servers.push(server);
                successCount++;
                
            } catch (err) {
                logger.error(`Failed to start ${onvifConfig.name}: ${err.message}`);
                failCount++;
            }
        } else {
            logger.error(`Failed to find IP address for MAC address ${onvifConfig.mac}`);
            failCount++;
        }
    }
    
    console.log('');
    console.log(colors.bright + colors.green + `✓ Successfully started ${successCount} cameras` + colors.reset);
    if (failCount > 0) {
        console.log(colors.bright + colors.red + `✗ Failed to start ${failCount} cameras` + colors.reset);
    }
    console.log('');
    console.log(colors.yellow + 'Each camera has its own RTSP/snapshot proxy on its specific IP.' + colors.reset);
    console.log(colors.yellow + 'This ensures true isolation between cameras.' + colors.reset);
    console.log('');
    console.log(colors.cyan + 'Press Ctrl+C to stop all servers.' + colors.reset);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('');
        console.log(colors.yellow + 'Shutting down...' + colors.reset);
        
        // Close all proxies
        allProxies.forEach(proxy => {
            proxy.close();
        });
        
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
        
        // Close all proxies
        allProxies.forEach(proxy => {
            proxy.close();
        });
        
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