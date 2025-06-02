#!/bin/bash

# Real-time Virtual ONVIF Camera Monitor
# Provides live updating view of resource usage

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

clear
echo "=== Real-time ONVIF Camera Monitor ==="
echo "Press Ctrl+C to exit"
echo ""

while true; do
    # Move cursor to top
    tput cup 3 0
    
    # Clear from cursor to end of screen
    tput ed
    
    # Container count
    TOTAL=$(docker ps | grep -c onvif)
    echo -e "${GREEN}Active ONVIF Cameras:${NC} $TOTAL"
    echo ""
    
    # System stats
    echo "=== SYSTEM RESOURCES ==="
    
    # CPU Load
    LOAD=$(uptime | awk -F'load average: ' '{print $2}')
    echo "Load Average: $LOAD"
    
    # Memory
    MEM_INFO=$(free -h | grep "^Mem:" | awk '{print "Total: " $2 " | Used: " $3 " | Free: " $4 " | Available: " $7}')
    echo "Memory: $MEM_INFO"
    
    # Memory percentage
    MEM_PERCENT=$(free | grep "^Mem:" | awk '{printf "%.1f", $3/$2 * 100}')
    if [ "$(awk -v mem="$MEM_PERCENT" 'BEGIN {print (mem > 80)}')" = "1" ]; then
        echo -e "Memory Usage: ${RED}${MEM_PERCENT}%${NC}"
    elif [ "$(awk -v mem="$MEM_PERCENT" 'BEGIN {print (mem > 60)}')" = "1" ]; then
        echo -e "Memory Usage: ${YELLOW}${MEM_PERCENT}%${NC}"
    else
        echo -e "Memory Usage: ${GREEN}${MEM_PERCENT}%${NC}"
    fi
    echo ""
    
    # Container stats
    echo "=== TOP 10 CONTAINERS BY CPU ==="
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" | head -1
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" | grep onvif | sort -k2 -rn | head -10
    echo ""
    
    # Summary stats
    if [ "$TOTAL" -gt 0 ]; then
        echo "=== AVERAGES ==="
        AVG_CPU=$(docker stats --no-stream --format "{{.CPUPerc}}" | grep -E "[0-9]" | sed 's/%//' | awk '{sum+=$1; count++} END {if(count>0) printf "%.2f%%", sum/count}')
        TOTAL_CPU=$(docker stats --no-stream --format "{{.CPUPerc}}" | grep -E "[0-9]" | sed 's/%//' | awk '{sum+=$1} END {printf "%.2f%%", sum}')
        
        echo "Average CPU per camera: $AVG_CPU"
        echo "Total CPU usage: $TOTAL_CPU"
        
        # Process memory
        MEM_MB=$(ps aux | grep -E "node.*onvif" | grep -v grep | awk '{sum+=$6} END {if(NR>0) printf "%.0f", sum/1024}')
        if [ ! -z "$MEM_MB" ] && [ "$MEM_MB" -gt 0 ]; then
            AVG_MEM=$(echo "scale=1; $MEM_MB / $TOTAL" | bc 2>/dev/null || echo "N/A")
            echo "Total memory for ONVIF: ${MEM_MB} MB"
            echo "Average memory per camera: ${AVG_MEM} MB"
        fi
    fi
    
    echo ""
    echo "Last updated: $(date '+%H:%M:%S')"
    
    # Wait 5 seconds before refresh
    sleep 5
done