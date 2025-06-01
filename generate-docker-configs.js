#!/usr/bin/env node

const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

const configPath = process.argv[2] || './config.yaml';

console.log('Generating Docker configurations...\n');

// Load main config
let config;
try {
    const configData = fs.readFileSync(configPath, 'utf8');
    config = yaml.load(configData);
} catch (error) {
    console.error(`Failed to read config: ${error.message}`);
    process.exit(1);
}

// Create configs directory
const configsDir = path.join(__dirname, 'configs');
if (!fs.existsSync(configsDir)) {
    fs.mkdirSync(configsDir);
}

// Create Dockerfile in current directory
const dockerfile = `FROM node:22-alpine

ADD ./src /app/src
ADD ./wsdl /app/wsdl
ADD ./resources /app/resources
ADD ./main.js /app/main.js
ADD ./package.json /app/package.json

WORKDIR /app
RUN npm install

ENTRYPOINT node main.js /onvif.yaml
`;

fs.writeFileSync('Dockerfile', dockerfile);
console.log('Created Dockerfile');

// Generate docker-compose.yml
let composeServices = {};

// Generate individual config for each camera
config.onvif.forEach((camera, index) => {
    const cameraNum = index + 1;
    
    // Create individual camera config
    const individualConfig = {
        onvif: [camera]
    };
    
    const configFile = path.join(configsDir, `camera${cameraNum}.yaml`);
    fs.writeFileSync(configFile, yaml.dump(individualConfig));
    console.log(`Created config for camera ${cameraNum}: ${camera.name}`);
    
    // Add to docker-compose
    composeServices[`camera${cameraNum}`] = {
        build: '.',
        container_name: `onvif-camera${cameraNum}`,
        mac_address: camera.mac,
        networks: {
            onvif_net: {
                ipv4_address: camera.hostname || `192.168.6.${175 + cameraNum}`
            }
        },
        volumes: [
            `./configs/camera${cameraNum}.yaml:/onvif.yaml:ro`
        ],
        restart: 'unless-stopped'
    };
});

// Generate docker-compose.yml
const dockerCompose = {
    version: '3.8',
    services: composeServices,
    networks: {
        onvif_net: {
            driver: 'macvlan',
            driver_opts: {
                parent: 'eth0'
            },
            ipam: {
                config: [{
                    subnet: '192.168.6.0/24',
                    gateway: '192.168.6.1'
                }]
            }
        }
    }
};

fs.writeFileSync('docker-compose.yml', yaml.dump(dockerCompose));
console.log('\nCreated docker-compose.yml with all cameras');

console.log('\n=== Docker Setup Complete ===');
console.log('\nTo run all cameras in Docker:');
console.log('1. Build the image: docker-compose build');
console.log('2. Start all cameras: docker-compose up -d');
console.log('3. View logs: docker-compose logs -f');
console.log('4. Stop all: docker-compose down');
console.log('\nTo run specific cameras:');
console.log('docker-compose up -d camera11 camera12 camera13 camera14 camera15');
console.log('\nEach camera runs in its own container with:');
console.log('- Its own network namespace');
console.log('- Its own discovery service on port 3702');
console.log('- Its own TCP proxy instances');
console.log('- Complete isolation from other cameras');