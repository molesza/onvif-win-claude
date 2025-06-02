const dgram = require('dgram');
const uuid = require('node-uuid');

// Test a specific camera IP
const testIP = process.argv[2] || '192.168.6.176';

console.log(`Testing discovery on ${testIP}:3702...`);

const probeMessage = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery">
    <s:Header>
        <a:Action s:mustUnderstand="1">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</a:Action>
        <a:MessageID>uuid:${uuid.v1()}</a:MessageID>
        <a:ReplyTo>
            <a:Address>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</a:Address>
        </a:ReplyTo>
        <a:To s:mustUnderstand="1">urn:schemas-xmlsoap-org:ws:2005:04:discovery</a:To>
    </s:Header>
    <s:Body>
        <d:Probe>
            <d:Types>dn:NetworkVideoTransmitter</d:Types>
        </d:Probe>
    </s:Body>
</s:Envelope>`;

const client = dgram.createSocket('udp4');
const message = Buffer.from(probeMessage);

let responseReceived = false;

client.on('message', (msg, rinfo) => {
    responseReceived = true;
    console.log(`✓ Response received from ${rinfo.address}:${rinfo.port}`);
    console.log(`  Response size: ${msg.length} bytes`);
    
    const response = msg.toString();
    if (response.includes('ProbeMatch')) {
        console.log('  Contains ProbeMatch - discovery is working!');
    }
    client.close();
});

client.on('error', (err) => {
    console.error('✗ Error:', err.message);
    client.close();
});

// Send directly to the camera's discovery service
client.send(message, 0, message.length, 3702, testIP, (err) => {
    if (err) {
        console.error('✗ Failed to send probe:', err.message);
        client.close();
    } else {
        console.log('  Probe sent, waiting for response...');
    }
});

// Timeout after 3 seconds
setTimeout(() => {
    if (!responseReceived) {
        console.log('✗ No response received after 3 seconds');
    }
    client.close();
}, 3000);