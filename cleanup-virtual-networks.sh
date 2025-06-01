#!/bin/bash

# Script to cleanup virtual network interfaces
# Used by systemd service on shutdown

echo "Cleaning up virtual network interfaces..."

# Remove all virtual interfaces
for i in {1..32}; do
    VLAN_NAME="onvif-proxy-$i"
    if ip link show "$VLAN_NAME" &> /dev/null; then
        # Release DHCP lease
        dhclient -r "$VLAN_NAME" 2>/dev/null
        # Delete the interface
        ip link delete "$VLAN_NAME" 2>/dev/null
        echo "Removed $VLAN_NAME"
    fi
done

echo "Virtual network interfaces cleaned up."