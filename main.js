const tcpProxy = require('node-tcp-proxy');
const onvifServer = require('./src/onvif-server');
const configBuilder = require('./src/config-builder');
const DiscoveryService = require('./src/discovery-service');
const package = require('./package.json');
const argparse = require('argparse');
const readline = require('readline');
const stream = require('stream');
const yaml = require('yaml');
const fs = require('fs');
const simpleLogger = require('simple-node-logger');

const parser = new argparse.ArgumentParser({
    description: 'Virtual Onvif Server'
});

parser.add_argument('-v', '--version', { action: 'store_true', help: 'show the version information' });
parser.add_argument('-cc', '--create-config', { action: 'store_true', help: 'create a new config' });
parser.add_argument('-d', '--debug', { action: 'store_true', help: 'show onvif requests' });
parser.add_argument('--no-discovery', { action: 'store_true', help: 'start servers without discovery service' });
parser.add_argument('config', { help: 'config filename to use', nargs: '?'});

let args = parser.parse_args();

if (args) {
    const logger = simpleLogger.createSimpleLogger();
    if (args.debug)
        logger.setLevel('trace');

    if (args.version) {
        logger.info('Version: ' + package.version);
        return;
    }

    if (args.create_config) {
        let mutableStdout = new stream.Writable({
            write: function(chunk, encoding, callback) {
                if (!this.muted || chunk.toString().includes('\n'))
                    process.stdout.write(chunk, encoding);
                callback();
            }
        });

        const rl = readline.createInterface({
            input: process.stdin,
            output: mutableStdout,
            terminal: true
        });

        mutableStdout.muted = false;
        rl.question('Onvif Server: ', (hostname) => {
            rl.question('Onvif Username: ', (username) => {
                mutableStdout.muted = true;
                process.stdout.write('Onvif Password: ');
                rl.question('', (password) => {
                    console.log('Generating config ...');
                    configBuilder.createConfig(hostname, username, password).then((config) => {
                        if (config) {
                            console.log('# ==================== CONFIG START ====================');
                            console.log(yaml.stringify(config));
                            console.log('# ===================== CONFIG END =====================');
                        } else
                        console.log('Failed to create config!');
                    });
                    rl.close();
                });
            });
        });

    } else if (args.config) {
        let configData;
        try {
            configData = fs.readFileSync(args.config, 'utf8');
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.error('File not found: ' + args.config);
                return -1;
            }
            throw error;
        }

        let config;
        try {
            config = yaml.parse(configData);
        } catch (error) {
            logger.error('Failed to read config, invalid yaml syntax.')
            return -1;
        }

        // Start the master discovery service (unless --no-discovery is set)
        let discoveryService = null;
        if (!args.no_discovery) {
            discoveryService = new DiscoveryService(logger);
            logger.info('Starting master discovery service...');
            
            // Get the main network interface IP
            const os = require('os');
            const networkInterfaces = os.networkInterfaces();
            let mainInterfaceIp = null;
            
            // Find the main interface (eth0) IP
            if (networkInterfaces['eth0']) {
                for (let iface of networkInterfaces['eth0']) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        mainInterfaceIp = iface.address;
                        break;
                    }
                }
            }
            
            logger.info(`Starting discovery on interface: ${mainInterfaceIp || 'all interfaces'}`);
            discoveryService.start(mainInterfaceIp);
            logger.info('Master discovery service started!');
            logger.info('');
        } else {
            logger.info('Discovery service disabled (--no-discovery flag set)');
            logger.info('');
        }

        let proxies = {};
        let servers = [];

        for (let onvifConfig of config.onvif) {
            let server = onvifServer.createServer(onvifConfig, logger);
            if (server.getHostname()) {
                logger.info(`Starting virtual onvif server for ${onvifConfig.name} on ${server.getHostname()}:${onvifConfig.ports.server} ...`);
                server.startServer();
                
                // Register with discovery service if enabled
                if (discoveryService) {
                    server.registerWithDiscovery(discoveryService.getRegistry());
                }
                
                if (args.debug)
                    server.enableDebugOutput();
                logger.info('  Started!');
                logger.info('');

                servers.push(server);

                if (!proxies[onvifConfig.target.hostname])
                    proxies[onvifConfig.target.hostname] = {}
                
                if (onvifConfig.ports.rtsp && onvifConfig.target.ports.rtsp)
                    proxies[onvifConfig.target.hostname][onvifConfig.ports.rtsp] = onvifConfig.target.ports.rtsp;
                if (onvifConfig.ports.snapshot && onvifConfig.target.ports.snapshot)
                    proxies[onvifConfig.target.hostname][onvifConfig.ports.snapshot] = onvifConfig.target.ports.snapshot;
            } else {
                logger.error(`Failed to find IP address for MAC address ${onvifConfig.mac}`)
                return -1;
            }
        }
        
        for (let destinationAddress in proxies) {
            for (let sourcePort in proxies[destinationAddress]) {
                logger.info(`Starting tcp proxy from port ${sourcePort} to ${destinationAddress}:${proxies[destinationAddress][sourcePort]} ...`);
                tcpProxy.createProxy(sourcePort, destinationAddress, proxies[destinationAddress][sourcePort]);
                logger.info('  Started!');
                logger.info('');
            }
        }

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            logger.info('');
            logger.info('Shutting down...');
            
            // Unregister all cameras
            if (discoveryService) {
                servers.forEach(server => {
                    server.unregisterFromDiscovery();
                });
                
                // Stop discovery service
                discoveryService.stop();
            }
            
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            logger.info('');
            logger.info('Shutting down...');
            
            // Unregister all cameras
            if (discoveryService) {
                servers.forEach(server => {
                    server.unregisterFromDiscovery();
                });
                
                // Stop discovery service
                discoveryService.stop();
            }
            
            process.exit(0);
        });

    } else {
        logger.error('Please specifiy a config filename!');
        return -1;
    }

    return 0;
}
