#!/bin/bash

# Export ONVIF Camera Statistics to CSV
# Useful for tracking resource usage over time

OUTPUT_DIR="./resource-logs"
mkdir -p "$OUTPUT_DIR"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
DATE_ONLY=$(date '+%Y-%m-%d')

# File paths
SUMMARY_FILE="$OUTPUT_DIR/resource-summary-$DATE_ONLY.csv"
DETAIL_FILE="$OUTPUT_DIR/resource-detail-$DATE_ONLY.csv"

# Initialize summary CSV with headers if it doesn't exist
if [ ! -f "$SUMMARY_FILE" ]; then
    echo "timestamp,total_cameras,avg_cpu_percent,total_cpu_percent,total_memory_mb,avg_memory_mb,system_memory_percent,load_1min,load_5min,load_15min" > "$SUMMARY_FILE"
fi

# Initialize detail CSV with headers if it doesn't exist
if [ ! -f "$DETAIL_FILE" ]; then
    echo "timestamp,container_name,cpu_percent,memory_mb,network_in_mb,network_out_mb" > "$DETAIL_FILE"
fi

# Collect data
TOTAL_CONTAINERS=$(docker ps | grep -c onvif)

if [ "$TOTAL_CONTAINERS" -eq 0 ]; then
    echo "No ONVIF containers running. Exiting."
    exit 0
fi

# Get system load
LOAD_1=$(uptime | awk -F'load average: ' '{print $2}' | awk -F', ' '{print $1}')
LOAD_5=$(uptime | awk -F'load average: ' '{print $2}' | awk -F', ' '{print $2}')
LOAD_15=$(uptime | awk -F'load average: ' '{print $2}' | awk -F', ' '{print $3}')

# Calculate CPU stats
CPU_STATS=$(docker stats --no-stream --format "{{.Name}},{{.CPUPerc}}" | grep onvif)
AVG_CPU=$(echo "$CPU_STATS" | awk -F',' '{gsub(/%/,"",$2); sum+=$2; count++} END {if(count>0) printf "%.2f", sum/count; else print "0"}')
TOTAL_CPU=$(echo "$CPU_STATS" | awk -F',' '{gsub(/%/,"",$2); sum+=$2} END {printf "%.2f", sum}')

# Calculate memory stats
TOTAL_MEM_MB=$(ps aux | grep -E "node.*onvif" | grep -v grep | awk '{sum+=$6} END {printf "%.0f", sum/1024}')
AVG_MEM_MB=$(awk -v total="$TOTAL_MEM_MB" -v containers="$TOTAL_CONTAINERS" 'BEGIN {printf "%.2f", total/containers}')

# System memory percentage
TOTAL_MEM_KB=$(cat /proc/meminfo | grep MemTotal | awk '{print $2}')
USED_MEM_KB=$(cat /proc/meminfo | grep -E "MemTotal|MemAvailable" | awk 'NR==1{total=$2} NR==2{available=$2} END{print total-available}')
MEM_PERCENT=$(awk -v used="$USED_MEM_KB" -v total="$TOTAL_MEM_KB" 'BEGIN {printf "%.2f", used*100/total}')

# Write summary data
echo "$TIMESTAMP,$TOTAL_CONTAINERS,$AVG_CPU,$TOTAL_CPU,$TOTAL_MEM_MB,$AVG_MEM_MB,$MEM_PERCENT,$LOAD_1,$LOAD_5,$LOAD_15" >> "$SUMMARY_FILE"

# Collect detailed container stats
echo "Collecting detailed container statistics..."

# Get container stats with proper parsing
docker stats --no-stream --format "{{.Container}},{{.Name}},{{.CPUPerc}},{{.NetIO}}" | grep onvif | while IFS=',' read -r container name cpu netio; do
    # Parse CPU
    cpu_clean=$(echo "$cpu" | sed 's/%//')
    
    # Parse network I/O (format: "XXX MB / YYY MB" or "XXX GB / YYY GB")
    net_in=$(echo "$netio" | awk '{print $1 " " $2}')
    net_out=$(echo "$netio" | awk '{print $4 " " $5}')
    
    # Convert to MB
    net_in_mb=$(echo "$net_in" | awk '{
        if ($2 == "GB") print $1 * 1024;
        else if ($2 == "MB") print $1;
        else if ($2 == "kB") print $1 / 1024;
        else print 0
    }')
    
    net_out_mb=$(echo "$net_out" | awk '{
        if ($2 == "GB") print $1 * 1024;
        else if ($2 == "MB") print $1;
        else if ($2 == "kB") print $1 / 1024;
        else print 0
    }')
    
    # Get memory for this specific process
    mem_mb=$(ps aux | grep -E "node.*$name" | grep -v grep | head -1 | awk '{printf "%.2f", $6/1024}')
    if [ -z "$mem_mb" ]; then
        mem_mb="0"
    fi
    
    # Write detail record
    echo "$TIMESTAMP,$name,$cpu_clean,$mem_mb,$net_in_mb,$net_out_mb" >> "$DETAIL_FILE"
done

echo "Statistics exported to:"
echo "  Summary: $SUMMARY_FILE"
echo "  Details: $DETAIL_FILE"
echo ""
echo "Latest summary:"
tail -1 "$SUMMARY_FILE" | awk -F',' '{
    printf "Cameras: %d | Avg CPU: %s%% | Total CPU: %s%% | Total Mem: %s MB | System Mem: %s%%\n", 
    $2, $3, $4, $5, $7
}'

# Optional: Create a simple plot data file
PLOT_FILE="$OUTPUT_DIR/plot-data-$DATE_ONLY.txt"
echo "$TIMESTAMP $TOTAL_CONTAINERS $AVG_CPU $TOTAL_MEM_MB $MEM_PERCENT" >> "$PLOT_FILE"