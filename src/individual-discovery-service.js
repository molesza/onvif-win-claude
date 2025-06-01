/**
 * Individual Discovery Service - Runs on a specific IP address for a single camera
 * This allows each virtual camera to have its own discovery service without port conflicts
 */

const dgram = require('dgram');
const xml2js = require('xml2js');
const uuid = require('node-uuid');

class IndividualDiscoveryService {
    constructor(camera, logger) {
        this.camera = camera;
        this.logger = logger;
        this.discoverySocket = null;
        this.messageCounter = 0;
        this.multicastAddress = '239.255.255.250';
        this.discoveryPort = 3702;
    }

    /**
     * Start the discovery service on a specific IP
     * @param {string} bindIp - IP address to bind to
     */
    start(bindIp) {
        this.discoverySocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        
        this.discoverySocket.on('message', (message, remote) => {
            this.handleDiscoveryMessage(message, remote);
        });

        this.discoverySocket.on('error', (error) => {
            this.logger.error(`Discovery error for ${this.camera.name}: ${error.message}`);
        });

        // Bind to specific IP address
        this.discoverySocket.bind(this.discoveryPort, bindIp, () => {
            this.logger.debug(`Discovery service for ${this.camera.name} started on ${bindIp}:${this.discoveryPort}`);
            
            // Join multicast group on this specific interface
            try {
                this.discoverySocket.addMembership(this.multicastAddress, bindIp);
                this.discoverySocket.setMulticastInterface(bindIp);
            } catch (err) {
                this.logger.error(`Failed to join multicast for ${this.camera.name}: ${err.message}`);
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
            this.logger.debug(`Discovery service stopped for ${this.camera.name}`);
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
                    this.sendProbeMatch(probeUuid, remote);
                }
            } catch (err) {
                // Silently ignore parsing errors
            }
        });
    }

    /**
     * Send ProbeMatch response for this camera only
     */
    sendProbeMatch(probeUuid, remote) {
        const response = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope" xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
    <SOAP-ENV:Header>
        <wsa:MessageID>uuid:${uuid.v1()}</wsa:MessageID>
        <wsa:RelatesTo>${probeUuid}</wsa:RelatesTo>
        <wsa:To SOAP-ENV:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</wsa:To>
        <wsa:Action SOAP-ENV:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/ProbeMatches</wsa:Action>
        <d:AppSequence SOAP-ENV:mustUnderstand="true" MessageNumber="${this.messageCounter++}" InstanceId="${Date.now()}"/>
    </SOAP-ENV:Header>
    <SOAP-ENV:Body>
        <d:ProbeMatches>
            <d:ProbeMatch>
                <wsa:EndpointReference>
                    <wsa:Address>urn:uuid:${this.camera.uuid}</wsa:Address>
                </wsa:EndpointReference>
                <d:Types>dn:NetworkVideoTransmitter</d:Types>
                <d:Scopes>
                    onvif://www.onvif.org/type/video_encoder
                    onvif://www.onvif.org/type/ptz
                    onvif://www.onvif.org/hardware/Onvif
                    onvif://www.onvif.org/name/Cardinal
                    onvif://www.onvif.org/location/
                    onvif://www.onvif.org/Profile/Streaming
                </d:Scopes>
                <d:XAddrs>http://${this.camera.hostname}:${this.camera.port}/onvif/device_service</d:XAddrs>
                <d:MetadataVersion>1</d:MetadataVersion>
            </d:ProbeMatch>
        </d:ProbeMatches>
    </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

        const responseBuffer = Buffer.from(response);
        const responseSocket = dgram.createSocket('udp4');
        
        responseSocket.send(responseBuffer, 0, responseBuffer.length, remote.port, remote.address, (err) => {
            if (err) {
                this.logger.error(`Failed to send discovery response for ${this.camera.name}: ${err.message}`);
            } else {
                this.logger.debug(`Sent discovery response for ${this.camera.name} to ${remote.address}:${remote.port}`);
            }
            responseSocket.close();
        });
    }
}

module.exports = IndividualDiscoveryService;