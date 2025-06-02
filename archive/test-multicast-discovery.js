const dgram = require('dgram');
const uuid = require('node-uuid');

console.log('Testing multicast discovery (239.255.255.250:3702)...');

const probeMessage = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
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

const client = dgram.createSocket({ type: 'udp4', reuseAddr: true });
const message = Buffer.from(probeMessage);

let responses = new Set();

client.on('message', (msg, rinfo) => {
    const key = `${rinfo.address}:${rinfo.port}`;
    if (!responses.has(key)) {
        responses.add(key);
        console.log(`Response ${responses.size} from ${rinfo.address}:${rinfo.port} (${msg.length} bytes)`);
        
        // Check if it's our virtual camera
        if (rinfo.address.startsWith('192.168.6.') && msg.toString().includes('Cardinal')) {
            console.log('  ✓ Virtual ONVIF camera detected!');
        }
    }
});

client.on('error', (err) => {
    console.error('Error:', err.message);
});

// Bind to any available port
client.bind(() => {
    // Send to multicast address
    client.send(message, 0, message.length, 3702, '239.255.255.250', (err) => {
        if (err) {
            console.error('Failed to send multicast probe:', err.message);
        } else {
            console.log('Multicast probe sent, waiting for responses...\n');
        }
    });
});

// Show results after 5 seconds
setTimeout(() => {
    console.log(`\nTotal responses: ${responses.size}`);
    client.close();
}, 5000);