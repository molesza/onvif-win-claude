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

console.log(colors.bright + colors.blue + '=' .repeat(80) + colors.reset);
console.log(colors.bright + colors.blue + '   ONVIF Adoption Debug Mode - Single Camera' + colors.reset);
console.log(colors.bright + colors.blue + '=' .repeat(80) + colors.reset);
console.log('');

// Create logger with debug level
const logger = simpleLogger.createSimpleLogger();
logger.setLevel('debug'); // Show all logs including debug

// Load config
const configPath = process.argv[2] || './config.yaml';
if (!fs.existsSync(configPath)) {
    console.error(colors.red + `✗ Config file not found: ${configPath}` + colors.reset);
    process.exit(1);
}

let config;
try {
    const configData = fs.readFileSync(configPath, 'utf8');
    config = yaml.load(configData);
} catch (error) {
    console.error(colors.red + `✗ Failed to read config: ${error.message}` + colors.reset);
    process.exit(1);
}

// Start discovery
const discoveryService = new BroadcastDiscoveryService(logger);
console.log(colors.green + '► Starting discovery service...' + colors.reset);
discoveryService.start();

// Start only the first camera
const cameraConfig = config.onvif[0];
console.log('');
console.log(colors.cyan + `Testing with camera: ${cameraConfig.name}` + colors.reset);
console.log(colors.cyan + `MAC: ${cameraConfig.mac}` + colors.reset);
console.log(colors.cyan + `UUID: ${cameraConfig.uuid}` + colors.reset);
console.log('');

const server = onvifServer.createServer(cameraConfig, logger);
if (!server.getHostname()) {
    console.error(colors.red + '✗ Failed to find IP address' + colors.reset);
    process.exit(1);
}

console.log(colors.green + `► Starting ONVIF server on ${server.getHostname()}:${cameraConfig.ports.server}` + colors.reset);

// Add extra logging to the server
server.server = require('http').createServer((request, response) => {
    // Log raw request details
    console.log(colors.yellow + '\n=== Incoming Request ===' + colors.reset);
    console.log(`Method: ${request.method}`);
    console.log(`URL: ${request.url}`);
    console.log(`Headers:`, JSON.stringify(request.headers, null, 2));
    
    // Capture request body
    let body = '';
    request.on('data', chunk => {
        body += chunk.toString();
    });
    
    request.on('end', () => {
        if (body) {
            console.log(colors.cyan + 'Body (first 500 chars):' + colors.reset);
            console.log(body.substring(0, 500));
            if (body.includes('Security')) {
                console.log(colors.bright + colors.yellow + '⚠ Security/Auth element detected in request!' + colors.reset);
            }
        }
    });
    
    // Call original handler
    server.listen.call(server, request, response);
});

server.server.on('error', (err) => {
    console.error(colors.red + `Server error: ${err.message}` + colors.reset);
});

// Start the server
server.server.listen(cameraConfig.ports.server, server.getHostname());

// Setup SOAP services with extra logging
const soap = require('soap');

// Override SOAP authentication
const originalAuth = soap.BasicAuthSecurity;
soap.BasicAuthSecurity = function(username, password, defaults) {
    console.log(colors.bright + colors.green + `\n✓ BasicAuth created - Username: ${username}` + colors.reset);
    return originalAuth.call(this, username, password, defaults);
};

// Setup device service
server.deviceService = soap.listen(server.server, {
    path: '/onvif/device_service', 
    services: server.onvif,
    xml: fs.readFileSync('./wsdl/device_service.wsdl', 'utf8'),
    forceSoap12Headers: true,
    callback: () => {
        console.log(colors.green + '✓ Device service ready' + colors.reset);
    }
});

// Setup media service  
server.mediaService = soap.listen(server.server, {
    path: '/onvif/media_service',
    services: server.onvif,
    xml: fs.readFileSync('./wsdl/media_service.wsdl', 'utf8'),
    forceSoap12Headers: true,
    callback: () => {
        console.log(colors.green + '✓ Media service ready' + colors.reset);
    }
});

// Add authentication handlers
server.deviceService.on('headers', (headers, methodName) => {
    console.log(colors.yellow + `\nDevice service headers for ${methodName}:` + colors.reset);
    console.log(JSON.stringify(headers, null, 2));
});

server.mediaService.on('headers', (headers, methodName) => {
    console.log(colors.yellow + `\nMedia service headers for ${methodName}:` + colors.reset);
    console.log(JSON.stringify(headers, null, 2));
});

// Enable debug output
server.enableDebugOutput();

// Register with discovery
discoveryService.registerCamera(cameraConfig.uuid, {
    uuid: cameraConfig.uuid,
    name: cameraConfig.name,
    hostname: server.getHostname(),
    port: cameraConfig.ports.server,
    mac: cameraConfig.mac
});

// Setup proxies
if (cameraConfig.ports.rtsp && cameraConfig.target.ports.rtsp) {
    console.log(colors.green + `► Starting RTSP proxy ${cameraConfig.ports.rtsp} -> ${cameraConfig.target.hostname}:${cameraConfig.target.ports.rtsp}` + colors.reset);
    tcpProxy.createProxy(cameraConfig.ports.rtsp, cameraConfig.target.hostname, cameraConfig.target.ports.rtsp);
}

if (cameraConfig.ports.snapshot && cameraConfig.target.ports.snapshot) {
    console.log(colors.green + `► Starting snapshot proxy ${cameraConfig.ports.snapshot} -> ${cameraConfig.target.hostname}:${cameraConfig.target.ports.snapshot}` + colors.reset);
    tcpProxy.createProxy(cameraConfig.ports.snapshot, cameraConfig.target.hostname, cameraConfig.target.ports.snapshot);
}

console.log('');
console.log(colors.bright + colors.green + '✓ Camera ready for adoption!' + colors.reset);
console.log(colors.cyan + `ONVIF URL: http://${server.getHostname()}:${cameraConfig.ports.server}/onvif/device_service` + colors.reset);
console.log('');
console.log(colors.yellow + 'Monitoring all requests. Try to adopt this camera in Unifi Protect...' + colors.reset);
console.log(colors.yellow + 'Press Ctrl+C to stop.' + colors.reset);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n' + colors.yellow + 'Shutting down...' + colors.reset);
    discoveryService.unregisterCamera(cameraConfig.uuid);
    discoveryService.stop();
    process.exit(0);
});