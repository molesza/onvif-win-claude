const soap = require('soap');
const http = require('http');
const url = require('url');
const fs = require('fs');
const os = require('os');
const IndividualDiscoveryService = require('./individual-discovery-service');

Date.prototype.stdTimezoneOffset = function() {
    let jan = new Date(this.getFullYear(), 0, 1);
    let jul = new Date(this.getFullYear(), 6, 1);
    return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
}

Date.prototype.isDstObserved = function() {
    return this.getTimezoneOffset() < this.stdTimezoneOffset();
}

function getIpAddressFromMac(macAddress) {
    let networkInterfaces = os.networkInterfaces();
    
    // In Docker containers, the MAC address might not match, so try to get the first non-loopback IPv4 address
    for (let interface in networkInterfaces) {
        for (let network of networkInterfaces[interface]) {
            if (network.family == 'IPv4' && !network.internal && network.address !== '127.0.0.1') {
                return network.address;
            }
        }
    }
    
    // Fallback to original MAC matching logic
    for (let interface in networkInterfaces) {
        for (let network of networkInterfaces[interface]) {
            if (network.family == 'IPv4' && network.mac.toLowerCase() == macAddress.toLowerCase()) {
                return network.address;
            }
        }
    }
    
    return null;
}

class OnvifServer {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.cameraRegistry = null;
        this.individualDiscovery = null;

        if (!this.config.hostname)
            this.config.hostname = getIpAddressFromMac(this.config.mac);

        this.videoSource = {
            attributes: {
                token: 'video_src_token'
            },
            Framerate: this.config.highQuality.framerate,
            Resolution: { Width: this.config.highQuality.width, Height: this.config.highQuality.height }
        };
    
        this.profiles = [
            {
                Name: 'MainStream',
                attributes: {
                    token: 'main_stream'
                },
                VideoSourceConfiguration: {
                    Name: 'VideoSource',
                    UseCount: 2,
                    attributes: {
                        token: 'video_src_config_token'
                    },
                    SourceToken: 'video_src_token',
                    Bounds: { attributes: { x: 0, y: 0, width: this.config.highQuality.width, height: this.config.highQuality.height } }
                },
                VideoEncoderConfiguration: {
                    attributes: {
                        token: 'encoder_hq_config_token'
                    },
                    Name: 'CardinalHqCameraConfiguration',
                    UseCount: 1,
                    Encoding: 'H264',
                    Resolution: {
                        Width: this.config.highQuality.width,
                        Height: this.config.highQuality.height
                    },
                    Quality: this.config.highQuality.quality,
                    RateControl: {
                        FrameRateLimit: this.config.highQuality.framerate,
                        EncodingInterval: 1,
                        BitrateLimit: this.config.highQuality.bitrate
                    },
                    H264: {
                        GovLength: this.config.highQuality.framerate,
                        H264Profile: 'Main'
                    },
                    SessionTimeout: 'PT1000S'
                }
            }
        ];

        if (this.config.lowQuality) {
            this.profiles.push(
                {
                    Name: 'SubStream',
                    attributes: {
                        token: 'sub_stream'
                    },
                    VideoSourceConfiguration: {
                        Name: 'VideoSource',
                        UseCount: 2,
                        attributes: {
                            token: 'video_src_config_token'
                        },
                        SourceToken: 'video_src_token',
                        Bounds: { attributes: { x: 0, y: 0, width: this.config.highQuality.width, height: this.config.highQuality.height } }
                    },
                    VideoEncoderConfiguration: {
                        attributes: {
                            token: 'encoder_lq_config_token'
                        },
                        Name: 'CardinalLqCameraConfiguration',
                        UseCount: 1,
                        Encoding: 'H264',
                        Resolution: {
                            Width: this.config.lowQuality.width,
                            Height: this.config.lowQuality.height
                        },
                        Quality: this.config.lowQuality.quality,
                        RateControl: {
                            FrameRateLimit: this.config.lowQuality.framerate,
                            EncodingInterval: 1,
                            BitrateLimit: this.config.lowQuality.bitrate
                        },
                        H264: {
                            GovLength: this.config.lowQuality.framerate,
                            H264Profile: 'Main'
                        },
                        SessionTimeout: 'PT1000S'
                    }
                }
            );
        }
        
        this.onvif = {
            DeviceService: {
                Device: {
                    GetSystemDateAndTime: (args) => {
                        let now = new Date();
            
                        let offset = now.getTimezoneOffset();
                        let abs_offset = Math.abs(offset);
                        let hrs_offset = Math.floor(abs_offset / 60);
                        let mins_offset = (abs_offset % 60);
                        let tz = 'UTC' + (offset < 0 ? '-' : '+') + hrs_offset + (mins_offset === 0 ? '' : ':' + mins_offset);
            
                        return {
                            SystemDateAndTime: {
                                DateTimeType: 'NTP',
                                DaylightSavings: now.isDstObserved(),
                                TimeZone: {
                                    TZ: tz
                                },
                                UTCDateTime: {
                                    Time: { Hour: now.getUTCHours(), Minute: now.getUTCMinutes(), Second: now.getUTCSeconds() },
                                    Date: { Year: now.getUTCFullYear(), Month: now.getUTCMonth() + 1, Day: now.getUTCDate() }
                                },
                                LocalDateTime: {
                                    Time: { Hour: now.getHours(), Minute: now.getMinutes(), Second: now.getSeconds() },
                                    Date: { Year: now.getFullYear(), Month: now.getMonth() + 1, Day: now.getDate() }
                                },
                                Extension: {}
                            }
                        };
                    },
        
                    GetCapabilities: (args) => {
                        
// Make capabilities unique per camera
const cameraNum = this.config.name.match(/Channel(\d+)/)?.[1] || '1';
const cameraVersion = `1.${cameraNum}.0`;

                        let response = {
                            Capabilities: {}
                        };
                
                        if (args.Category === undefined || args.Category == 'All' || args.Category == 'Device') {
                            response.Capabilities['Device'] = {
                                XAddr: `http://${this.config.hostname}:${this.config.ports.server}/onvif/device_service`,
                                Network: {
                                    IPFilter: false,
                                    ZeroConfiguration: false,
                                    IPVersion6: false,
                                    DynDNS: false,
                                    Extension: {
                                        Dot11Configuration: false,
                                        Extension: {}
                                    }
                                },
                                System: {
                                    DiscoveryResolve: false,
                                    DiscoveryBye: false,
                                    RemoteDiscovery: false,
                                    SystemBackup: false,
                                    SystemLogging: false,
                                    FirmwareUpgrade: false,
                                    SupportedVersions: {
                                        Major: 2,
                                        Minor: parseInt(cameraNum) || 1
                                    },
                                    Extension: {
                                        HttpFirmwareUpgrade: false,
                                        HttpSystemBackup: false,
                                        HttpSystemLogging: false,
                                        HttpSupportInformation: false,
                                        Extension: {}
                                    }
                                },
                                IO: {
                                    InputConnectors: 0,
                                    RelayOutputs: 1,
                                    Extension: {
                                        Auxiliary: false,
                                        AuxiliaryCommands: '',
                                        Extension: {}
                                    }
                                },
                                Security: {
                                    'TLS1.1': false,
                                    'TLS1.2': false,
                                    OnboardKeyGeneration: false,
                                    AccessPolicyConfig: false,
                                    'X.509Token': false,
                                    SAMLToken: false,
                                    KerberosToken: false,
                                    RELToken: false,
                                    Extension: {
                                        'TLS1.0': false,
                                        Extension: {
                                            Dot1X: false,
                                            RemoteUserHandling: false
                                        }
                                    }
                                },
                                Extension: {}
                            };
                        }
                        if (args.Category === undefined || args.Category == 'All' || args.Category == 'Media') {
                            response.Capabilities['Media'] = {
                                XAddr: `http://${this.config.hostname}:${this.config.ports.server}/onvif/media_service`,
                                StreamingCapabilities: {
                                    RTPMulticast: false,
                                    RTP_TCP: true,
                                    RTP_RTSP_TCP: true,
                                    Extension: {}
                                },
                                Extension: {
                                    ProfileCapabilities: {
                                        MaximumNumberOfProfiles: this.profiles.length
                                    }
                                }
                            }
                        }

                        return response;
                    },
        
                    GetServices: (args) => {
                        return {
                            Service : [
                                {
                                    Namespace : 'http://www.onvif.org/ver10/device/wsdl',
                                    XAddr : `http://${this.config.hostname}:${this.config.ports.server}/onvif/device_service`,
                                    Version : { 
                                        Major : 2,
                                        Minor : 5,
                                    }
                                },
                                { 
                                    Namespace : 'http://www.onvif.org/ver10/media/wsdl',
                                    XAddr : `http://${this.config.hostname}:${this.config.ports.server}/onvif/media_service`,
                                    Version : { 
                                        Major : 2,
                                        Minor : 5,
                                    }
                                }
                            ]
                        };
                    },
                
                    GetDeviceInformation: (args) => {
                        // Extract camera number from name (e.g., VideoSourceConfig_Channel11 -> 11)
                        const cameraNum = this.config.name.match(/Channel(\d+)/)?.[1] || '1';
                        const uniqueId = require('crypto').createHash('sha256')
                            .update(`camera${cameraNum}-unique`)
                            .digest('hex').substring(0, 6);
                        
                        return {
                            Manufacturer: `CamVendor${cameraNum}`,
                            Model: `ProCam-${uniqueId}`,
                            FirmwareVersion: `${cameraNum}.0.${uniqueId.substring(0,2)}`,
                            SerialNumber: this.config.uuid || `SN-${this.config.mac.replace(/:/g, '')}`,
                            HardwareId: `HW-${this.config.mac.replace(/:/g, '')}-${uniqueId}`
                        };
                    }
                
                }
            },
        
            MediaService: {
                Media: {
                    GetProfiles: (args) => {
                        return {
                            Profiles: this.profiles
                        };
                    },
        
                    GetVideoSources: (args) => {
                        return {
                            VideoSources: [
                                this.videoSource
                            ]
                        };
                    },
        
                    GetSnapshotUri: (args) => {
                        let uri = `http://${this.config.hostname}:${this.config.ports.server}/snapshot.png`;
                        if (args.ProfileToken == 'sub_stream' && this.config.lowQuality && this.config.lowQuality.snapshot)
                            uri = `http://${this.config.hostname}:${this.config.ports.snapshot}${this.config.lowQuality.snapshot}`;
                        else if (this.config.highQuality.snapshot)
                            uri = `http://${this.config.hostname}:${this.config.ports.snapshot}${this.config.highQuality.snapshot}`;

                        return {
                            MediaUri : {
                                Uri: uri,
                                InvalidAfterConnect : false,
                                InvalidAfterReboot : false,
                                Timeout : 'PT30S'
                            }
                        };
                    },
                
                    GetStreamUri: (args) => {
                        let path = this.config.highQuality.rtsp;
                        if (args.ProfileToken == 'sub_stream' && this.config.lowQuality)
                            path = this.config.lowQuality.rtsp;

                        return {
                            MediaUri: {
                                Uri: `rtsp://${this.config.hostname}:${this.config.ports.rtsp}${path}`,
                                InvalidAfterConnect: false,
                                InvalidAfterReboot: false,
                                Timeout: 'PT30S'
                            }
                        };
                    }
                }
            }
        };
    }

    listen(request, response) {
        let action = url.parse(request.url, true).pathname;
        
        // Log all HTTP requests
        this.logger.info(`[${this.config.name}] HTTP ${request.method} ${action}`);
        if (request.headers.authorization) {
            this.logger.info(`[${this.config.name}] HTTP Auth header present`);
        }
        
        if (action == '/snapshot.png') {
            let image = fs.readFileSync('./resources/snapshot.png');
            response.writeHead(200, {'Content-Type': 'image/png' });
            response.end(image, 'binary');
        } else if (action == '/onvif/device_service' || action == '/onvif/media_service') {
            // SOAP requests are handled by the soap library
            this.logger.debug(`[${this.config.name}] SOAP endpoint accessed: ${action}`);
        } else {
            this.logger.warn(`[${this.config.name}] Unknown path requested: ${action}`);
            response.writeHead(404, {'Content-Type': 'text/plain'});
            response.write('404 Not Found\n');
            response.end();
        }
    }

    startServer() {
        this.server = http.createServer(this.listen.bind(this));
        this.server.listen(this.config.ports.server, this.config.hostname);

        this.deviceService = soap.listen(this.server, {
            path: '/onvif/device_service', 
            services: this.onvif,
            xml: fs.readFileSync('./wsdl/device_service.wsdl', 'utf8'),
            forceSoap12Headers: true
        });

        this.mediaService = soap.listen(this.server, {
            path: '/onvif/media_service', 
            services: this.onvif,
            xml: fs.readFileSync('./wsdl/media_service.wsdl', 'utf8'),
            forceSoap12Headers: true
        });
    }

    enableDebugOutput() {
        this.deviceService.on('request', (request, methodName) => {
            this.logger.info(`[${this.config.name}] DeviceService: ${methodName}`);
            if (request && request.headers) {
                this.logger.debug(`[${this.config.name}] Headers:`, JSON.stringify(request.headers));
            }
        });
        
        this.deviceService.on('response', (response, methodName) => {
            this.logger.debug(`[${this.config.name}] DeviceService Response: ${methodName} - Status: ${response.statusCode}`);
        });
        
        this.mediaService.on('request', (request, methodName) => {
            this.logger.info(`[${this.config.name}] MediaService: ${methodName}`);
            if (request && request.headers) {
                this.logger.debug(`[${this.config.name}] Headers:`, JSON.stringify(request.headers));
            }
        });
        
        this.mediaService.on('response', (response, methodName) => {
            this.logger.debug(`[${this.config.name}] MediaService Response: ${methodName} - Status: ${response.statusCode}`);
        });
        
        // Log authentication attempts
        this.deviceService.on('headers', (headers, methodName) => {
            if (headers.Authorization) {
                this.logger.info(`[${this.config.name}] Auth attempt for ${methodName}`);
            }
        });
    }

    /**
     * Register this camera with the discovery service
     * @param {CameraRegistry} registry - The camera registry from the discovery service
     */
    registerWithDiscovery(registry) {
        this.cameraRegistry = registry;
        
        const cameraInfo = {
            name: this.config.name,
            hostname: this.config.hostname,
            port: this.config.ports.server,
            mac: this.config.mac,
            deviceServicePath: '/onvif/device_service'
        };
        
        this.cameraRegistry.register(this.config.uuid, cameraInfo);
        this.logger.debug(`Registered camera ${this.config.name} with discovery service`);
    }

    /**
     * Unregister this camera from the discovery service
     */
    unregisterFromDiscovery() {
        if (this.cameraRegistry) {
            this.cameraRegistry.unregister(this.config.uuid);
            this.logger.debug(`Unregistered camera ${this.config.name} from discovery service`);
        }
    }

    getHostname() {
        return this.config.hostname;
    }

    /**
     * Start individual discovery service for this camera
     */
    startIndividualDiscovery() {
        if (!this.config.hostname) {
            this.logger.error(`Cannot start individual discovery for ${this.config.name} - no hostname`);
            return;
        }

        try {
            this.individualDiscovery = new IndividualDiscoveryService({
                name: this.config.name,
                uuid: this.config.uuid,
                hostname: this.config.hostname,
                port: this.config.ports.server
            }, this.logger);
            
            this.individualDiscovery.start(this.config.hostname);
            this.logger.debug(`Started individual discovery for ${this.config.name} on ${this.config.hostname}:3702`);
        } catch (err) {
            this.logger.error(`Failed to start individual discovery for ${this.config.name}: ${err.message}`);
        }
    }

    /**
     * Stop individual discovery service
     */
    stopIndividualDiscovery() {
        if (this.individualDiscovery) {
            this.individualDiscovery.stop();
            this.individualDiscovery = null;
            this.logger.debug(`Stopped individual discovery for ${this.config.name}`);
        }
    }
};

function createServer(config, logger) {
    return new OnvifServer(config, logger);
}

exports.createServer = createServer;
