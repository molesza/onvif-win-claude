#!/usr/bin/env node

const tcpProxy = require('node-tcp-proxy');
const net = require('net');

console.log('Testing TCP proxy binding to specific IPs...\n');

// Test if we can bind to a specific IP
const testPort = 9999;
const testIP = '192.168.6.176';

try {
    // Check if node-tcp-proxy supports IP binding
    const proxy = tcpProxy.createProxy(testPort, 'localhost', 80, {
        hostname: testIP  // Try passing hostname option
    });
    
    console.log('Method 1: Created proxy with hostname option');
    
    // Check what IP it's actually bound to
    setTimeout(() => {
        const cmd = require('child_process').execSync(`ss -tlnp | grep ${testPort} || netstat -tlnp | grep ${testPort} || echo "Port not found"`);
        console.log('Binding result:', cmd.toString());
        process.exit(0);
    }, 1000);
    
} catch (err) {
    console.log('Method 1 failed:', err.message);
    
    // Try creating our own proxy that binds to specific IP
    console.log('\nTrying custom proxy implementation...');
    
    const server = net.createServer((clientSocket) => {
        const targetSocket = net.createConnection({
            host: 'localhost',
            port: 80
        });
        
        clientSocket.pipe(targetSocket);
        targetSocket.pipe(clientSocket);
        
        clientSocket.on('error', () => {});
        targetSocket.on('error', () => {});
    });
    
    server.listen(testPort, testIP, () => {
        console.log(`Custom proxy listening on ${testIP}:${testPort}`);
        
        setTimeout(() => {
            const cmd = require('child_process').execSync(`ss -tlnp | grep ${testPort} || netstat -tlnp | grep ${testPort} || echo "Port not found"`);
            console.log('Binding result:', cmd.toString());
            process.exit(0);
        }, 1000);
    });
}