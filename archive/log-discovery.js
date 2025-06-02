#!/usr/bin/env node

const dgram = require('dgram');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'discovery.log');

// Clear log file
fs.writeFileSync(logFile, `Discovery Log Started: ${new Date().toISOString()}\n\n`);

function log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFile, logEntry);
    console.log(message);
}

log('Starting discovery logger...');

// Create monitoring socket
const monitor = dgram.createSocket({ type: 'udp4', reuseAddr: true });

// Track probe/response pairs
const probes = new Map();

monitor.on('message', (msg, rinfo) => {
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
                
                log(`PROBE from ${rinfo.address}:${rinfo.port} (ID: ...${shortId})`);
                
                probes.set(shortId, {
                    from: rinfo.address,
                    time: Date.now(),
                    responses: []
                });
            }
            
            // Check if it's a ProbeMatch
            else if (body['ProbeMatches']) {
                const relatesTo = header['RelatesTo'][0];
                const shortId = relatesTo.substr(-8);
                const matches = body['ProbeMatches'][0]['ProbeMatch'];
                const numMatches = Array.isArray(matches) ? matches.length : 1;
                
                log(`RESPONSE from ${rinfo.address}:${rinfo.port} (RelatesTo: ...${shortId}, Cameras: ${numMatches}, Size: ${msg.length} bytes)`);
                
                const probe = probes.get(shortId);
                if (probe) {
                    probe.responses.push({
                        from: rinfo.address,
                        cameras: numMatches,
                        size: msg.length
                    });
                    
                    // Log camera details
                    const matchArray = Array.isArray(matches) ? matches : [matches];
                    matchArray.forEach((match, i) => {
                        try {
                            const addr = match['XAddrs'][0];
                            log(`  Camera ${i+1}: ${addr}`);
                        } catch (e) {}
                    });
                }
            }
        });
    } catch (error) {
        // Not an ONVIF message
    }
});

monitor.on('error', (err) => {
    log(`ERROR: ${err.message}`);
});

// Bind and join multicast
monitor.bind(0, () => {
    const address = monitor.address();
    log(`Monitor listening on port ${address.port}`);
    
    try {
        monitor.addMembership('239.255.255.250');
        log('Joined multicast group 239.255.255.250');
    } catch (err) {
        log('Could not join multicast group');
    }
});

// Summary every 10 seconds
setInterval(() => {
    const summary = [];
    summary.push('\n=== Discovery Summary ===');
    summary.push(`Active probes: ${probes.size}`);
    
    let totalResponses = 0;
    for (const [id, probe] of probes.entries()) {
        totalResponses += probe.responses.length;
        if (Date.now() - probe.time < 10000) {
            summary.push(`  Probe ...${id}: ${probe.responses.length} responses`);
        }
    }
    
    summary.push(`Total recent responses: ${totalResponses}`);
    summary.push('========================\n');
    
    log(summary.join('\n'));
    
    // Clean old probes
    for (const [id, probe] of probes.entries()) {
        if (Date.now() - probe.time > 30000) {
            probes.delete(id);
        }
    }
}, 10000);

console.log(`\nLogging discovery to: ${logFile}`);
console.log('Press Ctrl+C to stop.\n');

process.on('SIGINT', () => {
    log('Stopping logger...');
    monitor.close();
    process.exit(0);
});