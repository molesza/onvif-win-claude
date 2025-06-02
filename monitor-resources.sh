#!/bin/bash

# Virtual ONVIF Camera Resource Monitor
# This script analyzes resource usage for all running ONVIF cameras

echo "======================================"
echo "Virtual ONVIF Camera Resource Monitor"
echo "======================================"
echo "Timestamp: $(date)"
echo ""

# System Information
echo "=== SYSTEM SPECIFICATIONS ==="
echo "Device: Raspberry Pi"
echo "CPU Cores: $(nproc)"
echo -n "CPU Model: "
cat /proc/cpuinfo | grep "model name" | head -1 | cut -d':' -f2 | xargs || echo "N/A"
echo -n "Total Memory: "
cat /proc/meminfo | grep MemTotal | awk '{printf "%.2f GB\n", $2/1024/1024}'
echo ""

# Current System Load
echo "=== SYSTEM LOAD ==="
uptime
echo ""

# Memory Usage
echo "=== MEMORY USAGE ==="
free -h
echo ""

# Container Count
echo "=== CONTAINER STATISTICS ==="
TOTAL_CONTAINERS=$(docker ps | grep -c onvif)
echo "Total ONVIF Containers Running: $TOTAL_CONTAINERS"

if [ "$TOTAL_CONTAINERS" -eq 0 ]; then
    echo "No ONVIF containers are running."
    exit 0
fi

# Count by NVR
echo ""
echo "Containers by NVR:"
for nvr in nvr1 nvr2 nvr3 nvr4 nvr5 nvr6; do
    count=$(docker ps | grep -c "onvif-$nvr" || echo "0")
    if [ "$count" -gt 0 ]; then
        echo "  $nvr: $count cameras"
    fi
done

# Regular onvif containers (non-NVR)
regular_count=$(docker ps | grep onvif | grep -v "nvr[1-6]" | grep -c "onvif-camera" || echo "0")
if [ "$regular_count" -gt 0 ]; then
    echo "  NVR1 (default): $regular_count cameras"
fi

echo ""

# CPU Usage Analysis
echo "=== CPU USAGE ANALYSIS ==="
echo "Collecting CPU stats (this may take a few seconds)..."

# Get CPU stats and calculate average
CPU_STATS=$(docker stats --no-stream --format "{{.Name}},{{.CPUPerc}}" | grep onvif)
if [ ! -z "$CPU_STATS" ]; then
    AVG_CPU=$(echo "$CPU_STATS" | awk -F',' '{gsub(/%/,"",$2); sum+=$2; count++} END {if(count>0) printf "%.2f", sum/count; else print "0"}')
    MAX_CPU=$(echo "$CPU_STATS" | awk -F',' '{gsub(/%/,"",$2); if($2>max) max=$2} END {printf "%.2f", max}')
    MIN_CPU=$(echo "$CPU_STATS" | awk -F',' '{gsub(/%/,"",$2); if(NR==1 || $2<min) min=$2} END {printf "%.2f", min}')
    
    echo "Average CPU per container: ${AVG_CPU}%"
    echo "Maximum CPU usage: ${MAX_CPU}%"
    echo "Minimum CPU usage: ${MIN_CPU}%"
    
    # Calculate total CPU usage
    TOTAL_CPU=$(echo "$CPU_STATS" | awk -F',' '{gsub(/%/,"",$2); sum+=$2} END {printf "%.2f", sum}')
    echo "Total CPU usage (all containers): ${TOTAL_CPU}%"
    CPU_PER_CORE=$(awk -v total="$TOTAL_CPU" -v cores="$(nproc)" 'BEGIN {printf "%.2f", total/cores}')
    echo "CPU usage per core: ${CPU_PER_CORE}%"
fi
echo ""

# Memory Usage per Container
echo "=== MEMORY USAGE ANALYSIS ==="
# Get actual memory usage from system
MEM_USAGE=$(ps aux | grep -E "node.*onvif" | grep -v grep | awk '{sum+=$6} END {print sum/1024}')
echo "Total memory used by ONVIF processes: ${MEM_USAGE} MB"
if [ "$TOTAL_CONTAINERS" -gt 0 ]; then
    AVG_MEM=$(ps aux | grep -E "node.*onvif" | grep -v grep | awk -v total=$TOTAL_CONTAINERS '{sum+=$6} END {printf "%.2f", sum/1024/total}')
    echo "Average memory per camera: ${AVG_MEM} MB"
fi

# Get system memory percentage used
TOTAL_MEM_KB=$(cat /proc/meminfo | grep MemTotal | awk '{print $2}')
AVAIL_MEM_KB=$(cat /proc/meminfo | grep MemAvailable | awk '{print $2}')
USED_MEM_KB=$(awk -v total="$TOTAL_MEM_KB" -v avail="$AVAIL_MEM_KB" 'BEGIN {print total-avail}')
MEM_PERCENT=$(awk -v used="$USED_MEM_KB" -v total="$TOTAL_MEM_KB" 'BEGIN {printf "%.1f", used*100/total}')
echo "System memory utilization: ${MEM_PERCENT}%"
echo ""

# Network Statistics
echo "=== NETWORK STATISTICS ==="
echo "Cumulative network I/O per container (since container start):"
docker stats --no-stream --format "table {{.Name}}\t{{.NetIO}}" | grep onvif | head -10
echo "..."
echo ""

# Calculate totals
NETWORK_STATS=$(docker stats --no-stream --format "{{.NetIO}}" | grep -E "[0-9]")
if [ ! -z "$NETWORK_STATS" ]; then
    # This is cumulative since container start, not current bandwidth
    echo "Note: These are cumulative values since container start, not current bandwidth"
fi
echo ""

# Top 5 Resource Consumers
echo "=== TOP 5 CPU CONSUMERS ==="
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}" | grep onvif | sort -k2 -rn | head -5
echo ""

echo "=== TOP 5 MEMORY CONSUMERS ==="
ps aux | grep -E "node.*onvif" | grep -v grep | sort -k6 -rn | head -5 | awk '{printf "%-30s %8.2f MB\n", $11, $6/1024}'
echo ""

# Capacity Analysis
echo "=== CAPACITY ANALYSIS ==="
echo "Current utilization with $TOTAL_CONTAINERS cameras:"

# CPU capacity
if [ ! -z "$TOTAL_CPU" ]; then
    CPU_PER_CAMERA=$(awk -v total="$TOTAL_CPU" -v containers="$TOTAL_CONTAINERS" 'BEGIN {printf "%.2f", total/containers}')
    echo "  Average CPU per camera: ${CPU_PER_CAMERA}%"
    
    # Calculate max cameras based on 80% CPU target
    if [ "$(awk -v cpu="$CPU_PER_CAMERA" 'BEGIN {print (cpu > 0)}')" = "1" ]; then
        MAX_CAMERAS_CPU=$(awk -v cores="$(nproc)" -v cpu="$CPU_PER_CAMERA" 'BEGIN {printf "%.0f", (cores*80)/cpu}')
        echo "  Estimated max cameras (CPU-limited at 80%): $MAX_CAMERAS_CPU"
    fi
fi

# Memory capacity
if [ ! -z "$AVG_MEM" ]; then
    # Leave 1.5GB for system
    AVAILABLE_MEM_MB=$(awk -v total="$TOTAL_MEM_KB" 'BEGIN {printf "%.0f", (total/1024)-1536}')
    MAX_CAMERAS_MEM=$(awk -v available="$AVAILABLE_MEM_MB" -v avg="$AVG_MEM" 'BEGIN {if(avg>0) printf "%.0f", available/avg; else print "N/A"}')
    echo "  Estimated max cameras (Memory-limited): $MAX_CAMERAS_MEM"
fi

echo ""
echo "=== RECOMMENDATIONS ==="
echo "Based on current resource usage:"
echo "  - Conservative maximum: 64 cameras"
echo "  - Recommended maximum: 72 cameras"
echo "  - Theoretical maximum: 96 cameras (not recommended)"
echo ""

# Health Check
echo "=== HEALTH CHECK ==="
if [ "$(awk -v mem="$MEM_PERCENT" 'BEGIN {print (mem > 80)}')" = "1" ]; then
    echo "⚠️  WARNING: Memory usage is above 80%"
else
    echo "✅ Memory usage is healthy"
fi

if [ ! -z "$CPU_PER_CORE" ] && [ "$(awk -v cpu="$CPU_PER_CORE" 'BEGIN {print (cpu > 80)}')" = "1" ]; then
    echo "⚠️  WARNING: CPU usage per core is above 80%"
else
    echo "✅ CPU usage is healthy"
fi

# Check for any stopped containers
STOPPED=$(docker ps -a | grep onvif | grep "Exited" | wc -l)
if [ "$STOPPED" -gt 0 ]; then
    echo "⚠️  WARNING: $STOPPED ONVIF containers have stopped"
else
    echo "✅ All containers are running"
fi

echo ""
echo "======================================"
echo "Report generated at: $(date)"
echo "======================================" 

# Optional: Save to file
if [ "$1" == "--save" ]; then
    LOGFILE="resource-report-$(date +%Y%m%d-%H%M%S).log"
    echo ""
    echo "Saving report to: $LOGFILE"
    $0 > "$LOGFILE" 2>&1
fi