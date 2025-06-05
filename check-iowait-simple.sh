#!/bin/bash

# Script to monitor iowait percentage for 60 seconds and calculate average

echo "Monitoring iowait for 60 seconds..."
echo "Time | iowait%"
echo "----------------"

# Initialize sum
sum=0
count=0

# Collect iowait data for 60 seconds
for i in {1..60}; do
    # Use iostat to get iowait percentage
    iowait=$(iostat -c 1 2 | tail -1 | awk '{print $4}')
    
    # Print current reading
    printf "%3d  | %6s%%\n" $i "$iowait"
    
    # Add to sum (using awk for floating point)
    sum=$(echo "$sum $iowait" | awk '{print $1 + $2}')
    count=$((count + 1))
done

# Calculate average using awk
average=$(echo "$sum $count" | awk '{printf "%.2f", $1 / $2}')

echo "----------------"
echo "Average iowait over 60 seconds: ${average}%"
echo ""

# Show current disk utilization
echo "Current disk I/O statistics:"
iostat -x 1 2 | tail -20

echo ""
echo "Disk usage:"
df -h | grep -E "Filesystem|/$|/srv"