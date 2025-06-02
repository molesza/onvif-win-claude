#!/usr/bin/env node

const dgram = require('dgram');
const xml2js = require('xml2js');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

console.log(colors.bright + colors.blue + '=' .repeat(80) + colors.reset);
console.log(colors.bright + colors.blue + '   ONVIF Discovery Monitor' + colors.reset);
console.log(colors.bright + colors.blue + '=' .repeat(80) + colors.reset);
console.log('');
console.log(colors.yellow + 'Monitoring discovery traffic on port 3702...' + colors.reset);
console.log(colors.yellow + 'This will show all discovery probes and responses.' + colors.reset);
console.log('');

// Create monitoring socket
const monitor = dgram.createSocket({ type: 'udp4', reuseAddr: true });

// Track probe/response pairs
const probes = new Map();

monitor.on('message', (msg, rinfo) => {
    const timestamp = new Date().toISOString().substr(11, 12);
    
    try {
        xml2js.parseString(msg.toString(), { 
            tagNameProcessors: [xml2js.processors.stripPrefix] 
        }, (err, result) => {
            if (err) return;
            
            const envelope = result['Envelope'];
            const header = envelope['Header'][0];
            const body = envelope['Body'][0];
            
            // Check if it's a Probe
            if (body['Probe']) {
                const messageId = header['MessageID'][0];
                const shortId = messageId.substr(-8);
                
                console.log(colors.bright + colors.green + `\n[${timestamp}] PROBE from ${rinfo.address}:${rinfo.port}` + colors.reset);
                console.log(colors.cyan + `  MessageID: ...${shortId}` + colors.reset);
                
                // Track this probe
                probes.set(shortId, {
                    from: rinfo.address,
                    time: Date.now(),
                    responses: []
                });
                
                // Clean up old probes
                for (const [id, probe] of probes.entries()) {
                    if (Date.now() - probe.time > 10000) {
                        probes.delete(id);
                    }
                }
            }
            
            // Check if it's a ProbeMatch
            else if (body['ProbeMatches']) {
                const relatesTo = header['RelatesTo'][0];
                const shortId = relatesTo.substr(-8);
                const matches = body['ProbeMatches'][0]['ProbeMatch'];
                const numMatches = Array.isArray(matches) ? matches.length : 1;
                
                console.log(colors.bright + colors.magenta + `\n[${timestamp}] RESPONSE from ${rinfo.address}:${rinfo.port}` + colors.reset);
                console.log(colors.cyan + `  RelatesTo: ...${shortId}` + colors.reset);
                console.log(colors.cyan + `  Cameras: ${numMatches}` + colors.reset);
                console.log(colors.cyan + `  Size: ${msg.length} bytes` + colors.reset);
                
                // Track this response
                const probe = probes.get(shortId);
                if (probe) {
                    probe.responses.push({
                        from: rinfo.address,
                        cameras: numMatches,
                        size: msg.length
                    });
                    
                    // Show camera details
                    const matchArray = Array.isArray(matches) ? matches : [matches];
                    matchArray.forEach((match, i) => {
                        try {
                            const addr = match['XAddrs'][0];
                            const uuid = match['EndpointReference'][0]['Address'][0];
                            console.log(colors.yellow + `    Camera ${i+1}: ${addr}` + colors.reset);
                            console.log(colors.yellow + `    UUID: ${uuid.substr(-12)}...` + colors.reset);
                        } catch (e) {}
                    });
                    
                    // Summary for this probe
                    console.log(colors.bright + `  Total responses for this probe: ${probe.responses.length}` + colors.reset);
                }
            }
        });
    } catch (error) {
        // Not an ONVIF message, ignore
    }
});

monitor.on('error', (err) => {
    console.error(colors.red + `Monitor error: ${err.message}` + colors.reset);
});

// Try to bind to a monitoring port (not 3702 to avoid conflicts)
monitor.bind(0, () => {
    const address = monitor.address();
    console.log(colors.green + `Monitor listening on port ${address.port}` + colors.reset);
    
    // Join multicast group to see discovery traffic
    try {
        monitor.addMembership('239.255.255.250');
        console.log(colors.green + 'Joined multicast group 239.255.255.250' + colors.reset);
    } catch (err) {
        console.log(colors.yellow + 'Could not join multicast group (this is OK)' + colors.reset);
    }
});

// Note about monitoring
console.log(colors.yellow + '\nNote: This monitor shows multicast discovery traffic.' + colors.reset);
console.log(colors.yellow + 'Some NVRs may also use unicast discovery directly to camera IPs.' + colors.reset);

// Show summary every 30 seconds
setInterval(() => {
    if (probes.size > 0) {
        console.log(colors.bright + colors.blue + '\n--- Summary ---' + colors.reset);
        console.log(`Active probes: ${probes.size}`);
        
        let totalResponses = 0;
        for (const probe of probes.values()) {
            totalResponses += probe.responses.length;
        }
        console.log(`Total responses: ${totalResponses}`);
        console.log(colors.blue + '---------------\n' + colors.reset);
    }
}, 30000);

console.log('');
console.log(colors.cyan + 'Tip: Run this alongside your ONVIF server to see discovery traffic.' + colors.reset);
console.log(colors.cyan + 'Press Ctrl+C to stop monitoring.' + colors.reset);

process.on('SIGINT', () => {
    console.log('\n' + colors.yellow + 'Stopping monitor...' + colors.reset);
    monitor.close();
    process.exit(0);
});