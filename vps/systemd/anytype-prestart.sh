#!/bin/bash
# Pre-start cleanup: Wait for anytype ports to be released, force-kill if stuck
# Ports: 31010 (gRPC), 31011 (gRPC web proxy), 31012 (HTTP API)

PORTS="31010 31011 31012"
MAX_WAIT=30

for i in $(seq 1 $MAX_WAIT); do
    # Check if any of our ports are still in use
    IN_USE=false
    for port in $PORTS; do
        if ss -tln | grep -q ":${port} "; then
            IN_USE=true
            break
        fi
    done

    if [ "$IN_USE" = false ]; then
        echo "All ports clear, proceeding with start"
        exit 0
    fi

    echo "Waiting for ports to be released... ($i/$MAX_WAIT)"
    sleep 1
done

# Force kill whatever is holding the ports after timeout
echo "Timeout reached, force-killing processes on ports $PORTS"
for port in $PORTS; do
    fuser -k "${port}/tcp" 2>/dev/null || true
done
sleep 2
exit 0
