const dgram = require('dgram');
const uuid = require('node-uuid');

// Create a discovery probe message
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

client.on('message', (msg, rinfo) => {
    console.log(`Response from ${rinfo.address}:${rinfo.port}`);
    console.log('Response length:', msg.length, 'bytes');
    
    // Check if response contains camera information
    const response = msg.toString();
    const cameraCount = (response.match(/<d:ProbeMatch>/g) || []).length;
    console.log('Number of cameras in response:', cameraCount);
    
    if (cameraCount > 0) {
        console.log('\nFirst camera info:');
        const firstMatch = response.match(/<d:ProbeMatch>[\s\S]*?<\/d:ProbeMatch>/);
        if (firstMatch) {
            console.log(firstMatch[0]);
        }
    }
});

client.on('error', (err) => {
    console.error('Error:', err);
    client.close();
});

// Send probe to multicast address
client.send(message, 0, message.length, 3702, '239.255.255.250', (err) => {
    if (err) {
        console.error('Send error:', err);
    } else {
        console.log('Discovery probe sent');
    }
});

// Also send to localhost
client.send(message, 0, message.length, 3702, '127.0.0.1', (err) => {
    if (err) {
        console.error('Send error (localhost):', err);
    }
});

// Wait for responses
setTimeout(() => {
    console.log('\nClosing discovery client');
    client.close();
}, 5000);