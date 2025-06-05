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
    # Get iowait percentage (5th field in the CPU line)
    iowait=$(top -b -n 1 | grep "Cpu(s)" | awk '{print $5}' | cut -d'%' -f1)
    
    # If that didn't work, try alternative format
    if [ -z "$iowait" ]; then
        iowait=$(top -b -n 1 | grep "%Cpu" | awk '{print $6}' | cut -d',' -f1)
    fi
    
    # Print current reading
    printf "%3d  | %6s%%\n" $i "$iowait"
    
    # Add to sum (using bc for floating point)
    sum=$(echo "$sum + $iowait" | bc)
    count=$((count + 1))
    
    # Wait 1 second before next reading
    sleep 1
done

# Calculate average
average=$(echo "scale=2; $sum / $count" | bc)

echo "----------------"
echo "Average iowait over 60 seconds: ${average}%"
echo ""
echo "Additional statistics:"
vmstat 1 2 | tail -1 | awk '{print "CPU idle: " $15 "%"}'
echo ""

# Show current disk utilization
echo "Current disk I/O statistics:"
iostat -x 1 2 | grep -A 20 "Device" | tail -20