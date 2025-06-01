#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Generate a deterministic but unique identifier based on camera number
function generateUniqueId(cameraNum, prefix) {
    const hash = crypto.createHash('sha256');
    hash.update(`${prefix}-camera${cameraNum}-unique`);
    return hash.digest('hex').substring(0, 8);
}

// Update onvif-server.js to use camera-specific manufacturer and model
const serverFile = path.join(__dirname, 'src', 'onvif-server.js');
let serverContent = fs.readFileSync(serverFile, 'utf8');

// Replace the GetDeviceInformation function to use unique identifiers
const newGetDeviceInfo = `                    GetDeviceInformation: (args) => {
                        // Extract camera number from name (e.g., VideoSourceConfig_Channel11 -> 11)
                        const cameraNum = this.config.name.match(/Channel(\d+)/)?.[1] || '1';
                        const uniqueId = require('crypto').createHash('sha256')
                            .update(\`camera\${cameraNum}-unique\`)
                            .digest('hex').substring(0, 6);
                        
                        return {
                            Manufacturer: \`CamVendor\${cameraNum}\`,
                            Model: \`ProCam-\${uniqueId}\`,
                            FirmwareVersion: \`\${cameraNum}.0.\${uniqueId.substring(0,2)}\`,
                            SerialNumber: this.config.uuid || \`SN-\${this.config.mac.replace(/:/g, '')}\`,
                            HardwareId: \`HW-\${this.config.mac.replace(/:/g, '')}-\${uniqueId}\`
                        };
                    }`;

// Replace the GetDeviceInformation function
serverContent = serverContent.replace(
    /GetDeviceInformation: \(args\) => \{[\s\S]*?\}[\s\S]*?\}/,
    newGetDeviceInfo
);

fs.writeFileSync(serverFile, serverContent);
console.log('Updated src/onvif-server.js with unique device information');

// Now let's also make each camera's capabilities slightly different
const capabilitiesUpdate = `
// Make capabilities unique per camera
const cameraNum = this.config.name.match(/Channel(\\d+)/)?.[1] || '1';
const cameraVersion = \`1.\${cameraNum}.0\`;
`;

// Update the GetCapabilities to include camera-specific version
serverContent = fs.readFileSync(serverFile, 'utf8');
serverContent = serverContent.replace(
    'GetCapabilities: (args) => {',
    'GetCapabilities: (args) => {\n                        ' + capabilitiesUpdate
);

// Update version references
serverContent = serverContent.replace(
    /Major: 1,[\s]*Minor: 0/g,
    `Major: 1,\n                                    Minor: parseInt(cameraNum) || 1`
);

fs.writeFileSync(serverFile, serverContent);

console.log('✓ Updated ONVIF server to provide unique device information per camera');
console.log('✓ Each camera will now report:');
console.log('  - Unique manufacturer (CamVendor1, CamVendor2, etc.)');
console.log('  - Unique model with hash (ProCam-XXXXXX)');
console.log('  - Unique firmware version');
console.log('  - Unique hardware ID');
console.log('\nNow rebuild the Docker images for changes to take effect.');