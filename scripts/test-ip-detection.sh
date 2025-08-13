#!/bin/bash

# Test IP detection functionality

# Source the IP detection function from launch.sh
detect_machine_ip() {
    local detected_ip=""
    
    echo "Testing IP detection methods..."
    echo ""
    
    # Method 1: Try hostname -I
    echo "Method 1: hostname -I"
    if command -v hostname >/dev/null 2>&1; then
        detected_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
        echo "  Result: ${detected_ip:-none}"
    else
        echo "  Result: hostname command not found"
    fi
    
    # Method 2: Check /etc/hostname
    echo ""
    echo "Method 2: /etc/hostname"
    if [ -f /etc/hostname ]; then
        echo "  Hostname: $(cat /etc/hostname)"
    fi
    
    # Method 3: Check network interfaces
    echo ""
    echo "Method 3: Available network interfaces"
    if [ -d /sys/class/net ]; then
        for iface in $(ls /sys/class/net); do
            if [ "$iface" != "lo" ]; then
                echo "  Interface: $iface"
            fi
        done
    fi
    
    # Final result
    echo ""
    echo "Final detected IP: ${detected_ip:-localhost}"
}

detect_machine_ip