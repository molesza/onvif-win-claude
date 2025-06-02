#!/bin/bash
# Universal NVR adoption script for UniFi Protect
# Usage: ./adopt-nvr.sh <docker-compose-file> <service-prefix> [camera-count]
# Example: ./adopt-nvr.sh docker-compose-nvr3-192.168.6.204.yml nvr3 32

# Check arguments
if [ $# -lt 2 ]; then
    echo "Usage: $0 <docker-compose-file> <service-prefix> [camera-count]"
    echo "Example: $0 docker-compose-nvr3-192.168.6.204.yml nvr3 32"
    exit 1
fi

COMPOSE_FILE="$1"
SERVICE_PREFIX="$2"
CAMERA_COUNT="${3:-}"

# Check if compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    echo "Error: Docker compose file '$COMPOSE_FILE' not found!"
    exit 1
fi

# If camera count not provided, try to detect it
if [ -z "$CAMERA_COUNT" ]; then
    echo "Detecting number of cameras..."
    # Count only service definitions (lines that start with spaces followed by service name and colon)
    CAMERA_COUNT=$(grep -E "^  ${SERVICE_PREFIX}-camera[0-9]+:" "$COMPOSE_FILE" | wc -l)
    echo "Found $CAMERA_COUNT cameras in the compose file"
fi

echo "=== NVR Adoption Script ==="
echo "Compose file: $COMPOSE_FILE"
echo "Service prefix: $SERVICE_PREFIX"
echo "Number of cameras: $CAMERA_COUNT"
echo ""
echo "This will start cameras one by one for UniFi Protect adoption"
echo "Press Enter to start or Ctrl+C to cancel..."
read

# First, make sure all cameras are stopped
echo "Ensuring all cameras are stopped..."
docker compose -f "$COMPOSE_FILE" stop >/dev/null 2>&1

echo ""
echo "Starting adoption process..."
echo ""

# Loop through cameras
for i in $(seq 1 $CAMERA_COUNT); do
    SERVICE_NAME="${SERVICE_PREFIX}-camera${i}"
    
    echo "[$i/$CAMERA_COUNT] Starting $SERVICE_NAME..."
    docker compose -f "$COMPOSE_FILE" up -d "$SERVICE_NAME"
    
    if [ $? -eq 0 ]; then
        echo "✓ $SERVICE_NAME started successfully"
        echo ""
        echo "Please adopt this camera in UniFi Protect now."
        echo "Camera name: ${SERVICE_PREFIX^^}-Camera-$(printf '%02d' $i)"
        echo ""
        echo "Press Enter when adoption is complete (or 's' to skip)..."
        read response
        
        if [ "$response" = "s" ]; then
            echo "Skipping camera $i"
            docker compose -f "$COMPOSE_FILE" stop "$SERVICE_NAME" >/dev/null 2>&1
        fi
    else
        echo "✗ Failed to start $SERVICE_NAME"
        echo "Press Enter to continue..."
        read
    fi
    
    echo ""
done

echo "=== Adoption Complete! ==="
echo ""
echo "Starting all cameras..."
docker compose -f "$COMPOSE_FILE" up -d

echo ""
echo "All cameras have been started!"
echo "Total cameras running: $(docker compose -f "$COMPOSE_FILE" ps -q | wc -l)"