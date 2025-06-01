/**
 * Broadcast Discovery Service - Listens on main interface but sends individual responses
 * This combines the benefits of centralized listening with individual responses
 */

const dgram = require('dgram');
const xml2js = require('xml2js');
const uuid = require('node-uuid');

class BroadcastDiscoveryService {
    constructor(logger) {
        this.logger = logger;
        this.cameras = new Map();
        this.discoverySocket = null;
        this.messageCounter = 0;
        this.multicastAddress = '239.255.255.250';
        this.discoveryPort = 3702;
    }

    /**
     * Start the discovery service
     * @param {string} bindInterface - Network interface IP to bind to (optional)
     */
    start(bindInterface) {
        this.discoverySocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        
        this.discoverySocket.on('message', (message, remote) => {
            this.handleDiscoveryMessage(message, remote);
        });

        this.discoverySocket.on('error', (error) => {
            this.logger.error(`Broadcast discovery service error: ${error.message}`);
        });

        this.discoverySocket.bind(this.discoveryPort, () => {
            this.logger.info(`Broadcast discovery service started on port ${this.discoveryPort}`);
            
            // Join multicast group
            if (bindInterface) {
                this.discoverySocket.addMembership(this.multicastAddress, bindInterface);
            } else {
                this.discoverySocket.addMembership(this.multicastAddress);
            }
        });
    }

    /**
     * Stop the discovery service
     */
    stop() {
        if (this.discoverySocket) {
            this.discoverySocket.close();
            this.discoverySocket = null;
            this.logger.info('Broadcast discovery service stopped');
        }
    }

    /**
     * Register a camera
     */
    registerCamera(uuid, cameraInfo) {
        this.cameras.set(uuid, {
            ...cameraInfo,
            registeredAt: new Date()
        });
        this.logger.debug(`Registered camera ${cameraInfo.name} for broadcast discovery`);
    }

    /**
     * Unregister a camera
     */
    unregisterCamera(uuid) {
        const camera = this.cameras.get(uuid);
        if (camera) {
            this.cameras.delete(uuid);
            this.logger.debug(`Unregistered camera ${camera.name} from broadcast discovery`);
        }
    }

    /**
     * Handle incoming discovery messages
     */
    handleDiscoveryMessage(message, remote) {
        xml2js.parseString(message.toString(), { 
            tagNameProcessors: [xml2js.processors.stripPrefix] 
        }, (err, result) => {
            if (err) {
                return;
            }

            try {
                const envelope = result['Envelope'];
                const header = envelope['Header'][0];
                const body = envelope['Body'][0];
                
                // Check if this is a Probe message
                if (!body['Probe']) {
                    return;
                }

                const probeUuid = header['MessageID'][0];
                let probeType = '';
                
                try {
                    probeType = body['Probe'][0]['Types'][0];
                    if (typeof probeType === 'object') {
                        probeType = probeType._;
                    }
                } catch (err) {
                    // No specific type requested, respond to all
                }

                // Check if we should respond to this probe
                if (probeType === '' || probeType.indexOf('NetworkVideoTransmitter') > -1) {
                    this.sendIndividualProbeMatches(probeUuid, remote);
                }
            } catch (err) {
                this.logger.error(`Error processing discovery message: ${err.message}`);
            }
        });
    }

    /**
     * Send individual ProbeMatch responses for each camera
     */
    sendIndividualProbeMatches(probeUuid, remote) {
        const cameras = Array.from(this.cameras.values());
        
        if (cameras.length === 0) {
            this.logger.debug('No cameras registered, not sending discovery response');
            return;
        }

        this.logger.info(`Discovery probe received from ${remote.address}:${remote.port} - sending ${cameras.length} individual responses`);

        // Send a separate response for each camera with a small delay between them
        cameras.forEach((camera, index) => {
            setTimeout(() => {
                this.sendSingleProbeMatch(camera, probeUuid, remote);
            }, index * 200); // 200ms delay between responses (increased from 50ms)
        });
    }

    /**
     * Send a single ProbeMatch response for one camera
     */
    sendSingleProbeMatch(camera, probeUuid, remote) {
        this.logger.debug(`Sending discovery response for ${camera.name} to ${remote.address}:${remote.port}`);
        const response = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope" xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
    <SOAP-ENV:Header>
        <wsa:MessageID>uuid:${uuid.v1()}</wsa:MessageID>
        <wsa:RelatesTo>${probeUuid}</wsa:RelatesTo>
        <wsa:To SOAP-ENV:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</wsa:To>
        <wsa:Action SOAP-ENV:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/ProbeMatches</wsa:Action>
        <d:AppSequence SOAP-ENV:mustUnderstand="true" MessageNumber="${this.messageCounter++}" InstanceId="${Date.now() + Math.random() * 1000}"/>
    </SOAP-ENV:Header>
    <SOAP-ENV:Body>
        <d:ProbeMatches>
            <d:ProbeMatch>
                <wsa:EndpointReference>
                    <wsa:Address>urn:uuid:${camera.uuid}</wsa:Address>
                </wsa:EndpointReference>
                <d:Types>dn:NetworkVideoTransmitter</d:Types>
                <d:Scopes>
                    onvif://www.onvif.org/type/video_encoder
                    onvif://www.onvif.org/type/ptz
                    onvif://www.onvif.org/hardware/VirtualCamera${camera.port}
                    onvif://www.onvif.org/name/${camera.name.replace(/\s/g, '_')}
                    onvif://www.onvif.org/location/
                    onvif://www.onvif.org/Profile/Streaming
                </d:Scopes>
                <d:XAddrs>http://${camera.hostname}:${camera.port}/onvif/device_service</d:XAddrs>
                <d:MetadataVersion>1</d:MetadataVersion>
            </d:ProbeMatch>
        </d:ProbeMatches>
    </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

        const responseBuffer = Buffer.from(response);
        const responseSocket = dgram.createSocket('udp4');
        
        // Send from the camera's IP if possible
        try {
            responseSocket.bind(0, camera.hostname, () => {
                responseSocket.send(responseBuffer, 0, responseBuffer.length, remote.port, remote.address, (err) => {
                    if (err) {
                        this.logger.error(`Failed to send discovery response for ${camera.name}: ${err.message}`);
                    } else {
                        this.logger.info(`Sent discovery response for ${camera.name} from ${camera.hostname}`);
                    }
                    responseSocket.close();
                });
            });
        } catch (bindErr) {
            // If we can't bind to camera IP, send from default interface
            responseSocket.send(responseBuffer, 0, responseBuffer.length, remote.port, remote.address, (err) => {
                if (err) {
                    this.logger.error(`Failed to send discovery response for ${camera.name}: ${err.message}`);
                } else {
                    this.logger.warn(`Sent discovery response for ${camera.name} from default interface (not camera IP)`);
                }
                responseSocket.close();
            });
        }
    }
}

module.exports = BroadcastDiscoveryService;