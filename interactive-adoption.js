#!/usr/bin/env node

const fs = require('fs');
const yaml = require('js-yaml');
const readline = require('readline');
const { spawn } = require('child_process');
const path = require('path');

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m'
};

let currentProcess = null;

function clearScreen() {
    process.stdout.write('\x1b[2J\x1b[0f');
}

function printHeader() {
    console.log(colors.bright + colors.blue + '=' .repeat(60) + colors.reset);
    console.log(colors.bright + colors.blue + '   ONVIF Camera Interactive Adoption Tool' + colors.reset);
    console.log(colors.bright + colors.blue + '=' .repeat(60) + colors.reset);
    console.log('');
}

function printStatus(message, color = colors.green) {
    console.log(color + '► ' + message + colors.reset);
}

function printError(message) {
    console.log(colors.red + '✗ ' + message + colors.reset);
}

function printInfo(message) {
    console.log(colors.yellow + 'ℹ ' + message + colors.reset);
}

async function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

function startSingleCamera(config, cameraIndex) {
    return new Promise((resolve, reject) => {
        // Create a temporary config with just one camera
        const singleCameraConfig = {
            onvif: [config.onvif[cameraIndex]]
        };
        
        // Write temporary config file
        const tempConfigPath = path.join(__dirname, '.temp-single-camera.yaml');
        fs.writeFileSync(tempConfigPath, yaml.dump(singleCameraConfig));
        
        // Start the ONVIF server for this camera
        currentProcess = spawn('node', ['main.js', tempConfigPath], {
            cwd: __dirname,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        
        let started = false;
        
        currentProcess.stdout.on('data', (data) => {
            const output = data.toString();
            if (output.includes('Master discovery service started') && !started) {
                started = true;
                resolve();
            }
        });
        
        currentProcess.stderr.on('data', (data) => {
            console.error(colors.red + data.toString() + colors.reset);
        });
        
        currentProcess.on('error', (error) => {
            reject(error);
        });
        
        currentProcess.on('exit', (code) => {
            if (code !== 0 && code !== null) {
                reject(new Error(`Process exited with code ${code}`));
            }
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
            if (!started) {
                reject(new Error('Timeout waiting for server to start'));
            }
        }, 5000);
    });
}

function stopCurrentCamera() {
    return new Promise((resolve) => {
        if (currentProcess) {
            currentProcess.on('exit', () => {
                currentProcess = null;
                resolve();
            });
            currentProcess.kill('SIGTERM');
        } else {
            resolve();
        }
    });
}

async function main() {
    // Check if config file exists
    const configPath = process.argv[2] || './config.yaml';
    if (!fs.existsSync(configPath)) {
        printError(`Config file not found: ${configPath}`);
        printInfo('Usage: node interactive-adoption.js [config.yaml]');
        process.exit(1);
    }
    
    // Load configuration
    let config;
    try {
        const configData = fs.readFileSync(configPath, 'utf8');
        config = yaml.load(configData);
    } catch (error) {
        printError(`Failed to read config file: ${error.message}`);
        process.exit(1);
    }
    
    const totalCameras = config.onvif.length;
    
    clearScreen();
    printHeader();
    printInfo(`Found ${totalCameras} cameras in configuration`);
    console.log('');
    printInfo('This tool will help you adopt cameras one by one in Unifi Protect');
    printInfo('Each camera will be made discoverable individually');
    console.log('');
    
    await askQuestion('Press Enter to start...');
    
    // Process each camera
    for (let i = 0; i < totalCameras; i++) {
        const camera = config.onvif[i];
        
        clearScreen();
        printHeader();
        console.log(colors.bright + `Camera ${i + 1} of ${totalCameras}` + colors.reset);
        console.log('─'.repeat(40));
        console.log(`Name: ${colors.bright}${camera.name}${colors.reset}`);
        console.log(`MAC:  ${colors.bright}${camera.mac}${colors.reset}`);
        console.log(`Port: ${colors.bright}${camera.ports.server}${colors.reset}`);
        console.log('');
        
        printStatus('Starting ONVIF server for this camera...');
        
        try {
            await startSingleCamera(config, i);
            
            console.log('');
            printStatus('Camera is now discoverable!', colors.green);
            console.log('');
            printInfo('Go to Unifi Protect and adopt this camera');
            printInfo('The camera should appear as "Onvif Cardinal"');
            console.log('');
            
            const answer = await askQuestion(colors.yellow + 'Press Enter when camera is adopted (or type "skip" to skip this camera): ' + colors.reset);
            
            if (answer.toLowerCase() === 'skip') {
                printInfo('Skipping this camera...');
            } else {
                printStatus('Camera adopted successfully!');
            }
            
            printStatus('Stopping camera discovery...');
            await stopCurrentCamera();
            
            // Clean up temp file
            const tempConfigPath = path.join(__dirname, '.temp-single-camera.yaml');
            if (fs.existsSync(tempConfigPath)) {
                fs.unlinkSync(tempConfigPath);
            }
            
            if (i < totalCameras - 1) {
                console.log('');
                await askQuestion('Press Enter to continue to next camera...');
            }
            
        } catch (error) {
            printError(`Failed to start camera: ${error.message}`);
            await stopCurrentCamera();
            
            const retry = await askQuestion('Do you want to retry this camera? (y/n): ');
            if (retry.toLowerCase() === 'y') {
                i--; // Retry the same camera
            }
        }
    }
    
    clearScreen();
    printHeader();
    printStatus('All cameras processed!', colors.green);
    console.log('');
    printInfo('You can now run the full ONVIF server with all cameras:');
    console.log(colors.bright + `  node main.js ${configPath}` + colors.reset);
    console.log('');
    
    rl.close();
    process.exit(0);
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
    console.log('');
    printInfo('Shutting down...');
    await stopCurrentCamera();
    
    // Clean up temp file
    const tempConfigPath = path.join(__dirname, '.temp-single-camera.yaml');
    if (fs.existsSync(tempConfigPath)) {
        fs.unlinkSync(tempConfigPath);
    }
    
    process.exit(0);
});

// Run the main function
main().catch((error) => {
    printError(`Fatal error: ${error.message}`);
    process.exit(1);
});