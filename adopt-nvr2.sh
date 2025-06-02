#!/bin/bash
# Adoption script for NVR 2 (192.168.6.202)

echo "Starting adoption process for NVR 2"
echo "This will start cameras one by one for UniFi Protect adoption"
echo ""

for i in {1..16}; do
    echo "Starting camera $i..."
    docker compose -f docker-compose-nvr2-192.168.6.202.yml up -d nvr2-camera$i
    
    echo "Camera $i started. Please adopt it in UniFi Protect."
    echo "Press Enter when adoption is complete..."
    read
    
    echo "Continuing to camera $((i+1))..."
    echo ""
done

echo "All cameras have been adopted!"
echo "All cameras are now running."
